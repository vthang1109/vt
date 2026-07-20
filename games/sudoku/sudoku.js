// ============================================================
//  sudoku.js — Sudoku cho VTWorld
//  Style sạch sẽ như Pong · Phần thưởng lớn · Chỉ tính điểm
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';
import {
  getFirestore, doc, getDoc, updateDoc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== FIREBASE =====
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

// ===== CONFIG =====
const DIFF = {
  easy:   { label: 'Dê',   blanks: 35, pts: 300,  timeBonus: 300 },
  medium: { label: 'TB',   blanks: 45, pts: 600,  timeBonus: 500 },
  hard:   { label: 'Khó',  blanks: 52, pts: 1000, timeBonus: 800 },
};

// ===== STATE =====
const Sdk = {
  solution:    [],
  puzzle:      [],
  userBoard:   [],
  notes:       [],
  givenCells:  [],

  diff:       'easy',
  selR:       -1,
  selC:       -1,
  lives:      3,
  hintsLeft:  3,
  noteMode:   false,
  timerSec:   0,
  timerId:    null,
  gameOver:   false,
  filledCnt:  0,
  givenCnt:   0,

  // ── SCREEN NAV ──────────────────────────────────────────
  show(id) {
    document.querySelectorAll('.sdk-screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  },

  toast(msg, error) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'caro-toast' + (error ? ' error-toast' : '');
    el.classList.add('show');
    clearTimeout(el._hide);
    el._hide = setTimeout(() => el.classList.remove('show'), 2500);
  },

  // ── STATUS BAR ────────────────────────────────────────
  hideStatusBar() {
    const el = document.getElementById('bc-status');
    if (el) el.style.display = 'none';
  },

  showStatusBar() {
    const el = document.getElementById('bc-status');
    if (el) {
      el.style.display = '';
      el.className = 'bc-status';
    }
    this.updateStatusBar();
  },

  updateStatusBar() {
    const leftEl = document.getElementById('sdk-status-left');
    const centerEl = document.getElementById('sdk-status-center');
    const rightEl = document.getElementById('sdk-status-right');
    if (!leftEl || !centerEl || !rightEl) return;

    // Left: difficulty label
    const labels = { easy: 'Dê', medium: 'TB', hard: 'Khó' };
    leftEl.textContent = labels[this.diff] || this.diff;

    // Center: timer
    const m = String(Math.floor(this.timerSec / 60)).padStart(2, '0');
    const s = String(this.timerSec % 60).padStart(2, '0');
    centerEl.textContent = m + ':' + s;

    // Right: lives as dots
    let dots = '';
    for (let i = 0; i < 3; i++) {
      dots += i < this.lives ? '●' : '○';
    }
    rightEl.textContent = dots;
    rightEl.className = 'stat-profit' + (this.lives <= 1 ? ' negative' : this.lives === 2 ? ' zero' : ' positive');
  },

  backToMenu() {
    this.stopTimer();
    this.hideStatusBar();
    this.show('screen-diff');
    document.getElementById('result-modal').classList.add('hidden');
    this.loadStats();
  },

  restart() {
    document.getElementById('result-modal').classList.add('hidden');
    this.start(this.diff);
  },

  // ── START ───────────────────────────────────────────────
  start(diff) {
    this.diff = diff;
    const cfg = DIFF[diff];
    this.lives = 3;
    this.hintsLeft = 3;
    this.noteMode = false;
    this.gameOver = false;
    this.selR = -1;
    this.selC = -1;
    this.timerSec = 0;
    this.filledCnt = 0;

    this.solution = this.generate();
    this.puzzle = this.createPuzzle(this.solution, cfg.blanks);
    this.userBoard = this.puzzle.map(r => [...r]);
    this.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    this.givenCells = this.puzzle.map(r => r.map(v => v !== 0));
    this.givenCnt = this.puzzle.flat().filter(v => v !== 0).length;
    this.filledCnt = this.givenCnt;

    this.show('screen-game');
    this.showStatusBar();
    this.updateHintBtn();
    this.updateNoteBtn();
    this.renderBoard();
    this.stopTimer();
    this.startTimer();
  },

  // ── GENERATOR ─────────────────────────────────────────
  shuffle(a) {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  isValid(grid, r, c, num) {
    for (let i = 0; i < 9; i++) {
      if (grid[r][i] === num) return false;
      if (grid[i][c] === num) return false;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (grid[br + dr][bc + dc] === num) return false;
    return true;
  },

  solve(grid) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) continue;
        const nums = this.shuffle([1,2,3,4,5,6,7,8,9]);
        for (const num of nums) {
          if (this.isValid(grid, r, c, num)) {
            grid[r][c] = num;
            if (this.solve(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  },

  generate() {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solve(grid);
    return grid;
  },

  createPuzzle(sol, blanks) {
    const puz = sol.map(r => [...r]);
    const positions = this.shuffle([...Array(41)].map((_, i) => i));
    let removed = 0;
    for (const pos of positions) {
      if (removed >= blanks) break;
      const r1 = Math.floor(pos / 9), c1 = pos % 9;
      const r2 = 8 - r1, c2 = 8 - c1;
      puz[r1][c1] = 0; removed++;
      if (removed < blanks && !(r1 === r2 && c1 === c2)) {
        puz[r2][c2] = 0; removed++;
      }
    }
    return puz;
  },

  // ── BOARD RENDER ─────────────────────────────────────
  renderBoard() {
    const table = document.getElementById('sdk-board');
    table.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < 9; c++) {
        const td = document.createElement('td');
        if (c === 2 || c === 5) td.classList.add('box-right');
        if (r === 2 || r === 5) td.classList.add('box-bottom');

        if (this.givenCells[r][c]) {
          td.classList.add('given');
          td.textContent = this.puzzle[r][c];
        } else {
          const val = this.userBoard[r][c];
          const ns = this.notes[r][c];
          if (ns.size > 0 && val === 0) {
            this.renderNotes(td, ns);
          } else if (val !== 0) {
            td.textContent = val;
            td.classList.add(val === this.solution[r][c] ? 'correct' : 'error');
          }
        }
        td.dataset.r = r;
        td.dataset.c = c;
        td.addEventListener('click', () => this.select(r, c));
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    this.highlight();
  },

  renderNotes(td, ns) {
    const grid = document.createElement('div');
    grid.className = 'notes-grid';
    for (let n = 1; n <= 9; n++) {
      const span = document.createElement('span');
      span.className = 'note-num' + (ns.has(n) ? '' : ' empty');
      span.textContent = ns.has(n) ? n : '';
      grid.appendChild(span);
    }
    td.appendChild(grid);
  },

  // ── CELL SELECTION ──────────────────────────────────
  select(r, c) {
    this.selR = r; this.selC = c;
    this.highlight();
  },

  highlight() {
    document.querySelectorAll('.sdk-board td').forEach(td => {
      td.classList.remove('selected', 'highlight', 'same-num');
    });
    if (this.selR < 0) return;
    const selVal = this.userBoard[this.selR][this.selC] || this.puzzle[this.selR][this.selC];
    document.querySelectorAll('.sdk-board td').forEach(td => {
      const r = +td.dataset.r, c = +td.dataset.c;
      const sameBox = Math.floor(r / 3) === Math.floor(this.selR / 3) &&
                      Math.floor(c / 3) === Math.floor(this.selC / 3);
      if (r === this.selR && c === this.selC) td.classList.add('selected');
      else if (r === this.selR || c === this.selC || sameBox) td.classList.add('highlight');
      if (selVal !== 0) {
        const cv = this.userBoard[r][c] || this.puzzle[r][c];
        if (cv === selVal && !(r === this.selR && c === this.selC)) td.classList.add('same-num');
      }
    });
  },

  renderCell(r, c) {
    const td = document.querySelector(`#sdk-board td[data-r="${r}"][data-c="${c}"]`);
    if (!td) return;
    td.className = '';
    if (c === 2 || c === 5) td.classList.add('box-right');
    if (r === 2 || r === 5) td.classList.add('box-bottom');
    if (r === this.selR && c === this.selC) td.classList.add('selected');

    const val = this.userBoard[r][c];
    const ns = this.notes[r][c];
    td.textContent = '';
    td.innerHTML = '';
    if (ns.size > 0 && val === 0) {
      this.renderNotes(td, ns);
    } else if (val !== 0) {
      td.textContent = val;
      td.classList.add(val === this.solution[r][c] ? 'correct' : 'error');
    }
  },

  // ── INPUT ──────────────────────────────────────────
  input(num) {
    if (this.gameOver) return;
    if (this.selR < 0) { this.toast('Chon mot o truoc!', false); return; }
    if (this.givenCells[this.selR][this.selC]) return;

    const r = this.selR, c = this.selC;

    if (this.noteMode && num !== 0) {
      if (this.notes[r][c].has(num)) this.notes[r][c].delete(num);
      else this.notes[r][c].add(num);
      this.renderCell(r, c);
      return;
    }

    if (num === 0) {
      this.userBoard[r][c] = 0;
      this.notes[r][c].clear();
      this.renderCell(r, c);
      this.recount();
      return;
    }

    this.clearRelatedNotes(r, c, num);
    const wasEmpty = this.userBoard[r][c] === 0;
    this.userBoard[r][c] = num;
    this.notes[r][c].clear();

    if (num !== this.solution[r][c]) {
      this.lives--;
      this.updateStatusBar();
      this.renderCell(r, c);
      this.highlight();
      if (this.lives <= 0) {
        setTimeout(() => this.lose(), 400);
      } else {
        this.toast('Sai roi! Con ' + this.lives + ' mang', true);
      }
    } else {
      if (wasEmpty) this.filledCnt++;
      this.renderCell(r, c);
      this.highlight();
      if (this.filledCnt >= 81) setTimeout(() => this.win(), 300);
    }
  },

  recount() {
    this.filledCnt = 0;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (this.userBoard[r][c] !== 0) this.filledCnt++;
  },

  clearRelatedNotes(r, c, num) {
    for (let i = 0; i < 9; i++) {
      this.notes[r][i].delete(num);
      this.notes[i][c].delete(num);
      const br = 3 * Math.floor(r / 3) + Math.floor(i / 3);
      const bc = 3 * Math.floor(c / 3) + i % 3;
      this.notes[br][bc].delete(num);
    }
  },

  // ── HINT ──────────────────────────────────────────
  hint() {
    if (this.gameOver || this.hintsLeft <= 0) return;
    if (this.selR < 0) { this.toast('Chon o muon goi y!', false); return; }
    const r = this.selR, c = this.selC;
    if (this.givenCells[r][c]) { this.toast('O nay co san roi!', false); return; }
    if (this.userBoard[r][c] === this.solution[r][c]) { this.toast('O nay dung roi!', false); return; }

    const wasEmpty = this.userBoard[r][c] === 0;
    this.hintsLeft--;
    this.userBoard[r][c] = this.solution[r][c];
    this.notes[r][c].clear();
    if (wasEmpty) this.filledCnt++;

    const td = document.querySelector(`#sdk-board td[data-r="${r}"][data-c="${c}"]`);
    if (td) {
      td.innerHTML = '';
      td.textContent = this.solution[r][c];
      td.className = 'hint-cell';
      if (c === 2 || c === 5) td.classList.add('box-right');
      if (r === 2 || r === 5) td.classList.add('box-bottom');
    }
    this.updateHintBtn();
    this.toast('Goi y: o nay la ' + this.solution[r][c], false);
    if (this.filledCnt >= 81) setTimeout(() => this.win(), 300);
  },

  toggleNote() {
    this.noteMode = !this.noteMode;
    this.updateNoteBtn();
    this.toast(this.noteMode ? 'Ghi nhop BAT' : 'Ghi nhop TAT', false);
  },

  // ── TIMER ─────────────────────────────────────────
  startTimer() {
    this.timerId = setInterval(() => {
      this.timerSec++;
      this.updateStatusBar();
    }, 1000);
  },

  stopTimer() {
    clearInterval(this.timerId);
    this.timerId = null;
  },

  // ── UI HELPERS ────────────────────────────────────
  updateHintBtn() {
    const btn = document.getElementById('hint-btn');
    if (!btn) return;
    btn.textContent = 'Goi y (' + this.hintsLeft + ')';
    btn.disabled = this.hintsLeft <= 0;
  },

  updateNoteBtn() {
    const btn = document.getElementById('note-btn');
    if (btn) btn.classList.toggle('active', this.noteMode);
  },

  // ── WIN / LOSE ────────────────────────────────────
  async win() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.stopTimer();

    const cfg = DIFF[this.diff];
    let pts = cfg.pts;
    // Time bonus
    if (this.timerSec < cfg.timeBonus) pts += 100;
    // Life bonus
    pts += this.lives * 50;

    // Pet buff
    let totalPts = pts;
    let buffText = '';
    try {
      const petInfo = await getActivePetInfo();
      const buffPct = petInfo.buff || 0;
      if (buffPct > 0 && auth.currentUser) {
        const bonus = Math.round(pts * buffPct / 100);
        totalPts += bonus;
        buffText = petInfo.pet ? ` (${petInfo.pet.emoji} +${bonus})` : '';
      }
    } catch {}

    try {
      if (auth.currentUser) {
        await addPoints('Sudoku', 'Thang (' + cfg.label + ')', totalPts);
        await this.saveStats(true);
      }
    } catch(e) { console.error(e); }

    const m = String(Math.floor(this.timerSec / 60)).padStart(2, '0');
    const s = String(this.timerSec % 60).padStart(2, '0');

    const bcStatus = document.getElementById('bc-status');
    if (bcStatus) {
      bcStatus.className = 'bc-status result-win';
      const centerEl = document.getElementById('sdk-status-center');
      if (centerEl) centerEl.textContent = 'THANG!';
      const rightEl = document.getElementById('sdk-status-right');
      if (rightEl) {
        rightEl.textContent = totalPts + '〄';
        rightEl.className = 'stat-profit positive';
      }
    }

    document.getElementById('result-emoji').textContent = '🏆';
    document.getElementById('result-title').textContent = 'Hoan thanh!';
    document.getElementById('result-time').textContent = 'Thoi gian: ' + m + ':' + s;
    document.getElementById('result-rewards').innerHTML =
      '<div><span class="rwd-val">' + totalPts + '〄</span><span class="rwd-lbl">Diem' + buffText + '</span></div>';
    document.getElementById('result-modal').classList.remove('hidden');

    this.spawnPop(totalPts + '〄');
  },

  lose() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.stopTimer();

    this.saveStats(false).catch(() => {});

    const bcStatus = document.getElementById('bc-status');
    if (bcStatus) {
      bcStatus.className = 'bc-status result-lose';
      const centerEl = document.getElementById('sdk-status-center');
      if (centerEl) centerEl.textContent = 'THUA!';
      const rightEl = document.getElementById('sdk-status-right');
      if (rightEl) {
        rightEl.textContent = '0〄';
        rightEl.className = 'stat-profit negative';
      }
    }

    document.getElementById('result-emoji').textContent = '💔';
    document.getElementById('result-title').textContent = 'Het mang!';
    document.getElementById('result-time').textContent = 'Co gang lan sau!';
    document.getElementById('result-rewards').innerHTML = '';
    document.getElementById('result-modal').classList.remove('hidden');
  },

  spawnPop(text) {
    const el = document.createElement('div');
    el.className = 'coin-pop';
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);' +
      'font-family:Orbitron,monospace;font-size:20px;font-weight:900;color:#fbbf24;' +
      'pointer-events:none;z-index:9999;text-shadow:0 0 12px rgba(251,191,36,0.8)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  // ── FIRESTORE ────────────────────────────────────
  async saveStats(won) {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const upd = { 'sudoku.played': increment(1) };
    if (won) upd['sudoku.won'] = increment(1);
    try { await updateDoc(ref, upd); }
    catch(e) { await setDoc(ref, { sudoku: { played: 1, won: won ? 1 : 0 } }, { merge: true }); }
  },

  async loadStats() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      const sdk = data.sudoku || {};
      document.getElementById('stat-played').textContent = sdk.played || 0;
      document.getElementById('stat-won').textContent = sdk.won || 0;
    } catch(e) {}
  },

  // ── INIT ──────────────────────────────────────────
  init() {
    // TopNav leave action
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => { window.location.href = '../../games.html'; });
    }

    // Auth
    onAuthStateChanged(auth, user => {
      if (user) this.loadStats();
    });
  }
};

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => Sdk.init());
window.Sdk = Sdk;
