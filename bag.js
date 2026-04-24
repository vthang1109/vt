// bag.js – viết lại sạch toàn bộ
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getPetById, getTierById, disassemblePet, redeemShard,
  SHARD_COST, SHARD_DROP, PET_POOL
} from './pet.js';

const firebaseConfig = {
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",
  storageBucket:"lienquan-fake.appspot.com",
  messagingSenderId:"782694799992",
  appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let allPets     = [];   // pet đang sở hữu
let filteredPets= [];
let shardsTotal = 0;    // tổng mảnh (1 con số)

const RARITY_KEY   = { 1:'Gà mờ', 2:'Tinh anh', 3:'Bá sàn', 4:'Kiệt tác', 5:'Huyền thoại' };
const RARITY_CSS   = { 1:'common', 2:'rare', 3:'epic', 4:'legendary', 5:'mythic' };
const RARITY_COLOR = { 1:'#94a3b8', 2:'#34d399', 3:'#fbbf24', 4:'#f43f5e', 5:'#a78bfa' };

// ── AUTH + REALTIME SYNC ──────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;

  onSnapshot(doc(db, 'users', user.uid), snap => {
    if (!snap.exists()) return;
    const d = snap.data();

    // nav ticket count
    const navT = document.getElementById('nav-tickets');
    if (navT) navT.textContent = (d.tickets_normal||0) + (d.tickets_vip||0);

    shardsTotal = d.shards || 0;

    // render ô mảnh — click mở sheet
    let shardBar = document.getElementById('bag-shard-bar');
    if (!shardBar) {
      shardBar = document.createElement('div');
      shardBar.id = 'bag-shard-bar';
      shardBar.style.cssText = 'padding:12px 16px;margin-bottom:16px';
      document.querySelector('.bag-wrap')?.insertBefore(shardBar, document.querySelector('.bag-filters'));
    }
    shardBar.innerHTML = `
      <div onclick="window.openShardSheet()"
           style="cursor:pointer;text-align:center;padding:12px 20px;border-radius:12px;
                  background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);
                  transition:background .2s"
           onmouseover="this.style.background='rgba(167,139,250,0.18)'"
           onmouseout="this.style.background='rgba(167,139,250,0.08)'">
        <div style="color:#a78bfa;font-size:12px;font-weight:700;margin-bottom:4px">🧩 Mảnh Pet</div>
        <div style="color:#e0f2fe;font-size:26px;font-weight:900;font-family:'Orbitron',monospace">${shardsTotal}</div>
        <div style="color:#a78bfa;font-size:11px;margin-top:4px">Nhấn để đổi mảnh lấy pet ✨</div>
      </div>`;

    // build owned list
    const col = d.petCollection || {};
    allPets = Object.entries(col).map(([id, qty]) => {
      const pet = getPetById(id);
      if (!pet) return null;
      return {
        id, qty,
        name: pet.name, emoji: pet.emoji || '🐾',
        tier: pet.tier,
        rarity:    RARITY_KEY[pet.tier],
        rarityCss: RARITY_CSS[pet.tier],
        color:     RARITY_COLOR[pet.tier],
      };
    }).filter(Boolean);

    filteredPets = allPets;
    renderBag();
    updateStats();
  });
});

// ── RENDER BAG (chỉ pet đang sở hữu, không có nút đổi) ───
function renderBag() {
  const grid = document.getElementById('bag-grid');
  if (!grid) return;
  if (!filteredPets.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:#4a7a9b;text-align:center;padding:40px">Túi trống. Hãy gacha! 🎰</div>';
    return;
  }
  grid.innerHTML = filteredPets.map(p => `
    <div class="bag-pet-card rarity-${p.rarityCss}" style="border-color:${p.color}55">
      <div class="pet-emoji">${p.emoji}</div>
      <div class="pet-name">${p.name}</div>
      <div class="pet-rarity" style="color:${p.color}">${p.rarity}</div>
      <div class="pet-qty">x${p.qty}</div>
      <div class="bag-actions">
        ${p.qty > 1
          ? `<button class="bag-btn disassemble" onclick="window.doDisassemble('${p.id}')">Phân rã</button>`
          : ''}
      </div>
    </div>`).join('');
}

function updateStats() {
  const stats = { all:0, common:0, rare:0, epic:0, legendary:0, mythic:0 };
  allPets.forEach(p => {
    stats.all += p.qty;
    if (stats[p.rarityCss] !== undefined) stats[p.rarityCss] += p.qty;
  });
  ['bag-total','bag-common','bag-rare','bag-epic','bag-legendary','bag-mythic']
    .forEach((id,i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = stats[['all','common','rare','epic','legendary','mythic'][i]];
    });
}

// ── PHÂN RÃ ──────────────────────────────────────────────
window.doDisassemble = async petId => {
  const pet = allPets.find(p => p.id === petId);
  if (!pet || pet.qty < 2) return alert('Cần ít nhất 2 con để phân rã!');
  const qty = parseInt(prompt(`Phân rã bao nhiêu con ${pet.name}? (có ${pet.qty}, giữ ít nhất 1)`));
  if (!qty || qty < 1) return;
  if (qty >= pet.qty) return alert('Phải giữ lại ít nhất 1 con!');
  try {
    await disassemblePet(petId, qty);
    alert(`✅ +${SHARD_DROP[pet.tier] * qty} mảnh 🧩`);
  } catch(e) { alert('❌ ' + e.message); }
};

