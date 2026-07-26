// ===== chat.js – Phần 1 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, updateDoc,
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove, setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { subscribeUserData } from '../points.js';
import { initProfileCard } from '../profile-card.js';

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

initProfileCard({ db, getMyUid: () => _currentUser?.uid });

// ===== PARTICLE CANVAS =====
const canvas = document.getElementById('bg-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  
  // Màu particles theo theme — đồng bộ với data-theme đã set từ initTheme
  // lRgb: RGB string cho line, lAlpha: base opacity cho line (sẽ nhân với (1-d/100))
  (function initParticleColors() {
    const initThemeId = document.body.getAttribute('data-theme') || 'blue';
    const initColors = {
      blue:   { p: 'rgba(56,189,248,0.5)', lRgb: '56,189,248', lAlpha: 0.07 },
      pink:   { p: 'rgba(232,67,147,0.4)', lRgb: '232,67,147', lAlpha: 0.06 },
      purple: { p: 'rgba(167,139,250,0.4)', lRgb: '167,139,250', lAlpha: 0.06 },
      green:  { p: 'rgba(16,185,129,0.4)', lRgb: '16,185,129', lAlpha: 0.06 },
      orange: { p: 'rgba(249,115,22,0.4)', lRgb: '249,115,22', lAlpha: 0.06 },
      dark:   { p: 'rgba(148,163,184,0.3)', lRgb: '148,163,184', lAlpha: 0.04 }
    };
    const ic = initColors[initThemeId] || initColors.blue;
    window.__vtParticleColors = { p: ic.p, lRgb: ic.lRgb, lAlpha: ic.lAlpha };
  })();
  
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 40; i++) {
    particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height,
      vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4, r: Math.random()*1.5+.5 });
  }
  (function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const pc = window.__vtParticleColors || { p: 'rgba(56,189,248,0.5)', lRgb: '56,189,248', lAlpha: 0.07 };
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.x<0)p.x=canvas.width; if(p.x>canvas.width)p.x=0;
      if(p.y<0)p.y=canvas.height; if(p.y>canvas.height)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=pc.p; ctx.fill();
    });
    for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++) {
      const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y, d=Math.sqrt(dx*dx+dy*dy);
      if(d<100){
        const lineAlpha = Math.max(0, pc.lAlpha * (1 - d / 100));
        ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y);
        ctx.strokeStyle=`rgba(${pc.lRgb}, ${lineAlpha})`; ctx.lineWidth=.5; ctx.stroke();
      }
    }
    requestAnimationFrame(draw);
  })();
}

// ===== UTILS =====
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
window.showToast = function(msg, type) {
  let host = document.getElementById('vtToastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'vtToastHost';
    host.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:100%;padding:0 16px;box-sizing:border-box;';
    document.body.appendChild(host);
  }
  const colors = {
    success: ['rgba(52,211,153,0.95)', '#fff'],
    error:   ['rgba(248,113,113,0.95)', '#fff'],
    warn:    ['rgba(251,191,36,0.95)', '#1a0a00'],
    info:    ['rgba(2,136,209,0.95)', '#fff']
  };
  const [bg, fg] = colors[type] || colors.info;
  const el = document.createElement('div');
  el.style.cssText = `background:${bg};color:${fg};padding:10px 18px;border-radius:50px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.35);max-width:90%;text-align:center;animation:vtToastIn 0.2s ease;`;
  el.innerHTML = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.25s, transform 0.25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 250);
  }, 2600);
};
if (!document.getElementById('vtToastKeyframes')) {
  const s = document.createElement('style');
  s.id = 'vtToastKeyframes';
  s.textContent = '@keyframes vtToastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }';
  document.head.appendChild(s);
}

// ===== CHAT STATE =====
let currentConvoId   = 'server';
const _notifiedAnnouncements = new Set();
let currentConvoName = 'Chat toàn server';
let currentConvoUid  = null;
let _chatUnsubscribe = null;
let _currentUser     = null;
let _otherReadTime   = null;
let _readUnsubscribe = null;
let _lastMessages    = [];
let _currentRoomId   = null;

// ===== SENDER THEME CACHE (per-user theme cho từng tin nhắn) =====
let _senderThemeCache = {};
let _pendingThemeFetches = {};

async function _getSenderTheme(uid) {
  if (_senderThemeCache[uid]) return _senderThemeCache[uid];
  if (_pendingThemeFetches[uid]) return _pendingThemeFetches[uid];
  _pendingThemeFetches[uid] = (async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const theme = snap.data().chatTheme || 'blue';
        _senderThemeCache[uid] = theme;
        return theme;
      }
    } catch(e) {}
    _senderThemeCache[uid] = 'blue';
    return 'blue';
  })();
  return _pendingThemeFetches[uid];
}

