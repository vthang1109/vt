import { addPoints, getPoints } from './points.js';

class Football {
    constructor() {
        this.canvas = document.getElementById('pitch');
        this.ctx = this.canvas.getContext('2d');
        this.W = 800; this.H = 400;

        // Player
        this.player = { x: 150, y: 200, r: 18, vx: 0, vy: 0, speed: 4 };
        // Bot
        this.bot = { x: 650, y: 200, r: 18, vx: 0, vy: 0, speed: 3 };
        // Ball
        this.ball = { x: 400, y: 200, r: 8, vx: 0, vy: 0, friction: 0.98 };
        // Goals
        this.goalTop = 130; this.goalBottom = 270;

        this.score = [0, 0]; // [YOU, BOT]
        this.time = 60;
        this.difficulty = 1; // 0=easy, 1=medium, 2=hard
        this.gameOver = false;
        this.timerInterval = null;

        this.keys = {};
        this.init();
    }

    async init() {
        await this.refreshPts();
        this.bindInput();
        this.bindTouch();
        this.bindDifficulty();
        this.startMatch();
    }

    async refreshPts() {
        const pts = await getPoints();
        document.getElementById('nav-pts').textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
    }

    bindInput() {
        window.addEventListener('keydown', e => { this.keys[e.key] = true; e.preventDefault(); });
        window.addEventListener('keyup', e => { this.keys[e.key] = false; });
    }

    bindTouch() {
        const map = { btnUp:'ArrowUp', btnDown:'ArrowDown', btnLeft:'ArrowLeft', btnRight:'ArrowRight' };
        Object.entries(map).forEach(([id, key]) => {
            const b = document.getElementById(id);
            if (!b) return;
            b.addEventListener('pointerdown', e => { e.preventDefault(); this.keys[key] = true; });
            b.addEventListener('pointerup', () => { this.keys[key] = false; });
        });
        document.getElementById('btnShoot').addEventListener('pointerdown', e => {
            e.preventDefault(); this.keys[' '] = true;
            setTimeout(() => this.keys[' '] = false, 100);
        });
    }

    bindDifficulty() {
        document.getElementById('difficulty').addEventListener('click', () => {
            const diffs = ['DỄ', 'TRUNG BÌNH', 'KHÓ'];
            this.difficulty = (this.difficulty + 1) % 3;
            document.getElementById('difficulty').textContent = 'ĐỘ KHÓ: ' + diffs[this.difficulty];
            if (this.difficulty === 0) this.bot.speed = 2;
            else if (this.difficulty === 1) this.bot.speed = 3;
            else this.bot.speed = 4.5;
        });
    }

    startMatch() {
        this.score = [0, 0];
        this.time = 60;
        this.gameOver = false;
        this.resetPositions();
        this.updateScoreboard();
        document.getElementById('resultModal').classList.remove('active');

        this.timerInterval = setInterval(() => {
            if (this.gameOver) return;
            this.time--;
            document.getElementById('timer').textContent = this.time + 's';
            if (this.time <= 0) this.endMatch();
        }, 1000);

        requestAnimationFrame(() => this.loop());
    }

    resetPositions() {
        this.player.x = 150; this.player.y = 200; this.player.vx = 0; this.player.vy = 0;
        this.bot.x = 650; this.bot.y = 200; this.bot.vx = 0; this.bot.vy = 0;
        this.ball.x = 400; this.ball.y = 200; this.ball.vx = 0; this.ball.vy = 0;
    }

    update() {
        if (this.gameOver) return;

        // Player input
        if (this.keys['ArrowLeft']) this.player.vx = -this.player.speed;
        else if (this.keys['ArrowRight']) this.player.vx = this.player.speed;
        else this.player.vx = 0;
        if (this.keys['ArrowUp']) this.player.vy = -this.player.speed;
        else if (this.keys['ArrowDown']) this.player.vy = this.player.speed;
        else this.player.vy = 0;

        // Shoot
        if (this.keys[' '] && this.dist(this.player, this.ball) < 40) {
            const angle = Math.atan2(200 - this.player.y, 800 - this.player.x);
            this.ball.vx = Math.cos(angle) * 14;
            this.ball.vy = Math.sin(angle) * 8 + (Math.random() - 0.5) * 6;
        }

        // Move player
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        this.clampPlayer(this.player);

        // Bot AI
        this.botAI();

        // Ball physics
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;
        this.ball.vx *= this.ball.friction;
        this.ball.vy *= this.ball.friction;

        // Ball collision with players
        if (this.dist(this.player, this.ball) < 26) {
            const angle = Math.atan2(this.ball.y - this.player.y, this.ball.x - this.player.x);
            this.ball.vx = Math.cos(angle) * 10;
            this.ball.vy = Math.sin(angle) * 8;
        }
        if (this.dist(this.bot, this.ball) < 26) {
            const angle = Math.atan2(this.ball.y - this.bot.y, this.ball.x - this.bot.x);
            this.ball.vx = Math.cos(angle) * 10;
            this.ball.vy = Math.sin(angle) * 8;
        }

        // Ball bounds (top/bottom)
        if (this.ball.y < 10) { this.ball.y = 10; this.ball.vy *= -0.6; }
        if (this.ball.y > this.H - 10) { this.ball.y = this.H - 10; this.ball.vy *= -0.6; }

        // GOAL!
        if (this.ball.x < 20 && this.ball.y > this.goalTop && this.ball.y < this.goalBottom) {
            this.score[1]++; // Bot ghi bàn
            this.updateScoreboard();
            this.resetPositions();
        }
        if (this.ball.x > this.W - 20 && this.ball.y > this.goalTop && this.ball.y < this.goalBottom) {
            this.score[0]++; // You ghi bàn
            this.updateScoreboard();
            this.resetPositions();
        }

        // Ball out
        if (this.ball.x < 5 || this.ball.x > this.W - 5) {
            this.resetPositions();
        }
    }

