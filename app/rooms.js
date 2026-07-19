// ===== VT WORLD — MULTIPLAYER ROOMS (Đồng bộ points) =====
import { db, auth } from '../points.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp, addDoc, arrayUnion, arrayRemove,
  orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initProfileCard } from '../profile-card.js';

const GAMES = {
  xidach:    { id: 'xidach',    name: 'Xì dách',     icon: '♣️', max: 5, min: 2, page: '../games/xidach/xidach-mp.html',         ready: true },
  baucua:    { id: 'baucua',    name: 'Bầu Cua',     icon: '🎲', max: 8, min: 2, page: '../games/baucua/baucua-mp.html',         ready: true },
  baicao:    { id: 'baicao',    name: 'Bài Cào',     icon: '🃏', max: 5, min: 2, page: '../games/baicao/baicao-mp.html',         ready: true },
  caro:      { id: 'caro',      name: 'Caro',        icon: '♟️', max: 2, min: 2, page: '../games/caro/caro-mp.html',            ready: true },
  tictactoe: { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '⭕', max: 2, min: 2, page: '../games/tictactoe/tictactoe-mp.html',    ready: true },
  pickso:    { id: 'pickso',    name: 'Pick Số',     icon: '🔢', max: 6, min: 2, page: '../games/pickso/pickso-mp.html',         ready: true },
  chess:     { id: 'chess',     name: 'Cờ Vua',      icon: '♞', max: 2, min: 2, page: '../games/chess/chess-mp.html',            ready: true },
  xiangqi:   { id: 'xiangqi',   name: 'Cờ Tướng',    icon: '🀄', max: 2, min: 2, page: '../games/xiangqi/xiangqi-mp.html',       ready: true },
  altp:      { id: 'altp',      name: 'Ai Là Triệu Phú', icon: '💰', max: 8, min: 2, page: '../games/altp/altp-mp.html',         ready: true },
  catte:     { id: 'catte',     name: 'Cát Tê',      icon: '♣️', max: 4, min: 2, page: '../games/catte/catte-mp.html',          ready: true },
  tienlen:   { id: 'tienlen',   name: 'Tiến Lên',    icon: '♥️', max: 4, min: 2, page: '../games/tienlen/tienlen-mp.html',       ready: true },
  timso:     { id: 'timso',     name: 'Tìm Số',      icon: '🔢', max: 2, min: 2, page: '../games/timso/timso-mp.html',          ready: true },
};

const ADMIN_EMAIL = 'thang@game.com';

let _user = null;
let _myProfile = null;
let _unsubRooms = null;
let _unsubRoom = null;
let _unsubChat = null;
let _currentRoomId = null;

function $(id){ return document.getElementById(id); }
function setText(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function genCode(){ return String(Math.floor(100000 + Math.random() * 900000)); }
function toast(msg, type='info'){
  if (window.showToast) return window.showToast(msg, type);
  const c = document.createElement('div');
  c.style.cssText='position:fixed;top:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:12px;background:#0b1f3a;border:1px solid #38bdf8;color:#e0f2fe;font-weight:700;font-family:Nunito,sans-serif';
  c.textContent = msg; document.body.appendChild(c); setTimeout(()=>c.remove(),2800);
}

function showDebugError(stage, err){
  console.error('[rooms.js] lỗi ở giai đoạn:', stage, err);
  const list = document.getElementById('rooms-list');
  if (list) {
    list.innerHTML = `<div class="rm-empty" style="color:#f87171;text-align:left;white-space:pre-wrap;font-size:12px">⚠️ LỖI (${stage}):\n${(err && (err.message || err.code)) || String(err)}</div>`;
  }
}

try {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) { window.location.href = '../index.html'; return; }
      _user = user;
      initProfileCard({ db, getMyUid: () => _user.uid });
      const ps = await getDoc(doc(db, 'users', user.uid));
      _myProfile = ps.exists() ? ps.data() : { nickname: user.email.split('@')[0] };
      setText('me-name', _myProfile.nickname || user.email.split('@')[0]);
      // Hiện nút xoá tất cả nếu là admin
      const btnDelAll = $('btn-delete-all');
      if (btnDelAll) btnDelAll.style.display = (user.email === ADMIN_EMAIL) ? 'inline-block' : 'none';
      startListeningPublicRooms();
    } catch (err) {
      showDebugError('onAuthStateChanged callback', err);
    }
  }, (err) => {
    showDebugError('onAuthStateChanged error', err);
  });
} catch (err) {
  showDebugError('khởi tạo onAuthStateChanged', err);
}