// ===== FIRESTORE HELPERS =====
function getDmId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }
function _seenKey(roomId) { return 'vt_lastSeen_' + roomId; }
function _getLastSeen(roomId) {
  return parseInt(localStorage.getItem(_seenKey(roomId)) || '0', 10);
}
function _setLastSeen(roomId, ms) {
  if (ms > _getLastSeen(roomId)) localStorage.setItem(_seenKey(roomId), String(ms));
}

// Cập nhật read receipt của mình
async function updateReadReceipt(roomId) {
  if (!_currentUser || !roomId) return;
  try {
    await setDoc(doc(db, 'chats', roomId, 'readReceipts', _currentUser.uid), {
      lastReadAt: serverTimestamp()
    }, { merge: true });
  } catch(e) { /* bỏ qua */ }
}

// Lắng nghe read receipt của người khác
function listenReadReceipt(roomId, otherUid, callback) {
  return onSnapshot(doc(db, 'chats', roomId, 'readReceipts', otherUid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const ts = data.lastReadAt?.toDate?.() || null;
      callback(ts ? ts.getTime() : null);
    } else {
      callback(null);
    }
  });
}

// ===== SỬA: Xoá toàn bộ tin nhắn - CHỈ xoá/ẩn tin nhắn của mình =====
async function clearMessages(roomId) {
  if (!_currentUser) return;
  const msgsRef = collection(db, 'chats', roomId, 'messages');
  const snapshot = await getDocs(msgsRef);
  if (snapshot.empty) {
    window.showToast('Không có tin nhắn nào để xoá.', 'info');
    return;
  }
  
  const batch = writeBatch(db);
  let myMsgCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    // Chỉ xử lý tin nhắn của mình
    if (data.senderUid !== _currentUser.uid) continue;
    
    myMsgCount++;
    const hiddenFor = data.hiddenFor || [];
    
    // Nếu đã có mình trong hiddenFor (tức cả 2 đều ẩn) -> xoá hẳn
    if (hiddenFor.includes(_currentUser.uid)) {
      batch.delete(docSnap.ref);
    } else {
      // Chưa có mình -> thêm mình vào hiddenFor
      batch.update(docSnap.ref, {
        hiddenFor: arrayUnion(_currentUser.uid)
      });
    }
  }
  
  if (myMsgCount === 0) {
    window.showToast('Bạn chưa gửi tin nhắn nào trong cuộc trò chuyện này.', 'info');
    return;
  }
  
  await batch.commit();
  window.showToast(`✅ Đã xoá ${myMsgCount} tin nhắn của bạn.`, 'success');
}

// ===== SỬA: Xoá từng tin nhắn =====
window.deleteMessage = async function(msgId) {
  if (!_currentUser) {
    window.showToast('❌ Bạn chưa đăng nhập.', 'error');
    return;
  }
  if (!msgId || msgId === 'undefined' || msgId === 'null' || msgId === '') {
    window.showToast('❌ Không tìm thấy tin nhắn.', 'error');
    return;
  }
  if (!_currentRoomId || _currentRoomId === 'server') {
    window.showToast('❌ Không thể xoá tin nhắn server.', 'warn');
    return;
  }
  if (!confirm('Xoá tin nhắn này?')) return;

  const msgRef = doc(db, 'chats', _currentRoomId, 'messages', msgId);

  // 1. Thử xoá thật
  try {
    await deleteDoc(msgRef);
    window.showToast('✅ Đã xoá tin nhắn.', 'success');
    return;
  } catch (e) {
    console.warn('⚠️ Xoá thật thất bại, thử cách khác:', e.message);
  }

  // 2. Thử cập nhật text thành "[Đã xoá]"
  try {
    await updateDoc(msgRef, {
      text: '[Đã xoá]',
      isDeleted: true
    });
    window.showToast('✅ Đã xoá tin nhắn.', 'success');
    return;
  } catch (e2) {
    console.warn('⚠️ Cập nhật text thất bại:', e2.message);
  }

  // 3. Fallback cuối: ẩn tin nhắn
  try {
    await updateDoc(msgRef, {
      hiddenFor: arrayUnion(_currentUser.uid)
    });
    window.showToast('✅ Đã ẩn tin nhắn (chỉ bạn không thấy).', 'success');
  } catch (e3) {
    console.error('❌ Tất cả cách đều thất bại:', e3);
    window.showToast('❌ Không thể xoá tin nhắn. Vui lòng thử lại sau.', 'error');
  }
};

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

// Lắng nghe tin nhắn – lọc tin nhắn bị ẩn với người dùng hiện tại
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
      // Bỏ qua nếu tin nhắn bị ẩn với người dùng hiện tại
      if (data.hiddenFor && data.hiddenFor.includes(_currentUser.uid)) {
        return;
      }
      const ts   = data.createdAt?.toDate();
      const time = ts
        ? ts.getHours().toString().padStart(2,'0') + ':' + ts.getMinutes().toString().padStart(2,'0')
        : '';
      msgs.push({ ...data, time, id: d.id, ms: ts ? ts.getTime() : Date.now() });
    });
    callback(msgs);
  });
}

