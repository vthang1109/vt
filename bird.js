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

const canvas = document.getElementById('bird-canvas');
const ctx = canvas.getContext('2d');

// Thông số vật lý (Đã cân bằng)
const GRAVITY = 0.22; 
const JUMP = -4.5;    
const PIPE_SPEED = 2.0;
const PIPE_GAP = 150; 
const PIPE_SPAWN_RATE = 90;
const GROUND_H = 70; // Chiều cao mặt đất

let bird, pipes, score, frameCount, gameLoop;
let isPaused = false, isGameOver = false, isStarted = false;

function showScreen(id) {
    document.querySelectorAll('.bird-screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(id);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);
}

function init() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    bird = { 
        x: canvas.width * 0.2, 
        y: (canvas.height - GROUND_H) / 2, // Giữa khoảng trời
        v: 0, 
        r: 12,
    };
    pipes = [];
    score = 0;
    frameCount = 0;
    isPaused = false;
    isGameOver = false;
    isStarted = false;
    
    document.getElementById('current-score').textContent = '0';
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('game-hint').style.display = 'block';
}

function spawnPipe() {
    const pipeWidth = 60;
    const minH = 60; 
    const maxH = canvas.height - GROUND_H - PIPE_GAP - minH; // Giới hạn bởi mặt đất
    const h = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
    pipes.push({ x: canvas.width, h: h, w: pipeWidth, passed: false });
}

function update() {
    if (!isStarted || isPaused || isGameOver) return;

    frameCount++;
    bird.v += GRAVITY;
    bird.y += bird.v;

    if (frameCount % PIPE_SPAWN_RATE === 0) spawnPipe();

    pipes.forEach((p, index) => {
        p.x -= PIPE_SPEED;

        // Va chạm (Bird vs Pipe)
        if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + p.w) {
            if (bird.y - bird.r < p.h || bird.y + bird.r > p.h + PIPE_GAP) {
                endGame();
            }
        }

        // Cộng điểm
        if (!p.passed && p.x + p.w < bird.x) {
            p.passed = true;
            score++;
            document.getElementById('current-score').textContent = score;
        }

        // Xóa ống cũ
        if (p.x < -p.w - 10) pipes.splice(index, 1);
    });

    // Va chạm biên (Đất hoặc trời)
    if (bird.y + bird.r > canvas.height - GROUND_H || bird.y - bird.r < 0) endGame();
}

