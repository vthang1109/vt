// ===== pet-ui.js – UI thú cưng =====
import {
  PET_TIERS, PET_POOL,
  getPetData, setActivePet,
  getPetById, getTierById
} from './pet.js';
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── MOUNT MODAL ────────────────────────────────────────────
export function mountPetModal() {
  if (document.getElementById('petModalOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div class="pet-modal-overlay" id="petModalOverlay" onclick="if(event.target===this) this.classList.remove('open')">
    <div class="pet-modal">
      <div class="pet-modal-header">
        <span class="pet-modal-title">🐾 Bộ Sưu Tập Thú Cưng</span>
        <button class="pet-modal-close" onclick="document.getElementById('petModalOverlay').classList.remove('open')">✕</button>
      </div>
      <div class="pet-tab-content active" style="padding:20px;overflow-y:auto;max-height:70vh">
        <div class="pet-collection-grid" id="petCollectionGrid">
          <div class="pet-empty-msg">Đang tải...</div>
        </div>
      </div>
    </div>
  </div>`);
}

window.openPetModal = async () => {
  mountPetModal();
  document.getElementById('petModalOverlay').classList.add('open');
  await renderCollection();
};

// ── COLLECTION GRID ────────────────────────────────────────
async function renderCollection() {
  const grid = document.getElementById('petCollectionGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="pet-empty-msg">Đang tải...</div>';

  const data        = await getPetData();
  const owned       = data.collection || {};  // { petId: qty }
  const activePetId = data.activePet;

  grid.innerHTML = PET_POOL.map(pet => {
    const isOwned = (owned[pet.id] || 0) > 0;
    const qty     = owned[pet.id] || 0;
    const isAct   = pet.id === activePetId;
    const tier    = getTierById(pet.tier);
    // Dùng ảnh đầu tiên làm thumbnail, fallback emoji
    const thumb   = pet.images?.[0] || '';

    return `
    <div class="pet-card ${isOwned ? '' : 'locked'} ${isAct ? 'active' : ''}"
         ${isOwned ? `onclick="window.selectPet('${pet.id}')"` : ''}
         style="border-color:${isOwned ? tier.color+'66' : 'rgba(255,255,255,0.08)'}">
      ${thumb
        ? `<img src="${thumb}" alt="${pet.name}"
               style="width:52px;height:52px;object-fit:contain;border-radius:8px;
                      ${!isOwned ? 'filter:grayscale(1);opacity:.4' : ''}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
           <span style="font-size:32px;display:none">${pet.emoji||'🐾'}</span>`
        : `<span style="font-size:32px">${pet.emoji||'🐾'}</span>`}
      <div class="pet-card-name" style="color:${isOwned ? tier.color : '#2d4a6a'}">${pet.name}</div>
      ${isOwned ? `<div style="color:#38bdf8;font-size:11px;font-weight:700">x${qty}</div>` : ''}
      ${isAct   ? '<div class="pet-card-tag">Đang chọn</div>' : ''}
    </div>`;
  }).join('');
}

window.selectPet = async (petId) => {
  try {
    await setActivePet(petId);
    await renderCollection();
    if (window._renderProfilePetFn) window._renderProfilePetFn();
  } catch(e) { alert(e.message); }
};

// ── RENDER Ô PET NGOÀI PROFILE ─────────────────────────────
export async function renderProfilePet(viewUid, petCollection, activePetId) {
  const frame   = document.getElementById('pro-pet-frame');
  const sub     = document.getElementById('pro-card-pet-sub');
  const cardPet = document.querySelector('.pro-card-pet');
  if (!frame) return;

  // Expose để selectPet gọi lại được
  window._renderProfilePetFn = () => renderProfilePet(viewUid, petCollection, activePetId);

  try {
    // Lấy petId — ưu tiên tham số truyền vào, fallback fetch
    let petId = activePetId ?? null;
    if (petId === null) {
      if (viewUid) {
        const db   = getFirestore();
        const snap = await getDoc(doc(db, 'users', viewUid));
        petId = snap.exists() ? (snap.data().activePet || null) : null;
      } else {
        const data = await getPetData();
        petId = data.activePet || null;
      }
    }

    // Reset class tier cũ + badge cũ + interval cũ
    if (cardPet) {
      cardPet.classList.remove('pet-tier-1','pet-tier-2','pet-tier-3','pet-tier-4','pet-tier-5');
      cardPet.querySelector('.pet-tier-badge')?.remove();
    }
    if (window._petImgInterval) {
      clearInterval(window._petImgInterval);
      window._petImgInterval = null;
    }

    // Chưa có pet
    if (!petId) {
      frame.innerHTML = `<div class="pro-pet-placeholder">
        <span class="pro-pet-emoji">🥚</span>
        <span style="font-size:12px;color:#4a7a9b;display:block;margin-top:8px">Chưa chọn thú cưng</span>
      </div>`;
      if (sub) sub.textContent = 'Chưa chọn thú cưng';
      return;
    }

    const pet = getPetById(petId);
    if (!pet) {
      frame.innerHTML = `<div class="pro-pet-placeholder"><span class="pro-pet-emoji">🥚</span></div>`;
      if (sub) sub.textContent = 'Chưa chọn thú cưng';
      return;
    }
    const tier = getTierById(pet.tier);

    // Gán class tier → CSS neon + badge góc
    if (cardPet) {
      cardPet.classList.add(`pet-tier-${pet.tier}`);
      const badge = document.createElement('span');
      badge.className = 'pet-tier-badge';
      badge.textContent = tier.name;
      cardPet.appendChild(badge);
    }

    // Render ảnh slideshow
    const imgs = pet.images || [];
    frame.innerHTML = `
      <div class="pet-active-display">
        ${imgs.length
          ? `<img id="petActiveImg" src="${imgs[0]}" alt="${pet.name}"
                  style="width:72px;height:72px;object-fit:contain;border-radius:12px;
                         margin-bottom:6px;transition:opacity .2s"
                  onerror="this.style.display='none';document.getElementById('petActiveEmoji').style.display='block'"/>
             <span id="petActiveEmoji" style="font-size:56px;display:none;margin-bottom:6px">${pet.emoji||'🐾'}</span>`
          : `<span style="font-size:56px;margin-bottom:6px">${pet.emoji||'🐾'}</span>`}
        <span class="pet-active-name"
              style="color:${tier.color};text-shadow:0 0 10px ${tier.color},0 0 20px ${tier.color}66">
          ${pet.name}
        </span>
      </div>`;

    // Slideshow 1s/ảnh
    if (imgs.length > 1) {
      let idx = 0;
      window._petImgInterval = setInterval(() => {
        const el = document.getElementById('petActiveImg');
        if (!el) { clearInterval(window._petImgInterval); return; }
        idx = (idx + 1) % imgs.length;
        el.style.opacity = '0';
        setTimeout(() => { el.src = imgs[idx]; el.style.opacity = '1'; }, 200);
      }, 1000);
    }

    if (sub) sub.textContent = `Bonus: +${tier.buff}% điểm`;

  } catch(e) {
    console.error('renderProfilePet:', e);
  }
}