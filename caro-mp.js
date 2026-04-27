// ===== VT WORLD — CARO MULTIPLAYER =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc,
  arrayRemove, serverTimestamp
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

const SIZE = 15;
const ROOM_ID = new URLSearchParams(window.location.search).get('room');

let _user = null;
let _unsub = null;
let _lastBoard = null;

if (!ROOM_ID){
  document.getElementById('mp-content').innerHTML = '<div class="mp-error">⚠️ Thiếu mã phòng. Quay lại từ trang Phòng chơi.</div>';
}

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  _user = user;
  if (!ROOM_ID) return;
  start();
});

function start(){
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db,'rooms',ROOM_ID), (snap) => {
    if (!snap.exists()){
      document.getElementById('mp-content').innerHTML = '<div class="mp-error">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    document.getElementById('mp-room').textContent = '#' + (r.code || '------');
    if (r.gameType !== 'caro'){
      document.getElementById('mp-content').innerHTML = '<div class="mp-error">Phòng này không phải Caro.</div>';
      return;
    }
    if (!r.gameState){
      setStatus('Đang khởi tạo...', 'wait');
      return;
    }
    render(r);
  });
}

function render(r){
  const gs = r.gameState;
  const board = gs.board;
  const players = gs.players || [];
  const symbols = gs.symbols || {};
  const memberInfo = r.memberInfo || {};

  // Players bar
  const pEl = document.getElementById('mp-players');
  pEl.innerHTML = '';
  players.forEach(uid => {
    const sym = symbols[uid] || '?';
    const isTurn = gs.currentTurn === uid && !gs.winner;
    const isMe = uid === _user.uid;
    const name = (memberInfo[uid]?.name) || (isMe ? 'Bạn' : '?');
    const div = document.createElement('div');
    div.className = 'mp-player' + (isTurn ? ' turn' : '');
    div.innerHTML = `
      <div class="mp-p-sym ${sym}">${sym}</div>
      <div>
        <div class="mp-p-name">${escHtml(name)} ${isMe ? '<span style="color:#fbbf24;font-size:11px">(bạn)</span>' : ''}</div>
        <div class="mp-p-status">${isTurn ? '⏳ Đang đến lượt' : 'Chờ'}</div>
      </div>
    `;
    pEl.appendChild(div);
  });

  // Board
  const bEl = document.getElementById('mp-board');
  // Optimization: only rebuild if board changed structure; simple approach: rebuild
  if (_lastBoard !== board){
    bEl.innerHTML = '';
    for (let i=0;i<SIZE*SIZE;i++){
      const ch = board[i];
      const cell = document.createElement('div');
      cell.className = 'mp-cell' + (ch !== '.' ? ' filled ' + ch : '');
      cell.textContent = ch === '.' ? '' : ch;
      cell.dataset.idx = i;
      if (gs.lastMove === i) cell.classList.add('last');
      cell.addEventListener('click', () => onCellClick(i, r));
      bEl.appendChild(cell);
    }
    _lastBoard = board;
  }

  // Highlight winning line
  if (gs.winner && gs.winLine){
    gs.winLine.forEach(idx => {
      const c = bEl.children[idx];
      if (c) c.classList.add('win');
    });
  }

  // Status
  const status = document.getElementById('mp-status');
  const actions = document.getElementById('mp-actions');
  if (gs.winner){
    actions.style.display = 'flex';
    if (gs.winner === 'draw'){
      setStatus('🤝 Hoà! Bàn cờ đã đầy.', 'wait');
    } else if (gs.winner === _user.uid){
      setStatus('🏆 Bạn thắng!', 'win');
    } else {
      const winnerName = memberInfo[gs.winner]?.name || 'Đối thủ';
      setStatus('💔 ' + escHtml(winnerName) + ' đã thắng', 'lose');
    }
  } else {
    actions.style.display = 'none';
    if (gs.currentTurn === _user.uid){
      setStatus('🎯 Đến lượt bạn — đặt quân ' + (symbols[_user.uid] || '?'), 'your-turn');
    } else {
      const turnName = memberInfo[gs.currentTurn]?.name || 'Đối thủ';
      setStatus('⏳ Đang chờ ' + escHtml(turnName) + '...', 'wait');
    }
  }
}

