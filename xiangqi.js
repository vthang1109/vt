import { auth, db } from './points.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from './points.js';
import { getActivePetInfo } from './pet.js';

// ==================== ENGINE CỜ TƯỚNG (LUẬT) — gộp trực tiếp, không tách file riêng ====================
// Bàn cờ: 10 dòng (0..9, 0=trên/Đen, 9=dưới/Đỏ) x 9 cột (0..8).
// Quân: {type:'k|a|e|h|c|n|p', color:'r'|'b'}
const PIECE_LABEL = {
  r: { k: '帥', a: '仕', e: '相', h: '傌', c: '俥', n: '炮', p: '兵' },
  b: { k: '將', a: '士', e: '象', h: '馬', c: '車', n: '砲', p: '卒' }
};

function createInitialBoard() {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ['c', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'c'];
  back.forEach((t, c) => { b[0][c] = { type: t, color: 'b' }; b[9][c] = { type: t, color: 'r' }; });
  [1, 7].forEach(c => { b[2][c] = { type: 'n', color: 'b' }; b[7][c] = { type: 'n', color: 'r' }; });
  [0, 2, 4, 6, 8].forEach(c => { b[3][c] = { type: 'p', color: 'b' }; b[6][c] = { type: 'p', color: 'r' }; });
  return b;
}

function cloneBoard(board) { return board.map(row => row.slice()); }
function opposite(color) { return color === 'r' ? 'b' : 'r'; }
function inBounds(r, c) { return r >= 0 && r <= 9 && c >= 0 && c <= 8; }
function inPalace(r, c, color) {
  return color === 'b' ? (r >= 0 && r <= 2 && c >= 3 && c <= 5) : (r >= 7 && r <= 9 && c >= 3 && c <= 5);
}

function findGeneral(board, color) {
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (p && p.type === 'k' && p.color === color) return [r, c];
  }
  return null;
}

function pushIfOk(board, moves, from, r, c, color) {
  if (!inBounds(r, c)) return;
  const t = board[r][c];
  if (!t || t.color !== color) moves.push({ from, to: [r, c] });
}

function generalMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function advisorMoves(board, r, c, color, moves) {
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function elephantMoves(board, r, c, color, moves) {
  [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (color === 'b' && nr > 4) return;
    if (color === 'r' && nr < 5) return;
    if (board[r + dr / 2][c + dc / 2]) return; // chẹt mắt tượng
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function horseMoves(board, r, c, color, moves) {
  [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    const leg = Math.abs(dr) === 2 ? [r + dr / 2, c] : [r, c + dc / 2];
    if (board[leg[0]][leg[1]]) return; // bị chẹt chân mã
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function chariotMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) { moves.push({ from: [r, c], to: [nr, nc] }); }
      else { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      nr += dr; nc += dc;
    }
  });
}
function cannonMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc, screen = false;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!screen) {
        if (!t) moves.push({ from: [r, c], to: [nr, nc] });
        else screen = true;
      } else {
        if (t) { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      }
      nr += dr; nc += dc;
    }
  });
}
function pawnMoves(board, r, c, color, moves) {
  const fwd = color === 'b' ? 1 : -1;
  pushIfOk(board, moves, [r, c], r + fwd, c, color);
  const crossed = color === 'b' ? r >= 5 : r <= 4;
  if (crossed) {
    pushIfOk(board, moves, [r, c], r, c + 1, color);
    pushIfOk(board, moves, [r, c], r, c - 1, color);
  }
}

function generatePseudoMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (!p || p.color !== color) continue;
    if (p.type === 'k') generalMoves(board, r, c, color, moves);
    else if (p.type === 'a') advisorMoves(board, r, c, color, moves);
    else if (p.type === 'e') elephantMoves(board, r, c, color, moves);
    else if (p.type === 'h') horseMoves(board, r, c, color, moves);
    else if (p.type === 'c') chariotMoves(board, r, c, color, moves);
    else if (p.type === 'n') cannonMoves(board, r, c, color, moves);
    else if (p.type === 'p') pawnMoves(board, r, c, color, moves);
  }
  return moves;
}

