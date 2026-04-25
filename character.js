// character.js — tích hợp Firestore / shop / gacha / bag
import { db, auth } from './points.js';
import {
  doc, updateDoc, onSnapshot, arrayUnion, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── CATALOG trang phục ────────────────────────────────────
// source: 'shop' = mua điểm | 'gacha' = rơi gacha | 'free' = mặc định
export const OUTFIT_CATALOG = {
  hat: [
    { id:'hat_none',    name:'Không',          icon:'🚫', source:'free',  gender:'both',   price:0 },
    { id:'hat_cap',     name:'Mũ lưỡi trai',   icon:'🧢', source:'shop',  gender:'both',   price:300 },
    { id:'hat_crown',   name:'Vương miện',      icon:'👑', source:'gacha', gender:'both',   price:0, gachaType:'vip' },
    { id:'hat_bow',     name:'Nơ hồng',         icon:'🎀', source:'shop',  gender:'female', price:250 },
    { id:'hat_hero',    name:'Mũ hero',         icon:'🪖', source:'gacha', gender:'male',   price:0, gachaType:'normal' },
    { id:'hat_witch',   name:'Mũ phù thủy',    icon:'🎩', source:'gacha', gender:'both',   price:0, gachaType:'vip' },
    { id:'hat_ribbon',  name:'Băng đô',         icon:'🌸', source:'shop',  gender:'female', price:200 },
    { id:'hat_ninja',   name:'Băng đầu ninja',  icon:'🥷', source:'gacha', gender:'both',   price:0, gachaType:'normal' },
  ],
  shirt: [
    { id:'shirt_none',   name:'Không',         icon:'🚫', source:'free',  gender:'both',   price:0 },
    { id:'shirt_basic',  name:'Áo phông',       icon:'👕', source:'shop',  gender:'both',   price:200 },
    { id:'shirt_vest',   name:'Vest',            icon:'🥼', source:'shop',  gender:'male',   price:500 },
    { id:'shirt_dress',  name:'Váy hoa',         icon:'👗', source:'gacha', gender:'female', price:0, gachaType:'vip' },
    { id:'shirt_armor',  name:'Giáp chiến',      icon:'🦺', source:'gacha', gender:'both',   price:0, gachaType:'vip' },
    { id:'shirt_hoodie', name:'Hoodie',           icon:'🧥', source:'shop',  gender:'both',   price:350 },
    { id:'shirt_kimono', name:'Kimono',           icon:'👘', source:'gacha', gender:'both',   price:0, gachaType:'vip' },
    { id:'shirt_sport',  name:'Áo thể thao',    icon:'🎽', source:'shop',  gender:'both',   price:280 },
  ],
  pants: [
    { id:'pants_none',   name:'Không',          icon:'🚫', source:'free',  gender:'both',   price:0 },
    { id:'pants_jeans',  name:'Jeans',           icon:'👖', source:'shop',  gender:'both',   price:250 },
    { id:'pants_skirt',  name:'Váy ngắn',        icon:'🩱', source:'shop',  gender:'female', price:220 },
    { id:'pants_shorts', name:'Quần short',      icon:'🩳', source:'shop',  gender:'both',   price:180 },
    { id:'pants_robe',   name:'Áo choàng',       icon:'🩴', source:'gacha', gender:'both',   price:0, gachaType:'vip' },
    { id:'pants_cargo',  name:'Quần cargo',      icon:'🪡', source:'shop',  gender:'male',   price:300 },
  ],
  deco: [
    { id:'deco_none',    name:'Không',           icon:'🚫', source:'free',  gender:'both',  price:0 },
    { id:'deco_sword',   name:'Kiếm',            icon:'⚔️', source:'gacha', gender:'both',  price:0, gachaType:'vip' },
    { id:'deco_wand',    name:'Gậy phép',        icon:'🪄', source:'gacha', gender:'both',  price:0, gachaType:'vip' },
    { id:'deco_pet_cat', name:'Mèo nhỏ',         icon:'🐱', source:'shop',  gender:'both',  price:400 },
    { id:'deco_wings',   name:'Cánh bướm',       icon:'🦋', source:'gacha', gender:'both',  price:0, gachaType:'vip' },
    { id:'deco_shield',  name:'Khiên',           icon:'🛡️', source:'shop',  gender:'male',  price:350 },
    { id:'deco_flower',  name:'Hoa cầm tay',     icon:'💐', source:'shop',  gender:'female',price:200 },
    { id:'deco_ball',    name:'Bóng phép',       icon:'🔮', source:'gacha', gender:'both',  price:0, gachaType:'normal' },
  ],
};

// Pool id để gacha outfit (export cho pet.js dùng)
export const OUTFIT_GACHA_POOL = {
  normal: Object.values(OUTFIT_CATALOG).flat().filter(i => i.source==='gacha' && i.gachaType==='normal').map(i=>i.id),
  vip:    Object.values(OUTFIT_CATALOG).flat().filter(i => i.source==='gacha').map(i=>i.id),
};

export const SLOT_META = {
  hat:   { label:'Mũ / Tóc', icon:'🧢' },
  shirt: { label:'Áo',       icon:'👕' },
  pants: { label:'Quần',     icon:'👖' },
  deco:  { label:'Phụ kiện', icon:'✨' },
};

// ── CHIBI SVG ─────────────────────────────────────────────
const CHIBI_SVG = {
  male: `<svg class="chibi-svg" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="27" y="72" width="11" height="22" rx="5" fill="#1e3a5f"/>
    <rect x="42" y="72" width="11" height="22" rx="5" fill="#1e3a5f"/>
    <rect x="22" y="44" width="36" height="30" rx="10" fill="#1e4a7a"/>
    <rect x="10" y="46" width="12" height="8" rx="4" fill="#1e4a7a"/>
    <circle cx="10" cy="50" r="5" fill="#fcd9b0"/>
    <rect x="58" y="46" width="12" height="8" rx="4" fill="#1e4a7a"/>
    <circle cx="70" cy="50" r="5" fill="#fcd9b0"/>
    <rect x="35" y="37" width="10" height="9" rx="3" fill="#fcd9b0"/>
    <ellipse cx="40" cy="26" rx="19" ry="20" fill="#fcd9b0"/>
    <ellipse cx="21" cy="27" rx="4" ry="5" fill="#fcd9b0"/>
    <ellipse cx="59" cy="27" rx="4" ry="5" fill="#fcd9b0"/>
    <ellipse cx="33" cy="25" rx="4" ry="4.5" fill="#fff"/>
    <ellipse cx="47" cy="25" rx="4" ry="4.5" fill="#fff"/>
    <circle cx="34" cy="26" r="2.5" fill="#1a2744"/>
    <circle cx="48" cy="26" r="2.5" fill="#1a2744"/>
    <circle cx="34.8" cy="24.8" r=".9" fill="#fff"/>
    <circle cx="48.8" cy="24.8" r=".9" fill="#fff"/>
    <circle cx="40" cy="31" r="1.2" fill="#e8a87c"/>
    <path d="M36 35 Q40 38 44 35" stroke="#c47a5a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="10" rx="18" ry="10" fill="#2d1b00"/>
    <rect x="22" y="10" width="36" height="12" rx="4" fill="#2d1b00"/>
  </svg>`,
  female: `<svg class="chibi-svg" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="27" y="72" width="11" height="22" rx="5" fill="#5a1a3a"/>
    <rect x="42" y="72" width="11" height="22" rx="5" fill="#5a1a3a"/>
    <ellipse cx="40" cy="68" rx="20" ry="10" fill="#c0397a"/>
    <rect x="22" y="44" width="36" height="28" rx="10" fill="#e05090"/>
    <rect x="10" y="46" width="12" height="8" rx="4" fill="#e05090"/>
    <circle cx="10" cy="50" r="5" fill="#fcd9b0"/>
    <rect x="58" y="46" width="12" height="8" rx="4" fill="#e05090"/>
    <circle cx="70" cy="50" r="5" fill="#fcd9b0"/>
    <rect x="35" y="37" width="10" height="9" rx="3" fill="#fcd9b0"/>
    <ellipse cx="40" cy="26" rx="19" ry="20" fill="#fcd9b0"/>
    <ellipse cx="21" cy="27" rx="4" ry="5" fill="#fcd9b0"/>
    <ellipse cx="59" cy="27" rx="4" ry="5" fill="#fcd9b0"/>
    <ellipse cx="33" cy="25" rx="4.5" ry="5.2" fill="#fff"/>
    <ellipse cx="47" cy="25" rx="4.5" ry="5.2" fill="#fff"/>
    <circle cx="33.5" cy="26" r="3" fill="#1a2744"/>
    <circle cx="47.5" cy="26" r="3" fill="#1a2744"/>
    <circle cx="34.2" cy="24.5" r="1" fill="#fff"/>
    <circle cx="48.2" cy="24.5" r="1" fill="#fff"/>
    <path d="M29 21 Q33 19 37 21" stroke="#1a2744" stroke-width="1.3" fill="none"/>
    <path d="M43 21 Q47 19 51 21" stroke="#1a2744" stroke-width="1.3" fill="none"/>
    <ellipse cx="27" cy="30" rx="4" ry="2.5" fill="#f9a8c9" opacity=".5"/>
    <ellipse cx="53" cy="30" rx="4" ry="2.5" fill="#f9a8c9" opacity=".5"/>
    <circle cx="40" cy="31" r="1" fill="#e8a87c"/>
    <path d="M36.5 35 Q40 38.5 43.5 35" stroke="#c47a5a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="10" rx="18" ry="10" fill="#5c1a1a"/>
    <rect x="22" y="10" width="36" height="14" rx="4" fill="#5c1a1a"/>
    <rect x="19" y="18" width="8" height="30" rx="4" fill="#5c1a1a"/>
    <rect x="53" y="18" width="8" height="30" rx="4" fill="#5c1a1a"/>
  </svg>`,
};

function getEquipOverlay(slot, item) {
  if (!item || item.id.endsWith('_none')) return '';
  const pos = {
    hat:   'top:2px;left:50%;transform:translateX(-50%);font-size:22px',
    shirt: 'top:40px;left:50%;transform:translateX(-50%);font-size:20px;opacity:.8',
    pants: 'bottom:18px;left:50%;transform:translateX(-50%);font-size:18px;opacity:.8',
    deco:  'bottom:8px;right:2px;font-size:20px',
  };
  return `<div style="position:absolute;${pos[slot]};pointer-events:none;">${item.icon}</div>`;
}

// ── STATE ─────────────────────────────────────────────────
let charState = {
  gender:   'male',
  equipped: { hat:'hat_none', shirt:'shirt_none', pants:'pants_none', deco:'deco_none' },
  owned:    ['hat_none','shirt_none','pants_none','deco_none','shirt_basic','pants_jeans'],
};
let pendingEquipped = {};
let activeTab = 'hat';
let unsubChar = null;

// ── FIRESTORE SYNC ────────────────────────────────────────
export function initCharacterSystem() {
  onAuthStateChanged(auth, user => {
    if (!user) return;
    if (unsubChar) unsubChar();
    unsubChar = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.character) {
        charState.gender   = d.character.gender   || 'male';
        charState.equipped = d.character.equipped || charState.equipped;
      }
      if (d.outfitOwned && d.outfitOwned.length) charState.owned = d.outfitOwned;
      renderProfileChar();
    });
  });
}

