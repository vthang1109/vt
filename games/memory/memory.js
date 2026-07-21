/**
 * Memory Card — VTWorld Complete Rewrite
 * Modes: solo (1P timer), local (2P turns)
 * Grid sizes: 3×3, 4×4, 5×5, 6×6
 * Themes: animals, food, space
 * Features: high scores (localStorage), pet buff, match particles, score popups
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

// ==========================================
// THEMES
// ==========================================
const THEMES = {
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦉','🐺','🦄','🐙','🐳','🦋','🐝','🐞','🐌','🐠','🐡','🦈','🐊'],
  food:    ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🌽','🥕','🍞','🧀','🍕','🍔','🌮','🍩','🍪','🧁','🍫','🍿','🥤','🍷','🧊','🥨'],
  space:   ['🌍','🌕','🌟','⭐','🌙','☀️','🌌','🚀','🛸','🪐','☄️','🌠','👽','🤖','🛰️','🔭','🌎','🌞','🌈','⚡','💫','🌑','🌓','🌔','🌖','🌗','🌘','🌚','🌝','✨'],
};

// ==========================================
// GRID CONFIG
// ==========================================
const GRID_CFG = {
  3: { pairs: 4,  wildcard: true,  label: '3×3',  basePts: 20,  winPts: 80  },
  4: { pairs: 8,  wildcard: false, label: '4×4',  basePts: 30,  winPts: 120 },
  5: { pairs: 12, wildcard: true,  label: '5×5',  basePts: 40,  winPts: 180 },
  6: { pairs: 18, wildcard: false, label: '6×6',  basePts: 50,  winPts: 250 },
};

// ==========================================
// GAME STATE
// ==========================================
const Memory = {
  mode: 'solo',           // solo | local
  size: 4,
  theme: 'animals',
  cards: [],
  flipped: [],
  matched: 0,
  totalPairs: 0,
  hasWildcard: false,
  moves: 0,
  p1Score: 0,
  p2Score: 0,
  currentPlayer: 1,
  seconds: 0,
  timerInt: null,
  canFlip: true,
  state: 'menu',          // menu | playing | result
  isProcessing: false,

  // UI refs
  boardEl: null,
  statusBarEl: null,
  leftLabelEl: null,
  matchesEl: null,
  subEl: null,
  rightLabelEl: null,

  // ===== INIT =====
  init() {
    this.boardEl = document.getElementById('mem-board');
    this.statusBarEl = document.getElementById('bc-status');
    this.leftLabelEl = document.getElementById('mem-left-label');
    this.matchesEl = document.getElementById('mem-matches');
    this.subEl = document.getElementById('mem-sub');
    this.rightLabelEl = document.getElementById('mem-right-label');

    // Setup chip listeners
    document.querySelectorAll('#size-chips .mem-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#size-chips .mem-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.size = parseInt(btn.dataset.size);
      });
    });

    document.querySelectorAll('#theme-chips .mem-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#theme-chips .mem-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.theme = btn.dataset.theme;
      });
    });

    // TopNav leave action
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => {
        this.stopTimer();
        window.location.href = '../../games.html';
      });
    }

    this.showMenu();
  },

  // ===== SCREENS =====
  showScreen(id) {
    document.querySelectorAll('.mem-screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const target = document.getElementById('screen-' + id);
    if (target) {
      target.style.display = 'flex';
      setTimeout(() => target.classList.add('active'), 10);
    }
  },

  showMenu() {
    this.stopTimer();
    this.state = 'menu';
    this.showScreen('menu');
    if (this.statusBarEl) this.statusBarEl.style.display = 'none';
  },

  // ===== START GAME =====
  start(mode) {
    this.mode = mode;
    this.matched = 0;
    this.moves = 0;
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentPlayer = 1;
    this.seconds = 0;
    this.canFlip = true;
    this.state = 'playing';
    this.isProcessing = false;
    this.flipped = [];

    const cfg = GRID_CFG[this.size];
    this.totalPairs = cfg.pairs;
    this.hasWildcard = cfg.wildcard;

    // Generate cards
    const themeEmojis = THEMES[this.theme] || THEMES.animals;
    const shuffledEmojis = this.shuffle(themeEmojis).slice(0, cfg.pairs);
    let cardData = [...shuffledEmojis, ...shuffledEmojis];
    if (cfg.wildcard) cardData.push('⭐');
    cardData = this.shuffle(cardData);

    this.cards = cardData.map((e, i) => ({
      id: i,
      emoji: e,
      flipped: false,
      matched: false,
      isWildcard: e === '⭐',
    }));

    // Show status bar
    if (this.statusBarEl) {
      this.statusBarEl.style.display = '';
      this.statusBarEl.classList.remove('result-win', 'result-lose');
    }

    // Setup status bar
    if (mode === 'solo') {
      this.leftLabelEl.textContent = '00:00';
      this.leftLabelEl.className = 'stat-bet';
      this.rightLabelEl.textContent = '';
      this.rightLabelEl.className = 'stat-profit zero';
    } else {
      this.leftLabelEl.textContent = 'P1: 0';
      this.leftLabelEl.className = 'stat-bet turn-p1';
      this.rightLabelEl.textContent = 'P2: 0';
      this.rightLabelEl.className = 'stat-profit turn-p2';
      this.subEl.textContent = 'Lượt: Người 1';
    }

    this.subEl.textContent = `0/${this.totalPairs} cặp`;
    this.matchesEl.textContent = '0';

    // Setup board grid
    const total = this.size * this.size;
    this.boardEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    this.boardEl.dataset.size = this.size;

    this.renderBoard();
    this.showScreen('game');
    this.startTimer();
  },

  restart() {
    this.start(this.mode);
  },


  // ===== TIMER =====
  startTimer() {
    this.stopTimer();
    this.timerInt = setInterval(() => {
      this.seconds++;
      if (this.mode === 'solo') {
        const m = Math.floor(this.seconds / 60);
        const s = this.seconds % 60;
        this.leftLabelEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInt) {
      clearInterval(this.timerInt);
      this.timerInt = null;
    }
  },

  // ===== CARD FLIP LOGIC =====
  flipCard(id) {
    if (!this.canFlip || this.isProcessing || this.state !== 'playing') return;
    const card = this.cards[id];
    if (!card || card.flipped || card.matched) return;
    if (this.flipped.length >= 2) return;

    card.flipped = true;
    this.flipped.push(id);
    this.renderBoard();

    if (this.flipped.length === 2) {
      this.isProcessing = true;
      this.checkMatch();
    }
  },

  checkMatch() {
    const [a, b] = this.flipped.map(id => this.cards[id]);

    setTimeout(() => {
      this.moves++;

      if (a.emoji === b.emoji) {
        // Match!
        a.matched = true;
        b.matched = true;
        this.matched++;

        if (this.mode === 'solo') {
          this.p1Score++;
        } else {
          if (this.currentPlayer === 1) this.p1Score++;
          else this.p2Score++;
        }

        this.updateScoreUI();
        this.subEl.textContent = `${this.matched}/${this.totalPairs} cặp`;
        this.matchesEl.textContent = this.matched;

        // Particle burst
        this.spawnParticles(a.id, b.id);

        this.flipped = [];
        this.canFlip = true;
        this.isProcessing = false;

        if (this.matched === this.totalPairs) {
          setTimeout(() => this.endGame(), 500);
        }
      } else {
        // No match — apply shake then flip back
        const aEl = this.boardEl.querySelector(`.mem-card[data-id="${a.id}"]`);
        const bEl = this.boardEl.querySelector(`.mem-card[data-id="${b.id}"]`);
        if (aEl) aEl.classList.add('wrong');
        if (bEl) bEl.classList.add('wrong');

        setTimeout(() => {
          a.flipped = false;
          b.flipped = false;

          if (this.mode === 'local') {
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            this.updateScoreUI();
          }

          this.flipped = [];
          this.renderBoard();
          this.canFlip = true;
          this.isProcessing = false;
        }, 500);
      }
    }, 700);
  },

  // ===== RENDER =====
  renderBoard() {
    this.boardEl.innerHTML = '';
    this.cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'mem-card';
      if (card.flipped || card.matched) el.classList.add('flipped');
      if (card.matched) el.classList.add('matched');
      el.dataset.id = card.id;

      el.innerHTML = `
        <div class="mem-card-inner">
          <div class="mem-card-front"></div>
          <div class="mem-card-back">${card.emoji}</div>
        </div>`;

      if (!card.matched && !card.flipped) {
        el.addEventListener('click', () => this.flipCard(card.id));
      }

      this.boardEl.appendChild(el);
    });
  },

  // ===== PARTICLES =====
  spawnParticles(idA, idB) {
    [idA, idB].forEach(id => {
      const el = this.boardEl.querySelector(`.mem-card[data-id="${id}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const colors = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

      for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.className = 'mem-particle';
        const angle = (i / 8) * Math.PI * 2;
        const dist = 40 + Math.random() * 50;
        p.style.cssText = `
          left:${cx}px; top:${cy}px;
          width:${4 + Math.random() * 4}px;
          height:${4 + Math.random() * 4}px;
          background:${colors[Math.floor(Math.random() * colors.length)]};
          --dx:${Math.cos(angle) * dist}px;
          --dy:${Math.sin(angle) * dist}px;
          position:fixed;
          pointer-events:none;
          z-index:50;
          border-radius:50%;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
      }
    });
  },

  // ===== UI UPDATES =====
  updateScoreUI() {
    if (this.mode === 'local') {
      // Giống timso duo: trái P1, phải P2, highlight lượt
      this.leftLabelEl.textContent = `P1: ${this.p1Score}`;
      this.leftLabelEl.className = this.currentPlayer === 1 ? 'stat-bet turn-p1' : 'stat-bet';
      this.rightLabelEl.textContent = `P2: ${this.p2Score}`;
      this.rightLabelEl.className = this.currentPlayer === 2 ? 'stat-profit turn-p2' : 'stat-profit zero';
      this.subEl.textContent = `Lượt: Người ${this.currentPlayer}`;
    }
  },

  // ===== END GAME =====
  async endGame() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.stopTimer();

    const cfg = GRID_CFG[this.size];
    let emoji = '🏆', title = '', statsHTML = '';
    let pts = 0;

    if (this.mode === 'solo') {
      // Score = base + pairs * 10 - seconds penalty + bonus for fast finish
      const timeBonus = Math.max(0, 60 - this.seconds) * 2;
      const movePenalty = Math.max(0, this.moves - this.totalPairs * 2) * 2;
      pts = cfg.basePts + this.p1Score * 10 + timeBonus - movePenalty;
      pts = Math.max(10, pts);

      title = `Hoàn thành! ${this.formatTime(this.seconds)}`;
      statsHTML = `
        <div class="mem-res-stat">
          <span class="mem-res-val">${this.matched}/${this.totalPairs}</span>
          <span class="mem-res-label">Cặp tìm được</span>
        </div>
        <div class="mem-res-stat">
          <span class="mem-res-val">${this.formatTime(this.seconds)}</span>
          <span class="mem-res-label">Thời gian</span>
        </div>
        <div class="mem-res-stat">
          <span class="mem-res-val">${this.moves}</span>
          <span class="mem-res-label">Lượt lật</span>
        </div>`;

      // Award points
      if (auth.currentUser && pts > 0) {
        let totalPts = pts;
        let buffBonus = 0, buffPct = 0, petLabel = '';
        try {
          const petInfo = await getActivePetInfo();
          buffPct = petInfo.buff || 0;
          petLabel = petInfo.pet ? (petInfo.pet.emoji + ' ' + petInfo.pet.name) : '';
          if (buffPct > 0) {
            buffBonus = Math.round(pts * buffPct / 100);
            totalPts += buffBonus;
          }
        } catch {}
        await addPoints('Memory Card', 'Hoàn thành ' + cfg.label, totalPts);
        if (buffBonus > 0 && window.showToast) {
          window.showToast(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
        }
        this.refreshPts();
      }

      // Save high score
      this.saveHighScore(this.size, this.theme, this.mode, {
        time: this.seconds,
        moves: this.moves,
        matched: this.matched,
        score: pts,
      });

    } else {
      // 2P mode
      if (this.p1Score > this.p2Score) {
        emoji = '🏆';
        title = 'Người chơi 1 thắng!';
      } else if (this.p2Score > this.p1Score) {
        emoji = '🎉';
        title = 'Người chơi 2 thắng!';
      } else {
        emoji = '🤝';
        title = 'Hòa!';
      }
      statsHTML = `
        <div class="mem-res-stat">
          <span class="mem-res-val" style="color:#38bdf8">${this.p1Score}</span>
          <span class="mem-res-label">Người chơi 1</span>
        </div>
        <div class="mem-res-stat">
          <span class="mem-res-val" style="color:#f472b6">${this.p2Score}</span>
          <span class="mem-res-label">Người chơi 2</span>
        </div>
        <div class="mem-res-stat">
          <span class="mem-res-val">${this.formatTime(this.seconds)}</span>
          <span class="mem-res-label">Thời gian</span>
        </div>`;
    }

    // Update status bar with result
    if (this.statusBarEl) {
      this.statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
      if (this.mode === 'solo') {
        this.statusBarEl.classList.add('result-win');
        this.leftLabelEl.textContent = this.formatTime(this.seconds);
        this.subEl.textContent = 'Hoàn thành!';
        this.rightLabelEl.textContent = `+${pts.toLocaleString('vi-VN')}`;
        this.rightLabelEl.className = 'stat-profit positive';
      } else {
        // Giống timso duo: P1/P2 score + win/lose highlight
        const s1 = this.p1Score, s2 = this.p2Score;
        this.leftLabelEl.textContent = `P1: ${s1}`;
        this.rightLabelEl.textContent = `P2: ${s2}`;
        if (s1 > s2) {
          this.statusBarEl.classList.add('result-win');
          this.leftLabelEl.className = 'stat-bet mem-win';
          this.rightLabelEl.className = 'stat-profit mem-lose';
          this.subEl.textContent = 'P1 thắng!';
        } else if (s2 > s1) {
          this.statusBarEl.classList.add('result-win');
          this.leftLabelEl.className = 'stat-bet mem-lose';
          this.rightLabelEl.className = 'stat-profit mem-win';
          this.subEl.textContent = 'P2 thắng!';
        } else {
          this.statusBarEl.classList.add('result-draw');
          this.leftLabelEl.className = 'stat-bet';
          this.rightLabelEl.className = 'stat-profit zero';
          this.subEl.textContent = 'Hòa!';
        }
      }
    }

    document.getElementById('res-emoji').textContent = emoji;
    document.getElementById('res-title').textContent = title;
    document.getElementById('mem-res-stats').innerHTML = statsHTML;
    this.showScreen('result');
  },

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // ===== HIGH SCORES (localStorage) =====
  saveHighScore(size, theme, mode, data) {
    if (mode !== 'solo') return;
    try {
      const key = `mem_hs_${size}_${theme}`;
      const all = JSON.parse(localStorage.getItem('mem_highscores') || '{}');
      const prev = all[key];
      if (!prev || data.time < prev.time || (data.time === prev.time && data.moves < prev.moves)) {
        all[key] = data;
        localStorage.setItem('mem_highscores', JSON.stringify(all));
      }
    } catch {}
  },

  // ===== UTILITIES =====
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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
  if (user) Memory.refreshPts();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  Memory.init();
});

window.Memory = Memory;
