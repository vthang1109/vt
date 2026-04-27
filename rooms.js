// ===== VT WORLD — MULTIPLAYER ROOMS (FIX HIỂN THỊ PHÒNG) =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp, addDoc, arrayUnion, arrayRemove,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== GAME CATALOG =====
const GAMES = {
  caro:      { id: 'caro',      name: 'Caro 5 hàng',     icon: '♟️', max: 2, min: 2, page: 'caro-mp.html',      ready: true },
  tictactoe: { id: 'tictactoe', name: 'Tic-Tac-Toe',     icon: '⭕', max: 2, min: 2, page: 'tictactoe-mp.html', ready: true },
  baucua:    { id: 'baucua',    name: 'Bầu Cua bàn',     icon: '🎲', max: 8, min: 2, page: 'baucua-mp.html',    ready: true },
  xidach:    { id: 'xidach',    name: 'Xì dách bàn',     icon: '🀄', max: 5, min: 2, page: 'xidach-mp.html',    ready: true },
  quiz:      { id: 'quiz',      name: 'Quiz đối kháng',  icon: '❓', max: 6, min: 2, page: '#',                 ready: false }
};

let _user = null;
let _myProfile = null;
let _unsubRooms = null;
let _unsubRoom = null;
let _unsubChat = null;
let _currentRoomId = null;

// ===== UTILS =====
function $(id){ return document.getElementById(id); }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function genCode(){
  return String(Math.floor(100000 + Math.random() * 900000));
}
function toast(msg, type='info'){
  if (window.showToast) return window.showToast(msg, type);
  const c = document.createElement('div');
  c.style.cssText='position:fixed;top:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:12px;background:#0b1f3a;border:1px solid #38bdf8;color:#e0f2fe;font-weight:700;font-family:Nunito,sans-serif';
  c.textContent = msg; document.body.appendChild(c); setTimeout(()=>c.remove(),2800);
}

// ===== AUTH BOOT =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  _user = user;
  const ps = await getDoc(doc(db, 'users', user.uid));
  _myProfile = ps.exists() ? ps.data() : { nickname: user.email.split('@')[0] };
  $('me-name').textContent = _myProfile.nickname || user.email.split('@')[0];
  startListeningPublicRooms();
});

// ===== LIST PUBLIC ROOMS (ĐÃ SỬA LỖI) =====
function startListeningPublicRooms(){
  if (_unsubRooms) _unsubRooms();

  // Lấy TẤT CẢ phòng, không lọc theo status để debug
  const q = query(collection(db, 'rooms'));

  _unsubRooms = onSnapshot(q, (snap) => {
    const list = $('rooms-list');
    console.log('📡 Snapshot rooms count:', snap.size); // Debug
    snap.forEach(d => console.log('📦 Room:', d.id, d.data().status, d.data().name));

    if (!snap.size) {
      list.innerHTML = '<div class="rm-empty">Chưa có phòng nào. Tạo phòng đầu tiên nhé! 🎮</div>';
      return;
    }

    list.innerHTML = '';

    // Lọc thủ công các phòng có status === 'lobby'
    const rooms = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.status === 'lobby') rooms.push({ id: d.id, ...data });
    });

    console.log('📡 Lobby rooms:', rooms.length); // Debug

    // Sắp xếp theo createdAt giảm dần
    rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (!rooms.length) {
      list.innerHTML = '<div class="rm-empty">Chưa có phòng nào. Tạo phòng đầu tiên nhé! 🎮</div>';
      return;
    }

    rooms.forEach(r => {
      const game = GAMES[r.gameType] || { name: r.gameType, icon: '🎮' };
      const full = (r.members || []).length >= (r.maxPlayers || 2);
      const div = document.createElement('div');
      div.className = 'rm-card';
      div.innerHTML = `
        <div class="rm-icon">${game.icon}</div>
        <div class="rm-info">
          <div class="rm-name">${escHtml(r.name || 'Phòng không tên')} ${r.password ? '🔒' : ''}</div>
          <div class="rm-meta">
            <span>${escHtml(game.name)}</span>
            <span class="rm-dot">·</span>
            <span>${(r.members||[]).length}/${r.maxPlayers||2} người</span>
            <span class="rm-dot">·</span>
            <span>Chủ: ${escHtml(r.hostName || '?')}</span>
          </div>
        </div>
        <div class="rm-action">
          <span class="rm-code">#${r.code}</span>
          <button class="btn-join" ${full ? 'disabled' : ''} data-id="${r.id}" data-pw="${r.password ? '1' : ''}">${full ? 'Đầy' : 'Vào'}</button>
        </div>
      `;
      list.appendChild(div);
    });

    // Gán sự kiện sau khi render
    list.querySelectorAll('.btn-join').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const needPw = b.getAttribute('data-pw') === '1';
        joinRoomFlow(id, needPw);
      });
    });

  }, (err) => {
    console.error('rooms snapshot err', err);
    $('rooms-list').innerHTML = '<div class="rm-empty">⚠️ Không tải được danh sách. Kiểm tra quyền Firestore.</div>';
  });
}

