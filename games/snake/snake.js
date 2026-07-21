/**
 * Rắn Săn Mồi (Snake) — VTWorld Rewrite
 * Features: gradient snake, glow food, grid, highscores, pause, bc-status bar
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from '../../points.js';

const firebaseConfig = {
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",
  storageBucket:"lienquan-fake.firebasestorage.app",
  messagingSenderId:"782694799992",
  appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== DOM REFS =====
const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('bc-status');
const leftLabel = document.getElementById('snk-left-label');
const centerLabel = document.getElementById('snk-center-label');
const subLabel = document.getElementById('snk-sub');
const rightLabel = document.getElementById('snk-right-label');

// ===== CONSTANTS =====
const CELL = 20; // cell size in px

// ===== SNAKE COLOR SYSTEM =====
// Đơn sắc (solid) — mỗi màu 1000〄
const SOLID_COLORS = [
  { id:'blue',     name:'Xanh dương', rgb:[56,189,248] },
  { id:'red',      name:'Đỏ',         rgb:[239,68,68] },
  { id:'green',    name:'Xanh lá',    rgb:[52,211,153] },
  { id:'purple',   name:'Tím',        rgb:[168,85,247] },
  { id:'yellow',   name:'Vàng',       rgb:[251,191,36] },
  { id:'orange',   name:'Cam',        rgb:[249,115,22] },
  { id:'pink',     name:'Hồng',       rgb:[236,72,153] },
  { id:'white',    name:'Trắng',      rgb:[230,230,230] },
  { id:'gray',     name:'Xám',        rgb:[150,150,160] },
  { id:'black',    name:'Đen',        rgb:[30,30,30] },
];

// Special effects
const SPECIAL_COLORS = [
  { id:'rainbow',  name:'Cầu vồng', icon:'🌈', desc:'Rắn đổi màu liên tục', cost:5000 },
  { id:'gadian',  name:'Gadian',  icon:'👑', desc:'Vàng-đen-trắng cao cấp', cost:8000 },
  { id:'hellfire', name:'Hỏa ngục',  icon:'🔥', desc:'Lửa địa ngục bao quanh rắn', cost:10000 },
];

const SOLID_COST = 1000;
const DEFAULT_COLOR = 'blue';

// ===== BOARD THEMES =====
const BOARD_THEMES = [
  {
    id:'classic', name:'Cổ điển', icon:'🎮', cost:0,
    bg:'#041428', grid:'rgba(56,189,248,0.04)', food:'#f87171', foodGlow:'rgba(248,113,113,0.4)', bigFood:'#ef4444', eyeColor:'#041428'
    // Không landscape, sun, clouds → dùng màu nền đơn sắc
  },
  {
    id:'plain', name:'Đồng bằng', icon:'🌾', cost:3000,
    bg:'#041428', grid:'rgba(56,189,248,0.04)', eyeColor:'#041428',
    landscape: [
      {p:0, c:'#1a3a7a'}, {p:0.12,c:'#2a6ab8'}, {p:0.22,c:'#5a9ee8'}, {p:0.30,c:'#8ac4f0'},
      {p:0.38,c:'#7abea0'}, {p:0.45,c:'#5aaa50'}, {p:0.52,c:'#4a9a3a'}, {p:0.58,c:'#6aaa3a'},
      {p:0.65,c:'#8a8a3a'}, {p:0.72,c:'#7a6a2a'}, {p:0.78,c:'#5a6a7a'}, {p:0.84,c:'#4a5a6a'},
      {p:0.90,c:'#5a4a2a'}, {p:1,  c:'#4a3a1a'}
    ],
    sun:{x:0.78,y:0.12,size:0.06,color:'rgba(255,240,180,0.5)',outerAlpha:0.2},
    clouds:[{x:0.35,y:0.10,w:0.1,h:0.04},{x:0.65,y:0.07,w:0.08,h:0.03}]
  },
  {
    id:'jungle', name:'Rừng rậm', icon:'🌴', cost:3000,
    bg:'#051a08', grid:'rgba(52,211,153,0.05)', eyeColor:'#051a08',
    landscape: [
      {p:0, c:'#0a1a08'}, {p:0.06,c:'#0d220d'}, {p:0.12,c:'#153015'}, {p:0.18,c:'#1a3a1a'},
      {p:0.24,c:'#1a4a1a'}, {p:0.30,c:'#2a5a1a'}, {p:0.36,c:'#2a6a2a'}, {p:0.42,c:'#3a6a2a'},
      {p:0.48,c:'#4a6a2a'}, {p:0.54,c:'#3a5a1a'}, {p:0.60,c:'#2a3a0a'}, {p:0.66,c:'#3a2a0a'},
      {p:0.72,c:'#2a1a08'}, {p:0.78,c:'#1a2a0a'}, {p:0.84,c:'#3a3a1a'}, {p:0.90,c:'#1a1a08'},
      {p:1,  c:'#0a0a04'}
    ],
    sun:{x:0.30,y:0.08,size:0.04,color:'rgba(255,240,180,0.15)',outerAlpha:0.05},
    clouds:[{x:0.55,y:0.06,w:0.06,h:0.02}]
  },
  {
    id:'ocean', name:'Biển cả', icon:'🌊', cost:3000,
    bg:'#041828', grid:'rgba(14,165,233,0.05)', eyeColor:'#041828',
    landscape: [
      {p:0, c:'#0a3a6a'}, {p:0.08,c:'#1a5a9a'}, {p:0.16,c:'#3a8aca'}, {p:0.24,c:'#6ab0e0'},
      {p:0.30,c:'#0a4a7a'}, {p:0.36,c:'#0a6a9a'}, {p:0.42,c:'#1a7aaa'}, {p:0.48,c:'#2a8aba'},
      {p:0.54,c:'#1a7a9a'}, {p:0.60,c:'#0a5a7a'}, {p:0.66,c:'#0a4a6a'}, {p:0.72,c:'#0a3a5a'},
      {p:0.78,c:'#1a3a5a'}, {p:0.84,c:'#2a4a5a'}, {p:0.90,c:'#3a5a4a'}, {p:1,  c:'#1a2a2a'}
    ],
    sun:{x:0.70,y:0.08,size:0.07,color:'rgba(255,255,220,0.4)',outerAlpha:0.15},
    clouds:[{x:0.40,y:0.06,w:0.08,h:0.02}]
  },
  {
    id:'desert', name:'Sa mạc', icon:'🏜️', cost:3000,
    bg:'#1a1008', grid:'rgba(251,191,36,0.05)', eyeColor:'#1a1008',
    landscape: [
      {p:0, c:'#e07830'}, {p:0.06,c:'#e8883a'}, {p:0.12,c:'#f0a050'}, {p:0.18,c:'#f0b860'},
      {p:0.24,c:'#e8b050'}, {p:0.30,c:'#d4a040'}, {p:0.36,c:'#c8a048'}, {p:0.42,c:'#d4a858'},
      {p:0.48,c:'#c8a048'}, {p:0.54,c:'#b09038'}, {p:0.60,c:'#9a7a2a'}, {p:0.66,c:'#8a6a1a'},
      {p:0.72,c:'#6a5a1a'}, {p:0.78,c:'#4a6a2a'}, {p:0.84,c:'#3a7a4a'}, {p:0.90,c:'#6a4a1a'},
      {p:1,  c:'#4a3a0a'}
    ],
    sun:{x:0.20,y:0.06,size:0.09,color:'rgba(255,240,200,0.6)',outerAlpha:0.25},
    clouds:[]
  },
];

function loadBoardTheme() {
  try { return localStorage.getItem('snake_board_theme') || 'classic'; }
  catch { return 'classic'; }
}
function saveBoardTheme(id) {
  try { localStorage.setItem('snake_board_theme', id); } catch {}
}
let boardTheme = loadBoardTheme();

function getBoardTheme() {
  const theme = BOARD_THEMES.find(t => t.id === boardTheme) || BOARD_THEMES[0];
  // Nếu theme không được sở hữu, fallback về classic
  if (theme.cost > 0 && !isThemeOwned(theme.id)) {
    boardTheme = 'classic';
    saveBoardTheme('classic');
    return BOARD_THEMES[0];
  }
  return theme;
}

// ===== THEME OWNERSHIP =====
function loadOwnedThemes() {
  try { return (localStorage.getItem('snake_owned_themes') || 'classic').split(','); }
  catch { return ['classic']; }
}
function saveOwnedThemes(ids) {
  try { localStorage.setItem('snake_owned_themes', ids.join(',')); } catch {}
}
let ownedThemes = loadOwnedThemes();

function isThemeOwned(id) {
  return ownedThemes.includes(id);
}

async function buyTheme(themeId) {
  const theme = BOARD_THEMES.find(t => t.id === themeId);
  if (!theme || theme.cost <= 0) return;
  if (isThemeOwned(themeId)) return;
  
  let balance = 0;
  try { const p = await getPoints(); balance = p || 0; } catch {}
  if (balance < theme.cost) {
    window.showToast?.(`Cần ${theme.cost.toLocaleString()}〄 để mua!`, 'error');
    return;
  }
  if (!confirmBuy(theme.name, theme.cost)) return;
  
  try {
    await addPoints('Snake', `Mua sàn ${theme.name}`, -theme.cost, true);
    ownedThemes.push(themeId);
    saveOwnedThemes(ownedThemes);
    boardTheme = themeId;
    saveBoardTheme(themeId);
    renderThemeModalGrid();
    updateThemePreview();
    closeThemeModal();
    window.showToast?.(`🌍 Đã mở sàn ${theme.name}!`, 'success');
    if (window.TopNav?.setPoints) {
      const np = await getPoints();
      window.TopNav.setPoints(np);
    }
  } catch(e) {
    window.showToast?.('Lỗi mua sàn!', 'error');
    console.error(e);
  }
}

// ===== CONTRAST FOOD =====
// Tính màu mồi tương phản dựa trên màu nền cuối của sàn
function getContrastFood(theme) {
  // Lấy màu dưới cùng từ landscape hoặc bg
  let hex = theme.bg;
  if (theme.landscape && theme.landscape.length > 0) {
    hex = theme.landscape[theme.landscape.length - 1].c;
  }
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  const isWarm = r > b;
  // Nếu nền ấm → mồi lạnh (xanh/cyan). Nếu nền lạnh → mồi ấm (cam/hồng)
  const hue = isWarm ? 195 : 25;
  const sat = 88;
  const isDark = bright < 0.5;
  const [fr,fg,fb] = hslToRgb(hue, sat, isDark ? 65 : 45);
  const [bfr,bfg,bfb] = hslToRgb(hue, 92, isDark ? 55 : 35);
  return {
    food: `rgb(${fr},${fg},${fb})`,
    foodGlow: `rgba(${fr},${fg},${fb},0.35)`,
    bigFood: `rgb(${bfr},${bfg},${bfb})`,
  };
}

// Vẽ landscape gradient nền bàn chơi — nhiều màu sắc như cảnh thật
function drawLandscapeBackground(ctx, size, theme) {
  if (!theme.landscape || theme.landscape.length < 2) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, size, size);
    return;
  }

  // Linear gradient từ trên xuống dưới (sky → ground)
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  theme.landscape.forEach(stop => {
    grad.addColorStop(stop.p, stop.c);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Mặt trời (radial gradient overlay)
  if (theme.sun) {
    const sx = size * theme.sun.x;
    const sy = size * theme.sun.y;
    const sr = size * theme.sun.size;
    const sunGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2);
    sunGrad.addColorStop(0, theme.sun.color);
    const sunAlpha = theme.sun.outerAlpha || 0.2;
    const outerStop = theme.sun.color.replace(/[\d.]+(?=\))/, String(sunAlpha));
    sunGrad.addColorStop(0.4, outerStop);
    sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mây (elipse trắng mờ)
  if (theme.clouds) {
    theme.clouds.forEach(c => {
      const cx = size * c.x;
      const cy = size * c.y;
      const cw = size * c.w;
      const ch = size * c.h;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw);
      cloudGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
      cloudGrad.addColorStop(0.3, 'rgba(255,255,255,0.12)');
      cloudGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// Load/Save
function loadOwnedSolids() {
  try { return (localStorage.getItem('snake_owned_solids') || 'blue,red').split(','); }
  catch { return ['blue','red']; }
}
function saveOwnedSolids(ids) {
  try { localStorage.setItem('snake_owned_solids', ids.join(',')); } catch {}
}
function loadOwnedSpecials() {
  try { return (localStorage.getItem('snake_owned_specials') || '').split(',').filter(Boolean); }
  catch { return []; }
}
function saveOwnedSpecials(ids) {
  try { localStorage.setItem('snake_owned_specials', ids.join(',')); } catch {}
}
function loadColorConfig() {
  try {
    const raw = localStorage.getItem('snake_color_config');
    return raw ? JSON.parse(raw) : { type:'solid', solidId:'blue' };
  } catch { return { type:'solid', solidId:'blue' }; }
}
function saveColorConfig(cfg) {
  try { localStorage.setItem('snake_color_config', JSON.stringify(cfg)); } catch {}
}

let ownedSolids = loadOwnedSolids();
let ownedSpecials = loadOwnedSpecials();
let colorConfig = loadColorConfig(); // { type:'solid'|'dual'|'special', solidId?, dualA?, dualB?, specialId? }

// Ensure defaults
if (!ownedSolids.includes('blue')) ownedSolids.push('blue');
if (!ownedSolids.includes('red')) ownedSolids.push('red');
saveOwnedSolids(ownedSolids);

function getSolidRgb(id) {
  const c = SOLID_COLORS.find(s => s.id === id);
  return c ? c.rgb : [56,189,248];
}

function getCurrentSnakeColor(index, len) {
  const cfg = colorConfig;
  if (cfg.type === 'solid') {
    const rgb = getSolidRgb(cfg.solidId);
    return { r:rgb[0], g:rgb[1], b:rgb[2] };
  } else if (cfg.type === 'dual') {
    const a = getSolidRgb(cfg.dualA);
    const b = getSolidRgb(cfg.dualB);
    const c = index % 2 === 0 ? a : b;
    return { r:c[0], g:c[1], b:c[2] };
  } else if (cfg.type === 'special') {
    if (cfg.specialId === 'rainbow') {
      const hue = (index * 30 + Date.now() * 0.05) % 360;
      const [r,g,blue] = hslToRgb(hue, 85, 55);
      return { r, g, b:blue };
    } else if (cfg.specialId === 'gadian') {
      // Gadian: vàng-đen-trắng cuộn dọc thân kiểu cầu vồng (gold→black→white→gold)
      const shift = Date.now() * 0.08;
      const base = ((index * 60 + shift) % 360) / 120; // 0-3 qua 3 màu
      const gadianColors = [
        [255, 200, 50],   // Vàng
        [30, 30, 30],     // Đen
        [230, 230, 230],  // Trắng
      ];
      const idx = Math.floor(base) % 3;
      const t = (base % 1);
      const c1 = gadianColors[idx];
      const c2 = gadianColors[(idx + 1) % 3];
      return {
        r: Math.round(c1[0] + (c2[0] - c1[0]) * t),
        g: Math.round(c1[1] + (c2[1] - c1[1]) * t),
        b: Math.round(c1[2] + (c2[2] - c1[2]) * t),
      };
    } else if (cfg.specialId === 'hellfire') {
      // Lâu lâu đổi màu đỏ-đen
      const hellPhase = (Date.now() % 3000) / 3000; // 0→1 mỗi 3s
      let t = len > 1 ? index / (len - 1) : 0;
      if (hellPhase > 0.85) {
        // Chớp đen — đột ngột tối lại (15% cuối chu kỳ)
        const flash = (hellPhase - 0.85) / 0.15; // 0→1
        return {
          r: Math.round((255 - 50 * t) * (1 - flash)),
          g: Math.round((120 - 80 * t) * (1 - flash * 0.8)),
          b: Math.round((20 - 20 * t) * (1 - flash)),
        };
      } else if (hellPhase > 0.7) {
        // Chuyển dần về đen (15%)
        const fade = (hellPhase - 0.7) / 0.15; // 0→1
        return {
          r: Math.round((255 - 50 * t) * (1 - fade * 0.6)),
          g: Math.round((120 - 80 * t) * (1 - fade * 0.5)),
          b: Math.round((20 - 20 * t) * (1 - fade * 0.3)),
        };
      } else {
        // Cam-đỏ gradient bình thường (70% chu kỳ)
        return {
          r: Math.round(255 - 50 * t),
          g: Math.round(120 - 80 * t),
          b: Math.round(20 - 20 * t),
        };
      }
    }
  }
  // Fallback
  return { r:56, g:189, b:248 };
}

function hasFireEffect() {
  return colorConfig.type === 'special' && colorConfig.specialId === 'hellfire';
}
function hasWhiteGlow() {
  return colorConfig.type === 'special' && colorConfig.specialId === 'gadian';
}

// Hạt lửa cho Hỏa ngục
let fireParticles = [];
function initFireParticles() {
  fireParticles = [];
  for (let i = 0; i < 40; i++) {
    fireParticles.push({
      ox: (Math.random() - 0.5) * 2,
      oy: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
      size: 2 + Math.random() * 4,
    });
  }
}
initFireParticles();

function drawFireEffect(cellSize) {
  if (!hasFireEffect() || !snake || snake.length === 0) return;
  const now = Date.now() / 1000;

  // --- Chớp sáng xung quanh rắn ---
  const hellPhase = (Date.now() % 3000) / 3000;
  let flashIntensity = 0;
  if (hellPhase > 0.85) {
    flashIntensity = (hellPhase - 0.85) / 0.15; // 0→1 (15% cuối)
  }

  // Vẽ glow tỏa sáng quanh thân rắn khi chớp
  if (flashIntensity > 0) {
    snake.forEach((seg, i) => {
      if (i % 2 !== 0) return;
      const cx = seg.x * cellSize + cellSize / 2;
      const cy = seg.y * cellSize + cellSize / 2;
      const glowRadius = cellSize * 2.5 * flashIntensity;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      glow.addColorStop(0, `rgba(255,200,100,${flashIntensity * 0.6})`);
      glow.addColorStop(0.5, `rgba(255,100,20,${flashIntensity * 0.3})`);
      glow.addColorStop(1, 'rgba(255,50,10,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Flash overlay toàn board khi chớp cực đại
    if (flashIntensity > 0.6) {
      ctx.fillStyle = `rgba(255,150,50,${(flashIntensity - 0.6) * 0.15})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Hạt lửa ---
  snake.forEach((seg, i) => {
    if (i % 3 !== 0) return;
    const px = seg.x * cellSize + cellSize / 2;
    const py = seg.y * cellSize + cellSize / 2;
    const count = 3;
    for (let j = 0; j < count; j++) {
      const idx = (i * count + j) % fireParticles.length;
      const p = fireParticles[idx];
      const flicker = Math.sin(now * p.speed * 3 + p.phase) * 0.5 + 0.5;
      const angle = now * p.speed + p.phase;
      const dist = p.ox * 4 + Math.sin(now * 2 + p.phase) * 2;
      const x = px + Math.cos(angle) * dist;
      const y = py + Math.sin(angle * 0.7) * dist - 2;
      const size = p.size * (0.5 + flicker * 0.5);
      const alpha = (0.3 + flicker * 0.5) * (1 + flashIntensity * 0.5);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, `rgba(255,255,200,${alpha})`);
      grad.addColorStop(0.4, `rgba(255,150,50,${alpha * 0.8})`);
      grad.addColorStop(1, `rgba(255,50,10,0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  });
}

// White glow cho Gadian — vẽ bóng trắng xung quanh rắn
function drawWhiteGlow(cellSize) {
  if (!hasWhiteGlow() || !snake || snake.length === 0) return;
  const pulse = Math.sin(Date.now() / 600) * 0.3 + 0.7;
  snake.forEach((seg, i) => {
    if (i % 2 !== 0) return;
    const cx = seg.x * cellSize + cellSize / 2;
    const cy = seg.y * cellSize + cellSize / 2;
    const r = cellSize * 1.8 * pulse;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, `rgba(255,255,240,${0.25 * pulse})`);
    glow.addColorStop(0.6, `rgba(255,255,220,${0.1 * pulse})`);
    glow.addColorStop(1, `rgba(255,255,200,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ===== STATE =====
let tileCount, snake, food, dx, dy, score, bestScore, gameSpeed, speedLevel, paused;
let smallFoodEaten, bigFood;
let bigFoodTimer = 0; // 0-100, đếm ngược khi big food xuất hiện
let bigFoodStartTime = 0; // timestamp khi big food spawn (dùng Date.now)
const BIG_FOOD_MS = 10000; // 10 giây cố định cho mọi tốc độ
let gameLoop = null;
let isPlaying = false;
let countdownActive = false;

// ===== GAME MODE (tạm chỉ basic) =====
let gameMode = 'basic'; // 'basic' | 'advanced'
let level = 1;
let gateProgress = 0;
let gate = null;
let isLevelTransition = false;
let walls = [];
let obstacles = [];

function spawnGate() {
  if (!gate) {
    let attempts = 0;
    while (attempts < 20) {
      const wall = Math.floor(Math.random() * 4);
      let gx, gy;
      if (wall === 0) { gx = Math.floor(Math.random() * (tileCount - 2)) + 1; gy = 0; }
      else if (wall === 1) { gx = tileCount - 1; gy = Math.floor(Math.random() * (tileCount - 2)) + 1; }
      else if (wall === 2) { gx = Math.floor(Math.random() * (tileCount - 2)) + 1; gy = tileCount - 1; }
      else { gx = 0; gy = Math.floor(Math.random() * (tileCount - 2)) + 1; }
      if (!snake.some(s => s.x === gx && s.y === gy) && !walls.some(w => w.x === gx && w.y === gy)) {
        gate = { x: gx, y: gy };
        // Khi cổng xuất hiện, xóa hạt thức ăn
        bigFood = null;
        food = null;
        window.showToast?.('🚪 Cửa đã mở! Mau qua!', 'info');
        return;
      }
      attempts++;
    }
  }
}

// ===== WALL & LEVEL PATTERNS =====
// Tạo tường và chướng ngại vật theo pattern cố định, luôn đảm bảo có lối đi
function generateLevelLayout() {
  walls = [];
  const t = tileCount;
  const mid = Math.floor(t / 2);
  
  // Level 2+: luôn có viền tường bao quanh
  if (level >= 2) {
    for (let i = 0; i < t; i++) {
      walls.push({ x: i, y: 0 });
      walls.push({ x: i, y: t - 1 });
      walls.push({ x: 0, y: i });
      walls.push({ x: t - 1, y: i });
    }
  }
  
  // Level 3+: thêm pattern chướng ngại vật bên trong
  if (level >= 3) {
    const patternIndex = (level - 3) % 6;
    
    // Safe zone: vùng trống 5x5 ở trung tâm cho rắn thở
    const safeMin = mid - 3;
    const safeMax = mid + 3;
    
    // Helper: kiểm tra ô nằm trong safe zone
    const isSafe = (x, y) => x >= safeMin && x <= safeMax && y >= safeMin && y <= safeMax;
    // Helper: kiểm tra ô không chồng lên wall cũ
    const isDuplicate = (x, y) => walls.some(w => w.x === x && w.y === y);
    
    let patternCells = [];
    
    switch (patternIndex) {
      case 0: // PILLARS (đơn giản, dễ chơi) — cột cách đều, tạo hành lang rộng
        const pillarCols = Math.max(3, Math.floor((t - 6) / 5));
        for (let i = 0; i < pillarCols; i++) {
          const px = 3 + Math.floor((t - 6) / pillarCols) * i + 1;
          for (let py = 4; py < t - 4; py += 5) {
            if (isSafe(px, py) || isSafe(px + 1, py)) continue;
            patternCells.push({ x: px, y: py });
            if (py % 2 === 0) patternCells.push({ x: px + 1, y: py });
          }
        }
        break;
        
      case 1: // CORRIDORS — hành lang dọc/ngang đơn giản
        // Tường ngang trên và dưới (để chừa lối giữa)
        for (let x = 3; x < t - 3; x++) {
          if (isSafe(x, 4) || isSafe(x, t - 5)) continue;
          patternCells.push({ x, y: 4 });
          patternCells.push({ x, y: t - 5 });
        }
        // Tường dọc trái và phải (để chừa lối giữa)
        for (let y = 3; y < t - 3; y++) {
          if (isSafe(4, y) || isSafe(t - 5, y)) continue;
          patternCells.push({ x: 4, y });
          patternCells.push({ x: t - 5, y });
        }
        break;
        
      case 2: // CHECKERBOARD SPARSE — bàn cờ thưa, an toàn
        for (let x = 3; x < t - 3; x += 3) {
          for (let y = 3; y < t - 3; y += 3) {
            if (isSafe(x, y) || isSafe(x + 1, y) || isSafe(x, y + 1) || isSafe(x + 1, y + 1)) continue;
            // Mỗi cụm 2x2 chỉ đặt 1 viên gạch
            patternCells.push({ x, y });
          }
        }
        break;
        
      case 3: // ZIGZAG WIDE — tường lượn sóng, cách rộng 4 ô
        for (let i = 0; i < 3; i++) {
          const baseX = 4 + Math.floor((t - 8) / 3) * i + 1;
          if (baseX >= t - 5) break;
          for (let y = 5; y < t - 5; y += 2) {
            const wobble = Math.sin(y * 0.4 + i * 0.8) * 0.8;
            const wx = Math.round(baseX + wobble);
            if (wx > 4 && wx < t - 5 && !isSafe(wx, y)) {
              patternCells.push({ x: wx, y });
            }
          }
        }
        break;
        
      case 4: // DIAMOND RINGS — 2 vòng thoi rộng
        for (let ring = 0; ring < 2; ring++) {
          const size = Math.floor((t - 8) / 2) - ring * 4;
          if (size < 5) break;
          // Chỉ đặt tường ở 4 đỉnh của hình thoi
          const corners = [
            { x: mid, y: mid - size },
            { x: mid, y: mid + size },
            { x: mid - size, y: mid },
            { x: mid + size, y: mid },
          ];
          corners.forEach(c => {
            if (!isSafe(c.x, c.y) && !isDuplicate(c.x, c.y)) {
              patternCells.push(c);
              // Thêm 1 ô cạnh bên để tạo khối
              const ox = Math.abs(c.x - mid) > 0 ? 0 : 1;
              const oy = Math.abs(c.y - mid) > 0 ? 0 : 1;
              if (!isSafe(c.x + ox, c.y + oy)) patternCells.push({ x: c.x + ox, y: c.y + oy });
              if (!isSafe(c.x - ox, c.y - oy)) patternCells.push({ x: c.x - ox, y: c.y - oy });
            }
          });
        }
        // Thêm vài tường phụ góc
        for (let i = 0; i < 4; i++) {
          const ax = 3 + Math.floor((t - 6) / 5) * (i * 2);
          const ay = 3 + Math.floor((t - 6) / 5) * (i);
          if (!isSafe(ax, ay) && !isDuplicate(ax, ay)) patternCells.push({ x: ax, y: ay });
          if (!isSafe(ax, t - 1 - ay) && !isDuplicate(ax, t - 1 - ay)) patternCells.push({ x: ax, y: t - 1 - ay });
        }
        break;
        
      case 5: // SPIRAL LOOSE — xoắn ốc rộng, spacing 4 ô
        let left = 4, right = t - 5, top = 4, bottom = t - 5;
        let step = 0;
        while (left <= right && top <= bottom && step < 20) {
          step++;
          // Trên
          if (top > bottom) break;
          for (let x = left; x <= right; x++) {
            if (!isSafe(x, top)) patternCells.push({ x, y: top });
          }
          top += 3;
          // Phải
          if (left > right) break;
          for (let y = top; y <= bottom; y++) {
            if (!isSafe(right, y)) patternCells.push({ x: right, y });
          }
          right -= 3;
          // Dưới
          if (top <= bottom) {
            for (let x = right; x >= left; x--) {
              if (!isSafe(x, bottom)) patternCells.push({ x, y: bottom });
            }
            bottom -= 3;
          }
          // Trái
          if (left <= right) {
            for (let y = bottom; y >= top; y--) {
              if (!isSafe(left, y)) patternCells.push({ x: left, y });
            }
            left += 3;
          }
        }
        break;
    }
    
    // Thêm tất cả pattern cells vào walls (đã được lọc safe zone)
    patternCells.forEach(c => {
      if (!isDuplicate(c.x, c.y) && c.x > 0 && c.x < t - 1 && c.y > 0 && c.y < t - 1) {
        walls.push(c);
      }
    });
  }
  
  // Đồng bộ obstacles cũ cho tương thích
  obstacles = walls.filter(w => {
    const onBorder = w.x === 0 || w.x === t - 1 || w.y === 0 || w.y === t - 1;
    return !onBorder;
  });
}

function checkObstacleCollision(head) {
  return walls.some(w => w.x === head.x && w.y === head.y);
}

function levelUp() {
  isPlaying = false;
  if (gameLoop) { clearTimeout(gameLoop); gameLoop = null; }
  isLevelTransition = true;
  level++;
  gateProgress = 0;
  gate = null;
  walls = [];
  obstacles = [];
  // Tăng tốc
  gameSpeed = Math.max(35, gameSpeed - 5);

  // Sinh tường + chướng ngại vật theo level pattern
  generateLevelLayout();

  // Show level up overlay
  const overlay = document.getElementById('snk-level-overlay');
  const numEl = document.getElementById('snk-level-num');
  const labelEl = document.getElementById('snk-level-label');
  if (overlay && numEl) {
    numEl.textContent = `Level ${level}`;
    numEl.className = 'snk-countdown-num';
    if (level === 2) labelEl.textContent = 'TƯỜNG BAO!';
    else if (level >= 3) labelEl.textContent = 'CHƯỚNG NGẠI!';
    else labelEl.textContent = 'TIẾP THEO';
    labelEl.style.color = '#a855f7';
    overlay.style.display = 'flex';
    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      // Reset snake & food cho level mới
      const c = Math.floor(tileCount / 2);
      snake = [{ x: c, y: c }];
      dx = 1; dy = 0;
      bigFood = null;
      smallFoodEaten = 0;
      isLevelTransition = false;
      generateFood();
      renderStaticBoard();
      isPlaying = true;
      draw();
    }, 1200);
  } else {
    isLevelTransition = false;
    isPlaying = true;
    draw();
  }
}

// ===== HIGH SCORE (localStorage) =====
function loadBest() {
  try { return parseInt(localStorage.getItem('snake_best') || '0'); } catch { return 0; }
}
function saveBest(s) {
  try { localStorage.setItem('snake_best', String(s)); } catch {}
}
bestScore = loadBest();

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.snk-screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    setTimeout(() => target.classList.add('active'), 10);
  }
}

// ===== STATUS BAR =====
function showStatusBar() {
  if (!statusBar) return;
  statusBar.style.display = '';
  statusBar.className = 'bc-status';
  leftLabel.textContent = '🐍';
  centerLabel.textContent = '0';
  subLabel.textContent = 'Điểm';
  rightLabel.textContent = String(bestScore);
  rightLabel.className = 'stat-profit zero';
  // Luôn hiện progress bar
  const wrapper = document.getElementById('snk-progress-wrapper');
  if (wrapper) wrapper.style.display = 'flex';
}

function hideStatusBar() {
  if (statusBar) statusBar.style.display = 'none';
}

function updateProgressBarDOM() {
  const barEl = document.getElementById('snk-progress-bar');
  const fillEl = document.getElementById('snk-progress-fill');
  const wrapperEl = document.getElementById('snk-progress-wrapper');
  const pctEl = document.getElementById('snk-progress-pct');
  if (!barEl || !fillEl || !wrapperEl) return;
  
  wrapperEl.style.display = 'flex';
  
  let pct;
  if (bigFood) {
    // Đang có big food — thanh đếm ngược dần
    pct = bigFoodTimer / 100;
    barEl.className = 'snk-progress-bar countdown';
    if (pctEl) pctEl.style.color = '#c084fc';
  } else {
    // Tích lũy — thanh đầy dần
    pct = Math.min(smallFoodEaten * 10, 100) / 100;
    barEl.className = 'snk-progress-bar';
    if (pctEl) pctEl.style.color = '#4a7a9b';
  }
  
  fillEl.style.width = (pct * 100) + '%';
  if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
  
  // Glow khi gần đầy (sắp ra big food)
  if (!bigFood && pct > 0.7) {
    barEl.classList.add('near-full');
  } else {
    barEl.classList.remove('near-full');
  }
  
  // Danger pulse khi big food sắp hết giờ ( < 3s )
  if (bigFood && bigFoodStartTime > 0) {
    const elapsed = Date.now() - bigFoodStartTime;
    const remaining = BIG_FOOD_MS - elapsed;
    if (remaining > 0 && remaining < 3000) {
      const flash = Math.sin(Date.now() / 120) * 0.5 + 0.5;
      barEl.classList.add('countdown-danger');
      const dangerPct = (3000 - remaining) / 3000;
      fillEl.style.background = `linear-gradient(90deg, #ef4444, #dc2626)`;
      fillEl.style.boxShadow = `0 0 ${8 + flash * 12}px rgba(239,68,68,${0.4 + flash * 0.4})`;
      if (pctEl) {
        pctEl.style.color = '#ef4444';
        pctEl.style.textShadow = `0 0 ${4 + flash * 4}px rgba(239,68,68,0.6)`;
      }
    } else {
      barEl.classList.remove('countdown-danger');
      if (fillEl) fillEl.style.background = '';
      if (fillEl) fillEl.style.boxShadow = '';
    }
  } else {
    barEl.classList.remove('countdown-danger');
    if (fillEl) fillEl.style.background = '';
    if (fillEl) fillEl.style.boxShadow = '';
  }
}

function updateStatusBar() {
  if (!statusBar) return;
  leftLabel.textContent = isPlaying ? '🐍' : '⏸';
  subLabel.textContent = 'Điểm';
  centerLabel.textContent = String(score);
  rightLabel.textContent = String(bestScore);
  rightLabel.className = 'stat-profit' + (score >= bestScore && score > 0 ? ' positive' : ' zero');
  updateProgressBarDOM();
}

// ===== INIT =====
function initGame() {
  if (gameLoop) { clearTimeout(gameLoop); gameLoop = null; }
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = rect.width || 300;
  canvas.width = size;
  canvas.height = size;
  tileCount = Math.floor(size / CELL);
  const c = Math.floor(tileCount / 2);
  snake = [{ x: c, y: c }];
  dx = 1; dy = 0;
  score = 0;
  smallFoodEaten = 0;
  bigFood = null;
  bigFoodTimer = 0;
  bigFoodStartTime = 0;
  isPlaying = true;
  paused = false;
  isLevelTransition = false;
  gate = null;
  walls = [];
  obstacles = [];
  level = 1;
  // Clean up pause visual state
  const board = document.querySelector('.snk-board-border');
  const btn = document.getElementById('snk-pause-btn');
  const pIcon = document.getElementById('snk-pause-icon');
  if (board) board.classList.remove('paused');
  if (btn) { btn.classList.remove('paused'); btn.style.display = 'flex'; }
  if (pIcon) pIcon.innerHTML = PAUSE_SVG;

  generateFood();
  updateStatusBar();
  showStatusBar();
}

function generateFood() {
  food = {
    x: Math.floor(Math.random() * tileCount),
    y: Math.floor(Math.random() * tileCount)
  };
  // Không đặt thức ăn lên rắn, tường, hoặc chướng ngại vật
  if (snake.some(s => s.x === food.x && s.y === food.y) || 
      walls.some(w => w.x === food.x && w.y === food.y)) {
    generateFood();
  }
}

function spawnBigFood() {
  // Tìm vị trí 2x2 không đè lên rắn hay tường
  const size = 2;
  for (let attempt = 0; attempt < 50; attempt++) {
    const bx = Math.floor(Math.random() * (tileCount - size + 1));
    const by = Math.floor(Math.random() * (tileCount - size + 1));
    let overlap = false;
    for (let i = 0; i < size && !overlap; i++) {
      for (let j = 0; j < size && !overlap; j++) {
        if (snake.some(s => s.x === bx + i && s.y === by + j) ||
            walls.some(w => w.x === bx + i && w.y === by + j)) {
          overlap = true;
        }
      }
    }
    if (!overlap) {
      bigFood = { x: bx, y: by, size: size };
      return;
    }
  }
  bigFood = null; // không tìm được chỗ
}

// ===== DRAW =====
function draw() {
  if (!isPlaying) return;

  // Pause
  if (paused) {
    gameLoop = setTimeout(draw, 100);
    return;
  }

  let head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // Wall & self collision
  let isDeadlyWall = false;
  if (gameMode === 'basic') {
    // Cơ bản: xuyên tường
    if (head.x < 0) head.x = tileCount - 1;
    else if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    else if (head.y >= tileCount) head.y = 0;
  } else {
    // Nâng cao — tùy level
    if (level === 1) {
      // Level 1: xuyên tường (như classic)
      if (head.x < 0) head.x = tileCount - 1;
      else if (head.x >= tileCount) head.x = 0;
      if (head.y < 0) head.y = tileCount - 1;
      else if (head.y >= tileCount) head.y = 0;
    } else {
      // Level 2+: tường bao, đâm vào chết
      if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        endGame();
        return;
      }
    }
  }
  // Tự cắn — chết ở cả 2 chế độ
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }
  // Chướng ngại vật (level 3+)
  if (gameMode === 'advanced' && checkObstacleCollision(head)) {
    endGame();
    return;
  }

  snake.unshift(head);

  // Ăn mồi thường
  const ateSmall = food && (head.x === food.x && head.y === food.y);
  if (ateSmall) {
    score += 10;
    smallFoodEaten++;
    updateStatusBar();
    generateFood();
    // Cứ 10 hạt nhỏ → nở hạt to, bắt đầu đếm ngược
    if (smallFoodEaten >= 10) {
      spawnBigFood();
      if (bigFood) {
        smallFoodEaten = 0;
        bigFoodTimer = 100; // bắt đầu đếm ngược từ 100%
        bigFoodStartTime = Date.now(); // ghi nhận thời gian
      } else {
        smallFoodEaten = 10; // thử lại lần sau
      }
    }
  }

  // Ăn mồi to
  let ateBig = false;
  if (bigFood) {
    const bf = bigFood;
    if (head.x >= bf.x && head.x < bf.x + bf.size &&
        head.y >= bf.y && head.y < bf.y + bf.size) {
      ateBig = true;
      score += 50;
      bigFood = null;
      bigFoodTimer = 0;
      bigFoodStartTime = 0;
      updateStatusBar();
    }
  }

  if (!ateSmall && !ateBig) {
    snake.pop();
  }

  // Big food countdown — dùng Date.now() để luôn chính xác 10s
  if (bigFood) {
    const elapsed = Date.now() - bigFoodStartTime;
    bigFoodTimer = Math.max(0, 100 - (elapsed / BIG_FOOD_MS) * 100);
    if (elapsed >= BIG_FOOD_MS) {
      bigFood = null;
      bigFoodTimer = 0;
      bigFoodStartTime = 0;
      window.showToast?.('⌛ Hết giờ! Mồi to đã biến mất!', 'info');
    }
    updateProgressBarDOM();
  }

  // --- RENDER ---
  const size = canvas.width;
  const cellSize = size / tileCount;

  const theme = getBoardTheme();
  const cf = getContrastFood(theme);

  // Background — landscape gradient nhiều màu
  drawLandscapeBackground(ctx, size, theme);

  // Neon grid — nền mờ + glow xanh
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= tileCount; i++) {
    const p = i * cellSize;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }    // Neon glow overlay — phát sáng theo màu grid của theme
  ctx.save();
  // Trích xuất màu RGB từ theme.grid để glow đồng bộ
  const gridMatch = theme.grid.match(/rgba\((\d+),(\d+),(\d+)/);
  const glowR = gridMatch ? gridMatch[1] : '56';
  const glowG = gridMatch ? gridMatch[2] : '189';
  const glowB = gridMatch ? gridMatch[3] : '248';
  ctx.shadowColor = `rgba(${glowR},${glowG},${glowB},0.35)`;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = `rgba(${glowR},${glowG},${glowB},0.08)`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= tileCount; i++) {
    const p = i * cellSize;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  ctx.restore();

  // --- TƯỜNG & CHƯỚNG NGẠI VẬT (Level 2+) ---
  if (gameMode === 'advanced' && walls.length > 0) {
    const borderSet = new Set();
    // Đánh dấu ô viền
    for (let i = 0; i < tileCount; i++) {
      borderSet.add(`${i},0`);
      borderSet.add(`${i},${tileCount-1}`);
      borderSet.add(`0,${i}`);
      borderSet.add(`${tileCount-1},${i}`);
    }
    
    walls.forEach(w => {
      const wx = w.x * cellSize;
      const wy = w.y * cellSize;
      const isBorder = borderSet.has(`${w.x},${w.y}`);
      
      if (isBorder) {
        // Viền — khối đặc màu tối với hiệu ứng 3D
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(wx, wy, cellSize, cellSize);
        // Viền sáng bên trái/trên
        ctx.fillStyle = 'rgba(56,189,248,0.12)';
        ctx.fillRect(wx, wy, cellSize, 2);
        ctx.fillRect(wx, wy, 2, cellSize);
        // Viền tối bên phải/dưới
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(wx + cellSize - 2, wy, 2, cellSize);
        ctx.fillRect(wx, wy + cellSize - 2, cellSize, 2);
      } else {
        // Chướng ngại vật bên trong — nền đen + viền đỏ
        ctx.fillStyle = theme.bg;
        ctx.fillRect(wx, wy, cellSize, cellSize);
        ctx.fillStyle = 'rgba(255,60,60,0.12)';
        roundRect(ctx, wx + 2, wy + 2, cellSize - 4, cellSize - 4, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,80,80,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // X bên trong
        ctx.strokeStyle = 'rgba(255,60,60,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + 4); ctx.lineTo(wx + cellSize - 4, wy + cellSize - 4);
        ctx.moveTo(wx + cellSize - 4, wy + 4); ctx.lineTo(wx + 4, wy + cellSize - 4);
        ctx.stroke();
      }
    });
  }

  // --- THANH MỨC (Progress Bar — Nâng cao) ---
  updateProgressBarDOM();

  // --- CỬA (Gate — Nâng cao) ---
  if (gameMode === 'advanced' && gate) {
    const gx = gate.x * cellSize;
    const gy = gate.y * cellSize;
    const gp = Math.sin(Date.now() / 300) * 0.5 + 0.5;
    const cx = gx + cellSize / 2;
    const cy = gy + cellSize / 2;

    // Outer glow — many layers of expanding purple light
    for (let i = 4; i >= 1; i--) {
      const radius = cellSize * (0.6 + i * 0.5);
      const alpha = (0.08 + gp * 0.06) * (1 - i * 0.15);
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glowGrad.addColorStop(0, `rgba(200, 130, 255, ${alpha * 0.5})`);
      glowGrad.addColorStop(0.3, `rgba(168, 85, 247, ${alpha})`);
      glowGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light rays
    const rayCount = 8;
    for (let r = 0; r < rayCount; r++) {
      const angle = (r / rayCount) * Math.PI * 2 + Date.now() * 0.0015;
      const rayLen = cellSize * (0.8 + gp * 0.6);
      const rayW = cellSize * 0.08;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.15 + gp * 0.2;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(-rayW / 2, cellSize * 0.3);
      ctx.lineTo(0, cellSize * 0.3 + rayLen);
      ctx.lineTo(rayW / 2, cellSize * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Portal body — deep purple gradient center
    ctx.shadowColor = `rgba(168,85,247,${0.4 + gp * 0.4})`;
    ctx.shadowBlur = 25;
    const portalGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 0.5);
    portalGrad.addColorStop(0, '#e9d5ff');
    portalGrad.addColorStop(0.3, '#c084fc');
    portalGrad.addColorStop(0.6, '#9333ea');
    portalGrad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = portalGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Portal rim — bright pulsing ring
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + gp * 0.4})`;
    ctx.lineWidth = 2 + gp * 1.5;
    ctx.shadowColor = `rgba(200,130,255,${0.5 + gp * 0.5})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner swirl
    ctx.strokeStyle = `rgba(255,255,255,${0.2 + gp * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2.5; a += 0.1) {
      const sw = cellSize * 0.18 * Math.sin(a * 1.5 + Date.now() * 0.003);
      const sx = cx + Math.cos(a) * sw;
      const sy = cy + Math.sin(a) * sw;
      if (a === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Arrow — white with glow
    ctx.fillStyle = `rgba(255,255,255,${0.7 + gp * 0.3})`;
    ctx.font = `bold ${cellSize * 0.45}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(255,255,255,${0.4 + gp * 0.4})`;
    ctx.shadowBlur = 12;
    ctx.fillText('⇱', cx, cy + 1);
    ctx.shadowBlur = 0;
  }

  // --- MỒI THƯỜNG (ẩn khi cổng xuất hiện) ---
  if (food && !(gameMode === 'advanced' && gate)) {
    const fx = food.x * cellSize + cellSize / 2;
    const fy = food.y * cellSize + cellSize / 2;
    const fr = cellSize * 0.38;

    // Food glow
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, cellSize);
    glow.addColorStop(0, cf.foodGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(food.x * cellSize - cellSize * 0.5, food.y * cellSize - cellSize * 0.5, cellSize * 2, cellSize * 2);

    // Food body
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fillStyle = cf.food;
    ctx.fill();
    ctx.strokeStyle = cf.food;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Food shine
    ctx.beginPath();
    ctx.arc(fx - fr * 0.25, fy - fr * 0.25, fr * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }

  // --- MỒI TO (2x2) — ẩn khi cổng xuất hiện ---
  if (bigFood && !(gameMode === 'advanced' && gate)) {
    const bf = bigFood;
    const bx = bf.x * cellSize;
    const by = bf.y * cellSize;
    const bw = bf.size * cellSize;
    const cx = bx + bw / 2;
    const cy = by + bw / 2;
    const radius = bw * 0.42;

    // Blink — thay đổi độ sáng theo thời gian
    const blinkPhase = (Date.now() % 800) / 800; // 0→1 mỗi 800ms
    const blinkBright = blinkPhase < 0.5
      ? 0.3 + 0.7 * (blinkPhase * 2)      // tăng dần 0.3→1.0
      : 1.0 - 0.7 * ((blinkPhase - 0.5) * 2); // giảm dần 1.0→0.3

    // Glow
    const bfColor = cf.bigFood;
    const bfR = parseInt(bfColor.slice(4,bfColor.indexOf(',')),10);
    const bfG = parseInt(bfColor.slice(bfColor.indexOf(',')+1, bfColor.lastIndexOf(',')),10);
    const bfB = parseInt(bfColor.slice(bfColor.lastIndexOf(',')+1, bfColor.indexOf(')')),10);
    const bGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw);
    bGlow.addColorStop(0, `rgba(${bfR},${bfG},${bfB},${0.35 * blinkBright})`);
    bGlow.addColorStop(1, `rgba(${bfR},${bfG},${bfB},0)`);
    ctx.fillStyle = bGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, bw, 0, Math.PI * 2);
    ctx.fill();

    // Big food body — nhấp nháy qua globalAlpha
    ctx.save();
    ctx.globalAlpha = blinkBright;
    ctx.shadowColor = `rgba(${bfR},${bfG},${bfB},0.5)`;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = cf.bigFood;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bright ring
    ctx.strokeStyle = `rgba(255,255,255,0.25)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shine highlight
    ctx.beginPath();
    ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.restore();

    // Progress bar tự chuyển sang đỏ qua updateProgressBarDOM — không vẽ gì thêm trên board
  }

  // Fire effect (Hỏa ngục) — vẽ trước rắn
  drawFireEffect(cellSize);

  // White glow (Gadian) — vẽ trước rắn
  drawWhiteGlow(cellSize);

  // Snake body — dùng màu sắc đã chọn
  const len = snake.length;
  snake.forEach((part, i) => {
    const px = part.x * cellSize;
    const py = part.y * cellSize;
    const pad = 1;
    const rad = 4;

    const { r, g, b } = getCurrentSnakeColor(i, len);

    if (i === 0) {
      // Head — rounded rect with glow
      ctx.shadowColor = `rgba(${r},${g},${b},0.4)`;
      ctx.shadowBlur = 10;
      roundRect(ctx, px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, rad);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      const eyeR = cellSize * 0.08;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.35, py + cellSize * 0.35, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.65, py + cellSize * 0.35, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#041428';
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.35 + dx * 2, py + cellSize * 0.35 + dy * 2, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.65 + dx * 2, py + cellSize * 0.35 + dy * 2, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Body segments with rounded corners
      roundRect(ctx, px + pad + 1, py + pad + 1, cellSize - pad * 2 - 2, cellSize - pad * 2 - 2, rad - 1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
  });

  gameLoop = setTimeout(draw, gameSpeed);
}

// Helper: HSL → RGB
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ===== COLOR UI =====
function updateColorPreview() {
  const swatch = document.getElementById('snk-preview-swatch');
  const nameEl = document.getElementById('snk-preview-name');
  const typeEl = document.getElementById('snk-preview-type');
  if (!swatch) return;

  const cfg = colorConfig;
  if (cfg.type === 'solid') {
    const rgb = getSolidRgb(cfg.solidId);
    swatch.style.background = `rgb(${rgb.join(',')})`;
    const c = SOLID_COLORS.find(s => s.id === cfg.solidId);
    nameEl.textContent = c ? c.name : '?'; nameEl.style.color = '#e0f2fe';
    typeEl.textContent = 'đơn sắc';
  } else if (cfg.type === 'dual') {
    const a = getSolidRgb(cfg.dualA);
    const b = getSolidRgb(cfg.dualB);
    swatch.style.background = `linear-gradient(135deg, rgb(${a.join(',')}) 50%, rgb(${b.join(',')}) 50%)`;
    nameEl.textContent = 'Song sắc'; nameEl.style.color = '#fbbf24';
    typeEl.textContent = 'xen kẽ';
  } else if (cfg.type === 'special') {
    const sp = SPECIAL_COLORS.find(s => s.id === cfg.specialId);
    if (cfg.specialId === 'rainbow') {
      swatch.style.background = 'linear-gradient(90deg,red,orange,yellow,green,blue,indigo,violet)';
    } else if (cfg.specialId === 'gadian') {
      swatch.style.background = 'linear-gradient(135deg,#ffd700,#2a2a2a)';
    } else if (cfg.specialId === 'hellfire') {
      swatch.style.background = 'linear-gradient(135deg,#ff4500,#8b0000)';
    }
    nameEl.textContent = sp ? sp.name : '?'; nameEl.style.color = '#f87171';
    typeEl.textContent = 'đa sắc';
  }
}

// ===== BOARD THEME UI =====
function updateThemePreview() {
  const theme = getBoardTheme();
  const landscape = document.getElementById('snk-theme-landscape');
  const icon = document.getElementById('snk-theme-current-icon');
  const name = document.getElementById('snk-theme-current-name');
  if (landscape) {
    landscape.className = 'snk-theme-landscape snk-landscape-' + theme.id;
  }
  if (icon) icon.textContent = theme.icon;
  if (name) name.textContent = theme.name;
}

function openThemeModal() {
  document.getElementById('snk-theme-modal').classList.add('active');
  renderThemeModalGrid();
}

function closeThemeModal() {
  document.getElementById('snk-theme-modal').classList.remove('active');
}

function renderThemeModalGrid() {
  const grid = document.getElementById('snk-theme-modal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  BOARD_THEMES.forEach(t => {
    const owned = t.cost === 0 || isThemeOwned(t.id);
    const active = t.id === boardTheme;
    const opt = document.createElement('div');
    opt.className = 'snk-theme-opt-large' + (active ? ' active' : '') + (owned ? '' : ' locked');
    opt.dataset.theme = t.id;

    const landscape = document.createElement('div');
    landscape.className = 'snk-theme-landscape snk-landscape-' + t.id;
    opt.appendChild(landscape);

    // Lock overlay for unowned themes
    if (!owned) {
      const lockOverlay = document.createElement('div');
      lockOverlay.className = 'snk-theme-lock-overlay';
      lockOverlay.textContent = '🔒';
      opt.appendChild(lockOverlay);
    }

    const icon = document.createElement('span');
    icon.className = 'snk-theme-icon';
    icon.textContent = t.icon;
    opt.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'snk-theme-name';
    name.textContent = owned ? t.name : `${t.cost.toLocaleString()}〄`;
    opt.appendChild(name);

    opt.addEventListener('click', () => {
      if (owned) {
        boardTheme = t.id;
        saveBoardTheme(t.id);
        renderThemeModalGrid();
        updateThemePreview();
        closeThemeModal();
      } else {
        buyTheme(t.id);
      }
    });

    grid.appendChild(opt);
  });
}

// ===== MODAL =====
function openColorModal() {
  document.getElementById('snk-color-modal').classList.add('active');
  renderSolidGrid();
  renderDualSelects();
  renderSpecialGrid();
  updateDualPreview();
}

function closeColorModal() {
  document.getElementById('snk-color-modal').classList.remove('active');
}

function switchTab(tabId) {
  document.querySelectorAll('.snk-modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.snk-modal-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.snk-modal-tab[data-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById(`snk-tab-${tabId}`)?.classList.add('active');
}

// --- Solid grid ---
function renderSolidGrid() {
  const grid = document.getElementById('snk-solid-grid');
  if (!grid) return;
  grid.innerHTML = '';
  SOLID_COLORS.forEach(c => {
    const owned = ownedSolids.includes(c.id);
    const active = colorConfig.type === 'solid' && colorConfig.solidId === c.id;
    const opt = document.createElement('div');
    opt.className = 'snk-solid-opt' + (active ? ' active' : '') + (owned ? '' : ' locked');

    const swatch = document.createElement('div');
    swatch.className = 'snk-solid-swatch';
    swatch.style.background = `rgb(${c.rgb.join(',')})`;
    opt.appendChild(swatch);

    const name = document.createElement('span');
    name.className = 'snk-solid-name';
    name.textContent = owned ? c.name : `${SOLID_COST.toLocaleString()}〄`;
    opt.appendChild(name);

    opt.addEventListener('click', () => {
      if (owned) {
        colorConfig = { type:'solid', solidId: c.id };
        saveColorConfig(colorConfig);
        renderSolidGrid();
        updateColorPreview();
      } else {
        buySolidColor(c);
      }
    });
    grid.appendChild(opt);
  });
}

function confirmBuy(name, cost) {
  return window.confirm(`Xác nhận mua “${name}” với giá ${cost.toLocaleString()}〄?`);
}

async function buySolidColor(color) {
  let balance = 0;
  try { const p = await getPoints(); balance = p || 0; } catch {}
  if (balance < SOLID_COST) {
    window.showToast?.(`Cần ${SOLID_COST.toLocaleString()}〄 để mua!`, 'error');
    return;
  }
  if (!confirmBuy(color.name, SOLID_COST)) return;
  try {
    await addPoints('Snake', `Mua màu ${color.name}`, -SOLID_COST, true);
    ownedSolids.push(color.id);
    saveOwnedSolids(ownedSolids);
    colorConfig = { type:'solid', solidId: color.id };
    saveColorConfig(colorConfig);
    renderSolidGrid();
    renderDualSelects();
    updateColorPreview();
    window.showToast?.(`🎨 Đã mua màu ${color.name}!`, 'success');
    if (window.TopNav?.setPoints) {
      const np = await getPoints();
      window.TopNav.setPoints(np);
    }
  } catch(e) {
    window.showToast?.('Lỗi mua màu!', 'error');
    console.error(e);
  }
}

// --- Dual ---
function renderDualSelects() {
  const selA = document.getElementById('snk-dual-a');
  const selB = document.getElementById('snk-dual-b');
  if (!selA || !selB) return;
  const owned = SOLID_COLORS.filter(c => ownedSolids.includes(c.id));
  [selA, selB].forEach(sel => {
    sel.innerHTML = owned.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
  });
  if (colorConfig.type === 'dual') {
    selA.value = colorConfig.dualA;
    selB.value = colorConfig.dualB;
  }
  selA.onchange = updateDualPreview;
  selB.onchange = updateDualPreview;
  updateDualPreview();
}

function updateDualPreview() {
  const a = document.getElementById('snk-dual-a')?.value;
  const b = document.getElementById('snk-dual-b')?.value;
  if (!a || !b) return;
  const rgbA = getSolidRgb(a);
  const rgbB = getSolidRgb(b);
  document.getElementById('snk-dual-swatch-a').style.background = `rgb(${rgbA.join(',')})`;
  document.getElementById('snk-dual-swatch-b').style.background = `rgb(${rgbB.join(',')})`;
  document.getElementById('snk-dual-preview').style.background =
    `linear-gradient(90deg, rgb(${rgbA.join(',')}) 50%, rgb(${rgbB.join(',')}) 50%)`;
}

// --- Special ---
function renderSpecialGrid() {
  const grid = document.getElementById('snk-special-grid');
  if (!grid) return;
  grid.innerHTML = '';
  SPECIAL_COLORS.forEach(c => {
    const owned = ownedSpecials.includes(c.id);
    const active = colorConfig.type === 'special' && colorConfig.specialId === c.id;
    const opt = document.createElement('div');
    opt.className = 'snk-special-opt' + (active ? ' active' : '');

    const icon = document.createElement('div');
    icon.className = 'snk-special-icon';
    icon.textContent = c.icon;
    opt.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'snk-special-name';
    name.textContent = owned ? c.name : `${c.cost.toLocaleString()}〄`;
    opt.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'snk-special-desc';
    desc.textContent = c.desc;
    opt.appendChild(desc);

    if (!owned) {
      const lock = document.createElement('span');
      lock.style.cssText = 'font-size:10px;opacity:0.5;';
      lock.textContent = '🔒';
      opt.appendChild(lock);
    }

    opt.addEventListener('click', () => {
      if (owned) {
        colorConfig = { type:'special', specialId: c.id };
        saveColorConfig(colorConfig);
        renderSpecialGrid();
        updateColorPreview();
      } else {
        buySpecialColor(c);
      }
    });
    grid.appendChild(opt);
  });
}

async function buySpecialColor(color) {
  let balance = 0;
  try { const p = await getPoints(); balance = p || 0; } catch {}
  if (balance < color.cost) {
    window.showToast?.(`Cần ${color.cost.toLocaleString()}〄!`, 'error');
    return;
  }
  if (!confirmBuy(color.name, color.cost)) return;
  try {
    await addPoints('Snake', `Mua ${color.name}`, -color.cost, true);
    ownedSpecials.push(color.id);
    saveOwnedSpecials(ownedSpecials);
    colorConfig = { type:'special', specialId: color.id };
    saveColorConfig(colorConfig);
    renderSpecialGrid();
    updateColorPreview();
    window.showToast?.(`🎨 Đã mở ${color.name}!`, 'success');
    if (window.TopNav?.setPoints) {
      const np = await getPoints();
      window.TopNav.setPoints(np);
    }
  } catch(e) {
    window.showToast?.('Lỗi!', 'error');
    console.error(e);
  }
}

// Helper: rounded rect
function roundRect(ctx, x, y, w, h, r) {
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
}

// ===== END GAME =====
function endGame() {
  isPlaying = false;
  if (gameLoop) { clearTimeout(gameLoop); gameLoop = null; }

  const isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    saveBest(bestScore);
  }

  // Tính tiền thưởng = điểm × hệ số tốc độ (giảm 40%)
  const mults = [0.12, 0.24, 0.36, 0.48, 0.60, 0.72, 0.84, 0.96, 1.08, 1.20];
  const mult = mults[speedLevel - 1] || 0.6;
  const earn = Math.round(score * mult);

  // Update status bar & result screen NGAY — không chờ Firebase
  const hasScore = score > 0;
  if (statusBar) {
    statusBar.className = 'bc-status' + (hasScore ? ' result-win' : ' result-lose');
    leftLabel.textContent = hasScore ? (isNewBest ? '🏆' : '✅') : '💀';
    centerLabel.textContent = String(score);
    subLabel.textContent = isNewBest ? 'Kỷ lục mới!' : (hasScore ? 'Hoàn thành' : 'Kết thúc');
    rightLabel.textContent = hasScore ? '+' + earn.toLocaleString('vi-VN') : '0';
    rightLabel.className = hasScore ? 'stat-profit positive' : 'stat-profit zero';
  }

  // Result screen
  document.getElementById('snk-res-emoji').textContent = isNewBest ? '🏆' : '💀';
  document.getElementById('snk-res-title').textContent = isNewBest ? 'Kỷ lục mới!' : 'Game Over';
  document.getElementById('snk-res-score').textContent = String(score);
  document.getElementById('snk-res-best').textContent = String(bestScore);

  showScreen('screen-result');

  // Ghi Firestone bất đồng bộ (không block UI)
  if (earn > 0) {
    (async () => {
      try {
        await addPoints('Snake', `Rắn săn mồi - ${score}đ`, earn, true);
        const newPts = await getPoints();
        if (window.TopNav?.setPoints) window.TopNav.setPoints(newPts);
      } catch {}
    })();
  }
}

// ===== RENDER STATIC BOARD (không di chuyển) =====
function renderStaticBoard() {
  const size = canvas.width;
  const cellSize = size / tileCount;
  const theme = getBoardTheme();
  const cf = getContrastFood(theme);

  // Background — landscape gradient nhiều màu
  drawLandscapeBackground(ctx, size, theme);

  // Neon grid — nền mờ + glow xanh
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= tileCount; i++) {
    const p = i * cellSize;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  // Neon glow overlay — đồng bộ màu với theme
  ctx.save();
  const gridMatch2 = theme.grid.match(/rgba\((\d+),(\d+),(\d+)/);
  const glowR2 = gridMatch2 ? gridMatch2[1] : '56';
  const glowG2 = gridMatch2 ? gridMatch2[2] : '189';
  const glowB2 = gridMatch2 ? gridMatch2[3] : '248';
  ctx.shadowColor = `rgba(${glowR2},${glowG2},${glowB2},0.35)`;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = `rgba(${glowR2},${glowG2},${glowB2},0.08)`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= tileCount; i++) {
    const p = i * cellSize;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  ctx.restore();

  // Food
  const fx = food.x * cellSize + cellSize / 2;
  const fy = food.y * cellSize + cellSize / 2;
  const fr = cellSize * 0.38;

  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, cellSize);
  glow.addColorStop(0, cf.foodGlow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(food.x * cellSize - cellSize * 0.5, food.y * cellSize - cellSize * 0.5, cellSize * 2, cellSize * 2);

  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.fillStyle = cf.food;
  ctx.fill();
  ctx.strokeStyle = cf.food;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx - fr * 0.25, fy - fr * 0.25, fr * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  // Tường & chướng ngại vật (render tĩnh)
  if (gameMode === 'advanced' && walls.length > 0) {
    const borderSet = new Set();
    for (let i = 0; i < tileCount; i++) {
      borderSet.add(`${i},0`);
      borderSet.add(`${i},${tileCount-1}`);
      borderSet.add(`0,${i}`);
      borderSet.add(`${tileCount-1},${i}`);
    }
    walls.forEach(w => {
      const wx = w.x * cellSize;
      const wy = w.y * cellSize;
      const isBorder = borderSet.has(`${w.x},${w.y}`);
      if (isBorder) {
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(wx, wy, cellSize, cellSize);
        ctx.fillStyle = 'rgba(56,189,248,0.12)';
        ctx.fillRect(wx, wy, cellSize, 2);
        ctx.fillRect(wx, wy, 2, cellSize);
      } else {
        ctx.fillStyle = theme.bg;
        ctx.fillRect(wx, wy, cellSize, cellSize);
        ctx.fillStyle = 'rgba(255,60,60,0.12)';
        roundRect(ctx, wx + 2, wy + 2, cellSize - 4, cellSize - 4, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,80,80,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,60,60,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + 4); ctx.lineTo(wx + cellSize - 4, wy + cellSize - 4);
        ctx.moveTo(wx + cellSize - 4, wy + 4); ctx.lineTo(wx + 4, wy + cellSize - 4);
        ctx.stroke();
      }
    });
  }

  // Snake body — dùng màu sắc đã chọn
  const len = snake.length;
  snake.forEach((part, i) => {
    const px = part.x * cellSize;
    const py = part.y * cellSize;
    const pad = 1;
    const rad = 4;

    const { r, g, b } = getCurrentSnakeColor(i, len);

    if (i === 0) {
      // Head — rounded rect with glow
      ctx.shadowColor = `rgba(${r},${g},${b},0.4)`;
      ctx.shadowBlur = 10;
      roundRect(ctx, px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, rad);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      const eyeR = cellSize * 0.08;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.35, py + cellSize * 0.35, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.65, py + cellSize * 0.35, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.eyeColor;
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.35 + dx * 2, py + cellSize * 0.35 + dy * 2, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + cellSize * 0.65 + dx * 2, py + cellSize * 0.35 + dy * 2, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(ctx, px + pad + 1, py + pad + 1, cellSize - pad * 2 - 2, cellSize - pad * 2 - 2, rad - 1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
  });
}

// ===== COUNTDOWN =====
function startCountdown(callback) {
  const overlay = document.getElementById('snk-countdown');
  const numEl = document.getElementById('snk-countdown-num');
  const labelEl = document.getElementById('snk-countdown-label');
  if (!overlay || !numEl) { callback(); return; }

  countdownActive = true;
  const steps = ['3', '2', '1', 'GO!'];
  let step = 0;

  function showStep() {
    if (step >= steps.length) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      countdownActive = false;
      callback();
      return;
    }

    const val = steps[step];
    numEl.textContent = val;
    numEl.className = 'snk-countdown-num';
    labelEl.className = 'snk-countdown-label';

    if (val === 'GO!') {
      numEl.classList.add('go');
      labelEl.textContent = 'Go';
      labelEl.classList.add('go');
    } else {
      labelEl.textContent = 'BẮT ĐẦU';
    }

    // Re-trigger animation bằng cách reflow
    void numEl.offsetWidth;

    overlay.style.display = 'flex';
    overlay.classList.add('active');

    // Duration cho từng bước
    const delay = val === 'GO!' ? 600 : 700;
    step++;
    setTimeout(showStep, delay);
  }

  showStep();
}

// ===== START / MENU =====
function startGame() {
  isPlaying = false;
  if (gameLoop) { clearTimeout(gameLoop); gameLoop = null; }
  showScreen('screen-game');
  
  // Ẩn countdown overlay trước
  const overlay = document.getElementById('snk-countdown');
  if (overlay) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
  
  setTimeout(() => {
    initGame();
    // Vẽ bàn cờ tĩnh (không movement)
    renderStaticBoard();
    // Bắt đầu đếm ngược
    isPlaying = false;
    startCountdown(() => {
      isPlaying = true;
      // Hiện nút pause
      const btn = document.getElementById('snk-pause-btn');
      if (btn) btn.style.display = 'flex';
      draw();
    });
  }, 100);
}

function showMenu() {
  isPlaying = false;
  if (gameLoop) { clearTimeout(gameLoop); gameLoop = null; }
  hideStatusBar();
  document.getElementById('snk-hs-display').textContent = String(loadBest());
  updateThemePreview();
  updateColorPreview();
  showScreen('screen-menu');
  // Ẩn nút tạm dừng khi ở menu (giống timso)
  const btn = document.getElementById('snk-pause-btn');
  if (btn) { btn.style.display = 'none'; btn.classList.remove('paused'); }
  const pIcon = document.getElementById('snk-pause-icon');
  if (pIcon) pIcon.innerHTML = PAUSE_SVG;
  document.querySelector('.snk-board-border')?.classList.remove('paused');
}

const PAUSE_SVG = '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>';
const PLAY_SVG = '<polygon points="7,4 20,12 7,20"></polygon>';

// ===== PAUSE =====
function togglePause() {
  if (!isPlaying) return;
  paused = !paused;
  leftLabel.textContent = paused ? '⏸' : '🐍';

  const board = document.querySelector('.snk-board-border');
  const btn = document.getElementById('snk-pause-btn');
  const icon = document.getElementById('snk-pause-icon');

  if (paused) {
    board?.classList.add('paused');
    btn?.classList.add('paused');
    if (icon) icon.innerHTML = PLAY_SVG;
  } else {
    board?.classList.remove('paused');
    btn?.classList.remove('paused');
    if (icon) icon.innerHTML = PAUSE_SVG;
  }
}

// ===== KEYBOARD =====
window.addEventListener('keydown', (e) => {
  if (countdownActive) return;
  if (e.key === 'Escape' || e.key === 'p') { togglePause(); return; }
  if (!isPlaying || paused) return;
  if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; }
  else if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; }
  else if (e.key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; }
  else if (e.key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; }
  // Prevent page scroll
  if (e.key.startsWith('Arrow')) e.preventDefault();
});

// ===== TOUCH CONTROLS =====
document.getElementById('btn-up').addEventListener('click', () => { if (countdownActive) return; if (!paused && dy === 0) { dx = 0; dy = -1; } });
document.getElementById('btn-down').addEventListener('click', () => { if (countdownActive) return; if (!paused && dy === 0) { dx = 0; dy = 1; } });
document.getElementById('btn-left').addEventListener('click', () => { if (countdownActive) return; if (!paused && dx === 0) { dx = -1; dy = 0; } });
document.getElementById('btn-right').addEventListener('click', () => { if (countdownActive) return; if (!paused && dx === 0) { dx = 1; dy = 0; } });

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Buttons
  document.getElementById('snk-btn-start').addEventListener('click', startGame);
  document.getElementById('snk-btn-restart').addEventListener('click', startGame);
  document.getElementById('snk-btn-home').addEventListener('click', showMenu);
  document.getElementById('snk-pause-btn').addEventListener('click', togglePause);

  // Speed descriptions & reward
  const SPEED_LABELS = [
    { level: 1, label: 'Rùa bò',  mult: 'x0.2' },
    { level: 2, label: 'Rất chậm', mult: 'x0.4' },
    { level: 3, label: 'Chậm',     mult: 'x0.6' },
    { level: 4, label: 'Hơi chậm',  mult: 'x0.8' },
    { level: 5, label: 'Vừa phải',  mult: 'x1.0' },
    { level: 6, label: 'Trung bình', mult: 'x1.2' },
    { level: 7, label: 'Hơi nhanh', mult: 'x1.4' },
    { level: 8, label: 'Nhanh',     mult: 'x1.6' },
    { level: 9, label: 'Rất nhanh', mult: 'x1.8' },
    { level: 10, label: 'Siêu tốc', mult: 'x2.0' },
  ];

  function updateSpeedUI(level) {
    const info = SPEED_LABELS.find(l => l.level === level) || SPEED_LABELS[5];
    const elLevel = document.getElementById('snk-speed-level');
    const elDesc = document.getElementById('snk-speed-desc');
    const elReward = document.getElementById('snk-speed-reward');
    if (elLevel) elLevel.textContent = 'Tốc độ ' + level;
    if (elDesc) elDesc.textContent = info.label;
    if (elReward) elReward.textContent = info.mult;

    // Update track fill & notch position
    const pct = ((level - 1) / 9) * 100;
    const elFill = document.getElementById('snk-speed-fill');
    const elNotch = document.getElementById('snk-speed-notch');
    if (elFill) elFill.style.width = pct + '%';
    if (elNotch) elNotch.style.left = pct + '%';

    // Update tick active state — xóa hết rồi thêm vào số đang chọn
    document.querySelectorAll('.snk-speed-ticks span').forEach(t => {
      t.classList.remove('active');
    });
    const activeTick = document.querySelector('.snk-speed-ticks span[data-level="' + level + '"]');
    if (activeTick) activeTick.classList.add('active');
  }

  function setSpeed(level) {
    speedLevel = level;
    const speeds = [200, 180, 160, 140, 120, 100, 80, 65, 50, 35];
    gameSpeed = speeds[level - 1] || 100;
    updateSpeedUI(level);
  }

  // Speed bar click — click on tick marks
  document.querySelectorAll('.snk-speed-ticks span').forEach(tick => {
    tick.addEventListener('click', (e) => {
      e.stopPropagation();
      setSpeed(parseInt(tick.dataset.level));
    });
  });

  // Click on the bar itself (between ticks)
  document.getElementById('snk-speed-bar').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const level = Math.round(x * 9) + 1;
    setSpeed(Math.max(1, Math.min(10, level)));
  });

  // Default speed (level 6)
  gameSpeed = 100;
  speedLevel = 6;
  updateSpeedUI(6);

  // High score display
  document.getElementById('snk-hs-display').textContent = String(loadBest());

  // Game mode toggle (chỉ 2 nút đơn giản)
  const modeBtns = document.querySelectorAll('.snk-mode-btn');
  if (modeBtns.length) {
    gameMode = loadGameMode();
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === gameMode);
      btn.addEventListener('click', () => {
        gameMode = btn.dataset.mode;
        saveGameMode(gameMode);
        modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === gameMode));
      });
    });
  }

  // Board theme preview click → open theme modal
  document.getElementById('snk-theme-preview').addEventListener('click', openThemeModal);
  document.getElementById('snk-theme-modal-close').addEventListener('click', closeThemeModal);
  document.getElementById('snk-theme-modal-cancel').addEventListener('click', closeThemeModal);
  document.getElementById('snk-theme-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeThemeModal();
  });

  // Theme preview
  updateThemePreview();

  // Color preview
  updateColorPreview();

  // Modal events
  document.getElementById('snk-color-preview').addEventListener('click', openColorModal);
  document.getElementById('snk-modal-close').addEventListener('click', closeColorModal);
  document.getElementById('snk-modal-cancel').addEventListener('click', closeColorModal);
  document.querySelectorAll('.snk-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  document.getElementById('snk-modal-apply').addEventListener('click', () => {
    const tab = document.querySelector('.snk-modal-tab.active');
    if (tab) {
      const tabId = tab.dataset.tab;
      if (tabId === 'solid') {
        // already selected via click on solid grid
      } else if (tabId === 'dual') {
        const a = document.getElementById('snk-dual-a')?.value;
        const b = document.getElementById('snk-dual-b')?.value;
        if (a && b) {
          colorConfig = { type:'dual', dualA: a, dualB: b };
          saveColorConfig(colorConfig);
          updateColorPreview();
        }
      }
    }
    closeColorModal();
  });
  // Click overlay to close
  document.getElementById('snk-color-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeColorModal();
  });

  // TopNav
  if (window.TopNav && typeof window.TopNav.setLeaveAction === 'function') {
    window.TopNav.setLeaveAction(() => {
      isPlaying = false;
      if (gameLoop) clearTimeout(gameLoop);
      window.location.href = '../../games.html';
    });
  }

  // Canvas size on first load
  const resizeCanvas = () => {
    if (document.getElementById('screen-game').classList.contains('active')) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const size = rect.width || 300;
    canvas.width = size;
    canvas.height = size;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

// ===== AUTH =====
onAuthStateChanged(auth, user => {
  if (user) {
    (async () => {
      try {
        const p = await getPoints();
        if (window.TopNav && typeof window.TopNav.setPoints === 'function') window.TopNav.setPoints(p);
      } catch {}
    })();
  }
});
