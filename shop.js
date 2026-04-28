// shop.js — Cửa hàng (Gacha Thú Cưng & Trang Phục bằng điểm)
import { db, auth } from './points.js';
import { doc, runTransaction, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doGacha } from './pet.js';
import { gachaMultiple } from './character.js';

const TIER_COLOR = { 1:'#94a3b8', 2:'#34d399', 3:'#fbbf24', 4:'#f43f5e', 5:'#a78bfa' };
const TIER_NAME  = { 1:'Gà mờ', 2:'Tinh anh', 3:'Bá sàn', 4:'Kiệt tác', 5:'Huyền thoại' };

// ── DATA ──────────────────────────────────────────────────
const petGacha = [
  { id:'pg_x1', name:'Gacha Thường x1', icon:'🐣', type:'normal', qty:1, price:100 },
  { id:'pg_x5', name:'Gacha Thường x5', icon:'🐣', type:'normal', qty:5, price:450 },
  { id:'pg_x10', name:'Gacha Thường x10', icon:'🐣', type:'normal', qty:10, price:850 },
  { id:'pg_vip_x1', name:'Gacha VIP x1', icon:'🦄', type:'vip', qty:1, price:500 },
  { id:'pg_vip_x5', name:'Gacha VIP x5', icon:'🦄', type:'vip', qty:5, price:2200 },
  { id:'pg_vip_x10', name:'Gacha VIP x10', icon:'🦄', type:'vip', qty:10, price:4000 },
];

const outfitGacha = [
  { id:'og_x1', name:'Gacha Real x1', icon:'🧑', system:'real', qty:1, price:300 },
  { id:'og_x5', name:'Gacha Real x5', icon:'🧑', system:'real', qty:5, price:1300 },
  { id:'og_x10', name:'Gacha Real x10', icon:'🧑', system:'real', qty:10, price:2400 },
  { id:'og_fims_x1', name:'Gacha Fims x1', icon:'🎬', system:'fims', qty:1, price:300 },
  { id:'og_fims_x5', name:'Gacha Fims x5', icon:'🎬', system:'fims', qty:5, price:1300 },
  { id:'og_fims_x10', name:'Gacha Fims x10', icon:'🎬', system:'fims', qty:10, price:2400 },
];

// ── ROLL PET GACHA TRỰC TIẾP (dùng điểm) ──────────────────
async function rollPetGachaDirect(qty, price, type = 'normal') {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  const userRef = doc(db, 'users', user.uid);

  // Trừ điểm
  await runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('Không tìm thấy tài khoản');
    const data = snap.data();
    const pts = data.points || 0;
    if (pts < price) throw new Error(`Không đủ điểm! Cần ${price}⭐`);
    tx.update(userRef, { points: pts - price });
  });

  // Gacha
  const results = await doGacha(qty, type);
  return results;
}

// ── ROLL OUTFIT GACHA (dùng gachaMultiple) ─────────────────
async function rollOutfitGacha(system, qty, price) {
  const results = await gachaMultiple(system, qty, price);
  return results;
}

// ── HIỂN THỊ KẾT QUẢ ──────────────────────────────────────
function showResult(results, type = 'pet') {
  const grid = document.getElementById('resultGrid');
  if (!grid) return;
  grid.innerHTML = results.map(r => {
    if (type === 'outfit') {
      return `
        <div class="result-card" style="border-color:#38bdf8">
          <div class="emoji">👕</div>
          <div class="name">${r.name}</div>
          <div class="tier" style="color:#38bdf8">Trang phục</div>
        </div>`;
    } else {
      const tier = r.tier || { id: 1 };
      const color = TIER_COLOR[tier.id] || '#94a3b8';
      return `
        <div class="result-card" style="border-color:${color}">
          <div class="emoji">${r.emoji||'🐾'}</div>
          <div class="name">${r.name}</div>
          <div class="tier" style="color:${color}">${TIER_NAME[tier.id]||'Thường'}</div>
        </div>`;
    }
  }).join('');
  document.getElementById('resultOverlay').classList.add('active');
}

// ── RENDER ────────────────────────────────────────────────
let activeTab = 'pets';

function render() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;

  if (activeTab === 'pets') {
    grid.innerHTML = petGacha.map(p => `
      <div class="shop-card" data-action="rollPetGacha" data-qty="${p.qty}" data-price="${p.price}" data-type="${p.type}">
        <span class="shop-card-emoji">${p.icon}</span>
        <span class="shop-card-name">${p.name}</span>
        <span class="shop-card-price">${p.price} ⭐</span>
        ${p.type === 'vip' ? '<span class="shop-card-badge badge-vip">VIP</span>' : ''}
      </div>`).join('');
  } else if (activeTab === 'outfits') {
    grid.innerHTML = outfitGacha.map(o => `
      <div class="shop-card" data-action="rollOutfitGacha" data-system="${o.system}" data-qty="${o.qty}" data-price="${o.price}">
        <span class="shop-card-emoji">${o.icon}</span>
        <span class="shop-card-name">${o.name}</span>
        <span class="shop-card-price">${o.price} ⭐</span>
      </div>`).join('');
  }

  bindCardEvents();
}

function bindCardEvents() {
  document.querySelectorAll('.shop-card').forEach(card => {
    card.addEventListener('click', async () => {
      const action = card.dataset.action;
      try {
        if (action === 'rollPetGacha') {
          const qty = parseInt(card.dataset.qty);
          const price = parseInt(card.dataset.price);
          const type = card.dataset.type || 'normal';
          const results = await rollPetGachaDirect(qty, price, type);
          showResult(results, 'pet');
        } else if (action === 'rollOutfitGacha') {
          const system = card.dataset.system || 'real';
          const qty = parseInt(card.dataset.qty);
          const price = parseInt(card.dataset.price);
          const results = await rollOutfitGacha(system, qty, price);
          showResult(results, 'outfit');
        }
      } catch(e) {
        alert('❌ ' + e.message);
      }
    });
  });
}

// ── TABS ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  render();
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      render();
    });
  });

  // Cập nhật điểm trên nav
  onAuthStateChanged(auth, user => {
    if (!user) { location.href = 'index.html'; return; }
    onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) {
        const pts = snap.data().points || 0;
        const el = document.getElementById('nav-shop-points');
        if (el) el.textContent = pts.toLocaleString('vi-VN');
      }
    });
  });
});