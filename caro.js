// ============================================================
//  caro.js — Game logic cho Caro & TicTacToe
//  Chế độ: vs Bot | 2 người local | Online (Firestore)
//  Luật Caro: 5 liên tiếp thắng, 5 bị chặn 2 đầu = chưa thắng
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, POINTS, updateMission, getPoints } from './points.js';
import { createRoom, joinRoom, listenRoom, updateRoomState, deleteRoom } from './room.js';

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================================================
//  PARTICLE CANVAS
// ============================================================
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let particles  = [];
function resizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
resizeBg(); window.addEventListener('resize', resizeBg);
for (let i = 0; i < 40; i++) particles.push({ x: Math.random()*bgCanvas.width, y: Math.random()*bgCanvas.height, vx:(Math.random()-0.5)*0.4, vy:(Math.random()-0.5)*0.4, r:Math.random()*1.5+0.5 });
function drawBg() {
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=bgCanvas.width; if(p.x>bgCanvas.width)p.x=0; if(p.y<0)p.y=bgCanvas.height; if(p.y>bgCanvas.height)p.y=0; bgCtx.beginPath(); bgCtx.arc(p.x,p.y,p.r,0,Math.PI*2); bgCtx.fillStyle='rgba(56,189,248,0.5)'; bgCtx.fill(); });
  for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<100){bgCtx.beginPath();bgCtx.moveTo(particles[i].x,particles[i].y);bgCtx.lineTo(particles[j].x,particles[j].y);bgCtx.strokeStyle=`rgba(56,189,248,${0.07*(1-d/100)})`;bgCtx.lineWidth=0.5;bgCtx.stroke();}}
  requestAnimationFrame(drawBg);
}
drawBg();

// ============================================================
//  GAME STATE
// ============================================================
let gameMode   = '';      // 'tictactoe' | 'caro'
let gameType   = '';      // 'bot' | 'local' | 'online'
let difficulty = 'medium';
let board      = [];
let BOARD_SIZE = 15;
let WIN_COUNT  = 5;
let CELL_SIZE  = 36;
let currentPlayer = 1;   // 1 = X (người), 2 = O (bot/p2)
let gameOver   = false;
let scores     = { p1: 0, p2: 0 };
let myRole     = '';      // 'host' | 'guest' (online)
let roomId     = '';
let unsubRoom  = null;
let mySymbol   = 1;       // online: số ký hiệu của mình

const canvas  = document.getElementById('caro-canvas');
const ctx     = canvas.getContext('2d');

// ============================================================
//  SCREEN NAVIGATION
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.caro-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

window.selectMode = function(mode) {
  gameMode = mode;
  BOARD_SIZE = mode === 'tictactoe' ? 3 : 15;
  WIN_COUNT  = mode === 'tictactoe' ? 3 : 5;
  CELL_SIZE  = mode === 'tictactoe' ? 100 : 36;
  document.getElementById('type-title').textContent = mode === 'tictactoe' ? '⭕ TicTacToe — Kiểu chơi' : '♟️ Caro — Kiểu chơi';
  showScreen('screen-type');
}

window.selectType = function(type) {
  gameType = type;
  if (type === 'bot')    showScreen('screen-difficulty');
  if (type === 'local')  { difficulty = 'local'; startGame('local'); }
  if (type === 'online') showScreen('screen-online');
}

window.goBack = function(screenId) {
  showScreen(screenId);
}

window.goToModeSelect = function() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (roomId && myRole === 'host') deleteRoom(roomId);
  showScreen('screen-mode');
  document.getElementById('result-modal').classList.add('hidden');
}

// ============================================================
//  ONLINE ROOM
// ============================================================
window.doCreateRoom = async function() {
  const err = document.getElementById('online-err');
  err.textContent = '';
  if (!auth.currentUser) { err.textContent = 'Vui lòng đăng nhập!'; return; }

  const initState = { board: Array(BOARD_SIZE * BOARD_SIZE).fill(0), turn: 1, over: false };
  const result = await createRoom(gameMode, initState);
  if (result.error) { err.textContent = result.error; return; }

  roomId = result.roomId;
  myRole = 'host';
  mySymbol = 1;
  document.getElementById('waiting-room-id').textContent = roomId;
  showScreen('screen-waiting');

  // Lắng nghe khi guest vào
  unsubRoom = listenRoom(roomId, (data) => {
    if (data.status === 'playing') {
      unsubRoom();
      startOnlineGame(data);
    }
  });
}