async function saveToFirestore() {
  const user = auth.currentUser;
  if (!user) return;
  charState.equipped = { ...pendingEquipped };
  await updateDoc(doc(db, 'users', user.uid), {
    'character.gender':   charState.gender,
    'character.equipped': charState.equipped,
  });
}

// ── MUA TRANG PHỤC (shop) ────────────────────────────────
export async function buyOutfitItem(itemId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  const item = findItemById(itemId);
  if (!item || item.source !== 'shop') throw new Error('Item không bán');
  if (charState.owned.includes(itemId)) throw new Error('Đã sở hữu');

  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const pts = snap.data().points || 0;
    if (pts < item.price) throw new Error(`Không đủ điểm (cần ${item.price} ⭐)`);
    tx.update(userRef, {
      points:      pts - item.price,
      outfitOwned: arrayUnion(itemId),
    });
    // Cập nhật statusbar nếu đang ở trang shop
    const spEl = document.getElementById('status-pts');
    if (spEl) spEl.textContent = (pts - item.price).toLocaleString('vi');
    return { newPoints: pts - item.price };
  });
}

// ── NHẬN TRANG PHỤC TỪ GACHA ────────────────────────────
// Gọi từ pet.js/doGacha sau khi roll có outfit
export async function grantOutfitItem(itemId) {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), {
    outfitOwned: arrayUnion(itemId),
  });
}