// ===== SỬA: Thêm export sendMessage ra window =====
async function sendMessage(convoId, text) {
  if (!_currentUser) throw new Error('Not logged in');
  const roomId = convoId === 'server'
    ? 'server'
    : getDmId(_currentUser.uid, convoId);
  const snap = await getDoc(doc(db, 'users', _currentUser.uid));
  const senderName = snap.exists() && snap.data().nickname
    ? snap.data().nickname
    : (_currentUser.displayName || _currentUser.email.split('@')[0]);
  const result = await addDoc(collection(db, 'chats', roomId, 'messages'), {
    text,
    senderUid:  _currentUser.uid,
    senderName,
    createdAt:  serverTimestamp(),
    hiddenFor: []   // mảng những người đã ẩn tin nhắn này
  });
  try { window.VTQuests && window.VTQuests.trackChat(); } catch(e) {}
  return result;
}

// ===== THÊM: Export sendMessage ra window để send-points.js gọi =====
window.sendMessage = sendMessage;

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
// ===== chat.js – Phần 2 =====

// ===== AUTH GUARD =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  _currentUser = user;
  _checkAdminForAnnounce();
  await _initChat();
});

// ===== INIT =====
async function _initChat() {
  _listenFriendRequests(_currentUser.uid);
  subscribeUserData(async (data) => {
    if (!data) return;
    const friendUids = data.friends || [];
    const friends = [];
    for (const fuid of friendUids) {
      const fs = await getDoc(doc(db, 'users', fuid));
      if (fs.exists()) friends.push({ uid: fuid, ...fs.data() });
    }
    _renderFriendsInChatFromList(friends);
  });
  renderAllUsersInChat();
  _listenIncomingDMs();
  try {
    const serverRef = doc(db, 'chats', 'server');
    const serverSnap = await getDoc(serverRef);
    if (!serverSnap.exists()) {
      await setDoc(serverRef, { createdAt: serverTimestamp(), name: 'Global Chat', members: [] });
    }
  } catch(e) { 
    window.showToast('❌ Lỗi tạo room chat: ' + e.message, 'error');
  }

  // ===== Lưu theme chat lên Firestore (đồng bộ giữa các thiết bị) =====
  window.saveChatThemeToFirestore = async function(themeId) {
    if (!_currentUser) return;
    try {
      await updateDoc(doc(db, 'users', _currentUser.uid), {
        chatTheme: themeId
      });
    } catch(e) {
      console.warn('Failed to save chat theme:', e);
    }
  };

  // ===== Lắng nghe theme từ Firestore (đồng bộ từ thiết bị khác) =====
  // Chỉ áp dụng theme cho chat window (header + input + send), không ảnh hưởng sidebar
  subscribeUserData((data) => {
    if (!data) return;
    const ftTheme = data.chatTheme;
    if (ftTheme && ftTheme !== localStorage.getItem('vt_chat_theme')) {
      localStorage.setItem('vt_chat_theme', ftTheme);
      // Cập nhật lớp theme trên chat window
      const cw = document.getElementById('chatWindow');
      if (cw) {
        ['blue','pink','purple','green','orange','dark'].forEach(t => cw.classList.remove('cw-theme-' + t));
        cw.classList.add('cw-theme-' + ftTheme);
      }
      // Cập nhật particle colors
      const colors = {
        blue:   { p: 'rgba(56,189,248,0.5)', lRgb: '56,189,248', lAlpha: 0.07 },
        pink:   { p: 'rgba(232,67,147,0.4)', lRgb: '232,67,147', lAlpha: 0.06 },
        purple: { p: 'rgba(167,139,250,0.4)', lRgb: '167,139,250', lAlpha: 0.06 },
        green:  { p: 'rgba(16,185,129,0.4)', lRgb: '16,185,129', lAlpha: 0.06 },
        orange: { p: 'rgba(249,115,22,0.4)', lRgb: '249,115,22', lAlpha: 0.06 },
        dark:   { p: 'rgba(148,163,184,0.3)', lRgb: '148,163,184', lAlpha: 0.04 }
      };
      if (window.__vtParticleColors) {
        const c = colors[ftTheme] || colors.blue;
        window.__vtParticleColors.p = c.p;
        window.__vtParticleColors.lRgb = c.lRgb;
        window.__vtParticleColors.lAlpha = c.lAlpha;
      }
    }
  });

  // ===== SỬA: Xoá toàn bộ tin nhắn (gọi từ settings dropdown) =====
  window.clearCurrentMessages = async function() {
    if (!_currentRoomId || currentConvoId === 'server') {
      window.showToast('Không thể xoá tin nhắn server.', 'warn');
      return;
    }
    if (!confirm('Xoá tất cả tin nhắn của bạn trong cuộc trò chuyện này?')) return;
    try {
      await clearMessages(_currentRoomId);
      if (_chatUnsubscribe) {
        _lastMessages = _lastMessages.filter(m => m.senderUid !== _currentUser.uid || 
          (m.hiddenFor && m.hiddenFor.includes(_currentUser.uid)));
        renderMessages(_lastMessages);
      }
    } catch(e) {
      console.error(e);
      window.showToast('❌ Lỗi xoá tin nhắn.', 'error');
    }
  };


  const isMobile = window.innerWidth <= 640;
  if (!isMobile) {
    openConvo('server', 'Chat toàn server', null, 'server');
  }
}

