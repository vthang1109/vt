/**
 * minesweeper.js — Dò Mìn (Minesweeper) for VTWorld
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
// CONFIG: 3 difficulty levels
// ============================
const DIFF_CFG = {
  easy:   { rows: 9,  cols: 9,  mines: 10, basePts: 50,  timeBonus: 60,  bonusPts: 25  },
  medium: { rows: 16, cols: 16, mines: 40, basePts: 150, timeBonus: 120, bonusPts: 75  },
  hard:   { rows: 16, cols: 30, mines: 99, basePts: 500, timeBonus: 240, bonusPts: 250 },
};
const DIFF_LABELS = { easy: 'Dễ', medium: 'Trung Bình', hard: 'Khó' };
const DIFF_EMOJIS = { easy: '🟢', medium: '🟡', hard: '🔴' };

// ============================
// GAME STATE
// ============================
const MS = {
  diff: 'easy',
  cfg: null,
  board: [],       // 2D array of cell objects
  rows: 0,
  cols: 0,
  mines: 0,
  flags: 0,
  revealed: 0,     // count of revealed non-mine cells
  state: 'menu',   // menu | playing | won | lost
  timer: 0,
  timerInterval: null,
  firstClick: true,
  _gameOverLocked: false,

  // ===== INIT =====
  init() {
    // TopNav: add Leave action
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => {
        this.stopTimer();
        window.location.href = '../../games.html';
      });
    }

    this.showMenu();
  },

  // ===== SCREEN MANAGEMENT =====
  showScreen(id) {
    document.querySelectorAll('.ms-screen').forEach(s => {
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
    document.getElementById('bc-status').style.display = 'none';
  },

  // ===== START GAME =====
  start(diff) {
    this.diff = diff;
    this.cfg = DIFF_CFG[diff];
    this.rows = this.cfg.rows;
    this.cols = this.cfg.cols;
    this.mines = this.cfg.mines;
    this.flags = 0;
    this.revealed = 0;
    this.timer = 0;
    this.firstClick = true;
    this._gameOverLocked = false;

    // Init board
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      this.board[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.board[r][c] = {
          mine: false,
          revealed: false,
          flagged: 0, // 0=hidden, 1=flag, 2=suspect
          adjacent: 0,
        };
      }
    }

    // Show status bar
    const bc = document.getElementById('bc-status');
    bc.style.display = '';
    bc.classList.remove('result-win', 'result-lose');

    document.getElementById('ms-difficulty-label').textContent = DIFF_EMOJIS[diff] + ' ' + DIFF_LABELS[diff];
    this.updateHeader();

    // Build board DOM
    this.renderBoard();

    this.showScreen('screen-game');
    this.state = 'playing';
    this.setStatus('👆 Chọn ô để bắt đầu');
  },

  renderBoard() {
    const boardEl = document.getElementById('ms-board');
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    boardEl.classList.toggle('hard', this.diff === 'hard');

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'ms-cell hidden';
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Left click
        cell.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.state !== 'playing' || this._gameOverLocked) return;
          const ri = parseInt(cell.dataset.r);
          const ci = parseInt(cell.dataset.c);
          this.revealCell(ri, ci);
        });

        // Right click (flag)
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (this.state !== 'playing' || this._gameOverLocked) return;
          const ri = parseInt(cell.dataset.r);
          const ci = parseInt(cell.dataset.c);
          this.toggleFlag(ri, ci);
        });

        // Touch: long press for flag
        let longPressTimer = null;
        cell.addEventListener('touchstart', (e) => {
          longPressTimer = setTimeout(() => {
            longPressTimer = null;
            const ri = parseInt(cell.dataset.r);
            const ci = parseInt(cell.dataset.c);
            if (this.state === 'playing' && !this._gameOverLocked) {
              this.toggleFlag(ri, ci);
            }
          }, 400);
        }, { passive: true });
        cell.addEventListener('touchend', () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }, { passive: true });
        cell.addEventListener('touchmove', () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }, { passive: true });

        boardEl.appendChild(cell);
      }
    }
  },

  // ===== PLACE MINES (after first click) =====
  placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < this.mines) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      // Don't place mine on first-click cell or its neighbors
      if (this.board[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      this.board[r][c].mine = true;
      placed++;
    }
    // Calculate adjacent numbers
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc].mine) count++;
          }
        }
        this.board[r][c].adjacent = count;
      }
    }
  },

  // ===== REVEAL CELL =====
  revealCell(r, c) {
    const cell = this.board[r][c];
    if (cell.revealed || cell.flagged) return;

    // First click: place mines
    if (this.firstClick) {
      this.firstClick = false;
      this.placeMines(r, c);
      this.startTimer();
    }

    // Hit a mine -> game over
    if (cell.mine) {
      this.loseGame(r, c);
      return;
    }

    // Flood fill reveal
    this.floodReveal(r, c);
    this.updateHeader();

    // Check win
    if (this.revealed >= (this.rows * this.cols - this.mines)) {
      this.winGame();
    }
  },

  floodReveal(r, c) {
    const stack = [[r, c]];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      const cell = this.board[cr][cc];
      if (cell.revealed || cell.flagged || cell.mine) continue;

      cell.revealed = true;
      this.revealed++;
      this.updateCellDOM(cr, cc);

      if (cell.adjacent === 0) {
        // Add neighbors to stack
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              const neighbor = this.board[nr][nc];
              if (!neighbor.revealed && !neighbor.flagged) {
                stack.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  },

  // ===== TOGGLE FLAG =====
  toggleFlag(r, c) {
    const cell = this.board[r][c];
    if (cell.revealed) return;

    // Cycle: hidden(0) -> flag(1) -> suspect(2) -> hidden(0)
    cell.flagged = (cell.flagged + 1) % 3;
    
    // Count only actual flags for the mine counter
    this.flags = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].flagged === 1) this.flags++;
      }
    }
    
    this.updateCellDOM(r, c);
    this.updateHeader();
    
    if (cell.flagged === 1) this.setStatus('🚩 Chắc chắn có mìn');
    else if (cell.flagged === 2) this.setStatus('❓ Nghi ngờ có mìn');
    else this.setStatus('👆');
  },

  // ===== UPDATE UI =====
  updateHeader() {
    const remaining = this.mines - this.flags;
    document.getElementById('ms-mine-count').textContent = `💣 ${remaining}`;
  },

  updateCellDOM(r, c) {
    const cellData = this.board[r][c];
    const el = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
    if (!el) return;

    el.className = 'ms-cell';

    if (cellData.revealed) {
      el.classList.add('revealed');
      if (cellData.mine) {
        el.textContent = '💣';
      } else if (cellData.adjacent > 0) {
        el.textContent = cellData.adjacent;
        el.classList.add('n' + cellData.adjacent);
      } else {
        el.textContent = '';
      }
    } else if (cellData.flagged === 1) {
      el.classList.add('hidden', 'flagged');
      el.textContent = '🚩';
    } else if (cellData.flagged === 2) {
      el.classList.add('hidden', 'suspect');
      el.textContent = '❓';
    } else {
      el.classList.add('hidden');
      el.textContent = '';
    }
  },

  setStatus(text) {
    const el = document.getElementById('ms-status');
    if (el) el.textContent = text;
  },

  // ===== TIMER =====
  startTimer() {
    this.timer = 0;
    this.timerInterval = setInterval(() => {
      this.timer++;
      document.getElementById('ms-timer').textContent = `⏱ ${this.timer}s`;
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  // ===== GAME OVER: LOSE =====
  loseGame(hitR, hitC) {
    if (this._gameOverLocked) return;
    this._gameOverLocked = true;
    this.state = 'lost';
    this.stopTimer();

    // Reveal all mines
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.mine) {
          cell.revealed = true;
          const el = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.className = 'ms-cell mine';
            if (r === hitR && c === hitC) el.classList.add('exploded');
            el.textContent = '💣';
          }
        } else if (cell.flagged === 1 && !cell.mine) {
          // Wrong flags (only show red X for actual flags, not suspects)
          const el = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.className = 'ms-cell wrong-flag revealed';
            el.textContent = '';
          }
        } else if (cell.flagged === 2 && cell.mine) {
          // Suspect on a mine -> reveal it
          const el = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.className = 'ms-cell mine';
            el.textContent = '💣';
          }
        }
      }
    }

    this.setStatus('💥 Bạn đã dẫm phải mìn!');

    setTimeout(() => {
      this.showResult('😢', 'Bạn thua!', `${this.timer}s`, '+0', 'lose');
    }, 1000);
  },

  // ===== GAME OVER: WIN =====
  winGame() {
    if (this._gameOverLocked) return;
    this._gameOverLocked = true;
    this.state = 'won';
    this.stopTimer();

    // Animate all unrevealed non-mine cells (small delay to avoid long wait on big boards)
    const allCells = document.querySelectorAll('.ms-cell');
    const delay = this.diff === 'hard' ? 2 : 5;
    allCells.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('win-reveal');
      }, i * delay);
    });

    // Flag all remaining mines
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.mine && cell.flagged !== 1) {
          const el = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
          if (el) {
            el.className = 'ms-cell hidden flagged';
            el.textContent = '🚩';
          }
        }
      }
    }

    // Calculate points
    const pts = this.calculatePoints();

    this.updateHeader();
    this.setStatus('🎉 Bạn thắng!');

    setTimeout(async () => {
      let totalPts = pts;
      let buffBonus = 0, buffPct = 0, petLabel = '';

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

        try {
          await addPoints('Dò Mìn', `Thắng ${DIFF_LABELS[this.diff]}`, totalPts);
          if (buffBonus > 0 && window.showToast) {
            window.showToast(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
          }
          this.refreshPts();
        } catch {}
      }

      this.showResult('🏆', 'Bạn thắng!', `${this.timer}s`, '+' + totalPts, 'win');
    }, 800);
  },

  calculatePoints() {
    const cfg = this.cfg;
    let pts = cfg.basePts;

    // Time bonus
    if (this.timer <= cfg.timeBonus) {
      pts += cfg.bonusPts;
    }

    // Flag accuracy bonus (all mines correctly flagged)
    let correctFlags = 0;
    let totalFlags = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.flagged) {
          totalFlags++;
          if (cell.mine) correctFlags++;
        }
      }
    }
    if (totalFlags === this.mines && correctFlags === this.mines) {
      pts += Math.round(cfg.basePts * 0.2); // 20% bonus for perfect flagging
    }

    return pts;
  },

  // ===== RESULT SCREEN =====
  showResult(emoji, title, timeText, earned, resultKind) {
    document.getElementById('res-emoji').textContent = emoji;
    document.getElementById('res-title').textContent = title;
    document.getElementById('res-time').textContent = timeText;
    document.getElementById('res-earned').textContent = earned;

    const bc = document.getElementById('bc-status');
    bc.classList.remove('result-win', 'result-lose');
    bc.classList.add(resultKind === 'win' ? 'result-win' : 'result-lose');

    this.showScreen('screen-result');
  },

  // ===== RESTART / MENU =====
  restart() {
    this.start(this.diff);
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
  if (user) MS.refreshPts();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  MS.init();
});

window.MS = MS;
