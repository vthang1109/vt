// ===== chat.js – Toàn bộ logic trang Chat =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, updateDoc,
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ===== PARTICLE CANVAS =====
const canvas = document.getElementById('bg-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 40; i++) {
    particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4, r: Math.random()*1.5+.5 });
  }
  (function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0;
      if(p.y<0)p.y=canvas.height; if(p.y>canvas.height)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(56,189,248,0.5)'; ctx.fill();
    });
    for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++) {
      const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<100){ ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y);
        ctx.strokeStyle=`rgba(56,189,248,${0.07*(1-d/100)})`; ctx.lineWidth=.5; ctx.stroke(); }
    }
    requestAnimationFrame(draw);
  })();
}

// ===== UTILS =====
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
window.showToast = function(msg, type = 'info') {
  const colors = { info:'#38bdf8', success:'#34d399', warn:'#fbbf24', error:'#f87171' };
  const t = document.createElement('div');
  t.style.cssText = `pointer-events:all;padding:11px 16px;border-radius:12px;background:rgba(4,20,40,0.97);border:1px solid ${colors[type]||'#38bdf8'};color:#e0f2fe;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:fadeUp 0.3s both;max-width:280px`;
  t.innerHTML = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3800);
};

// ===== CHAT STATE =====
let currentConvoId   = 'server';
let currentConvoName = '🌐 Chat toàn server';
let currentConvoUid  = null;
let _chatUnsubscribe = null;
let _currentUser     = null;

// ===== AUTH GUARD =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  _currentUser = user;
  await _initChat();
});

// ===== INIT =====
async function _initChat() {
  // FIX 1: onSnapshot lời mời → tự re-render khi lời mời bị xóa (sau accept/decline)
  _listenFriendRequests(_currentUser.uid);

  // FIX 2: onSnapshot doc user của mình → khi phía kia accept → friends array thay đổi
  // → snapshot bắn → fetch fresh data → re-render sidebar ngay, không dùng cache
  onSnapshot(doc(db, 'users', _currentUser.uid), async (snap) => {
    if (!snap.exists()) return;
    const friendUids = snap.data().friends || [];
    const friends = [];
    for (const fuid of friendUids) {
      const fs = await getDoc(doc(db, 'users', fuid));
      if (fs.exists()) friends.push({ uid: fuid, ...fs.data() });
    }
    _renderFriendsInChatFromList(friends);
  });

  renderAllUsersInChat();
  _listenIncomingDMs();

  // Đảm bảo room __server__ tồn tại (chat.html không load app.js)
  try {
    const serverRef = doc(db, 'chats', 'server');
    const serverSnap = await getDoc(serverRef);
    if (!serverSnap.exists()) {
      console.log('Tạo room __server__...');
      await setDoc(serverRef, { createdAt: serverTimestamp(), name: 'Global Chat', members: [] });
      console.log('✅ Room __server__ đã tạo');
    } else {
      console.log('✅ Room __server__ đã tồn tại');
    }
  } catch(e) { 
    console.error('❌ Lỗi tạo server room:', e);
    window.showToast('❌ Lỗi tạo room chat: ' + e.message, 'error');
  }

  // Chỉ tự mở server chat trên desktop, mobile thì để user tự chọn
  const isMobile = window.innerWidth <= 640;
  if (!isMobile) {
    openConvo('server', '🌐 Chat toàn server', null, 'server');
  }
}

// ===== FIRESTORE HELPERS =====
function getDmId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

async function getUserData(uid, callback) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    callback(snap.exists() ? snap.data() : null);
  } catch(e) { callback(null); }
}

async function getAllUsers(callback) {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = [];
    snap.forEach(d => users.push(d.data()));
    callback(users);
  } catch(e) { callback([]); }
}