// ===== CREATE ROOM =====
window.openCreateModal = function(){
  $('createModal').classList.add('open');
  const sel = $('cr-game');
  sel.innerHTML = '';
  Object.values(GAMES).forEach(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.icon + ' ' + g.name + (g.ready ? '' : ' (sắp ra mắt)');
    if (!g.ready) o.disabled = true;
    sel.appendChild(o);
  });
  sel.value = 'caro';
  $('cr-name').value = (_myProfile.nickname || 'Phòng') + ' của ' + (_myProfile.nickname || 'tôi');
  $('cr-pw').value = '';
  $('cr-max').value = 2;
};
window.closeCreateModal = function(){ $('createModal').classList.remove('open'); };

window.doCreateRoom = async function(){
  const game = $('cr-game').value;
  const name = $('cr-name').value.trim() || 'Phòng vô danh';
  const pw = $('cr-pw').value.trim();
  const max = Math.max(2, Math.min(8, parseInt($('cr-max').value) || 2));
  const g = GAMES[game];
  if (!g || !g.ready) { toast('Game này chưa sẵn sàng', 'warn'); return; }
  const code = genCode();
  const myName = _myProfile.nickname || _user.email.split('@')[0];
  try {
    const ref = await addDoc(collection(db, 'rooms'), {
      code,
      name,
      gameType: game,
      hostUid: _user.uid,
      hostName: myName,
      password: pw || '',
      status: 'lobby',         // <-- ĐẢM BẢO CÓ STATUS
      maxPlayers: Math.min(max, g.max),
      members: [_user.uid],
      memberInfo: { [_user.uid]: { name: myName, ready: false } },
      createdAt: serverTimestamp()
    });
    console.log('✅ Phòng đã tạo:', ref.id, 'status:', 'lobby');
    closeCreateModal();
    enterLobby(ref.id);
  } catch(e){ toast('Tạo phòng thất bại', 'error'); console.error(e); }
};

// ===== JOIN BY CODE =====
window.openJoinByCode = function(){
  $('joinModal').classList.add('open');
  $('jc-code').value='';
  $('jc-pw').value='';
  $('jc-code').placeholder = 'Nhập 6 số';
};
window.closeJoinModal = function(){ $('joinModal').classList.remove('open'); };

window.doJoinByCode = async function(){
  const code = $('jc-code').value.trim();
  const pw = $('jc-pw').value.trim();
  if (!code || code.length !== 6 || isNaN(code)) {
    toast('Mã phòng phải là 6 chữ số!', 'warn');
    return;
  }
  try {
    const q = query(collection(db, 'rooms'), where('code','==',code));
    const snap = await getDocs(q);
    if (snap.empty) { toast('Không tìm thấy phòng', 'error'); return; }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (data.password && data.password !== pw) { toast('Sai mật khẩu', 'error'); return; }
    if ((data.members||[]).length >= (data.maxPlayers||2) && !(data.members||[]).includes(_user.uid)) {
      toast('Phòng đã đầy', 'warn'); return;
    }
    closeJoinModal();
    await joinRoomById(docSnap.id, data);
  } catch(e){ toast('Lỗi tham gia', 'error'); console.error(e); }
};

async function joinRoomFlow(id, needPw){
  if (needPw) {
    const pw = prompt('Phòng có mật khẩu. Nhập mật khẩu:');
    if (pw === null) return;
    const snap = await getDoc(doc(db,'rooms',id));
    if (!snap.exists()) { toast('Phòng không tồn tại', 'error'); return; }
    const data = snap.data();
    if (data.password !== pw) { toast('Sai mật khẩu', 'error'); return; }
    return joinRoomById(id, data);
  }
  const snap = await getDoc(doc(db,'rooms',id));
  if (!snap.exists()) { toast('Phòng không tồn tại', 'error'); return; }
  return joinRoomById(id, snap.data());
}

