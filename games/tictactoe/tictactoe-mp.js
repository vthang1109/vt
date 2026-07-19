// tictactoe-mp.js — TicTacToe Multiplayer qua phòng (rooms.js)
import { db, auth } from '../../points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================================================
//  STATE
// ============================================================
let roomId = null;
let roomData = null;
let myUid = null;
let myName = 'Bạn';
let myPoints = 0;

const BOARD_SIZE = 3;
const WIN_COUNT = 3;
const CELL_SIZE = 100;

let board = [];
let currentTurn = null;
let mySymbol = null;
let gameActive = false;
let isMyTurn = false;
let gameOver = false;
let moveCount = 0;
let isProcessingMove = false;

// ===== TIỀN CƯỢC =====
let currentBet = 100;

let canvas, ctx;
let _unsubRoom = null;
let _canvasReady = false; // guard initCanvas

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

canvas = $('ttt-canvas');
ctx = canvas.getContext('2d');

// ============================================================
//  AUTH & INIT
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  myUid = user.uid;
  const snap = await getDoc(doc(db, 'users', user.uid));
  myName = snap.exists() ? (snap.data().nickname || user.email.split('@')[0]) : user.email.split('@')[0];
  myPoints = snap.exists() ? (snap.data().points || 0) : 0;

  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  if (!roomId) {
    statusEl.innerHTML = '⚠️ Không tìm thấy phòng. Quay lại danh sách.';
    return;
  }
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.quitGame());
  initRoom();
  updateNavPoints();
});

window.addEventListener('pagehide', () => window.quitGame?.());

// ============================================================
//  UPDATE NAV POINTS
// ============================================================
function updateNavPoints() {
  const apply = () => {
    const ptsStr = myPoints.toLocaleString('vi-VN');
    document.querySelectorAll('[data-points]').forEach(el => {
      el.textContent = ptsStr;
    });

    if (window.TopNav && typeof window.TopNav.setPoints === 'function') {
      window.TopNav.setPoints(myPoints);
    } else {
      const vtPts = document.getElementById('vtNavPts');
      if (vtPts) {
        vtPts.textContent = '⭐ ' + ptsStr;
        vtPts.classList.add('visible');
      }
    }

    ['user-points-home', 'status-pts', 'pro-points', 'wd-pts', 'shPts'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = ptsStr;
    });
  };

  apply();

  if (!document.body._ptsObserver) {
    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: false });
    document.body._ptsObserver = observer;
  }
}

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
  roomNameEl.textContent = roomData.name || 'Phòng TicTacToe';
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

  updateStatusBar();
}

