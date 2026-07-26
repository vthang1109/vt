// ============================================================
//  guess.js — Đoán Số cho VTWorld
//  Style sạch như Pong · Phần thưởng lớn
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

const firebaseConfig = {
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",storageBucket:"lienquan-fake.firebasestorage.app",
  messagingSenderId:"782694799992",appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== CONFIG =====
const REWARDS = { 100: 50, 500: 100, 1000: 200 };
const MAX_ATTEMPTS = { 100: 10, 500: 12, 1000: 15 };

const Guess = {
  maxNum: 100,
  secret: 0,
  maxAttempts: 10,
  attempts: [],
  rangeMin: 1,
  rangeMax: 100,
  over: false,
  won: false,

  // ── SCREEN NAV ──────────────────────────────────────
  show(id) {
    document.querySelectorAll('.gs-screen').forEach(s => s.classList.add('hidden'));
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

  // ── STATUS BAR ──────────────────────────────────────
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
    const leftEl = document.getElementById('gs-status-left');
    const centerEl = document.getElementById('gs-status-center');
    const rightEl = document.getElementById('gs-status-right');
    if (!leftEl || !centerEl || !rightEl) return;

    leftEl.textContent = '1-' + this.maxNum;
    centerEl.textContent = 'Lần ' + (this.attempts.length + 1);
    const remaining = this.maxAttempts - this.attempts.length;
    rightEl.textContent = remaining;
    rightEl.className = 'stat-profit' + (remaining <= 2 ? ' negative' : remaining <= 5 ? ' zero' : ' positive');
  },

  // ── START ───────────────────────────────────────────
  start(maxNum) {
    if (maxNum) {
      this.maxNum = parseInt(maxNum);
      this.maxAttempts = MAX_ATTEMPTS[this.maxNum] || 10;
    }
    this.secret = Math.floor(Math.random() * this.maxNum) + 1;
    this.attempts = [];
    this.rangeMin = 1;
    this.rangeMax = this.maxNum;
    this.over = false;
    this.won = false;

    const inp = document.getElementById('gs-input');
    inp.value = '';
    inp.disabled = false;
    inp.max = this.maxNum;
    document.getElementById('guess-btn').disabled = false;
    document.getElementById('gs-hint').textContent = 'Nhập số từ 1 đến ' + this.maxNum + '!';
    document.getElementById('gs-hint').className = 'gs-hint';
    document.getElementById('gs-history').innerHTML = '';
    document.getElementById('gs-attempts').textContent = this.maxAttempts;
    document.getElementById('gs-result').classList.add('hidden');

    this.renderDots();
    this.updateRange();
    this.show('screen-game');
    this.showStatusBar();

    setTimeout(() => inp.focus(), 100);
  },

  // ── GUESS ───────────────────────────────────────────
  async guess() {
    if (this.over) return;
    const inp = document.getElementById('gs-input');
    const val = parseInt(inp.value);
    if (isNaN(val) || val < 1 || val > this.maxNum) {
      this.toast('Nhập số từ 1 đến ' + this.maxNum + '!', true);
      return;
    }
    inp.value = '';
    inp.focus();

    const hint = document.getElementById('gs-hint');
    const badge = document.createElement('div');
    badge.className = 'gs-badge';

    // ── CORRECT ──
    if (val === this.secret) {
      this.over = true;
      this.won = true;
      this.attempts.push({ val, result: 'win' });
      badge.classList.add('win');
      badge.textContent = val + ' ✓';
      document.getElementById('gs-history').appendChild(badge);
      this.renderDots();
      hint.textContent = 'Đúng rồi! Số bí mật là ' + this.secret;
      hint.className = 'gs-hint win';

      inp.disabled = true;
      document.getElementById('guess-btn').disabled = true;

      // Calculate reward
      const remaining = this.maxAttempts - this.attempts.length;
      let pts = REWARDS[this.maxNum] || 50;
      // Bonus for remaining attempts
      if (remaining >= 8) pts += 100;
      else if (remaining >= 5) pts += 60;
      else if (remaining >= 3) pts += 30;
      else pts += 10;

      // Pet buff
      let totalPts = pts;
      let buffText = '';
      try {
        const petInfo = await getActivePetInfo();
        const buffPct = petInfo.buff || 0;
        if (buffPct > 0 && auth.currentUser) {
          const bonus = Math.round(pts * buffPct / 100);
          totalPts += bonus;
          buffText = petInfo.pet ? ' (+' + bonus + ' pet)' : '';
        }
      } catch {}

      // Award
      try {
        if (auth.currentUser) {
          await addPoints('Đoán số', 'Thắng game', totalPts);
        }
      } catch(e) { console.error(e); }

      // Update status bar
      const bcStatus = document.getElementById('bc-status');
      if (bcStatus) {
        bcStatus.className = 'bc-status result-win';
        const centerEl = document.getElementById('gs-status-center');
        if (centerEl) centerEl.textContent = 'THẮNG!';
        const rightEl = document.getElementById('gs-status-right');
        if (rightEl) {
          rightEl.textContent = '+' + totalPts;
          rightEl.className = 'stat-profit positive';
        }
      }

      // Show inline result
      document.getElementById('res-emoji').textContent = '🏆';
      document.getElementById('res-title').textContent = 'Bạn đoán đúng!';
      document.getElementById('res-sub').textContent = 'Số bí mật là ' + this.secret;
      document.getElementById('res-rewards').innerHTML =
        '<div><span class="rwd-val">+' + totalPts + '</span><span class="rwd-lbl">Điểm' + buffText + '</span></div>';
      document.getElementById('gs-result').classList.remove('hidden');

      this.spawnPop('+' + totalPts);
      return;
    }

    // ── WRONG ──
    this.attempts.push({ val, result: val < this.secret ? 'low' : 'high' });

    if (val < this.secret) {
      hint.textContent = 'Số cần tìm nhỏ hơn ' + val;
      hint.className = 'gs-hint low';
      if (val > this.rangeMin) this.rangeMin = val;
      badge.classList.add('low');
      badge.textContent = val + ' ↑';
    } else {
      hint.textContent = 'Số cần tìm lớn hơn ' + val;
      hint.className = 'gs-hint high';
      if (val < this.rangeMax) this.rangeMax = val;
      badge.classList.add('high');
      badge.textContent = val + ' ↓';
    }

    document.getElementById('gs-history').appendChild(badge);
    document.getElementById('gs-attempts').textContent = this.maxAttempts - this.attempts.length;
    this.renderDots();
    this.updateRange();
    this.updateStatusBar();

    // ── OUT OF ATTEMPTS ──
    if (this.attempts.length >= this.maxAttempts) {
      this.over = true;
      hint.textContent = 'Hết lượt! Số bí mật là ' + this.secret;
      hint.className = 'gs-hint high';
      inp.disabled = true;
      document.getElementById('guess-btn').disabled = true;

      const bcStatus = document.getElementById('bc-status');
      if (bcStatus) {
        bcStatus.className = 'bc-status result-lose';
        const centerEl = document.getElementById('gs-status-center');
        if (centerEl) centerEl.textContent = 'THUA!';
        const rightEl = document.getElementById('gs-status-right');
        if (rightEl) {
          rightEl.textContent = '0';
          rightEl.className = 'stat-profit negative';
        }
      }

      document.getElementById('res-emoji').textContent = '😔';
      document.getElementById('res-title').textContent = 'Hết lượt rồi!';
      document.getElementById('res-sub').textContent = 'Số bí mật là ' + this.secret;
      document.getElementById('res-rewards').innerHTML = '';
      document.getElementById('gs-result').classList.remove('hidden');
    }
  },

  // ── UI HELPERS ─────────────────────────────────────
  renderDots() {
    const d = document.getElementById('gs-dots');
    d.innerHTML = '';
    for (let i = 0; i < this.maxAttempts; i++) {
      const dot = document.createElement('div');
      dot.className = 'gs-dot';
      if (i < this.attempts.length) {
        dot.classList.add(this.attempts[i].result);
      }
      d.appendChild(dot);
    }
  },

  updateRange() {
    document.getElementById('gs-range-min').textContent = this.rangeMin;
    document.getElementById('gs-range-max').textContent = this.rangeMax;
    const pct = this.maxNum > 0 ? ((this.rangeMax - this.rangeMin) / this.maxNum) * 100 : 100;
    document.getElementById('gs-range-fill').style.width = pct + '%';
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

  backToMenu() {
    this.hideStatusBar();
    this.show('screen-menu');
    document.getElementById('gs-result').classList.add('hidden');
  },

  // ── INIT ───────────────────────────────────────────
  init() {
    // Leave action
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => { this.backToMenu(); });
    }

    // Enter key submits
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const gameScreen = document.getElementById('screen-game');
        if (gameScreen && !gameScreen.classList.contains('hidden')) {
          this.guess();
        }
      }
    });

    this.maxNum = 100;
    this.maxAttempts = MAX_ATTEMPTS[this.maxNum] || 10;
  }
};

// ===== EXPORT GLOBALS =====
window.Guess = Guess;

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../../index.html'; return; }
  Guess.init();
});

// ===== PARTICLES (inline in HTML) =====
// (handled by inline script in guess.html)
