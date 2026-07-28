// bag.js – Túi đồ: Pet, Vật phẩm
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { subscribeUserData } from '../points.js';
import { getPetById, disassemblePet, redeemShard,
  PET_POOL, SHARD_COST
} from '../pet.js';
import { getOwnedTitles, getTitleById } from '../titles.js';

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
let allPets = [];
let shardsTotal = 0;

const RARITY_COLOR = {1:'#94a3b8',2:'#34d399',3:'#38bdf8',4:'#f43f5e',5:'#fbbf24'};
const TIER_NAME  = {1:'Gà mờ',2:'Tinh anh',3:'Bá sàn',4:'Kiệt tác',5:'Huyền thoại'};

let myOwnedTitles = [], myActiveTitleIds = [], myPoints = 0, myFriendsCount = 0;

// ── HELPERS cho activeTitle (JSON array trong 1 field) ──
function parseActiveTitles(val) {
  if (!val) return [null, null];
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); if (Array.isArray(p)) return [p[0]||null, p[1]||null]; } catch {}
    return [val, null]; // legacy: single string
  }
  return [null, null];
}
function makeActiveTitlesStr(id1, id2) {
  const arr = [id1, id2].filter(Boolean);
  return arr.length ? JSON.stringify(arr) : null;
}

// ── AUTH + SYNC ──────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;

  subscribeUserData(d => {
    if (!d) return;

    // Điểm top-nav
    if (window.TopNav?.setPoints) TopNav.setPoints(d.points || 0);

    shardsTotal = d.shards || 0;
    renderShardBar();

    // Pet
    const col = d.petCollection || {};
    allPets = Object.entries(col).map(([id, qty]) => {
      const pet = getPetById(id);
      if (!pet || qty <= 0) return null;
      return { id, qty, name: pet.name, emoji: pet.emoji || '🐾', images: pet.images || [], tier: pet.tier, color: RARITY_COLOR[pet.tier] };
    }).filter(Boolean).sort((a, b) => b.tier - a.tier);
    renderBag();

    // Danh hiệu
    myPoints = d.points || 0;
    myFriendsCount = (d.friends || []).length;
    const petCol = d.petCollection || {};
    const petCount = Object.values(petCol).reduce((sum, q) => sum + (q || 0), 0);
    const streak = d.streak || {};
    const ownedShopIds = d.ownedTitles || [];
    const us = d.stats || {};
    const stats = {
      points: myPoints,
      friends: myFriendsCount,
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
    myOwnedTitles = getOwnedTitles(stats, ownedShopIds);
    const [t1, t2] = parseActiveTitles(d.activeTitle);
    myActiveTitleIds = [t1, t2];
    renderTitles();
  });
});