function setStatus(text, cls){
  const el = document.getElementById('mp-status');
  el.className = 'mp-status ' + cls;
  el.innerHTML = text;
}

async function onCellClick(idx, r){
  const gs = r.gameState;
  if (gs.winner) return;
  if (gs.currentTurn !== _user.uid){ showToast('Chưa đến lượt bạn', 'warn'); return; }
  if (gs.board[idx] !== '.'){ return; }
  const mySym = gs.symbols[_user.uid];
  if (!mySym) return;

  const newBoard = gs.board.substring(0, idx) + mySym + gs.board.substring(idx+1);
  const winLine = checkWin(newBoard, idx, mySym);
  const moveCount = (gs.moveCount || 0) + 1;
  let winner = null;
  if (winLine) winner = _user.uid;
  else if (moveCount >= SIZE*SIZE) winner = 'draw';

  const otherUid = gs.players.find(p => p !== _user.uid);
  const updates = {
    'gameState.board': newBoard,
    'gameState.lastMove': idx,
    'gameState.moveCount': moveCount,
    'gameState.currentTurn': otherUid
  };
  if (winner){
    updates['gameState.winner'] = winner;
    updates['gameState.winLine'] = winLine || [];
    updates['status'] = 'ended';
  }

  try {
    await updateDoc(doc(db,'rooms',ROOM_ID), updates);
    // Cộng điểm + nhiệm vụ nếu thắng (tự bản thân update)
    if (winner === _user.uid){
      try {
        const uref = doc(db,'users',_user.uid);
        const us = await getDoc(uref);
        const cur = us.exists() ? (us.data().points||0) : 0;
        await updateDoc(uref, { points: cur + 100, lastUpdate: serverTimestamp() });
        if (window.VTQuests){
          window.VTQuests.trackEarn(100);
          window.VTQuests.trackWinSmart();
        }
        showToast('🎉 +100đ thắng Caro!', 'success');
      } catch(e){}
    }
  } catch(e){
    console.error(e);
    showToast('Không gửi được nước đi', 'error');
  }
}

function checkWin(board, lastIdx, sym){
  const x = lastIdx % SIZE;
  const y = Math.floor(lastIdx / SIZE);
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dx,dy] of dirs){
    const line = [lastIdx];
    // forward
    let i=1;
    while (true){
      const nx = x + dx*i, ny = y + dy*i;
      if (nx<0||nx>=SIZE||ny<0||ny>=SIZE) break;
      const idx = ny*SIZE + nx;
      if (board[idx] !== sym) break;
      line.push(idx); i++;
    }
    // backward
    i=1;
    while (true){
      const nx = x - dx*i, ny = y - dy*i;
      if (nx<0||nx>=SIZE||ny<0||ny>=SIZE) break;
      const idx = ny*SIZE + nx;
      if (board[idx] !== sym) break;
      line.push(idx); i++;
    }
    if (line.length >= 5) return line.slice(0,5).concat(line.slice(5));
  }
  return null;
}

window.requestRematch = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid){ showToast('Chỉ chủ phòng mới chơi lại', 'warn'); return; }
  const players = r.gameState?.players || r.members.slice(0,2);
  // đổi người đi trước
  const first = players[1] || players[0];
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    status: 'playing',
    'gameState.board': '.'.repeat(SIZE*SIZE),
    'gameState.currentTurn': first,
    'gameState.winner': null,
    'gameState.winLine': null,
    'gameState.lastMove': null,
    'gameState.moveCount': 0
  });
  _lastBoard = null;
};

window.quitGame = async function(){
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (snap.exists()){
      const r = snap.data();
      if (r.hostUid === _user.uid){
        await deleteDoc(doc(db,'rooms',ROOM_ID)); // Sửa: host rời → xóa phòng
      } else {
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db,'rooms',ROOM_ID)); // Sửa: không còn ai → xóa phòng
        } else {
          const memberInfo = r.memberInfo || {};
          delete memberInfo[_user.uid];
          await updateDoc(doc(db,'rooms',ROOM_ID), { members: arrayRemove(_user.uid), memberInfo });
        }
      }
    }
  } catch(e){}
  window.location.href = 'rooms.html';
};

function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