async function joinRoomById(id, data){
  try {
    if (!(data.members||[]).includes(_user.uid)){
      const myName = _myProfile.nickname || _user.email.split('@')[0];
      const memberInfo = data.memberInfo || {};
      memberInfo[_user.uid] = { name: myName, ready: false };
      await updateDoc(doc(db,'rooms',id), {
        members: arrayUnion(_user.uid),
        memberInfo
      });
    }
    enterLobby(id);
  } catch(e){ toast('Không thể vào phòng', 'error'); console.error(e); }
}

// ===== LOBBY =====
function enterLobby(roomId){
  _currentRoomId = roomId;
  $('lobbyView').style.display = 'flex';
  $('listView').style.display = 'none';

  if (_unsubRoom) _unsubRoom();
  if (_unsubChat) _unsubChat();

  _unsubRoom = onSnapshot(doc(db,'rooms',roomId), (snap) => {
    if (!snap.exists()){
      toast('Phòng đã bị xoá', 'warn');
      leaveLobby();
      return;
    }
    const data = snap.data();
    renderLobby(data);
    if (data.status === 'playing'){
      const g = GAMES[data.gameType];
      if (g && g.page && g.page !== '#'){
        const url = `${g.page}?room=${roomId}`;
        if (!window.__navigated) { window.__navigated = true; window.location.href = url; }
      }
    }
  });

  _unsubChat = onSnapshot(
    query(collection(db,'rooms',roomId,'chat'), orderBy('createdAt'), limit(80)),
    (snap) => {
      const box = $('lobby-chat-msgs');
      box.innerHTML = '';
      if (!snap.size){
        box.innerHTML = '<div class="lc-sys">Hãy chào mọi người 👋</div>';
      }
      snap.forEach(d => {
        const m = d.data();
        const isMe = m.senderUid === _user.uid;
        const div = document.createElement('div');
        div.className = 'lc-msg ' + (isMe ? 'mine' : 'other');
        div.innerHTML = isMe
          ? `<span class="lc-bubble">${escHtml(m.text)}</span>`
          : `<span class="lc-name">${escHtml(m.senderName)}</span><span class="lc-bubble">${escHtml(m.text)}</span>`;
        box.appendChild(div);
      });
      box.scrollTop = box.scrollHeight;
    }
  );
}

function renderLobby(r){
  const g = GAMES[r.gameType] || {};
  $('lobby-title').textContent = r.name;
  $('lobby-game').textContent = (g.icon || '🎮') + ' ' + (g.name || r.gameType);
  $('lobby-code').textContent = '#' + r.code;
  $('lobby-count').textContent = (r.members||[]).length + '/' + r.maxPlayers;

  const list = $('lobby-members');
  list.innerHTML = '';
  (r.members||[]).forEach(uid => {
    const info = (r.memberInfo||{})[uid] || { name: '?', ready: false };
    const isHost = uid === r.hostUid;
    const isMe = uid === _user.uid;
    const div = document.createElement('div');
    div.className = 'lobby-member' + (info.ready || isHost ? ' ready' : '');
    div.innerHTML = `
      <div class="lm-avatar">${(info.name || '?')[0].toUpperCase()}</div>
      <div class="lm-info">
        <div class="lm-name">${escHtml(info.name)} ${isMe ? '<span class="lm-you">(bạn)</span>' : ''}</div>
        <div class="lm-status">${isHost ? '👑 Chủ phòng' : (info.ready ? '✅ Sẵn sàng' : '⏳ Đang chờ')}</div>
      </div>
    `;
    list.appendChild(div);
  });
  for (let i = (r.members||[]).length; i < r.maxPlayers; i++){
    const div = document.createElement('div');
    div.className = 'lobby-member empty';
    div.innerHTML = `<div class="lm-avatar">+</div><div class="lm-info"><div class="lm-name">Đang chờ người chơi...</div></div>`;
    list.appendChild(div);
  }

  const isHost = r.hostUid === _user.uid;
  const me = (r.memberInfo||{})[_user.uid];
  const btnReady = $('btn-ready');
  const btnStart = $('btn-start');
  if (isHost){
    btnReady.style.display = 'none';
    btnStart.style.display = 'inline-block';
    const allReady = (r.members||[]).filter(u => u !== r.hostUid).every(u => (r.memberInfo||{})[u]?.ready);
    const enough = (r.members||[]).length >= 2;
    btnStart.disabled = !(allReady && enough);
    btnStart.textContent = enough ? (allReady ? '🚀 Bắt đầu' : '⏳ Chờ mọi người sẵn sàng') : '⏳ Cần ít nhất 2 người';
  } else {
    btnStart.style.display = 'none';
    btnReady.style.display = 'inline-block';
    const ready = me && me.ready;
    btnReady.textContent = ready ? '↩ Huỷ sẵn sàng' : '✅ Sẵn sàng';
    btnReady.classList.toggle('on', !!ready);
  }
}

