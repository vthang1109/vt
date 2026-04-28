// bag.js – Túi đồ: Pet, Vật phẩm, Outfit (gọn gàng, không rối, đã sửa lỗi hiển thị item)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getPetById, disassemblePet, redeemShard,
  SHARD_DROP, PET_POOL, SHARD_COST
} from './pet.js';
import {
  initCharacterSystem, state, OUTFIT_CATALOG, SLOT_META,
  renderChibiTo, saveEquipped, redeemOutfitShard
} from './character.js';

const firebaseConfig = {
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",
  storageBucket:"lienquan-fake.appspot.com",
  messagingSenderId:"782694799992",
  appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;
let allPets = [], filteredPets = [];
let shardsTotal = 0;
let characterShards = 0;

const ITEMS_DB = {
  'mystery_box': { name: 'Hộp bí ẩn', emoji: '📦', desc: 'Mở ngẫu nhiên', convertShard: 2 },
  'charm_buff':  { name: 'Bùa may mắn', emoji: '🍀', desc: 'Tăng tỷ lệ hiếm', convertShard: 1 }
};

const RARITY_COLOR = {1:'#94a3b8',2:'#34d399',3:'#fbbf24',4:'#f43f5e',5:'#a78bfa'};
const RARITY_KEY = { 1:'Gà mờ',2:'Tinh anh',3:'Bá sàn',4:'Kiệt tác',5:'Huyền thoại'};

let allItems = [], filteredItems = [];

// ── AUTH + SYNC ──────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;
  initCharacterSystem();
  onSnapshot(doc(db, 'users', user.uid), snap => {
    if (!snap.exists()) return;
    const d = snap.data();

    // Hiển thị điểm
    const ptsDisplay = document.getElementById('nav-points-display');
    if (ptsDisplay) ptsDisplay.innerText = '⭐ ' + (d.points || 0).toLocaleString('vi-VN');

    shardsTotal = d.shards || 0;
    characterShards = d.characterShards || 0;

    renderShardBar();
    renderOutfitShardBar();

    // Pet collection
    const col = d.petCollection || {};
    allPets = Object.entries(col).map(([id, qty]) => {
      const pet = getPetById(id);
      if (!pet || qty <= 0) return null;
      return {
        id, qty, name: pet.name, emoji: pet.emoji || '🐾',
        tier: pet.tier, color: RARITY_COLOR[pet.tier]
      };
    }).filter(Boolean);
    filteredPets = [...allPets];
    renderBag();

    // Item collection
    const itemCol = d.itemCollection || {};
    allItems = Object.entries(itemCol).map(([id, qty]) => {
      const info = ITEMS_DB[id];
      if (!info || qty <= 0) return null;
      return { id, qty, ...info };
    }).filter(Boolean);
    filteredItems = [...allItems];
    renderItems();
    updateItemStats();

    if (document.getElementById('character-panel').classList.contains('active-panel')) {
      renderWardrobeUI();
    }
  });
});

// ── PET ──────────────────────────────────────────────────
function renderShardBar() {
  const bar = document.getElementById('bag-shard-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div onclick="window.openShardSheet()" style="cursor:pointer;text-align:center;padding:12px 20px;border-radius:12px; background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25); margin-bottom:12px;">
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
  grid.innerHTML = filteredPets.map(p => `
    <div class="bag-pet-card" style="border-color:${p.color}55">
      <div class="pet-emoji">${p.emoji}</div>
      <div class="pet-name">${p.name}</div>
      <div class="pet-qty">x${p.qty}</div>
      <div class="bag-actions">
        ${p.qty > 1 ? `<button class="bag-btn disassemble" onclick="window.doDisassemble('${p.id}')">Phân rã</button>` : ''}
      </div>
    </div>`).join('');
}

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
    const has = owned[pet.id] || 0;
    return `
      <div class="bag-pet-card" style="border-color:${RARITY_COLOR[pet.tier]}55">
        <div class="pet-emoji">${pet.emoji || '🐾'}</div>
        <div class="pet-name">${pet.name}</div>
        <div style="color:#fbbf24;font-weight:700;">🧩 ${cost}</div>
        <button class="bag-btn" style="background:#a78bfa; margin-top:4px;" ${has ? 'disabled' : ''} onclick="window.doRedeemPet('${pet.id}')">${has ? 'Đã có' : 'Đổi'}</button>
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
    <div onclick="window.openOutfitShardSheet()" style="cursor:pointer;text-align:center;padding:12px 20px;border-radius:12px; background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25); margin-bottom:12px;">
      <div style="color:#fbbf24;font-size:12px;font-weight:700;">🧩 Mảnh Nhân Vật</div>
      <div style="color:#e0f2fe;font-size:26px;font-weight:900;">${characterShards}</div>
      <div style="color:#fbbf24;font-size:11px;">Nhấn để đổi trang bị ✨</div>
    </div>`;
}

