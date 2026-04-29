// profile.js — dùng chung db/auth từ points.js
import { db, auth } from './points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, onSnapshot, updateDoc, getDocs, collection,
  orderBy, query, limit, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderAvatar } from './avatar.js';
import { renderProfilePet, mountPetModal } from './pet-ui.js';
import './character.js';

let currentUser = null;

let authResolved = false;
onAuthStateChanged(auth, async user => {
  authResolved = true;
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;
  mountPetModal();
  const viewUid = new URLSearchParams(window.location.search).get('uid') || user.uid;
  const isOwner = viewUid === user.uid;

  listenProfile(viewUid);

  // Luôn render nhân vật theo đúng viewUid (tránh hiện nhân vật của người đang login)
  const { renderChibiForUid } = await import('./character.js');
  const frame = document.getElementById('pro-character-frame');
  if (frame) renderChibiForUid(frame, viewUid);
  
  // Hiển thị nút đổi avatar nếu là chủ
  const uploadBtn = document.getElementById('pro-avatar-upload-btn');
  if (uploadBtn) uploadBtn.style.display = isOwner ? 'flex' : 'none';

  // Nếu là chủ, cho phép nhấn vào tên để đổi
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
        await updateDoc(doc(db, 'users', user.uid), { avatarUrl: reader.result });
        alert('✅ Đổi avatar thành công!');
      };
      reader.readAsDataURL(file);
    } catch(err) { alert('Lỗi: ' + err.message); }
  });
});

// ── ĐỔI TÊN (MIỄN PHÍ) ──────────────────────────────────
async function showChangeNicknameModal(uid) {
  const currentName = document.getElementById('pro-name')?.textContent || '';
  const newName = prompt('Nhập tên mới (2–20 ký tự):', currentName);
  if (!newName || newName.trim().length < 2 || newName.trim().length > 20) {
    alert('Tên phải từ 2 đến 20 ký tự!');
    return;
  }
  if (newName.trim() === currentName) {
    alert('Tên mới giống tên cũ!');
    return;
  }
  try {
    await changeNickname(uid, newName.trim());
    alert('✅ Đổi tên thành công!');
    // onSnapshot sẽ tự cập nhật giao diện
  } catch (e) {
    alert('❌ ' + e.message);
  }
}

async function changeNickname(uid, newNickname) {
  const userRef = doc(db, 'users', uid);
  // Kiểm tra tài khoản tồn tại
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('Tài khoản không tồn tại');
  
  // Chỉ cập nhật nickname, không trừ điểm
  await updateDoc(userRef, { nickname: newNickname });
}

// ── RANK & TITLES ────────────────────────────────────────
async function calcRank(uid) {
  try {
    const q = query(collection(db,'users'), orderBy('points','desc'), limit(100));
    const snaps = await getDocs(q);
    let rank = 0, idx = 1;
    snaps.forEach(d => { if(d.id === uid) rank = idx; idx++; });
    return rank > 0 ? `#${rank}` : '100+';
  } catch { return '—'; }
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

function listenProfile(uid) {
  onSnapshot(doc(db, 'users', uid), async snap => {
    if(!snap.exists()) return;
    const d       = snap.data();
    const points  = Number(d.points || 0);
    const friends = d.friends || [];
    const joined  = d.createdAt
      ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('vi-VN')
      : 'Mới tham gia';

    renderAvatar(document.getElementById('pro-avatar'), d, '80px');
    const nm = document.getElementById('pro-name');
    if(nm) nm.textContent = d.nickname || 'Người dùng VT';

    const pe = document.getElementById('pro-points');
    if(pe) pe.textContent = points.toLocaleString('vi-VN');

    const fr = document.getElementById('pro-stat-friends');
    if(fr) fr.textContent = friends.length;
    const jo = document.getElementById('pro-stat-joined');
    if(jo) jo.textContent = joined;

    const rk = document.getElementById('pro-stat-rank');
    if(rk) { rk.textContent = '...'; calcRank(uid).then(v => rk.textContent = v); }

    const titles = calcTitles(points, friends);
    const tEl = document.getElementById('pro-titles-list');
    if(tEl) tEl.innerHTML = titles.length
      ? titles.map(t => `<span class="pro-title-badge ${t.cls}">${t.label}</span>`).join('')
      : '<span class="pro-title-empty">Chưa có danh hiệu</span>';

    renderProfilePet(uid, d.petCollection || {}, d.activePet || null);
  }, err => console.error('onSnapshot:', err));
}