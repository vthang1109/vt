// ============================================================
//  sudoku.js — Game Sudoku cho VTWorld
//  Chế độ: Dễ / Trung bình / Khó
//  Hệ thống: Mạng sống, gợi ý, ghi nháp, điểm + xu
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, updateMission, getPoints } from './points.js';
import {
  getFirestore, doc, getDoc, updateDoc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
//  FIREBASE INIT
// ============================================================
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
const db   = getFirestore(app);

// ============================================================
//  CONFIG
// ============================================================
const DIFF_CONFIG = {
  easy:   { label: 'De',         blanks: 35, pts: 60,  coins: 15, timeBonus: 300 },
  medium: { label: 'Trung binh', blanks: 45, pts: 100, coins: 25, timeBonus: 500 },
  hard:   { label: 'Kho',        blanks: 52, pts: 150, coins: 40, timeBonus: 800 },
};
const HINTS_MAX = 3;
const LIVES_MAX = 3;

// ============================================================
//  PARTICLE CANVAS
// ============================================================
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let parts = [];
function resizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
resizeBg();
window.addEventListener('resize', resizeBg);
for (let i = 0; i < 40; i++) {
  parts.push({
    x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height,
    vx: (Math.random() - 0.5) * 0.4,  vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 1.5 + 0.5
  });
}
(function drawBg() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  parts.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = bgCanvas.width;  if (p.x > bgCanvas.width)  p.x = 0;
    if (p.y < 0) p.y = bgCanvas.height; if (p.y > bgCanvas.height) p.y = 0;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = 'rgba(56,189,248,0.5)'; bgCtx.fill();
  });
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const dx = parts[i].x - parts[j].x, dy = parts[i].y - parts[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 100) {
        bgCtx.beginPath();
        bgCtx.moveTo(parts[i].x, parts[i].y);
        bgCtx.lineTo(parts[j].x, parts[j].y);
        bgCtx.strokeStyle = `rgba(56,189,248,${0.07 * (1 - d / 100)})`;
        bgCtx.lineWidth = 0.5; bgCtx.stroke();
      }
    }
  }
  requestAnimationFrame(drawBg);
})();

// ============================================================
//  GAME STATE
// ============================================================
let solution   = [];
let puzzle     = [];
let userBoard  = [];
let notes      = [];
let givenCells = [];

let difficulty  = 'easy';
let selectedRow = -1;
let selectedCol = -1;
let lives       = LIVES_MAX;
let hintsLeft   = HINTS_MAX;
let noteMode    = false;
let timerSec    = 0;
let timerInterval = null;
let gameOver    = false;
let filledCells = 0;
let givenCount  = 0;

// ============================================================
//  SUDOKU GENERATOR — Fast, no uniqueness check (symmetry removal)
// ============================================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(grid, r, c, num) {
  for (let i = 0; i < 9; i++) {
    if (grid[r][i] === num) return false;
    if (grid[i][c] === num) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      if (grid[br + dr][bc + dc] === num) return false;
  return true;
}

