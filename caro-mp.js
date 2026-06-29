// caro-mp.js — Caro Multiplayer qua phòng (rooms.js)
import { db, auth } from './points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================================================
//  STATE
// ============================================================
let roomId = null;
let roomData = null;
let myUid = null;
let myName = 'Bạn';

let BOARD_SIZE = 15;
let WIN_COUNT = 5;
let CELL_SIZE = 36;

let board = [];
let currentTurn = null;
let mySymbol = null;
let gameActive = false;
let isMyTurn = false;
let gameOver = false;
let lastMove = null;
let moveCount = 0;
let isProcessingMove = false;

let canvas, ctx;
let _unsubRoom = null;

// ============================================================
//  DOM REFS
// ============================================================
const $ = id => document.getElementById(id);
const statusEl = $('mp-status');
const p1El = $('mp-p1');
const p2El = $('mp-p2');
const p1Name = p1El.querySelector('.name');
const p2Name = p2El.querySelector('.name');
const p1Ready = $('mp-p1-ready');
const p2Ready = $('mp-p2-ready');
const btnReady = $('btn-ready-mp');
const btnStart = $('btn-start-mp');
const roomNameEl = $('mp-room-name');
const roomCodeEl = $('mp-room-code');
const resultModal = $('result-modal');
const waitingOverlay = $('mp-waiting-overlay');

canvas = $('caro-canvas');
ctx = canvas.getContext('2d');

// ============================================================
//  AUTH & INIT
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  myUid = user.uid;
  const snap = await getDoc(doc(db, 'users', user.uid));
  myName = snap.exists() ? (snap.data().nickname || user.email.split('@')[0]) : user.email.split('@')[0];

  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  if (!roomId) {
    statusEl.innerHTML = '⚠️ Không tìm thấy phòng. Quay lại danh sách.';
    return;
  }
  initRoom();
});

// ============================================================
//  ROOM LISTENER
// ============================================================
function initRoom() {
  if (_unsubRoom) _unsubRoom();
  _unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (!snap.exists()) {
      statusEl.innerHTML = '❌ Phòng đã bị xoá hoặc không tồn tại.';
      return;
    }
    roomData = snap.data();
    renderRoomInfo();
    handleGameState(roomData);
  }, (err) => {
    console.error('room snapshot error', err);
    statusEl.innerHTML = '⚠️ Lỗi kết nối phòng.';
  });
}

