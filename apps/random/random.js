// ===== RANDOM NUMBER APP =====
class RandomApp {
  constructor() {
    this.mode = 'number'; // number | picker
    this.pickerItems = ['Vinh', 'Thảo', 'Minh', 'Lan', 'Hùng'];
    this.history = this.loadHistory();
    this.loadPicker();
    this.renderPicker();
    this.renderHistory();
  }

  loadHistory() {
    try { return JSON.parse(localStorage.getItem('vt_rand_history')) || []; }
    catch { return []; }
  }

  saveHistory() {
    localStorage.setItem('vt_rand_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  loadPicker() {
    try {
      const saved = JSON.parse(localStorage.getItem('vt_rand_picker'));
      if (saved && saved.length >= 1) this.pickerItems = saved;
    } catch {}
  }

  savePicker() {
    localStorage.setItem('vt_rand_picker', JSON.stringify(this.pickerItems));
    this.renderPicker();
  }

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.rand-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.getElementById('rand-number-section').style.display = mode === 'number' ? 'block' : 'none';
    document.getElementById('rand-picker-section').style.display = mode === 'picker' ? 'block' : 'none';
    document.getElementById('rand-big-number').textContent = '?';
  }

  addPickerItem() {
    const input = document.getElementById('rand-picker-input');
    const val = input.value.trim();
    if (!val) { window.showToast('Nhập tên!', 'warn'); return; }
    if (this.pickerItems.includes(val)) { window.showToast('Đã có tên này!', 'warn'); return; }
    if (this.pickerItems.length >= 20) { window.showToast('Tối đa 20 người!', 'warn'); return; }
    this.pickerItems.push(val);
    this.savePicker();
    input.value = '';
  }

  removePicker(idx) {
    if (this.pickerItems.length <= 1) { window.showToast('Cần ít nhất 1 người!', 'warn'); return; }
    this.pickerItems.splice(idx, 1);
    this.savePicker();
  }

  renderPicker() {
    const list = document.getElementById('rand-picker-list');
    list.innerHTML = this.pickerItems.map((item, i) =>
      `<span class="rand-picker-tag">
        ${item}
        <button class="rand-picker-del" onclick="RandApp.removePicker(${i})">✕</button>
      </span>`
    ).join('');
  }

  async doRandom() {
    const btn = document.getElementById('rand-do-btn');
    btn.disabled = true;

    const numEl = document.getElementById('rand-big-number');
    numEl.classList.remove('anim');
    void numEl.offsetWidth;

    let result, resultText;

    if (this.mode === 'number') {
      const min = parseInt(document.getElementById('rand-min').value) || 1;
      const max = parseInt(document.getElementById('rand-max').value) || 100;
      if (min >= max) { window.showToast('"Từ" phải nhỏ hơn "Đến"!', 'warn'); btn.disabled = false; return; }

      // Animation
      let count = 0;
      const interval = setInterval(() => {
        numEl.textContent = Math.floor(Math.random() * (max - min + 1)) + min;
        count++;
        if (count > 15) {
          clearInterval(interval);
          result = Math.floor(Math.random() * (max - min + 1)) + min;
          numEl.textContent = result;
          numEl.classList.add('anim');
          resultText = `${result} (${min}~${max})`;
          done();
        }
      }, 60);
    } else {
      // Picker mode
      if (this.pickerItems.length === 0) { window.showToast('Thêm người vào danh sách!', 'warn'); btn.disabled = false; return; }

      let count = 0;
      const interval = setInterval(() => {
        const idx = Math.floor(Math.random() * this.pickerItems.length);
        numEl.textContent = this.pickerItems[idx];
        count++;
        if (count > 12) {
          clearInterval(interval);
          const idx = Math.floor(Math.random() * this.pickerItems.length);
          result = this.pickerItems[idx];
          numEl.textContent = result;
          numEl.classList.add('anim');
          resultText = `🎯 ${result}`;
          done();
        }
      }, 80);
    }

    const done = () => {
      document.getElementById('rand-msg').textContent = resultText;
      document.getElementById('rand-count').textContent = this.history.length + 1;
      document.getElementById('rand-result').textContent = typeof result === 'number' ? result : result;

      this.history.unshift({
        mode: this.mode,
        result,
        time: new Date().toLocaleTimeString('vi-VN')
      });
      if (this.history.length > 30) this.history.pop();
      this.saveHistory();

      btn.disabled = false;
    };
  }

  clearHistory() {
    if (this.history.length === 0) return;
    if (!confirm('Xóa toàn bộ lịch sử?')) return;
    this.history = [];
    this.saveHistory();
  }

  renderHistory() {
    const list = document.getElementById('rand-history-list');
    if (!list) return;
    if (!this.history.length) {
      list.innerHTML = '<div class="rand-history-empty">Chưa có lần random nào</div>';
      return;
    }
    list.innerHTML = this.history.map(h =>
      `<div class="rand-history-item">
        <span class="rand-h-result">${h.mode === 'picker' ? '👤 ' : ''}${h.result}</span>
        <span class="rand-h-time">${h.time}</span>
      </div>`
    ).join('');
  }
}

const RandApp = new RandomApp();
