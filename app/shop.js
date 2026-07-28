// shop.js — Gacha Thú Cưng + Shop Danh Hiệu
import { db, auth, subscribeUserData } from '../points.js';
import { doc, runTransaction, onSnapshot, arrayUnion, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doGacha } from '../pet.js';
import { TIER_META, getShopTitlesByTier, getAutoTitlesByTier, getAutoOwnedTitles, getTitleById, getTitleProgress, computeHighestTierOrder, EVENT_TITLES } from '../titles.js';
const TIER_COLOR = { 1:'#94a3b8', 2:'#34d399', 3:'#fbbf24', 4:'#f43f5e', 5:'#a78bfa' };
const TIER_NAME  = { 1:'Ga mo', 2:'Tinh anh', 3:'Ba san', 4:'Kiet tac', 5:'Huyen thoai' };

const GACHA_ITEMS = [
  { id:'pg_x1',     name:'Gacha Thuong x1',  image:'/assets/pet/t1_1_1.png', qty:1,  price:500,   desc:'1 lan trieu hoi' },
  { id:'pg_x10',    name:'Gacha Thuong x10', image:'/assets/pet/t1_3_1.png', qty:10, price:4500,  desc:'10 lan · Tiet kiem 10%', badge:'best' },
  { id:'pg_vip_x1',  name:'Gacha VIP x1',     image:'/assets/pet/t4_1_1.png', qty:1,  price:4000,  desc:'1 lan trieu hoi VIP', vip: true },
  { id:'pg_vip_x10', name:'Gacha VIP x10',    image:'/assets/pet/t4_3_1.png', qty:10, price:36000, desc:'10 lan · Tiet kiem 10%', badge:'best', vip: true },
];

let shopActiveTab = 'gacha';
let activeTitleTier = 'A';
let myPoints = 0;
let myOwnedTitleIds = [];
let myActiveTitleId = null;
let myStats = {};
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
    const newOwned = [...owned, id];
    const highestOrder = computeHighestTierOrder(newOwned);
    tx.update(userRef, { points: pts - price, ownedTitles: arrayUnion(id), highestTierOrder: highestOrder });
  });
}

// ── SWITCH TAB (Gacha | Danh hiệu) ──────────────────────
function switchTab(tab) {
  if (tab === shopActiveTab) return;
  shopActiveTab = tab;

  // Cập nhật nút tab
  document.querySelectorAll('.shop-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Cập nhật panel
  document.querySelectorAll('.shop-panel').forEach(function(panel) {
    panel.classList.toggle('active', panel.dataset.panel === tab);
  });

  // Render nếu cần
  if (tab === 'title') {
    renderTitleTierTabs();
    renderTitleGrid();
  } else {
    renderGacha();
  }
};

// ── RENDER TIER TABS ────────────────────────────────────
function renderTitleTierTabs() {
  const wrap = document.getElementById('titleTierTabs');
  if (!wrap) return;

  // Các tab cấp A / S / SS / SSS
  const tierBtns = Object.entries(TIER_META).map(function(entry) {
    const tier = entry[0], meta = entry[1];
    return '<button class="title-tier-tab tier-' + tier + (tier === activeTitleTier ? ' active' : '') + '" data-tier="' + tier + '">' + meta.icon + ' ' + meta.name.split(' · ')[0] + '</button>';
  }).join('');

  // Nút Tag — hiện tất cả title thành tựu
  const questActive = activeTitleTier === 'quest';
  const questBtn = '<button class="title-tier-tab tier-quest' + (questActive ? ' active' : '') + '" data-tier="quest">📋 Tag</button>';

  wrap.innerHTML = tierBtns + questBtn;

  wrap.querySelectorAll('.title-tier-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeTitleTier = btn.dataset.tier;
      renderTitleTierTabs();
      renderTitleGrid();
    });
  });
}