// ===== SỬA: RENDER MESSAGES (có seen + xoá mềm + hỗ trợ HTML) =====
function renderMessages(messages) {
  const box = document.getElementById('chatWindowMessages');
  if (!box) return;
  if (!messages.length) {
    box.innerHTML = '<div class="cwm-msg system-msg">Chưa có tin nhắn nào 👋</div>';
    return;
  }
  box.innerHTML = '';
  
  // Thu thập các senderUid chưa có theme, fetch bất đồng bộ
  const unknownUids = [...new Set(messages
    .filter(m => m.senderUid && m.senderUid !== _currentUser?.uid && !_senderThemeCache[m.senderUid])
    .map(m => m.senderUid)
  )];
  if (unknownUids.length) {
    Promise.all(unknownUids.map(uid => _getSenderTheme(uid))).then(() => {
      // Re-render với theme đúng sau khi fetch xong
      if (_lastMessages.length && _currentUser) {
        renderMessages(_lastMessages);
      }
    });
  }

  messages.forEach(m => {
    // Kiểm tra tin nhắn đã bị xoá mềm
    const isDeleted = m.isDeleted === true;

    // === ANNOUNCEMENT: hiển thị đặc biệt ===
    if (m.isAnnouncement) {
      const div = document.createElement('div');
      div.className = 'cwm-msg announce-msg';
      div.innerHTML = `<div class="announce-bubble">
        <div class="announce-badge"><span class="icon">📢</span> THÔNG BÁO</div>
        <div class="announce-text">${escHtml(m.text)}</div>
        <div class="announce-footer">${escHtml(m.senderName || 'Admin')} · ${m.time}</div>
      </div>`;
      box.appendChild(div);

      // Toast notification for new announcements only
      if (m.id && !_notifiedAnnouncements.has(m.id)) {
        _notifiedAnnouncements.add(m.id);
        // Chỉ toast nếu là tin mới nhất (vừa được gửi)
        if (_lastMessages.length > 0 && m === _lastMessages[_lastMessages.length - 1]) {
          window.showToast('📢 <strong>Thông báo mới:</strong> ' + escHtml((m.text||'').slice(0,60)), 'warn');
          // Rung badge trên sidebar
          const badge = document.getElementById('vt-badge-chat');
          if (badge) {
            badge.textContent = '📢';
            badge.classList.add('visible');
            setTimeout(() => { badge.textContent = ''; badge.classList.remove('visible'); }, 10000);
          }
        }
      }
      return;
    }

    const isMe = _currentUser && m.senderUid === _currentUser.uid;
    const div = document.createElement('div');
    const senderTheme = isMe
      ? (localStorage.getItem('vt_chat_theme') || 'blue')
      : (_senderThemeCache[m.senderUid] || 'blue');
    div.className = 'cwm-msg ' + (isMe ? 'mine-msg' : 'other-msg') + ' cwm-theme-' + senderTheme;
    
    let seenHtml = '';
    if (isMe) {
      const isSeen = _otherReadTime !== null && m.ms && m.ms <= _otherReadTime;
      const checkIcon = isSeen ? '✓✓' : '✓';
      const checkColor = isSeen ? '#34d399' : 'rgba(255,255,255,0.3)';
      seenHtml = ` <span class="seen-status" style="font-size:11px;color:${checkColor};font-weight:700;transition:color 0.3s">${checkIcon}</span>`;
    }

    const msgId = m.id || '';
    const deleteBtn = msgId ? `<button class="cwm-del" onclick="window.deleteMessage('${msgId}')" title="Xoá tin nhắn">🗑</button>` : '';
    
    let displayText;
    let deletedStyle = isDeleted ? 'opacity:0.5;font-style:italic;color:#4a7a9b;' : '';
    
    if (isDeleted) {
      displayText = '🗑️ Tin nhắn đã bị xoá';
    } else if (m.text && (m.text.includes('<b') || m.text.includes('<span') || m.text.includes('style=') || m.text.includes('🟡'))) {
      displayText = m.text;
    } else {
      displayText = escHtml(m.text);
    }

    if (isMe) {
      div.innerHTML = `<span class="cwm-bubble" style="${deletedStyle}">${displayText}</span><span class="cwm-time">${m.time} ${seenHtml} ${deleteBtn}</span>`;
      box.appendChild(div);
    } else {
      div.innerHTML = `<div class="cwm-av" onclick="window.showProfileCard && window.showProfileCard('${m.senderUid}')" style="cursor:pointer" title="Xem hồ sơ"></div><div class="cwm-content"><span class="cwm-user">${escHtml(m.senderName)}</span><span class="cwm-bubble" style="${deletedStyle}">${displayText}</span><span class="cwm-time">${m.time}</span></div>`;
      box.appendChild(div);
      const avEl = div.querySelector('.cwm-av');
      if (avEl && m.senderUid && !isDeleted) {
        getDoc(doc(db, 'users', m.senderUid)).then(s => {
          if (!s.exists()) return;
          const d = s.data();
          if (d.avatarUrl) {
            avEl.style.backgroundImage = `url(${d.avatarUrl})`;
            avEl.style.backgroundSize = 'cover';
            avEl.style.backgroundPosition = 'center';
          } else {
            avEl.textContent = (d.nickname || '?')[0].toUpperCase();
          }
        }).catch(() => {});
      }
    }
  });
  box.scrollTop = box.scrollHeight;
}

