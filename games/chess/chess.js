import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from '../../points.js';

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const levelStripEl = document.getElementById('level-strip');
const levelInfoEl = document.getElementById('level-info');
const colorWhiteBtn = document.getElementById('color-white');
const colorBlackBtn = document.getElementById('color-black');
const startBtn = document.getElementById('start-btn');

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo-btn');
const resetBtn = document.getElementById('reset');

// ==================== HỆ THỐNG TIỀN CƯỢC ====================
// Không cache balance cục bộ: TopNav đã tự subscribeBalance() từ points.js
// và cập nhật realtime, không cần chess.js tự quản lý/đồng bộ tay.
let currentBet = 0;
let payoutSettled = false;

async function initAuth() {
  await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve();
      else location.href = 'index.html';
    });
  });
}

initAuth();

// --- KIỂM TRA THƯ VIỆN chess.js ---
if (typeof Chess === 'undefined') {
  statusEl.textContent = '❌ Không tải được chess.js. Kiểm tra mạng.';
  throw new Error('Chess library not loaded');
}

const game = new Chess();

const bcStatusEl = document.getElementById('bc-status');
const chessScoreEl = document.getElementById('chess-score');
const chessScoreSubEl = document.getElementById('chess-score-sub');
const profitEl = document.getElementById('chess-profit');
const chessEloBadgeEl = document.getElementById('chess-elo-badge');
const sidePlayerEl = document.getElementById('side-player');
const sideMachineEl = document.getElementById('side-machine');

// Bộ quân cờ Cburnett (chuẩn Lichess/Wikipedia) — nạp qua CDN jsdelivr, đẹp và không phụ thuộc font máy
const PIECE_CDN_BASE = 'https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/';
const PIECE_SVG = {
  wk: `<img src="${PIECE_CDN_BASE}wK.svg" alt="wK" draggable="false">`,
  bk: `<img src="${PIECE_CDN_BASE}bK.svg" alt="bK" draggable="false">`,
  wq: `<img src="${PIECE_CDN_BASE}wQ.svg" alt="wQ" draggable="false">`,
  bq: `<img src="${PIECE_CDN_BASE}bQ.svg" alt="bQ" draggable="false">`,
  wr: `<img src="${PIECE_CDN_BASE}wR.svg" alt="wR" draggable="false">`,
  br: `<img src="${PIECE_CDN_BASE}bR.svg" alt="bR" draggable="false">`,
  wb: `<img src="${PIECE_CDN_BASE}wB.svg" alt="wB" draggable="false">`,
  bb: `<img src="${PIECE_CDN_BASE}bB.svg" alt="bB" draggable="false">`,
  wn: `<img src="${PIECE_CDN_BASE}wN.svg" alt="wN" draggable="false">`,
  bn: `<img src="${PIECE_CDN_BASE}bN.svg" alt="bN" draggable="false">`,
  wp: `<img src="${PIECE_CDN_BASE}wP.svg" alt="wP" draggable="false">`,
  bp: `<img src="${PIECE_CDN_BASE}bP.svg" alt="bP" draggable="false">`
};

// --- 10 CẤP ĐỘ ---
const LEVELS = [
  { elo: 1320, depth: 2,  random: 0.55, tier: 'easy',   note: 'Newbie · máy đi ngẫu nhiên, dễ mắc sai lầm', reward: 500 },
  { elo: 1400, depth: 3,  random: 0.45, tier: 'easy',   note: 'Newbie · tính toán rất nông', reward: 1000 },
  { elo: 1500, depth: 4,  random: 0.30, tier: 'easy',   note: 'Newbie+ · thỉnh thoảng sai lầm', reward: 1500 },
  { elo: 1650, depth: 6,  random: 0,    tier: 'medium', note: 'Trung bình · phân tích thế cờ cơ bản', reward: 2000 },
  { elo: 1800, depth: 8,  random: 0,    tier: 'medium', note: 'Trung bình · ổn định hơn', reward: 2500 },
  { elo: 1950, depth: 9,  random: 0,    tier: 'medium', note: 'Trung bình khá', reward: 3000 },
  { elo: 2100, depth: 10, random: 0,    tier: 'medium', note: 'Trung bình+ · sắp bước vào khó', reward: 3500 },
  { elo: 2400, depth: 12, random: 0,    tier: 'hard',   note: 'Khó · tính toán sâu, đánh gắt', reward: 4000 },
  { elo: 2700, depth: 14, random: 0,    tier: 'hard',   note: 'Rất khó · rất ít sai sót', reward: 4500 },
  { elo: 3190, depth: 16, random: 0,    tier: 'hard',   note: 'Siêu khó · gần như hoàn hảo', reward: 5000 }
];

