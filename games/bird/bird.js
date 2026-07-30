import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from '../../points.js';

// ===== FIREBASE =====
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

// ===== DOM REFS =====
const canvas = document.getElementById('bird-canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

// ===== STATUS BAR (shared bc-status) =====
const statusBar = document.getElementById('bc-status');
const leftLabel = document.getElementById('b-left');
const centerLabel = document.getElementById('b-center');
const rightLabel = document.getElementById('b-right');

// ===== HIGH SCORE =====
const HS_KEY = 'vt_flappy_bird_hs';
function getHighScore() {
  try { return parseInt(localStorage.getItem(HS_KEY)) || 0; } catch { return 0; }
}
function setHighScore(s) {
  try { localStorage.setItem(HS_KEY, String(s)); } catch {}
}

// ===== CONSTANTS =====
const GRAVITY = 0.45;
const FLAP_VEL = -6.2;
const PIPE_W = 48;
const PIPE_SPEED_BASE = 2.2;
const PIPE_SPAWN_INTERVAL = 95; // frames
const GROUND_H_RATIO = 0.12;
const BIRD_SIZE_RATIO = 0.05;

// ===== STATE =====
let bird, pipes, clouds, stars, score, frameCount, pipesPassed;
let gameLoop;
let isPlaying = false, isPaused = false, isGameOver = false;
let gameSpeed = PIPE_SPEED_BASE;
let highScore = getHighScore();

// ===== CANVAS SIZING =====
let cw, ch, groundH, birdR, pipeGap, pipeSpawnTimer;

function resizeCanvas() {
  const rect = wrapper.getBoundingClientRect();
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  cw = canvas.width;
  ch = canvas.height;
  groundH = Math.round(ch * GROUND_H_RATIO);
  birdR = Math.round(cw * BIRD_SIZE_RATIO);
  pipeGap = Math.max(140, Math.round(ch * 0.30));
}

// ===== OBJECTS =====
function createBird() {
  return {
    x: cw * 0.25,
    y: ch * 0.4,
    r: birdR,
    v: 0,
    rotation: 0,
    wingPhase: 0,
  };
}

function createPipe(x) {
  const minTop = 40;
  const maxTop = ch - groundH - pipeGap - 40;
  const topH = minTop + Math.random() * (maxTop - minTop);
  const bottomY = topH + pipeGap;
  return {
    x,
    w: PIPE_W,
    topH,
    bottomY,
    scored: false,
  };
}

function createCloud() {
  return {
    x: Math.random() * cw,
    y: 10 + Math.random() * (ch * 0.35),
    w: 30 + Math.random() * 50,
    speed: 0.15 + Math.random() * 0.25,
    opacity: 0.15 + Math.random() * 0.25,
  };
}

function createStar() {
  return {
    x: Math.random() * cw,
    y: Math.random() * (ch * 0.35),
    r: 0.5 + Math.random() * 1.2,
    twinkle: Math.random() * Math.PI * 2,
    speed: 0.02 + Math.random() * 0.03,
  };
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.bird-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ===== INIT =====
function initGame() {
  resizeCanvas();
  bird = createBird();
  pipes = [];
  clouds = Array.from({ length: 5 }, () => createCloud());
  stars = Array.from({ length: 12 }, () => createStar());
  score = 0;
  frameCount = 0;
  pipesPassed = 0;
  gameSpeed = PIPE_SPEED_BASE;
  pipeSpawnTimer = 0;
  isPlaying = false;
  isPaused = false;
  isGameOver = false;
  document.getElementById('game-hint').style.display = 'block';
  document.getElementById('pause-overlay').classList.remove('active');
  // Show & reset status bar
  if (statusBar) {
    statusBar.style.display = '';
    statusBar.className = 'bc-status';
    if (leftLabel) leftLabel.textContent = '🐦';
    if (centerLabel) centerLabel.textContent = '0';
    if (rightLabel) { rightLabel.textContent = '0'; rightLabel.className = 'stat-profit zero'; }
  }
  // Show pause button
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.style.display = '';
}

// ===== PHYSICS & UPDATE =====
function update() {
  if (!isPlaying || isPaused || isGameOver) return;
  frameCount++;

  // Speed up gradually
  if (frameCount % 500 === 0) gameSpeed += 0.15;

  // Bird physics
  bird.v += GRAVITY;
  bird.y += bird.v;

  // Rotation based on velocity
  const targetRot = bird.v < -1 ? -0.5 : bird.v > 2 ? 1.2 : bird.v * 0.2;
  bird.rotation += (targetRot - bird.rotation) * 0.12;

  // Wing animation
  bird.wingPhase += 0.15;

  // Ground collision
  if (bird.y + bird.r > ch - groundH) {
    bird.y = ch - groundH - bird.r;
    endGame();
    return;
  }

  // Ceiling collision (nhẹ, không chết ngay)
  if (bird.y - bird.r < -10) {
    bird.y = -10 + bird.r;
    bird.v = 0;
  }

  // Spawn pipes
  pipeSpawnTimer++;
  if (pipeSpawnTimer >= PIPE_SPAWN_INTERVAL) {
    pipeSpawnTimer = 0;
    pipes.push(createPipe(cw + 20));
  }

  // Update pipes
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= gameSpeed;

    // Collision detection
    const bx = bird.x, by = bird.y, br = bird.r;

    // Pipe body collision (using AABB approximation)
    const px = p.x, pw = p.w;
    const topRect = { x: px, y: 0, w: pw, h: p.topH };
    const botRect = { x: px, y: p.bottomY, w: pw, h: ch - p.bottomY };

    if (circleRectCollision(bx, by, br, topRect) || circleRectCollision(bx, by, br, botRect)) {
      endGame();
      return;
    }

    // Score: bird passed the pipe
    if (!p.scored && p.x + pw < bird.x) {
      p.scored = true;
      score++;
      pipesPassed++;
      if (centerLabel) centerLabel.textContent = score;
    }

    // Remove off-screen pipes
    if (p.x + pw < -10) {
      pipes.splice(i, 1);
    }
  }

  // Update clouds
  clouds.forEach(c => {
    c.x -= gameSpeed * c.speed * 0.3;
    if (c.x + c.w < -20) {
      c.x = cw + 20;
      c.y = 10 + Math.random() * (ch * 0.3);
    }
  });

  // Update stars
  stars.forEach(s => {
    s.twinkle += s.speed;
  });
}

function circleRectCollision(cx, cy, cr, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return (dx * dx + dy * dy) < (cr * cr);
}

// ===== RENDER =====
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // --- Sky gradient ---
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ch * 0.7);
  skyGrad.addColorStop(0, '#0c1a30');
  skyGrad.addColorStop(0.3, '#1a3a5c');
  skyGrad.addColorStop(0.55, '#3a7bb5');
  skyGrad.addColorStop(0.75, '#6ab0d6');
  skyGrad.addColorStop(1, '#87ceeb');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, cw, ch);

  // --- Stars ---
  stars.forEach(s => {
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.twinkle));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  });

  // --- Clouds ---
  clouds.forEach(c => {
    ctx.globalAlpha = c.opacity;
    ctx.fillStyle = '#ffffff';
    // Cloud shape: 3 overlapping circles
    const r = c.w * 0.3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.arc(c.x - r * 0.7, c.y + r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(c.x + r * 0.7, c.y + r * 0.15, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // --- Distant hills ---
  ctx.fillStyle = 'rgba(34,85,51,0.15)';
  ctx.beginPath();
  ctx.moveTo(0, ch - groundH);
  for (let x = 0; x <= cw; x += 2) {
    const y = ch - groundH - 8 - Math.sin(x * 0.008 + 1) * 12 - Math.sin(x * 0.015) * 6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cw, ch - groundH);
  ctx.closePath();
  ctx.fill();

  // --- Pipes ---
  pipes.forEach(p => {
    const grad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
    grad.addColorStop(0, '#2d7a3a');
    grad.addColorStop(0.3, '#4aaf5a');
    grad.addColorStop(0.5, '#5cc46a');
    grad.addColorStop(0.7, '#4aaf5a');
    grad.addColorStop(1, '#2d7a3a');

    // Top pipe
    const lipH = 8;
    const lipExtra = 6;
    ctx.fillStyle = grad;
    ctx.fillRect(p.x + 2, 0, p.w - 4, p.topH);

    // Top lip
    ctx.fillStyle = '#3a9a48';
    ctx.fillRect(p.x - lipExtra, p.topH - lipH, p.w + lipExtra * 2, lipH);
    ctx.fillStyle = '#5cc46a';
    ctx.fillRect(p.x - lipExtra + 3, p.topH - lipH + 2, p.w + lipExtra * 2 - 6, lipH - 4);

    // Bottom pipe
    ctx.fillStyle = grad;
    ctx.fillRect(p.x + 2, p.bottomY, p.w - 4, ch - p.bottomY);

    // Bottom lip
    ctx.fillStyle = '#3a9a48';
    ctx.fillRect(p.x - lipExtra, p.bottomY, p.w + lipExtra * 2, lipH);
    ctx.fillStyle = '#5cc46a';
    ctx.fillRect(p.x - lipExtra + 3, p.bottomY + 2, p.w + lipExtra * 2 - 6, lipH - 4);

    // Pipe border detail
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x + 2, 0, p.w - 4, p.topH);
    ctx.strokeRect(p.x + 2, p.bottomY, p.w - 4, ch - p.bottomY);
  });

  // --- Ground ---
  const groundGrad = ctx.createLinearGradient(0, ch - groundH, 0, ch);
  groundGrad.addColorStop(0, '#4a7a2a');
  groundGrad.addColorStop(0.15, '#5c8c34');
  groundGrad.addColorStop(0.5, '#6b9e3e');
  groundGrad.addColorStop(1, '#4a7a2a');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, ch - groundH, cw, groundH);

  // Ground top line (grass)
  ctx.fillStyle = '#7ab84a';
  ctx.fillRect(0, ch - groundH, cw, 3);

  // Ground detail stripes
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < cw; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x + (frameCount * 0.5) % 20, ch - groundH + 5);
    ctx.lineTo(x + (frameCount * 0.5) % 20 + 10, ch - 2);
    ctx.stroke();
  }

  // --- Bird ---
  if (!isGameOver || (isGameOver && Math.floor(frameCount / 6) % 2 === 0)) {
    drawBird(bird.x, bird.y, bird.r, bird.rotation, bird.wingPhase);
  }

  // --- Score in center (when playing) ---
  if (isPlaying && !isPaused && !isGameOver) {
    ctx.save();
    ctx.font = `bold ${Math.round(cw * 0.14)}px 'Science Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, cw / 2, ch * 0.12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  if (!isGameOver && !isPaused) {
    update();
    gameLoop = requestAnimationFrame(draw);
  }
}

function drawBird(x, y, r, rotation, wingPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Body shadow
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  // Body
  const bodyGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r);
  bodyGrad.addColorStop(0, '#fcd34d');
  bodyGrad.addColorStop(0.6, '#f59e0b');
  bodyGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shadow reset
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Wing
  const wingY = Math.sin(wingPhase) * r * 0.2;
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, wingY - r * 0.05, r * 0.55, r * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Belly highlight
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.25, r * 0.35, r * 0.2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.25, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(r * 0.4, -r * 0.25, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.48, -r * 0.32, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(r * 0.6, -r * 0.05);
  ctx.lineTo(r * 1.05, r * 0.1);
  ctx.lineTo(r * 0.6, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Beak line
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r * 0.6, r * 0.08);
  ctx.lineTo(r * 1.0, r * 0.1);
  ctx.stroke();

  // Tail feathers
  ctx.fillStyle = '#b45309';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, i * r * 0.15);
    ctx.lineTo(-r * 0.95, i * r * 0.25 - r * 0.05);
    ctx.lineTo(-r * 0.7, i * r * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ===== FLAP =====
function flap() {
  if (isGameOver || isPaused) return;
  if (!isPlaying) {
    isPlaying = true;
    document.getElementById('game-hint').style.display = 'none';
  }
  bird.v = FLAP_VEL;
}

// ===== GAME OVER =====
async function endGame() {
  if (isGameOver) return;
  isGameOver = true;

  // Update high score
  if (score > highScore) {
    highScore = score;
    setHighScore(score);
  }

  // Cancel any pending animation frame
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }

  // Calculate earned points: 10 stars per pipe passed
  let earned = Math.floor(pipesPassed * 10);

  // Admin force (for testing)
  if (window.__ADMIN_FORCED_RESULT === 'win') earned = 1000;
  else if (window.__ADMIN_FORCED_RESULT === 'lose') earned = 0;

  document.getElementById('final-score').textContent = score;
  document.getElementById('best-score').textContent = highScore;
  document.getElementById('earned-pts').textContent = '+' + earned;
  document.getElementById('pipes-passed').textContent = pipesPassed;

  // Update status bar with result
  if (statusBar) {
    statusBar.className = 'bc-status ' + (earned > 0 ? 'result-win' : 'result-lose');
    if (centerLabel) centerLabel.textContent = score;
    if (rightLabel) {
      rightLabel.textContent = '+' + earned;
      rightLabel.className = 'stat-profit ' + (earned > 0 ? 'positive' : 'zero');
    }
  }
  // Hide pause button
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.style.display = 'none';

  setTimeout(() => {
    showScreen('screen-result');
  }, 400);

  if (auth.currentUser && earned > 0) {
    try {
      await addPoints('Flappy Bird', 'Bay cao 🐦', earned);
    } catch (e) {
      console.warn('addPoints error:', e);
    }
  }
}

// ===== EVENT HANDLERS =====
// Menu → Game
document.getElementById('btn-start').addEventListener('click', () => {
  showScreen('screen-game');
  initGame();
  draw();
});

// Restart → Game
document.getElementById('btn-restart').addEventListener('click', () => {
  showScreen('screen-game');
  initGame();
  draw();
});

// Home → Menu
document.getElementById('btn-home').addEventListener('click', () => {
  showScreen('screen-menu');
  document.getElementById('highscore-display').textContent = highScore;
  // Hide status bar & pause button
  if (statusBar) statusBar.style.display = 'none';
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.style.display = 'none';
});

// Pause
document.getElementById('btn-pause').addEventListener('click', (e) => {
  e.stopPropagation();
  if (isGameOver) return;
  isPaused = !isPaused;
  document.getElementById('pause-overlay').classList.toggle('active', isPaused);
  if (!isPaused && !isGameOver) draw();
});

// Resume
document.getElementById('btn-resume').addEventListener('click', () => {
  isPaused = false;
  document.getElementById('pause-overlay').classList.remove('active');
  if (!isGameOver) draw();
});

// Click/tap to flap
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  flap();
});

canvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  flap();
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    flap();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (isPlaying && !isGameOver) {
      isPaused = !isPaused;
      document.getElementById('pause-overlay').classList.toggle('active', isPaused);
      if (!isPaused && !isGameOver) draw();
    }
  }
});

// ===== POINTS SYNC =====
async function refreshPts() {
  const p = await getPoints();
  const el = document.getElementById('nav-pts');
  if (el) el.textContent = '⭐ ' + p.toLocaleString();
}

onAuthStateChanged(auth, user => {
  if (user) {
    refreshPts();
    document.getElementById('highscore-display').textContent = highScore;
  }
});

// ===== LEAVE GAME =====
setTimeout(() => {
  if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
    window.TopNav.setLeaveAction(() => showScreen('screen-menu'));
  }
}, 100);

// ===== RESIZE =====
window.addEventListener('resize', () => {
  if (!isPlaying && !isGameOver) {
    resizeCanvas();
  }
});
