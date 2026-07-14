
// caro-mp.js — Caro Multiplayer qua phòng (rooms.js)
import { db, auth } from '../../points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initRoomChat, getMyNickname } from '../../room-chat.js';

// ============================================================
//  STATE
// ============================================================
let roomId = null;
let roomData = null;
let myUid = null;
let myName = 'Bạn';
let myPoints = 0;

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
let scores = { p1: 0, p2: 0 };
let scoredThisRound = false;

// ===== TIỀN CƯỢC =====
let BET_AMOUNT = 100;
let currentBet = 100;

let canvas, ctx;
let _unsubRoom = null;
let _autoStarting = false;
let _lastDeclineHandled = null;

// ============================================================
//  DOM REFS
// ============================================================
const $ = id => document.getElementById(id);
const statusBarEl = $('caro-status-bar');
const statusMidEl = $('caro-status');
const profitEl = $('caro-profit');
const p1El = $('player1-tag');
const p2El = $('player2-tag');
const p1Name = $('player1-name');
const p2Name = $('player2-name');
const p1Score = $('score-p1');
const p2Score = $('score-p2');
const resultModal = $('result-modal');
const waitingOverlay = $('mp-waiting-overlay');
const betZoneEl = $('caro-bet-zone');

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
  myPoints = snap.exists() ? (snap.data().points || 0) : 0;

  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  if (!roomId) {
    statusMidEl.textContent = '⚠️ Không tìm thấy phòng. Quay lại danh sách.';
    return;
  }
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.leaveMpRoom());
  initRoom();

  const chatName = await getMyNickname(db, myUid, user.email);
  initRoomChat({
    db,
    roomId,
    uid: myUid,
    getName: () => chatName
  });

  // Cập nhật điểm lên nav
  updateNavPoints();
});

// ============================================================
//  UPDATE ROOM ID TRÊN TOP NAV
// ============================================================
function updateNavRoom(roomCode) {
  if (window.TopNav && window.TopNav.setRoomId) window.TopNav.setRoomId(roomCode, '♟️');
}

// ============================================================
//  UPDATE NAV POINTS
// ============================================================
function updateNavPoints() {
  const apply = () => {
    const ptsStr = myPoints.toLocaleString('vi-VN');
    document.querySelectorAll('[data-points]').forEach(el => {
      el.textContent = ptsStr;
    });

    // top-nav.js dùng id "vtNavPts" qua API TopNav.setPoints()
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

  // top-nav.js inject bằng root.outerHTML (thay thế hẳn #top-nav-root) lúc DOMContentLoaded,
  // có thể chạy SAU lần apply() đầu -> theo dõi document.body để bắt lúc nav vừa được chèn.
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
      statusMidEl.textContent = '❌ Phòng đã bị xoá hoặc không tồn tại.';
      return;
    }
    roomData = snap.data();
    renderRoomInfo();
    handleGameState(roomData);
  }, (err) => {
    console.error('room snapshot error', err);
    statusMidEl.textContent = '⚠️ Lỗi kết nối phòng.';
  });
}