// ===== OPEN CONVO =====
window.openConvo = function(uid, name, avatarChar, type) {
  console.log('📂 Opening convo:', uid, name, type);
  
  currentConvoId   = uid;
  currentConvoName = name;
  currentConvoUid  = (type === 'server') ? null : uid;
  _currentRoomId   = uid === 'server' ? 'server' : getDmId(_currentUser.uid, uid);
  
  console.log('📂 Current room ID:', _currentRoomId);

  const badgeEl = document.getElementById('contact-' + uid);
  if (badgeEl) { const b = badgeEl.querySelector('.dm-badge'); if (b) b.remove(); }

  document.querySelectorAll('.chat-contact').forEach(c => c.classList.remove('active'));
  const el = document.getElementById('contact-' + uid);
  if (el) el.classList.add('active');

  const av = document.getElementById('chatWinAvatar');
  document.getElementById('chatWinName').textContent = name;
  if (avatarChar) {
    if (avatarChar.startsWith('data:') || avatarChar.startsWith('http')) {
      av.style.background = `url(${avatarChar}) center/cover`;
      av.textContent = '';
    } else {
      av.textContent = avatarChar;
      av.style.fontSize   = '15px';
      av.style.background = 'linear-gradient(135deg,#a78bfa,#7c3aed)';
    }
  } else {
    av.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18" height="18" fill="#fff"><path d="M55.7 199.7l30.9 30.9c6 6 14.1 9.4 22.6 9.4l21.5 0c8.5 0 16.6 3.4 22.6 9.4l29.3 29.3c6 6 9.4 14.1 9.4 22.6l0 37.5c0 8.5 3.4 16.6 9.4 22.6l13.3 13.3c6 6 9.4 14.1 9.4 22.6l0 18.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-2.7c0-8.5 3.4-16.6 9.4-22.6l45.3-45.3c6-6 9.4-14.1 9.4-22.6l0-34.7c0-17.7-14.3-32-32-32l-82.7 0c-8.5 0-16.6-3.4-22.6-9.4l-16-16c-4.2-4.2-6.6-10-6.6-16 0-12.5 10.1-22.6 22.6-22.6l34.7 0c12.5 0 22.6-10.1 22.6-22.6 0-6-2.4-11.8-6.6-16l-19.7-19.7C242 130 240 125.1 240 120s2-10 5.7-13.7l17.3-17.3c5.8-5.8 9.1-13.7 9.1-21.9 0-7.2-2.4-13.7-6.4-18.9-3.2-.1-6.4-.2-9.6-.2-95.4 0-175.7 64.2-200.3 151.7zM464 256c0-34.6-8.4-67.2-23.4-95.8-6.4 .9-12.7 3.9-17.9 9.1l-13.4 13.4c-6 6-9.4 14.1-9.4 22.6l0 34.7c0 17.7 14.3 32 32 32l24.1 0c2.5 0 5-.3 7.3-.8 .4-5 .5-10.1 .5-15.2zM0 256a256 256 0 1 1 512 0 256 256 0 1 1 -512 0z"/></svg>';
    av.style.fontSize   = '18px';
    av.style.background = 'linear-gradient(135deg,#38bdf8,#0ea5e9)';
  }

  const box = document.getElementById('chatWindowMessages');
  box.innerHTML = '<div class="cwm-msg system-msg">Đang tải...</div>';

  if (_chatUnsubscribe) { _chatUnsubscribe(); _chatUnsubscribe = null; }
  if (_readUnsubscribe) { _readUnsubscribe(); _readUnsubscribe = null; }
  _otherReadTime = null;
  _lastMessages = [];

  // Show/hide settings dropdown options (gear menu)
  const sdClear = document.getElementById('sd-clear-msgs');
  const sdPoints = document.getElementById('sd-send-points');
  const isDm = type !== 'server';
  if (sdClear) sdClear.classList.toggle('hidden', !isDm);
  if (sdPoints) sdPoints.classList.toggle('hidden', !isDm);

  // Read receipt subscription (only for DM)
  if (isDm) {
    const roomId = getDmId(_currentUser.uid, uid);
    _readUnsubscribe = listenReadReceipt(roomId, uid, (time) => {
      _otherReadTime = time;
      if (_lastMessages.length) renderMessages(_lastMessages);
    });
    updateReadReceipt(roomId);
  }

  _chatUnsubscribe = listenMessages(uid, (msgs) => {
    _lastMessages = msgs;
    renderMessages(msgs);
    if (msgs.length && type !== 'server') {
      const last = msgs[msgs.length - 1];
      if (last.senderUid !== _currentUser.uid && _currentRoomId) {
        updateReadReceipt(_currentRoomId);
      }
    }
  });
};