// ── ĐỔI OUTFIT ──────────────────────────────────────────
window.openOutfitShardSheet = () => {
  const modal = document.getElementById('outfitRedeemModal');
  if (!modal) return;
  modal.classList.add('open');
  renderOutfitRedeemUI();
};

let redeemSystem = 'real';
let redeemSlot = 'head';

function renderOutfitRedeemUI() {
  const sysDiv = document.getElementById('outfitRedeemSystemSwitch');
  sysDiv.innerHTML = Object.entries(OUTFIT_CATALOG).map(([key, sys]) =>
    `<button class="bag-tab ${key===redeemSystem?'active':''}" data-system="${key}">${sys.icon} ${sys.label}</button>`
  ).join('');
  sysDiv.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      redeemSystem = b.dataset.system;
      redeemSlot = 'head';
      renderOutfitRedeemUI();
    });
  });

  const slotDiv = document.getElementById('outfitRedeemSlotTabs');
  slotDiv.innerHTML = Object.entries(SLOT_META).map(([slot, meta]) =>
    `<button class="wardrobe-tab ${slot===redeemSlot?'active':''}" data-slot="${slot}">${meta.icon} ${meta.label}</button>`
  ).join('');
  slotDiv.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      redeemSlot = b.dataset.slot;
      renderOutfitRedeemUI();
    });
  });

  const itemsDiv = document.getElementById('outfitRedeemItems');
  const allSlotItems = OUTFIT_CATALOG[redeemSystem]?.slots[redeemSlot] || [];
  const owned = state.ownedItems[redeemSystem]?.[redeemSlot] || [];
  const unowned = allSlotItems.filter(item => !owned.includes(item.id));
  itemsDiv.innerHTML = unowned.length
    ? unowned.map(item => `
      <div class="bag-item-card" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div class="item-icon">${item.emoji || '👕'}</div>
        <div class="item-name">${item.name}</div>
        <div style="color:#fbbf24;font-weight:700;">🧩 5</div>
        <button class="bag-btn" style="background:#fbbf24; color:#000;" onclick="window.doRedeemOutfit('${item.id}')">Đổi</button>
      </div>`).join('')
    : '<div style="grid-column:1/-1;text-align:center;color:#4a7a9b;">🎉 Bạn đã sưu tập đủ!</div>';
}

window.doRedeemOutfit = async (itemId) => {
  try {
    await redeemOutfitShard(redeemSystem, redeemSlot, itemId);
    alert('✅ Đổi thành công!');
    document.getElementById('outfitRedeemModal').classList.remove('open');
  } catch(e) { alert('❌ ' + e.message); }
};

// ── ITEM (vật phẩm) ──────────────────────────────────────
function renderItems() {
  const grid = document.getElementById('item-grid');
  if (!grid) return;
  if (!filteredItems.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">📭 Chưa có vật phẩm</div>';
    return;
  }
  grid.innerHTML = filteredItems.map(item => `
    <div class="bag-item-card">
      <div class="item-icon">${item.emoji}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-qty">x${item.qty}</div>
      <div class="item-desc">${item.desc}</div>
      <div class="bag-actions" style="margin-top:8px; display:flex; gap:6px;">
        ${item.convertShard ? `<button class="bag-btn" onclick="window.convertToCharShard('${item.id}')" style="background:#a78bfa">🔄 Đổi ${item.convertShard} mảnh NV</button>` : ''}
      </div>
    </div>`).join('');
}

function updateItemStats() {
  const total = allItems.reduce((s,i)=>s+i.qty,0);
  const container = document.getElementById('item-stats');
  if(container) container.innerHTML = `<span>📦 Tổng: ${total}</span>`;
}