// ============================================================
//  RENDER UI
// ============================================================
function renderRoomInfo() {
  if (!roomData) return;
  updateNavRoom(roomData.code || '------');

  const members = roomData.members || [];
  const memberInfo = roomData.memberInfo || {};
  const isHost = roomData.hostUid === myUid;
  // Tự quản lý pha chơi qua gameState.phase, KHÔNG phụ thuộc roomData.status
  // (nếu file tạo phòng set sẵn status:'playing' thì vẫn luôn ép qua bước chọn cược trước)
  const gsPhase = (roomData.gameState && roomData.gameState.phase) || 'betting';
  const inLobby = gsPhase !== 'playing';

  const p1Uid = members[0] || null;
  const p2Uid = members[1] || null;

  const info1 = memberInfo[p1Uid] || { name: 'Người chơi' };
  const info2 = memberInfo[p2Uid] || { name: 'Người chơi' };
  p1Name.textContent = p1Uid ? (p1Uid === myUid ? 'Bạn' : info1.name) : 'Đang chờ...';
  p2Name.textContent = p2Uid ? (p2Uid === myUid ? 'Bạn' : info2.name) : 'Đang chờ...';

  p1Score.textContent = scores.p1;
  p2Score.textContent = scores.p2;

  p1El.classList.toggle('active', currentTurn === p1Uid && gameActive && !gameOver);
  p2El.classList.toggle('active', currentTurn === p2Uid && gameActive && !gameOver);

  // ===== BET: chủ phòng chọn mức, đối thủ xác nhận (giống chess-mp) =====
  const gs = roomData.gameState || {};
  if (inLobby) {
    currentBet = gs.betAmount || currentBet;
    if (members.length >= 2) {
      renderBetZone(gs, isHost, p1Uid === myUid ? p2Uid : p1Uid);
    } else {
      betZoneEl.innerHTML = '';
    }
  } else {
    betZoneEl.innerHTML = '';
  }

  // Overlay chờ người chơi 2 che toàn màn hình
  if (inLobby && members.length < 2) {
    waitingOverlay.classList.remove('hidden');
    waitingOverlay.querySelector('.wait-text').textContent = '⏳ Đang chờ người chơi thứ 2...';
  } else {
    waitingOverlay.classList.add('hidden');
  }

  updateStatusBar();

  const ingameActionsEl = document.getElementById('caro-ingame-actions');
  if (ingameActionsEl) {
    ingameActionsEl.classList.toggle('hidden', !(gameActive && !gameOver));
  }
}

// ============================================================
//  UPDATE STATUS BAR (y hệt caro.js: giữa = lượt/kết quả, phải = điểm cược)
// ============================================================
function updateStatusBar() {
  if (gameOver) return; // Kết quả được đặt bởi updateStatusResult()
  statusMidEl.textContent = '';
}

// ============================================================
//  KẾT QUẢ VÁN — y hệt caro.js updateStatusResult(): WIN/LOSE/DRAW
//  nằm giữa, điểm +/- nằm bên .stat-profit (class gốc dùng chung) cạnh player2-tag
// ============================================================
function updateStatusResult(kind, profitText) {
  statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
  if (kind === 'win') statusBarEl.classList.add('result-win');
  else if (kind === 'lose') statusBarEl.classList.add('result-lose');
  else statusBarEl.classList.add('result-draw');
  if (p2El) p2El.style.display = 'none';
  statusMidEl.textContent = kind === 'win' ? 'WIN' : kind === 'lose' ? 'LOSE' : 'DRAW';
  profitEl.textContent = profitText || '';
  profitEl.className = 'stat-profit ' + (kind === 'win' ? 'positive' : kind === 'lose' ? 'negative' : 'zero');
}