function isAttacked(board, sq, byColor) {
  const moves = generatePseudoMoves(board, byColor);
  return moves.some(m => m.to[0] === sq[0] && m.to[1] === sq[1]);
}

function isInCheck(board, color) {
  const gp = findGeneral(board, color);
  if (!gp) return true;
  return isAttacked(board, gp, opposite(color));
}

function generalsFacing(board) {
  const rg = findGeneral(board, 'r'), bg = findGeneral(board, 'b');
  if (!rg || !bg || rg[1] !== bg[1]) return false;
  const c = rg[1], r1 = Math.min(rg[0], bg[0]), r2 = Math.max(rg[0], bg[0]);
  for (let r = r1 + 1; r < r2; r++) if (board[r][c]) return false;
  return true;
}

function simulateMove(board, move) {
  const nb = cloneBoard(board);
  nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  return nb;
}

function generateLegalMoves(board, color) {
  const pseudo = generatePseudoMoves(board, color);
  return pseudo.filter(m => {
    const nb = simulateMove(board, m);
    if (isInCheck(nb, color)) return false;
    if (generalsFacing(nb)) return false;
    return true;
  });
}

function isGameOver(board, color) {
  if (!findGeneral(board, color)) return true;
  return generateLegalMoves(board, color).length === 0;
}
// ==================== HẾT PHẦN ENGINE ====================

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const levelStripEl = document.getElementById('level-strip');
const levelInfoEl = document.getElementById('level-info');
const colorRedBtn = document.getElementById('color-red');
const colorBlackBtn = document.getElementById('color-black');
const startBtn = document.getElementById('start-btn');

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo-btn');
const resetBtn = document.getElementById('reset');

// ==================== HỆ THỐNG TIỀN CƯỢC (đồng bộ Xì Dách) ====================
let balance = 0;
let currentBet = 0;
let unsubBalance = null;
let payoutSettled = false;

async function initAuth() {
  await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve();
      else location.href = 'index.html';
    });
  });
  listenBalance();
}
function listenBalance() {
  if (unsubBalance) unsubBalance();
  unsubBalance = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
    if (snap.exists()) balance = snap.data().points || 0;
  });
}
initAuth();

// ==================== TRẠNG THÁI VÁN CỜ ====================
const bcStatusEl = document.getElementById('bc-status');
const xqScoreEl = document.getElementById('xq-score');
const xqScoreSubEl = document.getElementById('xq-score-sub');
const xqProfitEl = document.getElementById('xq-profit');
const xqLevelBadgeEl = document.getElementById('xq-level-badge');
const sidePlayerEl = document.getElementById('side-player');
const sideMachineEl = document.getElementById('side-machine');

// --- 10 CẤP ĐỘ ---
const LEVELS = [
  { depth: 1, timeMs: 600,  random: 0.55, tier: 'easy',   note: 'Newbie · máy đi ngẫu nhiên, dễ mắc sai lầm', reward: 500 },
  { depth: 1, timeMs: 800,  random: 0.45, tier: 'easy',   note: 'Newbie · tính toán rất nông', reward: 1000 },
  { depth: 2, timeMs: 1000, random: 0.30, tier: 'easy',   note: 'Newbie+ · thỉnh thoảng sai lầm', reward: 1500 },
  { depth: 2, timeMs: 1500, random: 0,    tier: 'medium', note: 'Trung bình · phân tích thế cờ cơ bản', reward: 2000 },
  { depth: 3, timeMs: 2000, random: 0,    tier: 'medium', note: 'Trung bình · ổn định hơn', reward: 2500 },
  { depth: 3, timeMs: 2500, random: 0,    tier: 'medium', note: 'Trung bình khá', reward: 3000 },
  { depth: 4, timeMs: 3000, random: 0,    tier: 'medium', note: 'Trung bình+ · sắp bước vào khó', reward: 3500 },
  { depth: 4, timeMs: 4000, random: 0,    tier: 'hard',   note: 'Khó · tính toán sâu, đánh gắt', reward: 4000 },
  { depth: 5, timeMs: 5000, random: 0,    tier: 'hard',   note: 'Rất khó · rất ít sai sót', reward: 4500 },
  { depth: 6, timeMs: 6000, random: 0,    tier: 'hard',   note: 'Siêu khó · gần như hoàn hảo', reward: 5000 }
];

