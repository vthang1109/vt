// ── PATCH shop.js ─────────────────────────────────────────
// Thêm import ở đầu file shop.js:

import { OUTFIT_GACHA_POOL, grantOutfitItem } from './character.js';

// Trong hàm rollGacha, sau khi doGacha xong, thêm:
export async function rollGacha(rolls = 1, type = 'normal') {
  const results = await doGacha(rolls, type);

  // ── OUTFIT DROP: mỗi lần roll có 15% chance rơi 1 trang phục ──
  const pool = OUTFIT_GACHA_POOL[type] || OUTFIT_GACHA_POOL.normal;
  if (pool.length && Math.random() < 0.15) {
    const itemId = pool[Math.floor(Math.random() * pool.length)];
    await grantOutfitItem(itemId);
    // Thêm vào results để hiển thị cho user
    results.push({ _type: 'outfit', id: itemId });
  }

  return results;
}


// ── PATCH shop.html — hiển thị outfit drop trong kết quả gacha ──
// Trong window.shopRoll, thêm xử lý _type === 'outfit':

// Thay dòng: box.innerHTML = results.map(r => `...`).join('');
// Bằng:
box.innerHTML = results.map(r => {
  if (r._type === 'outfit') {
    return `<div class="pet-result-item" style="border-color:rgba(56,189,248,0.4)">
      <div style="font-size:36px">${r.icon || '🎁'}</div>
      <div style="color:#e0f2fe;font-size:13px;font-weight:700">${r.name || 'Trang phục'}</div>
      <div style="color:#38bdf8;font-size:11px">✨ Trang phục mới!</div>
    </div>`;
  }
  return `<div class="pet-result-item rarity-t${r.tier.id}" style="border-color:${TIER_COLOR[r.tier.id]}66">
    <div style="font-size:40px">${r.emoji||'🐾'}</div>
    <div style="color:#e0f2fe;font-size:13px;font-weight:700">${r.name}</div>
    <div style="color:${TIER_COLOR[r.tier.id]};font-size:11px">${TIER_NAME[r.tier.id]}</div>
  </div>`;
}).join('');


// ── PATCH shop.html — thêm section mua trang phục ─────────
// Thêm section này vào shop.html sau phần Gacha VIP:

/*
<div class="shop-gacha-section" style="border-color:rgba(56,189,248,0.2)">
  <h2>👕 Trang Phục Nhân Vật</h2>
  <p class="shop-desc">Mua trang phục cho nhân vật chibi của bạn. Một số item chỉ có từ Gacha.</p>
  <button class="shop-gacha-btn" onclick="location.href='profile.html'" 
    style="background:rgba(56,189,248,0.1);color:#38bdf8">
    🗄️ Mở Tủ Đồ trên Hồ Sơ →
  </button>
</div>
*/


// ── FIRESTORE schema (users/{uid}) — các field mới ─────────
/*
  character: {
    gender:   'male' | 'female',
    equipped: {
      hat:   string,   // item id
      shirt: string,
      pants: string,
      deco:  string,
    }
  },
  outfitOwned: string[]  // mảng item id đã sở hữu
*/


// ── Tóm tắt luồng ─────────────────────────────────────────
/*
  SHOP (mua điểm):
    character.js → buyOutfitItem(id)
      → runTransaction: trừ points, arrayUnion(outfitOwned)
      → onSnapshot tự cập nhật charState.owned
      → equipItem ngay trong modal

  GACHA (rơi ngẫu nhiên):
    shop.js → rollGacha → grantOutfitItem(id)
      → updateDoc: arrayUnion(outfitOwned)
      → onSnapshot tự cập nhật
      → hiện trong kết quả gacha

  PROFILE / TỦ ĐỒ:
    character.js → openWardrobeModal()
      → xem owned, thay đồ, preview realtime
      → saveToFirestore: lưu character.gender + character.equipped

  BAG (bag.js):
    Không cần sửa — outfit lưu riêng trong outfitOwned[]
    Bag chỉ quản lý petCollection
*/
