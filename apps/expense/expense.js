// expense.js — VTWorld Quản Lý Chi Tiêu
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========== CATEGORIES ==========
const CATEGORIES = {
  income: [
    { id: 'luong',     icon: '💼', label: 'Lương' },
    { id: 'thuong',    icon: '🎁', label: 'Thưởng' },
    { id: 'dau_tu',    icon: '📈', label: 'Đầu tư' },
    { id: 'khac_inc',  icon: '💸', label: 'Khác' },
  ],
  expense: [
    { id: 'an_uong',   icon: '🍔', label: 'Ăn uống' },
    { id: 'di_chuyen', icon: '🚗', label: 'Di chuyển' },
    { id: 'mua_sam',   icon: '🛍️', label: 'Mua sắm' },
    { id: 'hoa_don',   icon: '💡', label: 'Hóa đơn' },
    { id: 'giai_tri',  icon: '🎮', label: 'Giải trí' },
    { id: 'suc_khoe',  icon: '💊', label: 'Sức khỏe' },
    { id: 'giao_duc',  icon: '📚', label: 'Giáo dục' },
    { id: 'nha_o',     icon: '🏠', label: 'Nhà ở' },
    { id: 'lam_dep',   icon: '💇', label: 'Làm đẹp' },
    { id: 'pet',       icon: '🐾', label: 'Thú cưng' },
    { id: 'qua_tang',  icon: '🎁', label: 'Quà tặng' },
    { id: 'khac_exp',  icon: '❓', label: 'Khác' },
  ]
};

const ALL_CATEGORIES = [...CATEGORIES.income, ...CATEGORIES.expense];
const CAT_MAP = {};
ALL_CATEGORIES.forEach(c => { CAT_MAP[c.id] = c; });

const WALLET_ICONS = ['💵', '💳', '🏦', '📱', '💰', '🪙', '💎', '🏪'];
const CHART_COLORS = ['#f87171','#fbbf24','#34d399','#38bdf8','#a78bfa','#f472b6','#fb923c','#22d3ee','#e879f9','#4ade80','#facc15','#2dd4bf'];

class ExpenseApp {
  constructor() {
    this.uid = null;
    this.expenses = [];
    this.wallets = [];
    this.currentTab = 'overview';
    this.currentMonth = new Date();
    this.currentType = 'income';
    this.selectedCategory = null;
    this.selectedWalletId = null;
    this.editId = null;
    this.editWalletId = null;
    this.typeFilter = 'all';
    this.catFilter = 'all';
    this.walletFilter = 'all';
    this.dateFilter = '';
    this.unsubExpenses = null;
    this.unsubWallets = null;
    this.init();
  }

