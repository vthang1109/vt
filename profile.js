// profile.js — dùng chung db/auth từ points.js
import { db, auth } from './points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, onSnapshot, updateDoc, getDocs, collection,
  orderBy, query, limit, getDoc, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderAvatar } from './avatar.js';
import { renderProfilePet, mountPetModal } from './pet-ui.js';

let currentUser = null;
let currentViewUid = null;
let _unsubProfile = null;

// ── RENDER ẢNH CÁ NHÂN ──────────────────────────────────
function renderPhoto(photoUrl) {
  const img         = document.getElementById('pro-photo-img');
  const placeholder = document.getElementById('pro-photo-placeholder');
  const sub         = document.getElementById('pro-photo-sub');
  if (!img) return;
  if (photoUrl) {
    img.src = photoUrl;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (sub) sub.textContent = 'Ảnh cá nhân';
  } else {
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (sub) sub.textContent = 'Chưa có ảnh';
  }
}

// ── AUTH ──────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;
  
  try { mountPetModal(); } catch (e) { console.warn('mountPetModal error:', e); }
  
  currentViewUid = new URLSearchParams(window.location.search).get('uid') || user.uid;
  const isOwner = currentViewUid === user.uid;

  listenProfile(currentViewUid);

  // Nút đổi avatar
  const uploadBtn = document.getElementById('pro-avatar-upload-btn');
  if (uploadBtn) uploadBtn.style.display = isOwner ? 'flex' : 'none';

  // Nút đổi ảnh bìa
  const coverUploadBtn = document.getElementById('pro-cover-upload-btn');
  if (coverUploadBtn) coverUploadBtn.style.display = isOwner ? 'flex' : 'none';

  // Nút đổi màu tên
  const nameColorBtn = document.getElementById('pro-name-color-btn');
  if (nameColorBtn) nameColorBtn.style.display = isOwner ? 'flex' : 'none';

  // Nút upload ảnh cá nhân (chỉ owner)
  const photoUploadBtn = document.getElementById('pro-photo-upload-btn');
  if (photoUploadBtn) photoUploadBtn.style.display = isOwner ? 'flex' : 'none';

  // Đổi tên
  const nameEl = document.getElementById('pro-name');
  if (nameEl) {
    if (isOwner) {
      nameEl.style.cursor = 'pointer';
      nameEl.title = 'Nhấn để đổi tên (miễn phí)';
      nameEl.onclick = () => showChangeNicknameModal(user.uid);
    } else {
      nameEl.style.cursor = 'default';
      nameEl.onclick = null;
      nameEl.title = '';
    }
  }

  // Upload avatar
  document.getElementById('pro-avatar-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Ảnh tối đa 500KB!'); return; }
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const avatarUrl = reader.result;
        await updateDoc(doc(db, 'users', user.uid), { avatarUrl });
        const avatarEl = document.getElementById('pro-avatar');
        if (avatarEl) {
          avatarEl.style.backgroundImage = `url(${avatarUrl})`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
        }
      };
      reader.readAsDataURL(file);
    } catch(err) { alert('Lỗi: ' + err.message); }
  });

  // Upload ảnh bìa
  document.getElementById('pro-cover-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) { alert('Ảnh bìa tối đa 800KB!'); return; }
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const coverUrl = reader.result;
        await updateDoc(doc(db, 'users', user.uid), { coverUrl });
        const coverImg = document.getElementById('pro-cover-img');
        const coverBg  = document.getElementById('pro-cover-bg');
        if (coverImg) { coverImg.src = coverUrl; coverImg.style.display = 'block'; }
        if (coverBg)  coverBg.style.display = 'none';
      };
      reader.readAsDataURL(file);
    } catch(err) { alert('Lỗi: ' + err.message); }
  });

  // Upload ảnh cá nhân
  document.getElementById('pro-photo-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert('Ảnh tối đa 1MB!'); return; }
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const photoUrl = reader.result;
        await updateDoc(doc(db, 'users', user.uid), { photoUrl });
        // Render ngay, không chờ snapshot
        renderPhoto(photoUrl);
      };
      reader.readAsDataURL(file);
    } catch(err) { alert('Lỗi lưu ảnh: ' + err.message); }
  });
});