// ── RENDER CHIBI (export để bag.js dùng preview) ─────────
export function renderChibiTo(container, gender, equipped) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'chibi-wrap animate';
  wrap.style.position = 'relative';

  const bodyLayer = document.createElement('div');
  bodyLayer.className = 'chibi-layer chibi-layer-body';
  bodyLayer.innerHTML = CHIBI_SVG[gender] || CHIBI_SVG.male;
  wrap.appendChild(bodyLayer);

  ['pants','shirt','hat','deco'].forEach(slot => {
    const item = findItem(slot, equipped[slot]);
    const html = getEquipOverlay(slot, item);
    if (html) wrap.innerHTML += html;
  });

  container.appendChild(wrap);
}

function renderProfileChar() {
  const frame = document.getElementById('pro-character-frame');
  if (!frame) return;
  renderChibiTo(frame, charState.gender, charState.equipped);
  const sub = document.getElementById('pro-char-name');
  if (sub) sub.textContent = charState.gender === 'male' ? 'Nhân vật Nam' : 'Nhân vật Nữ';
}

// ── MODAL TỦ ĐỒ ──────────────────────────────────────────
export function openWardrobeModal() {
  pendingEquipped = { ...charState.equipped };
  const existing = document.getElementById('wardrobe-overlay');
  if (existing) { existing.classList.add('open'); refreshWardrobe(); return; }
  buildWardrobeModal();
}