// ============================================================
//  HANDLE GAME STATE
// ============================================================
function handleGameState(data) {
  const gs = data.gameState || {};
  if (gs.phase !== 'playing') {
    gameActive = false;
    gameOver = false;
    return;
  }

  if (!gs.board) return;

  // Lấy tiền cược từ gameState
  if (gs.bet) {
    currentBet = gs.bet;
  }

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

  // Ván mới đã bắt đầu (do 1 trong 2 bên bấm "Ván mới") — dọn sạch UI kết quả cũ ở CẢ 2 client,
  // không chỉ phía người vừa bấm (resetGameState() chỉ tự dọn cho chính client gọi nó).
  // Thiếu bước này thì: bên còn lại vẫn thấy result-modal cũ (nút "Đầu hàng" cũ chồng lên nút
  // đầu hàng thật của ván mới) + màu result-win/lose cũ còn dính trên bc-status, và scoredThisRound
  // bị kẹt true mãi -> ván sau bên đó không bao giờ được cộng/trừ điểm.
  if (!gameOver && gs.winner !== 'draw') {
    scoredThisRound = false;
    resultModal.classList.add('hidden');
    statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
    if (p2El) p2El.style.display = '';
    profitEl.textContent = '';
    profitEl.className = 'stat-profit zero';
  }
  
  const symbols = gs.symbols || {};
  mySymbol = symbols[myUid] || null;
  
  if (!mySymbol && gs.players && gs.players.length >= 2) {
    const p1 = gs.players[0];
    const p2 = gs.players[1];
    if (myUid === p1) mySymbol = 'X';
    else if (myUid === p2) mySymbol = 'O';
  }

  // Khôi phục winLine từ string
  let winLine = null;
  if (gs.winLineStr) {
    try {
      winLine = JSON.parse(gs.winLineStr);
    } catch(e) {
      winLine = null;
    }
  }

  isMyTurn = currentTurn === myUid && !gameOver && gameActive;

  initCanvas();
  drawBoard();

  if (winLine && winLine.length > 0) {
    highlightWin(winLine);
  }

  renderRoomInfo();

  if ((gameOver || gs.winner === 'draw') && !scoredThisRound) {
    const members = data.members || [];
    if (gs.winner && gs.winner !== 'draw') {
      if (gs.winner === members[0]) scores.p1++;
      else if (gs.winner === members[1]) scores.p2++;
    }
    scoredThisRound = true;
    renderRoomInfo();
    settlePoints(gs); // gộp trừ/cộng điểm 1 LẦN DUY NHẤT tại đây (không trừ lúc chọn cược)
  }

  if (gameOver || gs.winner === 'draw') {
    if (gs.winner && gs.winner !== 'draw') {
      const isMe = gs.winner === myUid;
      const profitText = isMe ? `+${currentBet.toLocaleString('vi-VN')}` : `-${currentBet.toLocaleString('vi-VN')}`;
      updateStatusResult(isMe ? 'win' : 'lose', profitText);
      showResultFromState();
    } else if (gs.winner === 'draw') {
      updateStatusResult('draw', '');
      showResult();
    }
  }
}