// Nếu sau 6 giây vẫn chưa có gì xảy ra (vẫn "Đang tải..."), báo rõ để biết module có chạy hay không
setTimeout(() => {
  const list = document.getElementById('rooms-list');
  if (list && list.textContent.includes('Đang tải')) {
    showDebugError('timeout 6s', 'onAuthStateChanged không bao giờ được gọi — kiểm tra import ./points.js, cấu hình Firebase, hoặc lỗi cú pháp trong rooms.js.');
  }
}, 6000);

function startListeningPublicRooms(){
  if (_unsubRooms) _unsubRooms();
  const q = query(collection(db, 'rooms'), where('status', 'in', ['lobby', 'playing']), limit(30));
  _unsubRooms = onSnapshot(q, (snap) => {
    const list = $('rooms-list');
    if (!snap.size) {
      list.innerHTML = '<div class="rm-empty">Chưa có phòng nào. Tạo phòng đầu tiên nhé! 🎮</div>';
      return;
    }
    list.innerHTML = '';
    const rooms = [];
    snap.forEach(d => {
      const r = d.data();
      if (r.status === 'lobby' || r.status === 'playing') rooms.push({ id: d.id, ...r });
    });
    rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    rooms.forEach(r => {
      const game = GAMES[r.gameType] || { name: r.gameType, icon: '🎮' };
      const full = (r.members || []).length >= (r.maxPlayers || 2);
      const gsPhase = r.gameState?.phase;
      const isPlaying = r.status === 'playing' && (!gsPhase || gsPhase === 'playing');
      const isWaiting = (r.waitingMembers || []).includes(_user.uid);

      let btnText, btnDisabled;
      if (isPlaying) {
        btnText = isWaiting ? '✅ Đã chờ' : '⏳ Chờ';
        btnDisabled = isWaiting;
      } else if (full) {
        btnText = 'Đầy';
        btnDisabled = true;
      } else {
        btnText = 'Vào';
        btnDisabled = false;
      }

      const waitingCount = (r.waitingMembers||[]).length;

      const canDelete = _user && (_user.uid === r.hostUid || _user.email === ADMIN_EMAIL);

      const div = document.createElement('div');
      div.className = 'rm-card';
      div.innerHTML = `
        <div class="rm-icon">${game.icon}</div>
        <div class="rm-info">
          <div class="rm-name">${escHtml(r.name || 'Phòng không tên')} ${r.password ? '🔒' : ''} ${isPlaying ? '<span class="rm-badge-playing">ĐANG CHƠI</span>' : ''}</div>
          <div class="rm-meta">
            <span>${escHtml(game.name)}</span>
            <span class="rm-dot">·</span>
            <span>${(r.members||[]).length}/${r.maxPlayers||2}</span>
          </div>
        </div>
        <div class="rm-action">
          <span class="rm-code">#${r.code}</span>
          <div class="rm-btns">
            ${canDelete ? `<button class="btn-rm-del" data-id="${r.id}">Xoá</button>` : ''}
            <button class="btn-join" ${btnDisabled ? 'disabled' : ''} data-id="${r.id}" data-pw="${r.password ? '1' : ''}">${btnText}</button>
          </div>
        </div>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.btn-join').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.getAttribute('data-id');
        const needPw = b.getAttribute('data-pw') === '1';
        joinRoomFlow(id, needPw);
      });
    });
    list.querySelectorAll('.btn-rm-del').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.getAttribute('data-id');
        if (!confirm('🗑️ Xoá phòng này? Tất cả người chơi sẽ bị đẩy ra ngoài.')) return;
        try {
          await deleteDoc(doc(db, 'rooms', id));
          toast('Đã xoá phòng', 'success');
        } catch(err) {
          console.error(err);
          toast('Xoá thất bại', 'error');
        }
      });
    });

  }, (err) => {
    console.error('rooms snapshot err', err);
    $('rooms-list').innerHTML = '<div class="rm-empty">⚠️ Không tải được danh sách. Kiểm tra quyền Firestore.</div>';
  });
}

// ── CREATE / JOIN / LOBBY ──────────────────────────────────
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
  sel.value = 'xidach';
  $('cr-name').value = (_myProfile.nickname || 'Phòng') + ' của ' + (_myProfile.nickname || 'tôi');
  $('cr-pw').value = '';
  $('cr-max').value = 4;
};
window.closeCreateModal = function(){ $('createModal').classList.remove('open'); };

window.doCreateRoom = async function(){
  const game = $('cr-game').value;
  const name = $('cr-name').value.trim() || 'Phòng vô danh';
  const pw = $('cr-pw').value.trim();
  const max = Math.max(2, Math.min(8, parseInt($('cr-max').value) || 4));
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
      status: 'lobby',
      maxPlayers: Math.min(max, g.max),
      members: [_user.uid],
      memberInfo: { [_user.uid]: { name: myName, avatarUrl: _myProfile.avatarUrl || '', ready: true } },
      createdAt: serverTimestamp()
    });
    closeCreateModal();
    enterLobby(ref.id);
  } catch(e){ toast('Tạo phòng thất bại', 'error'); console.error(e); }
};

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
  if (!code || code.length !== 6 || isNaN(code)) { toast('Mã phòng phải là 6 chữ số!', 'warn'); return; }
  try {
    const q = query(collection(db, 'rooms'), where('code','==',code));
    const snap = await getDocs(q);
    if (snap.empty) { toast('Không tìm thấy phòng', 'error'); return; }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (data.password && data.password !== pw) { toast('Sai mật khẩu', 'error'); return; }
    if (data.status !== 'playing' && (data.members||[]).length >= (data.maxPlayers||2) && !(data.members||[]).includes(_user.uid)) {
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
    const myName = _myProfile.nickname || _user.email.split('@')[0];
    if (data.status === 'playing') {
      // Phòng đang chơi → vào ghế chờ
      if (!(data.waitingMembers||[]).includes(_user.uid) && !(data.members||[]).includes(_user.uid)) {
        await updateDoc(doc(db,'rooms',id), {
          waitingMembers: arrayUnion(_user.uid),
          [`waitingMemberInfo.${_user.uid}`]: { name: myName, avatarUrl: _myProfile.avatarUrl || '' }
        });
      }
    } else {
      if (!(data.members||[]).includes(_user.uid)){
        const memberInfo = data.memberInfo || {};
        memberInfo[_user.uid] = { name: myName, avatarUrl: _myProfile.avatarUrl || '', ready: true };
        await updateDoc(doc(db,'rooms',id), {
          members: arrayUnion(_user.uid),
          memberInfo
        });
      }
    }
    enterLobby(id);
  } catch(e){ toast('Không thể vào phòng', 'error'); console.error(e); }
}

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
  const waitingCount = (r.waitingMembers||[]).length;
  $('lobby-count').textContent = (r.members||[]).length + '/' + r.maxPlayers + (waitingCount ? ' (+' + waitingCount + ' chờ)' : (r.status === 'playing' ? ' (đang chơi)' : ''));

  // ── Members (compact) ──
  const list = $('lobby-members');
  list.innerHTML = '';
  (r.members||[]).forEach(uid => {
    const info = (r.memberInfo||{})[uid] || { name: '?', ready: false };
    const isHost = uid === r.hostUid;
    const isMe = uid === _user.uid;
    const div = document.createElement('div');
    div.className = 'lobby-member' + (info.ready || isHost ? ' ready' : '');
   const avStyle = info.avatarUrl
  ? `background:url(${info.avatarUrl}) center/cover;color:transparent`
  : '';
div.innerHTML = `
  <div class="lm-avatar" style="${avStyle};cursor:pointer" onclick="window.showProfileCard && window.showProfileCard('${uid}')">${info.avatarUrl ? '' : (info.name||'?')[0].toUpperCase()}</div>
  <div class="lm-info">
    <div class="lm-name">${escHtml(info.name)} ${isMe ? '<span class="lm-you">(bạn)</span>' : ''}</div>
    <div class="lm-status">${isHost ? '👑 Chủ phòng' : (info.ready ? '✅ Sẵn sàng' : '⏳ Đang chờ')}</div>
  </div>
`;
    list.appendChild(div);
  });
  // Empty slots
  for (let i = (r.members||[]).length; i < r.maxPlayers; i++){
    const div = document.createElement('div');
    div.className = 'lobby-member empty';
    div.innerHTML = `<div class="lm-avatar">+</div><div class="lm-info"><div class="lm-name">Đang chờ...</div></div>`;
    list.appendChild(div);
  }

  const isHost = r.hostUid === _user.uid;
  const isAdmin = _user && _user.email === ADMIN_EMAIL;
  const me = (r.memberInfo||{})[_user.uid];
  const btnReady = $('btn-ready');
  const btnStart = $('btn-start');
  const btnDelete = $('btn-delete-room');
  
  // Delete room button (for host and admin)
  if (btnDelete) {
    btnDelete.style.display = (isHost || isAdmin) ? 'inline-block' : 'none';
  }

  if (isHost){
    btnReady.style.display = 'none';
    btnStart.style.display = 'inline-block';
    const allReady = (r.members||[]).filter(u => u !== r.hostUid).every(u => (r.memberInfo||{})[u]?.ready);
    const enough = (r.members||[]).length >= 2;
    btnStart.disabled = !(allReady && enough);
    btnStart.textContent = enough ? (allReady ? '🚀 Bắt đầu' : '⏳ Chờ sẵn sàng') : '⏳ Cần 2 người';
  } else {
    btnStart.style.display = 'none';
    btnReady.style.display = 'inline-block';
    const ready = me && me.ready;
    btnReady.textContent = ready ? '↩ Huỷ' : '✅ Sẵn sàng';
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
    gameState = { phase: 'betting', round: 1, hands: {}, bets: {}, stands: {}, turnOrder: [], turnIdx: 0, results: {}, deck: [], revealed: {}, dealerChecked: {} };
  } else if (data.gameType === 'baicao'){
    gameState = { phase: 'betting', round: 1, hands: {}, bets: {}, results: {}, deck: [] };
  } else if (data.gameType === 'pickso'){
    gameState = { phase: 'betting', round: 1, bets: {}, picks: {}, turnOrder: [], turnIdx: 0, winners: [], deltas: {} };
  } else if (data.gameType === 'chess'){
    gameState = { phase: 'betting', round: 1, bets: {}, betAmount: null, betDeclinedBy: null, colors: {}, fen: null, turn: 'w', lastMove: null, moveCount: 0, players: data.members.slice(0, 2), result: null, winnerUid: null, drawOffer: null };
  } else if (data.gameType === 'xiangqi'){
    gameState = { phase: 'betting', round: 1, bets: {}, betAmount: null, betDeclinedBy: null, colors: {}, boardStr: null, turn: 'r', lastMove: null, moveCount: 0, players: data.members.slice(0, 2), result: null, winnerUid: null, drawOffer: null };
  } else if (data.gameType === 'catte'){
    gameState = { phase: 'betting', cycle: 0, betAmount: null, betConfirmed: {}, seats: [], hands: {}, turn: null, round: 0, currentTrick: null, trickWins: {}, tungChecked: false, survivors: null, deadPlayers: null, results: null, winners: null, maxWins: null };
  } else if (data.gameType === 'tienlen'){
    gameState = { phase: 'betting', cycle: 0, betAmount: null, betConfirmed: {}, seats: [], hands: {}, turn: null, tableCombo: null, lastPlayer: null, passCount: 0, whoPassedThisRound: [], chainPenalties: {}, chayBai: {}, finished: [], results: null, winners: null, lastActionMsg: null };
  } else if (data.gameType === 'altp'){
    gameState = {
      phase: 'waiting',
      timeLimit: 30,
      round: 1,
      scores: {},
      answers: {},
      answerOrder: [],
      answerCounts: {},
      currentQ: null,
      roundIdx: 0,
      usedQuestions: [],
      hiddenOptions: [],
      lifelines: { fifty: false, audience: false, phone: false },
      audienceResult: null,
      phoneMsg: null,
      streaks: {},
      timerEndAt: null
    };
  } else if (data.gameType === 'timso'){
    const players = data.members.slice(0, 2);
    gameState = { phase: 'betting', betConfirmed: {}, betAmount: null, bet: null, players };
  }
  await updateDoc(doc(db,'rooms',_currentRoomId), {
    status: 'playing',
    gameState,
    startedAt: serverTimestamp()
  });
};

window.leaveLobby = async function(){
  if (!_currentRoomId) { backToList(); return; }
  try {
    await removeUserFromRoom();
  } catch(e){ console.error(e); }
  backToList();
};

/**
 * Remove current user from the room and auto-delete if empty.
 * Also used by pagehide for cleanup.
 */
async function removeUserFromRoom() {
  if (!_currentRoomId || !_user) return;
  const snap = await getDoc(doc(db,'rooms',_currentRoomId));
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.hostUid === _user.uid) {
    // Chủ phòng rời: xoá phòng hoàn toàn
    await deleteDoc(doc(db,'rooms',_currentRoomId));
  } else {
    const memberInfo = data.memberInfo || {};
    delete memberInfo[_user.uid];
    const wInfo = data.waitingMemberInfo || {};
    delete wInfo[_user.uid];
    await updateDoc(doc(db,'rooms',_currentRoomId), {
      members: arrayRemove(_user.uid),
      memberInfo,
      waitingMembers: arrayRemove(_user.uid),
      waitingMemberInfo: wInfo
    });
    // Kiểm tra nếu phòng không còn ai → xoá luôn
    const snap2 = await getDoc(doc(db,'rooms',_currentRoomId));
    if (snap2.exists()) {
      const r2 = snap2.data();
      const allMembers = [...(r2.members||[]), ...(r2.waitingMembers||[])];
      if (!allMembers.length) {
        await deleteDoc(doc(db,'rooms',_currentRoomId));
      }
    }
  }
}

/**
 * Delete all rooms (admin only)
 */
window.deleteAllRooms = async function() {
  if (_user?.email !== ADMIN_EMAIL) return;
  if (!confirm('⚠️ Xoá TẤT CẢ phòng? Người chơi trong phòng sẽ bị đẩy ra ngoài!')) return;
  if (!confirm('Bạn chắc chắn? Hành động này không thể hoàn tác!')) return;
  const btn = $('btn-delete-all');
  if (btn) { btn.disabled = true; btn.textContent = '🔄 Đang xoá...'; }
  try {
    const snap = await getDocs(collection(db, 'rooms'));
    const ids = snap.docs.map(d => d.id);
    if (!ids.length) { toast('Không có phòng nào để xoá', 'info'); return; }
    toast(`Đang xoá ${ids.length} phòng...`, 'info');
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await Promise.all(batch.map(id => deleteDoc(doc(db, 'rooms', id))));
    }
    toast(`✅ Đã xoá ${ids.length} phòng`, 'success');
  } catch(e) {
    console.error(e);
    toast('Xoá thất bại: ' + (e.message || ''), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Xoá tất cả'; }
  }
};

/**
 * Host delete room with confirmation
 */
window.deleteRoom = async function() {
  if (!_currentRoomId) return;
  if (!confirm('Xoá phòng này? Tất cả người chơi sẽ bị đẩy ra ngoài.')) return;
  try {
    await deleteDoc(doc(db,'rooms',_currentRoomId));
    toast('Đã xoá phòng', 'success');
  } catch(e) { console.error(e); toast('Xoá phòng thất bại', 'error'); }
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

// ── AUTO CLEANUP khi tắt tab (không chạy khi đang navigate sang game) ──
window.addEventListener('pagehide', () => {
  if (!window.__navigated && _currentRoomId && _user) {
    leaveLobby().catch(() => {});
  }
});

window.sendLobbyChat = async function(){
  const input = $('lobby-chat-input');
  const text = input.value.trim();
  if (!text || !_currentRoomId) return;
  input.value = '';
  await addDoc(collection(db,'rooms',_currentRoomId,'chat'), {
    text,
    senderUid: _user.uid,
    senderName: _myProfile.nickname || _user.email.split('@')[0],
    createdAt: serverTimestamp()
  });
};