// ── RENDER TITLE GRID ────────────────────────────────────
function renderTitleGrid() {
  const grid  = document.getElementById('titleGrid');
  if (!grid) return;

  const isQuestMode = activeTitleTier === 'quest';

  let meta, shopItems, autoItems;

  if (isQuestMode) {
    // Tab Nhiệm Vụ — hiện tất cả auto titles từ mọi cấp
    meta = { icon: '📋', color: '#fbbf24' };
    shopItems = [];
    // Lấy tất cả auto titles
    const allTiers = Object.keys(TIER_META);
    autoItems = [];
    allTiers.forEach(function(tier) {
      const tierItems = getAutoTitlesByTier(tier);
      autoItems.push.apply(autoItems, tierItems);
    });
  } else if (activeTitleTier === 'EVENT') {
    // Tab Event — hiện event tags + casino auto titles
    meta = TIER_META['EVENT'];
    shopItems = [];
    // Casino auto titles (thần bài, thần cờ bạc) với cls='tier-event'
    const casinoAutos = getAutoTitlesByTier('EVENT');
    autoItems = [
      ...EVENT_TITLES.filter(function(t) { return !t.hidden; }).map(function(t) {
        return { ...t, _type: 'event' };
      }),
      ...casinoAutos,
    ];
  } else {
    meta = TIER_META[activeTitleTier];
    shopItems = getShopTitlesByTier(activeTitleTier);
    autoItems = getAutoTitlesByTier(activeTitleTier);
  }

  const autoOwned = getAutoOwnedTitles(myStats);
  const autoOwnedIds = autoOwned.map(function(t) { return t.id; });

  // Kết hợp: shop trước, auto sau
  const allItems = [
    ...shopItems.map(function(t) { return { ...t, _type: 'shop' }; }),
    ...autoItems.map(function(t) { return { ...t, _type: t._type || 'auto' }; }),
  ];

  const visibleItems = isAdmin ? allItems : allItems.filter(function(t) { return !lockedItems.includes(t.id); });    // ── THANH TIẾN TRÌNH TAG ────────────────────────
    const totalAuto = autoItems.length;
    const unlockedAuto = autoItems.filter(function(t) { return autoOwnedIds.includes(t.id); }).length;
    const progressPct = totalAuto > 0 ? Math.round((unlockedAuto / totalAuto) * 100) : 0;

    let progressHtml = '';
    if (isQuestMode && totalAuto > 0) {
      progressHtml = '<div style="margin-bottom:14px;padding:12px 14px;border-radius:12px;background:rgba(15,23,42,0.5);border:1px solid rgba(251,191,36,0.15);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
          '<span style="font-size:12px;font-weight:700;color:#fbbf24;">📋 Tiến Trình Tag</span>' +
          '<span style="font-size:12px;font-weight:700;color:#94a3b8;">' + unlockedAuto + '/' + totalAuto + ' (' + progressPct + '%)</span>' +
        '</div>' +
        '<div style="height:6px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden;">' +
          '<div style="height:100%;border-radius:999px;background:linear-gradient(90deg,#fbbf24,#f59e0b);width:' + progressPct + '%;transition:width 0.5s ease;"></div>' +
        '</div>' +
      '</div>';
    }

    grid.innerHTML = progressHtml + visibleItems.map(function(t) {
    const owned    = myOwnedTitleIds.includes(t.id) || autoOwnedIds.includes(t.id);
    const isActive = myActiveTitleId === t.id;
    const locked   = lockedItems.includes(t.id);
    const isAuto   = t._type === 'auto';

    let btnLabel, btnCls, disabled;

    if (t._type === 'event') {
      const eOwned = myOwnedTitleIds.includes(t.id);
      if (eOwned)       { btnLabel = '✓ Đã sở hữu';  btnCls = 'owned';      disabled = true; }
      else              { btnLabel = '🎪 Event';     btnCls = 'event-btn';  disabled = true; }
    } else if (isAuto) {
      const unlocked = autoOwnedIds.includes(t.id);
      if (unlocked)      { btnLabel = '✓ Đã mở khóa'; btnCls = 'owned';      disabled = true; }
      else               { btnLabel = '📋 Nhiệm Vụ';  btnCls = 'quest-btn';  disabled = false; }
    } else {
      if (isActive)        { btnLabel = '✓ Đang dùng'; btnCls = 'active-now'; disabled = true; }
      else if (owned)      { btnLabel = '✓ Đã sở hữu'; btnCls = 'owned';      disabled = true; }
      else if (locked)     { btnLabel = '🔒 Đã khoá';  btnCls = 'locked-btn'; disabled = true; }
      else                 { btnLabel = t.price.toLocaleString('vi-VN') + ' 〄 Mua'; btnCls = ''; disabled = false; }
    }

    const cardStyle = 'cursor:default;' + (locked ? 'opacity:0.45;' : '');

    let badgeHtml = '<span class="title-badge ' + t.cls + '">' + t.label;
    if (locked) badgeHtml += ' <span style="font-size:11px;color:#ef4444;">🔒 Đã khoá</span>';
    badgeHtml += '</span>';

    // Progress bar cho auto title
    let progressHtml = '';
    if (isAuto) {
      const prog = getTitleProgress(t, myStats);
      if (prog) {
        const progPct = Math.round((prog.current / prog.target) * 100);
        const unlocked = autoOwnedIds.includes(t.id);
        progressHtml = '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;">' +
          '<div style="flex:1;height:4px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden;">' +
            '<div style="height:100%;border-radius:999px;background:' + (unlocked ? '#34d399' : 'linear-gradient(90deg,#38bdf8,#0ea5e9)') + ';width:' + progPct + '%;transition:width 0.5s ease;"></div>' +
          '</div>' +
          '<span style="font-size:10px;font-weight:700;color:' + (unlocked ? '#34d399' : '#94a3b8') + ';white-space:nowrap;">' + prog.current + '/' + prog.target + '</span>' +
        '</div>';
      }
    }

    return '<div class="shop-card' + (locked ? ' locked' : '') + (isAuto ? ' auto-title-card' : '') + '" style="' + cardStyle + '">' +
      '<div class="shop-card-icon">' + meta.icon + '</div>' +
      '<div class="shop-card-info">' +
        badgeHtml +
        '<div class="shop-card-desc" style="margin-top:6px">' + t.desc + '</div>' +
        progressHtml +
      '</div>' +
      '<div class="title-card-right">' +
        '<button class="title-buy-btn ' + btnCls + '" data-id="' + t.id + '" data-price="' + (t.price || 0) + '" data-type="' + t._type + '"' + (disabled ? ' disabled' : '') + '>' +
          btnLabel +
        '</button>' +
        (isAdmin ? '<button class="admin-lock-btn" data-id="' + t.id + '" style="margin-top:4px;padding:3px 8px;border-radius:6px;border:none;font-size:10px;font-weight:700;cursor:pointer;background:' + (locked ? 'rgba(34,197,94,0.2);color:#4ade80' : 'rgba(239,68,68,0.2);color:#f87171') + ';">' + (locked ? '🔓 Mở' : '🔒 Khoá') + '</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Admin lock
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

  // Shop buy buttons
  grid.querySelectorAll('.title-buy-btn[data-type="shop"]:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id    = btn.dataset.id;
      const price = parseInt(btn.dataset.price);
      const titleObj = getTitleById(id);

      showPopup({
        type: 'confirm',
        title: 'Xác nhận mua',
        message: 'Mua danh hiệu <b style="color:#f1f5f9">' + (titleObj ? titleObj.label : id) + '</b> với giá <b style="color:#fbbf24">' + price.toLocaleString('vi-VN') + ' 〄</b>?',
        confirmText: 'Mua ngay',
        onConfirm: function() {
          btn.disabled    = true;
          btn.textContent = 'Đang xử lý...';
          buyTitle(id, price).then(function() {
            showPopup({
              type: 'success',
              message: 'Mua danh hiệu thành công! Vào Túi đồ để chọn hiển thị.',
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

  // Auto title quest buttons — hiện popup điều kiện
  grid.querySelectorAll('.title-buy-btn[data-type="auto"]:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = btn.dataset.id;
      const titleObj = getTitleById(id);
      if (!titleObj) return;

      showPopup({
        type: 'info',
        title: '📋 Nhiệm Vụ: ' + titleObj.label,
        message: '<div style="text-align:left;line-height:1.8">' +
          '🔹 <b>Mô tả:</b> ' + titleObj.desc + '<br>' +
          '🔹 <b>Loại:</b> Thành tựu tự động<br>' +
          '🔹 <b>Hướng dẫn:</b> Hoàn thành điều kiện để tự động mở khóa. Vào <b>Cá nhân → Nhiệm vụ</b> để xem chi tiết.' +
        '</div>',
        confirmText: 'Đã hiểu',
        onConfirm: function() {},
      });
    });
  });
}

// ── SHOW GACHA RESULT ────────────────────────────────────
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

// ── RENDER GACHA GRID ────────────────────────────────────
function renderGacha() {
  const grid  = document.getElementById('shopGrid');
  if (!grid) return;

  grid.innerHTML = GACHA_ITEMS.map(function(item) {
    const locked = lockedItems.includes(item.id);
    const type   = item.vip ? 'vip' : 'normal';
    return '<div class="shop-card' + (item.vip ? ' vip' : '') + (locked ? ' locked' : '') + '" data-qty="' + item.qty + '" data-price="' + item.price + '" data-type="' + type + '" data-id="' + item.id + '" style="cursor:' + (locked ? 'not-allowed' : 'pointer') + ';' + (locked ? 'opacity:0.45;' : '') + '">' +
      '<div class="shop-card-icon">' +
        '<img src="' + item.image + '" alt="" class="shop-card-img" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/>' +
        '<span class="shop-card-icon-fallback" style="display:none;font-size:28px">' + (item.vip ? '🦄' : '🐣') + '</span>' +
      '</div>' +
      '<div class="shop-card-info">' +
        '<div class="shop-card-name">' + item.name + (locked ? ' <span style="font-size:11px;color:#ef4444;">🔒 Đã khoá</span>' : '') + '</div>' +
        '<div class="shop-card-desc">' + item.desc + '</div>' +
      '</div>' +
      '<div class="shop-card-right">' +
        '<div class="shop-card-price">' + item.price.toLocaleString('vi-VN') + ' 〄</div>' +
        (item.badge === 'best' ? '<span class="shop-card-badge badge-best">GIA TOT</span>' : '') +
        (item.vip ? '<span class="shop-card-badge badge-vip">VIP</span>' : '') +
        (isAdmin ? '<button class="admin-lock-btn" data-id="' + item.id + '" style="margin-top:4px;padding:3px 8px;border-radius:6px;border:none;font-size:10px;font-weight:700;cursor:pointer;background:' + (locked ? 'rgba(34,197,94,0.2);color:#4ade80' : 'rgba(239,68,68,0.2);color:#f87171') + ';">' + (locked ? '🔓 Mở' : '🔒 Khoá') + '</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  grid.querySelectorAll('.shop-card').forEach(function(card) {
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

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
  // Click tab buttons
  document.querySelectorAll('.shop-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(this.dataset.tab);
    });
  });

  // Mặc định mở Gacha ngay
  renderGacha();

  onAuthStateChanged(auth, function(user) {
    if (!user) { location.href = 'index.html'; return; }

    // Listen shopConfig
    onSnapshot(doc(db, 'system', 'shopConfig'), function(snap) {
      lockedItems = snap.exists() ? (snap.data().locked || []) : [];
      renderGacha();
      if (shopActiveTab === 'title') renderTitleGrid();
    });

    subscribeUserData(function(d) {
      if (!d) return;
      myPoints        = d.points      || 0;
      myOwnedTitleIds = d.ownedTitles || [];
      // activeTitle giờ là JSON array [id1, id2] hoặc string cũ
      function parseAT(v) {
        if (!v) return null;
        if (typeof v === 'string') {
          try { const p = JSON.parse(v); if (Array.isArray(p)) return p[0]||null; } catch {}
          return v;
        }
        return null;
      }
      myActiveTitleId = parseAT(d.activeTitle);
      isAdmin         = (user.email || '').trim().toLowerCase() === 'thang@game.com';

      // Stats cho auto titles
      const petCol = d.petCollection || {};
      const petCount = Object.values(petCol).reduce((sum, q) => sum + (q || 0), 0);
      const streak = d.streak || {};
      const us = d.stats || {};
      const ownedShopIds = d.ownedTitles || [];
      myStats = {
        points: myPoints,
        friends: (d.friends || []).length,
        petsOwned: petCount,
        streakCurrent: streak.current || 0,
        titlesOwned: ownedShopIds.length,
        hasNickname: !!(d.nickname),
        hasAvatar: !!d.avatarUrl,
        gamesPlayed: us.gamesPlayed || 0,
        uniqueGamesPlayed: us.uniqueGamesPlayed || 0,
        chessGamesPlayed: us.chessGamesPlayed || 0,
        cardGamesPlayed: us.cardGamesPlayed || 0,
        smartGamesPlayed: us.smartGamesPlayed || 0,
        xidachWins: us.xidachWins || 0,
        xidachSpecials: us.xidachSpecials || 0,
        casinoGamesPlayed: us.casinoGamesPlayed || 0,
        slotGamesPlayed: us.slotGamesPlayed || 0,
        slotWins: us.slotWins || 0,
        baucuaGamesPlayed: us.baucuaGamesPlayed || 0,
        baucuaWins: us.baucuaWins || 0,
        taixiuGamesPlayed: us.taixiuGamesPlayed || 0,
        taixiuWins: us.taixiuWins || 0,
        casinoWins: us.casinoWins || 0,
        totalWins: us.totalWins || 0,
      };

      const el = document.getElementById('shopPoints');
      if (el) el.textContent = myPoints.toLocaleString('vi-VN');
      if (window.TopNav) TopNav.setPoints(myPoints);

      renderGacha();
      if (shopActiveTab === 'title') renderTitleGrid();
    });
  });
});

export { buyTitle, rollGacha };