export function closeWardrobeModal() {
  document.getElementById('wardrobe-overlay')?.classList.remove('open');
}

function buildWardrobeModal() {
  const overlay = document.createElement('div');
  overlay.id = 'wardrobe-overlay';
  overlay.className = 'wardrobe-overlay';
  overlay.innerHTML = `
    <div class="wardrobe-modal">
      <div class="wardrobe-handle"></div>
      <div class="wardrobe-header">
        <span class="wardrobe-title">🗄️ TỦ ĐỒ</span>
        <button class="wardrobe-close" id="wd-close-btn">✕</button>
      </div>
      <div class="wardrobe-body">
        <div class="wardrobe-preview">
          <div class="wardrobe-char-stage" id="wd-stage"></div>
          <div class="gender-toggle">
            <button class="gender-btn" data-g="male">♂ Nam</button>
            <button class="gender-btn" data-g="female">♀ Nữ</button>
          </div>
          <div class="wardrobe-slots" id="wd-slots"></div>
        </div>
        <div class="wardrobe-right">
          <div class="wardrobe-tabs" id="wd-tabs"></div>
          <div class="wardrobe-items" id="wd-items"></div>
        </div>
      </div>
      <button class="wardrobe-save" id="wd-save-btn">💾 LƯU TRANG PHỤC</button>
    </div>`;

  overlay.addEventListener('click', e => { if(e.target===overlay) closeWardrobeModal(); });
  overlay.querySelector('#wd-close-btn').addEventListener('click', closeWardrobeModal);
  overlay.querySelector('#wd-save-btn').addEventListener('click', saveWardrobe);
  overlay.querySelectorAll('.gender-btn').forEach(b =>
    b.addEventListener('click', () => setGender(b.dataset.g))
  );
  document.body.appendChild(overlay);
  setTimeout(() => { overlay.classList.add('open'); refreshWardrobe(); }, 10);
}

function refreshWardrobe() {
  updateGenderBtns();
  renderWardrobePreview();
  renderWardrobeTabs();
  renderWardrobeItems();
  renderSlotSummary();
}

function renderWardrobePreview() {
  const stage = document.getElementById('wd-stage');
  if (stage) renderChibiTo(stage, charState.gender, pendingEquipped);
}

function updateGenderBtns() {
  document.querySelectorAll('.gender-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.g === charState.gender)
  );
}

function renderWardrobeTabs() {
  const el = document.getElementById('wd-tabs');
  if (!el) return;
  el.innerHTML = Object.entries(SLOT_META).map(([k,v]) =>
    `<button class="wardrobe-tab ${activeTab===k?'active':''}" data-tab="${k}">${v.icon} ${v.label}</button>`
  ).join('');
  el.querySelectorAll('.wardrobe-tab').forEach(b =>
    b.addEventListener('click', () => setTab(b.dataset.tab))
  );
}