window.convertToCharShard = async (itemId) => {
  const item = allItems.find(i=>i.id===itemId);
  if(!item || item.qty<1) return alert('Không có vật phẩm!');
  const qty = parseInt(prompt(`Nhập số lượng ${item.name} muốn đổi (mỗi cái +${item.convertShard} mảnh NV):`, '1'));
  if(isNaN(qty)||qty<1||qty>item.qty) return;
  const gain = qty * item.convertShard;
  if(!confirm(`Đổi ${qty} ${item.name} lấy ${gain} 🧩 mảnh nhân vật?`)) return;
  const userRef = doc(db,'users',currentUser.uid);
  const newQty = item.qty - qty;
  await updateDoc(userRef,{
    [`itemCollection.${itemId}`]: newQty>0?newQty:0,
    characterShards: (characterShards + gain)
  });
  alert(`✅ Nhận ${gain} mảnh nhân vật!`);
};

// ── WARDROBE UI ──────────────────────────────────────────
let currentWardrobeSlot = 'head';
let pendingOutfit = { head: null, body: null, acc: null };

function renderWardrobeUI() {
  if (!state || !state.ownedItems) return;
  pendingOutfit = { ...state.equipped[state.system] };
  renderPreview();
  renderWardrobeTabs();
  renderWardrobeItems();
}

function renderPreview() {
  const container = document.getElementById('wardrobePreview');
  if (!container) return;
  container.innerHTML = '';
  renderChibiTo(container, state.system, pendingOutfit);
}

function renderWardrobeTabs() {
  const tabsDiv = document.getElementById('wardrobeTabs');
  if (!tabsDiv) return;
  tabsDiv.innerHTML = Object.entries(SLOT_META).map(([slot, meta]) => `
    <button class="wardrobe-tab ${currentWardrobeSlot === slot ? 'active' : ''}" data-slot="${slot}">
      ${meta.icon} ${meta.label}
    </button>
  `).join('');
  tabsDiv.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWardrobeSlot = btn.dataset.slot;
      renderWardrobeTabs();
      renderWardrobeItems();
    });
  });
}

function renderWardrobeItems() {
  const itemsDiv = document.getElementById('wardrobeItems');
  if (!itemsDiv) return;
  const owned = state.ownedItems[state.system]?.[currentWardrobeSlot] || [];
  const allItemsSlot = OUTFIT_CATALOG[state.system]?.slots[currentWardrobeSlot] || [];
  const available = allItemsSlot.filter(item => owned.includes(item.id));
  if (!available.length) {
    itemsDiv.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#4a7a9b;padding:20px;">Chưa sở hữu item nào</div>';
    return;
  }
  itemsDiv.innerHTML = available.map(item => {
    const isEquipped = pendingOutfit[currentWardrobeSlot] === item.id;
    return `
      <div class="wardrobe-item ${isEquipped ? 'equipped' : ''}" data-id="${item.id}">
        <div class="emoji">👕</div>
        <div class="name">${item.name}</div>
        ${isEquipped ? '<div class="check">✓</div>' : ''}
      </div>
    `;
  }).join('');
  itemsDiv.querySelectorAll('.wardrobe-item').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      pendingOutfit[currentWardrobeSlot] = id;
      renderPreview();
      renderWardrobeItems();
    });
  });
}

async function saveOutfit() {
  if (!currentUser) return;
  try {
    await saveEquipped(state.system, pendingOutfit);
    alert('✅ Đã lưu trang phục!');
  } catch(e) {
    alert('Lỗi: ' + e.message);
  }
}

// ── TAB SWITCH ───────────────────────────────────────────
document.querySelectorAll('.bag-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.bag-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.bag-panel').forEach(p => p.classList.remove('active-panel'));
    if (target === 'pet') {
      document.getElementById('pet-panel').classList.add('active-panel');
      renderBag();
    } else if (target === 'item') {
      document.getElementById('item-panel').classList.add('active-panel');
      renderItems();
      updateItemStats();
    } else if (target === 'character') {
      document.getElementById('character-panel').classList.add('active-panel');
      renderWardrobeUI();
    }
  });
});

document.getElementById('saveOutfitBtn')?.addEventListener('click', saveOutfit);