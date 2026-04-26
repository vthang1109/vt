// character.js — ID rút gọn & Tier system
import { db, auth } from './points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, arrayUnion, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── TIER ──────────────────────────────────────────────────
export const ITEM_TIERS = {
  NUB: { id: 1, name: 'Nub', color: '#94a3b8', icon: '🔹', short: 'N' },
  VIP: { id: 2, name: 'Vip', color: '#fbbf24', icon: '🔶', short: 'V' },
  GOD: { id: 3, name: 'God', color: '#f43f5e', icon: '👑', short: 'G' },
};

// ── CATALOG (ID: E1_01, H2_03, S3_01...) ─────────────────
export const OUTFIT_CATALOG = {
  eyes: [
    { id:'E1_01', name:'Mat Ngau', tier:1, source:'free', price:0 },
    { id:'E1_02', name:'Mắt nâu', tier:1, source:'free', price:0 },
    { id:'E2_01', name:'Mắt xanh dương', tier:2, source:'shop', price:150 },
    { id:'E2_02', name:'Mắt đỏ', tier:2, source:'shop', price:150 },
    { id:'E3_01', name:'Mắt tím', tier:3, source:'gacha', price:0 },
    { id:'E3_02', name:'Mắt sao', tier:3, source:'gacha', price:0 },
  ],
  head: [
    { id:'H1_01', name:'Tóc Quy Ong', tier:1, source:'free', price:0 },
    { id:'H1_02', name:'Tóc nâu', tier:1, source:'free', price:0 },
    { id:'H2_01', name:'Tóc vàng', tier:2, source:'shop', price:200 },
    { id:'H2_02', name:'Tóc đỏ', tier:2, source:'shop', price:200 },
    { id:'H2_03', name:'Mũ lưỡi trai', tier:2, source:'shop', price:300 },
    { id:'H3_01', name:'Vương miện', tier:3, source:'gacha', price:0 },
    { id:'H3_02', name:'Mũ phù thủy', tier:3, source:'gacha', price:0 },
    { id:'H3_03', name:'Nơ hồng', tier:3, source:'gacha', price:0 },
  ],
  shirt: [
    { id:'S1_01', name:'Vest', tier:1, source:'free', price:0 },
    { id:'S1_02', name:'Áo thun đen', tier:1, source:'free', price:0 },
    { id:'S2_01', name:'Áo sơ mi', tier:2, source:'shop', price:200 },
    { id:'S2_02', name:'Hoodie xám', tier:2, source:'shop', price:350 },
    { id:'S2_03', name:'Vest đen', tier:2, source:'shop', price:500 },
    { id:'S3_01', name:'Áo giáp vàng', tier:3, source:'gacha', price:0 },
    { id:'S3_02', name:'Kimono đỏ', tier:3, source:'gacha', price:0 },
  ],
  pants: [
    { id:'P1_01', name:'Quần Au', tier:1, source:'free', price:0 },
    { id:'P1_02', name:'Quần đen', tier:1, source:'free', price:0 },
    { id:'P2_01', name:'Quần short thể thao', tier:2, source:'shop', price:180 },
    { id:'P2_02', name:'Quần cargo', tier:2, source:'shop', price:300 },
    { id:'P2_03', name:'Váy ngắn', tier:2, source:'shop', price:220 },
    { id:'P3_01', name:'Quần thần thoại', tier:3, source:'gacha', price:0 },
  ],
  deco: [
    { id:'D1_01', name:'Vali Tien', tier:1, source:'free', price:0 },
    { id:'D2_01', name:'Khiên sắt', tier:2, source:'shop', price:350 },
    { id:'D3_01', name:'Cánh thiên thần', tier:3, source:'gacha', price:0 },
    { id:'D3_02', name:'Gậy phép', tier:3, source:'gacha', price:0 },
    { id:'D3_03', name:'Mèo nhỏ', tier:3, source:'gacha', price:0 },
  ],
};

const GACHA_POOL = Object.values(OUTFIT_CATALOG).flat()
  .filter(i => i.source === 'gacha');

const GACHA_PRICE = { x1: 300, x5: 1300, x10: 2400 };

export const SLOT_META = {
  eyes:  { label:'Mắt',        icon:'👁️' },
  head:  { label:'Đầu / Tóc',  icon:'💇' },
  shirt: { label:'Áo',         icon:'👕' },
  pants: { label:'Quần',       icon:'👖' },
  deco:  { label:'Phụ kiện',   icon:'✨' },
};

const LAYER_ORDER = ['pants','shirt','eyes','head','deco'];