let selectedLevel = 3; // mặc định cấp 3 (1-indexed)
let playerColor = 'w'; // 'w' hoặc 'b'

let selected = null;
let targets = [];
let engine = null;
let waiting = false;
let lastMove = null; // { from, to } nước đi gần nhất, để tô sáng trên bàn cờ

// --- DỰNG MÀN HÌNH CÀI ĐẶT ---
function buildLevelStrip() {
  levelStripEl.innerHTML = '';
  LEVELS.forEach((lvl, i) => {
    const n = i + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `level-btn tier-${lvl.tier}`;
    btn.textContent = n;
    btn.dataset.level = n;
    if (n === selectedLevel) btn.classList.add('active');
    btn.addEventListener('click', () => {
      selectedLevel = n;
      [...levelStripEl.children].forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      updateLevelInfo();
    });
    levelStripEl.appendChild(btn);
  });
  updateLevelInfo();
}

function updateLevelInfo() {
  const lvl = LEVELS[selectedLevel - 1];
  levelInfoEl.textContent = `Cấp ${selectedLevel} · ~${lvl.elo} ELO · ${lvl.note} · Thưởng ${lvl.reward.toLocaleString('vi-VN')}⭐`;
}

colorWhiteBtn.addEventListener('click', () => {
  playerColor = 'w';
  colorWhiteBtn.classList.add('active');
  colorBlackBtn.classList.remove('active');
});
colorBlackBtn.addEventListener('click', () => {
  playerColor = 'b';
  colorBlackBtn.classList.add('active');
  colorWhiteBtn.classList.remove('active');
});

startBtn.addEventListener('click', placeBetAndStart);

async function placeBetAndStart() {
  if (startBtn.disabled) return;
  currentBet = LEVELS[selectedLevel - 1].reward;
  startBtn.disabled = true;
  try {
    startGame();
  } finally {
    startBtn.disabled = false;
  }
}

function startGame() {
  game.reset();
  selected = null;
  targets = [];
  waiting = false;
  payoutSettled = false;
  lastMove = null;

  setupScreen.style.display = 'none';
  gameScreen.style.display = '';

  chessEloBadgeEl.textContent = `${LEVELS[selectedLevel - 1].elo} ELO`;
  sideMachineEl.style.display = '';
  profitEl.textContent = '';
  profitEl.className = 'stat-profit zero';

  sidePlayerEl.classList.remove('active-turn');
  sideMachineEl.classList.remove('active-turn');

  render();

  if (engine) setEngineStrength();

  if (playerColor === 'b') {
    makeEngineMove();
  }
}

function backToSetup() {
  clearTimeout(moveTimeoutTimer);
  waiting = false;
  gameScreen.style.display = 'none';
  setupScreen.style.display = '';
}

// --- STOCKFISH VỚI FALLBACK NHIỀU CDN ---
// Ưu tiên bản KHÔNG dùng wasm trước: bản .wasm.js cần tải thêm 1 file .wasm
// riêng bằng đường dẫn tương đối, nhưng khi script chạy từ Blob URL thì đường
// dẫn tương đối đó không tồn tại -> worker "treo" mãi mãi mà không báo lỗi.
const STOCKFISH_URLS = [
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
  'https://unpkg.com/stockfish.js@10.0.2/stockfish.js',
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.wasm.js',
  'https://unpkg.com/stockfish.js@10.0.2/stockfish.wasm.js'
];

const ENGINE_READY_TIMEOUT_MS = 6000;