window.sendWindowChat = function() {
  const input = document.getElementById('chatWindowInput');
  const val   = input.value.trim();
  if (!val) return;
  if (!_currentUser) { window.showToast('⚠️ Đăng nhập để chat!', 'warn'); return; }
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
    const nm = c.querySelector('.contact-name');
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
    btn.onclick = () => window.switchChatTab && window.switchChatTab('world');
    window._renderFriendRequestsList && window._renderFriendRequestsList();
    window._renderMyFriendsList && window._renderMyFriendsList();
  } else {
    document.getElementById('tab-chat-panel').style.display    = 'flex';
    document.getElementById('tab-friends-panel').style.display = 'none';
    btn.textContent = '👥 Bạn bè';
    btn.onclick = () => window.switchTab('friends');
  }
};

// ===== RENDER: FRIENDS IN SIDEBAR =====
function renderContactAvatar(el, user) {
  if (!el) return;
  if (user.avatarUrl) {
    el.style.background = `url(${user.avatarUrl}) center/cover`;
    el.textContent = '';
  } else {
    el.textContent = (user.nickname || '?')[0].toUpperCase();
  }
}

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
    div.onclick   = () => window.openConvo(f.uid, name, f.avatarUrl || name[0].toUpperCase(), 'dm');
    div.innerHTML = `
      <div class="contact-av">${name[0].toUpperCase()}</div>
      <div class="contact-info">
        <span class="contact-name">${escHtml(name)} <span class="chat-online-dot"></span></span>
        <span class="contact-preview">Nhấn để nhắn tin</span>
      </div>`;
    el.appendChild(div);
    renderContactAvatar(div.querySelector('.contact-av'), f);
  });
}

function renderFriendsInChat() {
  if (!_currentUser) return;
  getMyFriends(_currentUser.uid, (friends) => _renderFriendsInChatFromList(friends));
}

function renderAllUsersInChat() {
  if (!_currentUser) return;
  getAllUsers((users) => {
    const el = document.getElementById('allUsersInChat');
    el.innerHTML = '';
    const others = users.filter(u => u.uid !== _currentUser.uid);
    if (!others.length) return;
    const label = document.createElement('div');
    label.className = 'contact-section-label';
    label.textContent = 'Tất cả người dùng';
    el.appendChild(label);
    others.forEach(u => {
      const name = u.nickname || u.email?.split('@')[0] || '?';
      const div  = document.createElement('div');
      div.className = 'chat-contact';
      div.onclick   = () => window.showProfileCard(u.uid);
      div.innerHTML = `
        <div class="contact-av">${name[0].toUpperCase()}</div>
        <div class="contact-info">
          <span class="contact-name">${escHtml(name)}</span>
          <span class="contact-preview" style="color:#a78bfa">Nhấn để xem profile</span>
        </div>`;
      el.appendChild(div);
      renderContactAvatar(div.querySelector('.contact-av'), u);
    });
  });
}

