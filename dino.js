import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from './points.js';

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

const canvas = document.getElementById('dino-canvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_H = 40;
let gameSpeed = 5;

let dino, obstacles, clouds, score, frameCount, gameLoop;
let isPaused = false, isGameOver = false, isStarted = false;

function showScreen(id) {
    document.querySelectorAll('.dino-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function init() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // Hitbox của dino
    dino = { x: 50, y: canvas.height - GROUND_H - 35, w: 35, h: 35, v: 0, grounded: true };
    obstacles = [];
    clouds = Array.from({length: 4}, () => ({ 
        x: Math.random()*canvas.width, y: 20 + Math.random()*50, 
        s: 0.8 + Math.random(), op: 0.2 + Math.random()*0.3 
    }));
    score = 0; frameCount = 0; gameSpeed = 5;
    isPaused = false; isGameOver = false; isStarted = false;
    document.getElementById('current-score').textContent = '0';
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('game-hint').style.display = 'block';
}

function update() {
    if (!isStarted || isPaused || isGameOver) return;
    frameCount++;
    if (frameCount % 600 === 0) gameSpeed += 0.4;

    dino.v += GRAVITY;
    dino.y += dino.v;
    if (dino.y > canvas.height - GROUND_H - dino.h) {
        dino.y = canvas.height - GROUND_H - dino.h;
        dino.v = 0; dino.grounded = true;
    }

    if (frameCount % 110 === 0) {
        obstacles.push({ x: canvas.width, w: 20, h: 30 + Math.random()*30 });
    }

    obstacles.forEach((o, i) => {
        o.x -= gameSpeed;
        if (dino.x < o.x + o.w && dino.x + dino.w > o.x && 
            dino.y + dino.h > canvas.height - GROUND_H - o.h) {
            endGame();
        }
        if (o.x < -o.w) { obstacles.splice(i, 1); score += 10; document.getElementById('current-score').textContent = score; }
    });

    clouds.forEach(c => {
        c.x -= gameSpeed * 0.2 * c.s;
        if (c.x < -100) c.x = canvas.width + 50;
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Nền & Mặt trời
    ctx.fillStyle = '#ffedd5'; ctx.fillRect(0,0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath(); ctx.arc(canvas.width * 0.8, canvas.height * 0.2, 25, 0, Math.PI*2); ctx.fill();

    // Mây
    clouds.forEach(c => {
        ctx.fillStyle = `rgba(255,255,255,${c.op})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, 15*c.s, 0, Math.PI*2); ctx.fill();
    });

    // Đất
    ctx.fillStyle = '#64748b'; ctx.fillRect(0, canvas.height - GROUND_H, canvas.width, GROUND_H);

    // DINO LẬT MẶT SANG PHẢI 🦖
    ctx.save();
    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(dino.x + dino.w/2, dino.y + dino.h/2);
    ctx.scale(-1, 1); // Lật ngang
    ctx.fillText('🦖', 0, 0); 
    ctx.restore();

    // Xương rồng
    ctx.fillStyle = '#1e293b';
    obstacles.forEach(o => ctx.fillRect(o.x, canvas.height - GROUND_H - o.h, o.w, o.h));

    if (!isGameOver && !isPaused) {
        update();
        gameLoop = requestAnimationFrame(draw);
    }
}

function jump() {
    if (isGameOver || isPaused) return;
    if (!isStarted) { isStarted = true; document.getElementById('game-hint').style.display = 'none'; }
    if (dino.grounded) { dino.v = JUMP_FORCE; dino.grounded = false; }
}

async function endGame() {
    isGameOver = true;
    cancelAnimationFrame(gameLoop);
    const earned = Math.floor(score / 100);
    document.getElementById('final-score').textContent = score;
    document.getElementById('earned-pts').textContent = '+' + earned;
    showScreen('screen-result');
    if (auth.currentUser && earned > 0) { await addPoints('Dino', 'Chạy bộ 🦖', earned); refreshPts(); }
}

// Events
document.getElementById('btn-start').addEventListener('click', () => { showScreen('screen-game'); init(); draw(); });
document.getElementById('btn-restart').addEventListener('click', () => { showScreen('screen-game'); init(); draw(); });
document.getElementById('btn-home').addEventListener('click', () => showScreen('screen-menu'));
document.getElementById('btn-pause').addEventListener('click', (e) => { 
    e.stopPropagation(); isPaused = !isPaused; 
    document.getElementById('pause-overlay').style.display = isPaused ? 'flex' : 'none';
    if(!isPaused) draw();
});
document.getElementById('btn-resume').addEventListener('click', () => { isPaused = false; document.getElementById('pause-overlay').style.display = 'none'; draw(); });

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
canvas.addEventListener('mousedown', jump);
window.addEventListener('keydown', (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') jump(); });

async function refreshPts() {
    const p = await getPoints();
    if(document.getElementById('nav-pts')) document.getElementById('nav-pts').textContent = '⭐ ' + p.toLocaleString();
}
onAuthStateChanged(auth, user => { if(user) refreshPts(); });