function renderWardrobeItems() {
  const el = document.getElementById('wd-items');
  if (!el) return;
  const items = (OUTFIT_CATALOG[activeTab] || []).filter(i =>
    i.gender === 'both' || i.gender === charState.gender
  );

  el.innerHTML = items.map(item => {
    const owned   = charState.owned.includes(item.id);
    const equipped = pendingEquipped[activeTab] === item.id;
    const locked  = !owned && item.source !== 'free';

    let badge = '';
    if (!owned && item.source === 'shop')
      badge = `<span class="item-source shop">🛒 ${item.price}⭐</span>`;
    else if (!owned && item.source === 'gacha')
      badge = `<span class="item-source gacha">🎲 Gacha</span>`;

    return `<div class="wardrobe-item ${equipped?'equipped':''} ${locked?'locked':''}"
      data-id="${item.id}" data-source="${item.source}" data-price="${item.price||0}">
      ${badge}
      <span class="item-icon">${locked ? (item.source==='shop'?'🔒':'🎲') : item.icon}</span>
      <span class="item-name">${item.name}</span>
      ${equipped ? '<span class="item-equipped-check">✓</span>' : ''}
    </div>`;
  }).join('');

  el.querySelectorAll('.wardrobe-item').forEach(card => {
    card.addEventListener('click', async () => {
      const id     = card.dataset.id;
      const owned  = charState.owned.includes(id);
      const source = card.dataset.source;
      const price  = parseInt(card.dataset.price) || 0;

      if (owned) { equipItem(activeTab, id); return; }

      if (source === 'shop') {
        if (!confirm(`Mua "${findItemById(id)?.name}" với giá ${price} ⭐?`)) return;
        try {
          await buyOutfitItem(id);
          showToast(`✅ Mua thành công! -${price} ⭐`);
          charState.owned.push(id);
          equipItem(activeTab, id);
        } catch(e) { showToast('❌ ' + e.message); }
      } else {
        showToast('🎲 Item này chỉ có từ Gacha!');
      }
    });
  });
}

function renderSlotSummary() {
  const el = document.getElementById('wd-slots');
  if (!el) return;
  el.innerHTML = Object.entries(SLOT_META).map(([k,v]) => {
    const item = findItem(k, pendingEquipped[k]);
    const val  = item && !item.id.endsWith('_none') ? item.icon+' '+item.name : '—';
    return `<div class="slot-row">
      <span class="slot-icon">${v.icon}</span>
      <span class="slot-name">${v.label}</span>
      <span class="slot-val">${val}</span>
    </div>`;
  }).join('');
}

function setGender(g) { charState.gender = g; refreshWardrobe(); }
function setTab(tab)   { activeTab = tab; renderWardrobeTabs(); renderWardrobeItems(); }

function equipItem(slot, id) {
  pendingEquipped[slot] = id;
  renderWardrobePreview();
  renderWardrobeItems();
  renderSlotSummary();
}

async function saveWardrobe() {
  try {
    await saveToFirestore();
    renderProfileChar();
    closeWardrobeModal();
    showToast('✅ Đã lưu trang phục!');
  } catch(e) { showToast('❌ ' + e.message); }
}

// ── UTILS ─────────────────────────────────────────────────
function findItem(slot, id)  { return (OUTFIT_CATALOG[slot]||[]).find(i=>i.id===id); }
function findItemById(id)    { return Object.values(OUTFIT_CATALOG).flat().find(i=>i.id===id); }

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0d1829;border:1px solid #38bdf8;color:#38bdf8;padding:10px 22px;border-radius:99px;font-size:13px;font-weight:800;z-index:9999;font-family:Nunito,sans-serif;pointer-events:none;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2400);
}

// ── GLOBAL ────────────────────────────────────────────────
window.openWardrobeModal  = openWardrobeModal;
window.closeWardrobeModal = closeWardrobeModal;

// ── AUTO INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initCharacterSystem();
  document.getElementById('pro-character-frame')
    ?.addEventListener('click', openWardrobeModal);
});