let selectedLevel = 3;
let playerColor = 'r'; // 'r' đỏ hoặc 'b' đen

let board = createInitialBoard();
let turn = 'r';
let selected = null;
let targets = [];
let history = []; // snapshot {board, turn} để undo
let waiting = false;
let lastMove = null;
let gameOver = false;

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
  levelInfoEl.textContent = `Cấp ${selectedLevel} · ${lvl.note} · Thưởng ${lvl.reward.toLocaleString('vi-VN')}⭐`;
}

colorRedBtn.addEventListener('click', () => {
  playerColor = 'r';
  colorRedBtn.classList.add('active');
  colorBlackBtn.classList.remove('active');
});
colorBlackBtn.addEventListener('click', () => {
  playerColor = 'b';
  colorBlackBtn.classList.add('active');
  colorRedBtn.classList.remove('active');
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
  board = createInitialBoard();
  turn = 'r';
  selected = null;
  targets = [];
  history = [];
  waiting = false;
  payoutSettled = false;
  lastMove = null;
  gameOver = false;

  setupScreen.style.display = 'none';
  gameScreen.style.display = '';

  xqLevelBadgeEl.textContent = `Cấp ${selectedLevel}`;
  xqProfitEl.textContent = '+0';
  xqProfitEl.className = 'xq-profit-value zero';

  sidePlayerEl.classList.remove('active-turn');
  sideMachineEl.classList.remove('active-turn');

  render();
  if (turn !== playerColor) makeEngineMove();
}

function backToSetup() {
  waiting = false;
  gameScreen.style.display = 'none';
  setupScreen.style.display = '';
}

// ==================== AI WORKER (gộp trực tiếp, dựng qua Blob — không cần file xiangqi-worker.js riêng) ====================
const WORKER_SRC = `
function cloneBoard(board) { return board.map(row => row.slice()); }
function opposite(color) { return color === 'r' ? 'b' : 'r'; }
function inBounds(r, c) { return r >= 0 && r <= 9 && c >= 0 && c <= 8; }
function inPalace(r, c, color) {
  return color === 'b' ? (r >= 0 && r <= 2 && c >= 3 && c <= 5) : (r >= 7 && r <= 9 && c >= 3 && c <= 5);
}
function findGeneral(board, color) {
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (p && p.type === 'k' && p.color === color) return [r, c];
  }
  return null;
}
function pushIfOk(board, moves, from, r, c, color) {
  if (!inBounds(r, c)) return;
  const t = board[r][c];
  if (!t || t.color !== color) moves.push({ from, to: [r, c] });
}
function generalMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function advisorMoves(board, r, c, color, moves) {
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function elephantMoves(board, r, c, color, moves) {
  [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (color === 'b' && nr > 4) return;
    if (color === 'r' && nr < 5) return;
    if (board[r + dr / 2][c + dc / 2]) return;
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function horseMoves(board, r, c, color, moves) {
  [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    const leg = Math.abs(dr) === 2 ? [r + dr / 2, c] : [r, c + dc / 2];
    if (board[leg[0]][leg[1]]) return;
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function chariotMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) { moves.push({ from: [r, c], to: [nr, nc] }); }
      else { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      nr += dr; nc += dc;
    }
  });
}
function cannonMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc, screen = false;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!screen) {
        if (!t) moves.push({ from: [r, c], to: [nr, nc] });
        else screen = true;
      } else {
        if (t) { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      }
      nr += dr; nc += dc;
    }
  });
}
function pawnMoves(board, r, c, color, moves) {
  const fwd = color === 'b' ? 1 : -1;
  pushIfOk(board, moves, [r, c], r + fwd, c, color);
  const crossed = color === 'b' ? r >= 5 : r <= 4;
  if (crossed) {
    pushIfOk(board, moves, [r, c], r, c + 1, color);
    pushIfOk(board, moves, [r, c], r, c - 1, color);
  }
}
function generatePseudoMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (!p || p.color !== color) continue;
    if (p.type === 'k') generalMoves(board, r, c, color, moves);
    else if (p.type === 'a') advisorMoves(board, r, c, color, moves);
    else if (p.type === 'e') elephantMoves(board, r, c, color, moves);
    else if (p.type === 'h') horseMoves(board, r, c, color, moves);
    else if (p.type === 'c') chariotMoves(board, r, c, color, moves);
    else if (p.type === 'n') cannonMoves(board, r, c, color, moves);
    else if (p.type === 'p') pawnMoves(board, r, c, color, moves);
  }
  return moves;
}
function isAttacked(board, sq, byColor) {
  const moves = generatePseudoMoves(board, byColor);
  return moves.some(m => m.to[0] === sq[0] && m.to[1] === sq[1]);
}
function isInCheck(board, color) {
  const gp = findGeneral(board, color);
  if (!gp) return true;
  return isAttacked(board, gp, opposite(color));
}
function generalsFacing(board) {
  const rg = findGeneral(board, 'r'), bg = findGeneral(board, 'b');
  if (!rg || !bg || rg[1] !== bg[1]) return false;
  const c = rg[1], r1 = Math.min(rg[0], bg[0]), r2 = Math.max(rg[0], bg[0]);
  for (let r = r1 + 1; r < r2; r++) if (board[r][c]) return false;
  return true;
}
function simulateMoveW(board, move) {
  const nb = cloneBoard(board);
  nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  return nb;
}
function generateLegalMoves(board, color) {
  const pseudo = generatePseudoMoves(board, color);
  return pseudo.filter(m => {
    const nb = simulateMoveW(board, m);
    if (isInCheck(nb, color)) return false;
    if (generalsFacing(nb)) return false;
    return true;
  });
}
const VALUE = { k: 10000, c: 900, h: 400, n: 450, a: 200, e: 200, p: 100 };
function evaluate(board) {
  let score = 0;
  let redA = 0, redE = 0, blackA = 0, blackE = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (!p) continue;
    let v = VALUE[p.type];
    if (p.type === 'p') v += (p.color === 'b' ? (r - 3) : (6 - r)) * 8;
    if ((p.type === 'h' || p.type === 'n') && c >= 2 && c <= 6) v += 6;
    if (p.type === 'c') {
      let open = 0;
      for (let rr = 0; rr < 10; rr++) if (rr !== r && !board[rr][c]) open++;
      v += open * 3;
    }
    if (p.type === 'a') { if (p.color === 'r') redA++; else blackA++; }
    if (p.type === 'e') { if (p.color === 'r') redE++; else blackE++; }
    score += p.color === 'r' ? v : -v;
  }
  score += (redA - 2) * 15 + (redE - 2) * 12;
  score -= (blackA - 2) * 15 + (blackE - 2) * 12;
  const redMob = generatePseudoMoves(board, 'r').length;
  const blackMob = generatePseudoMoves(board, 'b').length;
  score += (redMob - blackMob) * 2;
  return score;
}
function orderMoves(board, moves) {
  return moves.slice().sort((a, b) => {
    const ta = board[a.to[0]][a.to[1]], tb = board[b.to[0]][b.to[1]];
    return (tb ? VALUE[tb.type] : 0) - (ta ? VALUE[ta.type] : 0);
  });
}
function quiescence(board, color, alpha, beta, deadline, qDepth) {
  if (Date.now() > deadline) return (color === 'r' ? 1 : -1) * evaluate(board);
  const stand = (color === 'r' ? 1 : -1) * evaluate(board);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qDepth <= 0) return alpha;
  const caps = generateLegalMoves(board, color).filter(m => board[m.to[0]][m.to[1]]);
  const ordered = orderMoves(board, caps);
  const opp = opposite(color);
  for (const m of ordered) {
    const nb = simulateMoveW(board, m);
    const val = -quiescence(nb, opp, -beta, -alpha, deadline, qDepth - 1);
    if (val >= beta) return beta;
    if (val > alpha) alpha = val;
  }
  return alpha;
}
function negamax(board, color, depth, alpha, beta, deadline) {
  if (Date.now() > deadline) return (color === 'r' ? 1 : -1) * evaluate(board);
  const moves = generateLegalMoves(board, color);
  if (moves.length === 0) return -100000 - depth;
  if (depth === 0) return quiescence(board, color, alpha, beta, deadline, 4);
  const ordered = orderMoves(board, moves);
  const opp = opposite(color);
  let best = -Infinity;
  for (const m of ordered) {
    const nb = simulateMoveW(board, m);
    const val = -negamax(nb, opp, depth - 1, -beta, -alpha, deadline);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function findBestMove(board, color, maxDepth, timeMs, randomFactor) {
  const legal = generateLegalMoves(board, color);
  if (legal.length === 0) return null;
  if (randomFactor > 0 && Math.random() < randomFactor) {
    return legal[Math.floor(Math.random() * legal.length)];
  }
  const deadline = Date.now() + timeMs;
  const opp = opposite(color);
  let bestMove = legal[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() > deadline) break;
    const ordered = orderMoves(board, legal);
    let alpha = -Infinity, beta = Infinity, curBest = ordered[0], curScore = -Infinity, completed = true;
    for (const m of ordered) {
      if (Date.now() > deadline) { completed = false; break; }
      const nb = simulateMoveW(board, m);
      const val = -negamax(nb, opp, depth - 1, -beta, -alpha, deadline);
      if (val > curScore) { curScore = val; curBest = m; }
      if (curScore > alpha) alpha = curScore;
    }
    if (completed) bestMove = curBest;
    else break;
  }
  return bestMove;
}
self.onmessage = (e) => {
  const { board, color, depth, timeMs, randomFactor } = e.data;
  const move = findBestMove(board, color, depth, timeMs, randomFactor || 0);
  self.postMessage({ move });
};
`;

let worker = null;
try {
  const workerBlob = new Blob([WORKER_SRC], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);
  worker = new Worker(workerUrl);
  worker.onmessage = (e) => handleEngineMove(e.data.move);
  worker.onerror = (err) => {
    console.error('Lỗi worker AI:', err);
    statusEl.textContent = '⚠️ Lỗi AI, vui lòng thử lại.';
    waiting = false;
    render();
  };
} catch (e) {
  console.error('Không tạo được worker AI:', e);
}

let moveTimeoutTimer = null;
const MOVE_TIMEOUT_MS = 15000;

function makeEngineMove() {
  if (gameOver || !worker) return;
  const lvl = LEVELS[selectedLevel - 1];
  waiting = true;
  updateStatus();

  worker.postMessage({
    board: cloneBoard(board),
    color: turn,
    depth: lvl.depth,
    timeMs: lvl.timeMs,
    randomFactor: lvl.random
  });

  clearTimeout(moveTimeoutTimer);
  moveTimeoutTimer = setTimeout(() => {
    if (!waiting) return;
    waiting = false;
    statusEl.textContent = '⚠️ AI không phản hồi kịp. Vui lòng thử lại hoặc bắt đầu ván mới.';
    render();
  }, MOVE_TIMEOUT_MS);
}

function handleEngineMove(move) {
  clearTimeout(moveTimeoutTimer);
  if (move) {
    history.push({ board: cloneBoard(board), turn });
    board = simulateMove(board, move);
    lastMove = { from: move.from, to: move.to };
    turn = opposite(turn);
  }
  waiting = false;
  checkGameEnd();
  render();
}

// ==================== TƯƠNG TÁC BÀN CỜ ====================
// Xoay bàn cờ theo màu người chơi: nếu chơi Đen, đảo cả 2 chiều để quân của mình luôn ở dưới.
function displayToBoard(r, c) {
  return playerColor === 'b' ? [9 - r, 8 - c] : [r, c];
}

function render() {
  boardEl.innerHTML = '';
  const riverEl = document.createElement('div');
  riverEl.className = 'xq-river';
  riverEl.innerHTML = '<span>楚 河</span><span>漢 界</span>';
  boardEl.appendChild(riverEl);

  const inCheckNow = !gameOver && isInCheck(board, turn);
  const checkedGeneralSq = inCheckNow ? findGeneral(board, turn) : null;

  for (let dr = 0; dr < 10; dr++) {
    for (let dc = 0; dc < 9; dc++) {
      const [r, c] = displayToBoard(dr, dc);
      const cell = document.createElement('div');
      cell.className = 'xq-point';
      cell.dataset.r = r;
      cell.dataset.c = c;
      // Toạ độ vật lý trên màn hình (không đổi theo hướng nhìn) — dùng để neo các hoạ tiết cố định như dấu X cung tướng
      cell.dataset.dr = dr;
      cell.dataset.dc = dc;

      const isSel = selected && selected[0] === r && selected[1] === c;
      if (isSel) cell.classList.add('selected');
      if (lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c))) cell.classList.add('last-move');
      const isTarget = targets.some(t => t[0] === r && t[1] === c);
      if (isTarget) {
        cell.classList.add('move');
        if (board[r][c]) cell.classList.add('capture');
      }
      if (checkedGeneralSq && checkedGeneralSq[0] === r && checkedGeneralSq[1] === c) cell.classList.add('king-check');

      const p = board[r][c];
      if (p) {
        const span = document.createElement('span');
        span.className = `xq-piece piece-${p.color}`;
        span.textContent = PIECE_LABEL[p.color][p.type];
        cell.appendChild(span);
      }

      cell.addEventListener('click', onPointClick);
      boardEl.appendChild(cell);
    }
  }

  updateStatus();
  updateUndoAvailability();
}