window.doJoinRoom = async function() {
  const id  = document.getElementById('room-input').value.trim();
  const err = document.getElementById('online-err');
  err.textContent = '';
  if (!id || id.length !== 6) { err.textContent = 'Nhập đúng Room ID 6 số!'; return; }
  if (!auth.currentUser) { err.textContent = 'Vui lòng đăng nhập!'; return; }

  const result = await joinRoom(id);
  if (result.error) { err.textContent = result.error; return; }

  roomId = id;
  myRole = 'guest';
  mySymbol = 2;
  startOnlineGame(result.data);
}

window.cancelRoom = async function() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (roomId) await deleteRoom(roomId);
  roomId = '';
  showScreen('screen-online');
}

window.copyRoomId = function() {
  navigator.clipboard.writeText(roomId);
  showToast('📋 Đã copy Room ID!');
}

function startOnlineGame(roomData) {
  const host  = roomData.host?.name  || 'Host';
  const guest = roomData.guest?.name || 'Guest';
  document.getElementById('player1-name').textContent = myRole === 'host' ? `${host} (Bạn)` : host;
  document.getElementById('player2-name').textContent = myRole === 'guest' ? `${guest} (Bạn)` : guest;

  board = roomData.state.board.slice();
  currentPlayer = roomData.state.turn;
  gameOver = false;
  showScreen('screen-game');
  initCanvas();
  drawBoard();
  updateStatus();

  unsubRoom = listenRoom(roomId, (data) => {
    if (data.state) {
      board = data.state.board.slice();
      currentPlayer = data.state.turn;
      gameOver = data.state.over || false;
      drawBoard();
      updateStatus();
      if (data.status === 'finished') handleOnlineFinish(data.state.winner);
    }
  });
}

// ============================================================
//  START GAME (bot / local)
// ============================================================
window.startGame = function(diff) {
  if (diff !== 'local') difficulty = diff;
  scores = { p1: 0, p2: 0 };
  document.getElementById('score-p1').textContent = 0;
  document.getElementById('score-p2').textContent = 0;

  const user = auth.currentUser;
  const name = user ? (user.displayName || user.email.split('@')[0]) : 'Bạn';
  document.getElementById('player1-name').textContent = name;
  document.getElementById('player2-name').textContent = gameType === 'local' ? 'Người chơi 2' : 'Máy';

  showScreen('screen-game');
  restartGame();
}

window.restartGame = function() {
  board = Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  currentPlayer = 1;
  gameOver = false;
  document.getElementById('result-modal').classList.add('hidden');
  initCanvas();
  drawBoard();
  updateStatus();
  setPlayerActive(1);
}

// ============================================================
//  CANVAS INIT & DRAW
// ============================================================
function initCanvas() {
  const size = BOARD_SIZE * CELL_SIZE + 1;
  canvas.width  = size;
  canvas.height = size;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(56,189,248,0.15)';
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

      if (gameMode === 'tictactoe') {
        drawTicSymbol(cx, cy, val);
      } else {
        drawCaroPiece(cx, cy, val);
      }
    }
  }
}

function drawCaroPiece(cx, cy, val) {
  const r = CELL_SIZE * 0.38;
  const gradient = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r);
  if (val === 1) {
    gradient.addColorStop(0, '#7ee8fa');
    gradient.addColorStop(1, '#0ea5e9');
  } else {
    gradient.addColorStop(0, '#fca5a5');
    gradient.addColorStop(1, '#ef4444');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = val === 1 ? 'rgba(56,189,248,0.6)' : 'rgba(248,113,113,0.6)';
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
  cells.forEach(([r, c]) => {
    const cx = c * CELL_SIZE + CELL_SIZE / 2;
    const cy = r * CELL_SIZE + CELL_SIZE / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL_SIZE * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52,211,153,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ============================================================
//  CLICK / TOUCH HANDLER
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
    (t.clientY - rect.top)  * scaleY
  );
});

function handleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  handleMove((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

async function handleMove(px, py) {
  if (gameOver) return;

  // Online: chỉ đánh khi đến lượt mình
  if (gameType === 'online') {
    if (currentPlayer !== mySymbol) return;
  }
  // Bot: chỉ đánh khi lượt người (player 1)
  if (gameType === 'bot' && currentPlayer !== 1) return;

  const c = Math.floor(px / CELL_SIZE);
  const r = Math.floor(py / CELL_SIZE);
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
  if (board[r * BOARD_SIZE + c] !== 0) return;

  await placeMove(r, c);
}

async function placeMove(r, c) {
  board[r * BOARD_SIZE + c] = currentPlayer;
  drawBoard();

  const winCells = checkWin(r, c, currentPlayer);
  if (winCells) {
    highlightWin(winCells);
    gameOver = true;
    await handleWin(currentPlayer);
    return;
  }

  if (board.every(v => v !== 0)) {
    gameOver = true;
    handleDraw();
    return;
  }

  // Online: sync lên Firestore
  if (gameType === 'online') {
    const nextTurn = currentPlayer === 1 ? 2 : 1;
    await updateRoomState(roomId, { board: board.slice(), turn: nextTurn, over: false }, nextTurn === 1 ? 'host' : 'guest');
    currentPlayer = nextTurn;
    updateStatus();
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateStatus();
  setPlayerActive(currentPlayer);

  // Bot đánh
  if (gameType === 'bot' && currentPlayer === 2) {
    setTimeout(botMove, 400);
  }
}

// ============================================================
//  BOT AI
// ============================================================
function botMove() {
  if (gameOver) return;
  let move = null;

  if (difficulty === 'easy') {
    move = randomMove();
  } else if (difficulty === 'medium') {
    move = findBestMove(2, 1) || findBestMove(1, 1) || randomMove();
  } else {
    // Hard: minimax-lite với heuristic
    move = findBestMove(2, WIN_COUNT - 1)
        || findBestMove(1, WIN_COUNT - 1)
        || findBestMove(2, WIN_COUNT - 2)
        || findBestMove(1, WIN_COUNT - 2)
        || findBestMove(2, 1)
        || findBestMove(1, 1)
        || randomMove();
  }

  if (move) placeMove(move.r, move.c);
}

function randomMove() {
  const empty = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) empty.push({ r: Math.floor(i/BOARD_SIZE), c: i%BOARD_SIZE });
  }
  return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
}

// Tìm nước đi có n quân liên tiếp của player
function findBestMove(player, n) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r*BOARD_SIZE+c] !== 0) continue;
      for (const [dr, dc] of dirs) {
        let count = 0;
        for (let k = 1; k <= n; k++) {
          const nr = r + dr*k, nc = c + dc*k;
          if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr*BOARD_SIZE+nc] === player) count++;
          else break;
        }
        if (count >= n) return { r, c };
        count = 0;
        for (let k = 1; k <= n; k++) {
          const nr = r - dr*k, nc = c - dc*k;
          if (nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE && board[nr*BOARD_SIZE+nc] === player) count++;
          else break;
        }
        if (count >= n) return { r, c };
      }
    }
  }
  return null;
}

