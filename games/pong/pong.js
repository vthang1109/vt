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

// ===== GAME CONSTANTS (Vertical Pong) =====
const WIN_SCORE = 5;
const PADDLE_LENGTH = 70;
const PADDLE_THICK = 10;
const BALL_SIZE = 7;
const BALL_SPEED_INITIAL = 5;
const BALL_SPEED_MAX = 10;
const BALL_SPEED_INCREMENT = 0.15;

const Pong = {
  canvas: null,
  ctx: null,
  canvasW: 300,
  canvasH: 480,

  mode: null,
  difficulty: 'medium',
  state: 'menu',
  animFrame: null,

  // Player (BOTTOM), AI/opponent (TOP)
  playerPaddle: { x: 0, y: 0, w: PADDLE_LENGTH, h: PADDLE_THICK, score: 0 },
  aiPaddle:    { x: 0, y: 0, w: PADDLE_LENGTH, h: PADDLE_THICK, score: 0 },

  ball: { x: 0, y: 0, r: BALL_SIZE, dx: 0, dy: 0, speed: BALL_SPEED_INITIAL },

  // Controls: drag state + keyboard
  isDragging: false,
  dragTarget: null,
  keys: { ArrowLeft: false, ArrowRight: false, a: false, d: false },
  _aiFrameCount: 0,

  init() {
    this.canvas = document.getElementById('pong-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // TopNav: add "Rời game" button in hamburger menu
    if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
      window.TopNav.setLeaveAction(() => {
        this.stopGame();
        window.location.href = '../../games.html';
      });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Escape') this.togglePause();
      if (e.key === 'Enter') {
        if (this.state === 'menu') this.start('ai');
        else if (this.state === 'over') this.showMenu();
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

    // Mouse/touch drag on canvas
    const canvas = this.canvas;
    canvas.addEventListener('mousedown', (e) => this.startDrag(e));
    canvas.addEventListener('mousemove', (e) => this.onDrag(e));
    canvas.addEventListener('mouseup', () => this.endDrag());
    canvas.addEventListener('mouseleave', () => this.endDrag());
    canvas.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
    canvas.addEventListener('touchend', () => this.endDrag());

    this.showMenu();
  },

  resizeCanvas() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 10 || h < 10) return;
    this.canvasW = w;
    this.canvasH = h;
    this.canvas.width = w;
    this.canvas.height = h;
  },

  showScreen(id) {
    document.querySelectorAll('.pong-screen').forEach(s => {
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
    this.stopGame();
    this.showScreen('screen-menu');
    document.getElementById('diff-section').style.display = 'flex';
    this.state = 'menu';
    // Reset drag hint text
    const hint = document.querySelector('.pong-drag-hint');
    if (hint) hint.textContent = '🖱 Kéo vợt để di chuyển';
    // Ẩn status bar ở màn hình chọn chế độ
    const bcStatus = document.getElementById('bc-status');
    if (bcStatus) bcStatus.style.display = 'none';
  },

  setDifficulty(diff) {
    this.difficulty = diff;
    document.querySelectorAll('.pong-diff-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.pong-diff-btn[data-diff="${diff}"]`).classList.add('active');
  },

  // ===== START GAME =====
  start(mode) {
    this.mode = mode;

    this.resetBall();
    this.playerPaddle.score = 0;
    this.aiPaddle.score = 0;
    this._aiFrameCount = 0;

    // Hiện status bar khi bắt đầu game
    const bcStatus = document.getElementById('bc-status');
    if (bcStatus) bcStatus.style.display = '';

    // Player at BOTTOM, AI at TOP
    this.playerPaddle.y = this.canvasH - 10 - PADDLE_THICK;
    this.playerPaddle.x = this.canvasW / 2 - PADDLE_LENGTH / 2;
    this.aiPaddle.y = 10;
    this.aiPaddle.x = this.canvasW / 2 - PADDLE_LENGTH / 2;

    if (mode === 'local') {
      this.setStatusBar('local');
      const hint = document.querySelector('.pong-drag-hint');
      if (hint) hint.textContent = '🖱 Kéo nửa màn hình · ▲▼ / A/D';
    } else {
      this.setStatusBar('ai');
    }

    this.showScreen('screen-game');
    this.resizeCanvas();
    document.getElementById('diff-section').style.display = 'none';
    this.state = 'playing';
    this.setStatus('🏓 Giao bóng!');

    this.gameLoop();
  },

  updateScoreDisplay() {
    // Update status bar center with colored spans
    const statusEl = document.getElementById('pong-status-text');
    if (statusEl) {
      statusEl.innerHTML = '<span class="sc-blue">' + this.playerPaddle.score + '</span><span class="sc-sep"> - </span><span class="sc-red">' + this.aiPaddle.score + '</span>';
    }
  },

  setStatusBar(type) {
    const nameEl = document.getElementById('pong-player-name');
    const opponentEl = document.getElementById('pong-opponent-name');
    const statusEl = document.getElementById('pong-status-text');
    const score0 = '<span class="sc-blue">0</span><span class="sc-sep"> - </span><span class="sc-red">0</span>';

    document.getElementById('bc-status')?.classList.remove('result-win', 'result-lose');

    if (type === 'local') {
      if (nameEl) nameEl.textContent = 'P1';
      if (opponentEl) opponentEl.textContent = 'P2';
    } else {
      if (nameEl) nameEl.textContent = 'Bạn';
      if (opponentEl) opponentEl.textContent = 'Máy';
    }
    if (statusEl) statusEl.innerHTML = score0;
  },

  showResult(emoji, title, scoreText, earned, resultKind) {
    document.getElementById('res-emoji').textContent = emoji;
    document.getElementById('res-title').textContent = title;
    document.getElementById('res-score').textContent = scoreText;
    document.getElementById('res-earned').textContent = earned;

    // Update status bar
    const bcStatus = document.getElementById('bc-status');
    bcStatus?.classList.remove('result-win', 'result-lose');
    bcStatus?.classList.add(resultKind === 'win' ? 'result-win' : 'result-lose');

    const nameEl = document.getElementById('pong-player-name');
    const opponentEl = document.getElementById('pong-opponent-name');
    const statusEl = document.getElementById('pong-status-text');

    if (statusEl) statusEl.innerHTML = resultKind === 'win'
      ? '<span class="sc-green">Thắng!</span>'
      : '<span class="sc-red">Thua!</span>';
    if (nameEl) nameEl.textContent = 'Bạn';
    if (opponentEl) {
      const num = earned.replace('+', '');
      opponentEl.innerHTML = num !== '0' ? '<span class="sc-green">+' + num + '</span>' : '';
    }

    this.showScreen('screen-result');
  },

  // ===== BALL =====
  resetBall(dir) {
    this.ball.x = this.canvasW / 2;
    this.ball.y = this.canvasH / 2;
    this.ball.speed = BALL_SPEED_INITIAL;
    const angle = (Math.random() * 0.8 - 0.4);
    const baseDir = dir || (Math.random() > 0.5 ? 1 : -1);
    this.ball.dx = Math.sin(angle);
    this.ball.dy = baseDir * Math.cos(angle);
  },

  // ===== GAME LOOP =====
  gameLoop() {
    if (this.state === 'over' || this.state === 'menu') return;
    this.update();
    this.draw();
    this.animFrame = requestAnimationFrame(() => this.gameLoop());
  },

  stopGame() {
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
    this.state = 'menu';
    this.isDragging = false;
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.setStatus('⏸ Đã tạm dừng');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.setStatus('▶ Tiếp tục!');
      this.gameLoop();
    }
  },

  // ===== DRAG CONTROLS =====
  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (this.canvasW / rect.width),
      y: (clientY - rect.top) * (this.canvasH / rect.height)
    };
  },

  startDrag(e) {
    if (this.state !== 'playing') return;
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    const pp = this.playerPaddle;
    const ap = this.aiPaddle;

    // Check if clicking on player paddle (bottom)
    if (pos.y >= pp.y - 10 && pos.y <= pp.y + pp.h + 10 &&
        pos.x >= pp.x - 10 && pos.x <= pp.x + pp.w + 10) {
      this.isDragging = true;
      this.dragTarget = 'player';
      return;
    }

    // In local 2-player: check if clicking on AI paddle (top)
    if (this.mode === 'local') {
      if (pos.y >= ap.y - 10 && pos.y <= ap.y + ap.h + 10 &&
          pos.x >= ap.x - 10 && pos.x <= ap.x + ap.w + 10) {
        this.isDragging = true;
        this.dragTarget = 'ai';
        return;
      }
    }

    // Click in lower half -> drag player (bottom)
    if (pos.y > this.canvasH / 2) {
      this.isDragging = true;
      this.dragTarget = 'player';
    }
    // In local 2-player: click in upper half -> drag AI (top)
    else if (this.mode === 'local') {
      this.isDragging = true;
      this.dragTarget = 'ai';
    }
  },

  onDrag(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    if (this.dragTarget === 'player') {
      this.playerPaddle.x = pos.x - this.playerPaddle.w / 2;
    } else if (this.dragTarget === 'ai') {
      this.aiPaddle.x = Math.max(0, Math.min(this.canvasW - this.aiPaddle.w, pos.x - this.aiPaddle.w / 2));
    }
  },

  endDrag() {
    this.isDragging = false;
    this.dragTarget = null;
  },

  // ===== UPDATE =====
  update() {
    if (this.state !== 'playing') return;
    const { canvas, ball, playerPaddle: pp, aiPaddle: ap, keys, mode, difficulty } = this;

    // Keyboard controls
    const speed = 4;
    if (mode === 'local') {
      // Local 2-player: Arrow keys for P1 (bottom), A/D for P2 (top)
      if (keys['ArrowLeft']) pp.x -= speed;
      if (keys['ArrowRight']) pp.x += speed;
      if (keys['a'] || keys['A']) ap.x -= speed;
      if (keys['d'] || keys['D']) ap.x += speed;
    } else {
      // AI mode: both Arrow keys and A/D control player (bottom)
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) pp.x -= speed;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) pp.x += speed;
    }
    pp.x = Math.max(0, Math.min(canvas.width - pp.w, pp.x));

    // AI Movement (AI at TOP) — 3 cấp độ rõ rệt
    if (mode === 'ai') {
      const aiCfg = {
        easy:   { speed: 1.0, error: 40, deadZone: 15 },
        medium: { speed: 2.2, error: 12, deadZone: 8 },
        hard:   { speed: 3.8, error: 0,  deadZone: 4 }
      };
      const cfg = aiCfg[difficulty] || aiCfg.medium;
      const targetX = ball.x - ap.w / 2;
      const diff = targetX - ap.x;
      // Chỉ di chuyển khi bóng lệch khỏi dead zone
      if (Math.abs(diff) > cfg.deadZone) {
        // Easy: phản ứng chậm + sai số ngẫu nhiên
        if (difficulty === 'easy') {
          this._aiFrameCount++;
          // Easy chỉ update vị trí mỗi 3 frame (tạo độ trễ phản xạ)
          if (this._aiFrameCount % 3 === 0) {
            const error = (Math.random() - 0.5) * cfg.error * 2;
            ap.x += Math.sign(diff + error) * cfg.speed;
          }
        } else {
          ap.x += Math.sign(diff) * cfg.speed;
        }
      }
    }
    ap.x = Math.max(0, Math.min(canvas.width - ap.w, ap.x));

    // Ball movement
    ball.x += ball.dx * ball.speed;
    ball.y += ball.dy * ball.speed;

    // Wall bounce (left/right)
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.dx = Math.abs(ball.dx); }
    if (ball.x + ball.r > canvas.width) { ball.x = canvas.width - ball.r; ball.dx = -Math.abs(ball.dx); }

    // AI paddle (TOP) collision: ball moving UP
    if (ball.dy < 0 &&
        ball.y - ball.r < ap.y + ap.h &&
        ball.y - ball.r > ap.y - 6 &&
        ball.x > ap.x && ball.x < ap.x + ap.w) {
      const hitPos = (ball.x - (ap.x + ap.w / 2)) / (ap.w / 2);
      const angle = hitPos * 0.8;
      ball.dx = Math.sin(angle);
      ball.dy = Math.cos(angle); // Bounce DOWN
      ball.y = ap.y + ap.h + ball.r;
      ball.speed = Math.min(BALL_SPEED_MAX, ball.speed + BALL_SPEED_INCREMENT);
    }

    // Player paddle (BOTTOM) collision: ball moving DOWN
    if (ball.dy > 0 &&
        ball.y + ball.r > pp.y &&
        ball.y + ball.r < pp.y + pp.h + 6 &&
        ball.x > pp.x && ball.x < pp.x + pp.w) {
      const hitPos = (ball.x - (pp.x + pp.w / 2)) / (pp.w / 2);
      const angle = hitPos * 0.8;
      ball.dx = Math.sin(angle);
      ball.dy = -Math.cos(angle); // Bounce UP
      ball.y = pp.y - ball.r;
      ball.speed = Math.min(BALL_SPEED_MAX, ball.speed + BALL_SPEED_INCREMENT);
    }

    // Scoring: ball past TOP = Player scores, ball past BOTTOM = AI scores
    if (ball.y < -20) {
      this.scoreGoal('player'); // Ball past top (AI's side) -> Player scores
    } else if (ball.y > canvas.height + 20) {
      this.scoreGoal('ai'); // Ball past bottom (Player's side) -> AI scores
    }
  },

  // ===== SCORE GOAL =====
  async scoreGoal(side) {
    if (this.state === 'goal' || this.state === 'over') return;
    this.state = 'goal';

    if (side === 'ai') {
      this.aiPaddle.score++;
    } else {
      this.playerPaddle.score++;
    }

    this.updateScoreDisplay();

    const scoreWord = side === 'player' ? 'Bạn' : 'Máy';
    this.setStatus(scoreWord + ' ghi điểm!', true);

    if (this.playerPaddle.score >= WIN_SCORE || this.aiPaddle.score >= WIN_SCORE) {
      setTimeout(() => this.endGame(), 800);
    } else {
      setTimeout(() => {
        this.resetBall(side === 'player' ? 1 : -1);
        this.state = 'playing';
        this.setStatus('Tiếp tục!');
      }, 800);
    }
  },

  // ===== END GAME =====
  async endGame() {
    this.state = 'over';
    const won = this.playerPaddle.score >= WIN_SCORE;
    const diffPts = { easy: 50, medium: 100, hard: 150 };
    const pts = won ? (diffPts[this.difficulty] || 100) : 0;

    // Fetch pet buff before showing result
    let buffBonus = 0, buffPct = 0, petLabel = '';
    let totalPts = pts;
    const canAward = auth.currentUser && pts > 0 && this.mode !== 'local';
    if (canAward) {
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

    this.showResult(
      won ? '🏆' : '😢',
      won ? 'Bạn thắng!' : 'Bạn thua!',
      `${this.playerPaddle.score} - ${this.aiPaddle.score}`,
      '+' + totalPts,
      won ? 'win' : 'lose'
    );
    this.setStatus('');

    // Award points + pet buff toast
    if (canAward) {
      try {
        await addPoints('Pong', 'Thắng ván Pong', totalPts);
        if (buffBonus > 0 && window.showToast) {
          window.showToast(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
        }
        this.refreshPts();
      } catch {}
    }
  },

  // ===== DRAW =====
  draw() {
    const { ctx, canvas, ball, playerPaddle: pp, aiPaddle: ap, state } = this;

    ctx.fillStyle = '#041428';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center line
    ctx.strokeStyle = 'rgba(56,189,248,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center circle
    ctx.strokeStyle = 'rgba(56,189,248,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Player paddle (BOTTOM) - blue
    this.drawPaddle(pp.x, pp.y, pp.w, pp.h, '#38bdf8');
    // AI paddle (TOP) - red
    this.drawPaddle(ap.x, ap.y, ap.w, ap.h, '#ef4444');

    // Ball
    if (state !== 'goal' || Math.floor(Date.now() / 200) % 2 === 0) {
      const grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 3);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Speed indicator
    ctx.fillStyle = 'rgba(56,189,248,0.15)';
    ctx.font = '9px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${(ball.speed / BALL_SPEED_INITIAL).toFixed(1)}x`, canvas.width / 2, canvas.height - 6);

    // Pause overlay
    if (state === 'paused') {
      let overlay = document.querySelector('.pong-pause-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pong-pause-overlay';
        overlay.innerHTML = '<span>⏸ PAUSED</span>';
        document.querySelector('.pong-canvas-border').appendChild(overlay);
      }
      overlay.style.display = 'flex';
    } else {
      const overlay = document.querySelector('.pong-pause-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  },

  drawPaddle(x, y, w, h, color) {
    const { ctx } = this;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    const r = 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(255,255,255,0.15)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
  },

  // ===== UTILITIES =====
  setStatus(text, flash = false) {
    const el = document.getElementById('pong-status');
    if (!el) return;
    el.textContent = text;
    if (flash) {
      el.classList.remove('goal');
      void el.offsetWidth;
      el.classList.add('goal');
    }
  },

  async refreshPts() {
    try {
      const p = await getPoints();
      const nav = document.getElementById('nav-pts');
      if (nav) nav.textContent = '⭐ ' + p.toLocaleString();
    } catch {}
  }
};

// ===== AUTH =====
onAuthStateChanged(auth, user => {
  if (user) Pong.refreshPts();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  Pong.init();
});

window.Pong = Pong;
