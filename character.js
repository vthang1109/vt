// character.js — Character System (Real & Fims, 3 Slots, Dùng ảnh)
import { db, auth } from './points.js';
import {
  doc, updateDoc, onSnapshot, runTransaction, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── CATALOG (mỗi slot ~20 món) ───────────────────────────
export const OUTFIT_CATALOG = {
  real: {
    label: 'Real',
    icon: '🧑',
    slots: {
      head: [
        { id: 'RH_00', name: 'Mặc định' },
        { id: 'RH_01', name: 'HTH' },
        { id: 'RH_02', name: 'QHMTD' },
        { id: 'RH_03', name: 'JACK' },
        { id: 'RH_04', name: 'Tóc đỏ' },
        { id: 'RH_05', name: 'Mũ lưỡi trai' },
        { id: 'RH_06', name: 'Kính râm' },
        { id: 'RH_07', name: 'Tóc tết' },
        { id: 'RH_08', name: 'Mũ len' },
        { id: 'RH_09', name: 'Băng đô' },
        { id: 'RH_10', name: 'Tóc búi' },
        { id: 'RH_11', name: 'Nón lá' },
        { id: 'RH_12', name: 'Tai thỏ' },
        { id: 'RH_13', name: 'Mũ cao bồi' },
        { id: 'RH_14', name: 'Tóc giả hề' },
        { id: 'RH_15', name: 'Vòng nguyệt quế' },
        { id: 'RH_16', name: 'Kẹp nơ' },
        { id: 'RH_17', name: 'Sừng quỷ' },
        { id: 'RH_18', name: 'Mũ bảo hiểm' },
        { id: 'RH_19', name: 'Khăn turban' },
      ],
      body: [
        { id: 'RB_00', name: 'Mặc định' },
        { id: 'RB_01', name: 'Sad' },
        { id: 'RB_02', name: 'Color' },
        { id: 'RB_03', name: 'Cam' },
        { id: 'RB_04', name: 'Rig' },
        { id: 'RB_05', name: 'KF' },
        { id: 'RB_06', name: 'BuleBall' },
        { id: 'RB_07', name: 'Jean' },
        { id: 'RB_08', name: 'Thun đen' },
        { id: 'RB_09', name: 'Hawaii' },
        { id: 'RB_10', name: 'Sọc ngang' },
        { id: 'RB_11', name: 'Flannel' },
        { id: 'RB_12', name: 'Blazer' },
        { id: 'RB_13', name: 'Áo dài' },
        { id: 'RB_14', name: 'Gile' },
        { id: 'RB_15', name: 'Đầm suông' },
        { id: 'RB_16', name: 'Áo yếm' },
        { id: 'RB_17', name: 'Giáp sắt' },
        { id: 'RB_18', name: 'Áo khoác dù' },
        { id: 'RB_19', name: 'Hoodie xám' },
      ],
      acc: [
        { id: 'RA_00', name: 'Không' },
        { id: 'RA_01', name: 'Đồng hồ' },
        { id: 'RA_02', name: 'Ba lô' },
        { id: 'RA_03', name: 'Điện thoại' },
        { id: 'RA_04', name: 'Mèo' },
        { id: 'RA_05', name: 'Kiếm' },
        { id: 'RA_06', name: 'Cặp sách' },
        { id: 'RA_07', name: 'Dù' },
        { id: 'RA_08', name: 'Gậy tự sướng' },
        { id: 'RA_09', name: 'Bình nước' },
        { id: 'RA_10', name: 'Sổ tay' },
        { id: 'RA_11', name: 'Mặt nạ' },
        { id: 'RA_12', name: 'Cờ' },
        { id: 'RA_13', name: 'Đàn guitar' },
        { id: 'RA_14', name: 'Bóng đá' },
        { id: 'RA_15', name: 'Cần câu' },
        { id: 'RA_16', name: 'Bút chì khổng lồ' },
        { id: 'RA_17', name: 'Máy ảnh' },
        { id: 'RA_18', name: 'Hoa' },
        { id: 'RA_19', name: 'Kẹo bông' },
      ],
    }
  },
  fims: {
    label: 'Fims',
    icon: '🎬',
    slots: {
      head: [
        { id: 'FH_00', name: 'Mặc định' },
        { id: 'FH_01', name: 'Tóc hồng' },
        { id: 'FH_02', name: 'Tóc xanh' },
        { id: 'FH_03', name: 'Tai mèo' },
        { id: 'FH_04', name: 'Mũ phù thủy' },
        { id: 'FH_05', name: 'Vương miện' },
        { id: 'FH_06', name: 'Kẹo mút' },
        { id: 'FH_07', name: 'Băng đô sao' },
        { id: 'FH_08', name: 'Ruy băng' },
        { id: 'FH_09', name: 'Tai thỏ' },
        { id: 'FH_10', name: 'Nơ bướm' },
        { id: 'FH_11', name: 'Mũ hề' },
        { id: 'FH_12', name: 'Tóc cầu vồng' },
        { id: 'FH_13', name: 'Sừng kỳ lân' },
        { id: 'FH_14', name: 'Mạng che mặt' },
        { id: 'FH_15', name: 'Kính 3D' },
        { id: 'FH_16', name: 'Tai nghe' },
        { id: 'FH_17', name: 'Mũ lông' },
        { id: 'FH_18', name: 'Tóc công chúa' },
        { id: 'FH_19', name: 'Halo thiên thần' },
      ],
      body: [
        { id: 'FB_00', name: 'Mặc định' },
        { id: 'FB_01', name: 'Áo hồng' },
        { id: 'FB_02', name: 'Áo xanh dương' },
        { id: 'FB_03', name: 'Áo cầu vồng' },
        { id: 'FB_04', name: 'Áo choàng tím' },
        { id: 'FB_05', name: 'Giáp bạc' },
        { id: 'FB_06', name: 'Váy công chúa' },
        { id: 'FB_07', name: 'Áo sọc màu' },
        { id: 'FB_08', name: 'Váy tiên' },
        { id: 'FB_09', name: 'Bộ sư tử' },
        { id: 'FB_10', name: 'Áo thủy thủ' },
        { id: 'FB_11', name: 'Choàng sao' },
        { id: 'FB_12', name: 'Giáp rồng' },
        { id: 'FB_13', name: 'Đầm dạ hội' },
        { id: 'FB_14', name: 'Áo len ấm' },
        { id: 'FB_15', name: 'Bộ phi hành gia' },
        { id: 'FB_16', name: 'Áo bóng đá' },
        { id: 'FB_17', name: 'Váy ballet' },
        { id: 'FB_18', name: 'Áo choàng phù thủy' },
        { id: 'FB_19', name: 'Bộ Ninja' },
      ],
      acc: [
        { id: 'FA_00', name: 'Không' },
        { id: 'FA_01', name: 'Cánh bướm' },
        { id: 'FA_02', name: 'Gậy phép' },
        { id: 'FA_03', name: 'Bóng bay' },
        { id: 'FA_04', name: 'Thú bông' },
        { id: 'FA_05', name: 'Khiên' },
        { id: 'FA_06', name: 'Kiếm ánh sáng' },
        { id: 'FA_07', name: 'Cung tên' },
        { id: 'FA_08', name: 'Sách phép' },
        { id: 'FA_09', name: 'Đuôi mèo' },
        { id: 'FA_10', name: 'Cánh thiên thần' },
        { id: 'FA_11', name: 'Cánh dơi' },
        { id: 'FA_12', name: 'Sừng cưng' },
        { id: 'FA_13', name: 'Lồng đèn' },
        { id: 'FA_14', name: 'Đàn lia' },
        { id: 'FA_15', name: 'Hộp nhạc' },
        { id: 'FA_16', name: 'Kiếm gỗ' },
        { id: 'FA_17', name: 'Bùa may mắn' },
        { id: 'FA_18', name: 'Kẹo que' },
        { id: 'FA_19', name: 'Mặt nạ lễ hội' },
      ],
    }
  }
};

export const SLOT_META = {
  head: { label:'Đầu', icon:'💇' },
  body: { label:'Thân', icon:'👕' },
  acc:  { label:'P.Kiện', icon:'✨' },
};

const LAYER_ORDER = ['body', 'head', 'acc'];
const GACHA_COST = 100; // điểm cho mỗi lần quay đơn
const SHARD_COST_PER_ITEM = 5; // mảnh nhân vật để đổi 1 item

// Helpers
export function findInSlot(system, slot, id) {
  return (OUTFIT_CATALOG[system]?.slots[slot] || []).find(i => i.id === id) || null;
}

// State
export let state = {
  system: 'real',
  equipped: {
    real:  { head:'RH_00', body:'RB_00', acc:'RA_00' },
    fims:  { head:'FH_00', body:'FB_00', acc:'FA_00' },
  },
  ownedItems: {
    real:  { head: ['RH_00'], body: ['RB_00'], acc: ['RA_00'] },
    fims:  { head: ['FH_00'], body: ['FB_00'], acc: ['FA_00'] },
  },
  characterShards: 0
};

let unsub = null;

export function initCharacterSystem() {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    if (unsub) unsub();

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await updateDoc(userRef, {
        ownedItems: state.ownedItems,
        characterShards: 0,
        characterV3: { system: state.system, equipped: state.equipped }
      });
    } else {
      const d = snap.data();
      if (d.ownedItems) {
        state.ownedItems.real = { ...state.ownedItems.real, ...d.ownedItems.real };
        state.ownedItems.fims = { ...state.ownedItems.fims, ...d.ownedItems.fims };
      }
      state.characterShards = d.characterShards || 0;
      if (d.characterV3) {
        if (d.characterV3.system) state.system = d.characterV3.system;
        if (d.characterV3.equipped) {
          state.equipped.real = { ...state.equipped.real, ...d.characterV3.equipped.real };
          state.equipped.fims = { ...state.equipped.fims, ...d.characterV3.equipped.fims };
        }
      }
    }

    unsub = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.ownedItems) {
        state.ownedItems.real = { ...state.ownedItems.real, ...d.ownedItems.real };
        state.ownedItems.fims = { ...state.ownedItems.fims, ...d.ownedItems.fims };
      }
      state.characterShards = d.characterShards || 0;
      if (d.characterV3) {
        if (d.characterV3.system) state.system = d.characterV3.system;
        if (d.characterV3.equipped) {
          state.equipped.real = { ...state.equipped.real, ...d.characterV3.equipped.real };
          state.equipped.fims = { ...state.equipped.fims, ...d.characterV3.equipped.fims };
        }
      }
      // Fallback an toàn
      const cur = state.equipped[state.system];
      if (!cur.head || !OUTFIT_CATALOG[state.system].slots.head.find(i=>i.id===cur.head))
        cur.head = state.system === 'real' ? 'RH_00' : 'FH_00';
      if (!cur.body || !OUTFIT_CATALOG[state.system].slots.body.find(i=>i.id===cur.body))
        cur.body = state.system === 'real' ? 'RB_00' : 'FB_00';
      if (!cur.acc || !OUTFIT_CATALOG[state.system].slots.acc.find(i=>i.id===cur.acc))
        cur.acc = state.system === 'real' ? 'RA_00' : 'FA_00';

      renderProfilePreview();
      if (window._charUIUpdate) window._charUIUpdate();
    });
  });
}