function onPointClick(e) {
  if (waiting || gameOver) return;
  if (turn !== playerColor) return;

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const piece = board[r][c];

  if (selected) {
    if (selected[0] === r && selected[1] === c) {
      selected = null; targets = []; render(); return;
    }
    const isLegal = targets.some(t => t[0] === r && t[1] === c);
    if (isLegal) {
      history.push({ board: cloneBoard(board), turn });
      board = simulateMove(board, { from: selected, to: [r, c] });
      lastMove = { from: selected, to: [r, c] };
      turn = opposite(turn);
      selected = null; targets = [];
      checkGameEnd();
      render();
      if (!gameOver) makeEngineMove();
      return;
    }
    if (piece && piece.color === turn) {
      selectSquare(r, c);
      render();
      return;
    }
    flashInvalid(r, c);
    return;
  }

  if (piece && piece.color === turn) selectSquare(r, c);
  render();
}

function selectSquare(r, c) {
  selected = [r, c];
  const legal = generateLegalMoves(board, turn);
  targets = legal.filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
}

function flashInvalid(r, c) {
  const cellEl = boardEl.querySelector(`.xq-point[data-r="${r}"][data-c="${c}"]`);
  if (!cellEl) return;
  cellEl.classList.remove('invalid');
  void cellEl.offsetWidth;
  cellEl.classList.add('invalid');
  setTimeout(() => cellEl.classList.remove('invalid'), 400);
}