// ===== RENDER: FRIEND REQUESTS =====
window._renderFriendRequestsList = function renderFriendRequestsList() {
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

window._renderMyFriendsList = function renderMyFriendsList() {
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
      div.onclick = () => window.showProfileCard(f.uid);
      const avStyle = f.avatarUrl
        ? `background:url(${f.avatarUrl}) center/cover;color:transparent`
        : 'background:linear-gradient(135deg,#34d399,#059669)';
      div.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;${avStyle};display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px;flex-shrink:0">${f.avatarUrl ? '' : name[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;font-weight:700;font-size:13px;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)} <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;vertical-align:middle;margin-left:4px"></span></div>
        <button onclick="event.stopPropagation();window.showProfileCard('${f.uid}')" title="Xem hồ sơ" style="padding:5px 9px;border-radius:8px;background:rgba(94,201,240,0.1);border:1px solid rgba(94,201,240,0.25);color:#5ec9f0;cursor:pointer;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">👁</button>
        <button onclick="event.stopPropagation();openConvoWithUid('${f.uid}','${escHtml(name)}')" title="Nhắn tin" style="padding:5px 9px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);color:#34d399;cursor:pointer;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif">💬</button>`;
      el.appendChild(div);
    });
  });
}
// ===== ADMIN SEND ANNOUNCEMENT =====
window._sendAdminAnnouncement = async function() {
  const text = document.getElementById('announceAdminText')?.value.trim();
  const status = document.getElementById('announceAdminStatus');
  const btn = document.getElementById('announceAdminBtn');
  if (!text) {
    status.className = 'announce-admin-status error';
    status.textContent = '❌ Vui lòng nhập nội dung thông báo';
    return;
  }
  btn.disabled = true;
  btn.textContent = '⏳ Đang gửi...';
  status.className = 'announce-admin-status';
  status.textContent = '';
  try {
    const adminName = _currentUser?.displayName || _currentUser?.email?.split('@')[0] || 'Admin';
    // Chỉ ghi vào chats/server/messages — announcements collection bị chặn bởi security rules
    await addDoc(collection(db, 'chats', 'server', 'messages'), {
      text,
      senderUid: _currentUser.uid,
      senderName: '📢 ' + adminName,
      createdAt: serverTimestamp(),
      isAnnouncement: true,
      hiddenFor: []
    });
    status.className = 'announce-admin-status success';
    status.textContent = '✅ Đã gửi thông báo!';
    document.getElementById('announceAdminText').value = '';
    document.getElementById('announceAdminPreview').classList.remove('visible');
    setTimeout(() => { status.className = 'announce-admin-status'; status.textContent = ''; }, 3000);
  } catch (e) {
    console.error('Announce error:', e);
    status.className = 'announce-admin-status error';
    status.textContent = '❌ Lỗi: ' + (e.message || 'Không xác định');
  } finally {
    btn.disabled = false;
    btn.textContent = '📢 Gửi thông báo';
  }
};

window.previewChatAnnounce = function() {
  const text = document.getElementById('announceAdminText')?.value.trim();
  const preview = document.getElementById('announceAdminPreview');
  const previewText = document.getElementById('announceAdminPreviewText');
  if (text && preview && previewText) {
    preview.classList.add('visible');
    previewText.textContent = text;
  } else if (preview) {
    preview.classList.remove('visible');
  }
};

let _announceBtnBound = false;

// Check admin and show form
function _checkAdminForAnnounce() {
  if (!_currentUser) return;
  const email = (_currentUser.email || '').trim().toLowerCase();
  const form = document.getElementById('announceAdminForm');
  if (form) {
    form.style.display = (email === 'thang@game.com') ? 'block' : 'none';
  }
  // Bind button only once
  if (!_announceBtnBound) {
    document.getElementById('announceAdminBtn')?.addEventListener('click', window._sendAdminAnnouncement);
    _announceBtnBound = true;
  }
}

// ===== ANNOUNCEMENT LISTENER (sidebar tab) =====
let _announceUnsubscribe = null;
let _announceListened = false;

window._renderAnnouncements = function() {
  const list = document.getElementById('announceList');
  if (!list) return;
  if (!_announceListened) {
    _listenAnnouncements();
  }
};

function _cleanupAnnounceListener() {
  if (_announceUnsubscribe) {
    _announceUnsubscribe();
    _announceUnsubscribe = null;
  }
  _announceListened = false;
}

function _listenAnnouncements() {
  _cleanupAnnounceListener();
  
  const list = document.getElementById('announceList');
  if (!list) return;
  list.innerHTML = '<div class="announce-empty">Đang tải thông báo...</div>';
  
  try {
    // Đọc từ chats/server/messages thay vì announcements collection (bị chặn security rules)
    const q = query(
      collection(db, 'chats', 'server', 'messages'),
      orderBy('createdAt'),
      limit(200)
    );
    _announceUnsubscribe = onSnapshot(q, (snap) => {
      _announceListened = true;
      const list = document.getElementById('announceList');
      if (!list) return;
      
      const announces = [];
      snap.forEach(d => {
        const data = d.data();
        // Chỉ lấy tin nhắn là announcement
        if (!data.isAnnouncement) return;
        const ts = data.createdAt?.toDate();
        announces.push({
          id: d.id,
          text: data.text || '',
          adminName: (data.senderName || 'Admin').replace('📢 ', ''),
          time: ts
            ? ts.getHours().toString().padStart(2,'0') + ':' + ts.getMinutes().toString().padStart(2,'0') + ' ' + ts.getDate() + '/' + (ts.getMonth()+1) + '/' + ts.getFullYear()
            : ''
        });
      });
      
      if (!announces.length) {
        list.innerHTML = '<div class="announce-empty">📭 Chưa có thông báo nào từ Admin</div>';
        return;
      }
      
      // Đảo ngược để hiển thị mới nhất lên đầu (ascending order, limit 100 gần nhất)
      announces.reverse();
      list.innerHTML = announces.map((a, i) => `
        <div class="announce-card" style="animation-delay:${i * 0.05}s">
          <div class="announce-card-badge"><span class="icon">📢</span> THÔNG BÁO</div>
          <div class="announce-card-text">${escHtml(a.text)}</div>
          <div class="announce-card-footer">
            <span class="announce-card-admin">✏️ ${escHtml(a.adminName)}</span>
            <span>🕐 ${a.time}</span>
          </div>
        </div>
      `).join('');
    }, (err) => {
      console.warn('Announce listener error:', err);
      _announceListened = false;
      const listEl = document.getElementById('announceList');
      if (listEl) listEl.innerHTML = '<div class="announce-empty">❌ Lỗi tải thông báo. Vui lòng thử lại sau.</div>';
    });
  } catch(e) {
    console.warn('Announce query error:', e);
    const listEl = document.getElementById('announceList');
    if (listEl) listEl.innerHTML = '<div class="announce-empty">❌ Lỗi tải thông báo</div>';
  }
}

// ===== chat.js – Phần 3 =====

// ===== VIEW PROFILE (dùng chung profile-card.js) =====
window.viewCurrentProfile = function() {
  if (!currentConvoUid) return;
  window.showProfileCard(currentConvoUid);
};

// ===== FRIEND ACTIONS (dùng cho panel Bạn bè) =====
window.openConvoWithUid = function(uid, name) {
  window.closeProfileCard && window.closeProfileCard();
  window.switchChatTab && window.switchChatTab('world');
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
    window.closeProfileCard && window.closeProfileCard();
  } catch(e) { window.showToast('❌ Gửi thất bại!', 'error'); }
};

window.acceptFriend = async function(fromUid) {
  const myUid = _currentUser.uid;
  try {
    await updateDoc(doc(db, 'users', myUid), { friends: arrayUnion(fromUid) });
    await updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(myUid) });
    await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
    window.showToast('🎉 Đã kết bạn thành công!', 'success');
    window.closeProfileCard && window.closeProfileCard();
    window._renderMyFriendsList && window._renderMyFriendsList();
    _listenIncomingDMs();
  } catch(e) { window.showToast('❌ Lỗi!', 'error'); }
};

window.declineFriend = async function(fromUid) {
  const myUid = _currentUser.uid;
  try {
    await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
    window.showToast('Đã từ chối.', 'info');
    window.closeProfileCard && window.closeProfileCard();
  } catch(e) {}
};

// ===== LISTENERS =====
function _listenFriendRequests(uid) {
  onSnapshot(collection(db, 'friendRequests', uid, 'requests'), (snap) => {
    window._renderFriendRequestsList && window._renderFriendRequestsList();
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

function _listenIncomingDMs() {
  getMyFriends(_currentUser.uid, (friends) => {
    friends.forEach(f => {
      const roomId = getDmId(_currentUser.uid, f.uid);
      const q = query(
        collection(db, 'chats', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      onSnapshot(q, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const msg = change.doc.data();
            const ts  = msg.createdAt?.toDate();
            const ms  = ts ? ts.getTime() : Date.now();
            if (msg.senderUid === _currentUser.uid) return;
            if (currentConvoId === f.uid) { _setLastSeen(roomId, ms); return; }
            if (ms <= _getLastSeen(roomId)) return;
            const name = f.nickname || '?';
            window.showToast(`💬 <strong>${escHtml(name)}</strong>: ${escHtml((msg.text||'').slice(0,40))}`, 'info');
            const contactEl = document.getElementById('contact-' + f.uid);
            if (contactEl) {
              let badge = contactEl.querySelector('.dm-badge');
              if (!badge) {
                badge = document.createElement('span');
                badge.className = 'dm-badge';
                badge.style.cssText = 'background:#f87171;color:#fff;border-radius:999px;font-size:10px;font-weight:800;padding:1px 6px;margin-left:4px';
                contactEl.querySelector('.contact-name')?.appendChild(badge);
              }
              badge.textContent = '●';
            }
          }
        });
      });
    });
  });
}