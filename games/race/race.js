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
const canvas = document.getElementById('race-canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

// ===== SHARED STATUS BAR =====
const statusBar = document.getElementById('bc-status');
const leftLabel = document.getElementById('r-left');
const centerLabel = document.getElementById('r-center');
const rightLabel = document.getElementById('r-right');

// ===== HIGH SCORE =====
const HS_KEY = 'vt_race_hs';
function getHighScore() {
  try { return parseInt(localStorage.getItem(HS_KEY)) || 0; } catch { return 0; }
}
function setHighScore(s) {
  try { localStorage.setItem(HS_KEY, String(s)); } catch {}
}

// ===== CONSTANTS =====
const ACCEL = 0.003;
const PLAYER_W_RATIO = 0.09;
const PLAYER_H_RATIO = 0.16;

const COLORS_RIVAL = [
  '#3b82f6','#a855f7','#ec4899','#f97316','#84cc16',
  '#06b6d4','#eab308','#f43f5e','#14b8a6','#8b5cf6',
];

// ===== STATE =====
let cw, ch, roadW, roadL, laneW, pW, pH, score, distance, frameCount, speed;
let player, rivals, roadOffset, gameLoop;
let isPlaying = false, isPaused = false, isGameOver = false;
let highScore = getHighScore();
let rivalSpawnTimer = 0;

// ===== CANVAS SIZING =====
function resizeCanvas() {
  const rect = wrapper.getBoundingClientRect();
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  cw = canvas.width;
  ch = canvas.height;
  roadW = Math.round(cw * 0.72);
  roadL = Math.round((cw - roadW) / 2);
  laneW = roadW / 3;
  pW = Math.round(cw * PLAYER_W_RATIO);
  pH = Math.round(cw * PLAYER_H_RATIO);
}

// ===== OBJECTS =====
function createPlayer() {
  return { x: cw / 2, y: ch * 0.78, w: pW, h: pH, targetX: cw / 2 };
}

function createRival() {
  const lanes = [0, 1, 2];
  const lane = lanes[Math.floor(Math.random() * 3)];
  return {
    x: roadL + lane * laneW + laneW / 2,
    y: -pH - Math.random() * 100,
    w: pW,
    h: pH,
    lane,
    speed: 1 + Math.random() * 1.5,
    color: COLORS_RIVAL[Math.floor(Math.random() * COLORS_RIVAL.length)],
    passed: false,
  };
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.race-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ===== INIT =====
function initGame() {
  resizeCanvas();
  player = createPlayer();
  rivals = [];
  score = 0;
  distance = 0;
  frameCount = 0;
  speed = 4;
  rivalSpawnTimer = 0;
  roadOffset = 0;
  isPlaying = false;
  isPaused = false;
  isGameOver = false;

  document.getElementById('game-hint').textContent = 'Chạm trái/phải để lạng';
  document.getElementById('game-hint').style.display = 'block';

  // Status bar
  if (statusBar) {
    statusBar.style.display = '';
    statusBar.className = 'bc-status';
    if (leftLabel) leftLabel.textContent = '🏎️';
    if (centerLabel) centerLabel.textContent = '0';
    if (rightLabel) { rightLabel.textContent = '0'; rightLabel.className = 'stat-profit zero'; }
  }
}

// ===== UPDATE =====
function update() {
  if (!isPlaying || isPaused || isGameOver) return;
  frameCount++;

  // Tăng tốc
  speed += ACCEL;

  // Road scroll (giả lập quãng đường)
  roadOffset = (roadOffset + speed) % 80;
  distance += Math.round(speed * 0.5);

  // Player smooth movement
  player.x += (player.targetX - player.x) * 0.18;

  // Spawn rival
  rivalSpawnTimer++;
  const spawnRate = Math.max(25, 55 - Math.floor(speed * 2));
  if (rivalSpawnTimer >= spawnRate) {
    rivalSpawnTimer = 0;
    // Không spawn trùng lane với rival gần nhất
    const tooClose = rivals.filter(r => r.y > -pH * 2 && r.y < ch * 0.3);
    const busyLanes = tooClose.map(r => r.lane);
    const avail = [0, 1, 2].filter(l => !busyLanes.includes(l));
    if (avail.length > 0) {
      const r = createRival();
      r.lane = avail[Math.floor(Math.random() * avail.length)];
      r.x = roadL + r.lane * laneW + laneW / 2;
      rivals.push(r);
    }
  }

  // Update rivals
  for (let i = rivals.length - 1; i >= 0; i--) {
    const r = rivals[i];
    r.y += (speed + r.speed) * 1.2;

    // Collision check (AABB)
    if (rectCollide(
      player.x - pW/2, player.y - pH/2, pW, pH,
      r.x - r.w/2, r.y - r.h/2, r.w, r.h
    )) {
      endGame();
      return;
    }

    // Score: rival passed player
    if (!r.passed && r.y > player.y + pH) {
      r.passed = true;
      score += Math.floor(speed * 3);
      if (centerLabel) centerLabel.textContent = score;
    }

    // Remove off-screen
    if (r.y > ch + 50) {
      rivals.splice(i, 1);
    }
  }
}

function rectCollide(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ===== RENDER =====
function draw() {
  ctx.clearRect(0, 0, cw, ch);

  // --- Nền tối ---
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, cw, ch);

  // --- Đường cao tốc ---
  // Mặt đường
  const grad = ctx.createLinearGradient(roadL, 0, roadL + roadW, 0);
  grad.addColorStop(0, '#2a2d3a');
  grad.addColorStop(0.15, '#3a3e4e');
  grad.addColorStop(0.5, '#444859');
  grad.addColorStop(0.85, '#3a3e4e');
  grad.addColorStop(1, '#2a2d3a');
  ctx.fillStyle = grad;
  ctx.fillRect(roadL, 0, roadW, ch);

  // Viền đường
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(roadL - 3, 0, 3, ch);
  ctx.fillRect(roadL + roadW, 0, 3, ch);

  // Vạch kẻ lane (chấm trắng chạy)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const dashH = 24;
  const gapH = 30;
  for (let lane = 1; lane <= 2; lane++) {
    const lx = roadL + lane * laneW - 1.5;
    for (let y = -dashH + (roadOffset % (dashH + gapH)); y < ch; y += dashH + gapH) {
      ctx.fillRect(lx, y, 3, dashH);
    }
  }

  // Vạch dọc 2 bên lề (reflector)
  for (let side = 0; side < 2; side++) {
    const sx = side === 0 ? roadL + 8 : roadL + roadW - 8;
    ctx.fillStyle = `rgba(255,200,50,${0.3 + 0.2 * Math.sin(frameCount * 0.05)})`;
    for (let y = (roadOffset * 0.5) % 60 - 60; y < ch; y += 60) {
      ctx.beginPath();
      ctx.arc(sx, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Rivals ---
  rivals.forEach(r => {
    drawCar(r.x, r.y, r.w, r.h, r.color);
  });

  // --- Player car ---
  if (!isGameOver || (isGameOver && Math.floor(frameCount / 5) % 2 === 0)) {
    drawCar(player.x, player.y, pW, pH, '#ef4444');
  }

  // --- Score overlay ---
  if (isPlaying && !isPaused && !isGameOver) {
    ctx.save();
    ctx.font = `bold ${Math.round(cw * 0.12)}px 'Science Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, cw / 2, ch * 0.08);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Speed indicator
    ctx.save();
    ctx.font = `600 ${Math.round(cw * 0.035)}px 'Science Gothic', sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${Math.round(speed * 20)} km/h`, cw - 12, ch - 8);
    ctx.restore();
  }

  if (!isGameOver && !isPaused) {
    update();
    gameLoop = requestAnimationFrame(draw);
  }
}

function drawCar(x, y, w, h, color) {
  ctx.save();
  ctx.translate(x, y);

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Thân xe (bo góc)
  const r = 5;
  const hw = w / 2, hh = h / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-hw + r, -hh);
  ctx.lineTo(hw - r, -hh);
  ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
  ctx.lineTo(hw, hh - r);
  ctx.quadraticCurveTo(hw, hh, hw - r, hh);
  ctx.lineTo(-hw + r, hh);
  ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
  ctx.lineTo(-hw, -hh + r);
  ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  ctx.closePath();
  ctx.fill();

  // Shadow reset
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Kính xe
  const glassH = h * 0.3;
  const glassW = w * 0.7;
  ctx.fillStyle = 'rgba(100,180,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(-glassW/2, -hh + 4);
  ctx.lineTo(glassW/2, -hh + 4);
  ctx.lineTo(glassW/2 + 3, -hh + 4 + glassH);
  ctx.lineTo(-glassW/2 - 3, -hh + 4 + glassH);
  ctx.closePath();
  ctx.fill();

  // Kính sau
  ctx.fillStyle = 'rgba(200,50,50,0.4)';
  ctx.beginPath();
  ctx.moveTo(-glassW/2, hh - 4);
  ctx.lineTo(glassW/2, hh - 4);
  ctx.lineTo(glassW/2 + 2, hh - 4 - glassH * 0.5);
  ctx.lineTo(-glassW/2 - 2, hh - 4 - glassH * 0.5);
  ctx.closePath();
  ctx.fill();

  // Đèn trước
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 6;
  const hlY = -hh + 3;
  ctx.fillRect(-hw + 3, hlY, 5, 4);
  ctx.fillRect(hw - 8, hlY, 5, 4);
  ctx.shadowBlur = 0;

  // Đèn sau
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 4;
  const tlY = hh - 6;
  ctx.fillRect(-hw + 3, tlY, 4, 3);
  ctx.fillRect(hw - 7, tlY, 4, 3);
  ctx.shadowBlur = 0;

  // Bánh xe (4 góc)
  ctx.fillStyle = '#1a1a2e';
  const tireW = 5, tireH = h * 0.2;
  ctx.fillRect(-hw - 2, -hh + 5, tireW, tireH);
  ctx.fillRect(hw - 3, -hh + 5, tireW, tireH);
  ctx.fillRect(-hw - 2, hh - 5 - tireH, tireW, tireH);
  ctx.fillRect(hw - 3, hh - 5 - tireH, tireW, tireH);

  // Lốp trắng (detail)
  ctx.fillStyle = 'rgba(50,50,60,0.6)';
  ctx.fillRect(-hw - 2, -hh + 5 + 2, tireW, 2);
  ctx.fillRect(hw - 3, -hh + 5 + 2, tireW, 2);
  ctx.fillRect(-hw - 2, hh - 5 - tireH + 2, tireW, 2);
  ctx.fillRect(hw - 3, hh - 5 - tireH + 2, tireW, 2);

  ctx.restore();
}

// ===== PLAYER INPUT =====
function movePlayer(direction) {
  if (isGameOver || isPaused) return;
  if (!isPlaying) {
    isPlaying = true;
    document.getElementById('game-hint').style.display = 'none';
  }
  const step = pW * 1.2;
  if (direction === 'left') {
    player.targetX = Math.max(roadL + laneW / 4, player.targetX - step);
  } else if (direction === 'right') {
    player.targetX = Math.min(roadL + roadW - laneW / 4, player.targetX + step);
  }
}

// ===== GAME OVER =====
async function endGame() {
  if (isGameOver) return;
  isGameOver = true;

  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }

  if (score > highScore) {
    highScore = score;
    setHighScore(score);
  }

  let earned = Math.floor(score / 100);

  if (window.__ADMIN_FORCED_RESULT === 'win') earned = 1000;
  else if (window.__ADMIN_FORCED_RESULT === 'lose') earned = 0;

  document.getElementById('final-score').textContent = score;
  document.getElementById('best-score').textContent = highScore;
  document.getElementById('earned-pts').textContent = '+' + earned;
  document.getElementById('distance').textContent = distance + 'm';

  if (statusBar) {
    statusBar.className = 'bc-status ' + (earned > 0 ? 'result-win' : 'result-lose');
    if (centerLabel) centerLabel.textContent = score;
    if (rightLabel) {
      rightLabel.textContent = '+' + earned;
      rightLabel.className = 'stat-profit ' + (earned > 0 ? 'positive' : 'zero');
    }
  }

  setTimeout(() => showScreen('screen-result'), 400);

  if (auth.currentUser && earned > 0) {
    try {
      await addPoints('Đua Xe', 'Lạng lách 🏎️', earned);
    } catch (e) {
      console.warn('addPoints error:', e);
    }
  }
}

// ===== EVENT HANDLERS =====
document.getElementById('btn-start').addEventListener('click', () => {
  showScreen('screen-game');
  initGame();
  draw();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  showScreen('screen-game');
  initGame();
  draw();
});
document.getElementById('btn-home').addEventListener('click', () => {
  showScreen('screen-menu');
  document.getElementById('highscore-display').textContent = highScore;
  if (statusBar) statusBar.style.display = 'none';
});

// Touch: trái/phải để lạng, double-tap = pause
let touchStartX = 0;
let lastTapTime = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  
  // Double-tap detection
  const now = Date.now();
  if (now - lastTapTime < 300 && isPlaying && !isGameOver) {
    isPaused = !isPaused;
    document.getElementById('game-hint').style.display = isPaused ? 'block' : 'none';
    document.getElementById('game-hint').textContent = isPaused ? '⏸️ Đã tạm dừng' : '';
    if (!isPaused && !isGameOver) draw();
  }
  lastTapTime = now;
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!touchStartX || (isPaused && !isGameOver)) return;
  const rect = canvas.getBoundingClientRect();
  const relX = touchStartX - rect.left;
  const mid = rect.width / 2;
  if (relX < mid - 20) movePlayer('left');
  else if (relX > mid + 20) movePlayer('right');
  else movePlayer(Math.random() < 0.5 ? 'left' : 'right');
  touchStartX = 0;
});

// Mouse
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const relX = e.clientX - rect.left;
  const mid = rect.width / 2;
  if (relX < mid - 20) movePlayer('left');
  else if (relX > mid + 20) movePlayer('right');
  else movePlayer(Math.random() < 0.5 ? 'left' : 'right');
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    movePlayer('left');
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    movePlayer('right');
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!isPlaying && !isGameOver) {
      isPlaying = true;
      document.getElementById('game-hint').style.display = 'none';
    }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (isPlaying && !isGameOver) {
      isPaused = !isPaused;
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

// ===== LEAVE =====
setTimeout(() => {
  if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
    window.TopNav.setLeaveAction(() => showScreen('screen-menu'));
  }
}, 100);

// ===== RESIZE =====
window.addEventListener('resize', () => {
  if (!isPlaying && !isGameOver) resizeCanvas();
});