function checkGameEnd() {
  if (isGameOver(board, turn)) {
    gameOver = true;
    const playerWon = turn !== playerColor;
    settlePayout(playerWon ? 'win' : 'lose');
  }
}

function updateStatus() {
  bcStatusEl.classList.remove('thinking', 'result-win', 'result-lose', 'result-draw', 'in-check');
  xqProfitEl.classList.remove('positive', 'negative', 'zero');
  sidePlayerEl.classList.remove('active-turn');
  sideMachineEl.classList.remove('active-turn');
  bcStatusEl.classList.toggle('in-progress', !gameOver);

  if (!gameOver) {
    if (turn === playerColor) sidePlayerEl.classList.add('active-turn');
    else sideMachineEl.classList.add('active-turn');
    if (isInCheck(board, turn)) bcStatusEl.classList.add('in-check');
  }

  if (gameOver) {
    const playerWon = turn !== playerColor;
    statusEl.textContent = `Chiếu bí / hết nước đi. ${playerWon ? 'Bạn' : 'Máy'} thắng.`;
    xqScoreEl.textContent = playerWon ? 'WIN' : 'LOSE';
    xqScoreSubEl.textContent = 'Ván đấu kết thúc';
    bcStatusEl.classList.add(playerWon ? 'result-win' : 'result-lose');
  } else {
    const inCheck = isInCheck(board, turn);
    xqScoreEl.textContent = inCheck ? 'CHIẾU TƯỚNG' : '';
    xqProfitEl.textContent = '+0'; xqProfitEl.classList.add('zero');
    if (waiting) {
      statusEl.textContent = inCheck ? 'Máy đang bị chiếu, đang suy nghĩ...' : 'Máy đang suy nghĩ...';
      xqScoreSubEl.textContent = 'Máy đang đi';
    } else if (inCheck) {
      statusEl.textContent = 'Đang bị chiếu tướng.';
      xqScoreSubEl.textContent = 'Đang bị chiếu!';
    } else {
      statusEl.textContent = `Lượt đi: ${turn === 'r' ? 'Đỏ' : 'Đen'}`;
      xqScoreSubEl.textContent = 'Lượt đi';
    }
    if (waiting) bcStatusEl.classList.add('thinking');
  }
}