// ============================================================
//  SETTLE ĐIỂM CƯỢC — trừ/cộng gộp 1 LẦN DUY NHẤT khi có kết quả.
//  Cược lúc chọn/xác nhận chỉ ghi nhận số, KHÔNG đụng vào điểm thật.
//  (đây cũng là điểm duy nhất gọi addPoints() cho ván thắng -> buff pet áp dụng ở đây)
// ============================================================
async function settlePoints(gs) {
  if (!gs.winner || gs.winner === 'draw') return; // hòa: chưa ai bị trừ nên khỏi cần settle
  try {
    const { addPoints } = await import('../../points.js');
    const isMe = gs.winner === myUid;
    const rawDelta = isMe ? currentBet : -currentBet;
    const reason = isMe
      ? `Thắng ván Caro MP (mức ${currentBet.toLocaleString('vi-VN')})`
      : `Thua ván Caro MP (mức ${currentBet.toLocaleString('vi-VN')})`;
    // addPoints() tự áp buff pet cho số dương (nếu reason không phải hoàn/cược) và
    // TRẢ VỀ số đã áp buff — phải dùng giá trị này, không dùng rawDelta, nếu không
    // buff vẫn cộng đúng vào điểm thật nhưng UI sẽ hiện sai (như buff "không hoạt động").
    const applied = await addPoints('Caro', reason, rawDelta);
    const finalDelta = (typeof applied === 'number') ? applied : rawDelta;
    myPoints += finalDelta;
    updateNavPoints();
    if (isMe) {
      profitEl.textContent = `+${finalDelta.toLocaleString('vi-VN')}`;
    }
  } catch (e) {
    console.log('Lỗi settle điểm:', e);
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
      phase: 'playing',
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

      drawBoard();
      highlightWin(winCells);
      // Điểm được trừ/cộng gộp 1 LẦN DUY NHẤT trong settlePoints() (gọi từ handleGameState)
      // — không xử lý ở đây để tránh cộng/trừ trùng khi onSnapshot bắn lại cho chính mình.
    }
    else if ((gs.moveCount || 0) + 1 >= boardArr.length) {
      newGs.winner = 'draw';
      gameOver = true;
      gameActive = false;
      // Hòa: không ai từng bị trừ điểm nên không cần hoàn — khỏi cần settle.
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      gameState: newGs
    });

    if (winCells) {
      setTimeout(() => { showResult(); }, 500);
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
function showResultFromState() {
  showResult();
}

function showResult() {
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
    scoredThisRound = false;
    statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
    if (p2El) p2El.style.display = '';
    profitEl.textContent = '';
    profitEl.className = 'stat-profit zero';
    currentTurn = p1;
    isMyTurn = p1 === myUid;
    
    const symbols = {};
    members.forEach((uid, index) => {
      symbols[uid] = index === 0 ? 'X' : 'O';
    });
    mySymbol = symbols[myUid] || null;
    
    const newGs = {
      phase: 'playing',
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
    drawBoard();
    renderRoomInfo();
    
    window.showToast(`🔄 Bàn mới! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');
    
  } catch (err) {
    console.error('resetGameState error:', err);
    window.showToast('Không thể reset game', 'error');
  }
}

// ============================================================
//  VÙNG ĐẶT CƯỢC (chủ phòng chọn mức, đối thủ xác nhận — y hệt chess-mp)
// ============================================================
function renderBetZone(gs, isHost, oppUid) {
  const betAmount = gs.betAmount || null;
  const meConfirmed = !!(gs.bets && gs.bets[myUid]);

  if (isHost) {
    if (!betAmount) {
      betZoneEl.innerHTML = `
        <div class="caro-bet-picker">
          <div class="caro-bet-picker-label">Chọn mức cược cho ván này</div>
          <div class="caro-bet-picker-row">
            <input id="caro-bet-input" type="number" min="50" step="50" value="100"/>
          </div>
          <div class="caro-bet-quick">
            <button type="button" onclick="caroQuickBet(100)">100</button>
            <button type="button" onclick="caroQuickBet(200)">200</button>
            <button type="button" onclick="caroQuickBet(500)">500</button>
            <button type="button" onclick="caroQuickBet(1000)">1000</button>
          </div>
          <button class="caro-bet-confirm-btn" onclick="hostSetBet()">✅ Đặt mức cược</button>
        </div>`;
    } else {
      betZoneEl.innerHTML = `<div class="caro-bet-waiting">⏳ Đã đặt mức cược <b>${betAmount.toLocaleString('vi-VN')}đ</b> — đang chờ đối thủ xác nhận...</div>`;
    }
  } else {
    if (!betAmount) {
      betZoneEl.innerHTML = `<div class="caro-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>`;
    } else if (!meConfirmed) {
      betZoneEl.innerHTML = `
        <div class="caro-bet-confirm-card">
          <div class="caro-bet-confirm-title">Chủ phòng muốn đặt cược</div>
          <div class="caro-bet-confirm-amt">${betAmount.toLocaleString('vi-VN')}đ</div>
          <div class="caro-bet-confirm-actions">
            <button class="decline" onclick="declineBet()">Từ chối</button>
            <button class="accept" onclick="acceptBet()">Đồng ý</button>
          </div>
        </div>`;
    } else {
      betZoneEl.innerHTML = `<div class="caro-bet-waiting">✅ Đã xác nhận cược ${betAmount.toLocaleString('vi-VN')}đ — đang bắt đầu ván đấu...</div>`;
    }
  }

  // Đối thủ vừa từ chối cược: chủ phòng hoàn tiền và reset để chọn lại (chỉ xử lý 1 lần)
  if (isHost && gs.betDeclinedBy && _lastDeclineHandled !== gs.betDeclinedBy) {
    _lastDeclineHandled = gs.betDeclinedBy;
    refundDeclinedBet(gs);
  }

  // Cả 2 đã cược xong -> chủ phòng tự động bắt đầu trận
  const members = roomData.members || [];
  const p1 = members[0], p2 = members[1];
  const allBet = betAmount && p1 && p2 && (gs.bets?.[p1] || 0) > 0 && (gs.bets?.[p2] || 0) > 0;
  if (isHost && allBet && !_autoStarting) {
    _autoStarting = true;
    setTimeout(() => { hostStartMatch(); }, 400);
  }
}

window.caroQuickBet = function(amt) {
  const el = document.getElementById('caro-bet-input');
  if (el) el.value = amt;
};

window.hostSetBet = async function() {
  const el = document.getElementById('caro-bet-input');
  const amt = parseInt(el?.value);
  if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > myPoints) { window.showToast('Không đủ điểm', 'error'); return; }
  try {
    // Chỉ ghi nhận mức cược đã chọn, KHÔNG trừ điểm ngay — trừ/cộng gộp 1 lần lúc có kết quả
    await updateDoc(doc(db, 'rooms', roomId), {
      'gameState.phase': 'betting',
      'gameState.betAmount': amt,
      [`gameState.bets.${myUid}`]: amt
    });
    window.showToast('✅ Đã chọn mức cược ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) {
    console.error(e);
    window.showToast('Lỗi khi đặt cược', 'error');
  }
};

window.acceptBet = async function() {
  const gs = roomData?.gameState || {};
  const amt = gs.betAmount;
  if (!amt || gs.bets?.[myUid]) return;
  if (amt > myPoints) { window.showToast('Không đủ điểm để đồng ý mức cược này', 'error'); return; }
  try {
    // Chỉ ghi nhận xác nhận, KHÔNG trừ điểm ngay — trừ/cộng gộp 1 lần lúc có kết quả
    await updateDoc(doc(db, 'rooms', roomId), { [`gameState.bets.${myUid}`]: amt });
    window.showToast('✅ Đã xác nhận cược', 'success');
  } catch (e) {
    console.error(e);
    window.showToast('Lỗi', 'error');
  }
};

window.declineBet = async function() {
  try {
    await updateDoc(doc(db, 'rooms', roomId), { 'gameState.betDeclinedBy': myUid });
  } catch (e) { console.error(e); }
};

// Chỉ chủ phòng gọi: reset mức cược để chọn lại (không cần hoàn tiền vì chưa từng bị trừ)
async function refundDeclinedBet(gs) {
  try {
    window.showToast('↩️ Đối thủ từ chối mức cược, hãy chọn mức khác', 'info');
    await updateDoc(doc(db, 'rooms', roomId), {
      'gameState.betAmount': null,
      'gameState.bets': {},
      'gameState.betDeclinedBy': null
    });
  } catch (e) { console.error(e); }
}

async function hostStartMatch() {
  try {
    // Dùng thẳng roomData từ listener (đã fresh, vừa trigger renderBetZone) — khỏi getDoc thêm
    if (!roomData || roomData.hostUid !== myUid) { _autoStarting = false; return; }
    const gs = roomData.gameState || {};
    const members = roomData.members || [];
    if (members.length < 2) { _autoStarting = false; return; }
    const p1 = members[0], p2 = members[1];
    if (!((gs.bets?.[p1] || 0) > 0 && (gs.bets?.[p2] || 0) > 0)) { _autoStarting = false; return; }

    currentBet = gs.betAmount;
    const boardStr = '.'.repeat(BOARD_SIZE * BOARD_SIZE);
    scores = { p1: 0, p2: 0 };
    scoredThisRound = false;
    statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
    if (p2El) p2El.style.display = '';
    profitEl.textContent = '';
    profitEl.className = 'stat-profit zero';

    const symbols = {};
    symbols[p1] = 'X';
    symbols[p2] = 'O';

    const gameState = {
      phase: 'playing',
      board: boardStr,
      currentTurn: p1,
      symbols: symbols,
      players: members,
      winner: null,
      winLineStr: null,
      lastMove: null,
      moveCount: 0,
      bet: currentBet,
      bets: gs.bets
    };

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'playing',
      gameState,
      startedAt: serverTimestamp()
    });

    window.showToast(`🚀 Trận đấu bắt đầu! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');
  } finally {
    _autoStarting = false;
  }
}

// ============================================================
//  LEAVE ROOM
// ============================================================
window.leaveMpRoom = async function() {
  if (!roomId) {
    window.location.href = 'rooms.html';
    return;
  }
  try {
    // Dùng thẳng roomData từ listener đang có sẵn — khỏi getDoc lại (đủ mới vì listener realtime)
    const data = roomData;
    if (data) {
      const gs = data.gameState || {};
      const gsPhase = gs.phase || 'betting';
      // Không cần hoàn cược khi rời phòng lúc đang chọn cược — vì chưa từng bị trừ điểm.

      // Thoát ngang giữa ván đang chơi (chưa có kết quả) → xử thua, đối thủ được xử thắng
      if (gsPhase === 'playing' && !gs.winner) {
        const members = data.members || [];
        const oppUid = members.find(u => u !== myUid);
        if (oppUid) {
          try {
            const { addPoints } = await import('../../points.js');
            await addPoints('Caro', `Bỏ ván Caro MP (mức ${currentBet.toLocaleString('vi-VN')})`, -currentBet, false);
          } catch (e) { console.error('forfeit deduct error:', e); }
          await updateDoc(doc(db, 'rooms', roomId), { 'gameState.winner': oppUid });
        }
      }

      if (data.hostUid === myUid && gsPhase !== 'playing') {
        await deleteDoc(doc(db, 'rooms', roomId));
      } else {
        const memberInfo = data.memberInfo || {};
        delete memberInfo[myUid];
        await updateDoc(doc(db, 'rooms', roomId), {
          members: (data.members || []).filter(u => u !== myUid),
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
window.showToast = function() {
  // Đã bỏ thông báo nổi — giữ hàm rỗng để code cũ gọi window.showToast(...) không lỗi
};

// ============================================================
//  ĐẦU HÀNG (modal xác nhận — mẫu xiangqi-mp)
// ============================================================
function showResignConfirm() {
  let modal = document.getElementById('caro-resign-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'caro-resign-modal';
    modal.className = 'caro-modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="caro-modal-box">
      <div class="caro-modal-title">Bạn chắc chắn muốn đầu hàng ván này?</div>
      <div class="caro-modal-actions">
        <button class="caro-modal-btn decline" onclick="hideResignConfirm()">Hủy</button>
        <button class="caro-modal-btn danger" onclick="confirmResign()">🏳️ Đầu hàng</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}
window.hideResignConfirm = function() {
  const modal = document.getElementById('caro-resign-modal');
  if (modal) modal.style.display = 'none';
};
window.confirmResign = async function() {
  window.hideResignConfirm();
  try {
    await _executeResign();
  } catch (e) {
    console.error(e);
    window.showToast('Lỗi khi đầu hàng, thử lại', 'error');
  }
};
window.surrenderMatch = function() {
  showResignConfirm();
};
async function _executeResign() {
  if (!roomData) return;
  const gs = roomData.gameState || {};
  if (gs.phase !== 'playing' || gs.winner) return;
  const oppUid = getOpponentUid();
  if (!oppUid) return;
  await updateDoc(doc(db, 'rooms', roomId), { 'gameState.winner': oppUid });
}

console.log('🎮 Caro Multiplayer loaded');
console.log(`🪙 Mức cược mặc định: ${currentBet.toLocaleString('vi-VN')}`);