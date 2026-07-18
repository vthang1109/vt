// shop.js — Gacha Thú Cưng + Shop Danh Hiệu
import { db, auth } from '../points.js';
import { doc, runTransaction, onSnapshot, arrayUnion, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doGacha } from '../pet.js';
import { TIER_META, getShopTitlesByTier, getTitleById } from '../titles.js';

const TIER_COLOR = { 1:'#94a3b8', 2:'#34d399', 3:'#fbbf24', 4:'#f43f5e', 5:'#a78bfa' };
const TIER_NAME  = { 1:'Ga mo', 2:'Tinh anh', 3:'Ba san', 4:'Kiet tac', 5:'Huyen thoai' };

const GACHA_DATA = {
  normal: [
    { id:'pg_x1',  name:'Gacha Thuong x1',  icon:'🐣', qty:1,  price:500,  desc:'1 lan trieu hoi' },
    { id:'pg_x10', name:'Gacha Thuong x10', icon:'🐣', qty:10, price:4500, desc:'10 lan · Tiet kiem 10%', badge:'best' },
  ],
  vip: [
    { id:'pg_vip_x1',  name:'Gacha VIP x1',  icon:'🦄', qty:1,  price:4000,  desc:'1 lan trieu hoi VIP' },
    { id:'pg_vip_x10', name:'Gacha VIP x10', icon:'🦄', qty:10, price:36000, desc:'10 lan · Tiet kiem 10%', badge:'best' },
  ],
};

let activeTab = 'normal';
let activeTitleTier = 'A';
let myPoints = 0;
let myOwnedTitleIds = [];
let myActiveTitleId = null;
let lockedItems = [];
let isAdmin = false;

// POPUP thay the confirm/alert (WebView Android block native dialog)
function showPopup({ title, message, confirmText, cancelText, onConfirm, onCancel, type }) {
  const existing = document.getElementById('shopPopup');
  if (existing) existing.remove();

  type = type || 'confirm';
  confirmText = confirmText || (type === 'confirm' ? 'Xac nhan' : 'Dong');
  cancelText  = cancelText  || 'Huy';

  const overlay = document.createElement('div');
  overlay.id = 'shopPopup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🏅';
  const btnColor = type === 'error' ? '#ef4444' : '#3b82f6';

  overlay.innerHTML =
    '<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="font-size:32px;margin-bottom:12px">' + icon + '</div>' +
      (title ? '<div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:8px">' + title + '</div>' : '') +
      '<div style="font-size:14px;color:#94a3b8;margin-bottom:20px;line-height:1.6">' + message + '</div>' +
      '<div style="display:flex;gap:10px;">' +
        (type === 'confirm' ? '<button id="shopPopupCancel" style="flex:1;padding:12px;border-radius:10px;border:1px solid #475569;background:transparent;color:#94a3b8;font-size:14px;cursor:pointer;">' + cancelText + '</button>' : '') +
        '<button id="shopPopupConfirm" style="flex:1;padding:12px;border-radius:10px;border:none;background:' + btnColor + ';color:#fff;font-size:14px;font-weight:700;cursor:pointer;">' + confirmText + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  document.getElementById('shopPopupConfirm').addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });

  const cancelBtn = document.getElementById('shopPopupCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      if (onCancel) onCancel();
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });
}


// ADMIN TOGGLE LOCK
async function toggleLock(itemId) {
  const cfgRef = doc(db, 'system', 'shopConfig');
  const snap = await getDoc(cfgRef);
  const locked = snap.exists() ? (snap.data().locked || []) : [];
  const newLocked = locked.includes(itemId)
    ? locked.filter(function(x) { return x !== itemId; })
    : [...locked, itemId];
  await setDoc(cfgRef, { locked: newLocked }, { merge: true });
}