  async init() {
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        unsub();
        if (user) { this.uid = user.uid; resolve(); }
        else location.href = '../../index.html';
      });
    });
    window.ExpenseApp = this;
    this.bindTabs();
    this.bindForm();
    this.bindMonthNav();
    this.bindFilters();
    this.populateCategoryFilter();
    this.bindModal();
    this.bindWalletModal();
    this.listenExpenses();
    this.listenWallets();
  }

  // ========== REAL-TIME LISTENER: EXPENSES ==========
  listenExpenses() {
    if (this.unsubExpenses) { this.unsubExpenses(); this.unsubExpenses = null; }
    const q = query(
      collection(db, 'users', this.uid, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    this.unsubExpenses = onSnapshot(q, snapshot => {
      this.expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      this.render();
    }, err => {
      console.error('Expense listener error:', err);
    });
  }

  // ========== REAL-TIME LISTENER: WALLETS (từ user doc) ==========
  listenWallets() {
    if (this.unsubWallets) { this.unsubWallets(); this.unsubWallets = null; }
    const userRef = doc(db, 'users', this.uid);
    this.unsubWallets = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      this.wallets = data?.wallets || [];
      // Auto-select first wallet if none selected
      if (this.wallets.length > 0 && !this.selectedWalletId) {
        this.selectedWalletId = this.wallets[0].id;
      }
      this.renderWalletSelector();
      this.renderWalletSection();
      this.populateWalletFilter();
      if (this.currentTab === 'history') this.renderFullList();
      this.renderOverviewList();
    }, err => {
      console.error('Wallet listener error:', err);
    });
  }

  // ========== WALLET CRUD (lưu trong user doc) ==========
  _genId() { return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

  async saveWallet() {
    const name = document.getElementById('exp-wallet-name').value.trim();
    const initialBalance = parseInt(document.getElementById('exp-wallet-balance').value) || 0;
    const icon = document.querySelector('#exp-wallet-icon-picker .exp-wallet-icon-btn.active')?.dataset.icon || '💵';

    if (!name) { window.showToast('Nhập tên ví!', 'warn'); return; }

    try {
      let newWallets = [...this.wallets];
      if (this.editWalletId) {
        newWallets = newWallets.map(w =>
          w.id === this.editWalletId ? { ...w, name, icon, initialBalance } : w
        );
      } else {
        newWallets.push({
          id: this._genId(), name, icon, initialBalance
        });
      }
      await updateDoc(doc(db, 'users', this.uid), { wallets: newWallets });
      window.showToast(this.editWalletId ? '✅ Đã cập nhật ví!' : '✅ Đã thêm ví mới!', 'success');
      this.closeWalletModal();
    } catch (e) {
      window.showToast('Lỗi: ' + e.message, 'error');
    }
  }

  async deleteWallet(walletId) {
    if (!confirm('Xóa ví này? Các giao dịch trong ví vẫn được giữ lại.')) return;
    try {
      const newWallets = this.wallets.filter(w => w.id !== walletId);
      await updateDoc(doc(db, 'users', this.uid), { wallets: newWallets });
      if (this.selectedWalletId === walletId) {
        this.selectedWalletId = newWallets.length > 0 ? newWallets[0].id : null;
      }
      window.showToast('🗑️ Đã xóa ví!', 'info');
      this.closeWalletModal();
    } catch (e) {
      window.showToast('Lỗi xóa: ' + e.message, 'error');
    }
  }

  getWalletBalance(walletId) {
    const wallet = this.wallets.find(w => w.id === walletId);
    if (!wallet) return 0;
    const initial = wallet.initialBalance || 0;
    const income = this.expenses
      .filter(e => e.walletId === walletId && e.type === 'income')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const expense = this.expenses
      .filter(e => e.walletId === walletId && e.type === 'expense')
      .reduce((s, e) => s + (e.amount || 0), 0);
    return initial + income - expense;
  }

  // ========== RENDER ==========
  render() {
    this.renderStatusBar();
    this.renderSummary();
    this.renderWalletSection();
    this.renderTotalSection();
    this.renderChart();
    this.renderOverviewList();
    this.renderFullList();
  }

  renderStatusBar() {
    const now = this.currentMonth;
    const monthExpenses = this.getMonthExpenses(now);
    const totalIncome = monthExpenses.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = monthExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    const balance = totalIncome - totalExpense;

    document.getElementById('exp-left').textContent = totalIncome.toLocaleString('vi-VN');
    document.getElementById('exp-mid').textContent = balance.toLocaleString('vi-VN');
    document.getElementById('exp-right').textContent = totalExpense.toLocaleString('vi-VN');
    document.getElementById('exp-sub').textContent = balance >= 0 ? '💰 Số dư' : '⚠️ Âm';
    document.getElementById('exp-mid').style.color = balance >= 0 ? '#5eead4' : '#f87171';
  }

  renderSummary() {
    const now = this.currentMonth;
    const monthExpenses = this.getMonthExpenses(now);
    const totalIncome = monthExpenses.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = monthExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);

    document.getElementById('exp-sum-income').textContent = this.fmt(totalIncome);
    document.getElementById('exp-sum-expense').textContent = this.fmt(totalExpense);
    document.getElementById('exp-month-label').textContent = this.getMonthLabel(now);
  }

  // ========== WALLET SECTION RENDER ==========
  renderWalletSection() {
    const grid = document.getElementById('exp-wallet-grid');
    if (!grid) return;

    if (this.wallets.length === 0) {
      grid.innerHTML = `<div class="exp-wallet-card" style="cursor:default;opacity:0.5;grid-column:1/-1">
        <div style="font-size:11px;color:#4a7a9b;font-weight:600">Chưa có ví nào. Bấm "+ Thêm ví" để bắt đầu</div>
      </div>`;
      return;
    }

    grid.innerHTML = this.wallets.map(w => {
      const balance = this.getWalletBalance(w.id);
      return `<div class="exp-wallet-card" data-id="${w.id}">
        <div class="exp-wallet-card-icon">${w.icon || '💵'}</div>
        <div class="exp-wallet-card-name">${this.esc(w.name)}</div>
        <div class="exp-wallet-card-balance ${balance < 0 ? 'negative' : ''}">${this.fmt(balance)}</div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.exp-wallet-card').forEach(card => {
      card.addEventListener('click', () => this.openWalletModal(card.dataset.id));
    });
  }

  // ========== TOTAL SECTION (all-time) ==========
  renderTotalSection() {
    const totalIncome = this.expenses.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = this.expenses.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    const totalAsset = this.wallets.reduce((s, w) => s + this.getWalletBalance(w.id), 0);

    document.getElementById('exp-total-asset').textContent = this.fmt(totalAsset);
    document.getElementById('exp-total-income').textContent = this.fmt(totalIncome);
    document.getElementById('exp-total-expense').textContent = this.fmt(totalExpense);
  }

  // ========== CHART (donut) ==========
  renderChart() {
    const canvas = document.getElementById('exp-chart-canvas');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.offsetWidth || 220, 220);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;
    const innerRadius = radius * 0.55;

    // Get expense categories for current month
    const monthExpenses = this.getMonthExpenses(this.currentMonth).filter(e => e.type === 'expense');
    const totalExpense = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    document.getElementById('exp-chart-total').textContent = this.fmt(totalExpense);

    // Group by category
    const catMap = {};
    monthExpenses.forEach(e => {
      const catId = e.category || 'khac_exp';
      catMap[catId] = (catMap[catId] || 0) + (e.amount || 0);
    });

    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    ctx.clearRect(0, 0, size, size);

    if (entries.length === 0 || totalExpense === 0) {
      // Empty state
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = radius - innerRadius;
      ctx.stroke();
      document.getElementById('exp-chart-legend').innerHTML = '';
      return;
    }

    // Draw segments
    let startAngle = -Math.PI / 2;
    ctx.lineWidth = radius - innerRadius;

    entries.forEach(([catId, amount], i) => {
      const sliceAngle = (amount / totalExpense) * Math.PI * 2;
      const color = CHART_COLORS[i % CHART_COLORS.length];

      ctx.beginPath();
      ctx.arc(cx, cy, radius - ctx.lineWidth / 2, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = color;
      ctx.stroke();

      startAngle += sliceAngle;
    });

    // Draw inner circle (hole)
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1020';
    ctx.fill();

    // Legend
    const legend = document.getElementById('exp-chart-legend');
    legend.innerHTML = entries.map(([catId, amount], i) => {
      const cat = CAT_MAP[catId] || { icon: '❓', label: catId };
      const pct = ((amount / totalExpense) * 100).toFixed(1);
      return `<div class="exp-chart-legend-item">
        <span class="exp-chart-legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>
        ${cat.icon} ${cat.label}
        <span style="color:#e0f2fe">${pct}%</span>
      </div>`;
    }).join('');
  }

  renderWalletSelector() {
    const sel = document.getElementById('exp-wallet-selector');
    if (!sel) return;

    if (this.wallets.length === 0) {
      sel.innerHTML = '<div style="font-size:11px;color:#4a7a9b;font-weight:600">Tạo ví trước nhé! 👛</div>';
      return;
    }

    sel.innerHTML = this.wallets.map(w => `
      <button class="exp-wallet-sel-btn ${this.selectedWalletId === w.id ? 'active' : ''}" data-id="${w.id}">
        <span class="exp-wallet-sel-icon">${w.icon || '💵'}</span>
        ${this.esc(w.name)}
      </button>
    `).join('');

    sel.querySelectorAll('.exp-wallet-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sel.querySelectorAll('.exp-wallet-sel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedWalletId = btn.dataset.id;
      });
    });
  }

  populateWalletFilter() {
    const sel = document.getElementById('exp-wallet-filter');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="all">Tất cả ví</option>';
    this.wallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = `${w.icon || '💵'} ${w.name}`;
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  }

  // ========== OVERVIEW LIST ==========
  renderOverviewList() {
    const el = document.getElementById('exp-recent-list');
    const recent = [...this.expenses]
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 10);

    if (recent.length === 0) {
      el.innerHTML = '<div class="exp-empty">Chưa có giao dịch nào</div>';
      return;
    }

    el.innerHTML = recent.map(e => this.renderItemHTML(e)).join('');

    el.querySelectorAll('.exp-item').forEach(item => {
      item.addEventListener('click', () => this.openEditModal(item.dataset.id));
    });
  }

  // ========== FULL LIST (HISTORY) ==========
  renderFullList() {
    const el = document.getElementById('exp-full-list');
    let filtered = [...this.getMonthExpenses(this.currentMonth)];

    // Type filter
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(e => e.type === this.typeFilter);
    }
    // Category filter
    if (this.catFilter !== 'all') {
      filtered = filtered.filter(e => e.category === this.catFilter);
    }
    // Wallet filter
    if (this.walletFilter !== 'all') {
      filtered = filtered.filter(e => e.walletId === this.walletFilter);
    }
    // Date filter
    if (this.dateFilter) {
      filtered = filtered.filter(e => e.date === this.dateFilter);
    }

    // Sort by date desc then createdAt desc
    filtered.sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    });

    if (filtered.length === 0) {
      el.innerHTML = '<div class="exp-empty">Không tìm thấy giao dịch nào</div>';
      return;
    }

    // Group by date
    let html = '';
    let currentDate = '';
    filtered.forEach(e => {
      if (e.date !== currentDate) {
        currentDate = e.date;
        const d = this.parseDate(e.date);
        const dayLabel = d ? d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }) : e.date;
        html += `<div class="exp-section-label" style="margin-top:12px">
          <span class="exp-date-label-click" data-date="${e.date || ''}">${dayLabel}</span>
        </div>`;
      }
      html += this.renderItemHTML(e);
    });

    el.innerHTML = html;

    el.querySelectorAll('.exp-item').forEach(item => {
      item.addEventListener('click', () => this.openEditModal(item.dataset.id));
    });
    // Click date label to filter
    el.querySelectorAll('.exp-date-label-click').forEach(label => {
      label.addEventListener('click', (e) => {
        const date = e.currentTarget.dataset.date;
        if (!date) return;
        this.dateFilter = date;
        document.getElementById('exp-date-filter').value = date;
        document.getElementById('exp-date-filter-clear').style.display = 'block';
        this.renderFullList();
      });
    });
  }

  renderItemHTML(e) {
    const cat = CAT_MAP[e.category] || { icon: '❓', label: e.category || 'Khác' };
    const amt = e.amount || 0;
    const isIncome = e.type === 'income';
    const date = e.date ? this.formatDate(e.date) : '';
    const wallet = this.wallets.find(w => w.id === e.walletId);
    const walletBadge = wallet ? `<span class="exp-item-wallet">${wallet.icon || '💵'} ${this.esc(wallet.name)}</span>` : '';
    return `<div class="exp-item" data-id="${e.id}">
      <div class="exp-item-icon ${isIncome ? 'income' : 'expense'}">${cat.icon}</div>
      <div class="exp-item-info">
        <div class="exp-item-category">${cat.label}</div>
        ${e.note ? `<div class="exp-item-note">${this.esc(e.note)}</div>` : ''}
        ${walletBadge}
      </div>
      <div class="exp-item-right">
        <div class="exp-item-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${this.fmt(amt)}</div>
        <div class="exp-item-date">${date}</div>
      </div>
    </div>`;
  }

  // ========== HELPERS ==========
  getMonthExpenses(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    return this.expenses.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  getMonthLabel(date) {
    return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }

  parseDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  formatDate(str) {
    const d = this.parseDate(str);
    if (!d) return str || '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  fmt(n) { return (n || 0).toLocaleString('vi-VN'); }
  esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // ========== TABS ==========
  bindTabs() {
    document.querySelectorAll('.exp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.exp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.exp-tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById('exp-tab-' + tab.dataset.tab);
        if (content) content.classList.add('active');
        this.currentTab = tab.dataset.tab;
        if (this.currentTab === 'add') this.prepareAddForm();
      });
    });
  }

  // ========== MONTH NAV ==========
  bindMonthNav() {
    document.getElementById('exp-prev-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.render();
    });
    document.getElementById('exp-next-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.render();
    });
  }

  // ========== FILTERS ==========
  bindFilters() {
    document.getElementById('exp-type-filter').addEventListener('change', e => {
      this.typeFilter = e.target.value;
      this.renderFullList();
    });
    document.getElementById('exp-category-filter').addEventListener('change', e => {
      this.catFilter = e.target.value;
      this.renderFullList();
    });
    document.getElementById('exp-wallet-filter').addEventListener('change', e => {
      this.walletFilter = e.target.value;
      this.renderFullList();
    });
    document.getElementById('exp-date-filter').addEventListener('change', e => {
      this.dateFilter = e.target.value || '';
      document.getElementById('exp-date-filter-clear').style.display = this.dateFilter ? 'block' : 'none';
      this.renderFullList();
    });
    document.getElementById('exp-date-filter-clear').addEventListener('click', () => {
      this.dateFilter = '';
      document.getElementById('exp-date-filter').value = '';
      document.getElementById('exp-date-filter-clear').style.display = 'none';
      this.renderFullList();
    });
  }

  populateCategoryFilter() {
    const sel = document.getElementById('exp-category-filter');
    sel.innerHTML = '<option value="all">Tất cả danh mục</option>';
    ALL_CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.label}`;
      sel.appendChild(opt);
    });
  }

  // ========== FORM ==========
  bindForm() {
    document.getElementById('exp-type-income').addEventListener('click', () => {
      this.currentType = 'income';
      document.querySelectorAll('.exp-type-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('exp-type-income').classList.add('active');
      this.renderCategoryGrid();
    });
    document.getElementById('exp-type-expense').addEventListener('click', () => {
      this.currentType = 'expense';
      document.querySelectorAll('.exp-type-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('exp-type-expense').classList.add('active');
      this.renderCategoryGrid();
    });
    document.getElementById('exp-submit-btn').addEventListener('click', () => this.submitForm());
    // Quick date buttons
    document.querySelectorAll('.exp-qd-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const offset = e.currentTarget.dataset.offset;
        const inp = document.getElementById('exp-date');
        let d = new Date();
        if (offset === 'start') {
          d = new Date(d.getFullYear(), d.getMonth(), 1);
        } else {
          d.setDate(d.getDate() + parseInt(offset));
        }
        inp.value = d.toISOString().split('T')[0];
        // Highlight clicked button
        document.querySelectorAll('.exp-qd-btn').forEach(b => b.style.borderColor = 'rgba(56,189,248,0.15)');
        e.currentTarget.style.borderColor = '#38bdf8';
      });
    });
  }

  prepareAddForm() {
    this.editId = null;
    document.getElementById('exp-submit-btn').textContent = '💾 Lưu giao dịch';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-note').value = '';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    this.selectedCategory = null;
    this.currentType = 'income';
    document.querySelectorAll('.exp-type-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('exp-type-income').classList.add('active');
    this.renderCategoryGrid();
    this.renderWalletSelector();
  }

  renderCategoryGrid() {
    const grid = document.getElementById('exp-category-grid');
    const cats = CATEGORIES[this.currentType] || [];
    grid.innerHTML = cats.map(c => `
      <button class="exp-cat-btn ${this.selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
        <span class="exp-cat-icon">${c.icon}</span>
        <span class="exp-cat-label">${c.label}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.exp-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.exp-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCategory = btn.dataset.cat;
      });
    });
  }

  async submitForm() {
    const amount = parseInt(document.getElementById('exp-amount').value);
    const note = document.getElementById('exp-note').value.trim();
    const date = document.getElementById('exp-date').value;

    if (!amount || amount <= 0) { window.showToast('Nhập số tiền!', 'warn'); return; }
    if (!this.selectedCategory) { window.showToast('Chọn danh mục!', 'warn'); return; }
    if (!this.selectedWalletId && this.wallets.length > 0) { window.showToast('Chọn ví!', 'warn'); return; }
    if (!date) { window.showToast('Chọn ngày!', 'warn'); return; }

    const data = {
      type: this.currentType,
      amount,
      category: this.selectedCategory,
      note,
      date,
      walletId: this.selectedWalletId || '',
    };

    try {
      if (this.editId) {
        await updateDoc(doc(db, 'users', this.uid, 'expenses', this.editId), { ...data, updatedAt: serverTimestamp() });
        window.showToast('✅ Đã cập nhật!', 'success');
      } else {
        await addDoc(collection(db, 'users', this.uid, 'expenses'), {
          ...data,
          createdAt: serverTimestamp()
        });
        window.showToast('✅ Đã thêm giao dịch!', 'success');
      }
      document.getElementById('exp-amount').value = '';
      document.getElementById('exp-note').value = '';
      this.selectedCategory = null;
      this.editId = null;
      document.getElementById('exp-submit-btn').textContent = '💾 Lưu giao dịch';
      this.renderCategoryGrid();
      // Switch to overview
      document.querySelectorAll('.exp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.exp-tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('.exp-tab[data-tab="overview"]').classList.add('active');
      document.getElementById('exp-tab-overview').classList.add('active');
      this.currentTab = 'overview';
    } catch (e) {
      window.showToast('Lỗi: ' + e.message, 'error');
    }
  }

  // ========== EDIT MODAL ==========
  bindModal() {
    document.getElementById('exp-modal-close').addEventListener('click', () => this.closeEditModal());
    document.getElementById('exp-modal').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeEditModal();
    });
    document.getElementById('exp-del-confirm').addEventListener('click', async () => {
      if (this.editId) {
        try {
          await deleteDoc(doc(db, 'users', this.uid, 'expenses', this.editId));
          window.showToast('🗑️ Đã xóa!', 'info');
        } catch (e) {
          window.showToast('Lỗi xóa: ' + e.message, 'error');
        }
      }
      this.closeEditModal();
      document.getElementById('exp-del-modal').classList.remove('open');
    });
    document.getElementById('exp-del-cancel').addEventListener('click', () => {
      document.getElementById('exp-del-modal').classList.remove('open');
    });
  }

  openEditModal(id) {
    this.editId = id;
    const e = this.expenses.find(ex => ex.id === id);
    if (!e) return;

    const cat = CAT_MAP[e.category] || { icon: '❓', label: e.category || 'Khác' };
    const isIncome = e.type === 'income';
    const amt = e.amount || 0;
    const wallet = this.wallets.find(w => w.id === e.walletId);
    const walletHtml = wallet
      ? `<div style="font-size:12px;color:#4a7a9b;margin-bottom:16px">${wallet.icon || '💵'} ${this.esc(wallet.name)}</div>`
      : '';
    const body = document.getElementById('exp-modal-body');
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div class="exp-item-icon ${isIncome ? 'income' : 'expense'}" style="width:44px;height:44px;font-size:22px">${cat.icon}</div>
        <div>
          <div style="font-size:16px;font-weight:800;color:#e0f2fe">${cat.label}</div>
          <div style="font-size:11px;color:#64748b">${this.formatDate(e.date)}</div>
        </div>
      </div>
      ${walletHtml}
      <div style="font-family:'Science Gothic',sans-serif;font-weight:500;font-size:28px;color:${isIncome ? '#34d399' : '#f87171'};margin-bottom:16px">${isIncome ? '+' : '-'}${this.fmt(amt)}</div>
      ${e.note ? `<div style="font-size:13px;color:#94a3b8;margin-bottom:16px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.03)">📝 ${this.esc(e.note)}</div>` : ''}
      <div style="display:flex;gap:10px">
        <button class="exp-btn danger" id="exp-edit-delete" style="flex:1">🗑️ Xóa</button>
      </div>
    `;
    document.getElementById('exp-edit-delete').addEventListener('click', () => {
      this.closeEditModal();
      document.getElementById('exp-del-modal').classList.add('open');
    });
    document.getElementById('exp-modal').classList.add('open');
  }

  closeEditModal() {
    document.getElementById('exp-modal').classList.remove('open');
    this.editId = null;
  }

  // ========== WALLET MODAL ==========
  bindWalletModal() {
    document.getElementById('exp-wallet-modal-close').addEventListener('click', () => this.closeWalletModal());
    document.getElementById('exp-wallet-modal').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeWalletModal();
    });
    document.getElementById('exp-add-wallet-btn').addEventListener('click', () => this.openWalletModal(null));

    // Icon picker
    document.querySelectorAll('#exp-wallet-icon-picker .exp-wallet-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#exp-wallet-icon-picker .exp-wallet-icon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('exp-wallet-save-btn').addEventListener('click', () => this.saveWallet());
    document.getElementById('exp-wallet-delete-btn').addEventListener('click', () => {
      if (this.editWalletId) this.deleteWallet(this.editWalletId);
    });
  }

  openWalletModal(walletId) {
    this.editWalletId = walletId;
    const wallet = walletId ? this.wallets.find(w => w.id === walletId) : null;

    document.getElementById('exp-wallet-modal-title').textContent = wallet ? '✏️ Sửa ví' : '👛 Thêm ví mới';
    document.getElementById('exp-wallet-name').value = wallet ? wallet.name : '';
    document.getElementById('exp-wallet-balance').value = wallet ? (wallet.initialBalance || 0) : '';

    // Set icon
    const currentIcon = wallet ? wallet.icon : '💵';
    document.querySelectorAll('#exp-wallet-icon-picker .exp-wallet-icon-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.icon === currentIcon);
    });

    // Show/hide delete button
    document.getElementById('exp-wallet-delete-btn').style.display = wallet ? 'block' : 'none';
    document.getElementById('exp-wallet-save-btn').textContent = wallet ? '💾 Lưu thay đổi' : '💾 Lưu ví';

    document.getElementById('exp-wallet-modal').classList.add('open');
  }

  closeWalletModal() {
    document.getElementById('exp-wallet-modal').classList.remove('open');
    this.editWalletId = null;
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  if (window.TopNav) TopNav.init();
  if (window.BottomNav) BottomNav.init({ active: 'apps' });
  const dateInput = document.getElementById('exp-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
});

new ExpenseApp();
