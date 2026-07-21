// bainoidoi.js — Bài Nói Dối (Bluff/Liar) — chế độ cược
import { createDeck, renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

const suitNames = ['♠', '♣', '♦', '♥'];
const suitRank = { '♠': 0, '♣': 1, '♦': 2, '♥': 3 };
const suitEmojis = { '♠': '♠️', '♣': '♣️', '♦': '♦️', '♥': '♥️' };
const valRank = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

class BaiNoiDoi {
  constructor() {
    this.player = { hand: [] };
    this.ai = { hand: [] };
    this.pile = [];
    this.currentDeclare = null;
    this.balance = 0;
    this.currentBet = 0;
    this.cachedBuffPct = 0;
    this.cachedPet = null;
    this.phase = 'betting';
    this.turn = 'player';
    this.betSettled = true;
    this.selectedCards = new Set();
    this.unsubBalance = null;
    this.initAfterAuth();
  }

  async initAfterAuth() {
    await new Promise(r => { const u = onAuthStateChanged(auth, user => { u(); if (user) r(); else location.href = 'index.html'; }); });
    this.listenBalance();
    this.refreshBuffCache();
    this.setupSplash();
    this.bindEvents();
    window.game = this;
  }

  setupSplash() {
    const playBtn = document.getElementById('bnd-play-btn');
    const menu = document.getElementById('bnd-menu');
    const gameScreen = document.getElementById('bnd-game-screen');
    const statusBar = document.getElementById('bc-status');
    const betInputMenu = document.getElementById('bnd-bet-input-menu');
    const betInput = document.getElementById('bc-bet-input');

    if (!playBtn || !menu || !gameScreen) return;

    playBtn.addEventListener('click', () => {
      if (betInput && betInputMenu) {
        betInput.value = betInputMenu.value;
      }
      menu.classList.remove('active');
      menu.style.display = 'none';
      gameScreen.classList.add('active');
      gameScreen.style.display = '';
      statusBar.style.display = '';
      document.getElementById('bc-bet-row').style.display = 'flex';
    });
  }

  listenBalance() {
    if (this.unsubBalance) this.unsubBalance();
    this.unsubBalance = subscribeBalance(pts => { this.balance = pts; if (window.TopNav) window.TopNav.setPoints(this.balance); });
  }

  async refreshBuffCache() {
    try { const i = await getActivePetInfo(); this.cachedBuffPct = i.buff; this.cachedPet = i.pet; } catch { this.cachedBuffPct = 0; this.cachedPet = null; }
  }

  bindEvents() {
    document.getElementById('btn-place-bet').addEventListener('click', () => this.placeBet());
    document.getElementById('bnd-play-btn').addEventListener('click', () => this.showDeclareOptions());
    document.getElementById('bnd-call-btn').addEventListener('click', () => this.callBluff());
  }

  placeBet() {
    if (this.phase !== 'betting' && this.phase !== 'result') {
      window.showToast('⏳ Không thể đặt cược lúc này', 'warn');
      return;
    }
    const amt = parseInt(document.getElementById('bc-bet-input').value);
    if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50 〄', 'warn'); return; }
    if (amt > this.balance) { window.showToast('Không đủ điểm!', 'error'); return; }
    this.currentBet = amt;
    this.betSettled = false;
    this.startGame(amt);
  }

  startGame(bet) {
    this.phase = 'playing';
    this.pile = [];
    this.currentDeclare = null;
    this.selectedCards = new Set();
    this.turn = Math.random() > 0.5 ? 'player' : 'ai';

    document.getElementById('bc-bet-row').style.display = 'none';
    document.getElementById('bc-status').className = 'bc-status';
    document.getElementById('bc-bet-stat').textContent = this.currentBet.toLocaleString('vi-VN');
    document.getElementById('bc-status-msg').textContent = 'Đang chia bài...';
    document.getElementById('bnd-declare').style.display = 'none';
    document.getElementById('bnd-actions').style.display = 'none';

    const deck = createDeck();
    this.player.hand = deck.splice(0, 13);
    this.ai.hand = deck;

    this.sortHand(this.player.hand);
    this.renderTable();
    this.renderHand();
    this.bndStatus('Đặt cược để bắt đầu!');

    setTimeout(() => {
      if (this.turn === 'player') {
        this.showDeclareOptions();
      } else {
        this.bndStatus('🤖 Máy đang chọn bài...');
        setTimeout(() => this.aiTurn(), 800);
      }
    }, 500);
  }

  sortHand(hand) { hand.sort((a, b) => suitRank[a.s] - suitRank[b.s] || valRank[a.v] - valRank[b.v]); }

  showDeclareOptions() {
    document.getElementById('bnd-actions').style.display = 'none';
    document.getElementById('bnd-declare').style.display = 'block';
    const container = document.getElementById('bnd-declare-options');
    container.innerHTML = suitNames.map(s => 
      `<button class="bnd-declare-btn" data-val="${s}" onclick="window.game?.selectDeclare('${s}')">${suitEmojis[s] || s}</button>`
    ).join('');
    this.bndStatus('Chọn <strong>chất bài</strong> bạn muốn NÓI DỐI:');
  }

  selectDeclare(val) {
    this.currentDeclare = val;
    document.getElementById('bnd-declare').style.display = 'none';
    document.getElementById('bnd-actions').style.display = 'flex';
    const count = this.player.hand.filter(c => c.s === val).length;
    this.bndStatus(`Bạn nói dối là đánh <strong>chất ${suitEmojis[val] || val}</strong> (bạn có ${count} lá chất này thật). Chọn bài để đánh (hoặc bấm Tố cáo nếu muốn):`);
  }

  toggleCard(idx) {
    if (this.phase !== 'playing' || this.turn !== 'player') return;
    if (this.selectedCards.has(idx)) this.selectedCards.delete(idx);
    else this.selectedCards.add(idx);
    this.renderHand();
  }

  async playCards() {
    if (!this.currentDeclare || this.selectedCards.size === 0) {
      window.showToast('Chọn ít nhất 1 lá bài!', 'warn');
      return;
    }
    const cards = [...this.selectedCards].sort((a,b)=>b-a).map(i => this.player.hand.splice(i,1)[0]);
    this.pile.push({ by: 'player', cards, declare: this.currentDeclare });
    this.selectedCards = new Set();
    this.turn = 'ai';
    
    document.getElementById('bnd-actions').style.display = 'none';
    this.renderTable();
    this.renderHand();
    this.bndStatus(`Bạn đánh ${cards.length} lá (nói dối là chất ${suitEmojis[this.currentDeclare] || this.currentDeclare})`);

    if (this.player.hand.length === 0) { await this.endGame('player'); return; }
    if (this.ai.hand.length === 0) { await this.endGame('ai'); return; }

    await this.delay(1000);
    this.bndStatus('🤖 Máy đang cân nhắc...');
    await this.delay(1500);
    
    if (Math.random() < 0.35) {
      this.aiCallBluff();
    } else {
      this.aiTurn();
    }
  }

  async aiCallBluff() {
    this.bndStatus('🔍 Máy TỐ CÁO bạn!');
    await this.delay(600);
    this.checkBluff('ai', 'player');
  }

  async callBluff() {
    if (this.phase !== 'playing' || this.turn !== 'player') return;
    if (this.pile.length === 0 || this.pile[this.pile.length-1].by !== 'ai') {
      window.showToast('Lượt của bạn, không thể tố cáo!', 'warn');
      return;
    }
    document.getElementById('bnd-actions').style.display = 'none';
    this.checkBluff('player', 'ai');
  }

  async checkBluff(caller, target) {
    this.phase = 'result';
    const last = this.pile[this.pile.length-1];
    const actualSuit = last.cards[0].s;
    const isBluff = actualSuit !== last.declare;
    
    let callerWon = (isBluff && caller === target) || (!isBluff && caller !== target);
    
    this.renderTable(true);
    await this.delay(1000);
    
    const declaredLabel = suitEmojis[last.declare] || last.declare;
    const actualLabel = last.cards.map(c => c.v + c.s).join(', ');
    this.bndStatus(`Lật bài: ${actualLabel} — ${isBluff ? `NÓI DỐI! (không phải chất ${declaredLabel})` : `NÓI THẬT! (đúng chất ${declaredLabel})`}`);

    const winner = callerWon ? caller : target;
    const loser = callerWon ? target : caller;
    
    if (loser === 'player') {
      this.player.hand.push(...this.pile.flatMap(p => p.cards));
      this.sortHand(this.player.hand);
      this.renderHand();
    } else {
      this.ai.hand.push(...this.pile.flatMap(p => p.cards));
      this.sortHand(this.ai.hand);
    }
    this.pile = [];
    
    await this.delay(1000);
    this.renderTable();

    if (this.player.hand.length === 0) { await this.endGame('player'); return; }
    if (this.ai.hand.length === 0) { await this.endGame('ai'); return; }
    
    this.phase = 'playing';
    this.turn = winner;
    this.currentDeclare = null;
    
    if (this.turn === 'player') {
      this.showDeclareOptions();
    } else {
      this.bndStatus('🤖 Máy thắng tố cáo! Lượt máy...');
      await this.delay(1000);
      this.aiTurn();
    }
  }

  async aiTurn() {
    if (this.phase !== 'playing') return;
    const declareSuit = suitNames[Math.floor(Math.random() * suitNames.length)];
    const actualCards = this.ai.hand.filter(c => c.s === declareSuit);
    const cardsToPlay = actualCards.length > 0 ? actualCards.slice(0, Math.min(actualCards.length, Math.floor(Math.random() * 3) + 1)) : [];
    
    if (cardsToPlay.length === 0) {
      const randomCard = this.ai.hand[Math.floor(Math.random() * this.ai.hand.length)];
      this.ai.hand = this.ai.hand.filter(c => c !== randomCard);
      this.pile.push({ by: 'ai', cards: [randomCard], declare: declareSuit });
    } else {
      cardsToPlay.forEach(c => { this.ai.hand = this.ai.hand.filter(h => h !== c); });
      this.pile.push({ by: 'ai', cards: cardsToPlay, declare: declareSuit });
    }

    this.turn = 'player';
    this.renderTable();
    this.bndStatus(`🤖 Máy đánh ${cardsToPlay.length || 1} lá (nói là chất ${suitEmojis[declareSuit] || declareSuit})`);

    if (this.ai.hand.length === 0) { await this.endGame('ai'); return; }
    if (this.player.hand.length === 0) { await this.endGame('player'); return; }

    document.getElementById('bnd-actions').style.display = 'flex';
    this.bndStatus('Lượt bạn: chọn Đánh bài hoặc Tố cáo!');
  }

  async endGame(winner) {
    this.phase = 'result';
    document.getElementById('bnd-actions').style.display = 'none';
    document.getElementById('bnd-declare').style.display = 'none';

    const won = winner === 'player';
    let net = 0, buffBonus = 0;
    if (won) {
      const profit = this.currentBet;
      if (this.cachedBuffPct > 0) buffBonus = Math.round(profit * this.cachedBuffPct / 100);
      net = profit + buffBonus;
      if (window.VTQuests) { window.VTQuests.trackPlay('bainoidoi'); window.VTQuests.trackWinSmart(); }
    } else {
      net = -this.currentBet;
      if (window.VTQuests) window.VTQuests.trackPlay('bainoidoi');
    }

    this.betSettled = true;
    if (net !== 0) {
      try { await addPoints('BaiNoiDoi', won ? 'Thắng Bài Nói Dối' : 'Thua Bài Nói Dối', net, false); } catch {}
    }

    document.getElementById('bc-status').className = won ? 'bc-status result-win' : 'bc-status result-lose';
    document.getElementById('bc-status-msg').textContent = won ? 'THẮNG!' : 'THUA';
    const pe = document.getElementById('bc-profit-stat');
    pe.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
    pe.className = 'stat-profit ' + (net > 0 ? 'positive' : 'negative');

    this.bndStatus(won ? '🎉 Bạn hết bài trước! Thắng!' : '😢 Máy hết bài trước! Thua!');
    
    this.phase = 'betting';
    document.getElementById('bc-bet-row').style.display = 'flex';
  }

  renderTable(showPile = false) {
    const aiCount = this.ai.hand.length;
    const pileCards = this.pile.length ? `(${this.pile.reduce((s,p)=>s+p.cards.length,0)} lá)` : '';
    document.getElementById('bnd-table').innerHTML = `
      <div class="bnd-row">
        <div class="bnd-seat dealer">
          <span>🤖 Máy · <strong>${aiCount}</strong> lá</span>
        </div>
      </div>
      <div class="bnd-pile">
        ${pileCards ? `<div class="bnd-pile-label">Chồng bài ${pileCards}</div>` : '<div class="bnd-pile-label">Chưa có bài</div>'}
      </div>
      <div class="bnd-row">
        <div class="bnd-seat me">
          <span>Bạn · <strong>${this.player.hand.length}</strong> lá</span>
        </div>
      </div>`;
  }

  renderHand() {
    if (!this.player.hand.length) { document.getElementById('bnd-hand').innerHTML = '<div style="color:#4ade80;text-align:center">🎉 Hết bài!</div>'; return; }
    document.getElementById('bnd-hand').innerHTML = this.player.hand.map((c, i) => {
      const sel = this.selectedCards.has(i) ? 'bnd-card-sel' : '';
      return `<div class="bnd-hand-card ${sel}" onclick="window.game?.toggleCard(${i})">${renderCardUI(c)}</div>`;
    }).join('');
  }

  bndStatus(html) { document.getElementById('bnd-status').innerHTML = html; }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  forfeitIfAbandoned() {
    if (this.betSettled || this.phase === 'betting') return;
    this.betSettled = true;
    addPoints('BaiNoiDoi', 'Bài Nói Dối out phòng - mất cược', -this.currentBet, false).catch(() => {});
  }
}

new BaiNoiDoi();
window.addEventListener('pagehide', () => { window.game?.forfeitIfAbandoned(); window.game?.unsubBalance?.(); });
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.location.href="../../games.html"})}},100);
