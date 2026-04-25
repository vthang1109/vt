import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc,
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, where, deleteDoc, arrayUnion, arrayRemove
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
const db = getFirestore(app);

// ===== PARTICLE CANVAS =====
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

for (let i = 0; i < 40; i++) {
  particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, vx: (Math.random()-.5)*.4, vy: (Math.random()-.5)*.4, r: Math.random()*1.5+.5 });
}
function drawParticles() {
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
    if(d<100){ ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y); ctx.strokeStyle=`rgba(56,189,248,${0.07*(1-d/100)})`; ctx.lineWidth=.5; ctx.stroke(); }
  }
  requestAnimationFrame(drawParticles);
}
drawParticles();

// ===== PAGE NAVIGATION =====
window.showPage = function(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
};

// ===== AUTH =====
window.doLogin = async function() {
  const email = document.getElementById('login-email').value;
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-err');
  err.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    if(e.code==='auth/user-not-found'||e.code==='auth/invalid-credential') err.textContent='Tài khoản không tồn tại';
    else if(e.code==='auth/wrong-password') err.textContent='Sai mật khẩu';
    else if(e.code==='auth/invalid-email') err.textContent='Email không hợp lệ';
    else err.textContent='Đăng nhập thất bại!';
  }
};

window.doRegister = async function() {
  const email = document.getElementById('reg-email').value;
  const pass  = document.getElementById('reg-pass').value;
  const err   = document.getElementById('reg-err');
  err.textContent = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Lưu đầy đủ dữ liệu user
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: email,
      nickname: '',
      points: 10000,
      friends: [],
      blockedUsers: [],
      status: 'online',
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  } catch(e) {
    if(e.code==='auth/email-already-in-use') err.textContent='Email đã được dùng';
    else if(e.code==='auth/invalid-email') err.textContent='Email không hợp lệ';
    else if(e.code==='auth/weak-password') err.textContent='Mật khẩu tối thiểu 6 ký tự';
    else err.textContent='Đăng ký thất bại!';
  }
};

window.doLogout = async function() {
  // Cập nhật status offline trước khi logout
  if (window._currentUser) {
    try {
      await updateDoc(doc(db, 'users', window._currentUser.uid), {
        status: 'offline',
        lastSeen: serverTimestamp()
      });
    } catch(e) { console.error('Lỗi update offline:', e); }
  }
  await signOut(auth);
};

// Cập nhật status khi tab inactive
window.addEventListener('blur', async () => {
  if (window._currentUser) {
    try {
      await updateDoc(doc(db, 'users', window._currentUser.uid), {
        status: 'idle',
        lastSeen: serverTimestamp()
      });
    } catch(e) {}
  }
});

// Cập nhật status online khi tab active
window.addEventListener('focus', async () => {
  if (window._currentUser) {
    try {
      await updateDoc(doc(db, 'users', window._currentUser.uid), {
        status: 'online',
        lastSeen: serverTimestamp()
      });
    } catch(e) {}
  }
});