function solveSudoku(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const num of nums) {
        if (isValid(grid, r, c, num)) {
          grid[r][c] = num;
          if (solveSudoku(grid)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

function generateSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(grid);
  return grid;
}

// Tạo puzzle bằng cách xóa ô đối xứng — nhanh, không cần check unique
function createPuzzle(sol, blanks) {
  const puz = sol.map(r => [...r]);
  const positions = shuffle([...Array(41)].map((_, i) => i)); // 0..40, pair (i, 80-i)
  let removed = 0;
  for (const pos of positions) {
    if (removed >= blanks) break;
    const r1 = Math.floor(pos / 9), c1 = pos % 9;
    const r2 = 8 - r1, c2 = 8 - c1;
    puz[r1][c1] = 0;
    removed++;
    if (removed < blanks && !(r1 === r2 && c1 === c2)) {
      puz[r2][c2] = 0;
      removed++;
    }
  }
  return puz;
}

// ============================================================
//  SCREEN NAV
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.sdk-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

window.goToDiffSelect = function() {
  stopTimer();
  showScreen('screen-diff');
  document.getElementById('result-modal').classList.add('hidden');
  loadStats();
};

// ============================================================
//  START GAME
// ============================================================
window.startGame = function(diff) {
  difficulty  = diff;
  const cfg   = DIFF_CONFIG[diff];
  lives       = LIVES_MAX;
  hintsLeft   = HINTS_MAX;
  noteMode    = false;
  gameOver    = false;
  selectedRow = -1;
  selectedCol = -1;
  timerSec    = 0;
  filledCells = 0;

  solution   = generateSolution();
  puzzle     = createPuzzle(solution, cfg.blanks);
  userBoard  = puzzle.map(r => [...r]);
  notes      = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  givenCells = puzzle.map(r => r.map(v => v !== 0));
  givenCount = puzzle.flat().filter(v => v !== 0).length;
  filledCells = givenCount;

  showScreen('screen-game');
  updateDiffBadge(diff);
  updateLivesUI();
  updateProgress();
  updateHintBtn();
  updateNoteBtn();
  renderBoard();
  stopTimer();
  startTimer();
};

window.restartSame = function() {
  document.getElementById('result-modal').classList.add('hidden');
  startGame(difficulty);
};

// ============================================================
//  BOARD RENDER
// ============================================================
function renderBoard() {
  const table = document.getElementById('sdk-board');
  table.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 9; c++) {
      const td = document.createElement('td');
      if (c === 2 || c === 5) td.classList.add('box-right');
      if (r === 2 || r === 5) td.classList.add('box-bottom');

      if (givenCells[r][c]) {
        td.classList.add('given');
        td.textContent = puzzle[r][c];
      } else {
        const val = userBoard[r][c];
        const noteSet = notes[r][c];
        if (noteSet.size > 0 && val === 0) {
          renderNoteContent(td, noteSet);
        } else if (val !== 0) {
          td.textContent = val;
          td.classList.add(val === solution[r][c] ? 'correct' : 'error');
        }
      }

      td.dataset.r = r;
      td.dataset.c = c;
      td.addEventListener('click', () => selectCell(r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  highlightRelated();
}

function renderNoteContent(td, noteSet) {
  const grid = document.createElement('div');
  grid.className = 'notes-grid';
  for (let n = 1; n <= 9; n++) {
    const span = document.createElement('span');
    span.className = 'note-num' + (noteSet.has(n) ? '' : ' empty');
    span.textContent = noteSet.has(n) ? n : '';
    grid.appendChild(span);
  }
  td.appendChild(grid);
}

// ============================================================
//  CELL SELECTION & HIGHLIGHT
// ============================================================
function selectCell(r, c) {
  selectedRow = r;
  selectedCol = c;
  highlightRelated();
}

function highlightRelated() {
  document.querySelectorAll('.sdk-board td').forEach(td => {
    td.classList.remove('selected', 'highlight', 'same-num');
  });
  if (selectedRow < 0) return;

  const selVal = userBoard[selectedRow][selectedCol] || puzzle[selectedRow][selectedCol];

  document.querySelectorAll('.sdk-board td').forEach(td => {
    const r = +td.dataset.r, c = +td.dataset.c;
    const sameBox = Math.floor(r / 3) === Math.floor(selectedRow / 3) &&
                    Math.floor(c / 3) === Math.floor(selectedCol / 3);

    if (r === selectedRow && c === selectedCol) {
      td.classList.add('selected');
    } else if (r === selectedRow || c === selectedCol || sameBox) {
      td.classList.add('highlight');
    }
    if (selVal !== 0) {
      const cellVal = userBoard[r][c] || puzzle[r][c];
      if (cellVal === selVal && !(r === selectedRow && c === selectedCol)) {
        td.classList.add('same-num');
      }
    }
  });
}

// ============================================================
//  INPUT NUMBER
// ============================================================
window.inputNum = function(num) {
  if (gameOver) return;
  if (selectedRow < 0) { showToast('Chon mot o truoc nhe! 👆'); return; }
  if (givenCells[selectedRow][selectedCol]) return;

  const r = selectedRow, c = selectedCol;

  if (noteMode && num !== 0) {
    if (notes[r][c].has(num)) notes[r][c].delete(num);
    else notes[r][c].add(num);
    renderCell(r, c);
    return;
  }

  if (num === 0) {
    userBoard[r][c] = 0;
    notes[r][c].clear();
    renderCell(r, c);
    recountFilled();
    updateProgress();
    return;
  }

  clearRelatedNotes(r, c, num);
  const wasEmpty = userBoard[r][c] === 0;
  const wasWrong = userBoard[r][c] !== 0 && userBoard[r][c] !== solution[r][c];
  userBoard[r][c] = num;
  notes[r][c].clear();

  if (num !== solution[r][c]) {
    lives--;
    updateLivesUI();
    renderCell(r, c);
    highlightRelated();
    if (lives <= 0) {
      setTimeout(handleLose, 400);
    } else {
      showToastError('❌ Sai roi! Con ' + lives + ' mang');
    }
  } else {
    if (wasEmpty || wasWrong) filledCells++;
    renderCell(r, c);
    highlightRelated();
    updateProgress();
    if (filledCells >= 81) setTimeout(handleWin, 300);
  }
};

function recountFilled() {
  filledCells = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (userBoard[r][c] !== 0) filledCells++;
}

function clearRelatedNotes(r, c, num) {
  for (let i = 0; i < 9; i++) {
    notes[r][i].delete(num);
    notes[i][c].delete(num);
    const br = 3 * Math.floor(r / 3) + Math.floor(i / 3);
    const bc = 3 * Math.floor(c / 3) + i % 3;
    notes[br][bc].delete(num);
  }
}

function renderCell(r, c) {
  const td = document.querySelector('#sdk-board td[data-r="' + r + '"][data-c="' + c + '"]');
  if (!td) return;
  td.className = '';
  if (c === 2 || c === 5) td.classList.add('box-right');
  if (r === 2 || r === 5) td.classList.add('box-bottom');
  if (r === selectedRow && c === selectedCol) td.classList.add('selected');

  const val = userBoard[r][c];
  const noteSet = notes[r][c];
  td.textContent = '';
  td.innerHTML = '';

  if (noteSet.size > 0 && val === 0) {
    renderNoteContent(td, noteSet);
  } else if (val !== 0) {
    td.textContent = val;
    td.classList.add(val === solution[r][c] ? 'correct' : 'error');
  }
}

// ============================================================
//  HINT
// ============================================================
window.useHint = function() {
  if (gameOver || hintsLeft <= 0) return;
  if (selectedRow < 0) { showToast('Chon o muon goi y! 💡'); return; }
  const r = selectedRow, c = selectedCol;
  if (givenCells[r][c]) { showToast('O nay da co san roi!'); return; }
  if (userBoard[r][c] === solution[r][c]) { showToast('O nay da dung roi! ✅'); return; }

  const wasEmpty = userBoard[r][c] === 0;
  hintsLeft--;
  userBoard[r][c] = solution[r][c];
  notes[r][c].clear();
  if (wasEmpty) filledCells++;

  const td = document.querySelector('#sdk-board td[data-r="' + r + '"][data-c="' + c + '"]');
  if (td) {
    td.innerHTML = '';
    td.textContent = solution[r][c];
    td.className = 'hint-cell';
    if (c === 2 || c === 5) td.classList.add('box-right');
    if (r === 2 || r === 5) td.classList.add('box-bottom');
  }
  updateHintBtn();
  updateProgress();
  showToast('💡 Goi y: o nay la ' + solution[r][c]);
  if (filledCells >= 81) setTimeout(handleWin, 300);
};

// ============================================================
//  NOTE MODE
// ============================================================
window.toggleNoteMode = function() {
  noteMode = !noteMode;
  updateNoteBtn();
  showToast(noteMode ? '✏️ Ghi nhap BAT' : '✏️ Ghi nhap TAT');
};

function updateNoteBtn() {
  const btn = document.getElementById('note-btn');
  if (btn) btn.classList.toggle('active', noteMode);
}

function updateHintBtn() {
  const btn = document.getElementById('hint-btn');
  if (!btn) return;
  btn.textContent = '💡 ' + hintsLeft;
  btn.disabled = hintsLeft <= 0;
}

// ============================================================
//  TIMER
// ============================================================
function startTimer() {
  timerInterval = setInterval(() => {
    timerSec++;
    const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
    const s = String(timerSec % 60).padStart(2, '0');
    const el = document.getElementById('sdk-timer');
    if (el) {
      el.textContent = m + ':' + s;
      el.classList.toggle('warning', timerSec > DIFF_CONFIG[difficulty].timeBonus);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ============================================================
//  UI HELPERS
// ============================================================
function updateLivesUI() {
  for (let i = 1; i <= LIVES_MAX; i++) {
    const el = document.getElementById('life' + i);
    if (el) el.classList.toggle('dead', i > lives);
  }
}

function updateProgress() {
  const blanks = 81 - givenCount;
  const done   = Math.max(0, filledCells - givenCount);
  const pct    = blanks > 0 ? Math.round((done / blanks) * 100) : 100;
  const bar    = document.getElementById('sdk-progress');
  if (bar) bar.style.width = Math.min(100, pct) + '%';
}

function updateDiffBadge(diff) {
  const el = document.getElementById('diff-badge');
  if (!el) return;
  const labels = { easy: 'De', medium: 'Trung binh', hard: 'Kho' };
  el.textContent = labels[diff] || diff;
  el.className   = 'sdk-badge ' + diff;
}

// ============================================================
//  WIN / LOSE
// ============================================================
async function handleWin() {
  if (gameOver) return;
  gameOver = true;
  stopTimer();

  const cfg = DIFF_CONFIG[difficulty];
  let pts   = cfg.pts;
  let coins = cfg.coins;
  if (timerSec < cfg.timeBonus) { pts += 20; coins += 5; }
  pts   += lives * 10;
  coins += lives * 3;

  try {
    await addPoints('Sudoku', 'Thang (' + cfg.label + ')', pts);
    await addCoins(coins);
    await updateMission('win1');
    await updateMission('win3');
    await updateMission('win5');
    await updateMission('play3');
    await saveSudokuStats(true);
    refreshNavBar();
  } catch(e) { console.error(e); }

  const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
  const s = String(timerSec % 60).padStart(2, '0');
  document.getElementById('result-emoji').textContent = '🏆';
  document.getElementById('result-title').textContent = 'Hoan thanh!';
  document.getElementById('result-time').textContent  = '⏱️ Thoi gian: ' + m + ':' + s;
  document.getElementById('result-rewards').innerHTML =
    '<div class="rwd-item"><span class="rwd-val pts">+' + pts + '</span><span class="rwd-lbl">Diem</span></div>' +
    '<div class="rwd-item"><span class="rwd-val coins">+' + coins + ' 🪙</span><span class="rwd-lbl">Xu</span></div>';
  document.getElementById('result-modal').classList.remove('hidden');
  spawnCoinPop('+' + coins + ' 🪙');
}

async function handleLose() {
  if (gameOver) return;
  gameOver = true;
  stopTimer();
  try { await updateMission('play3'); await saveSudokuStats(false); } catch(e) {}
  document.getElementById('result-emoji').textContent = '💔';
  document.getElementById('result-title').textContent = 'Het mang!';
  document.getElementById('result-time').textContent  = 'Co gang lan sau nhe 😤';
  document.getElementById('result-rewards').innerHTML = '';
  document.getElementById('result-modal').classList.remove('hidden');
}

// ============================================================
//  FIRESTORE — Xu + Stats
// ============================================================
async function addCoins(amount) {
  const user = auth.currentUser;
  if (!user || amount <= 0) return;
  const ref = doc(db, 'users', user.uid);
  try { await updateDoc(ref, { coins: increment(amount) }); }
  catch(e) { await setDoc(ref, { coins: amount }, { merge: true }); }
}

async function getCoins() {
  const user = auth.currentUser;
  if (!user) return 0;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? (snap.data().coins || 0) : 0;
}

async function saveSudokuStats(won) {
  const user = auth.currentUser;
  if (!user) return;
  const ref = doc(db, 'users', user.uid);
  const upd = { 'sudoku.played': increment(1) };
  if (won) upd['sudoku.won'] = increment(1);
  try { await updateDoc(ref, upd); }
  catch(e) { await setDoc(ref, { sudoku: { played: 1, won: won ? 1 : 0 } }, { merge: true }); }
}

async function loadStats() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const snap  = await getDoc(doc(db, 'users', user.uid));
    const data  = snap.exists() ? snap.data() : {};
    const sdk   = data.sudoku || {};
    const coins = data.coins  || 0;
    document.getElementById('stat-played').textContent = sdk.played || 0;
    document.getElementById('stat-won').textContent    = sdk.won    || 0;
    document.getElementById('stat-coins').textContent  = coins + ' 🪙';
  } catch(e) {}
}

async function refreshNavBar() {
  try {
    const pts   = await getPoints();
    const coins = await getCoins();
    const navPts   = document.getElementById('nav-pts');
    const navCoins = document.getElementById('nav-coins');
    if (navPts)   navPts.textContent   = '⭐ ' + pts.toLocaleString();
    if (navCoins) navCoins.textContent = '🪙 ' + coins.toLocaleString();
  } catch(e) {}
}

// ============================================================
//  COIN POP
// ============================================================
function spawnCoinPop(text) {
  const el = document.createElement('div');
  el.className = 'coin-pop';
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);' +
    'font-family:Orbitron,monospace;font-size:20px;font-weight:900;color:#fbbf24;' +
    'pointer-events:non