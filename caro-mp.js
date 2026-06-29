// caro-mp.js — Caro Multiplayer qua phòng (rooms.js)
import { db, auth } from './points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp,
  collection, query, where, orderBy, limit, getDocs, addDoc, deleteDoc
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
let currentTurn = null;      // uid của người đang đi
let mySymbol = null;         // 'X' hoặc 'O'
let gameActive = false;
let isMyTurn = false;
let gameOver = false;
let lastMove = null;
let moveCount = 0;
let isProcessingMove = false; // chống spam

let canvas, ctx;
let _unsubRoom = null;
let _unsubGame = null;

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

  // Lấy roomId từ URL
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

function renderRoomInfo() {
  if (!roomData) return;
  roomNameEl.textContent = roomData.name || 'Phòng Caro';
  roomCodeEl.textContent = '#' + (roomData.code || '------');

  // Hiển thị người chơi
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

  // Highlight turn
  p1El.classList.toggle('active', currentTurn === p1Uid && gameActive && !gameOver);
  p2El.classList.toggle('active', currentTurn === p2Uid && gameActive && !gameOver);

  // Nút Ready / Start
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

  // Waiting overlay
  if (roomData.status === 'lobby' && members.length < 2) {
    waitingOverlay.classList.remove('hidden');
    waitingOverlay.querySelector('.wait-text').textContent = '⏳ Đang chờ người chơi thứ 2...';
  } else if (roomData.status === 'lobby') {
    waitingOverlay.classList.add('hidden');
  } else {
    waitingOverlay.classList.add('hidden');
  }

  // Cập nhật status
  if (roomData.status === 'lobby') {
    statusEl.innerHTML = `🔄 Đang trong phòng chờ · ${members.length}/${roomData.maxPlayers || 2} người`;
    statusEl.style.color = '#94a3b8';
  } else if (roomData.status === 'playing') {
    if (gameActive && !gameOver) {
      const turnName = currentTurn === myUid ? 'bạn' : (memberInfo[currentTurn]?.name || 'đối thủ');
      statusEl.innerHTML = `⚔️ Lượt của ${turnName}`;
      statusEl.style.color = currentTurn === myUid ? '#38bdf8' : '#f87171';
    } else if (gameOver) {
      // đã có result modal
    } else {
      statusEl.innerHTML = '⏳ Đang tải trận đấu...';
      statusEl.style.color = '#94a3b8';
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
  if (!gs.board) {
    // Chưa có board → chờ host start
    return;
  }

  // Parse board từ chuỗi
  const boardStr = gs.board || '';
  board = [];
  let valid = false;
  for (let i = 0; i < boardStr.length; i++) {
    const ch = boardStr[i];
    if (ch === 'X') { board.push(1); valid = true; }
    else if (ch === 'O') { board.push(2); valid = true; }
    else board.push(0);
  }

  // Nếu board rỗng hoặc không hợp lệ, init lại
  if (!valid || board.length === 0) {
    const size = data.gameType === 'tictactoe' ? 3 : 15;
    board = Array(size * size).fill(0);
  }

  BOARD_SIZE = Math.sqrt(board.length);
  WIN_COUNT = data.gameType === 'tictactoe' ? 3 : 5;
  CELL_SIZE = BOARD_SIZE === 3 ? 100 : 36;

  currentTurn = gs.currentTurn || null;
  gameActive = true;
  gameOver = gs.winner !== null && gs.winner !== undefined && gs.winner !== 'draw';
  lastMove = gs.lastMove || null;
  moveCount = gs.moveCount || 0;

  isMyTurn = currentTurn === myUid && !gameOver && gameActive;

  // Render
  initCanvas();
  drawBoard();

  // Highlight win
  if (gs.winLine && gs.winLine.length > 0) {
    highlightWin(gs.winLine);
  }

  renderRoomInfo();

  // Xử lý game over
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

  // Grid
  ctx.strokeStyle = 'rgba(56,189,248,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const pos = i * CELL_SIZE;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(canvas.width, pos); ctx.stroke();
  }

  // Pieces
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
    ctx.fillStyle = 'rgba(52,211,153,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
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
  if (!gameActive || gameOver || !isMyTurn || isProcessingMove) return;
  if (!roomId || !roomData) return;

  const c = Math.floor(px / CELL_SIZE);
  const r = Math.floor(py / CELL_SIZE);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
  if (board[r * BOARD_SIZE + c] !== 0) return;

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
    
    // Tạo board mới từ state hiện tại
    const boardArr = board.slice();
    const val = mySymbol === 'X' ? 1 : 2;
    boardArr[r * BOARD_SIZE + c] = val;

    // Cập nhật board local trước khi kiểm tra
    board = boardArr.slice();

    // Kiểm tra thắng với board đã cập nhật
    const winCells = checkWinLocal(r, c, val);
    
    // Chuyển board thành chuỗi
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
      newGs.winner = myUid;
      newGs.winLine = winCells;
      gameOver = true;
      gameActive = false;
      // Cập nhật UI ngay
      drawBoard();
      highlightWin(winCells);
      // Cộng điểm
      import('./points.js').then(({ addPoints }) => {
        addPoints('Caro', 'Thắng game MP', 100);
      });
    } else if ((gs.moveCount || 0) + 1 >= boardArr.length) {
      newGs.winner = 'draw';
      gameOver = true;
      gameActive = false;
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });

    // Nếu thắng, show result
    if (winCells) {
      setTimeout(() => {
        showResult('🏆', '🎉 Bạn thắng!', '+100 điểm', 'Chơi hay quá!');
      }, 300);
    }

    isMyTurn = false;
    renderRoomInfo();

  } catch (err) {
    console.error('sendMove error', err);
    window.showToast('Không gửi được nước đi', 'error');
    // Rollback board
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
//  CHECK WIN (local copy)
// ============================================================
function checkWinLocal(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const cells = [[r, c]];
    // Đếm chiều thuận
    for (let k = 1; k < WIN_COUNT; k++) {
      const nr = r + dr*k, nc = c + dc*k;
      if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr*BOARD_SIZE+nc] === player)
        cells.push([nr, nc]);
      else break;
    }
    // Đếm chiều ngược
    for (let k = 1; k < WIN_COUNT; k++) {
      const nr = r - dr*k, nc = c - dc*k;
      if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr*BOARD_SIZE+nc] === player)
        cells.unshift([nr, nc]);
      else break;
    }
    
    if (cells.length < WIN_COUNT) continue;
    
    // Kiểm tra từng đoạn WIN_COUNT ô liên tiếp
    for (let start = 0; start <= cells.length - WIN_COUNT; start++) {
      const seg = cells.slice(start, start + WIN_COUNT);
      
      // Luật Caro: 5 ô liên tiếp, KHÔNG bị chặn 2 đầu
      if (BOARD_SIZE > 3) { // TicTacToe không cần kiểm tra chặn
        const head = seg[0];
        const tail = seg[seg.length - 1];
        const beforeR = head[0] - dr, beforeC = head[1] - dc;
        const afterR = tail[0] + dr, afterC = tail[1] + dc;
        
        const headBlocked = beforeR < 0 || beforeR >= BOARD_SIZE || beforeC < 0 || beforeC >= BOARD_SIZE
          || board[beforeR * BOARD_SIZE + beforeC] !== 0;
        const tailBlocked = afterR < 0 || afterR >= BOARD_SIZE || afterC < 0 || afterC >= BOARD_SIZE
          || board[afterR * BOARD_SIZE + afterC] !== 0;
        
        // Nếu bị chặn 2 đầu thì không thắng
        if (headBlocked && tailBlocked) continue;
      }
      
      return seg; // Thắng!
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
  const members = roomData.members || [];
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
    const size = BOARD_SIZE;
    const boardStr = '.'.repeat(size * size);
    
    // Reset board local
    board = Array(size * size).fill(0);
    gameOver = false;
    gameActive = true;
    currentTurn = p1;
    isMyTurn = p1 === myUid;
    
    const newGs = {
      board: boardStr,
      currentTurn: p1,
      winner: null,
      winLine: null,
      lastMove: null,
      moveCount: 0,
      symbols: { [p1]: 'X', [p2]: 'O' },
      players: [p1, p2]
    };
    
    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });
    
    // Cập nhật UI
    initCanvas();
    drawBoard();
    renderRoomInfo();
    
  } catch (err) {
    console.error('resetGameState error', err);
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
  const size = 15;
  const boardStr = '.'.repeat(size * size);

  const gameState = {
    board: boardStr,
    currentTurn: p1,
    symbols: { [p1]: 'X', [p2]: 'O' },
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
    console.error('leave error', err);
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

// ============================================================
//  KEYBOARD SHORTCUTS (debug)
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' && e.ctrlKey) {
    e.preventDefault();
    if (roomData?.hostUid === myUid) {
      resetGameState();
    }
  }
});

console.log('🎮 Caro Multiplayer loaded');
console.log(`📱 Room: ${roomId || 'chưa có'}`);