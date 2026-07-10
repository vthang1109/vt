// timso.js — Tìm Số 1-100 (2 chế độ: 1 người tính giờ / 2 người 1 máy mỗi lượt 10s)

class TimSo {
    constructor() {
        this.mode = null;        // 'solo' | 'duo'
        this.grid = [];
        this.target = 1;
        this.finished = false;

        // solo
        this.startTime = null;
        this.elapsed = 0;
        this.timerInterval = null;
        this.bestTime = this.loadBest();

        // duo
        this.turn = 1;
        this.scores = { 1: 0, 2: 0 };
        this.turnTimeLeft = 10;
        this.turnTimerInterval = null;

        window.game = this;
    }

    // ---------- best time (localStorage, không cần đăng nhập) ----------
    loadBest() {
        try {
            const v = parseFloat(localStorage.getItem('ts_best_time'));
            return isNaN(v) ? null : v;
        } catch { return null; }
    }
    saveBest(t) {
        try { localStorage.setItem('ts_best_time', String(t)); } catch {}
    }

    // ---------- chọn chế độ ----------
    selectMode(mode) {
        this.mode = mode;
        document.getElementById('ts-mode-select').style.display = 'none';
        document.getElementById('ts-status').style.display = 'flex';
        document.getElementById('ts-board').style.display = 'grid';
        document.getElementById('ts-actions').style.display = 'flex';
        document.getElementById('ts-status')?.classList.toggle('ts-duo', mode === 'duo');
        this.startGame();
    }

