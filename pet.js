// pet.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc,
  runTransaction, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.appspot.com",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== CONFIG =====
export const PET_TIERS = [
  { id: 1, name: 'Gà mờ', color: '#94a3b8', buff: 2 },
  { id: 2, name: 'Tinh anh', color: '#34d399', buff: 5 },
  { id: 3, name: 'Bá sàn', color: '#fbbf24', buff: 10 },
  { id: 4, name: 'Kiệt tác', color: '#f43f5e', buff: 20 },
  { id: 5, name: 'Huyền thoại', color: '#a78bfa', buff: 30 }
];

// ID theo tier: t{tier}_{số thứ tự trong tier}
// Thêm pet mới chỉ cần append vào đúng nhóm tier, tăng số thứ tự
// Ảnh: pic/pet/{id}_1.png, pic/pet/{id}_2.png, pic/pet/{id}_3.png
function makePet(id, name, emoji, tier) {
  return { id, name, emoji, tier, images: [
    `pic/pet/${id}_1.png`,
    `pic/pet/${id}_2.png`,
    `pic/pet/${id}_3.png`,
  ]};
}

export const PET_POOL = [
  // ── Cấp 1: Gà Mờ ──────────────────────────────
  makePet('t1_1', 'Gà',        '🐔', 1),
  makePet('t1_2', 'Chó',       '🐕', 1),
  makePet('t1_3', 'Mèo',       '🐈', 1),
  makePet('t1_4', 'Hamster',   '🐹', 1),
  makePet('t1_5', 'Cá Chép',   '🐟', 1),

  // ── Cấp 2: Tinh Anh ────────────────────────────
  makePet('t2_1', 'Vẹt',       '🦜', 2),
  makePet('t2_2', 'Sóc',       '🐿️', 2),
  makePet('t2_3', 'Cú',        '🦉', 2),
  makePet('t2_4', 'Nhím',      '🦔', 2),
  makePet('t2_5', 'Bạch Tuộc', '🐙', 2),

  // ── Cấp 3: Bá Sàn ──────────────────────────────
  makePet('t3_1', 'Gấu',       '🐻', 3),
  makePet('t3_2', 'Miu',       '😸', 3),
  makePet('t3_3', 'Cá Sấu',    '🐊', 3),
  makePet('t3_4', 'Cá Voi',    '🐋', 3),
  makePet('t3_5', 'Hồ Ly',     '🦊', 3),

  // ── Cấp 4: Kiệt Tác ────────────────────────────
  makePet('t4_1', 'Long',      '🐉', 4),
  makePet('t4_2', 'Lân',       '🦁', 4),
  makePet('t4_3', 'Quy',       '🐢', 4),
  makePet('t4_4', 'Phụng',     '🦅', 4),
  makePet('t4_5', 'Xà',        '🐍', 4),

  // ── Cấp 5: Huyền Thoại ─────────────────────────
  makePet('t5_1', 'Thỏ & Cáo', '🐰', 5),
  makePet('t5_2', 'Doraemon',  '🤖', 5),
  makePet('t5_3', 'Shaun',     '🐑', 5),
  makePet('t5_4', 'Tom & Jerry','🐭', 5),
  makePet('t5_5', 'Vịt Donald','🦆', 5),
];

// Lấy ảnh theo giờ: 0-7h→ảnh 1, 8-15h→ảnh 2, 16-23h→ảnh 3
export function getPetImage(pet) {
  const h = new Date().getHours();
  const idx = h < 8 ? 0 : h < 16 ? 1 : 2;
  return (pet.images && pet.images[idx]) ? pet.images[idx] : (pet.image || '');
}

// 1 loại mảnh duy nhất, tier cao phân rã nhiều hơn & đổi tốn hơn
export const SHARD_DROP = { 1:1, 2:2, 3:4, 4:8, 5:15 };  // mảnh nhận khi phân rã
export const SHARD_COST = { 1:3, 2:6, 3:15, 4:40, 5:100 }; // mảnh cần để đổi

// ===== HELPERS =====
export function getPetById(id) {
  return PET_POOL.find(p => p.id === id) || null;
}
export function getTierById(id) {
  return PET_TIERS.find(t => t.id === id) || PET_TIERS[0];
}

