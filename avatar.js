// avatar.js — Dùng chung để render avatar người dùng
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

const _app = getApps().length ? getApps()[0] : initializeApp({
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",
  storageBucket:"lienquan-fake.firebasestorage.app",
  messagingSenderId:"782694799992",
  appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
});
const _db   = getFirestore(_app);
const _auth = getAuth(_app);

/**
 * Render avatar vào element.
 * el: DOM element (div hoặc img wrapper)
 * user: { nickname, avatarUrl }
 * size: css string (mặc định '38px')
 */
export function renderAvatar(el, user, size = '38px') {
  if (!el) return;
  const letter = (user?.nickname || user?.email || '?').charAt(0).toUpperCase();
  if (user?.avatarUrl) {
    el.style.backgroundImage  = `url(${user.avatarUrl})`;
    el.style.backgroundSize   = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = letter;
  }
  el.style.width        = size;
  el.style.height       = size;
  el.style.borderRadius = '50%';
  el.style.display      = 'flex';
  el.style.alignItems   = 'center';
  el.style.justifyContent = 'center';
  el.style.fontWeight   = '900';
  el.style.fontSize     = `calc(${size} * 0.4)`;
  el.style.color        = '#fff';
  el.style.flexShrink   = '0';
  if (!user?.avatarUrl) {
    el.style.background = 'linear-gradient(135deg,#0ea5e9,#38bdf8)';
  }
}

/**
 * Trả về HTML string cho avatar (dùng trong innerHTML)
 * user: { nickname, avatarUrl }
 * size: px number
 * extraStyle: css string thêm
 */
export function avatarHtml(user, size = 38, extraStyle = '') {
  const letter = (user?.nickname || user?.email || '?').charAt(0).toUpperCase();
  if (user?.avatarUrl) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:url(${user.avatarUrl}) center/cover;flex-shrink:0;${extraStyle}"></div>`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#38bdf8);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.floor(size*0.4)}px;color:#fff;flex-shrink:0;${extraStyle}">${letter}</div>`;
}
window.showProfileCard = async function(uid) {
  if (!uid) return;
  let overlay = document.getElementById('_profile-card-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_profile-card-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;align-items:center;justify-content:center';
    overlay.innerHTML = `<div id="_profile-card" style="background:rgba(4,20,40,0.98);border:1px solid rgba(56,189,248,0.25);border-radius:20px;padding:24px;width:90%;max-width:320px;text-align:center;position:relative">
      <button onclick="document.getElementById('_profile-card-overlay').style.display='none'" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#7dd3fc;font-size:20px;cursor:pointer">✕</button>
      <div id="_pc-avatar" style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;background:linear-gradient(135deg,#0ea5e9,#38bdf8)"></div>
      <div id="_pc-name" style="color:#e0f2fe;font-weight:900;font-size:18px;margin-bottom:4px"></div>
      <div id="_pc-pts" style="color:#38bdf8;font-size:13px;font-weight:700;margin-bottom:16px"></div>
      <div id="_pc-actions" style="display:flex;gap:8px;justify-content:center"></div>
    </div>`;
    overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none'; };
    document.body.appendChild(overlay);
  }

  overlay.style.display = 'flex';
  const av = document.getElementById('_pc-avatar');
  av.style.backgroundImage = '';
  av.textContent = '...';
  document.getElementById('_pc-name').textContent = '...';
  document.getElementById('_pc-pts').textContent = '';
  document.getElementById('_pc-actions').innerHTML = '';

  try {
    const snap = await getDoc(doc(_db, 'users', uid));
    if (!snap.exists()) return;
    const d = snap.data();

    // Avatar
    if (d.avatarUrl) {
      av.style.background = `url(${d.avatarUrl}) center/cover`;
      av.textContent = '';
    } else {
      av.style.background = 'linear-gradient(135deg,#0ea5e9,#38bdf8)';
      av.textContent = (d.nickname || '?')[0].toUpperCase();
    }

    document.getElementById('_pc-name').textContent = d.nickname || 'Người dùng';
    document.getElementById('_pc-pts').textContent = '⭐ ' + (d.points || 0).toLocaleString('vi') + ' đ';

    const me = _auth.currentUser;
    const actions = document.getElementById('_pc-actions');
    const btnStyle = 'padding:9px 16px;border-radius:10px;border:none;font-weight:700;cursor:pointer;font-family:Nunito,sans-serif;font-size:13px';

    let friendBtn = '';
    if (me && me.uid !== uid) {
      const mySnap = await getDoc(doc(_db, 'users', me.uid));
      const friends = mySnap.data()?.friends || [];
      if (friends.includes(uid)) {
        friendBtn = `<button onclick="window.openConvoWithUid&&window.openConvoWithUid('${uid}','${(d.nickname||'').replace(/'/g,"\\'")}');document.getElementById('_profile-card-overlay').style.display='none'" style="${btnStyle};background:rgba(52,211,153,0.12);color:#34d399">💬 Nhắn tin</button>`;
      } else {
        friendBtn = `<button onclick="window._sendFriendRequest&&window._sendFriendRequest('${uid}');this.textContent='✅ Đã gửi';this.disabled=true" style="${btnStyle};background:rgba(167,139,250,0.12);color:#a78bfa">➕ Kết bạn</button>`;
      }
    }

    actions.innerHTML = `
      <button onclick="location.href='profile.html?uid=${uid}'" style="${btnStyle};background:rgba(56,189,248,0.12);color:#38bdf8">👤 Hồ sơ</button>
      ${friendBtn}
    `;
  } catch(e) { console.error(e); }
};