function listenMessages(convoId, callback) {
  const roomId = convoId === 'server'
    ? 'server'
    : getDmId(_currentUser.uid, convoId);
  const q = query(
    collection(db, 'chats', roomId, 'messages'),
    orderBy('createdAt'),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    const msgs = [];
    snap.forEach(d => {
      const data = d.data();
      const ts   = data.createdAt?.toDate();
      const time = ts
        ? ts.getHours().toString().padStart(2,'0') + ':' + ts.getMinutes().toString().padStart(2,'0')
        : '';
      msgs.push({ ...data, time });
    });
    callback(msgs);
  });
}

async function sendMessage(convoId, text) {
  if (!_currentUser) throw new Error('Not logged in');
  const roomId = convoId === 'server'
    ? 'server'
    : getDmId(_currentUser.uid, convoId);
  const snap = await getDoc(doc(db, 'users', _currentUser.uid));
  const senderName = snap.exists() && snap.data().nickname
    ? snap.data().nickname
    : (_currentUser.displayName || _currentUser.email.split('@')[0]);
  console.log('Gửi vào roomId:', roomId, 'senderName:', senderName);
  return await addDoc(collection(db, 'chats', roomId, 'messages'), {
    text,
    senderUid:  _currentUser.uid,
    senderName,
    createdAt:  serverTimestamp()
  });
}

// ===== FRIEND HELPERS =====
async function getMyFriends(uid, callback) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) { callback([]); return; }
    const friendUids = snap.data().friends || [];
    const friends = [];
    for (const fuid of friendUids) {
      const fs = await getDoc(doc(db, 'users', fuid));
      if (fs.exists()) friends.push({ uid: fuid, ...fs.data() });
    }
    callback(friends);
  } catch(e) { callback([]); }
}

async function getFriendRequests(uid, callback) {
  try {
    const snap = await getDocs(collection(db, 'friendRequests', uid, 'requests'));
    const reqs = [];
    for (const d of snap.docs) {
      const fromUid  = d.data().fromUid;
      const userSnap = await getDoc(doc(db, 'users', fromUid));
      if (userSnap.exists()) reqs.push({ uid: fromUid, ...userSnap.data() });
    }
    callback(reqs);
  } catch(e) { callback([]); }
}

async function getFriendStatus(myUid, otherUid, callback) {
  try {
    const mySnap = await getDoc(doc(db, 'users', myUid));
    if (mySnap.exists()) {
      const friends = mySnap.data().friends || [];
      if (friends.includes(otherUid)) { callback('friends'); return; }
    }
    const sentSnap = await getDoc(doc(db, 'friendRequests', otherUid, 'requests', myUid));
    if (sentSnap.exists()) { callback('pending_sent'); return; }
    const recvSnap = await getDoc(doc(db, 'friendRequests', myUid, 'requests', otherUid));
    if (recvSnap.exists()) { callback('pending_received'); return; }
    callback('none');
  } catch(e) { callback('none'); }
}

// FIX 1: onSnapshot lời mời → gọi renderFriendRequestsList() mỗi khi có thay đổi
// Khi deleteDoc lời mời sau accept/decline → snapshot fire → list tự xóa lời mời đó
function _listenFriendRequests(uid) {
  onSnapshot(collection(db, 'friendRequests', uid, 'requests'), (snap) => {
    // Luôn re-render danh sách lời mời
    renderFriendRequestsList();

    // Chỉ toast khi có lời mời MỚI
    snap.docChanges().forEach(async change => {
      if (change.type === 'added') {
        const fromUid  = change.doc.data().fromUid;
        const userSnap = await getDoc(doc(db, 'users', fromUid));
        const name     = userSnap.exists() ? (userSnap.data().nickname || 'Ai đó') : 'Ai đó';
        window.showToast(`📨 <strong>${escHtml(name)}</strong> muốn kết bạn với bạn!`, 'warn');
      }
    });
  });
}

