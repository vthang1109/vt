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

const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');
const gridSize = 20; 

let tileCount, snake, food, dx, dy, score, gameLoop;
let isPlaying = false; 
let gameSpeed = 100;

// Hàm chuyển màn hình triệt để
function showScreen(id) {
    document.querySelectorAll('.snake-screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const target = document.getElementById(id);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);
}

function init() {
    if (gameLoop) clearTimeout(gameLoop);
    const size = canvas.parentElement.clientWidth || 300; 
    canvas.width = size;
    canvas.height = size;
    tileCount = Math.floor(size / gridSize);
    const center = Math.floor(tileCount / 2);
    snake = [{ x: center, y: center }];
    dx = 1; dy = 0; score = 0;
    isPlaying = true; 
    generateFood();
    document.getElementById('current-score').textContent = '0';
}

function generateFood() {
    food = { 
        x: Math.floor(Math.random() * tileCount), 
        y: Math.floor(Math.random() * tileCount) 
    };
    if (snake && snake.some(s => s.x === food.x && s.y === food.y)) generateFood();
}

function draw() {
    if (!isPlaying) return;
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount || 
        snake.some(s => s.x === head.x && s.y === head.y)) {
        gameOver();
        return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('current-score').textContent = score;
        generateFood();
    } else {
        snake.pop();
    }

    ctx.fillStyle = '#041428';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(food.x * gridSize + 2, food.y * gridSize + 2, gridSize - 4, gridSize - 4);
    snake.forEach((part, i) => {
        ctx.fillStyle = i === 0 ? '#38bdf8' : '#0ea5e9';
        ctx.fillRect(part.x * gridSize + 1, part.y * gridSize + 1, gridSize - 2, gridSize - 2);
    });

    gameLoop = setTimeout(draw, gameSpeed);
}

async function gameOver() {
    isPlaying = false; 
    if (gameLoop) clearTimeout(gameLoop);
    const earned = Math.floor(score / 5);
    document.getElementById('final-score').textContent = score;
    document.getElementById('earned-pts').textContent = '+' + earned;
    showScreen('screen-result');
    if (auth.currentUser && earned > 0) {
        await addPoints('Snake', 'Kết thúc ván', earned);
        refreshPts();
    }
}

// Logic điều hướng
const startGame = () => {
    isPlaying = false; 
    if (gameLoop) clearTimeout(gameLoop);
    showScreen('screen-game');
    setTimeout(() => {
        init();
        draw();
    }, 100);
};

const showMenu = () => {
    isPlaying = false; 
    if (gameLoop) clearTimeout(gameLoop);
    showScreen('screen-menu');
};

// GÁN SỰ KIỆN NÚT (Sửa lỗi nút Về menu)
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', showMenu);

// Tốc độ
document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.id === 'btn-home') return; // Bỏ qua nút Về menu
        document.querySelectorAll('.speed-btn:not(#btn-home)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameSpeed = parseInt(btn.dataset.speed);
    });
});

// Điều khiển
window.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -1; }
    else if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = 1; }
    else if (e.key === 'ArrowLeft' && dx === 0) { dx = -1; dy = 0; }
    else if (e.key === 'ArrowRight' && dx === 0) { dx = 1; dy = 0; }
});

document.getElementById('btn-up').onclick = () => { if(dy===0){dx=0; dy=-1;} };
document.getElementById('btn-down').onclick = () => { if(dy===0){dx=0; dy=1;} };
document.getElementById('btn-left').onclick = () => { if(dx===0){dx=-1; dy=0;} };
document.getElementById('btn-right').onclick = () => { if(dx===0){dx=1; dy=0;} };

async function refreshPts() {
    try {
        const p = await getPoints();
        const nav = document.getElementById('nav-pts');
        if(nav) nav.textContent = '⭐ ' + p.toLocaleString();
    } catch(e) {}
}
onAuthStateChanged(auth, user => { if(user) refreshPts(); });
