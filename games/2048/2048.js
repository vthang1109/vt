/**
 * 2048.js — VTWorld 2048 Game
 * Modes: classic (4×4, win at 2048), time (4×4, 90s), endless (5×5)
 * Integrates: Firebase auth, points, pet buff, shared nav/status bar
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

const firebaseConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================
// THEME COLORS for tiles
// ============================
const TILE_COLORS = {
  0:    { bg: 'rgba(255,255,255,0.06)', color: 'transparent' },
  2:    { bg: '#fde68a', color: '#78350f' },
  4:    { bg: '#fcd34d', color: '#78350f' },
  8:    { bg: '#fb923c', color: '#fff' },
  16:   { bg: '#f97316', color: '#fff' },
  32:   { bg: '#ef4444', color: '#fff' },
  64:   { bg: '#dc2626', color: '#fff' },
  128:  { bg: '#a78bfa', color: '#fff' },
  256:  { bg: '#8b5cf6', color: '#fff' },
  512:  { bg: '#7c3aed', color: '#fff' },
  1024: { bg: '#f472b6', color: '#fff' },
  2048: { bg: '#ec4899', color: '#fff' },
  4096: { bg: '#f59e0b', color: '#fff' },
  8192: { bg: '#d97706', color: '#fff' },
};

const TILE_EMOJIS = {
  2048: '🌟',
  4096: '💎',
  8192: '🔥',
};

// ============================
// MODE CONFIG
// ============================
const MODE_CFG = {
  classic: { rows: 4, cols: 4, target: 2048, basePts: 50, winPts: 200 },
  time:    { rows: 4, cols: 4, target: null,  basePts: 30, duration: 90, bonusPts: 100 },
  endless: { rows: 5, cols: 5, target: null,  basePts: 40, bonusPts: 200 },
};

const MODE_LABELS = { classic: 'Kinh điển', time: 'Tính giờ', endless: 'Vô tận' };

// ============================
// GAME
// ============================
const G2048 = {
  mode: 'classic',
  cfg: null,
  grid: [],        // 2D array
  size: 4,
  score: 0,
  highScore: 0,
  state: 'menu',   // menu | playing | won | lost | paused
  won: false,

  // Timer (time mode)
  timeLeft: 0,
  timerInterval: null,

  // History for undo
  history: [],

  // Animations
  animTiles: [],

  // Touch/swipe
  touchStartX: 0,
  touchStartY: 0,
  touchMoved: false,

  // UI refs
  boardEl: null,
  scoreEl: null,
  bestEl: null,
  subEl: null,
  profitEl: null,
  statusEl: null,
  statusBarEl: null,

  // ===== INIT =====
  init() {
    this.boardEl = document.getElementById('g2048-board');
    this.scoreEl = document.getElementById('g2048-score');
    this.bestEl = document.getElementById('g2048-best');
    this.subEl = document.getElementById('g2048-sub');
    this.profitEl = document.getElementById('g2048-profit');
    this.statusEl = document.getElementById('g2048-status');
    this.statusBarEl = document.getElementById('bc-status');

    if (!this.boardEl) {
      console.error('Missing #g2048-board');
      return;
    }

    // Load high scores
    this.loadHighScores();

    // TopNav leave action
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => {
        this.stopTimer();
        window.location.href = '../../games.html';
      });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      const keyMap = {
        'ArrowUp': 'up', 'ArrowDown': 'down',
        'ArrowLeft': 'left', 'ArrowRight': 'right',
        'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
      };
      const dir = keyMap[e.key];
      if (dir) { e.preventDefault(); this.move(dir); }
      if (e.key === 'Enter' && this.state === 'won') this.continueAfterWin();
    });

    // Touch/swipe on board
    this.setupTouch();

    this.showMenu();
  },

  setupTouch() {
    const board = this.boardEl;
    board.addEventListener('touchstart', (e) => {
      if (this.state !== 'playing') return;
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchMoved = false;
    }, { passive: true });

    board.addEventListener('touchmove', (e) => {
      if (this.state !== 'playing') return;
      this.touchMoved = true;
    }, { passive: true });

    board.addEventListener('touchend', (e) => {
      if (this.state !== 'playing' || !this.touchMoved) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (Math.max(absDx, absDy) < 20) return;

      if (absDx > absDy) {
        this.move(dx > 0 ? 'right' : 'left');
      } else {
        this.move(dy > 0 ? 'down' : 'up');
      }
    }, { passive: true });

    // Mouse drag
    let mouseDown = false, mx = 0, my = 0;
    board.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      mouseDown = true;
      mx = e.clientX;
      my = e.clientY;
    });
    document.addEventListener('mousemove', (e) => {
      if (mouseDown) this.touchMoved = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (!mouseDown || !this.touchMoved) { mouseDown = false; return; }
      mouseDown = false;
      if (this.state !== 'playing') return;
      const dx = e.clientX - mx;
      const dy = e.clientY - my;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.move(dx > 0 ? 'right' : 'left');
      } else {
        this.move(dy > 0 ? 'down' : 'up');
      }
      this.touchMoved = false;
    });
  },

  // ===== HIGH SCORES =====
  loadHighScores() {
    try {
      const data = JSON.parse(localStorage.getItem('g2048_highscores') || '{}');
      this.highScore = data[this.mode] || 0;
    } catch {
      this.highScore = 0;
    }
  },

  saveHighScore() {
    try {
      const data = JSON.parse(localStorage.getItem('g2048_highscores') || '{}');
      const key = this.mode;
      data[key] = Math.max(data[key] || 0, this.score);
      localStorage.setItem('g2048_highscores', JSON.stringify(data));
      this.highScore = data[key];
    } catch {}
  },

  updateHighScoreDisplay() {
    if (this.bestEl) this.bestEl.textContent = '🏆 ' + this.highScore;
  },

  // ===== SCREENS =====
  showScreen(id) {
    document.querySelectorAll('.g2048-screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
      target.style.display = 'flex';
      setTimeout(() => target.classList.add('active'), 10);
    }
  },

  showMenu() {
    this.stopTimer();
    this.state = 'menu';
    this.showScreen('screen-menu');
    if (this.statusBarEl) this.statusBarEl.style.display = 'none';
  },

  // ===== START GAME =====
  start(mode) {
    this.mode = mode;
    this.cfg = MODE_CFG[mode];
    this.size = this.cfg.rows;
    this.score = 0;
    this.won = false;
    this.history = [];
    this.animTiles = [];

    this.loadHighScores();

    // Init empty grid
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.size; c++) {
        this.grid[r][c] = 0;
      }
    }

    // Add 2 random tiles
    this.addRandomTile();
    this.addRandomTile();

    // Show status bar
    if (this.statusBarEl) {
      this.statusBarEl.style.display = '';
      this.statusBarEl.classList.remove('result-win', 'result-lose');
    }

    this.updateHighScoreDisplay();
    this.renderBoard();
    this.updateScoreDisplay();

    // Setup for time mode
    if (mode === 'time') {
      this.timeLeft = this.cfg.duration;
      this.updateTimerDisplay();
      this.startTimer();
    }

    this.showScreen('screen-game');

    // Board size
    this.boardEl.dataset.size = this.size;

    this.state = 'playing';
    this.setStatus(`${MODE_LABELS[mode]} — Trượt để chơi`);
    this.subEl.textContent = 'Đang chơi';
    if (this.profitEl) {
      this.profitEl.textContent = mode === 'time' ? `${this.timeLeft}s` : '+0';
      this.profitEl.className = 'stat-profit zero';
    }

    // Flash undo hint
    const undoBtn = document.getElementById('g2048-undo-btn');
    if (undoBtn) undoBtn.style.display = 'inline-flex';
  },

  // ===== TIMER (time mode) =====
  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      if (this.timeLeft <= 0) {
        this.endGame();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateTimerDisplay() {
    if (this.mode === 'time' && this.profitEl) {
      this.profitEl.textContent = `${this.timeLeft}s`;
    }
  },

  // ========== CORE GAME LOGIC ==========

  // Add a random tile (90% chance 2, 10% chance 4)
  addRandomTile() {
    const empty = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) empty.push({ r, c });
      }
    }
    if (empty.length === 0) return null;
    const pos = empty[Math.floor(Math.random() * empty.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    this.grid[pos.r][pos.c] = val;
    return pos;
  },

  // Slide and merge a single row/col array
  slideLine(line) {
    // Filter out zeros
    let cells = line.filter(v => v !== 0);
    let merged = [];
    let mergedIdx = new Set();
    let scoreGained = 0;

    for (let i = 0; i < cells.length; i++) {
      if (i + 1 < cells.length && cells[i] === cells[i + 1] && !mergedIdx.has(i) && !mergedIdx.has(i + 1)) {
        const val = cells[i] * 2;
        merged.push(val);
        mergedIdx.add(i);
        mergedIdx.add(i + 1);
        scoreGained += val;
      } else if (!mergedIdx.has(i)) {
        merged.push(cells[i]);
      }
    }

    // Pad with zeros
    while (merged.length < this.size) merged.push(0);
    return { result: merged, scoreGained, moved: line.join(',') !== merged.join(',') };
  },

  // Extract a column as array
  getCol(col) {
    const arr = [];
    for (let r = 0; r < this.size; r++) arr.push(this.grid[r][col]);
    return arr;
  },

  setCol(col, arr) {
    for (let r = 0; r < this.size; r++) this.grid[r][col] = arr[r];
  },

  // Main move function
  move(direction) {
    if (this.state !== 'playing') return;
    // Moves work fine even after winning — the won flag just prevents repeated toast

    // Save state for undo
    const prevGrid = this.grid.map(row => [...row]);
    const prevScore = this.score;

    let moved = false;
    let totalScoreGained = 0;

    if (direction === 'left') {
      for (let r = 0; r < this.size; r++) {
        const { result, scoreGained, moved: m } = this.slideLine(this.grid[r]);
        this.grid[r] = result;
        totalScoreGained += scoreGained;
        if (m) moved = true;
      }
    } else if (direction === 'right') {
      for (let r = 0; r < this.size; r++) {
        const rev = [...this.grid[r]].reverse();
        const { result, scoreGained, moved: m } = this.slideLine(rev);
        this.grid[r] = result.reverse();
        totalScoreGained += scoreGained;
        if (m) moved = true;
      }
    } else if (direction === 'up') {
      for (let c = 0; c < this.size; c++) {
        const { result, scoreGained, moved: m } = this.slideLine(this.getCol(c));
        this.setCol(c, result);
        totalScoreGained += scoreGained;
        if (m) moved = true;
      }
    } else if (direction === 'down') {
      for (let c = 0; c < this.size; c++) {
        const col = this.getCol(c).reverse();
        const { result, scoreGained, moved: m } = this.slideLine(col);
        this.setCol(c, result.reverse());
        totalScoreGained += scoreGained;
        if (m) moved = true;
      }
    }

    if (!moved) {
      this.setStatus('Không thể trượt hướng đó!');
      this.shakeBoard();
      return;
    }

    // Save undo state
    this.history.push({ grid: prevGrid, score: prevScore });
    if (this.history.length > 20) this.history.shift(); // limit

    this.score += totalScoreGained;
    this.updateScoreDisplay();
    this.saveHighScore();

    // Add new tile
    const newPos = this.addRandomTile();
    this.renderBoard(newPos);

    // Animate score popup
    if (totalScoreGained > 0) {
      this.showScorePopup(totalScoreGained);
    }

    // Check win (classic mode)
    if (this.mode === 'classic' && !this.won && this.hasTile(this.cfg.target)) {
      this.won = true;
      this.setStatus('🎉 Bạn đã đạt 2048! Tiếp tục để ghi thêm điểm!');
      window.showToast('Chúc mừng! Đã đạt 2048!', 'success');
    }

    // Check game over (no moves left)
    if (!this.canMove()) {
      this.endGame();
      return;
    }

    this.setStatus(direction === 'up' ? '⬆️' : direction === 'down' ? '⬇️' : direction === 'left' ? '⬅️' : '➡️');
  },

  // ===== UNDO =====
  undo() {
    if (this.history.length === 0 || this.state === 'menu') return;
    const prev = this.history.pop();
    this.grid = prev.grid;
    this.score = prev.score;
    this.renderBoard();
    this.updateScoreDisplay();
    this.setStatus('↩️ Đã hoàn tác');
  },

  // ===== CHECKS =====
  hasTile(val) {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === val) return true;
      }
    }
    return false;
  },

  canMove() {
    // Check for empty cells
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) return true;
      }
    }
    // Check for adjacent equal tiles
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c];
        if (c + 1 < this.size && this.grid[r][c + 1] === val) return true;
        if (r + 1 < this.size && this.grid[r + 1][c] === val) return true;
      }
    }
    return false;
  },

  continueAfterWin() {
    if (!this.won) return;
    this.won = false;
    this.setStatus('Tiếp tục!');
  },

  // ========== RENDER ==========
  renderBoard(newTilePos) {
    this.boardEl.innerHTML = '';
    this.boardEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c];
        const cell = document.createElement('div');
        cell.className = 'g2048-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (val > 0) {
          cell.classList.add('has-value');
          const colors = TILE_COLORS[val] || TILE_COLORS[0];
          cell.style.background = colors.bg;
          cell.style.color = colors.color;

          const tileText = document.createElement('span');
          tileText.className = 'g2048-tile-text';
          tileText.textContent = val >= 1000 ? (TILE_EMOJIS[val] || val.toLocaleString()) : val;

          // Font size based on digits
          const digits = String(val).length;
          if (digits >= 4) tileText.style.fontSize = '16px';
          else if (digits >= 3) tileText.style.fontSize = '20px';

          cell.appendChild(tileText);

          // New tile animation
          if (newTilePos && newTilePos.r === r && newTilePos.c === c) {
            cell.classList.add('new-tile');
          }

          // Check if this is a merged/high value
          if (val >= 128) cell.classList.add('super-tile');
          if (val >= 2048) cell.classList.add('legendary-tile');
        } else {
          cell.classList.add('empty');
        }

        this.boardEl.appendChild(cell);
      }
    }
  },

  updateScoreDisplay() {
    this.scoreEl.textContent = this.score;
    this.updateHighScoreDisplay();
  },

  // ===== UI HELPERS =====
  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  },

  shakeBoard() {
    this.boardEl.classList.remove('shake');
    void this.boardEl.offsetWidth;
    this.boardEl.classList.add('shake');
    setTimeout(() => this.boardEl.classList.remove('shake'), 400);
  },

  showScorePopup(pts) {
    const popup = document.createElement('div');
    popup.className = 'g2048-score-popup';
    popup.textContent = `+${pts}`;
    this.boardEl.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
  },

  // ===== GAME OVER =====
  async endGame() {
    if (this.state === 'over' || this.state === 'menu') return;
    this.state = 'over';
    this.stopTimer();

    // Calculate points
    const cfg = this.cfg;
    let pts = 0;

    if (this.mode === 'classic') {
      // Base points + score / 10
      pts = cfg.basePts + Math.floor(this.score / 10);
      if (this.won || this.hasTile(2048) || this.score >= 2048) {
        pts += cfg.winPts;
      }
    } else if (this.mode === 'time') {
      pts = cfg.basePts + Math.floor(this.score / 8);
      if (this.score >= 500) pts += cfg.bonusPts;
    } else {
      pts = cfg.basePts + Math.floor(this.score / 12);
      if (this.score >= 1000) pts += cfg.bonusPts;
    }

    pts = Math.min(pts, 2000); // Cap

    // Fetch pet buff
    let buffBonus = 0, buffPct = 0, petLabel = '';
    let totalPts = pts;
    if (auth.currentUser && pts > 0) {
      try {
        const petInfo = await getActivePetInfo();
        buffPct = petInfo.buff || 0;
        petLabel = petInfo.pet ? (petInfo.pet.emoji + ' ' + petInfo.pet.name) : '';
        if (buffPct > 0) {
          buffBonus = Math.round(pts * buffPct / 100);
          totalPts += buffBonus;
        }
      } catch {}
    }

    const won = this.mode === 'classic' ? (this.hasTile(2048) || this.won) : this.score > 0;

    this.showResult(
      won ? '🏆' : '😢',
      this.mode === 'time' ? 'Hết giờ!' : (won ? 'Chúc mừng!' : 'Hết nước đi!'),
      String(this.score),
      String(this.highScore),
      '+' + totalPts,
      won ? 'win' : 'lose'
    );
    this.setStatus('');

    // Award points
    if (auth.currentUser && pts > 0) {
      try {
        await addPoints('2048', `Thắng ${MODE_LABELS[this.mode]}`, totalPts);
        if (buffBonus > 0 && window.showToast) {
          window.showToast(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
        }
        this.refreshPts();
      } catch {}
    }
  },

  showResult(emoji, title, score, best, earned, resultKind) {
    document.getElementById('res-emoji').textContent = emoji;
    document.getElementById('res-title').textContent = title;
    document.getElementById('res-score').textContent = score;
    document.getElementById('res-best').textContent = best;
    document.getElementById('res-earned').textContent = earned;

    if (this.statusBarEl) {
      this.statusBarEl.classList.remove('result-win', 'result-lose');
      this.statusBarEl.classList.add(resultKind === 'win' ? 'result-win' : 'result-lose');
    }

    // Update profit on status bar
    if (this.profitEl) {
      this.profitEl.textContent = earned;
      this.profitEl.className = resultKind === 'win' ? 'stat-profit positive' : 'stat-profit zero';
    }

    this.subEl.textContent = 'Kết thúc';

    this.showScreen('screen-result');
  },

  // ===== CONTROLS =====
  restart() {
    this.start(this.mode);
  },

  // ===== POINTS REFRESH =====
  async refreshPts() {
    try {
      const p = await getPoints();
      if (window.TopNav && typeof window.TopNav.setPoints === 'function') {
        window.TopNav.setPoints(p);
      }
    } catch {}
  },
};

// ===== AUTH =====
onAuthStateChanged(auth, user => {
  if (user) G2048.refreshPts();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  G2048.init();
});

window.G2048 = G2048;