// HÀM VẼ BACKGROUND (Bầu trời, mặt đất, núi, mặt trời - Màu mờ dịu)
function drawBackground(f) {
    // 1. Bầu trời (Màu mờ dịu)
    ctx.fillStyle = '#cceeff'; // Xanh nhạt mờ
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Mặt trời (Màu mờ dịu)
    ctx.fillStyle = '#ffeedd'; // Vàng nhạt mờ
    ctx.beginPath();
    ctx.arc(canvas.width * 0.8, canvas.height * 0.15, 30, 0, Math.PI*2);
    ctx.fill();

    // 3. Núi (Màu mờ dịu, hiệu ứng mờ nhẹ bằng gradient)
    const mtnGradient = ctx.createLinearGradient(0, canvas.height * 0.3, 0, canvas.height - GROUND_H);
    mtnGradient.addColorStop(0, '#99ccaa'); // Xanh lá mờ đậm hơn ở đỉnh
    mtnGradient.addColorStop(1, '#bbddbb'); // Xanh lá mờ nhạt hơn ở chân
    ctx.fillStyle = mtnGradient;
    
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.1, canvas.height * 0.3 + 50);
    ctx.lineTo(canvas.width * 0.3, canvas.height * 0.3);
    ctx.lineTo(canvas.width * 0.5, canvas.height * 0.3 + 30);
    ctx.lineTo(canvas.width * 0.7, canvas.height * 0.3 - 20);
    ctx.lineTo(canvas.width * 0.9, canvas.height * 0.3 + 40);
    ctx.lineTo(canvas.width, canvas.height * 0.3 + 20);
    ctx.lineTo(canvas.width, canvas.height - GROUND_H);
    ctx.lineTo(0, canvas.height - GROUND_H);
    ctx.closePath();
    ctx.fill();

    // 4. Mặt đất (Màu mờ dịu, có kẻ sọc mờ)
    ctx.fillStyle = '#bbddff'; // Xanh dương mờ
    ctx.fillRect(0, canvas.width, canvas.width, canvas.height - GROUND_H);
    ctx.fillStyle = '#aaddff'; // Kẻ sọc mờ
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.fillRect(i, canvas.height - GROUND_H, 10, GROUND_H);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vẽ Background trước
    drawBackground(frameCount);

    // Vẽ Ống nước
    pipes.forEach(p => {
        ctx.fillStyle = '#22c55e'; // Xanh lá tươi
        ctx.fillRect(p.x, 0, p.w, p.h); 
        ctx.fillRect(p.x, p.h + PIPE_GAP, p.w, canvas.height); 
        
        const capHeight = 20;
        const capGap = 2; 
        ctx.fillStyle = '#166534'; 
        ctx.fillRect(p.x - capGap, p.h - capHeight, p.w + capGap * 2, capHeight);
        ctx.fillRect(p.x - capGap, p.h + PIPE_GAP, p.w + capGap * 2, capHeight);
    });

    // Vẽ chim (Rắn bay vàng)
    if (!isStarted) {
        bird.y = ((canvas.height - GROUND_H) / 2) + Math.sin(frameCount * 0.1) * 15;
        frameCount++; 
    }

    ctx.save();
    ctx.translate(bird.x, bird.y);
    if (isStarted) {
        ctx.rotate(Math.min(Math.PI/3, Math.max(-Math.PI/6, bird.v * 0.12)));
    }
    
    ctx.fillStyle = '#facc15'; // Màu vàng chanh
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#a16207'; 
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -4, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(8, -4, 2, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = '#ea580c'; ctx.beginPath();
    ctx.moveTo(12, -2); ctx.lineTo(18, 0); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
    
    ctx.restore();

    if (!isGameOver && !isPaused) {
        if (isStarted) update();
        gameLoop = requestAnimationFrame(draw);
    }
}

function jump() {
    if (isGameOver || isPaused) return;

    if (!isStarted) {
        isStarted = true;
        document.getElementById('game-hint').style.display = 'none'; 
    }
    
    bird.v = JUMP; 
}

async function endGame() {
    isGameOver = true;
    cancelAnimationFrame(gameLoop);
    const earned = Math.floor(score / 2);
    document.getElementById('final-score').textContent = score;
    document.getElementById('earned-pts').textContent = '+' + earned;
    showScreen('screen-result');

    if (auth.currentUser && earned > 0) {
        await addPoints('Flappy Bird', 'Bay xa', earned);
        refreshPts();
    }
}

function togglePause() {
    if (isGameOver || !isStarted) return; 
    isPaused = !isPaused;
    document.getElementById('pause-overlay').style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) draw();
}

// Event Listeners (Đồng bộ)
document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('screen-game');
    init();
    draw();
});
document.getElementById('btn-restart').addEventListener('click', () => {
    showScreen('screen-game');
    init();
    draw();
});
document.getElementById('btn-home').addEventListener('click', () => showScreen('screen-menu'));
document.getElementById('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
document.getElementById('btn-resume').addEventListener('click', togglePause);

// Điều khiển
canvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    jump(); 
});
canvas.addEventListener('mousedown', (e) => { 
    if (e.button === 0) jump(); 
});
window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space' || e.code === 'ArrowUp') jump(); 
});

async function refreshPts() {
    try {
        const p = await getPoints();
        const nav = document.getElementById('nav-pts');
        if(nav) nav.textContent = '⭐ ' + p.toLocaleString();
    } catch(e) {}
}
onAuthStateChanged(auth, user => { if(user) refreshPts(); });
