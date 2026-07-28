// ===== DICE APP — Xúc Xắc =====
class DiceApp {
  constructor() {
    this.mode = 'single'; // single | double | guess
    this.guess = null;
    this.history = this.loadHistory();
    this._rolling = false;
    this.bindUI();
    this.renderMode();
    this.renderHistory();
  }

  loadHistory() {
    try { return JSON.parse(localStorage.getItem('vt_dice_history')) || []; }
    catch { return []; }
  }

  saveHistory() {
    localStorage.setItem('vt_dice_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  setMode(mode) {
    if (this._rolling) return;
    this.mode = mode;
    this.guess = null;
    document.querySelectorAll('.dice-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.getElementById('dice-guess').style.display = mode === 'guess' ? 'block' : 'none';
    this.renderMode();
  }

  renderMode() {
    const container = document.getElementById('dice-container');
    if (this.mode === 'single') {
      container.innerHTML = `<div class="dice-face" id="dice-result">1</div>`;
    } else {
      container.innerHTML = `
        <div class="dice-face" id="dice-result">1</div>
        <div class="dice-face" id="dice-result-2">2</div>
      `;
    }
    container.onclick = () => this.roll();
  }

  async roll() {
    if (this._rolling) return;
    this._rolling = true;

    const r1El = document.getElementById('dice-result');
    const r2El = document.getElementById('dice-result-2');

    // Animation
    const faces = [r1El, r2El].filter(Boolean);
    faces.forEach(el => el.classList.add('rolling'));

    // Hiệu ứng số ngẫu nhiên chạy
    const interval = setInterval(() => {
      r1El.textContent = Math.floor(Math.random() * 6) + 1;
      if (r2El) r2El.textContent = Math.floor(Math.random() * 6) + 1;
    }, 80);

    await new Promise(r => setTimeout(r, 600));
    clearInterval(interval);

    const val1 = Math.floor(Math.random() * 6) + 1;
    const val2 = this.mode === 'single' ? 0 : Math.floor(Math.random() * 6) + 1;
    const total = val1 + val2;

    faces.forEach(el => el.classList.remove('rolling'));
    r1El.textContent = val1;
    if (r2El) r2El.textContent = val2;
    faces.forEach(el => {
      el.classList.remove('result-anim');
      void el.offsetWidth;
      el.classList.add('result-anim');
    });

    // Check guess
    let guessResult = '';
    if (this.mode === 'guess' && this.guess !== null) {
      guessResult = total === this.guess ? '✅ Đoán đúng!' : `❌ Sai rồi (bạn đoán ${this.guess})`;
      const type = total === this.guess ? 'success' : 'error';
      window.showToast(guessResult, type);
    }

    const statusMsg = this.mode === 'single'
      ? `${val1}`
      : `${val1} + ${val2} = ${total}`;
    const guessText = this.mode === 'guess' ? ` | Đoán: ${this.guess}` : '';
    document.getElementById('dice-msg').textContent = statusMsg;
    document.getElementById('dice-count').textContent = this.history.length + 1;
    document.getElementById('dice-stat').textContent = guessResult || '—';

    // History
    this.history.unshift({
      val1, val2, total,
      guess: this.mode === 'guess' ? this.guess : null,
      correct: this.mode === 'guess' ? total === this.guess : null,
      time: new Date().toLocaleTimeString('vi-VN')
    });
    if (this.history.length > 50) this.history.pop();
    this.saveHistory();

    this._rolling = false;
  }

  setGuess(val) {
    if (this._rolling) return;
    this.guess = val;
    document.querySelectorAll('.dg-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.val) === val);
    });
    this.roll();
  }

  renderHistory() {
    const list = document.getElementById('dh-list');
    if (!list) return;
    if (!this.history.length) {
      list.innerHTML = '<div class="dh-empty">Chưa có lần lắc nào</div>';
      return;
    }
    list.innerHTML = this.history.map((h, i) => {
      const resultText = h.val2 ? `${h.val1} + ${h.val2} = ${h.total}` : `${h.val1}`;
      let guessHtml = '';
      if (h.guess !== null) {
        guessHtml = `<span class="dh-guess">${h.correct ? '✅' : '❌'} Đoán ${h.guess}</span>`;
      }
      return `<div class="dh-item"><span><span class="dh-result">${resultText}</span> ${guessHtml}</span><span class="dh-num">${h.time}</span></div>`;
    }).join('');
  }

  bindUI() {
    document.getElementById('dh-clear').addEventListener('click', () => {
      if (this.history.length === 0) return;
      if (confirm('Xóa toàn bộ lịch sử?')) {
        this.history = [];
        this.saveHistory();
      }
    });

    document.getElementById('dg-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.dg-btn');
      if (btn) this.setGuess(parseInt(btn.dataset.val));
    });
  }
}

const Dice = new DiceApp();