    botAI() {
        if (this.difficulty === 0) {
            if (this.ball.x < 400) { this.bot.vx = -this.bot.speed; }
            else { this.bot.vx = (this.ball.x - this.bot.x) * 0.02; }
            this.bot.vy = (this.ball.y - this.bot.y) * 0.02;
        } else if (this.difficulty === 1) {
            if (this.ball.x < 500) { this.bot.vx = (this.ball.x - this.bot.x) * 0.03; }
            this.bot.vy = (this.ball.y - this.bot.y) * 0.03;
        } else {
            this.bot.vx = (this.ball.x - this.bot.x) * 0.05;
            this.bot.vy = (this.ball.y - this.bot.y) * 0.05;
        }
        this.bot.x += this.bot.vx;
        this.bot.y += this.bot.vy;
        this.clampPlayer(this.bot);

        // Bot shoot
        if (this.dist(this.bot, this.ball) < 40 && Math.random() < 0.02) {
            const angle = Math.atan2(200 - this.bot.y, 0 - this.bot.x);
            this.ball.vx = Math.cos(angle) * 12;
            this.ball.vy = Math.sin(angle) * 6 + (Math.random() - 0.5) * 4;
        }
    }

    clampPlayer(p) {
        if (p.x < 30) p.x = 30;
        if (p.x > this.W - 30) p.x = this.W - 30;
        if (p.y < 20) p.y = 20;
        if (p.y > this.H - 20) p.y = this.H - 20;
    }

    dist(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    updateScoreboard() {
        document.getElementById('youScore').textContent = this.score[0];
        document.getElementById('botScore').textContent = this.score[1];
    }

    async endMatch() {
        this.gameOver = true;
        clearInterval(this.timerInterval);

        const you = this.score[0], bot = this.score[1];
        let title, reward = 0;
        if (you > bot) { title = '🏆 BẠN THẮNG!'; reward = 50; }
        else if (bot > you) { title = '💀 BOT THẮNG'; reward = 5; }
        else { title = '🤝 HÒA'; reward = 20; }

        try { await addPoints('Bóng Đá', title, reward); await this.refreshPts(); } catch(e) {}
        if (window.VTQuests) { window.VTQuests.trackPlay('football'); if (reward > 20) window.VTQuests.trackEarn(reward); }

        document.getElementById('resultTitle').textContent = title;
        document.getElementById('resultText').textContent = `YOU ${you} - ${bot} BOT | +${reward}đ`;
        document.getElementById('resultModal').classList.add('active');
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0d5e0d';
        ctx.fillRect(0, 0, this.W, this.H);

        // Vạch sân
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.W/2, 0); ctx.lineTo(this.W/2, this.H);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(this.W/2, this.H/2, 60, 0, Math.PI*2); ctx.stroke();

        // Khung thành
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, this.goalTop, 20, this.goalBottom - this.goalTop);
        ctx.strokeRect(this.W - 20, this.goalTop, 20, this.goalBottom - this.goalTop);

        // Player
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px Nunito'; ctx.fillText('YOU', this.player.x - 15, this.player.y - 22);

        // Bot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(this.bot.x, this.bot.y, this.bot.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px Nunito'; ctx.fillText('BOT', this.bot.x - 12, this.bot.y - 22);

        // Ball
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, 3, 0, Math.PI*2); ctx.fill();
    }

    loop() {
        this.update();
        this.draw();
        if (!this.gameOver) requestAnimationFrame(() => this.loop());
    }
}

new Football();