// Trình duyệt chặn `new Worker(urlKhácNguồn)` bằng SecurityError bất kể CDN nào.
// Cách khắc phục: tải nội dung script bằng fetch(), rồi tạo Worker từ Blob URL
// (Blob luôn cùng-nguồn nên trình duyệt cho phép).
// Sau khi tạo worker, phải chờ nó thực sự trả lời "uciok" trong thời gian giới
// hạn rồi mới coi là dùng được -- nếu không, hủy worker và thử URL tiếp theo.
async function createEngineWithFallback(urls, index) {
  if (index >= urls.length) {
    return null;
  }
  try {
    const res = await fetch(urls[index]);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const code = await res.text();
    const blob = new Blob([code], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);

    const ready = await waitForUciOk(worker, urls[index]);
    if (ready) return worker;

    worker.terminate();
    return createEngineWithFallback(urls, index + 1);
  } catch (e) {
    console.warn('Không tạo Worker với URL:', urls[index], e);
    return createEngineWithFallback(urls, index + 1);
  }
}

function waitForUciOk(worker, url) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('Worker không phản hồi kịp (timeout):', url);
      worker.onmessage = null;
      worker.onerror = null;
      resolve(false);
    }, ENGINE_READY_TIMEOUT_MS);

    worker.onmessage = (e) => {
      if (settled) return;
      if (typeof e.data === 'string' && e.data.includes('uciok')) {
        settled = true;
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        resolve(true);
      }
    };
    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.warn('Worker lỗi với URL:', url, err);
      resolve(false);
    };

    worker.postMessage('uci');
  });
}

function initEngine() {
  if (!engine) return;
  engine.onmessage = (e) => {
    if (typeof e.data === 'string') handleEngineMessage(e.data);
  };
  engine.onerror = (err) => {
    console.warn('Lỗi engine trong lúc chạy:', err);
  };
  engine.postMessage('isready');
  setEngineStrength();
}

createEngineWithFallback(STOCKFISH_URLS, 0).then((eng) => {
  engine = eng;
  if (engine) initEngine();
  else statusEl.textContent = '⚠️ Không có engine AI, chỉ chơi với người.';
});

function setEngineStrength() {
  if (!engine) return;
  const lvl = LEVELS[selectedLevel - 1];
  engine.postMessage('setoption name UCI_LimitStrength value true');
  engine.postMessage(`setoption name UCI_Elo value ${lvl.elo}`);
}

function pieceChar(piece) {
  const key = (piece.color === 'w' ? 'w' : 'b') + piece.type;
  return PIECE_SVG[key] || '';
}

// Chuyển tọa độ ô hiển thị (r,c) -> ô cờ thực + vị trí trong mảng game.board(),
// có tính đến việc bàn cờ xoay theo màu quân người chơi.
function squareInfo(r, c) {
  const rank = playerColor === 'b' ? (r + 1) : (8 - r);
  const fileIndex = playerColor === 'b' ? (7 - c) : c;
  const file = 'abcdefgh'[fileIndex];
  return {
    sq: file + rank,
    boardRow: 8 - rank,
    boardCol: fileIndex,
    isLight: (fileIndex + rank) % 2 === 0
  };
}

// Tìm ô đang đứng của vua thuộc một màu, dùng để đổ hiệu ứng chiếu.
function findKingSquare(color) {
  const b = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.type === 'k' && p.color === color) {
        const file = 'abcdefgh'[c];
        const rank = 8 - r;
        return file + rank;
      }
    }
  }
  return null;
}

function render() {
  boardEl.innerHTML = '';
  const b = game.board();

  const inCheck = game.in_check() && !game.game_over();
  const checkedKingSq = inCheck ? findKingSquare(game.turn()) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const { sq, boardRow, boardCol, isLight } = squareInfo(r, c);
      const cell = document.createElement('div');
      cell.className = `square ${isLight ? 'light' : 'dark'}`;
      cell.dataset.square = sq;

      if (sq === selected) cell.classList.add('selected');
      if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cell.classList.add('last-move');
      if (targets.includes(sq)) {
        cell.classList.add('move');
        // Ô có quân đối phương -> đây là nước ăn quân, hiển thị vòng thay vì chấm
        if (b[boardRow][boardCol]) cell.classList.add('capture');
      }
      if (sq === checkedKingSq) cell.classList.add('king-check');

      const p = b[boardRow][boardCol];
      if (p) {
        const span = document.createElement('span');
        span.className = `piece ${p.color === 'w' ? 'piece-white' : 'piece-black'}`;
        span.innerHTML = pieceChar(p);
        cell.appendChild(span);
      }

      cell.addEventListener('click', onSquareClick);
      boardEl.appendChild(cell);
    }
  }

  updateStatus();
  updateUndoAvailability();
}

