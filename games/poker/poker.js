// poker.js — Poker Texas Hold'em — chế độ cược
import { createDeck, renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

const valRank = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

class Poker {
  constructor() {
    this.player = { cards: [] };
    this.ai = { cards: [] };
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.aiChips = 0;
    this.phase = 'betting';
    this.stage = 'preflop';
    this.balance = 0;
    this.cachedBuffPct = 0;
    this.cachedPet = null;
    this.betSettled = true;
    this.unsubBalance = null;
    this.initAfterAuth();
  }

  async initAfterAuth() {
    await new Promise(r => { const u = onAuthStateChanged(auth, user => { u(); if (user) r(); else location.href = 'index.html'; }); });
    this.listenBalance();
    this.refreshBuffCache();
    this.bindEvents();
    document.getElementById('bc-bet-row').style.display = 'flex';
    window.game = this;
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
    document.getElementById('pk-call').addEventListener('click', () => this.call());
    document.getElementById('pk-fold').addEventListener('click', () => this.fold());
    document.getElementById('pk-allin').addEventListener('click', () => this.allIn());
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
    this.aiChips = amt;
    this.betSettled = false;
    this.startGame(amt);
  }

  startGame(bet) {
    this.pot = 0;
    this.community = [];
    this.stage = 'preflop';
    this.phase = 'playing';
    this._cachedWinner = null;

    document.getElementById('bc-bet-row').style.display = 'none';
    document.getElementById('bc-status').className = 'bc-status';
    document.getElementById('bc-bet-stat').textContent = this.currentBet.toLocaleString('vi-VN');
    document.getElementById('bc-status-msg').textContent = 'Pre-Flop';

    this.deck = createDeck();
    this.player.cards = [this.deck.pop(), this.deck.pop()];
    this.ai.cards = [this.deck.pop(), this.deck.pop()];

    this.renderTable();
    this.showActions();
    this.pkInfo('Lượt của bạn:');
  }

  pkInfo(msg) { document.getElementById('pk-info').textContent = msg; }

  async call() {
    if (this.phase !== 'playing') return;
    this.pot += this.currentBet;
    document.getElementById('pk-actions').style.display = 'none';
    await this.nextStage();
  }

  async allIn() {
    if (this.phase !== 'playing') return;
    this.pot += this.currentBet;
    document.getElementById('pk-actions').style.display = 'none';
    await this.nextStage();
  }

  async fold() {
    if (this.phase !== 'playing') return;
    this.phase = 'result';
    this._cachedWinner = 'ai';
    document.getElementById('pk-actions').style.display = 'none';
    this.renderTable(true);
    await this.delay(800);
    await this.endRound('ai');
  }

  async nextStage() {
    if (this.stage === 'preflop') {
      for (let i = 0; i < 3; i++) this.community.push(this.deck.pop());
      this.stage = 'flop';
    } else if (this.stage === 'flop') {
      this.community.push(this.deck.pop());
      this.stage = 'turn';
    } else if (this.stage === 'turn') {
      this.community.push(this.deck.pop());
      this.stage = 'river';
    } else {
      this.phase = 'result';
      this.renderTable(true);
      await this.delay(800);
      await this.showdown();
      return;
    }

    this.renderCommunity();
    document.getElementById('bc-status-msg').textContent = this.stage.toUpperCase();
    await this.delay(600);
    this.aiDecision();
  }

  async aiDecision() {
    const hand = this.evaluateHand([...this.ai.cards, ...this.community]);
    const strength = hand.rank;
    const aiCalls = strength > 500 || Math.random() < 0.3 || this.community.length === 0;
    
    if (!aiCalls) {
      await this.delay(500);
      await this.endRound('player');
      return;
    }
    
    this.pot += this.currentBet;
    this.pkInfo('🤖 Máy theo cược');
    await this.delay(800);
    
    if (this.stage === 'river') {
      this.phase = 'result';
      this.renderTable(true);
      await this.delay(800);
      await this.showdown();
    } else {
      this.showActions();
    }
  }

  async showdown() {
    const ph = this.evaluateHand([...this.player.cards, ...this.community]);
    const ah = this.evaluateHand([...this.ai.cards, ...this.community]);
    
    let winner;
    if (ph.rank > ah.rank) winner = 'player';
    else if (ah.rank > ph.rank) winner = 'ai';
    else winner = 'draw';
    this._cachedWinner = winner;
    
    this.pkInfo(`Bạn: <strong>${ph.name}</strong> | Máy: <strong>${ah.name}</strong>`);
    setTimeout(() => {
      document.getElementById('pk-info').innerHTML = `
        <div>Bạn: <strong>${ph.name}</strong></div>
        <div>Máy: <strong>${ah.name}</strong></div>
      `;
    }, 100);
    
    await this.delay(1000);
    await this.endRound(winner);
  }

  async endRound(winner) {
    const won = winner === 'player';
    let net = 0, buffBonus = 0;
    if (won) {
      const profit = this.pot;
      if (this.cachedBuffPct > 0) buffBonus = Math.round(profit * this.cachedBuffPct / 100);
      net = profit + buffBonus;
      if (window.VTQuests) { window.VTQuests.trackPlay('poker'); window.VTQuests.trackWinSmart(); }
    } else if (winner === 'ai') {
      net = -this.currentBet;
      if (window.VTQuests) window.VTQuests.trackPlay('poker');
    } else {
      net = 0;
      if (window.VTQuests) window.VTQuests.trackPlay('poker');
    }

    this.betSettled = true;
    if (net !== 0) {
      try { await addPoints('Poker', won ? 'Thắng Poker' : 'Thua Poker', net, false); } catch {}
    }

    const el = document.getElementById('bc-status');
    el.className = won ? 'bc-status result-win' : winner === 'ai' ? 'bc-status result-lose' : 'bc-status result-draw';
    document.getElementById('bc-status-msg').textContent = won ? 'THẮNG!' : winner === 'ai' ? 'THUA' : 'HÒA';
    const pe = document.getElementById('bc-profit-stat');
    pe.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
    pe.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');

    document.getElementById('pk-info').innerHTML += `<div style="margin-top:6px;font-size:16px">${won ? '🎉' : winner === 'ai' ? '😢' : '🤝'} ${won ? 'Bạn thắng!' : winner === 'ai' ? 'Máy thắng!' : 'Hòa!'}</div>`;
    
    this.phase = 'betting';
    document.getElementById('bc-bet-row').style.display = 'flex';
    this.pkInfo('Đặt cược để chơi tiếp!');
  }

  evaluateHand(cards) {
    const values = cards.map(c => valRank[c.v]).sort((a,b)=>a-b);
    const suits = cards.map(c => c.s);
    const counts = {};
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const groups = Object.entries(counts).sort((a,b) => b[1]-a[1] || b[0]-a[0]);
    const isFlush = suits.every(s => s === suits[0]);
    
    let isStraight = false;
    let straightHigh = 0;
    const unique = [...new Set(values)].sort((a,b)=>a-b);
    for (let i = 0; i <= unique.length - 5; i++) {
      if (unique[i+4] - unique[i] === 4) { isStraight = true; straightHigh = unique[i+4]; break; }
    }
    if (!isStraight && values.includes(14) && values.includes(2) && values.includes(3) && values.includes(4) && values.includes(5)) {
      isStraight = true; straightHigh = 5;
    }

    if (isFlush && isStraight && straightHigh === 14) return { rank: 9000, name: '🎆 Thùng phá sảnh!' };
    if (isFlush && isStraight) return { rank: 8000 + straightHigh, name: `🌟 Thùng phá sảnh ${straightHigh}` };
    if (groups[0][1] === 4) return { rank: 7000 + +groups[0][0], name: `💎 Tứ quý ${groups[0][0]}` };
    if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) return { rank: 6000 + +groups[0][0], name: `🃏 Cù lũ ${groups[0][0]}` };
    if (isFlush) return { rank: 5000 + Math.max(...values), name: '🌊 Thùng' };
    if (isStraight) return { rank: 4000 + straightHigh, name: `📏 Sảnh ${straightHigh}` };
    if (groups[0][1] === 3) return { rank: 3000 + +groups[0][0], name: `🔱 Bộ ba ${groups[0][0]}` };
    if (groups[0][1] === 2 && groups.length > 1 && groups[1][1] === 2) return { rank: 2000 + Math.max(+groups[0][0], +groups[1][0]), name: `✌️ Hai đôi ${groups[0][0]}-${groups[1][0]}` };
    if (groups[0][1] === 2) return { rank: 1000 + +groups[0][0], name: `👆 Một đôi ${groups[0][0]}` };
    return { rank: Math.max(...values), name: `🃏 Mậu thầu ${Math.max(...values)}` };
  }

  getHandRankStr(cards) {
    if (!cards || cards.length === 0) return '';
    const h = this.evaluateHand(cards);
    return h.name;
  }

  getResultOverlay(winnerSide) {
    // winnerSide: 'player' | 'ai' | 'draw'
    if (!winnerSide) return { dealer: '', player: '' };
    if (winnerSide === 'player') {
      return {
        dealer: '<div class="pk-result-overlay pk-result-lose">THUA</div>',
        player: '<div class="pk-result-overlay pk-result-win">THẮNG</div>'
      };
    } else if (winnerSide === 'ai') {
      return {
        dealer: '<div class="pk-result-overlay pk-result-win">THẮNG</div>',
        player: '<div class="pk-result-overlay pk-result-lose">THUA</div>'
      };
    } else {
      return {
        dealer: '<div class="pk-result-overlay pk-result-draw">HÒA</div>',
        player: '<div class="pk-result-overlay pk-result-draw">HÒA</div>'
      };
    }
  }

  renderTable(showAI = false) {
    // Determine winner for overlay - only at result phase
    let winnerOverlay = { dealer: '', player: '' };
    if (this.phase === 'result' && this._cachedWinner) {
      winnerOverlay = this.getResultOverlay(this._cachedWinner);
    }

    const aiScore = showAI 
      ? this.getHandRankStr([...this.ai.cards, ...this.community]) 
      : '? ';
    const playerScore = this.phase === 'result' || this.community.length > 0 
      ? this.getHandRankStr([...this.player.cards, ...this.community]) 
      : 'Chờ bài';

    const aiLabel = showAI 
      ? this.ai.cards.map(c => renderCardUI(c)).join('') 
      : '<div class="pk-card-back">🂠🂠</div>';

    // Pot hiển thị trong label bài chung
    const potLabel = this.pot > 0 ? ` · Pot ${this.pot.toLocaleString('vi-VN')}〄` : '';

    const communityHTML = this.community.length
      ? `<div class="pk-community">
          <div class="pk-comm-label">Bài chung (${this.community.length}/5)${potLabel}</div>
          <div class="pk-comm-cards">${this.community.map(c => renderCardUI(c)).join('')}</div>
         </div>`
      : `<div class="pk-community">
          <div class="pk-comm-label">Bài chung (0/5)${potLabel}</div>
          <div class="pk-comm-cards"><div style="color:#64748b;font-size:12px">Chờ lật bài chung</div></div>
         </div>`;

    // Bet badges cho mỗi seat (giống xidach)
    const dealerBetBadge = this.currentBet > 0 ? `<div class="pk-bet-badge">${this.currentBet.toLocaleString('vi-VN')}〄</div>` : '';
    const playerBetBadge = this.currentBet > 0 ? `<div class="pk-bet-badge">${this.currentBet.toLocaleString('vi-VN')}〄</div>` : '';

    document.getElementById('pk-table').innerHTML = `
      <div class="pk-seat dealer">
        ${winnerOverlay.dealer}
        <div class="pk-seat-head">
          <span class="pk-seat-name">🤖 Máy <span class="pk-score-inline">${aiScore}</span></span>
        </div>
        <div class="pk-cards-row">${aiLabel}</div>
        ${dealerBetBadge}
      </div>

      ${communityHTML}

      <div class="pk-seat me">
        ${winnerOverlay.player}
        <div class="pk-seat-head">
          <span class="pk-seat-name">Bạn <span class="pk-score-inline">${playerScore}</span></span>
        </div>
        <div class="pk-cards-row">${this.player.cards.map(c => renderCardUI(c)).join('')}</div>
        ${playerBetBadge}
      </div>`;
  }

  renderCommunity() {
    // Community is now rendered inside renderTable(), so this is a no-op
    // Kept for compatibility but table is re-rendered on stage changes
    this.renderTable(this.phase === 'result');
  }

  showActions() {
    document.getElementById('pk-actions').style.display = 'flex';
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  forfeitIfAbandoned() {
    if (this.betSettled || this.phase === 'betting') return;
    this.betSettled = true;
    addPoints('Poker', 'Poker out phòng - mất cược', -this.currentBet, false).catch(() => {});
  }
}

new Poker();
window.addEventListener('pagehide', () => { window.game?.forfeitIfAbandoned(); window.game?.unsubBalance?.(); });
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.location.href="../../games.html"})}},100);