export async function saveEquipped(system, slotValues) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  if (!slotValues.head || !slotValues.body) throw new Error('Đầu và Thân không được để trống!');
  state.equipped[system] = { ...slotValues };
  await updateDoc(doc(db, 'users', user.uid), {
    'characterV3.system': state.system,
    'characterV3.equipped': state.equipped,
  });
  renderProfilePreview();
  if (window._charUIUpdate) window._charUIUpdate();
}

// ── GACHA ĐƠN (có thưởng mảnh nếu trùng) ─────────────────
export async function gachaItem(system) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const pool = [];
  ['head', 'body', 'acc'].forEach(slot => {
    const items = OUTFIT_CATALOG[system].slots[slot].filter(i => i.id.endsWith('_00') === false);
    items.forEach(i => pool.push({ ...i, slot }));
  });

  const userRef = doc(db, 'users', user.uid);

  return runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.data();
    const points = data.points || 0;
    if (points < GACHA_COST) throw new Error(`Cần ${GACHA_COST} điểm để quay!`);

    const item = pool[Math.floor(Math.random() * pool.length)];
    const owned = data.ownedItems || {};
    if (!owned[system]) owned[system] = { head: [], body: [], acc: [] };
    if (!owned[system][item.slot]) owned[system][item.slot] = [];

    let shardsGain = 0;
    if (owned[system][item.slot].includes(item.id)) {
      // Trùng → thưởng 1 mảnh nhân vật
      shardsGain = 1;
    } else {
      owned[system][item.slot].push(item.id);
    }

    const newShards = (data.characterShards || 0) + shardsGain;

    tx.update(userRef, {
      points: points - GACHA_COST,
      ownedItems: owned,
      characterShards: newShards
    });

    return { ...item, isDuplicate: shardsGain > 0, shardsGain };
  });
}