// ── SHARD SHEET ───────────────────────────────────────────
window.openShardSheet = function() {
  let overlay = document.getElementById('shardSheetOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shardSheetOverlay';
    overlay.style.cssText = `position:fixed;inset:0;z-index:2000;
      background:rgba(2,8,20,0.88);backdrop-filter:blur(8px);
      display:flex;align-items:flex-end;justify-content:center;
      opacity:0;pointer-events:none;transition:opacity .25s`;
    overlay.onclick = e => { if (e.target === overlay) window.closeShardSheet(); };
    document.body.appendChild(overlay);
  }

  const ownedIds = new Set(allPets.map(p => p.id));

  // Nhóm pet theo tier, tier thấp trước
  const rows = PET_POOL.map(pet => {
    const cost      = SHARD_COST[pet.tier];
    const canRedeem = shardsTotal >= cost;
    const owned     = ownedIds.has(pet.id);
    const color     = RARITY_COLOR[pet.tier];
    const tierName  = RARITY_KEY[pet.tier];
    const qty       = allPets.find(p => p.id === pet.id)?.qty || 0;

    return `
    <div style="display:flex;align-items:center;gap:12px;padding:11px 0;
                border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:28px;width:40px;text-align:center;
                   ${!owned ? 'filter:grayscale(1);opacity:.35' : ''}">${pet.emoji}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:${owned ? '#e0f2fe' : '#64748b'}">
          ${pet.name}
          ${owned ? `<span style="font-size:9px;color:#34d399;background:rgba(52,211,153,0.12);
                       padding:1px 6px;border-radius:999px;margin-left:4px">x${qty}</span>` : ''}
        </div>
        <div style="font-size:11px;font-weight:700;color:${color};margin-top:1px">${tierName}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;min-width:80px">
        <div style="font-size:11px;font-weight:700;color:${canRedeem ? '#34d399' : '#4a7a9b'}">
          🧩 ${shardsTotal}/${cost}
        </div>
        ${canRedeem
          ? `<button onclick="window.doRedeem('${pet.id}')"
               style="margin-top:5px;padding:5px 12px;border-radius:8px;
                      background:linear-gradient(135deg,#a78bfa,#7c3aed);
                      border:none;color:#fff;font-size:11px;font-weight:800;
                      cursor:pointer;font-family:'Nunito',sans-serif">
               ${owned ? 'Đổi thêm' : 'Đổi ✨'}
             </button>`
          : `<span style="font-size:10px;color:#4a7a9b;display:block;margin-top:5px">
               Thiếu ${cost - shardsTotal} 🧩
             </span>`}
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `
  <div id="shardSheetInner"
       style="width:100%;max-width:480px;max-height:88dvh;
              background:rgba(8,18,36,0.98);
              border:1px solid rgba(167,139,250,0.2);
              border-radius:24px 24px 0 0;
              display:flex;flex-direction:column;overflow:hidden;
              transform:translateY(100%);
              transition:transform .3s cubic-bezier(.32,1.2,.48,1)">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:16px 18px 12px;border-bottom:1px solid rgba(167,139,250,0.12);
                flex-shrink:0">
      <div>
        <span style="font-family:'Orbitron',monospace;font-size:15px;font-weight:900;color:#a78bfa">
          🧩 Đổi Mảnh Lấy Pet
        </span>
        <span style="margin-left:10px;font-size:12px;color:#fbbf24;font-weight:700">
          Có: ${shardsTotal} mảnh
        </span>
      </div>
      <button onclick="window.closeShardSheet()"
              style="background:none;border:none;color:#4a7a9b;font-size:20px;cursor:pointer;padding:0">✕</button>
    </div>
    <!-- List -->
    <div style="overflow-y:auto;padding:0 16px 28px;flex:1">${rows}</div>
  </div>`;

  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => {
    document.getElementById('shardSheetInner').style.transform = 'translateY(0)';
  });
};

window.closeShardSheet = function() {
  const overlay = document.getElementById('shardSheetOverlay');
  if (!overlay) return;
  const inner = document.getElementById('shardSheetInner');
  if (inner) inner.style.transform = 'translateY(100%)';
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
};

window.doRedeem = async petId => {
  const pet  = getPetById(petId);
  if (!pet) return;
  const cost = SHARD_COST[pet.tier];
  if (shardsTotal < cost) return alert(`Cần ${cost} mảnh, hiện có ${shardsTotal}`);
  if (!confirm(`Dùng ${cost} 🧩 mảnh đổi lấy ${pet.emoji} ${pet.name}?`)) return;
  try {
    const res = await redeemShard(petId);
    window.closeShardSheet();
    alert(`✅ Đã nhận ${pet.emoji} ${pet.name}! Còn ${res.shardsLeft} mảnh 🧩`);
  } catch(e) { alert('❌ ' + e.message); }
};

// ── FILTER ────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const rarity = e.target.dataset.rarity;
    filteredPets = rarity === 'all' ? allPets : allPets.filter(p => p.rarityCss === rarity);
    renderBag();
  });
});