    backToModeSelect() {
        this.stopTimers();
        document.getElementById('ts-mode-select').style.display = 'block';
        document.getElementById('ts-status').style.display = 'none';
        document.getElementById('ts-board').style.display = 'none';
        document.getElementById('ts-actions').style.display = 'none';
        document.getElementById('ts-status')?.classList.remove('result-win', 'result-lose', 'result-draw', 'ts-duo');
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    stopTimers() {
        clearInterval(this.timerInterval);
        clearInterval(this.turnTimerInterval);
        this.timerInterval = null;
        this.turnTimerInterval = null;
    }

    // ---------- bắt đầu ván mới ----------
    startGame() {
        this.stopTimers();
        this.grid = this.shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
        this.target = 1;
        this.finished = false;
        this.elapsed = 0;
        this.scores = { 1: 0, 2: 0 };
        this.turn = 1;

        document.getElementById('ts-status')?.classList.remove('result-win', 'result-lose', 'result-draw');
        this.render();
        this.updateStatus();

        if (this.mode === 'solo') this.startSoloTimer();
        else this.startDuoTurn();
    }

    render() {
        const board = document.getElementById('ts-board');
        board.innerHTML = this.grid.map(n =>
            `<button class="ts-cell" data-num="${n}" onclick="window.game.tap(${n})">${n}</button>`
        ).join('');
    }

    updateStatus() {
        const leftEl = document.getElementById('ts-left');
        const targetEl = document.getElementById('ts-target');
        const subEl = document.getElementById('ts-sub');
        const timerEl = document.getElementById('ts-timer');

        if (this.mode === 'solo') {
            leftEl.textContent = this.bestTime ? `🏆 ${this.bestTime.toFixed(1)}s` : 'Chưa có kỷ lục';
            targetEl.innerHTML = `${this.target}`;
            subEl.textContent = 'Tìm số tiếp theo';
            timerEl.textContent = `${this.elapsed.toFixed(1)}s`;
            timerEl.className = 'stat-profit zero';
        } else {
            leftEl.textContent = `P1: ${this.scores[1]}`;
            leftEl.className = this.turn === 1 ? 'stat-bet turn-p1' : 'stat-bet';

            targetEl.innerHTML = `<span class="ts-num">${this.target}</span><span class="ts-countdown${this.turnTimeLeft <= 3 ? ' warn' : ''}">${this.turnTimeLeft}s</span>`;
            subEl.textContent = `Lượt: Người ${this.turn}`;

            timerEl.textContent = `P2: ${this.scores[2]}`;
            timerEl.className = this.turn === 2 ? 'stat-profit turn-p2' : 'stat-profit zero';
        }
    }

    // ---------- chế độ 1 người ----------
    startSoloTimer() {
        this.startTime = performance.now();
        this.timerInterval = setInterval(() => {
            this.elapsed = (performance.now() - this.startTime) / 1000;
            const timerEl = document.getElementById('ts-timer');
            if (timerEl) timerEl.textContent = `${this.elapsed.toFixed(1)}s`;
        }, 100);
    }

    // ---------- chế độ 2 người ----------
    startDuoTurn() {
        clearInterval(this.turnTimerInterval);
        this.turnTimeLeft = 10;
        this.updateStatus();
        this.turnTimerInterval = setInterval(() => {
            this.turnTimeLeft--;
            if (this.turnTimeLeft <= 0) {
                clearInterval(this.turnTimerInterval);
                window.showToast(`⏰ Hết giờ! Đổi lượt sang Người ${this.turn === 1 ? 2 : 1}`, 'warn');
                this.switchTurn();
            } else {
                this.updateStatus();
            }
        }, 1000);
    }

    switchTurn() {
        this.turn = this.turn === 1 ? 2 : 1;
        this.startDuoTurn();
    }

    // ---------- xử lý bấm số ----------
    tap(n) {
        if (this.finished) return;
        const cellEl = document.querySelector(`.ts-cell[data-num="${n}"]`);
        if (!cellEl || cellEl.disabled) return;

        if (n === this.target) {
            if (this.mode === 'duo') {
                cellEl.classList.add(this.turn === 1 ? 'correct-p1' : 'correct-p2');
            } else {
                cellEl.classList.add('correct');
            }
            cellEl.disabled = true;
            if (this.mode === 'duo') this.scores[this.turn]++;
            this.target++;

            if (this.target > 100) {
                this.endGame();
                return;
            }
            if (this.mode === 'duo') this.startDuoTurn(); // đúng -> giữ lượt, reset 10s
            this.updateStatus();
        } else {
            cellEl.classList.add('wrong');
            setTimeout(() => cellEl.classList.remove('wrong'), 300);
            if (this.mode === 'duo') {
                window.showToast('❌ Sai số! Đổi lượt', 'error');
                this.switchTurn();
            }
        }
    }

    // ---------- kết thúc ván ----------
    endGame() {
        this.finished = true;
        this.stopTimers();
        const statusEl = document.getElementById('ts-status');

        if (this.mode === 'solo') {
            const finalTime = this.elapsed;
            let isRecord = false;
            if (!this.bestTime || finalTime < this.bestTime) {
                this.bestTime = finalTime;
                this.saveBest(finalTime);
                isRecord = true;
            }
            statusEl?.classList.add('result-win');
            document.getElementById('ts-left').textContent = isRecord ? '🏆 Kỷ lục mới!' : `🏆 ${this.bestTime.toFixed(1)}s`;
            document.getElementById('ts-target').textContent = '✔️';
            document.getElementById('ts-sub').textContent = 'Hoàn thành!';
            document.getElementById('ts-timer').textContent = `${finalTime.toFixed(1)}s`;
            window.showToast(`🎉 Hoàn thành trong ${finalTime.toFixed(1)}s${isRecord ? ' - Kỷ lục mới!' : ''}`, 'success');
        } else {
            const winner = this.scores[1] > this.scores[2] ? 1 : (this.scores[2] > this.scores[1] ? 2 : 0);
            statusEl?.classList.add(winner ? 'result-win' : 'result-draw');
            document.getElementById('ts-left').textContent = `P1: ${this.scores[1]}  |  P2: ${this.scores[2]}`;
            document.getElementById('ts-target').textContent = winner ? `🏆 P${winner}` : '🤝';
            document.getElementById('ts-sub').textContent = winner ? `Người ${winner} thắng!` : 'Hoà!';
            document.getElementById('ts-timer').textContent = '--';
            window.showToast(winner ? `🎉 Người ${winner} thắng!` : '🤝 Hoà!', 'success');
        }
    }

    restart() {
        this.startGame();
    }
}

new TimSo();
