// uongdi.js — Game Uống Đi
// Chỉ load 4 file JSON: Sự Thật, Thử Thách, May Mắn, Luật Lệ

const ADMIN_EMAIL = 'thang@game.com';

const CATEGORY_META = {
  su_that:   { label: '💬 Sự Thật',  color: '#38bdf8' },
  thu_thach: { label: '⚡ Thử Thách', color: '#fb7185' },
  may_man:   { label: '🍀 May Mắn',  color: '#34d399' },
  luat_le:   { label: '📜 Luật Lệ',  color: '#fbbf24' },
  thi_dau:   { label: '⚔️ Thi Đấu',  color: '#a78bfa' },
  do_vui:    { label: '🧠 Đố Vui',   color: '#f472b6' },
};

const LS_SETTINGS = 'ud_settings';
const LS_HISTORY = 'ud_history';
const CARD_FILES = [
  'uongdicards/suthat.json',
  'uongdicards/thuthach.json',
  'uongdicards/mayman.json',
  'uongdicards/luatle.json',
  'uongdicards/thidau.json',
  'uongdicards/dovui.json'
];

class UongDi {
  constructor() {
    this.allCards = [];
    this.deck = [];
    this.drawnIds = new Set();
    this.currentCard = null;
    this.history = this.loadHistory();
    this.settings = this.loadSettings();
    this.uid = null;
    this.userEmail = null;
    this.db = null;
    this.fs = null;
    this._customDocs = [];
    this.init();
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { noRepeat: true };
  }

  saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(this.settings));
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  saveHistory() {
    localStorage.setItem(LS_HISTORY, JSON.stringify(this.history));
    this.renderHistory();
  }

  async init() {
    try {
      const fetchPromises = CARD_FILES.map(file => fetch(file).then(r => r.json()));
      const results = await Promise.all(fetchPromises);
      this.allCards = results.flat();
    } catch (e) {
      console.error('Không tải được các file JSON từ uongdicards/', e);
      this.allCards = [];
    }

    await this.tryListenAuth();
    await this.loadCustomCardsFromFirestore();

    this.buildDeck();
    this.updateStatusBar();
    this.renderHistory();
    this.bindUI();
    this.injectSettingsMenuItem();

    if (this.totalPool === 0) {
      this.showLoadError();
    }
  }

  showLoadError() {
    const subEl = document.querySelector('.ud-logo-sub');
    if (subEl) subEl.textContent = '⚠️ Không tải được lá bài — thử tải lại trang';
  }

  async tryListenAuth() {
    try {
      const { auth, db } = await import('./points.js');
      this.db = db;
      const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      this.fs = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          unsub();
          this.uid = user ? user.uid : null;
          this.userEmail = user ? user.email : null;
          resolve();
        });
      });
      this.refreshAdminVisibility();
    } catch (e) {
      console.warn('Không có auth/firestore — chạy chế độ offline', e);
    }
  }

  isAdmin() {
    return this.userEmail === ADMIN_EMAIL;
  }

  refreshAdminVisibility() {
    const group = document.getElementById('udAdminGroup');
    if (!group) return;
    group.style.display = this.isAdmin() ? 'flex' : 'none';
    if (this.isAdmin()) this.renderAdminCatOptions();
  }

  // ============ FIRESTORE: LÁ TỰ THÊM ============
  async loadCustomCardsFromFirestore() {
    if (!this.db || !this.fs) return;
    try {
      const { collection, getDocs } = this.fs;
      const snap = await getDocs(collection(this.db, 'customCards'));
      this._customDocs = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        this._customDocs.push({ ...d, id: docSnap.id, custom: true });
      });
      this.allCards = this.allCards.concat(this._customDocs);
    } catch (e) {
      console.error('Không tải được customCards từ Firestore', e);
      this._customDocs = [];
    }
  }

  async adminAddCard() {
    if (!this.isAdmin()) { window.showToast('Chỉ admin mới thêm được lá!', 'error'); return; }
    if (!this.db || !this.fs) { window.showToast('Cần đăng nhập để thêm lá!', 'error'); return; }

    const category = document.getElementById('udAdminCat').value;
    const text = document.getElementById('udAdminText').value.trim();
    if (!text) { window.showToast('Nhập nội dung lá bài!', 'warn'); return; }

    try {
      const { collection, addDoc, serverTimestamp } = this.fs;
      const newDoc = { category, text, createdBy: this.uid, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(this.db, 'customCards'), newDoc);
      const cardObj = { ...newDoc, id: ref.id, custom: true };
      this._customDocs.push(cardObj);
      this.allCards.push(cardObj);

      document.getElementById('udAdminText').value = '';
      this.buildDeck();
      this.renderAdminList();
      window.showToast('✅ Đã thêm lá mới!', 'success');
    } catch (e) {
      console.error(e);
      window.showToast('Lỗi: ' + e.message, 'error');
    }
  }

  async adminDeleteCard(id) {
    if (!this.isAdmin() || !this.db || !this.fs) return;
    try {
      const { doc, deleteDoc } = this.fs;
      await deleteDoc(doc(this.db, 'customCards', id));
      this._customDocs = this._customDocs.filter(c => c.id !== id);
      this.allCards = this.allCards.filter(c => c.id !== id);
      this.buildDeck();
      this.renderAdminList();
      window.showToast('🗑️ Đã xoá lá', 'success');
    } catch (e) {
      console.error(e);
      window.showToast('Lỗi khi xoá lá: ' + e.message, 'error');
    }
  }

  // ============ DECK ============
  buildDeck() {
    const pool = this.allCards;
    this.deck = this.shuffle(pool.filter(c => !this.drawnIds.has(c.id)));
    if (this.deck.length === 0 && pool.length > 0) {
      this.drawnIds.clear();
      this.deck = this.shuffle(pool.slice());
    }
    this.totalPool = pool.length;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  drawCard() {
    if (this.totalPool === 0) {
      this.showLoadError();
      return;
    }
    if (this.deck.length === 0) {
      if (this.settings.noRepeat) {
        this.drawnIds.clear();
        this.history = [];
        this.saveHistory();
        window.showToast('🔄 Đã rút hết, xáo lại!', 'success');
      }
      this.buildDeck();
    }
    const card = this.deck.pop();
    if (!card) return;
    this.drawnIds.add(card.id);
    this.currentCard = card;
    
    // Thêm vào đầu lịch sử (mới nhất ở trên)
    this.history.unshift(card);
    this.saveHistory();
    
    this.renderCard(card);
    this.updateStatusBar();
  }

  renderCard(card) {
    const cardEl = document.getElementById('ud-card');
    const typeEl = document.getElementById('ud-card-type');
    const textEl = document.getElementById('ud-card-text');
    const frontEl = cardEl.querySelector('.ud-card-front');

    cardEl.classList.remove('flipped');
    void cardEl.offsetWidth;

    frontEl.className = 'ud-card-face ud-card-front border-' + card.category;

    typeEl.textContent = (CATEGORY_META[card.category]?.label || '').toUpperCase();
    typeEl.className = 'ud-card-type cat-' + card.category;

    this.renderCardText(textEl, card);

    requestAnimationFrame(() => cardEl.classList.add('flipped'));
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  renderCardText(textEl, card) {
    const match = card.category === 'do_vui'
      ? card.text.match(/^(.*?)\s*\(Đáp án:\s*(.*)\)\s*$/s)
      : null;

    if (match) {
      const question = this.escapeHtml(match[1].trim());
      const answer = this.escapeHtml(match[2].trim());
      textEl.innerHTML = `${question}<br><span class="ud-answer-toggle">👉 Bấm để xem đáp án</span>`;
      const toggle = textEl.querySelector('.ud-answer-toggle');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle.outerHTML = `<span class="ud-answer-revealed">✅ ${answer}</span>`;
      });
    } else {
      textEl.textContent = card.text;
    }
  }

  updateStatusBar() {
    document.getElementById('ud-drawn').textContent = this.drawnIds.size;
    document.getElementById('ud-type').textContent = this.currentCard ? (CATEGORY_META[this.currentCard.category]?.label.replace(/^\S+\s/, '') || '') : '--';
    const remaining = Math.max(this.totalPool - this.drawnIds.size, 0);
    document.getElementById('ud-remaining').textContent = `${remaining} lá`;
    document.getElementById('ud-progress-text').textContent =
      `Đã rút ${this.drawnIds.size} / ${this.totalPool} lá`;
  }

  resetProgress() {
    if (!confirm('Reset toàn bộ tiến trình rút lá?')) return;
    this.drawnIds.clear();
    this.history = [];
    this.saveHistory();
    this.currentCard = null;
    document.getElementById('ud-card').classList.remove('flipped');
    this.buildDeck();
    this.updateStatusBar();
  }

  // ============ HISTORY ============
  renderHistory() {
    const historyEl = document.getElementById('udHistory');
    const list = document.getElementById('udHistoryList');
    if (!list) return;
    
    if (this.history.length === 0) {
      historyEl.style.display = 'none';
      return;
    }
    
    historyEl.style.display = 'block';
    
    list.innerHTML = this.history.map((card, index) => `
      <div class="ud-history-item h-${card.category}">
        <span class="h-text">${card.text}</span>
        <span class="h-num">#${this.history.length - index}</span>
      </div>
    `).join('');
    
    list.scrollTop = 0; // Luôn ở đầu (mới nhất)
  }

  // ============ UI BINDINGS ============
  bindUI() {
    document.getElementById('ud-card').addEventListener('click', () => this.drawCard());
    
    document.getElementById('udHistoryClear').addEventListener('click', () => {
      if (this.history.length === 0) return;
      if (confirm('Xóa toàn bộ lịch sử rút lá?')) {
        this.history = [];
        this.saveHistory();
      }
    });

    const overlay = document.getElementById('udSettingsOverlay');
    document.getElementById('udSettingsClose').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

    document.getElementById('udSetNoRepeat').checked = this.settings.noRepeat;
    document.getElementById('udSetNoRepeat').addEventListener('change', (e) => {
      this.settings.noRepeat = e.target.checked;
      this.saveSettings();
    });

    document.getElementById('udSetResetDeck').addEventListener('click', () => {
      overlay.classList.remove('open');
      this.resetProgress();
    });

    document.getElementById('udAdminAdd').addEventListener('click', () => this.adminAddCard());
    this.renderAdminList();
  }

  // ============ ADMIN: THÊM LÁ ============
  renderAdminCatOptions() {
    const sel = document.getElementById('udAdminCat');
    if (!sel || sel.dataset.built) return;
    sel.innerHTML = Object.keys(CATEGORY_META).map(key =>
      `<option value="${key}">${CATEGORY_META[key].label}</option>`).join('');
    sel.dataset.built = '1';
  }

  renderAdminList() {
    const list = document.getElementById('udAdminList');
    if (!list) return;
    const custom = this._customDocs || [];
    list.innerHTML = custom.map(c =>
      `<div class="ud-admin-item"><span>${CATEGORY_META[c.category]?.label || c.category}: ${c.text.slice(0, 30)}${c.text.length > 30 ? '…' : ''}</span><button data-id="${c.id}">✕</button></div>`
    ).join('') || '<div style="font-size:10px;color:#64748b">Chưa có lá tự thêm</div>';

    list.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => this.adminDeleteCard(btn.dataset.id));
    });
  }

  // ============ TÍCH HỢP VÀO TOP-NAV ============
  injectSettingsMenuItem() {
    const tryInject = () => {
      const dropdown = document.getElementById('vtNavDropdown');
      if (!dropdown) { setTimeout(tryInject, 200); return; }
      if (document.getElementById('udNavSettingsBtn')) return;
      const btn = document.createElement('button');
      btn.className = 'vt-dd-action settings-btn';
      btn.id = 'udNavSettingsBtn';
      btn.innerHTML = '<span>⚙️</span> Setting Game';
      btn.addEventListener('click', () => {
        dropdown.classList.remove('open');
        document.getElementById('vtHamburger')?.classList.remove('open');
        document.getElementById('udSettingsOverlay').classList.add('open');
        this.refreshAdminVisibility();
      });
      const firstDivider = dropdown.querySelector('.dd-divider');
      if (firstDivider) dropdown.insertBefore(btn, firstDivider);
      else dropdown.appendChild(btn);
    };
    tryInject();
  }
}

window.udGame = new UongDi();