// ============================================================
//  RENDER UI
// ============================================================
function renderRoomInfo() {
  if (!roomData) return;
  roomNameEl.textContent = roomData.name || 'Phòng Caro';
  roomCodeEl.textContent = '#' + (roomData.code || '------');

  const members = roomData.members || [];
  const memberInfo = roomData.memberInfo || {};

  const p1Uid = members[0] || null;
  const p2Uid = members[1] || null;

  if (p1Uid) {
    const info = memberInfo[p1Uid] || { name: '?', ready: false };
    p1Name.textContent = p1Uid === myUid ? myName + ' (bạn)' : info.name;
    p1Ready.textContent = info.ready ? '✅' : '⏳';
    p1Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p1Name.textContent = 'Đang chờ...';
    p1Ready.textContent = '⏳';
    p1Ready.className = 'wait-badge';
  }

  if (p2Uid) {
    const info = memberInfo[p2Uid] || { name: '?', ready: false };
    p2Name.textContent = p2Uid === myUid ? myName + ' (bạn)' : info.name;
    p2Ready.textContent = info.ready ? '✅' : '⏳';
    p2Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p2Name.textContent = 'Đang chờ...';
    p2Ready.textContent = '⏳';
    p2Ready.className = 'wait-badge';
  }

  p1El.classList.toggle('active', currentTurn === p1Uid && gameActive && !gameOver);
  p2El.classList.toggle('active', currentTurn === p2Uid && gameActive && !gameOver);

  const isHost = roomData.hostUid === myUid;
  if (isHost && roomData.status === 'lobby') {
    btnReady.style.display = 'none';
    btnStart.style.display = 'inline-block';
    const allReady = members.filter(u => u !== roomData.hostUid).every(u => memberInfo[u]?.ready);
    const enough = members.length >= 2;
    btnStart.disabled = !(allReady && enough);
    btnStart.textContent = enough ? (allReady ? '🚀 Bắt đầu' : '⏳ Chờ sẵn sàng') : '⏳ Cần 2 người';
  } else if (roomData.status === 'lobby') {
    btnStart.style.display = 'none';
    btnReady.style.display = 'inline-block';
    const myInfo = memberInfo[myUid] || { ready: false };
    btnReady.textContent = myInfo.ready ? '↩ Huỷ sẵn sàng' : '✅ Sẵn sàng';
    btnReady.classList.toggle('on', !!myInfo.ready);
  } else {
    btnReady.style.display = 'none';
    btnStart.style.display = 'none';
  }

  if (roomData.status === 'lobby' && members.length < 2) {
    waitingOverlay.classList.remove('hidden');
    waitingOverlay.querySelector('.wait-text').textContent = '⏳ Đang chờ người chơi thứ 2...';
  } else if (roomData.status === 'lobby') {
    waitingOverlay.classList.add('hidden');
  } else {
    waitingOverlay.classList.add('hidden');
  }

  if (roomData.status === 'lobby') {
    statusEl.innerHTML = `🔄 Đang trong phòng chờ · ${members.length}/${roomData.maxPlayers || 2} người`;
    statusEl.style.color = '#94a3b8';
  } else if (roomData.status === 'playing') {
    if (gameActive && !gameOver) {
      const turnName = currentTurn === myUid ? 'bạn' : (memberInfo[currentTurn]?.name || 'đối thủ');
      statusEl.innerHTML = `⚔️ Lượt của ${turnName} ${mySymbol ? '(' + mySymbol + ')' : ''}`;
      statusEl.style.color = currentTurn === myUid ? '#38bdf8' : '#f87171';
    }
  }
}

// ============================================================
//  HANDLE GAME STATE
// ============================================================
function handleGameState(data) {
  if (data.status !== 'playing') {
    gameActive = false;
    gameOver = false;
    return;
  }

  const gs = data.gameState || {};
  if (!gs.board) return;

  // Parse board
  const boardStr = gs.board || '';
  board = [];
  for (let i = 0; i < boardStr.length; i++) {
    const ch = boardStr[i];
    if (ch === 'X') board.push(1);
    else if (ch === 'O') board.push(2);
    else board.push(0);
  }

  if (board.length === 0) {
    board = Array(225).fill(0);
  }

  BOARD_SIZE = Math.sqrt(board.length);
  WIN_COUNT = data.gameType === 'tictactoe' ? 3 : 5;
  CELL_SIZE = BOARD_SIZE === 3 ? 100 : 36;

  currentTurn = gs.currentTurn || null;
  gameActive = true;
  gameOver = gs.winner !== null && gs.winner !== undefined && gs.winner !== 'draw';
  
  const symbols = gs.symbols || {};
  mySymbol = symbols[myUid] || null;
  
  if (!mySymbol && gs.players && gs.players.length >= 2) {
    const p1 = gs.players[0];
    const p2 = gs.players[1];
    if (myUid === p1) mySymbol = 'X';
    else if (myUid === p2) mySymbol = 'O';
  }

  isMyTurn = currentTurn === myUid && !gameOver && gameActive;

  initCanvas();
  drawBoard();

  if (gs.winLine && gs.winLine.length > 0) {
    highlightWin(gs.winLine);
  }

  renderRoomInfo();

  if (gameOver || gs.winner === 'draw') {
    if (gs.winner && gs.winner !== 'draw') {
      showResultFromState(gs);
    } else if (gs.winner === 'draw') {
      showResult('🤝', 'Hòa!', '', 'Không còn nước đi');
    }
  }
}