async function settlePayout(result) {
  if (payoutSettled) return;
  payoutSettled = true;
  let delta = 0;
  if (result === 'win') delta = currentBet;
  else if (result === 'loss') delta = -currentBet;

  let buffBonus = 0, buffPct = 0, activePet = null;
  if (result === 'win') {
    try {
      const info = await getActivePetInfo();
      buffPct = info.buff;
      activePet = info.pet;
      if (buffPct > 0) buffBonus = Math.round(delta * buffPct / 100);
    } catch {}
  }

  if (delta !== 0) {
    try {
      const reason = result === 'win' ? 'Thắng Cờ Tướng' : 'Thua Cờ Tướng';
      await addPoints('Casino', reason, delta + buffBonus, false);
      if (buffBonus > 0) {
        const petLabel = activePet ? `${activePet.emoji} ${activePet.name}` : '🐾 Pet';
        window.showToast(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
      }
    } catch (e) {
      console.error(e);
      window.showToast('Lỗi cộng điểm: ' + e.message, 'error');
    }
  }
  const net = delta + buffBonus;
  xqProfitEl.classList.remove('positive', 'negative', 'zero');
  if (net > 0) { xqProfitEl.textContent = `+${net.toLocaleString('vi-VN')}`; xqProfitEl.classList.add('positive'); }
  else if (net < 0) { xqProfitEl.textContent = `${net.toLocaleString('vi-VN')}`; xqProfitEl.classList.add('negative'); }
  else { xqProfitEl.textContent = 'Huề'; xqProfitEl.classList.add('zero'); }
}

// --- UNDO: lùi 2 nước (máy + người) để trả lại đúng lượt cho người chơi ---
function updateUndoAvailability() {
  undoBtn.disabled = waiting || gameOver || history.length < 2;
}
function undoMove() {
  if (waiting || history.length < 2) return;
  history.pop(); // lùi nước của máy
  const snap = history.pop(); // lùi nước của người chơi
  board = snap.board; turn = snap.turn;
  const last = history[history.length - 1];
  lastMove = null;
  selected = null; targets = []; waiting = false; gameOver = false;
  render();
}
undoBtn.addEventListener('click', undoMove);
resetBtn.addEventListener('click', backToSetup);

buildLevelStrip();