function onSquareClick(e) {
  if (waiting || game.game_over()) return;
  if (game.turn() !== playerColor) return;

  const sq = e.currentTarget.dataset.square;
  const piece = game.get(sq);

  if (selected) {
    if (sq === selected) {
      selected = null;
      targets = [];
      render();
      return;
    }

    let move = null;
    try {
      move = game.move({ from: selected, to: sq, promotion: 'q' });
    } catch (_) {
      move = null;
    }

    if (move) {
      selected = null;
      targets = [];
      lastMove = { from: move.from, to: move.to };
      render();
      if (!game.game_over()) makeEngineMove();
      return;
    }

    // Nước đi không hợp lệ: nếu bấm sang quân mình khác thì chuyển chọn quân đó,
    // ngược lại báo hiệu đỏ để người chơi biết ô này không thể đi tới.
    if (piece && piece.color === game.turn()) {
      selected = sq;
      targets = game.moves({ square: sq, verbose: true }).map(m => m.to);
      render();
      return;
    }

    flashInvalidSquare(sq);
    return;
  }

  if (piece && piece.color === game.turn()) {
    selected = sq;
    targets = game.moves({ square: sq, verbose: true }).map(m => m.to);
  } else {
    selected = null;
    targets = [];
  }

  render();
}

// Nhấp nháy đỏ ngắn trên ô không thể đi tới, để phản hồi tức thì cho người chơi.
function flashInvalidSquare(sq) {
  const cellEl = boardEl.querySelector(`.square[data-square="${sq}"]`);
  if (!cellEl) return;
  cellEl.classList.remove('invalid');
  // buộc reflow để animation chạy lại nếu click liên tiếp cùng 1 ô
  void cellEl.offsetWidth;
  cellEl.classList.add('invalid');
  setTimeout(() => cellEl.classList.remove('invalid'), 400);
}

let moveTimeoutTimer = null;
const MOVE_TIMEOUT_MS = 15000;

function makeEngineMove() {
  if (game.game_over()) return;

  const lvl = LEVELS[selectedLevel - 1];

  // Cấp thấp: đôi khi máy cố tình đi một nước ngẫu nhiên hợp lệ để mô phỏng sai lầm của newbie.
  if (lvl.random > 0 && Math.random() < lvl.random) {
    const legalMoves = game.moves();
    if (legalMoves.length > 0) {
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      waiting = true;
      updateStatus();
      setTimeout(() => {
        try {
          const mv = game.move(randomMove);
          if (mv) lastMove = { from: mv.from, to: mv.to };
        } catch (_) {}
        waiting = false;
        render();
      }, 350);
      return;
    }
  }

  if (!engine) return;

  waiting = true;
  updateStatus();
  setEngineStrength();

  const fen = game.fen();
  engine.postMessage(`position fen ${fen}`);
  engine.postMessage(`go depth ${lvl.depth}`);

  clearTimeout(moveTimeoutTimer);
  moveTimeoutTimer = setTimeout(() => {
    if (!waiting) return;
    console.warn('Engine không phản hồi kịp nước đi, bỏ qua.');
    waiting = false;
    statusEl.textContent = '⚠️ Engine không phản hồi. Vui lòng thử lại hoặc bắt đầu ván mới.';
    render();
  }, MOVE_TIMEOUT_MS);
}

function handleEngineMessage(line) {
  if (typeof line !== 'string' || !line) return;
  if (!line.startsWith('bestmove')) return;

  clearTimeout(moveTimeoutTimer);

  const mv = line.split(' ')[1];
  if (mv && mv !== '(none)') {
    try {
      const moveObj = game.move({
        from: mv.slice(0, 2),
        to: mv.slice(2, 4),
        promotion: mv.length > 4 ? mv[4] : 'q'
      });
      if (moveObj) lastMove = { from: moveObj.from, to: moveObj.to };
    } catch (_) {
      console.error('Engine trả về nước đi không hợp lệ:', mv);
    }
  }

  waiting = false;
  render();
}