window.toggleReady = async function(){
  if (!_currentRoomId) return;
  const snap = await getDoc(doc(db,'rooms',_currentRoomId));
  if (!snap.exists()) return;
  const data = snap.data();
  const memberInfo = data.memberInfo || {};
  const me = memberInfo[_user.uid] || { name: _myProfile.nickname || '?', ready: false };
  me.ready = !me.ready;
  memberInfo[_user.uid] = me;
  await updateDoc(doc(db,'rooms',_currentRoomId), { memberInfo });
};

window.startGame = async function(){
  if (!_currentRoomId) return;
  const snap = await getDoc(doc(db,'rooms',_currentRoomId));
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.hostUid !== _user.uid) return;
  if ((data.members||[]).length < 2) { toast('Cần ít nhất 2 người', 'warn'); return; }

  let gameState = {};
  if (data.gameType === 'caro'){
    const board = '.'.repeat(15*15);
    const players = data.members.slice(0, 2);
    gameState = { board, currentTurn: players[0], symbols: { [players[0]]: 'X', [players[1]]: 'O' }, players, winner: null, lastMove: null, moveCount: 0 };
  } else if (data.gameType === 'tictactoe'){
    const players = data.members.slice(0, 2);
    gameState = { board: '.........', currentTurn: players[0], symbols: { [players[0]]: 'X', [players[1]]: 'O' }, players, winner: null, winLine: null, moveCount: 0 };
  } else if (data.gameType === 'baucua'){
    gameState = { phase: 'betting', round: 1, dice: [null,null,null], bets: {} };
  } else if (data.gameType === 'xidach'){
    gameState = { phase: 'betting', round: 1, hands: {}, bets: {}, stand: {}, turnOrder: [], turnIdx: 0, results: {}, deck: [] };
  }
  await updateDoc(doc(db,'rooms',_currentRoomId), {
    status: 'playing',
    gameState,
    startedAt: serverTimestamp()
  });
};

window.leaveLobby = async function(){
  if (!_currentRoomId) {
    backToList();
    return;
  }
  try {
    const snap = await getDoc(doc(db,'rooms',_currentRoomId));
    if (snap.exists()){
      const data = snap.data();
      if (data.hostUid === _user.uid && data.status === 'lobby'){
        await deleteDoc(doc(db,'rooms',_currentRoomId));
      } else {
        const memberInfo = data.memberInfo || {};
        delete memberInfo[_user.uid];
        await updateDoc(doc(db,'rooms',_currentRoomId), {
          members: arrayRemove(_user.uid),
          memberInfo
        });
      }
    }
  } catch(e){ console.error(e); }
  backToList();
};

function backToList(){
  if (_unsubRoom) { _unsubRoom(); _unsubRoom = null; }
  if (_unsubChat) { _unsubChat(); _unsubChat = null; }
  _currentRoomId = null;
  window.__navigated = false;
  $('lobbyView').style.display = 'none';
  $('listView').style.display = 'block';
}

window.sendLobbyChat = async function(){
  const input = $('lobby-chat-input');
  const text = input.value.trim();
  if (!text || !_currentRoomId) return;
  input.value = '';
  await addDoc(collection(db,'rooms',_currentRoomId,'chat'), {
    text,
    senderUid: _user.uid,
    senderName: _myProfile.nickname || _user.email.split('[@]')[0],
    createdAt: serverTimestamp()
  });
};