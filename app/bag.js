// bag.js – Túi đồ: Pet, Vật phẩm
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getPetById, disassemblePet, redeemShard,
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
let allPets = [], filteredPets = [];
let shardsTotal = 0, characterShards = 0;

const ITEMS_DB = {
  'mystery_box': { name: 'Hộp bí ẩn',    emoji: '📦', desc: 'Mở ngẫu nhiên',    convertShard: 2 },
  'charm_buff':  { name: 'Bùa may mắn',   emoji: '🍀', desc: 'Tăng tỷ lệ hiếm', convertShard: 1 }
};

const RARITY_COLOR = {1:'#94a3b8',2:'#34d399',3:'#fbbf24',4:'#f43f5e',5:'#a78bfa'};

let allItems = [], filteredItems = [];
let myOwnedTitles = [], myActiveTitleId = null, myPoints = 0, myFriendsCount = 0;

// ── AUTH + SYNC ──────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;

  onSnapshot(doc(db, 'users', user.uid), snap => {
    if (!snap.exists()) return;
    const d = snap.data();

    // Điểm top-nav
    if (window.TopNav?.setPoints) TopNav.setPoints(d.points || 0);

    shardsTotal    = d.shards || 0;
    characterShards = d.characterShards || 0;

    renderShardBar();
    renderOutfitShardBar();

    // Pet
    const col = d.petCollection || {};
    allPets = Object.entries(col).map(([id, qty]) => {
      const pet = getPetById(id);
      if (!pet || qty <= 0) return null;
      return { id, qty, name: pet.name, emoji: pet.emoji || '🐾', images: pet.images || [], tier: pet.tier, color: RARITY_COLOR[pet.tier] };
    }).filter(Boolean);
    filteredPets = [...allPets];
    renderBag();

    // Item
    const itemCol = d.itemCollection || {};
    allItems = Object.entries(itemCol).map(([id, qty]) => {
      const info = ITEMS_DB[id];
      if (!info || qty <= 0) return null;
      return { id, qty, ...info };
    }).filter(Boolean);
    filteredItems = [...allItems];
    renderItems();
    updateItemStats();

    // Danh hiệu
    myPoints = d.points || 0;
    myFriendsCount = (d.friends || []).length;
    myOwnedTitles = getOwnedTitles({ points: myPoints, friends: myFriendsCount }, d.ownedTitles || []);
    myActiveTitleId = d.activeTitle || null;
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
  if (!filteredPets.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:#4a7a9b;text-align:center;padding:40px">Túi trống. Hãy gacha!</div>';
    return;
  }
  grid.innerHTML = filteredPets.map(p => {
    const thumb = p.images?.[0] || '';
    return `
    <div class="shop-card" style="border-color:${p.color}55">
      <div class="shop-card-icon">
        ${thumb
          ? `<img src="${thumb}" alt="${p.name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/><span style="font-size:28px;display:none">${p.emoji}</span>`
          : `<span style="font-size:28px">${p.emoji}</span>`}
      </div>
      <div class="shop-card-name">${p.name}</div>
      <div class="shop-card-rarity" style="color:${p.color}">x${p.qty}</div>
      <div class="bag-actions" style="margin-top:8px">
        ${p.qty > 1 ? `<button class="shop-btn disassemble" onclick="window.doDisassemble('${p.id}')">Phân rã</button>` : ''}
      </div>
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

// ── OUTFIT SHARD BAR ─────────────────────────────────────
function renderOutfitShardBar() {
  const bar = document.getElementById('outfit-shard-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div onclick="window.openOutfitShardSheet()" style="cursor:pointer;text-align:center;padding:12px 20px;border-radius:12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);margin-bottom:12px;">
      <div style="color:#fbbf24;font-size:12px;font-weight:700;">🧩 Mảnh Nhân Vật</div>
      <div style="color:#e0f2fe;font-size:26px;font-weight:900;">${characterShards}</div>
      <div style="color:#fbbf24;font-size:11px;">Nhấn để đổi trang bị ✨</div>
    </div>`;
}

window.openOutfitShardSheet = () => {
  document.getElementById('outfitRedeemModal')?.classList.add('open');
};

// ── ITEM ─────────────────────────────────────────────────
function renderItems() {
  const grid = document.getElementById('item-grid');
  if (!grid) return;
  if (!filteredItems.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#4a7a9b;">📭 Chưa có vật phẩm</div>';
    return;
  }
  grid.innerHTML = filteredItems.map(item => `
    <div class="shop-card">
      <div class="shop-card-icon">${item.emoji}</div>
      <div class="shop-card-name">${item.name}</div>
      <div class="shop-card-rarity">x${item.qty}</div>
      <div class="shop-card-desc">${item.desc}</div>
      <div class="bag-actions" style="margin-top:8px">
        ${item.convertShard ? `<button class="shop-btn" onclick="window.convertToCharShard('${item.id}')" style="background:#a78bfa">🔄 Đổi ${item.convertShard} mảnh NV</button>` : ''}
      </div>
    </div>`).join('');
}
window._bagRenderItems = renderItems;

function updateItemStats() {
  const total = allItems.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('item-stats');
  if (el) el.innerHTML = `<span>📦 Tổng: ${total}</span>`;
}

window.convertToCharShard = async (itemId) => {
  const item = allItems.find(i => i.id === itemId);
  if (!item || item.qty < 1) return alert('Không có vật phẩm!');
  const qty = parseInt(prompt(`Nhập số lượng ${item.name} muốn đổi (mỗi cái +${item.convertShard} mảnh NV):`, '1'));
  if (isNaN(qty) || qty < 1 || qty > item.qty) return;
  const gain = qty * item.convertShard;
  if (!confirm(`Đổi ${qty} ${item.name} lấy ${gain} 🧩 mảnh nhân vật?`)) return;
  await updateDoc(doc(db, 'users', currentUser.uid), {
    [`itemCollection.${itemId}`]: item.qty - qty > 0 ? item.qty - qty : 0,
    characterShards: characterShards + gain
  });
  alert(`✅ Nhận ${gain} mảnh nhân vật!`);
};

// ── DANH HIỆU ────────────────────────────────────────────
function renderTitles() {
  const grid = document.getElementById('title-grid');
  if (!grid) return;
  if (!myOwnedTitles.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#4a7a9b;">🏅 Bạn chưa có danh hiệu nào.<br>Hãy ra Shop mua hoặc đạt điểm/bạn bè!</div>';
    return;
  }
  grid.innerHTML = myOwnedTitles.map(t => {
    const isActive = t.id === myActiveTitleId;
    return `
      <div class="shop-card" style="cursor:default">
        <div class="shop-card-info" style="flex:1">
          <span class="title-badge ${t.cls}">${t.label}</span>
          <div class="shop-card-desc" style="margin-top:6px">${t.desc || ''}</div>
        </div>
        <div class="title-card-right">
          <button class="title-buy-btn ${isActive ? 'active-now' : ''}" onclick="window.setActiveTitle('${t.id}')" ${isActive ? 'disabled' : ''}>
            ${isActive ? '✓ Đang dùng' : 'Dùng danh hiệu này'}
          </button>
        </div>
      </div>`;
  }).join('');
}
window._bagRenderTitles = renderTitles;

window.setActiveTitle = async (id) => {
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { activeTitle: id });
  } catch (e) { alert('❌ ' + e.message); }
};

window.clearActiveTitle = async () => {
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { activeTitle: null });
  } catch (e) { alert('❌ ' + e.message); }
};