// ── PET ──────────────────────────────────────────────────
function renderShardBar() {
  const bar = document.getElementById('bag-shard-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div onclick="window.openShardSheet()" style="cursor:pointer;text-align:center;padding:12px 20px;border-radius:12px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);margin-bottom:12px;">
      <div style="color:#a78bfa;font-size:12px;font-weight:700;">🧩 Mảnh Pet</div>
      <div style="color:#e0f2fe;font-size:26px;font-weight:900;">${shardsTotal}</div>
      <div style="color:#a78bfa;font-size:11px;">Nhấn để đổi pet ✨</div>
    </div>`;
}

function renderBag() {
  const grid = document.getElementById('bag-grid');
  if (!grid) return;
  if (!allPets.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:#4a7a9b;text-align:center;padding:40px">Túi trống. Hãy gacha!</div>';
    return;
  }
  grid.innerHTML = allPets.map(p => {
    const thumb = p.images?.[0] || '';
    return `
    <div class="pet-card tier-${p.tier}">
      <div class="pet-card-tier">${TIER_NAME[p.tier] || ''}</div>
      <div class="pet-card-img-wrap">
        ${thumb
          ? `<img src="${thumb}" alt="${p.name}" class="pet-card-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span class="pet-card-emoji-fb" style="display:none;font-size:36px;line-height:1">${p.emoji}</span>`
          : `<span class="pet-card-emoji">${p.emoji}</span>`}
      </div>
      <div class="pet-card-name">${p.name}</div>
      <div class="pet-card-qty">×${p.qty}</div>
      ${p.qty > 1 ? `<button class="pet-card-btn" onclick="window.doDisassemble('${p.id}')">Phân rã</button>` : ''}
    </div>`;
  }).join('');
}
// expose để HTML tab switch gọi
window._bagRenderBag = renderBag;

window.doDisassemble = async (petId) => {
  const qty = parseInt(prompt('Nhập số lượng muốn phân rã:', '1'));
  if (isNaN(qty) || qty < 1) return;
  try {
    const result = await disassemblePet(petId, qty);
    alert(`✅ Nhận ${result.shardGain} mảnh pet!`);
  } catch(e) { alert('❌ ' + e.message); }
};

// ── ĐỔI PET ──────────────────────────────────────────────
window.openShardSheet = () => {
  const modal = document.getElementById('petRedeemModal');
  if (!modal) return;
  modal.classList.add('open');
  renderPetRedeemList();
};

function renderPetRedeemList() {
  const list = document.getElementById('petRedeemList');
  if (!list) return;
  const owned = allPets.reduce((acc, p) => { acc[p.id] = p.qty; return acc; }, {});
  list.innerHTML = PET_POOL.map(pet => {
    const cost = SHARD_COST[pet.tier] || 1;
    const has  = owned[pet.id] || 0;
    const thumb = pet.images?.[0] || '';
    return `
      <div class="shop-card" style="border-color:${RARITY_COLOR[pet.tier]}55">
        <div class="shop-card-icon">
          ${thumb
            ? `<img src="${thumb}" alt="${pet.name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span style="font-size:28px;display:none">${pet.emoji||'🐾'}</span>`
            : `<span style="font-size:28px">${pet.emoji||'🐾'}</span>`}
        </div>
        <div class="shop-card-name">${pet.name}</div>
        <div style="color:#fbbf24;font-weight:700;">🧩 ${cost}</div>
        <button class="shop-btn" style="background:#a78bfa;margin-top:4px;" ${has ? 'disabled' : ''} onclick="window.doRedeemPet('${pet.id}')">${has ? 'Đã có' : 'Đổi'}</button>
      </div>`;
  }).join('');
}

window.doRedeemPet = async (petId) => {
  try {
    await redeemShard(petId);
    alert('✅ Đổi pet thành công!');
    document.getElementById('petRedeemModal').classList.remove('open');
  } catch(e) { alert('❌ ' + e.message); }
};



// ── DANH HIỆU ────────────────────────────────────────────
function renderTitles() {
  const grid = document.getElementById('title-grid');
  if (!grid) return;
  if (!myOwnedTitles.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#4a7a9b;">🏅 Bạn chưa có danh hiệu nào.<br>Hãy ra Shop mua hoặc đạt điểm/bạn bè!</div>';
    return;
  }
  const [a1, a2] = myActiveTitleIds;
  const hasAny = a1 || a2;
  grid.innerHTML = (hasAny ? `
    <div style="grid-column:1/-1;display:flex;gap:8px;margin-bottom:4px">
      <div style="flex:1;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.15)">
        <span style="width:20px;height:20px;border-radius:6px;background:#38bdf8;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:900;flex-shrink:0">1</span>
        <span style="color:${a1 ? '#e0f2fe' : '#64748b'};font-size:13px;font-weight:700">${a1 ? 'Đã chọn' : 'Trống'}</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.15)">
        <span style="width:20px;height:20px;border-radius:6px;background:#a78bfa;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:900;flex-shrink:0">2</span>
        <span style="color:${a2 ? '#e0f2fe' : '#64748b'};font-size:13px;font-weight:700">${a2 ? 'Đã chọn' : 'Trống'}</span>
      </div>
    </div>
  ` : '') + myOwnedTitles.map(t => {
    const isSlot1 = t.id === a1;
    const isSlot2 = t.id === a2;
    const slot = isSlot1 ? 1 : (isSlot2 ? 2 : 0);
    const slotColor = slot === 1 ? '#38bdf8' : slot === 2 ? '#a78bfa' : null;
    return `
      <div class="shop-card" style="cursor:default">
        <div class="shop-card-info" style="flex:1">
          <span class="title-badge ${t.cls}">${t.label}</span>
          <div class="shop-card-desc" style="margin-top:6px">${t.desc || ''}</div>
        </div>
        <div class="title-card-right">
          ${slot > 0
            ? `<button class="title-buy-btn active-now" onclick="window.clearTitleSlot(${slot})" style="color:${slotColor};">
                 <span style="display:inline-flex;align-items:center;gap:4px">
                   <span style="width:18px;height:18px;border-radius:5px;background:${slotColor};display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:900">${slot}</span>
                   ✓ Đang dùng
                 </span>
               </button>`
            : `<button class="title-buy-btn" onclick="window.setActiveTitle('${t.id}')">
                 <span style="display:inline-flex;align-items:center;gap:4px">
                   ${!a1
                     ? '<span style="width:18px;height:18px;border-radius:5px;border:1.5px solid #38bdf8;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#38bdf8;font-weight:900">1</span> Dùng'
                     : !a2
                       ? '<span style="width:18px;height:18px;border-radius:5px;border:1.5px solid #a78bfa;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#a78bfa;font-weight:900">2</span> Dùng'
                       : '🔄 Thay thế'}
                 </span>
               </button>`}
        </div>
      </div>`;
  }).join('');
}
window._bagRenderTitles = renderTitles;

window.setActiveTitle = async (id) => {
  try {
    const [a1, a2] = myActiveTitleIds;
    let n1 = a1, n2 = a2;
    if (!a1)      { n1 = id; }
    else if (!a2) { n2 = id; }
    else          { n1 = id; } // thay slot 1
    await updateDoc(doc(db, 'users', currentUser.uid), {
      activeTitle: makeActiveTitlesStr(n1, n2)
    });
  } catch (e) { alert('❌ ' + e.message); }
};

window.clearTitleSlot = async (slot) => {
  try {
    const [a1, a2] = myActiveTitleIds;
    const n1 = slot === 1 ? null : a1;
    const n2 = slot === 2 ? null : a2;
    await updateDoc(doc(db, 'users', currentUser.uid), {
      activeTitle: makeActiveTitlesStr(n1, n2)
    });
  } catch (e) { alert('❌ ' + e.message); }
};

window.clearActiveTitle = async () => {
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { activeTitle: null });
  } catch (e) { alert('❌ ' + e.message); }
};