// Lắng nghe DM đến – toast + badge đỏ
function _listenIncomingDMs() {
  getMyFriends(_currentUser.uid, (friends) => {
    friends.forEach(f => {
      const roomId = getDmId(_currentUser.uid, f.uid);
      const q = query(
        collection(db, 'chats', roomId, 'messages'),
        orderBy('createdAt'),
        limit(1)
      );
      onSnapshot(q, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const msg = change.doc.data();
            if (msg.senderUid !== _currentUser.uid && currentConvoId !== f.uid) {
              const name = f.nickname || '?';
              window.showToast(`💬 <strong>${escHtml(name)}</strong>: ${escHtml((msg.text||'').slice(0,40))}`, 'info');
              const contactEl = document.getElementById('contact-' + f.uid);
              if (contactEl) {
                let badge = contactEl.querySelector('.dm-badge');
                if (!badge) {
                  badge = document.createElement('span');
                  badge.className = 'dm-badge';
                  badge.style.cssText = 'background:#f87171;color:#fff;border-radius:999px;font-size:10px;font-weight:800;padding:1px 6px;margin-left:4px';
                  contactEl.querySelector('.chat-contact-name')?.appendChild(badge);
                }
                badge.textContent = '●';
              }
            }
          }
        });
      });
    });
  });
}