async function getUserDocRaw(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function getPetData() {
  const user = auth.currentUser;
  if (!user) return { collection:{}, activePet:null, tickets_normal:0, tickets_vip:0, shards:{} };
  const d = await getUserDocRaw(user.uid);
  return {
    collection:      d?.petCollection || {},
    activePet:       d?.activePet     || null,
    tickets_normal:  d?.tickets_normal|| 0,
    tickets_vip:     d?.tickets_vip   || 0,
    shards: d?.shards || 0,
    points:          d?.points        || 0,
  };
}

// Phân rã pet trùng → mảnh chung theo tier
// Tier cao → nhận nhiều mảnh hơn (SHARD_DROP)
export async function disassemblePet(petId, qty = 1) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  const pet = getPetById(petId);
  if (!pet) throw new Error('Không tìm thấy pet');
  const shardGain = SHARD_DROP[pet.tier] * qty; // mảnh nhận được
  const userRef   = doc(db, 'users', user.uid);
  return runTransaction(db, async tx => {
    const snap = await tx.get(userRef);
    const data = snap.data();
    const col  = { ...(data.petCollection || {}) };
    if ((col[petId] || 0) < qty + 1) throw new Error('Cần giữ lại ít nhất 1 con!');
    col[petId] -= qty;
    const shards = (data.shards || 0) + shardGain;
    tx.update(userRef, { petCollection: col, shards });
    return { shardGain, shards };
  });
}

// Đổi mảnh lấy pet (dùng mảnh chung theo tier)
// Tier cao → tốn nhiều mảnh hơn (SHARD_COST)
export async function redeemShard(petId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  const pet  = getPetById(petId);
  if (!pet) throw new Error('Không tìm thấy pet');
  const cost    = SHARD_COST[pet.tier];
  const userRef = doc(db, 'users', user.uid);
  return runTransaction(db, async tx => {
    const snap   = await tx.get(userRef);
    const data   = snap.data();
    const shards = data.shards || 0;
    const col    = { ...(data.petCollection || {}) };
    if (shards < cost) throw new Error(`Cần ${cost} mảnh, hiện có ${shards}`);
    col[petId] = (col[petId] || 0) + 1;
    tx.update(userRef, { shards: shards - cost, petCollection: col });
    return { newQty: col[petId], shardsLeft: shards - cost };
  });
}

// ===== GACHA (transaction-safe) – Tự động trả mảnh nếu trùng =====
export async function doGacha(rolls = 1, type = 'normal') {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const userRef = doc(db, 'users', user.uid);

  // generate results locally first
  const results = [];
  for (let i = 0; i < rolls; i++) {
    const rnd = Math.random();
    let selectedTier;
    if (type === 'vip') {
      if (rnd < 0.30) selectedTier = PET_TIERS[2];
      else if (rnd < 0.70) selectedTier = PET_TIERS[3];
      else selectedTier = PET_TIERS[4];
    } else {
      if (rnd < 0.60) selectedTier = PET_TIERS[0];
      else if (rnd < 0.90) selectedTier = PET_TIERS[1];
      else selectedTier = PET_TIERS[2];
    }
    const tierPets = PET_POOL.filter(p => p.tier === selectedTier.id);
    const pet = tierPets[Math.floor(Math.random() * tierPets.length)];
    results.push({ ...pet, tier: selectedTier });
  }

  // transaction: update petCollection and shards based on duplicates
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.data();
    const newCollection = { ...(data.petCollection || {}) };
    let shards = data.shards || 0;

    results.forEach(r => {
      if (newCollection[r.id] && newCollection[r.id] > 0) {
        // Đã sở hữu → cộng mảnh theo tier
        shards += SHARD_DROP[r.tier.id] || 1;
      } else {
        // Chưa có → thêm 1 con
        newCollection[r.id] = 1;
      }
    });

    tx.update(userRef, { petCollection: newCollection, shards });
  });

  // log total gacha rolls (non-critical)
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const current = snap.data()?.totalGachaRolls || 0;
    await updateDoc(doc(db, 'users', user.uid), { totalGachaRolls: current + rolls });
  } catch { /* non-critical */ }

  return results;
}

// ===== ACTIVE PET =====
export async function setActivePet(petId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');
  await updateDoc(doc(db, 'users', user.uid), { activePet: petId });
}

export async function getActiveBuff() {
  const data = await getPetData();
  if (!data.activePet) return 0;
  const p = getPetById(data.activePet);
  if (!p) return 0;
  const t = getTierById(p.tier);
  return t.buff || 0;
}