// ============================================================
//  UPDATE STATUS BAR
// ============================================================
function updateStatusBar() {
  const members = roomData?.members || [];
  const memberInfo = roomData?.memberInfo || {};
  
  if (roomData?.status === 'lobby') {
    statusEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <span>🔄 Đang trong phòng chờ · ${members.length}/${roomData.maxPlayers || 2} người</span>
        <span style="color:#fbbf24;font-weight:700;">🪙 ${currentBet.toLocaleString('vi-VN')}</span>
      </div>
    `;
    statusEl.style.color = '#94a3b8';
  } else if (roomData?.status === 'playing') {
    if (gameActive && !gameOver) {
      const turnName = currentTurn === myUid ? 'bạn' : (memberInfo[currentTurn]?.name || 'đối thủ');
      const symbolText = mySymbol ? ` (${mySymbol})` : '';
      const turnColor = currentTurn === myUid ? '#38bdf8' : '#f87171';
      
      statusEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span style="color:${turnColor};font-weight:800;">⚔️ Lượt của ${turnName}${symbolText}</span>
          <span style="color:#fbbf24;font-weight:700;">🪙 ${currentBet.toLocaleString('vi-VN')}</span>
        </div>
      `;
      statusEl.style.color = turnColor;
    } else if (gameOver) {
      // Không cần cập nhật
    } else {
      statusEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span>⏳ Đang tải trận đấu...</span>
          <span style="color:#fbbf24;font-weight:700;">🪙 ${currentBet.toLocaleString('vi-VN')}</span>
        </div>
      `;
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
    _canvasReady = false;
    return;
  }

  const gs = data.gameState || {};
  if (!gs.board) return;

  if (gs.bet) {
    currentBet = gs.bet;
  }

  // Parse board (3x3)
  const boardStr = gs.board || '';
  board = [];
  for (let i = 0; i < boardStr.length; i++) {
    const ch = boardStr[i];
    if (ch === 'X') board.push(1);
    else if (ch === 'O') board.push(2);
    else board.push(0);
  }

  if (board.length === 0) {
    board = Array(9).fill(0);
  }

  currentTurn = gs.currentTurn || null;
  // FIX: gameOver cover cả draw
  gameOver = gs.winner !== null && gs.winner !== undefined;
  gameActive = !gameOver;

  const symbols = gs.symbols || {};
  mySymbol = symbols[myUid] || null;
  
  if (!mySymbol && gs.players && gs.players.length >= 2) {
    const p1 = gs.players[0];
    const p2 = gs.players[1];
    if (myUid === p1) mySymbol = 'X';
    else if (myUid === p2) mySymbol = 'O';
  }

  let winLine = null;
  if (gs.winLineStr) {
    try {
      winLine = JSON.parse(gs.winLineStr);
    } catch(e) {
      winLine = null;
    }
  }

  isMyTurn = currentTurn === myUid && !gameOver;

  // FIX: chỉ init canvas một lần, không reset mỗi snapshot
  if (!_canvasReady) {
    initCanvas();
    _canvasReady = true;
  }
  drawBoard();

  if (winLine && winLine.length > 0) {
    highlightWin(winLine);
  }

  renderRoomInfo();

  if (gs.winner) {
    if (gs.winner !== 'draw') {
      showResultFromState(gs);
    } else {
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
  ctx.strokeStyle = 'rgba(56,189,248,0.25)';
  ctx.lineWidth = 2;
  for (let i = 1; i < BOARD_SIZE; i++) {
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
      drawTicSymbol(cx, cy, val);
    }
  }
}

function drawTicSymbol(cx, cy, val) {
  const s = CELL_SIZE * 0.3;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  if (val === 1) {
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(cx-s, cy-s); ctx.lineTo(cx+s, cy+s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+s, cy-s); ctx.lineTo(cx-s, cy+s); ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = '#f87171';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
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
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
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
    if (!isMyTurn && gameActive && !gameOver) {
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

    // FIX: vẽ ngay local trước khi await, tránh flash trống
    drawBoard();

    const winCells = checkWin(r, c, val);
    
    let boardStr = '';
    for (let i = 0; i < boardArr.length; i++) {
      const v = boardArr[i];
      if (v === 1) boardStr += 'X';
      else if (v === 2) boardStr += 'O';
      else boardStr += '.';
    }

    const newGs = {
      board: boardStr,
      currentTurn: getOpponentUid(),
      lastMove: [r, c],
      moveCount: (gs.moveCount || 0) + 1,
      bet: currentBet
    };

    if (gs.symbols) newGs.symbols = gs.symbols;
    if (gs.players) newGs.players = gs.players;

    if (winCells) {
      console.log('🎉 THẮNG! Win cells:', winCells);
      newGs.winner = myUid;
      newGs.winLineStr = JSON.stringify(winCells);
      gameOver = true;
      gameActive = false;

      // FIX: highlight ngay sau drawBoard local (không drawBoard lại)
      highlightWin(winCells);
      
      try {
        const { addPoints } = await import('../../points.js');
        const winAmount = currentBet * 2;
        await addPoints('TicTacToe', `Thắng game MP (cược ${currentBet.toLocaleString('vi-VN')})`, winAmount);
        myPoints += winAmount;
        updateNavPoints();
      } catch (e) {
        console.log('Không thể cộng điểm:', e);
      }
    } 
    else if ((gs.moveCount || 0) + 1 >= boardArr.length) {
      newGs.winner = 'draw';
      gameOver = true;
      gameActive = false;
      try {
        const { addPoints } = await import('../../points.js');
        await addPoints('TicTacToe', `Hoàn cược (hòa)`, currentBet);
        myPoints += currentBet;
        updateNavPoints();
      } catch (e) {
        console.log('Không thể hoàn tiền:', e);
      }
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });

    if (winCells) {
      setTimeout(() => {
        showResult('🏆', '🎉 Bạn thắng!', `+${(currentBet * 2).toLocaleString('vi-VN')} điểm`, `Thắng cược ${currentBet.toLocaleString('vi-VN')}`);
      }, 500);
    } else if (newGs.winner === 'draw') {
      setTimeout(() => {
        showResult('🤝', 'Hòa!', `+${currentBet.toLocaleString('vi-VN')} (hoàn cược)`, 'Không ai thắng');
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
//  CHECK WIN (TicTacToe - 3x3)
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
    showResult('🤝', 'Hòa!', `+${currentBet.toLocaleString('vi-VN')} (hoàn cược)`, 'Không ai thắng');
    return;
  }
  const isMe = winner === myUid;
  const memberInfo = roomData.memberInfo || {};
  const winnerName = isMe ? 'Bạn' : (memberInfo[winner]?.name || 'Người chơi');

  if (isMe) {
    showResult('🏆', '🎉 Bạn thắng!', `+${(currentBet * 2).toLocaleString('vi-VN')} điểm`, `Thắng cược ${currentBet.toLocaleString('vi-VN')}`);
  } else {
    showResult('😔', `${winnerName} thắng!`, `-${currentBet.toLocaleString('vi-VN')} điểm`, 'Lần sau cố gắng nhé!');
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
    const boardStr = '.'.repeat(9);
    
    board = Array(9).fill(0);
    gameOver = false;
    gameActive = true;
    isProcessingMove = false; // FIX: reset flag khi bắt đầu ván mới
    _canvasReady = false;     // FIX: cho phép initCanvas lại cho ván mới
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
      winLineStr: null,
      lastMove: null,
      moveCount: 0,
      symbols: symbols,
      players: members,
      bet: currentBet
    };
    
    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });
    
    initCanvas();
    _canvasReady = true;
    drawBoard();
    renderRoomInfo();
    
    window.showToast(`🔄 Bàn mới! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');
    
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

  if (myPoints < currentBet) {
    window.showToast(`❌ Bạn không đủ tiền! Cần ${currentBet.toLocaleString('vi-VN')}, bạn có ${myPoints.toLocaleString('vi-VN')}`, 'error');
    return;
  }

  try {
    const { addPoints } = await import('../../points.js');
    await addPoints('TicTacToe', `Đặt cược ${currentBet.toLocaleString('vi-VN')}`, -currentBet);
    myPoints -= currentBet;
    updateNavPoints();
  } catch (e) {
    window.showToast('❌ Không thể trừ tiền cược!', 'error');
    return;
  }

  const p1 = members[0];
  const p2 = members[1];
  const boardStr = '.'.repeat(9);
  
  const symbols = {};
  symbols[p1] = 'X';
  symbols[p2] = 'O';

  const gameState = {
    board: boardStr,
    currentTurn: p1,
    symbols: symbols,
    players: members,
    winner: null,
    winLineStr: null,
    lastMove: null,
    moveCount: 0,
    bet: currentBet
  };

  _canvasReady = false; // reset canvas guard cho game mới
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    gameState,
    startedAt: serverTimestamp()
  });
  
  window.showToast(`🚀 Trận đấu bắt đầu! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');
};

// ============================================================
//  LEAVE ROOM
// ============================================================
window.quitGame = async function() {
  if (!roomId) {
    window.location.href = '../../app/rooms.html';
    return;
  }
  try {
    const data = roomData;
    if (data) {
      // Forfeit if mid-game and no winner yet
      let forfeited = false;
      const gs = data.gameState || {};
      if (data.status === 'playing' && !gs.winner) {
        const oppUid = getOpponentUid();
        if (oppUid) {
          try {
            const { addPoints } = await import('../../points.js');
            await addPoints('TicTacToe', `Bỏ ván (rời phòng)`, -currentBet);
          } catch (e) {}
          await updateDoc(doc(db, 'rooms', roomId), { 'gameState.winner': oppUid });
          forfeited = true;
        }
      }

      if (data.hostUid === myUid && !forfeited) {
        await deleteDoc(doc(db, 'rooms', roomId));
      } else {
        const remaining = (data.members || []).filter(u => u !== myUid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'rooms', roomId));
        } else {
          const mi = data.memberInfo || {};
          delete mi[myUid];
          const wInfo = { ...(data.waitingMemberInfo || {}) };
          delete wInfo[myUid];
          await updateDoc(doc(db, 'rooms', roomId), {
            members: arrayRemove(myUid),
            memberInfo: mi,
            waitingMembers: arrayRemove(myUid),
            waitingMemberInfo: wInfo
          });
        }
      }
    }
  } catch (err) {
    console.error('leave error:', err);
  }
  if (_unsubRoom) { _unsubRoom(); _unsubRoom = null; }
  window.location.href = '../../app/rooms.html';
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
  t.style.cssText = `pointer-events:all;padding:11px 16px;border-radius:12px;background:rgba(4,20,40,0.97);border:1px solid ${c[type]||c.info};color:#e0f2fe;font-size:13px;font-weight:400;font-family:'Science Gothic', sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

console.log('🎮 TicTacToe Multiplayer loaded');
console.log(`🪙 Mức cược mặc định: ${currentBet.toLocaleString('vi-VN')}`);