// ROLL
async function rollGacha(qty, price, type) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chua dang nhap');
  const userRef = doc(db, 'users', user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('Khong tim thay tai khoan');
    const pts = snap.data().points || 0;
    if (pts < price) throw new Error('Khong du diem! Can ' + price.toLocaleString('vi-VN') + ' sao');
    tx.update(userRef, { points: pts - price });
  });
  return await doGacha(qty, type);
}

// MUA DANH HIEU
async function buyTitle(id, price) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chua dang nhap');
  const userRef = doc(db, 'users', user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('Khong tim thay tai khoan');
    const d = snap.data();
    const pts = d.points || 0;
    const owned = d.ownedTitles || [];
    if (owned.includes(id)) throw new Error('Ban da so huu danh hieu nay!');
    if (pts < price) throw new Error('Khong du diem! Can ' + price.toLocaleString('vi-VN') + ' sao');
    tx.update(userRef, { points: pts - price, ownedTitles: arrayUnion(id) });
  });
}

// RENDER TIER TABS
function renderTitleTierTabs() {
  const wrap = document.getElementById('titleTierTabs');
  if (!wrap) return;
  wrap.innerHTML = Object.entries(TIER_META).map(function(entry) {
    const tier = entry[0], meta = entry[1];
    return '<button class="title-tier-tab tier-' + tier + (tier === activeTitleTier ? ' active' : '') + '" data-tier="' + tier + '">' + meta.icon + ' ' + meta.name.split(' · ')[0] + '</button>';
  }).join('');

  wrap.querySelectorAll('.title-tier-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeTitleTier = btn.dataset.tier;
      renderTitleTierTabs();
      renderTitleGrid();
    });
  });
}

// RENDER TITLE GRID
function renderTitleGrid() {
  const grid  = document.getElementById('shopGrid');
  const label = document.getElementById('shopSectionLabel');
  if (!grid) return;

  const meta  = TIER_META[activeTitleTier];
  const items = getShopTitlesByTier(activeTitleTier);

  if (label) label.textContent = 'Danh hieu — ' + meta.name;

  // Lọc: user thường không thấy item bị khoá
  const visibleItems = isAdmin ? items : items.filter(function(t) { return !lockedItems.includes(t.id); });

  grid.innerHTML = visibleItems.map(function(t) {
    const owned    = myOwnedTitleIds.includes(t.id);
    const isActive = myActiveTitleId === t.id;
    const locked   = lockedItems.includes(t.id);

    let btnLabel = t.price.toLocaleString('vi-VN') + ' 〄 Mua';
    let btnCls   = '';
    let disabled = false;
    if (isActive)        { btnLabel = '✓ Dang dung'; btnCls = 'active-now'; disabled = true; }
    else if (owned)      { btnLabel = '✓ Da so huu'; btnCls = 'owned';      disabled = true; }
    else if (locked)     { btnLabel = '🔒 Da khoa';  btnCls = 'locked-btn'; disabled = true; }

    return '<div class="shop-card' + (locked ? ' locked' : '') + '" style="cursor:default;' + (locked ? 'opacity:0.45;' : '') + '">' +
      '<div class="shop-card-icon">' + meta.icon + '</div>' +
      '<div class="shop-card-info">' +
        '<span class="title-badge ' + t.cls + '">' + t.label + (locked ? ' <span style="font-size:11px;color:#ef4444;">🔒 Đã khoá</span>' : '') + '</span>' +
        '<div class="shop-card-desc" style="margin-top:6px">' + t.desc + '</div>' +
      '</div>' +
      '<div class="title-card-right">' +
        '<button class="title-buy-btn ' + btnCls + '" data-id="' + t.id + '" data-price="' + t.price + '"' + (disabled ? ' disabled' : '') + '>' +
          btnLabel +
        '</button>' +
        (isAdmin ? '<button class="admin-lock-btn" data-id="' + t.id + '" style="margin-top:4px;padding:3px 8px;border-radius:6px;border:none;font-size:10px;font-weight:700;cursor:pointer;background:' + (locked ? 'rgba(34,197,94,0.2);color:#4ade80' : 'rgba(239,68,68,0.2);color:#f87171') + ';">' + (locked ? '🔓 Mở' : '🔒 Khoá') + '</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Admin lock buttons
  if (isAdmin) {
    grid.querySelectorAll('.admin-lock-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleLock(this.dataset.id).catch(function(err) {
          showPopup({ type: 'error', message: err.message, onConfirm: function() {} });
        });
      });
    });
  }

  // Buy buttons
  grid.querySelectorAll('.title-buy-btn:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id    = btn.dataset.id;
      const price = parseInt(btn.dataset.price);
      const titleObj = getTitleById(id);

      showPopup({
        type: 'confirm',
        title: 'Xac nhan mua',
        message: 'Mua danh hieu <b style="color:#f1f5f9">' + (titleObj ? titleObj.label : id) + '</b> voi gia <b style="color:#fbbf24">' + price.toLocaleString('vi-VN') + ' 〄</b>?',
        confirmText: 'Mua ngay',
        onConfirm: function() {
          btn.disabled    = true;
          btn.textContent = 'Dang xu ly...';
          buyTitle(id, price).then(function() {
            showPopup({
              type: 'success',
              message: 'Mua danh hieu thanh cong! Vao Tui do de chon hien thi.',
              onConfirm: function() {},
            });
          }).catch(function(error) {
            showPopup({
              type: 'error',
              message: error.message,
              onConfirm: function() {},
            });
            btn.disabled    = false;
            btn.textContent = price.toLocaleString('vi-VN') + ' 〄 Mua';
          });
        },
      });
    });
  });
}

