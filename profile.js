// profile.js — dùng chung db/auth từ points.js
import { db, auth } from './points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, onSnapshot, updateDoc, getDocs, collection, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderAvatar } from './avatar.js';
import { renderProfilePet, mountPetModal } from './pet-ui.js';
import './character.js';

let currentUser = null;

onAuthStateChanged(auth, user => {
  if (!user) { location.href = 'index.html'; return; }
  currentUser = user;
  mountPetModal();
  const viewUid = new URLSearchParams(window.location.search).get('uid') || user.uid;
  listenProfile(viewUid);
  const isOwner = viewUid === user.uid;
  const uploadBtn = document.getElementById('pro-avatar-upload-btn');
  if (uploadBtn) uploadBtn.style.display = isOwner ? 'flex' : 'none';

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