// ============================================================
//  KIỂM TRA THẮNG — Luật Caro: 5 liên tiếp, không bị chặn 2 đầu
// ============================================================
function checkWin(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const cells = [[r, c]];

    // Đếm một chiều
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

    // Lấy đúng WIN_COUNT ô liên tiếp có chứa ô vừa đặt
    for (let start = 0; start <= cells.length - WIN_COUNT; start++) {
      const seg = cells.slice(start, start + WIN_COUNT);

      if (gameMode === 'caro') {
        // Kiểm tra 2 đầu bị chặn
        const head = seg[0];
        const tail = seg[seg.length - 1];
        const beforeR = head[0] - dr, beforeC = head[1] - dc;
        const afterR  = tail[0] + dr, afterC  = tail[1] + dc;

        const headBlocked = beforeR < 0 || beforeR >= BOARD_SIZE || beforeC < 0 || beforeC >= BOARD_SIZE
          || board[beforeR * BOARD_SIZE + beforeC] !== 0;
        const tailBlocked = afterR  < 0 || afterR  >= BOARD_SIZE || afterC  < 0 || afterC  >= BOARD_SIZE
          || board[afterR  * BOARD_SIZE + afterC ] !== 0;

        if (headBlocked && tailBlocked) continue; // bị chặn 2 đầu = không thắng
      }

      return seg; // thắng!
    }
  }
  return null;
}

// ============================================================
//  XỬ LÝ KẾT QUẢ
// ============================================================
async function handleWin(player) {
  const isMe = gameType === 'online' ? player === mySymbol : player === 1;
  if (player === 1) { scores.p1++; document.getElementById('score-p1').textContent = scores.p1; }
  else              { scores.p2++; document.getElementById('score-p2').textContent = scores.p2; }

  setPlayerActive(0);

  if (gameType === 'online') {
    const winnerRole = player === 1 ? 'host' : 'guest';
    await updateRoomState(roomId, { board: board.slice(), turn: player, over: true, winner: player }, winnerRole, 'finished');
  }

  if (isMe && gameType !== 'local') {
    const pts = gameMode === 'caro' ? POINTS.WIN_CARO : POINTS.WIN_CARO;
    await addPoints(gameMode === 'caro' ? 'Caro' : 'TicTacToe', 'Thắng game', pts);
    await updateMission('win1');
    await updateMission('win3');
    await updateMission('win5');
    await updateMission('play3');
    showResult('🏆', 'Bạn thắng!', `+${pts} điểm`);
    refreshPoints();
  } else if (!isMe && gameType !== 'local') {
    await updateMission('play3');
    showResult('😔', gameType === 'bot' ? 'Máy thắng!' : 'Đối thủ thắng!', '');
  } else {
    // Local 2 người
    showResult(player === 1 ? '🏆' : '🎉', `Người chơi ${player} thắng!`, '');
  }
}

function handleDraw() {
  showResult('🤝', 'Hòa!', '');
}

function handleOnlineFinish(winner) {
  if (winner === mySymbol) showResult('🏆', 'Bạn thắng!', '');
  else showResult('😔', 'Đối thủ thắng!', '');
}

function showResult(emoji, title, pts) {
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-pts').textContent   = pts;
  document.getElementById('result-modal').classList.remove('hidden');
}

// ============================================================
//  UI HELPERS
// ============================================================
function updateStatus() {
  const el = document.getElementById('caro-status');
  if (gameOver) return;

  if (gameType === 'online') {
    const myTurn = currentPlayer === mySymbol;
    el.textContent = myTurn ? '⚔️ Lượt của bạn' : '⏳ Chờ đối thủ...';
    el.style.color = myTurn ? '#34d399' : '#7dd3fc';
    setPlayerActive(currentPlayer);
    return;
  }

  const names = ['', document.getElementById('player1-name').textContent, document.getElementById('player2-name').textContent];
  el.textContent = `⚔️ Lượt: ${names[currentPlayer]}`;
  el.style.color = currentPlayer === 1 ? '#38bdf8' : '#f87171';
  setPlayerActive(currentPlayer);
}

function setPlayerActive(p) {
  document.getElementById('player1-tag').classList.toggle('active', p === 1);
  document.getElementById('player2-tag').classList.toggle('active', p === 2);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function refreshPoints() {
  try {
    const pts = await getPoints();
    const nav = document.getElementById('nav-pts');
    if (nav) nav.textContent = '⭐ ' + pts.toLocaleString();
  } catch(e) {}
}

// ============================================================
//  AUTH CHECK
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  const pts = await getPoints();
  const nav = document.getElementById('nav-pts');
  if (nav) nav.textContent = '⭐ ' + pts.toLocaleString();
});
