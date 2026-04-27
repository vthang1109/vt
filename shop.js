// shop.js — Cửa hàng (Gacha Thú Cưng & Trang Phục bằng điểm)
import { db, auth } from './points.js';
import { doc, runTransaction, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { doGacha } from './pet.js';
import { gachaRoll } from './character.js';

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
  { id:'og_x1', name:'Gacha Trang Phục x1', icon:'👕', qty:1, price:300 },
  { id:'og_x5', name:'Gacha Trang Phục x5', icon:'👕', qty:5, price:1300 },
  { id:'og_x10', name:'Gacha Trang Phục x10', icon:'👕', qty:10, price:2400 },
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

// ── ROLL OUTFIT GACHA (dùng điểm) ─────────────────────────
async function rollOutfitGacha(qty, price, system = 'real') {
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
  const results = await gachaRoll(qty, system);
  return results;
}

// ── SHOW RESULT ───────────────────────────────────────────
function showResult(results, type = 'pet') {
  const grid = document.getElementById('resultGrid');
  if (!grid) return;
  grid.innerHTML = results.map(r => {
    if (type === 'outfit') {
      const color = '#38bdf8';
      return `
        <div class="result-card" style="border-color:${color}">
          <div class="emoji">👕</div>
          <div class="name">${r.name}</div>
          <div class="tier" style="color:${color}">Trang phục</div>
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
      <div class="shop-card" data-action="rollOutfitGacha" data-qty="${o.qty}" data-price="${o.price}">
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
          const qty = parseInt(card.dataset.qty);
          const price = parseInt(card.dataset.price);
          const results = await rollOutfitGacha(qty, price, 'real'); // Hoặc 'fims' nếu cần
          showResult(results, 'outfit');
        }
      } catch(e) { alert('❌ ' + e.message); }
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
});