// SHOW GACHA RESULT
function showResult(results, type) {
  const grid = document.getElementById('resultGrid');
  const title = document.getElementById('resultTitle');
  if (!grid) return;
  if (title) title.textContent = type === 'vip' ? '🦄 Ket qua VIP Gacha' : '🐣 Ket qua Gacha';
  grid.innerHTML = results.map(function(r) {
    const tier  = r.tier || { id: 1 };
    const color = TIER_COLOR[tier.id] || '#94a3b8';
    const thumb = (r.images && r.images[0]) ? r.images[0] : '';
    return '<div class="result-card" style="border-color:' + color + '">' +
      '<div class="r-emoji">' +
        (thumb
          ? '<img src="' + thumb + '" alt="' + r.name + '" style="width:52px;height:52px;object-fit:contain;border-radius:8px" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"/><span style="font-size:32px;display:none">' + (r.emoji || '🐾') + '</span>'
          : '<span style="font-size:32px">' + (r.emoji || '🐾') + '</span>') +
      '</div>' +
      '<div class="r-name">' + r.name + '</div>' +
      '<div class="r-tier" style="color:' + color + '">' + (TIER_NAME[tier.id] || 'Thuong') + '</div>' +
    '</div>';
  }).join('');
  document.getElementById('resultOverlay').classList.add('active');
}