// ============================================================
//  BOARD RENDER
// ============================================================
function initCanvas() {
  const size = BOARD_SIZE * CELL_SIZE + 1;
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = Math.min(size, window.innerWidth - 32) + 'px';
  canvas.style.height = 'auto';
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(56,189,248,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const pos = i * CELL_SIZE;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(canvas.width, pos); ctx.stroke();
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const val = board[r * BOARD_SIZE + c];
      if (val === 0) continue;
      const cx = c * CELL_SIZE + CELL_SIZE / 2;
      const cy = r * CELL_SIZE + CELL_SIZE / 2;

      if (BOARD_SIZE === 3) {
        drawTicSymbol(cx, cy, val);
      } else {
        drawCaroPiece(cx, cy, val);
      }
    }
  }
}

function drawCaroPiece(cx, cy, val) {
  const r = CELL_SIZE * 0.38;
  const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r);
  if (val === 1) { grad.addColorStop(0, '#7ee8fa'); grad.addColorStop(1, '#0ea5e9'); }
  else { grad.addColorStop(0, '#fca5a5'); grad.addColorStop(1, '#ef4444'); }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = val === 1 ? 'rgba(56,189,248,0.5)' : 'rgba(248,113,113,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTicSymbol(cx, cy, val) {
  const s = CELL_SIZE * 0.3;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  if (val === 1) {
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(cx-s, cy-s); ctx.lineTo(cx+s, cy+s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+s, cy-s); ctx.lineTo(cx-s, cy+s); ctx.stroke();
  } else {
    ctx.strokeStyle = '#f87171';
    ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI*2); ctx.stroke();
  }
}

function highlightWin(cells) {
  if (!cells || !Array.isArray(cells) || cells.length === 0) return;
  cells.forEach(([r, c]) => {
    const cx = c * CELL_SIZE + CELL_SIZE/2;
    const cy = r * CELL_SIZE + CELL_SIZE/2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL_SIZE * 0.42, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(52,211,153,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

// ============================================================
//  CLICK HANDLER
// ============================================================
canvas.addEventListener('click', handleClick);
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  handleMove(
    (t.clientX - rect.left) * scaleX,
    (t.clientY - rect.top) * scaleY
  );
});

function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  handleMove(
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY
  );
}

async function handleMove(px, py) {
  if (!gameActive || gameOver || !isMyTurn || isProcessingMove) {
    if (!isMyTurn && gameActive) {
      window.showToast('🔴 Chưa đến lượt bạn!', 'warn');
    }
    return;
  }
  if (!roomId || !roomData) return;
  if (!mySymbol) {
    window.showToast('⚠️ Chưa xác định được quân của bạn!', 'error');
    return;
  }

  const c = Math.floor(px / CELL_SIZE);
  const r = Math.floor(py / CELL_SIZE);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
    window.showToast('⚠️ Đánh ngoài bàn cờ!', 'warn');
    return;
  }
  if (board[r * BOARD_SIZE + c] !== 0) {
    window.showToast('⚠️ Ô này đã được đánh!', 'warn');
    return;
  }

  await sendMove(r, c);
}
// ============================================================
//  SEND MOVE
// ============================================================
async function sendMove(r, c) {
  if (isProcessingMove) return;
  isProcessingMove = true;

  try {
    const gs = roomData.gameState || {};
    
    const boardArr = board.slice();
    const val = mySymbol === 'X' ? 1 : 2;
    boardArr[r * BOARD_SIZE + c] = val;

    board = boardArr.slice();

    const winCells = checkWin(r, c, val);
    
    let boardStr = '';
    for (let i = 0; i < boardArr.length; i++) {
      const v = boardArr[i];
      if (v === 1) boardStr += 'X';
      else if (v === 2) boardStr += 'O';
      else boardStr += '.';
    }

    const newGs = {
      ...gs,
      board: boardStr,
      currentTurn: getOpponentUid(),
      lastMove: [r, c],
      moveCount: (gs.moveCount || 0) + 1
    };

    if (winCells) {
      console.log('🎉 THẮNG! Win cells:', winCells);
      newGs.winner = myUid;
      newGs.winLine = winCells;
      gameOver = true;
      gameActive = false;
      
      drawBoard();
      highlightWin(winCells);
      
      try {
        const { addPoints } = await import('./points.js');
        await addPoints('Caro', 'Thắng game MP', 100);
      } catch (e) {
        console.log('Không thể cộng điểm:', e);
      }
    } 
    else if ((gs.moveCount || 0) + 1 >= boardArr.length) {
      newGs.winner = 'draw';
      gameOver = true;
      gameActive = false;
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });

    if (winCells) {
      setTimeout(() => {
        showResult('🏆', '🎉 Bạn thắng!', '+100 điểm', 'Chơi hay quá!');
      }, 500);
    }

    isMyTurn = false;
    renderRoomInfo();

  } catch (err) {
    console.error('sendMove error:', err);
    window.showToast('❌ Không gửi được nước đi: ' + err.message, 'error');
    const gs = roomData.gameState || {};
    const boardStr = gs.board || '';
    board = [];
    for (let i = 0; i < boardStr.length; i++) {
      const ch = boardStr[i];
      if (ch === 'X') board.push(1);
      else if (ch === 'O') board.push(2);
      else board.push(0);
    }
    drawBoard();
  } finally {
    isProcessingMove = false;
  }
}