// Helpers
function allItems() { return Object.values(OUTFIT_CATALOG).flat(); }
export function findInSlot(slot, id) { return (OUTFIT_CATALOG[slot]||[]).find(i=>i.id===id)||null; }
export function getTierById(id) {
  const item = allItems().find(i => i.id === id);
  if (!item) return ITEM_TIERS.NUB;
  return Object.values(ITEM_TIERS).find(t => t.id === item.tier) || ITEM_TIERS.NUB;
}

// State
export let state = {
  equipped: { eyes:'E1_01', head:'H1_01', shirt:'S1_01', pants:'P1_01', deco:'D1_01' },
  owned: ['E1_01','H1_01','S1_01','P1_01','D1_01'],
};
let unsub = null;

function ensureFreeOwned() {
  allItems().filter(i=>i.source==='free').forEach(i => {
    if (!state.owned.includes(i.id)) state.owned.push(i.id);
  });
}

// ── Callback để UI cập nhật ─────────────────────────────
function notifyUI() {
  if (window._charUIUpdate) window._charUIUpdate();
}

export function initCharacterSystem() {
  onAuthStateChanged(auth, user => {
    if (!user) return;
    if (unsub) unsub();
    unsub = onSnapshot(doc(db,'users',user.uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.character?.equipped) state.equipped = { ...state.equipped, ...d.character.equipped };
      if (d.outfitOwned?.length) state.owned = d.outfitOwned;
      else ensureFreeOwned();
      renderProfilePreview();
      notifyUI(); // ← Báo cho character-ui.js
    });
  });
}

export async function saveEquipped(newEquipped) {
  const user = auth.currentUser; if (!user) throw new Error('Chưa đăng nhập');
  state.equipped = { ...newEquipped };
  await updateDoc(doc(db,'users',user.uid), { 'character.equipped': state.equipped });
  renderProfilePreview();
  notifyUI();
}

export async function buyItem(item) {
  const user = auth.currentUser; if (!user) throw new Error('Chưa đăng nhập');
  const ref = doc(db,'users',user.uid);
  await runTransaction(db, async tx => {
    const s = await tx.get(ref);
    const pts = s.data()?.points || 0;
    if (pts < item.price) throw new Error(`Không đủ điểm (cần ${item.price}⭐)`);
    tx.update(ref, { points: pts - item.price, outfitOwned: arrayUnion(item.id) });
  });
}

export async function gachaRoll(rolls) {
  const key = rolls===1?'x1':rolls===5?'x5':'x10';
  const price = GACHA_PRICE[key];
  const user = auth.currentUser; if (!user) throw new Error('Chưa đăng nhập');
  const ref = doc(db,'users',user.uid);
  await runTransaction(db, async tx => {
    const s = await tx.get(ref);
    const pts = s.data()?.points || 0;
    if (pts < price) throw new Error(`Không đủ điểm! Cần ${price}⭐`);
    tx.update(ref, { points: pts - price });
  });

  const results = [];
  const newOwned = [];
  for (let i=0; i<rolls; i++) {
    const item = GACHA_POOL[Math.floor(Math.random()*GACHA_POOL.length)];
    results.push(item);
    if (!state.owned.includes(item.id)) {
      state.owned.push(item.id);
      newOwned.push(item.id);
    }
  }
  if (newOwned.length) {
    await updateDoc(doc(db,'users',user.uid), { outfitOwned: arrayUnion(...newOwned) });
  }
  return results;
}

// Render chibi (dùng ảnh)
export function renderChibiTo(container, equipped) {
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';

  // Fallback nếu container trống sau khi render
  setTimeout(() => {
    if (container.children.length === 0) {
      container.innerHTML = `
        <div class="preview-placeholder">
          <span>👤</span>
          Nhấn chọn đồ bên dưới
        </div>`;
    }
  }, 500);

  function addLayer(src, zIndex) {
    if (!src) return;
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;z-index:${zIndex};pointer-events:none;`;
    img.onerror = () => img.remove();
    container.appendChild(img);
  }

  addLayer('assets/character/body/base.png', 0);

  LAYER_ORDER.forEach((slot, zi) => {
    const id = equipped[slot];
    if (!id) return;
    const item = findInSlot(slot, id);
    if (item) {
      const imgPath = `assets/character/${slot}/${id}.png`;
      addLayer(imgPath, zi+1);
    }
  });
  container.classList.add('chibi-bounce');
}

function renderProfilePreview() {
  const frame = document.getElementById('pro-character-frame');
  if (!frame) return;
  renderChibiTo(frame, state.equipped);
}

// Auto init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCharacterSystem());
} else {
  initCharacterSystem();
}