// RENDER GRID
function render() {
  const tierTabsEl = document.getElementById('titleTierTabs');

  if (activeTab === 'title') {
    if (tierTabsEl) tierTabsEl.style.display = 'flex';
    renderTitleTierTabs();
    renderTitleGrid();
    return;
  }
  if (tierTabsEl) tierTabsEl.style.display = 'none';

  const grid  = document.getElementById('shopGrid');
  const label = document.getElementById('shopSectionLabel');
  const items = GACHA_DATA[activeTab];
  if (!grid) return;

  if (label) label.textContent = activeTab === 'vip' ? 'Gacha VIP · Ti le cao hon' : 'Gacha Thuong';

  grid.innerHTML = items.map(function(item) {
    const locked = lockedItems.includes(item.id);
    return '<div class="shop-card' + (activeTab === 'vip' ? ' vip' : '') + (locked ? ' locked' : '') + '" data-qty="' + item.qty + '" data-price="' + item.price + '" data-type="' + activeTab + '" data-id="' + item.id + '" style="cursor:' + (locked ? 'not-allowed' : 'pointer') + ';' + (locked ? 'opacity:0.45;' : '') + '">' +
      '<div class="shop-card-icon">' + item.icon + '</div>' +
      '<div class="shop-card-info">' +
        '<div class="shop-card-name">' + item.name + (locked ? ' <span style="font-size:11px;color:#ef4444;">🔒 Đã khoá</span>' : '') + '</div>' +
        '<div class="shop-card-desc">' + item.desc + '</div>' +
      '</div>' +
      '<div class="shop-card-right">' +
        '<div class="shop-card-price">' + item.price.toLocaleString('vi-VN') + ' 〄</div>' +
        (item.badge === 'best' ? '<span class="shop-card-badge badge-best">GIA TOT</span>' : '') +
        (activeTab === 'vip' ? '<span class="shop-card-badge badge-vip">VIP</span>' : '') +
        (isAdmin ? '<button class="admin-lock-btn" data-id="' + item.id + '" style="margin-top:4px;padding:3px 8px;border-radius:6px;border:none;font-size:10px;font-weight:700;cursor:pointer;background:' + (locked ? 'rgba(34,197,94,0.2);color:#4ade80' : 'rgba(239,68,68,0.2);color:#f87171') + ';">' + (locked ? '🔓 Mở' : '🔒 Khoá') + '</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  grid.querySelectorAll('.shop-card').forEach(function(card) {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    // Admin toggle lock
    if (isAdmin) {
      newCard.querySelector('.admin-lock-btn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleLock(this.dataset.id).then(function() {}).catch(function(err) {
          showPopup({ type: 'error', message: err.message, onConfirm: function() {} });
        });
      });
    }

    newCard.addEventListener('click', function() {
      if (this.classList.contains('locked')) return;
      const qty   = parseInt(this.dataset.qty);
      const price = parseInt(this.dataset.price);
      const type  = this.dataset.type;
      this.style.opacity       = '0.6';
      this.style.pointerEvents = 'none';
      const self = this;
      rollGacha(qty, price, type).then(function(results) {
        showResult(results, type);
      }).catch(function(e) {
        showPopup({ type: 'error', message: e.message, onConfirm: function() {} });
      }).finally(function() {
        self.style.opacity       = '';
        self.style.pointerEvents = '';
      });
    });
  });
}

// INIT
document.addEventListener('DOMContentLoaded', function() {
  render();

  document.getElementById('shopTabs').addEventListener('click', function(e) {
    const btn = e.target.closest('.shop-tab');
    if (!btn) return;
    document.querySelectorAll('.shop-tab').forEach(function(t) { t.classList.remove('active', 'vip-tab'); });
    btn.classList.add('active');
    if (btn.dataset.tab === 'vip') btn.classList.add('vip-tab');
    activeTab = btn.dataset.tab;
    render();
  });

  onAuthStateChanged(auth, function(user) {
    if (!user) { location.href = 'index.html'; return; }

    // Listen shopConfig
    onSnapshot(doc(db, 'system', 'shopConfig'), function(snap) {
      lockedItems = snap.exists() ? (snap.data().locked || []) : [];
      render();
    });

    onSnapshot(doc(db, 'users', user.uid), function(snap) {
      if (!snap.exists()) return;
      const d = snap.data();
      myPoints        = d.points      || 0;
      myOwnedTitleIds = d.ownedTitles || [];
      myActiveTitleId = d.activeTitle || null;
      isAdmin         = (user.email || '').trim().toLowerCase() === 'thang@game.com';

      const el = document.getElementById('shopPoints');
      if (el) el.textContent = myPoints.toLocaleString('vi-VN');
      if (window.TopNav) TopNav.setPoints(myPoints);

      render();
      if (activeTab === 'title') renderTitleGrid();
    });
  });
});

export { buyTitle, rollGacha };