function getOpponentUid() {
  const members = roomData.members || [];
  return members.find(u => u !== myUid) || null;
}

// ============================================================
//  CHECK WIN
// ============================================================
function checkWin(r, c, player) {
  const directions = [
    [0, 1],   // Ngang
    [1, 0],   // Dọc
    [1, 1],   // Chéo chính
    [1, -1]   // Chéo phụ
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    let cells = [[r, c]];

    for (let dir = -1; dir <= 1; dir += 2) {
      for (let step = 1; step < WIN_COUNT; step++) {
        const nr = r + dr * step * dir;
        const nc = c + dc * step * dir;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr * BOARD_SIZE + nc] === player) {
          count++;
          if (dir === -1) cells.unshift([nr, nc]);
          else cells.push([nr, nc]);
        } else break;
      }
    }

    if (count >= WIN_COUNT) {
      if (BOARD_SIZE > 3) {
        const head = cells[0];
        const tail = cells[cells.length - 1];
        const headR = head[0] - dr, headC = head[1] - dc;
        const tailR = tail[0] + dr, tailC = tail[1] + dc;
        
        const headBlocked = headR < 0 || headR >= BOARD_SIZE || headC < 0 || headC >= BOARD_SIZE
          || board[headR * BOARD_SIZE + headC] !== 0;
        const tailBlocked = tailR < 0 || tailR >= BOARD_SIZE || tailC < 0 || tailC >= BOARD_SIZE
          || board[tailR * BOARD_SIZE + tailC] !== 0;
        
        if (headBlocked && tailBlocked) {
          continue;
        }
      }
      
      if (cells.length > WIN_COUNT) {
        for (let start = 0; start <= cells.length - WIN_COUNT; start++) {
          const seg = cells.slice(start, start + WIN_COUNT);
          if (seg.some(([sr, sc]) => sr === r && sc === c)) {
            return seg;
          }
        }
        return cells.slice(0, WIN_COUNT);
      }
      
      return cells;
    }
  }
  
  return null;
}

// ============================================================
//  RESULT
// ============================================================
function showResultFromState(gs) {
  const winner = gs.winner;
  if (winner === 'draw') {
    showResult('🤝', 'Hòa!', '', 'Cả hai đều chơi hay!');
    return;
  }
  const isMe = winner === myUid;
  const memberInfo = roomData.memberInfo || {};
  const winnerName = isMe ? 'Bạn' : (memberInfo[winner]?.name || 'Người chơi');

  if (isMe) {
    showResult('🏆', '🎉 Bạn thắng!', '+100 điểm', `Thắng ${winnerName}`);
  } else {
    showResult('😔', `${winnerName} thắng!`, '', 'Lần sau cố gắng nhé!');
  }
}

function showResult(emoji, title, pts, sub) {
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-pts').textContent = pts || '';
  document.getElementById('result-sub').textContent = sub || '';
  resultModal.classList.remove('hidden');
}

// ============================================================
//  RESET GAME
// ============================================================
window.closeResultAndContinue = function() {
  resultModal.classList.add('hidden');
  resetGameState();
};

