// ============================================================
// ===== PROFILE CARD - Popup hồ sơ nhỏ dùng chung cho mọi trang =====
// Cách dùng:
//   import { initProfileCard } from './profile-card.js';
//   initProfileCard({ db, getMyUid: () => _user.uid });
// Sau đó ở bất kỳ đâu chỉ cần:
//   <div onclick="window.showProfileCard('UID_CUA_NGUOI_DO')">...</div>
// (rooms.js, room-chat.js... đã sẵn gọi window.showProfileCard, chỉ cần
//  import + initProfileCard 1 lần trong file chính của trang là chạy được)
// ============================================================
import {
  doc, getDoc, getDocs, collection, updateDoc, deleteDoc, setDoc,
  arrayUnion, arrayRemove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let _db = null;
let _getMyUid = null;
let _built = false;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectStyles() {
  if (document.getElementById('pc-style')) return;
  const style = document.createElement('style');
  style.id = 'pc-style';
  style.textContent = `
#pc-overlay{position:fixed;inset:0;background:rgba(0,4,12,.7);backdrop-filter:blur(3px);z-index:99990;display:none;align-items:center;justify-content:center;padding:16px}
#pc-overlay.open{display:flex}
#pc-box{position:relative;width:min(340px,92vw);background:#0b0f1c;border:1px solid rgba(0,170,255,.25);border-radius:20px;box-shadow:0 0 30px rgba(0,140,255,.18),0 14px 40px rgba(0,0,0,.6);overflow:hidden;font-family:inherit}
#pc-close-x{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.2);color:#cfeeff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;font-weight:700;z-index:20;line-height:1}
#pc-close-x:hover{background:rgba(0,170,255,.25)}
#pc-cover{position:relative;height:110px;overflow:hidden}
#pc-cover-bg{position:absolute;inset:0;background:linear-gradient(135deg,rgba(56,189,248,.18) 0%,rgba(124,58,237,.22) 50%,rgba(52,211,153,.12) 100%);border-bottom:1px solid rgba(56,189,248,.15)}
#pc-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}
#pc-header-row{display:flex;align-items:flex-end;gap:10px;padding:0 16px 12px;position:relative;margin-top:-38px;z-index:5}
#pc-av-wrap{width:76px;height:76px;flex-shrink:0}
#pc-av-ring{width:76px;height:76px;border-radius:50%;padding:2px;background:linear-gradient(135deg,#38bdf8,#a78bfa,#34d399);box-shadow:0 0 0 3px #0b0f1c;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
#pc-av{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 30% 30%,#1cc8ff,#0050d8 70%);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;background-size:cover;background-position:center}
#pc-name-wrap{flex:1;padding-bottom:3px;min-width:0}
#pc-name{font-weight:500;font-size:16px;color:#e6f4ff;text-shadow:0 1px 8px rgba(0,0,0,.7),0 0 8px rgba(0,200,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pc-points-box{display:inline-flex;align-items:center;gap:5px;margin-top:5px;background:rgba(15,23,42,.75);backdrop-filter:blur(6px);border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:3px 10px}
#pc-points{font-family:'Science Gothic', sans-serif;font-size:12px;font-weight:500;color:#fbbf24}
#pc-points-label{font-size:10px;color:#fde68a;font-weight:400}
#pc-actions{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px}
.pc-row{display:flex;gap:8px}
.pc-btn{flex:1;padding:10px;border-radius:10px;font-weight:400;cursor:pointer;font-family:'Science Gothic', sans-serif;font-size:13px;text-align:center;border:none}
#pc-loading{padding:30px;text-align:center;color:#7fe3ff;font-size:13px}
`;
  document.head.appendChild(style);
}

function buildModal() {
  if (_built) return;
  _built = true;
  injectStyles();
  const overlay = document.createElement('div');
  overlay.id = 'pc-overlay';
  overlay.onclick = (e) => { if (e.target.id === 'pc-overlay') closeProfileCard(); };
  overlay.innerHTML = `
    <div id="pc-box">
      <button id="pc-close-x" onclick="window.closeProfileCard()">✕</button>
      <div id="pc-cover">
        <div id="pc-cover-bg"></div>
        <img id="pc-cover-img" />
      </div>
      <div id="pc-header-row">
        <div id="pc-av-wrap"><div id="pc-av-ring"><div id="pc-av">?</div></div></div>
        <div id="pc-name-wrap">
          <div id="pc-name">—</div>
          <div id="pc-points-box"><span>⭐</span><span id="pc-points">—</span><span id="pc-points-label">điểm</span></div>
        </div>
      </div>
      <div id="pc-actions"><div id="pc-loading">Đang tải...</div></div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeProfileCard() {
  const overlay = document.getElementById('pc-overlay');
  if (overlay) overlay.classList.remove('open');
}
window.closeProfileCard = closeProfileCard;

async function getFriendStatus(myUid, otherUid) {
  try {
    const mySnap = await getDoc(doc(_db, 'users', myUid));
    if (mySnap.exists() && (mySnap.data().friends || []).includes(otherUid)) return 'friends';
    const sentSnap = await getDoc(doc(_db, 'friendRequests', otherUid, 'requests', myUid));
    if (sentSnap.exists()) return 'pending_sent';
    const recvSnap = await getDoc(doc(_db, 'friendRequests', myUid, 'requests', otherUid));
    if (recvSnap.exists()) return 'pending_received';
    return 'none';
  } catch (e) {
    console.warn('[profile-card] getFriendStatus lỗi, fallback "none":', e);
    return 'none';
  }
}

async function sendFriendRequest(uid) {
  const myUid = _getMyUid();
  await setDoc(doc(_db, 'friendRequests', uid, 'requests', myUid), { fromUid: myUid, toUid: uid, createdAt: serverTimestamp() });
  window.showToast ? window.showToast('Đã gửi lời mời kết bạn', 'success') : null;
  showProfileCard(uid);
}
async function acceptFriend(uid) {
  const myUid = _getMyUid();
  await updateDoc(doc(_db, 'users', myUid), { friends: arrayUnion(uid) });
  await updateDoc(doc(_db, 'users', uid), { friends: arrayUnion(myUid) });
  await deleteDoc(doc(_db, 'friendRequests', myUid, 'requests', uid));
  showProfileCard(uid);
}
async function declineFriend(uid) {
  const myUid = _getMyUid();
  await deleteDoc(doc(_db, 'friendRequests', myUid, 'requests', uid));
  showProfileCard(uid);
}
async function unfriend(uid) {
  const myUid = _getMyUid();
  await updateDoc(doc(_db, 'users', myUid), { friends: arrayRemove(uid) });
  await updateDoc(doc(_db, 'users', uid), { friends: arrayRemove(myUid) });
  showProfileCard(uid);
}
window.pcSendFriendRequest = sendFriendRequest;
window.pcAcceptFriend = acceptFriend;
window.pcDeclineFriend = declineFriend;
window.pcUnfriend = unfriend;
window.pcMessage = (uid, name) => { location.href = 'chat.html?uid=' + uid + '&name=' + encodeURIComponent(name || ''); };

function renderActions(uid, data, status) {
  const area = document.getElementById('pc-actions');
  const myUid = _getMyUid();
  const name = data.nickname || data.email?.split('@')[0] || '?';
  if (uid === myUid) {
    area.innerHTML = '<p style="color:#7dd3fc;font-size:13px;text-align:center;padding:8px 0">✨ Đây là bạn!</p>';
    return;
  }
  if (status === 'friends') {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcMessage('${uid}','${esc(name)}')">💬 Nhắn tin</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="location.href='profile.html?uid=${uid}'">👤 Hồ sơ</button>
      </div>
      <button class="pc-btn" style="width:100%;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171" onclick="window.pcUnfriend('${uid}')">Hủy kết bạn</button>`;
  } else if (status === 'pending_sent') {
    area.innerHTML = `<div style="text-align:center;padding:10px;border-radius:10px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.2);color:#7dd3fc;font-weight:700;font-size:13px">⏳ Đã gửi lời mời kết bạn</div>`;
  } else if (status === 'pending_received') {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#34d399,#059669);color:#fff" onclick="window.pcAcceptFriend('${uid}')">✅ Chấp nhận</button>
        <button class="pc-btn" style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171" onclick="window.pcDeclineFriend('${uid}')">❌ Từ chối</button>
      </div>`;
  } else {
    area.innerHTML = `
      <div class="pc-row">
        <button class="pc-btn" style="background:linear-gradient(135deg,#0ea5e9,#38bdf8);color:#fff" onclick="window.pcSendFriendRequest('${uid}')">➕ Kết bạn</button>
        <button class="pc-btn" style="background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8" onclick="location.href='profile.html?uid=${uid}'">👤 Hồ sơ</button>
      </div>`;
  }
}

export async function showProfileCard(uid) {
  if (!_db || !_getMyUid) { console.error('[profile-card] chưa gọi initProfileCard()'); return; }
  buildModal();
  document.getElementById('pc-overlay').classList.add('open');
  document.getElementById('pc-actions').innerHTML = '<div id="pc-loading">Đang tải...</div>';
  try {
    const snap = await getDoc(doc(_db, 'users', uid));
    if (!snap.exists()) {
      document.getElementById('pc-actions').innerHTML = '<p style="color:#f87171;font-size:13px;text-align:center">Không tìm thấy người dùng.</p>';
      return;
    }
    const data = snap.data();
    const name = data.nickname || data.email?.split('@')[0] || '?';
    const colors = ['#a78bfa,#7c3aed','#38bdf8,#0ea5e9','#34d399,#059669','#fbbf24,#f59e0b','#f87171,#ef4444'];
    const colorIdx = uid.charCodeAt(0) % colors.length;
    const avEl = document.getElementById('pc-av');
    if (data.avatarUrl) {
      avEl.style.background = `url(${data.avatarUrl}) center/cover`;
      avEl.textContent = '';
    } else {
      avEl.style.background = `linear-gradient(135deg,${colors[colorIdx]})`;
      avEl.textContent = name[0].toUpperCase();
    }
    const coverImg = document.getElementById('pc-cover-img');
    const coverBg = document.getElementById('pc-cover-bg');
    if (data.coverUrl) {
      coverImg.src = data.coverUrl;
      coverImg.style.display = 'block';
      coverBg.style.display = 'none';
    } else {
      coverImg.style.display = 'none';
      coverBg.style.display = 'block';
    }
    document.getElementById('pc-name').textContent = name;
    document.getElementById('pc-points').textContent = (data.points ?? 0).toLocaleString('vi-VN');
    const status = await getFriendStatus(_getMyUid(), uid);
    renderActions(uid, data, status);
  } catch (e) {
    console.error('[profile-card] error:', e);
    document.getElementById('pc-actions').innerHTML = '<p style="color:#f87171;font-size:13px;text-align:center">Lỗi tải hồ sơ.</p>';
  }
}

export function initProfileCard({ db, getMyUid }) {
  _db = db;
  _getMyUid = getMyUid;
  window.showProfileCard = showProfileCard;
}