// ===== OPEN CONVO =====
window.openConvo = function(uid, name, avatarChar, type) {
  currentConvoId   = uid;
  currentConvoName = name;
  currentConvoUid  = (type === 'server') ? null : uid;

  // Xóa badge khi mở chat
  const badgeEl = document.getElementById('contact-' + uid);
  if (badgeEl) { const b = badgeEl.querySelector('.dm-badge'); if (b) b.remove(); }

  document.querySelectorAll('.chat-contact').forEach(c => c.classList.remove('active'));
  const el = document.getElementById('contact-' + uid);
  if (el) el.classList.add('active');

  const av = document.getElementById('chatWinAvatar');
  document.getElementById('chatWinName').textContent = name;
  if (avatarChar) {
    av.textContent = avatarChar;
    av.style.fontSize   = '15px';
    av.style.background = 'linear-gradient(135deg,#a78bfa,#7c3aed)';
  } else {
    av.textContent = '🌐';
    av.style.fontSize   = '18px';
    av.style.background = 'linear-gradient(135deg,#38bdf8,#0ea5e9)';
  }

  const box = document.getElementById('chatWindowMessages');
  box.innerHTML = '<div class="cwm-msg system-msg">Đang tải...</div>';

  if (_chatUnsubscribe) { _chatUnsubscribe(); _chatUnsubscribe = null; }

  _chatUnsubscribe = listenMessages(uid, (msgs) => {
    box.innerHTML = '';
    if (!msgs.length) {
      box.innerHTML = '<div class="cwm-msg system-msg">Chưa có tin nhắn nào 👋</div>';
    }
    msgs.forEach(m => {
      const div   = document.createElement('div');
      const isMe  = _currentUser && m.senderUid === _currentUser.uid;
      div.className = 'cwm-msg ' + (isMe ? 'mine-msg' : 'other-msg');
      div.innerHTML = isMe
        ? `<span class="cwm-bubble">${escHtml(m.text)}</span><span class="cwm-time">${m.time}</span>`
        : `<span class="cwm-user">${escHtml(m.senderName)}</span><span class="cwm-bubble">${escHtml(m.text)}</span><span class="cwm-time">${m.time}</span>`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });

  document.getElementById('chatWindow').classList.add('active');
  document.getElementById('chatSidebar').classList.add('mobile-hidden');
};

window.backToSidebar = function() {
  document.getElementById('chatWindow').classList.remove('active');
  document.getElementById('chatSidebar').classList.remove('mobile-hidden');
};

window.sendWindowChat = function() {
  const input = document.getElementById('chatWindowInput');
  const val   = input.value.trim();
  if (!val) return;
  if (!_currentUser) { window.showToast('⚠️ Đăng nhập để chat!', 'warn'); return; }
  console.log('Gửi tin vào:', currentConvoId, 'Text:', val);
  sendMessage(currentConvoId, val).catch(e => {
    console.error('Lỗi gửi tin:', e);
    window.showToast('❌ Gửi thất bại: ' + e.message, 'error');
  });
  input.value = '';
};

// ===== FILTER CONTACTS =====
window.filterContacts = function() {
  const q = document.getElementById('chatSearchInput').value.toLowerCase();
  document.querySelectorAll('#chatContactList .chat-contact').forEach(c => {
    const nm = c.querySelector('.chat-contact-name');
    c.style.display = nm && nm.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

// ===== TABS =====
let _currentTab = 'chat';
window.switchTab = function(tab) {
  _currentTab = tab;
  const btn = document.getElementById('tab-toggle-btn');
  if (tab === 'friends') {
    document.getElementById('tab-chat-panel').style.display    = 'none';
    document.getElementById('tab-friends-panel').style.display = 'flex';
    btn.textContent = '💬 Chat';
    btn.onclick = () => window.switchTab('chat');
    renderFriendRequestsList();
    renderMyFriendsList();
  } else {
    document.getElementById('tab-chat-panel').style.display    = 'flex';
    document.getElementById('tab-friends-panel').style.display = 'none';
    btn.textContent = '👥 Bạn bè';
    btn.onclick = () => window.switchTab('friends');
  }
};

// ===== RENDER: FRIENDS IN SIDEBAR =====
// FIX 2: Nhận list trực tiếp từ onSnapshot data (không dùng cache getDoc cũ)
function _renderFriendsInChatFromList(friends) {
  const el = document.getElementById('friendsInChat');
  if (!el) return;
  el.innerHTML = '';
  if (!friends.length) return;
  const label = document.createElement('div');
  label.className = 'contact-section-label';
  label.textContent = '👥 Bạn bè';
  el.appendChild(label);
  friends.forEach(f => {
    const name = f.nickname || '?';
    const div  = document.createElement('div');
    div.className = 'chat-contact';
    div.id        = 'contact-' + f.uid;
    div.onclick   = () => window.openConvo(f.uid, name, name[0].toUpperCase(), 'dm');
    div.innerHTML = `
      <div class="chat-contact-avatar" style="background:linear-gradient(135deg,#34d399,#059669)">${name[0].toUpperCase()}</div>
      <div class="chat-contact-info">
        <span class="chat-contact-name">${escHtml(name)} <span class="chat-online-dot"></span></span>
        <span class="chat-contact-preview">Nhấn để nhắn tin</span>
      </div>`;
    el.appendChild(div);
  });
}

function renderFriendsInChat() {
  if (!_currentUser) return;
  getMyFriends(_currentUser.uid, (friends) => _renderFriendsInChatFromList(friends));
}

// ===== RENDER: ALL USERS IN SIDEBAR =====
function renderAllUsersInChat() {
  if (!_currentUser) return;
  getAllUsers((users) => {
    const el = document.getElementById('allUsersInChat');
    el.innerHTML = '';
    const others = users.filter(u => u.uid !== _currentUser.uid);
    if (!others.length) return;
    const label = document.createElement('div');
    label.className = 'contact-section-label';
    label.textContent = '🌐 Tất cả người dùng';
    el.appendChild(label);
    others.forEach(u => {
      const name = u.nickname || u.email?.split('@')[0] || '?';
      const div  = document.createElement('div');
      div.className = 'chat-contact';
      div.onclick   = () => viewUserProfile(u.uid);
      div.innerHTML = `
        <div class="chat-contact-avatar" style="background:linear-gradient(135deg,#a78bfa,#7c3aed)">${name[0].toUpperCase()}</div>
        <div class="chat-contact-info">
          <span class="chat-contact-name">${escHtml(name)}</span>
          <span class="chat-contact-preview" style="color:#a78bfa">Nhấn để xem profile</span>
        </div>`;
      el.appendChild(div);
    });
  });
}

// ===== RENDER: FRIEND REQUESTS =====
// FIX 1: Được gọi từ onSnapshot → tự xóa lời mời khỏi UI sau khi accept/decline
function renderFriendRequestsList() {
  if (!_currentUser) return;
  getFriendRequests(_currentUser.uid, (reqs) => {
    const el = document.getElementById('friendRequestsList');
    if (!el) return;
    if (!reqs.length) {
      el.innerHTML = '<p style="color:#4a7a9b;font-size:12px;padding:8px 6px">Không có lời mời nào.</p>';
      return;
    }
    el.innerHTML = '';
    reqs.forEach(r => {
      const name = r.nickname || '?';
      const div  = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:10px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.15);margin-bottom:6px';
      div.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1a0a00;font-size:13px;flex-shrink:0">${name[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;font-weight:700;font-size:13px;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</div>
        <button onclick="acceptFriend('${r.uid}')" style="padding:5px 9px;border-radius:8px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">✅</button>
        <button onclick="declineFriend('${r.uid}')" style="padding:5px 9px;border-radius:8px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);color:#f87171;cursor:pointer;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">❌</button>`;
      el.appendChild(div);
    });
  });
}

// ===== RENDER: MY FRIENDS LIST (tab bạn bè) =====
function renderMyFriendsList() {
  if (!_currentUser) return;
  getMyFriends(_currentUser.uid, (friends) => {
    const el = document.getElementById('myFriendsList');
    if (!el) return;
    if (!friends.length) {
      el.innerHTML = '<p style="color:#4a7a9b;font-size:12px;padding:8px 6px">Chưa có bạn bè. Thêm ai đó nhé!</p>';
      return;
    }
    el.innerHTML = '';
    friends.forEach(f => {
      const name = f.nickname || '?';
      const div  = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:10px;background:rgba(52,211,153,0.04);border:1px solid rgba(52,211,153,0.1);margin-bottom:6px;cursor:pointer';
      div.onclick = () => viewUserProfile(f.uid);
      div.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#34d399,#059669);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px;flex-shrink:0">${name[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;font-weight:700;font-size:13px;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)} <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;vertical-align:middle;margin-left:4px"></span></div>
        <button onclick="event.stopPropagation();openConvoWithUid('${f.uid}','${escHtml(name)}')" style="padding:5px 9px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);color:#34d399;cursor:pointer;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">💬</button>`;
      el.appendChild(div);
    });
  });
}

// ===== VIEW PROFILE =====
window.viewCurrentProfile = function() {
  if (!currentConvoUid) return;
  viewUserProfile(currentConvoUid);
};

function viewUserProfile(uid) {
  if (!_currentUser) { window.showToast('⚠️ Hãy đăng nhập!', 'warn'); return; }
  getUserData(uid, (data) => {
    if (!data) { window.showToast('Không tìm thấy người dùng.', 'error'); return; }
    const nickname = data.nickname || data.email?.split('@')[0] || '?';
    document.getElementById('vp-avatar').textContent = nickname[0].toUpperCase();
    document.getElementById('vp-name').textContent   = nickname;
    document.getElementById('vp-email').textContent  = data.email || '';
    renderViewProfileActions(uid, { ...data, nickname });
    document.getElementById('viewProfileModal').classList.add('open');
  });
}

function renderViewProfileActions(uid, data) {
  const area = document.getElementById('vp-action-area');
  if (uid === _currentUser.uid) {
    area.innerHTML = '<p style="color:#7dd3fc;font-size:13px;text-align:center;padding:8px 0">✨ Đây là bạn!</p>';
    return;
  }
  getFriendStatus(_currentUser.uid, uid, (status) => {
    if (status === 'friends') {
      area.innerHTML = `<div style="display:flex;gap:8px">
        <button onclick="openConvoWithUid('${uid}','${escHtml(data.nickname)}')" style="flex:1;padding:10px;border-radius:10px;background:linear-gradient(135deg,#34d399,#059669);border:none;color:#fff;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">💬 Nhắn tin</button>
        <button onclick="unfriend('${uid}')" style="flex:1;padding:10px;border-radius:10px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">Hủy kết bạn</button>
      </div>`;
    } else if (status === 'pending_sent') {
      area.innerHTML = `<div style="text-align:center;padding:10px;border-radius:10px;background:rgba(56,189,248,0.07);border:1px solid rgba(56,189,248,0.2);color:#7dd3fc;font-weight:700;font-size:13px">⏳ Đã gửi lời mời kết bạn</div>`;
    } else if (status === 'pending_received') {
      area.innerHTML = `<div style="display:flex;gap:8px">
        <button onclick="acceptFriend('${uid}')" style="flex:1;padding:10px;border-radius:10px;background:linear-gradient(135deg,#34d399,#059669);border:none;color:#fff;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">✅ Chấp nhận</button>
        <button onclick="declineFriend('${uid}')" style="flex:1;padding:10px;border-radius:10px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:#f87171;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">❌ Từ chối</button>
      </div>`;
    } else {
      area.innerHTML = `<button onclick="sendFriendRequest('${uid}')" style="width:100%;padding:10px;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);border:none;color:#fff;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">➕ Kết bạn</button>`;
    }
  });
}

window.closeViewProfile = function(e) {
  if (!e || e.target === document.getElementById('viewProfileModal')) {
    document.getElementById('viewProfileModal').classList.remove('open');
  }
};

// ===== FRIEND ACTIONS =====
window.openConvoWithUid = function(uid, name) {
  window.closeViewProfile();
  // Về tab chat trước
  window.switchTab('chat');
  // Mở convo sau khi tab đã switch
  setTimeout(() => {
    window.openConvo(uid, name, name[0].toUpperCase(), 'dm');
  }, 200);
};

window.sendFriendRequest = async function(toUid) {
  const myUid = _currentUser.uid;
  try {
    await setDoc(doc(db, 'friendRequests', toUid, 'requests', myUid), {
      fromUid: myUid, toUid, createdAt: serverTimestamp()
    });
    window.showToast('📨 Đã gửi lời mời kết bạn!', 'success');
    window.closeViewProfile();
  } catch(e) { window.showToast('❌ Gửi thất bại!', 'error'); }
};

window.acceptFriend = async function(fromUid) {
  const myUid = _currentUser.uid;
  try {
    await updateDoc(doc(db, 'users', myUid), { friends: arrayUnion(fromUid) });
    await updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(myUid) });
    // FIX 1: deleteDoc → onSnapshot friendRequests tự fire → renderFriendRequestsList() tự chạy
    await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
    window.showToast('🎉 Đã kết bạn thành công!', 'success');
    window.closeViewProfile();
    renderMyFriendsList();
    _listenIncomingDMs();
  } catch(e) { window.showToast('❌ Lỗi!', 'error'); }
};

window.declineFriend = async function(fromUid) {
  const myUid = _currentUser.uid;
  try {
    // FIX 1: deleteDoc → onSnapshot friendRequests tự fire → renderFriendRequestsList() tự chạy
    await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
    window.showToast('Đã từ chối.', 'info');
    window.closeViewProfile();
  } catch(e) {}
};

window.unfriend = async function(uid) {
  const myUid = _currentUser.uid;
  try {
    await updateDoc(doc(db, 'users', myUid), { friends: arrayRemove(uid) });
    await updateDoc(doc(db, 'users', uid),   { friends: arrayRemove(myUid) });
    window.showToast('Đã hủy kết bạn.', 'info');
    window.closeViewProfile();
    renderMyFriendsList();
  } catch(e) {}
};