// ── ĐỔI TÊN ──────────────────────────────────────────────
async function showChangeNicknameModal(uid) {
  const currentName = document.getElementById('pro-name')?.textContent || '';
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.25s ease;
  `;
  
  modal.innerHTML = `
    <div style="
      background: linear-gradient(145deg, #1a2744, #0f172a);
      border: 1px solid rgba(56,189,248,0.2);
      border-radius: 24px; padding: 30px;
      max-width: 400px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    ">
      <h3 style="color: #e0f2fe; font-size: 20px; margin-bottom: 8px; font-family: 'Nunito', sans-serif;">
        ✏️ Đổi tên hiển thị
      </h3>
      <p style="color: #7dd3fc; font-size: 13px; margin-bottom: 16px;">
        Tên mới (2–20 ký tự)
      </p>
      <input id="newNameInput" type="text" 
        value="${currentName}" 
        maxlength="20"
        style="
          width: 100%; padding: 12px 16px; border-radius: 12px;
          border: 1px solid rgba(56,189,248,0.25);
          background: rgba(0,0,0,0.3); color: #e0f2fe;
          font-size: 16px; outline: none; font-family: 'Nunito', sans-serif;
          margin-bottom: 12px;
        "
        placeholder="Nhập tên mới..."
      />
      <div id="nameError" style="color: #f87171; font-size: 13px; min-height: 20px; margin-bottom: 8px;"></div>
      <div style="display: flex; gap: 10px;">
        <button onclick="this.closest('div[style]').parentElement.remove()" style="
          flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
          background: none; color: #94a3b8; font-weight: 700; cursor: pointer;
          font-family: 'Nunito', sans-serif;
        ">Hủy</button>
        <button id="confirmNameBtn" style="
          flex: 1; padding: 12px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          color: #fff; font-weight: 700; cursor: pointer;
          font-family: 'Nunito', sans-serif;
          transition: all 0.2s;
        ">Xác nhận</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = modal.querySelector('#newNameInput');
  if (input) {
    input.focus();
    input.select();
  }
  
  const confirmBtn = modal.querySelector('#confirmNameBtn');
  const errorEl = modal.querySelector('#nameError');
  
  confirmBtn?.addEventListener('click', async () => {
    const newName = input?.value?.trim() || '';
    
    if (newName.length < 2) {
      if (errorEl) errorEl.textContent = '❌ Tên phải có ít nhất 2 ký tự!';
      return;
    }
    if (newName.length > 20) {
      if (errorEl) errorEl.textContent = '❌ Tên không được vượt quá 20 ký tự!';
      return;
    }
    if (newName === currentName) {
      if (errorEl) errorEl.textContent = '❌ Tên mới giống tên cũ!';
      return;
    }
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang xử lý...';
    if (errorEl) errorEl.textContent = '';
    
    try {
      await changeNickname(uid, newName);
      alert('✅ Đổi tên thành công!');
      modal.remove();
    } catch (e) {
      if (errorEl) errorEl.textContent = '❌ ' + e.message;
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Xác nhận';
    }
  });
  
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn?.click();
    if (e.key === 'Escape') modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function changeNickname(uid, newNickname) {
  const userRef = doc(db, 'users', uid);
  
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('Tài khoản không tồn tại');
  
  const q = query(collection(db, 'users'), where('nickname', '==', newNickname));
  const existing = await getDocs(q);
  if (!existing.empty && existing.docs[0].id !== uid) {
    throw new Error('Tên này đã được sử dụng!');
  }
  
  await updateDoc(userRef, { 
    nickname: newNickname,
    lastUpdate: new Date()
  });
}

// ── RANK & TITLES ────────────────────────────────────────
async function calcRank(uid) {
  try {
    const q = query(collection(db,'users'), orderBy('points','desc'), limit(100));
    const snaps = await getDocs(q);
    let rank = 0, idx = 1;
    snaps.forEach(d => { if(d.id === uid) rank = idx; idx++; });
    return rank > 0 ? rank : null;
  } catch { return null; }
}

function calcTitles(points, friends) {
  const t = [];
  if(points >= 100000)          t.push({ label:'Đại Phú Hào', cls:'gold' });
  else if(points >= 50000)      t.push({ label:'Đại Gia', cls:'gold' });
  if(friends.length >= 50)      t.push({ label:'Vua Ngoại Giao', cls:'purple' });
  else if(friends.length >= 10) t.push({ label:'Thân Thiện', cls:'green' });
  if(points >= 1000)            t.push({ label:'Người Chơi Mới', cls:'blue' });
  return t;
}

// ── LISTEN PROFILE ────────────────────────────────────────
function listenProfile(uid) {
  // Hủy listener cũ nếu có (tránh duplicate)
  if (_unsubProfile) { _unsubProfile(); _unsubProfile = null; }

  _unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: false },
    async snap => {
      if (!snap.exists()) return;
      // Bỏ qua snapshot từ cache local, chỉ xử lý data từ server
      if (snap.metadata.fromCache) return;

      const d = snap.data();
      const points  = Number(d.points || 0);
      const friends = d.friends || [];
      const joined  = d.createdAt
        ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
        : 'Mới tham gia';

      // Avatar
      const avatarEl = document.getElementById('pro-avatar');
      if (avatarEl) {
        if (d.avatarUrl && d.avatarUrl.startsWith('data:image')) {
          avatarEl.style.backgroundImage = `url(${d.avatarUrl})`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
        } else {
          const name = d.nickname || '?';
          avatarEl.style.backgroundImage = '';
          avatarEl.textContent = name.charAt(0).toUpperCase();
        }
      }

      // Ảnh bìa
      const coverImg = document.getElementById('pro-cover-img');
      const coverBg = document.getElementById('pro-cover-bg');
      if (coverImg && coverBg) {
        if (d.coverUrl && d.coverUrl.startsWith('data:image')) {
          coverImg.src = d.coverUrl;
          coverImg.style.display = 'block';
          coverBg.style.display = 'none';
        } else {
          coverImg.style.display = 'none';
          coverBg.style.display = 'block';
        }
      }

      const nm = document.getElementById('pro-name');
      if(nm) nm.textContent = d.nickname || 'Người dùng VT';

      const pe = document.getElementById('pro-points');
      if(pe) pe.textContent = points.toLocaleString('vi-VN');

      const fr = document.getElementById('pro-stat-friends');
      if(fr) fr.textContent = friends.length;
      const jo = document.getElementById('pro-stat-joined');
      if(jo) jo.textContent = joined;

      if (document.getElementById('pro-stat-rank')) {
        calcRank(uid).then(v => {
          if (typeof window.updateRankDisplay === 'function') {
            window.updateRankDisplay(v ?? 101);
          }
        });
      }

      const titles = calcTitles(points, friends);
      const tEl = document.getElementById('pro-titles-list');
      if(tEl) tEl.innerHTML = titles.length
        ? titles.map(t => `<span class="pro-title-badge ${t.cls}">${t.label}</span>`).join('')
        : '<span class="pro-title-empty">Chưa có danh hiệu</span>';

      // Ảnh cá nhân — chỉ cập nhật nếu field tồn tại trong document
      if (d.photoUrl) {
        renderPhoto(d.photoUrl);
      }

      try {
        renderProfilePet(uid, d.petCollection || d.pets || {}, d.activePet || null);
      } catch (e) {
        console.warn('renderProfilePet error:', e);
      }
    },
    err => console.error('onSnapshot:', err)
  );
}
