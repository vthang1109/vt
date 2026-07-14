// catte.js — Cát Tê (Sáu Lá) vs AI — chế độ cược
import { createDeck, renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

const suitRank = { '♠':1, '♣':2, '♦':3, '♥':4 };
const valRank = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

class CatTe {
  constructor() {
    this.player = { hand: [], played: [] };
    this.ai = { hand: [], played: [] };
    this.balance = 0;
    this.currentBet = 0;
    this.cachedBuffPct = 0;
    this.cachedPet = null;
    this.phase = 'betting';
    this.turn = 'player';
    this.round = 0;
    this.betSettled = true;
    this.unsubBalance = null;
    this.lastPlayerCard = null;
    this.lastAiCard = null;
    this.selectedIdx = -1;
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
    document.getElementById('btn-play-ai').addEventListener('click', () => this.playCard());
    document.getElementById('btn-fold-ct').addEventListener('click', () => this.fold());
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
    this.round = 0;
    this.player.played = [];
    this.ai.played = [];
    this.lastPlayerCard = null;
    this.lastAiCard = null;
    this.selectedIdx = -1;

    document.getElementById('bc-bet-row').style.display = 'none';
    document.getElementById('bc-status').className = 'bc-status';
    document.getElementById('bc-bet-stat').textContent = this.currentBet.toLocaleString('vi-VN');
    document.getElementById('bc-profit-stat').textContent = '0';
    document.getElementById('bc-profit-stat').className = 'stat-profit zero';
    document.getElementById('bc-status-msg').textContent = 'Đang chia bài...';
    document.getElementById('ct-actions').style.display = 'none';
    document.getElementById('ct-info').textContent = '';

    const deck = createDeck();
    this.ai.hand = [];
    this.player.hand = [];
    for (let i = 0; i < 6; i++) { this.ai.hand.push(deck.pop()); this.player.hand.push(deck.pop()); }

    this.sortHand(this.player.hand);
    this.sortHand(this.ai.hand);

    this.renderTable();
    this.renderHand();
    document.getElementById('bc-status-msg').textContent = 'Lượt 1 — Chọn bài';

    setTimeout(() => {
      if (this.phase !== 'playing') return;
      document.getElementById('ct-actions').style.display = 'flex';
    }, 500);
  }

  sortHand(hand) {
    hand.sort((a, b) => { const s = suitRank[b.s] - suitRank[a.s]; return s !== 0 ? s : valRank[b.v] - valRank[a.v]; });
  }

  canBeat(playCard, lastCard) {
    if (!lastCard) return true;
    if (playCard.s !== lastCard.s) return false;
    return valRank[playCard.v] > valRank[lastCard.v];
  }

  async playCard() {
    if (this.phase !== 'playing' || this.turn !== 'player') return;
    if (this.selectedIdx < 0 || this.selectedIdx >= this.player.hand.length) {
      window.showToast('Chọn 1 lá bài trước!', 'warn');
      return;
    }
    const card = this.player.hand[this.selectedIdx];
    if (!this.canBeat(card, this.lastAiCard)) {
      window.showToast('Không thể đánh lá này! Cần cùng chất và lớn hơn', 'warn');
      return;
    }

    this.player.hand.splice(this.selectedIdx, 1);
    this.player.played.push(card);
    this.lastPlayerCard = card;
    this.selectedIdx = -1;
    this.turn = 'ai';
    this.round++;

    document.getElementById('ct-actions').style.display = 'none';
    document.getElementById('bc-status-msg').textContent = `Lượt ${this.round + 1} — Máy đánh...`;
    this.renderTable();
    this.renderHand();

    if (this.player.hand.length === 0) { this.endGame('player'); return; }
    if (this.ai.hand.length === 0) { this.endGame('ai'); return; }

    await this.delay(800);
    this.aiTurn();
  }

  async aiTurn() {
    if (this.phase !== 'playing') return;
    let beatIdx = -1;
    for (let i = 0; i < this.ai.hand.length; i++) {
      if (this.canBeat(this.ai.hand[i], this.lastPlayerCard)) {
        beatIdx = i;
        break;
      }
    }

    if (beatIdx >= 0) {
      const card = this.ai.hand.splice(beatIdx, 1)[0];
      this.ai.played.push(card);
      this.lastAiCard = card;
    } else {
      this.endGame('player');
      return;
    }

    this.round++;
    this.turn = 'player';
    this.renderTable();
    this.renderHand();

    if (this.ai.hand.length === 0) { this.endGame('ai'); return; }
    if (this.player.hand.length === 0) { this.endGame('player'); return; }

    document.getElementById('bc-status-msg').textContent = `Lượt ${this.round + 1} — Chọn bài`;
    document.getElementById('ct-actions').style.display = 'flex';
  }

  async fold() {
    if (this.phase !== 'playing') return;
    this.endGame('ai');
  }

  async endGame(winner) {
    this.phase = 'result';
    document.getElementById('ct-actions').style.display = 'none';

    const won = winner === 'player';
    let net = 0, buffBonus = 0;
    if (won) {
      const profit = this.currentBet;
      if (this.cachedBuffPct > 0) buffBonus = Math.round(profit * this.cachedBuffPct / 100);
      net = profit + buffBonus;
    } else {
      net = -this.currentBet;
    }

    this.betSettled = true;
    if (net !== 0) {
      try { await addPoints('CatTe', won ? 'Thắng Cát Tê' : 'Thua Cát Tê', net, false); } catch {}
    }

    document.getElementById('bc-status').className = won ? 'bc-status result-win' : 'bc-status result-lose';
    document.getElementById('bc-status-msg').textContent = won ? 'THẮNG!' : 'THUA';
    const pe = document.getElementById('bc-profit-stat');
    pe.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
    pe.className = 'stat-profit ' + (net > 0 ? 'positive' : 'negative');

    document.getElementById('ct-info').innerHTML = won ? '🎉 Bạn thắng!' : '😢 Máy thắng!';
    
    this.phase = 'betting';
    document.getElementById('bc-bet-row').style.display = 'flex';
  }

  renderTable() {
    const ac = this.ai.played.length ? this.ai.played.map(c => renderCardUI(c)).join('') : '<span style="color:#64748b;font-size:12px">Chưa đánh</span>';
    const pc = this.player.played.length ? this.player.played.map(c => renderCardUI(c)).join('') : '<span style="color:#64748b;font-size:12px">Chưa đánh</span>';
    const ah = this.ai.hand.length ? `+${this.ai.hand.length} lá` : 'Hết bài!';
    document.getElementById('ct-table').innerHTML = `
      <div class="ct-seat dealer">
        <div class="ct-seat-head">🤖 Máy · <span class="ct-card-count">${ah}</span></div>
        <div class="ct-cards">${ac}</div>
      </div>
      <div class="ct-seat me">
        <div class="ct-seat-head">Bạn · <span class="ct-card-count">${this.player.hand.length} lá</span></div>
        <div class="ct-cards">${pc}</div>
      </div>`;
  }

  renderHand() {
    if (!this.player.hand.length) { document.getElementById('ct-hand').innerHTML = '<div style="color:#64748b;text-align:center;padding:10px">Hết bài!</div>'; return; }
    document.getElementById('ct-hand').innerHTML = this.player.hand.map((c, i) => {
      const sel = i === this.selectedIdx ? 'ct-card-selected' : '';
      return `<div class="ct-hand-card ${sel}" data-idx="${i}" onclick="window.game?.selectCard(${i})">${renderCardUI(c)}</div>`;
    }).join('');
  }

  selectCard(idx) {
    if (this.phase !== 'playing' || this.turn !== 'player') return;
    this.selectedIdx = this.selectedIdx === idx ? -1 : idx;
    this.renderHand();
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  forfeitIfAbandoned() {
    if (this.betSettled || this.phase === 'betting') return;
    this.betSettled = true;
    addPoints('CatTe', 'Cát Tê out phòng - mất cược', -this.currentBet, false).catch(() => {});
  }
}

new CatTe();
window.addEventListener('pagehide', () => { window.game?.forfeitIfAbandoned(); window.game?.unsubBalance?.(); });
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());
