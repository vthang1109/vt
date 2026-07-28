// ===== COIN FLIP APP — Tung Đồng Xu =====
class CoinFlipApp {
  constructor() {
    this.stats = this.loadStats();
    this.side = null; // 'heads' | 'tails'
    this._flipping = false;
    this.renderStats();
  }

  loadStats() {
    try { return JSON.parse(localStorage.getItem('vt_coinflip_stats')) || { heads: 0, tails: 0, correct: 0, total: 0 }; }
    catch { return { heads: 0, tails: 0, correct: 0, total: 0 }; }
  }

  saveStats() {
    localStorage.setItem('vt_coinflip_stats', JSON.stringify(this.stats));
    this.renderStats();
  }

  setSide(side) {
    this.side = side;
    document.querySelectorAll('.cf-choice-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.side === side);
    });
    this.flip();
  }

  async flip() {
    if (this._flipping) return;
    this._flipping = true;

    const coin = document.getElementById('cf-coin');
    const inner = document.getElementById('cf-coin-inner');
    const side = Math.random() < 0.5 ? 'heads' : 'tails';

    // Animation: xoay
    coin.classList.add('flipping');

    await new Promise(r => setTimeout(r, 800));
    coin.classList.remove('flipping');

    // Hiển thị kết quả
    inner.style.transform = side === 'heads' ? 'rotateY(0deg)' : 'rotateY(180deg)';

    // Update stats
    this.stats[side]++;
    this.stats.total++;
    const wasCorrect = this.side === side;
    if (this.side && wasCorrect) this.stats.correct++;
    this.saveStats();

    // Status
    const resultText = side === 'heads' ? '👑 NGỬA' : '🪙 SẤP';
    let guessText = '';
    if (this.side) {
      guessText = wasCorrect ? '✅ Đoán đúng!' : '❌ Đoán sai';
      if (!wasCorrect) window.showToast(`Sai rồi! Kết quả là ${resultText}`, 'error');
      else window.showToast(`Chuẩn! ${resultText}`, 'success');
    }
    document.getElementById('cf-msg').textContent = resultText;
    document.getElementById('cf-count').textContent = this.stats.total;
    document.getElementById('cf-stat').textContent = guessText || '—';

    this._flipping = false;
  }

  renderStats() {
    const s = this.stats;
    document.getElementById('cf-heads').textContent = s.heads;
    document.getElementById('cf-tails').textContent = s.tails;
    document.getElementById('cf-winrate').textContent = s.total > 0 ? Math.round(s.correct / s.total * 100) + '%' : '0%';
  }
}

const CoinFlip = new CoinFlipApp();