// ── GACHA NHIỀU LẦN (DÙNG CHO SHOP) ────────────────────
export async function gachaMultiple(system, qty, price) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const pool = [];
  ['head', 'body', 'acc'].forEach(slot => {
    const items = OUTFIT_CATALOG[system].slots[slot].filter(i => i.id.endsWith('_00') === false);
    items.forEach(i => pool.push({ ...i, slot }));
  });

  const userRef = doc(db, 'users', user.uid);

  return runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.data();
    const points = data.points || 0;
    if (points < price) throw new Error(`Không đủ điểm! Cần ${price}⭐`);

    const results = [];
    let totalShardsGain = 0;
    const owned = data.ownedItems || {};
    if (!owned[system]) owned[system] = { head: [], body: [], acc: [] };
    for (const slot of ['head', 'body', 'acc']) {
      if (!owned[system][slot]) owned[system][slot] = [];
    }

    for (let i = 0; i < qty; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const isDuplicate = owned[system][item.slot].includes(item.id);
      if (!isDuplicate) {
        owned[system][item.slot].push(item.id);
      } else {
        totalShardsGain += 1; // mỗi trùng +1 mảnh
      }
      results.push({ ...item, isDuplicate, shardsGain: isDuplicate ? 1 : 0 });
    }

    const newShards = (data.characterShards || 0) + totalShardsGain;

    tx.update(userRef, {
      points: points - price,
      ownedItems: owned,
      characterShards: newShards
    });

    return results;
  });
}