async function resetGameState() {
  if (!roomId || !roomData) return;
  try {
    const members = roomData.members || [];
    const p1 = members[0] || null;
    const p2 = members[1] || null;
    const boardStr = '.'.repeat(BOARD_SIZE * BOARD_SIZE);
    
    board = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
    gameOver = false;
    gameActive = true;
    currentTurn = p1;
    isMyTurn = p1 === myUid;
    
    const symbols = {};
    members.forEach((uid, index) => {
      symbols[uid] = index === 0 ? 'X' : 'O';
    });
    mySymbol = symbols[myUid] || null;
    
    const newGs = {
      board: boardStr,
      currentTurn: p1,
      winner: null,
      winLine: null,
      lastMove: null,
      moveCount: 0,
      symbols: symbols,
      players: [p1, p2]
    };
    
    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });
    
    initCanvas();
    drawBoard();
    renderRoomInfo();
    
    window.showToast('🔄 Bàn mới!', 'success');
    
  } catch (err) {
    console.error('resetGameState error:', err);
    window.showToast('Không thể reset game', 'error');
  }
}

// ============================================================
//  READY / START
// ============================================================
window.toggleMpReady = async function() {
  if (!roomId || !roomData) return;
  const memberInfo = roomData.memberInfo || {};
  const me = memberInfo[myUid] || { name: myName, ready: false };
  me.ready = !me.ready;
  memberInfo[myUid] = me;
  await updateDoc(doc(db, 'rooms', roomId), { memberInfo });
};

window.startMpGame = async function() {
  if (!roomId || !roomData) return;
  if (roomData.hostUid !== myUid) {
    window.showToast('Chỉ chủ phòng mới bắt đầu được', 'warn');
    return;
  }
  const members = roomData.members || [];
  if (members.length < 2) { 
    window.showToast('Cần ít nhất 2 người', 'warn'); 
    return;
  }

  const p1 = members[0];
  const p2 = members[1];
  const boardStr = '.'.repeat(BOARD_SIZE * BOARD_SIZE);
  
  const symbols = {};
  symbols[p1] = 'X';
  symbols[p2] = 'O';

  const gameState = {
    board: boardStr,
    currentTurn: p1,
    symbols: symbols,
    players: [p1, p2],
    winner: null,
    winLine: null,
    lastMove: null,
    moveCount: 0
  };

  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    gameState,
    startedAt: serverTimestamp()
  });
  
  window.showToast('🚀 Trận đấu bắt đầu!', 'success');
};

// ============================================================
//  LEAVE ROOM
// ============================================================
window.leaveMpRoom = async function() {
  if (!roomId) {
    window.location.href = 'rooms.html';
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.hostUid === myUid && data.status === 'lobby') {
        await deleteDoc(doc(db, 'rooms', roomId));
      } else {
        const memberInfo = data.memberInfo || {};
        delete memberInfo[myUid];
        await updateDoc(doc(db, 'rooms', roomId), {
          members: data.members.filter(u => u !== myUid),
          memberInfo
        });
      }
    }
  } catch (err) {
    console.error('leave error:', err);
  }
  if (_unsubRoom) { _unsubRoom(); _unsubRoom = null; }
  window.location.href = 'rooms.html';
};

// ============================================================
//  RESIZE
// ============================================================
window.addEventListener('resize', () => {
  if (canvas) {
    const size = BOARD_SIZE * CELL_SIZE + 1;
    canvas.style.width = Math.min(size, window.innerWidth - 32) + 'px';
  }
});

// ============================================================
//  TOAST HELPER
// ============================================================
window.showToast = function(msg, type = 'info') {
  const c = { info: '#38bdf8', success: '#34d399', warn: '#fbbf24', error: '#f87171' };
  const t = document.createElement('div');
  t.style.cssText = `pointer-events:all;padding:11px 16px;border-radius:12px;background:rgba(4,20,40,0.97);border:1px solid ${c[type]||c.info};color:#e0f2fe;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

console.log('🎮 Caro Multiplayer loaded');