function updateStatus() {
  bcStatusEl.classList.remove('thinking', 'result-win', 'result-lose', 'result-draw', 'in-check');
  sidePlayerEl.classList.remove('active-turn');
  sideMachineEl.classList.remove('active-turn');

  // Ẩn tiền cược/thưởng trong lúc ván đấu đang diễn ra, chỉ hiện lại khi kết thúc
  bcStatusEl.classList.toggle('in-progress', !game.game_over());

  // Khoanh sáng bên đang tới lượt (trái = người chơi, phải = máy), trừ khi ván đã kết thúc
  if (!game.game_over()) {
    if (game.turn() === playerColor) {
      sidePlayerEl.classList.add('active-turn');
    } else {
      sideMachineEl.classList.add('active-turn');
    }
    if (game.in_check()) {
      bcStatusEl.classList.add('in-check');
    }
  }

  if (game.in_checkmate()) {
    const playerWon = game.turn() !== playerColor;
    statusEl.textContent = `Chiếu hết. ${playerWon ? 'Bạn' : 'Máy'} thắng.`;
    chessScoreEl.textContent = playerWon ? 'WIN' : 'LOSE';
    chessScoreSubEl.textContent = 'Ván đấu kết thúc';
    bcStatusEl.classList.add(playerWon ? 'result-win' : 'result-lose');
    settlePayout(playerWon ? 'win' : 'lose');
  } else if (game.in_draw()) {
    statusEl.textContent = 'Hòa cờ.';
    chessScoreEl.textContent = 'HÒA';
    chessScoreSubEl.textContent = 'Ván đấu kết thúc';
    bcStatusEl.classList.add('result-draw');
    settlePayout('draw');
  } else if (waiting) {
    const inCheck = game.in_check();
    statusEl.textContent = inCheck ? 'Máy đang bị chiếu, đang suy nghĩ...' : 'Máy đang suy nghĩ...';
    chessScoreEl.textContent = inCheck ? 'CHIẾU' : '';
    chessScoreSubEl.textContent = 'Máy đang đi';
    bcStatusEl.classList.add('thinking');
  } else if (game.in_check()) {
    statusEl.textContent = 'Đang bị chiếu tướng.';
    chessScoreEl.textContent = 'CHIẾU';
    chessScoreSubEl.textContent = 'Đang bị chiếu!';
  } else {
    const turnLabel = game.turn() === 'w' ? 'Trắng' : 'Đen';
    statusEl.textContent = `Lượt đi: ${turnLabel}`;
    chessScoreEl.textContent = '';
    chessScoreSubEl.textContent = 'Lượt đi';
  }
}

// --- THANH TOÁN: thắng nhận thưởng, thua bị phạt, hòa không cộng trừ. Chỉ chạy 1 lần/ván ---
async function settlePayout(result) {
  if (payoutSettled) return;
  payoutSettled = true;

  // Thua không bị trừ tiền: chỉ cộng thưởng khi thắng, thua/hòa đều không trừ.
  let delta = 0;
  if (result === 'win') delta = currentBet;

  if (delta !== 0) {
    try {
      await    // Admin force
    if (window.__ADMIN_FORCED_RESULT === 'lose') { delta = -Math.abs(delta || 100); }
    addPoints('Casino', 'Thắng Cờ Vua', delta, false);
      // TopNav tự cập nhật realtime qua subscribeBalance, không cần setPoints tay.
    } catch (e) {
      console.error(e);
    }
  }

  sideMachineEl.style.display = 'none';
  const net = delta;
  profitEl.textContent = result === 'lose' ? '0' : (net === 0 ? '' : (net > 0 ? '+' : '') + net.toLocaleString('vi-VN'));
  profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');
}

// --- UNDO: đánh với máy nên phải lùi 2 nước để trả lại đúng lượt cho người chơi ---
function updateUndoAvailability() {
  const canUndo = !waiting && game.history().length >= 2 && !game.game_over();
  undoBtn.disabled = !canUndo;
}

function undoMove() {
  if (waiting) return;
  if (game.history().length < 2) return;

  game.undo(); // lùi nước của máy
  game.undo(); // lùi nước của người chơi

  const hist = game.history({ verbose: true });
  lastMove = hist.length ? { from: hist[hist.length - 1].from, to: hist[hist.length - 1].to } : null;

  selected = null;
  targets = [];
  waiting = false;
  render();
}

undoBtn.addEventListener('click', undoMove);

resetBtn.addEventListener('click', backToSetup);

buildLevelStrip();

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){var s=document.getElementById('setup-screen'),g=document.getElementById('game-screen');if(s)s.style.display='';if(g)g.style.display='none'}})}},100);
