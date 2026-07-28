// ===== SPIN WHEEL APP — Vòng Quay May Mắn =====
class SpinWheelApp {
  constructor() {
    this.items = [];
    this.colors = [
      '#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899',
      '#f97316','#14b8a6','#6366f1','#d946ef','#22c55e','#eab308'
    ];
    this.history = this.loadHistory();
    this._spinning = false;
    this._currentRotation = 0;
    this.loadItems();
    this.renderWheel();
    this.renderItems();
    this.renderHistory();
  }

  loadHistory() {
    try { return JSON.parse(localStorage.getItem('vt_wheel_history')) || []; }
    catch { return []; }
  }

  saveHistory() {
    localStorage.setItem('vt_wheel_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  loadItems() {
    try {
      const saved = JSON.parse(localStorage.getItem('vt_wheel_items'));
      if (saved && saved.length >= 1) this.items = saved;
    } catch {}
  }

  saveItems() {
    localStorage.setItem('vt_wheel_items', JSON.stringify(this.items));
    this.renderWheel();
    this.renderItems();
  }

  addItem() {
    const input = document.getElementById('sw-item-input');
    const val = input.value.trim();
    if (!val) { window.showToast('Nhập tên mục!', 'warn'); return; }
    if (this.items.length >= 12) { window.showToast('Tối đa 12 mục!', 'warn'); return; }
    if (this.items.includes(val)) { window.showToast('Mục đã tồn tại!', 'warn'); return; }
    this.items.push(val);
    this.saveItems();
    input.value = '';
  }

  removeItem(idx) {
    if (this.items.length <= 1) { window.showToast('Cần ít nhất 1 mục!', 'warn'); return; }
    this.items.splice(idx, 1);
    this.saveItems();
  }

  renderItems() {
    const list = document.getElementById('sw-items-list');
    list.innerHTML = this.items.map((item, i) =>
      `<span class="sw-item-tag">
        <span style="color:${this.colors[i % this.colors.length]}">●</span>
        ${item}
        <button class="sw-item-del" onclick="SpinWheel.removeItem(${i})">✕</button>
      </span>`
    ).join('');
  }

  renderWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = 190;
    const n = this.items.length;

    ctx.clearRect(0, 0, w, h);

    if (n === 0) {
      // Trống — vẽ vòng tròn rỗng
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(167,139,250,0.2)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px Science Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Thêm mục để quay!', cx, cy);
      return;
    }

    const arc = (2 * Math.PI) / n;

    // Draw segments
    for (let i = 0; i < n; i++) {
      const startAngle = i * arc;
      const endAngle = (i + 1) * arc;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      const midAngle = startAngle + arc / 2;
      const textR = r * 0.6;
      const tx = cx + Math.cos(midAngle) * textR;
      const ty = cy + Math.sin(midAngle) * textR;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Science Gothic, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayText = this.items[i].length > 8 ? this.items[i].slice(0, 7) + '..' : this.items[i];
      ctx.fillText(displayText, 0, 0);
      ctx.restore();
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(167,139,250,0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  async spin() {
    if (this._spinning || this.items.length < 1) return;
    this._spinning = true;

    const canvas = document.getElementById('wheel-canvas');
    const ctx = canvas.getContext('2d');
    const btn = document.getElementById('sw-spin-btn');
    btn.disabled = true;

    const n = this.items.length;
    const arc = 360 / n;
    const targetIdx = Math.floor(Math.random() * n);
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle = extraSpins * 360 + targetIdx * arc + arc / 2;

    this._currentRotation += targetAngle;

    const duration = 3000;
    const startTime = Date.now();
    const startRotation = this._currentRotation - targetAngle;

    document.getElementById('sw-msg').textContent = '🔄 Đang quay...';

    await new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const rot = startRotation + targetAngle * eased;

        this.renderWheel();
        // Apply rotation
        canvas.style.transform = `rotate(${rot}deg)`;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });

    // Result
    const result = this.items[targetIdx];
    document.getElementById('sw-msg').textContent = `🎯 ${result}`;
    document.getElementById('sw-count').textContent = this.history.length + 1;
    document.getElementById('sw-result').textContent = result;

    this.history.unshift({ result, time: new Date().toLocaleTimeString('vi-VN') });
    if (this.history.length > 30) this.history.pop();
    this.saveHistory();

    window.showToast(`🎯 ${result}`, 'success');
    btn.disabled = false;
    this._spinning = false;
  }

  clearHistory() {
    if (this.history.length === 0) return;
    if (!confirm('Xóa toàn bộ lịch sử?')) return;
    this.history = [];
    this.saveHistory();
  }

  renderHistory() {
    const list = document.getElementById('sw-history-list');
    if (!list) return;
    if (!this.history.length) {
      list.innerHTML = '<div class="sw-history-empty">Chưa có lần quay nào</div>';
      return;
    }
    list.innerHTML = this.history.map(h =>
      `<div class="sw-history-item"><span class="sw-h-result">${h.result}</span><span class="sw-h-time">${h.time}</span></div>`
    ).join('');
  }
}

const SpinWheel = new SpinWheelApp();