// ===== AUTH STATE (ĐÃ SỬA ĐỂ CẬP NHẬT REALTIME) =====
onAuthStateChanged(auth, async (user) => {
  window._currentUser = user;
  const infoBar  = document.getElementById('user-info-bar');
  const authBtns = document.getElementById('auth-btn-row');
  const nameEl   = document.getElementById('user-display-name');
  const avatarEl = document.getElementById('user-avatar-char');
  const pointsEl = document.getElementById('user-points-home');

  if (user) {
    localStorage.setItem('current_user', user.email);
    window.showPage('landing');
    if(infoBar)  infoBar.style.display  = 'flex';
    if(authBtns) authBtns.style.display = 'none';

    const userRef = doc(db, 'users', user.uid);

    // --- TẠO ROOM SERVER MẶC ĐỊNH ---
    try {
      const serverRef = doc(db, 'chats', 'server');
      const serverSnap = await getDoc(serverRef);
      if (!serverSnap.exists()) {
        await setDoc(serverRef, {
          createdAt: serverTimestamp(),
          name: 'Global Chat',
          members: []
        });
      }
    } catch(e) { console.error('Lỗi tạo server room:', e); }

    // --- CẬP NHẬT STATUS ONLINE ---
    try {
      await updateDoc(userRef, {
        status: 'online',
        lastSeen: serverTimestamp()
      });
    } catch(e) { console.error('Lỗi update status:', e); }

    // --- LẮNG NGHE ĐIỂM SỐ REALTIME ---
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const currentPoints = userData.points || 0;
        const nickname = userData.nickname || '';
        const displayName = nickname || user.displayName || user.email.split('@')[0];

        // Cập nhật điểm lên giao diện chính ngay lập tức
        if(pointsEl) pointsEl.textContent = currentPoints.toLocaleString();
        
        // Cập nhật tên và avatar
        if(nameEl) nameEl.textContent = displayName;

        // Avatar index (user-info-bar)
        if(avatarEl) {
          if(userData.avatarUrl) {
            avatarEl.style.backgroundImage = `url(${userData.avatarUrl})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
          } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = displayName[0].toUpperCase();
          }
        }

        // Avatar + tên profile page
        const profileNick  = document.getElementById('profile-nickname-display');
        const profileBigAv = document.getElementById('profile-big-avatar');
        if(profileNick) profileNick.textContent = displayName;
        if(profileBigAv) {
          if(userData.avatarUrl) {
            profileBigAv.style.backgroundImage = `url(${userData.avatarUrl})`;
            profileBigAv.style.backgroundSize = 'cover';
            profileBigAv.style.backgroundPosition = 'center';
            profileBigAv.textContent = '';
          } else {
            profileBigAv.style.backgroundImage = '';
            profileBigAv.textContent = displayName[0].toUpperCase();
          }
        }

        // Đồng bộ vào localStorage để các game khác vẫn lấy được điểm mới
        localStorage.setItem('userPoints', currentPoints);
        
        // Kiểm tra nếu chưa có nickname thì hiện modal
        if (!nickname && window.showNicknameModal) {
            setTimeout(() => window.showNicknameModal(), 600);
        }
      } else {
        // Nếu chưa có doc (đăng nhập cũ), tạo mới đầy đủ
        setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          nickname: '',
          points: 10000,
          friends: [],
          blockedUsers: [],
          status: 'online',
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    });

    listenFriendRequests(user.uid);

  } else {
    window._currentUser = null;
    localStorage.removeItem('current_user');
    localStorage.removeItem('userPoints');
    if(infoBar)  infoBar.style.display  = 'none';
    if(authBtns) authBtns.style.display = 'flex';
    window.showPage('landing');
  }
});

// ===== CÁC HÀM CÒN LẠI GIỮ NGUYÊN =====
window._saveNickname = async function(nickname) {
  if (!window._currentUser) throw new Error('Not logged in');
  await updateDoc(doc(db, 'users', window._currentUser.uid), { nickname });
};

window.getUserData = async function(uid, callback) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    callback(snap.exists() ? snap.data() : null);
  } catch(e) { callback(null); }
};

window._getAllUsers = async function(callback) {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = [];
    snap.forEach(d => users.push(d.data()));
    callback(users);
  } catch(e) { callback([]); }
};

function getDmId(uid1, uid2) { return [uid1, uid2].sort().join('_'); }

window.listenMessages = function(convoId, callback) {
  const roomId = convoId === 'server' ? 'server' : getDmId(window._currentUser.uid, convoId);
  const q = query(collection(db, 'chats', roomId, 'messages'), orderBy('createdAt'), limit(80));
  const unsub = onSnapshot(q, (snap) => {
    const msgs = [];
    snap.forEach(d => {
      const data = d.data();
      const ts = data.createdAt?.toDate();
      const time = ts ? ts.getHours().toString().padStart(2,'0')+':'+ts.getMinutes().toString().padStart(2,'0') : '';
      msgs.push({ ...data, time });
    });
    callback(msgs);
  });
  return unsub;
};

window.sendMessage = async function(convoId, text) {
  if (!window._currentUser) return;
  const roomId = convoId === 'server' ? 'server' : getDmId(window._currentUser.uid, convoId);
  const snap = await getDoc(doc(db, 'users', window._currentUser.uid));
  const senderName = snap.exists() && snap.data().nickname ? snap.data().nickname : (window._currentUser.displayName || window._currentUser.email.split('@')[0]);
  await addDoc(collection(db, 'chats', roomId, 'messages'), { text, senderUid: window._currentUser.uid, senderName, createdAt: serverTimestamp() });
  try { window.VTQuests && window.VTQuests.trackChat(); } catch(e) {}
};

window._sendFriendRequest = async function(toUid) {
  const myUid = window._currentUser.uid;
  await setDoc(doc(db, 'friendRequests', toUid, 'requests', myUid), { fromUid: myUid, toUid, createdAt: serverTimestamp() });
};

window._acceptFriendRequest = async function(fromUid) {
  const myUid = window._currentUser.uid;
  await updateDoc(doc(db, 'users', myUid), { friends: arrayUnion(fromUid) });
  await updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(myUid) });
  await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
};

window._declineFriendRequest = async function(fromUid) {
  const myUid = window._currentUser.uid;
  await deleteDoc(doc(db, 'friendRequests', myUid, 'requests', fromUid));
};

window._unfriend = async function(uid) {
  const myUid = window._currentUser.uid;
  await updateDoc(doc(db, 'users', myUid), { friends: arrayRemove(uid) });
  await updateDoc(doc(db, 'users', uid), { friends: arrayRemove(myUid) });
};

window._getFriendRequests = async function(uid, callback) {
  try {
    const snap = await getDocs(collection(db, 'friendRequests', uid, 'requests'));
    const reqs = [];
    for (const d of snap.docs) {
      const fromUid = d.data().fromUid;
      const userSnap = await getDoc(doc(db, 'users', fromUid));
      if (userSnap.exists()) reqs.push({ uid: fromUid, ...userSnap.data() });
    }
    callback(reqs);
  } catch(e) { callback([]); }
};

window._getMyFriends = async function(uid, callback) {
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
};

window.getFriendStatus = async function(myUid, otherUid, callback) {
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
};

function listenFriendRequests(uid) {
  onSnapshot(collection(db, 'friendRequests', uid, 'requests'), (snap) => {
    snap.docChanges().forEach(async change => {
      if (change.type === 'added') {
        const fromUid = change.doc.data().fromUid;
        const userSnap = await getDoc(doc(db, 'users', fromUid));
        const name = userSnap.exists() ? (userSnap.data().nickname || 'Ai đó') : 'Ai đó';
        if (window.showToast) window.showToast(`📨 <strong>${name}</strong> muốn kết bạn với bạn!`, 'warn');
      }
    });
  });
}

// ===== GLOBAL CHAT LOGIC =====
// sendMessage và listenChat được xử lý bởi chat.js — không định nghĩa lại ở đây