// ── ĐỔI MẢNH LẤY ITEM OUTFIT ─────────────────────────────
export async function redeemOutfitShard(system, slot, itemId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const item = findInSlot(system, slot, itemId);
  if (!item) throw new Error('Vật phẩm không tồn tại');

  const userRef = doc(db, 'users', user.uid);

  return runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.data();

    const shards = data.characterShards || 0;
    if (shards < SHARD_COST_PER_ITEM) throw new Error(`Cần ${SHARD_COST_PER_ITEM} mảnh nhân vật để đổi!`);

    const owned = data.ownedItems || {};
    if (!owned[system]) owned[system] = { head: [], body: [], acc: [] };
    if (!owned[system][slot]) owned[system][slot] = [];

    if (owned[system][slot].includes(itemId)) {
      throw new Error('Bạn đã sở hữu vật phẩm này rồi!');
    }

    owned[system][slot].push(itemId);

    tx.update(userRef, {
      characterShards: shards - SHARD_COST_PER_ITEM,
      ownedItems: owned
    });

    return { success: true };
  });
}

// ── RENDER CHIBI ──────────────────────────────────────────
export function renderChibiTo(container, system, equipped) {
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';

  function addLayer(src, zIndex) {
    if (!src) return;
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;z-index:${zIndex};pointer-events:none;`;
    img.onerror = () => img.remove();
    container.appendChild(img);
  }

  LAYER_ORDER.forEach((slot, zi) => {
    const id = equipped[slot];
    if (!id) return;
    if (slot === 'acc' && (id === 'RA_00' || id === 'FA_00')) return;
    const imgPath = `assets/character/${system}/${slot}/${id}.png`;
    addLayer(imgPath, zi + 1);
  });

  container.classList.add('chibi-bounce');
}

function renderProfilePreview() {
  const frame = document.getElementById('pro-character-frame');
  if (!frame) return;
  renderChibiTo(frame, state.system, state.equipped[state.system]);
}

// Auto init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCharacterSystem);
} else {
  initCharacterSystem();
}