// shop.js
import { getFirestore, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doGacha } from './pet.js';
import { grantOutfitItem, OUTFIT_GACHA_POOL, OUTFIT_CATALOG } from './character.js';
import { OUTFIT_GACHA_POOL, grantOutfitItem } from './character.js';

const db = getFirestore();
const auth = getAuth();

// mua vé an toàn
export async function buyTickets(count = 1, type = 'normal', pricePerTicket = 100) {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const userRef = doc(db, 'users', user.uid);
  const ticketField = type === 'vip' ? 'tickets_vip' : 'tickets_normal';
  const totalPrice = count * pricePerTicket;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.data();
    const currentPoints = data.points || 0;
    if (currentPoints < totalPrice) throw new Error('Không đủ điểm');

    tx.update(userRef, {
      points: currentPoints - totalPrice,
      [ticketField]: (data[ticketField] || 0) + count
    });

    return { newPoints: currentPoints - totalPrice, newTickets: (data[ticketField] || 0) + count };
  });
}

// quay gacha wrapper: gọi doGacha + gacha outfit mỗi roll
export async function rollGacha(rolls = 1, type = 'normal') {
  const results = await doGacha(rolls, type);

  // 12% chance rơi 1 trang phục mỗi lần roll (lặp rolls lần)
  const pool = OUTFIT_GACHA_POOL[type] || OUTFIT_GACHA_POOL.normal;
  for (let i = 0; i < rolls; i++) {
    if (pool.length && Math.random() < 0.12) {
      const itemId = pool[Math.floor(Math.random() * pool.length)];
      await grantOutfitItem(itemId);
      const item = Object.values(OUTFIT_CATALOG).flat().find(x => x.id === itemId);
      if (item) {
        results.push({ _type: 'outfit', id: itemId, name: item.name });
      }
    }
  }

  return results;
}

// Đọc điểm + vé hiện tại của user → cập nhật statusbar
export async function syncStatusBar() {
  const user = auth.currentUser;
  if(!user) return;
  const snap = await (await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"))
    .getDoc(doc(db, 'users', user.uid));
  if(!snap.exists()) return;
  const d = snap.data();
  const sp = document.getElementById('status-pts');
  const sn = document.getElementById('status-tickets-normal');
  const sv = document.getElementById('status-tickets-vip');
  if(sp) sp.textContent = (d.points||0).toLocaleString('vi');
  if(sn) sn.textContent = d.tickets_normal||0;
  if(sv) sv.textContent = d.tickets_vip||0;
}