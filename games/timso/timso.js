// timso.js — Tìm Số 1-100 (2 chế độ: 1 người tính giờ / 2 người 1 máy mỗi lượt 10s)
import { addPoints, db, auth, subscribeUserData } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection, addDoc, doc, onSnapshot, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const PAUSE_SVG = '<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>';
const PLAY_SVG = '<polygon points="7,4 20,12 7,20"></polygon>';

// Thưởng điểm theo thời gian hoàn thành (chỉ chế độ 1 người — mốc thời gian
// chống cày điểm, không thưởng chế độ 2 người vì chung 1 tài khoản đăng nhập)
function calcSoloReward(timeSec, shuffleMode) {
    let base;
    if (timeSec <= 300) base = 400;       // ≤5 phút — cực nhanh, hiếm gặp
    else if (timeSec <= 450) base = 300;  // ≤7.5 phút — giỏi
    else if (timeSec <= 600) base = 220;  // ≤10 phút — khá
    else if (timeSec <= 900) base = 150;  // ≤15 phút — trung bình
    else base = 100;                      // hoàn thành, chậm
    if (shuffleMode === 'shuffle') base = Math.round(base * 1.5);
    return base;
}

// Thưởng điểm chế độ Huỷ Diệt: theo số lượng tìm đúng (không cần hoàn thành cả 100)
function calcDestroyReward(foundCount, shuffleMode) {
    let base = foundCount * 5; // 5 điểm / số tìm đúng, tối đa 500 nếu tìm hết 100
    if (shuffleMode === 'shuffle') base = Math.round(base * 1.6);
    return base;
}

class TimSo {
    constructor() {
        this.mode = null;        // 'solo' | 'duo'
        this.shuffleMode = 'fixed'; // 'fixed' | 'shuffle'
        this.grid = [];
        this.found = new Map(); // num -> 'solo' | 1 | 2
        this.target = 1;
        this.finished = false;

        // solo
        this.startTime = null;
        this.elapsed = 0;
        this.timerInterval = null;
        this.lastReward = 0;

        // duo
        this.turn = 1;
        this.scores = { 1: 0, 2: 0 };
        this.turnTimeLeft = 10;
        this.turnTimerInterval = null;

        // huỷ diệt
        this.destroyTimeLeft = 10;
        this.destroyTimerInterval = null;

        // tạm dừng
        this.isPaused = false;
        this.pauseBtn = document.getElementById('ts-pause-btn');
        this.pauseIcon = document.getElementById('ts-pause-icon');

        // bxh — denormalize: 1 doc top-10 / chế độ, subscribe 1 lần khi vào trang.
        // Mở BXH sau đó đọc thẳng từ cache client (this.lbLive) -> 0 read.
        this.lbTab = 'solo';
        this.lbLive = { solo: [], destroy: [] };
        ['solo', 'destroy'].forEach(tab => {
            onSnapshot(doc(db, 'timso_leaderboards', tab), snap => {
                this.lbLive[tab] = snap.exists() ? (snap.data().entries || []) : [];
                if (this.lbTab === tab && document.getElementById('ts-lb-modal')?.style.display === 'flex') {
                    this.renderLeaderboard(tab, this.lbLive[tab]);
                }
            });
        });

        this.cachedNickname = null;
        this.unsubUserData = subscribeUserData(data => {
            this.cachedNickname = data?.nickname || null;
        });

        window.game = this;
        clearTimeout(window.__tsReadyTimeout);
        document.body.classList.remove('ts-loading');
        this.setupMenuActions();
    }

    // ---------- gắn nút riêng của game vào hamburger menu (top-nav) ----------
    setupMenuActions() {
        window.TopNav?.setMenuActions([
            { icon: '🔄', label: 'Chơi lại', onClick: () => this.restart() },
            { icon: '↩️', label: 'Đổi chế độ', onClick: () => this.backToModeSelect() }
        ]);
    }

    // ---------- chọn kiểu bảng số ----------
    setShuffleMode(mode) {
        this.shuffleMode = mode;
        document.querySelectorAll('.ts-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    // ---------- chọn chế độ ----------
    selectMode(mode) {
        this.mode = mode;
        document.getElementById('ts-mode-select').style.display = 'none';
        document.getElementById('ts-status').style.display = 'flex';
        document.getElementById('ts-board').style.display = 'grid';
        document.getElementById('ts-status')?.classList.toggle('ts-duo', mode === 'duo');
        if (this.pauseBtn) this.pauseBtn.style.display = 'flex';
        this.startGame();
    }

    backToModeSelect() {
        this.stopTimers();
        this.isPaused = false;
        document.getElementById('ts-mode-select').style.display = 'block';
        document.getElementById('ts-status').style.display = 'none';
        document.getElementById('ts-board').style.display = 'none';
        document.getElementById('ts-status')?.classList.remove('result-win', 'result-lose', 'result-draw', 'ts-duo');
        document.getElementById('ts-board')?.classList.remove('ts-paused');
        if (this.pauseBtn) { this.pauseBtn.style.display = 'none'; this.pauseBtn.classList.remove('paused'); }
        if (this.pauseIcon) this.pauseIcon.innerHTML = PAUSE_SVG;
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
        clearInterval(this.destroyTimerInterval);
        this.timerInterval = null;
        this.turnTimerInterval = null;
        this.destroyTimerInterval = null;
    }

    // ---------- bắt đầu ván mới ----------
    startGame() {
        this.stopTimers();
        this.isPaused = false;
        document.getElementById('ts-board')?.classList.remove('ts-paused');
        if (this.pauseBtn) this.pauseBtn.classList.remove('paused');
        if (this.pauseIcon) this.pauseIcon.innerHTML = PAUSE_SVG;
        this.grid = this.shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
        this.found = new Map();
        this.target = 1;
        this.finished = false;
        this.elapsed = 0;
        this.lastReward = 0;
        this.scores = { 1: 0, 2: 0 };
        this.turn = 1;

        document.getElementById('ts-status')?.classList.remove('result-win', 'result-lose', 'result-draw');
        this.render();
        this.updateStatus();

        if (this.mode === 'solo') this.startSoloTimer();
        else if (this.mode === 'destroy') { this.startSoloTimer(); this.startDestroyTimer(); }
        else this.startDuoTurn();
    }

    render() {
        const board = document.getElementById('ts-board');
        board.innerHTML = this.grid.map(n => {
            const owner = this.found.get(n);
            let cls = 'ts-cell';
            if (owner === 'solo') cls += ' correct';
            else if (owner === 1) cls += ' correct-p1';
            else if (owner === 2) cls += ' correct-p2';
            else if (owner === 'destroyed') cls += ' destroyed';
            const disabled = owner !== undefined ? 'disabled' : '';
            return `<button class="${cls}" data-num="${n}" onclick="window.game?.tap(${n})" ${disabled}>${n}</button>`;
        }).join('');
    }

    updateStatus() {
        const leftEl = document.getElementById('ts-left');
        const targetEl = document.getElementById('ts-target');
        const subEl = document.getElementById('ts-sub');
        const timerEl = document.getElementById('ts-timer');

        if (this.mode === 'solo') {
            leftEl.textContent = `${this.elapsed.toFixed(1)}s`;
            leftEl.className = 'stat-bet';
            targetEl.innerHTML = this.target > 100 ? 'Win' : `${this.target}`;
            subEl.textContent = this.target > 100 ? 'Hoàn thành!' : 'Tìm số tiếp theo';
            timerEl.textContent = this.lastReward > 0 ? `+${this.lastReward}` : '0';
            timerEl.className = this.lastReward > 0 ? 'stat-profit ts-earned' : 'stat-profit zero';
        } else if (this.mode === 'destroy') {
            let foundCount = 0;
            this.found.forEach(v => { if (v === 'solo') foundCount++; });
            leftEl.textContent = `${foundCount}`;
            leftEl.className = 'stat-bet';
            targetEl.innerHTML = this.target > 100
                ? `${this.elapsed.toFixed(1)}s`
                : `<span class="ts-num">${this.target}</span><span class="ts-countdown${this.destroyTimeLeft <= 3 ? ' warn' : ''}">${this.destroyTimeLeft}s</span>`;
            subEl.textContent = 'Tìm trong 10s!';
            timerEl.textContent = this.lastReward > 0 ? `+${this.lastReward}` : '0';
            timerEl.className = this.lastReward > 0 ? 'stat-profit ts-earned' : 'stat-profit zero';
        } else {
            leftEl.textContent = `P1: ${this.scores[1]}`;
            leftEl.className = this.turn === 1 ? 'stat-bet turn-p1' : 'stat-bet';

            targetEl.innerHTML = this.target > 100
                ? `Win`
                : `<span class="ts-num">${this.target}</span><span class="ts-countdown${this.turnTimeLeft <= 3 ? ' warn' : ''}">${this.turnTimeLeft}s</span>`;
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
            if (this.mode === 'solo') {
                const leftEl = document.getElementById('ts-left');
                if (leftEl) leftEl.textContent = `${this.elapsed.toFixed(1)}s`;
            }
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

    // ---------- chế độ huỷ diệt ----------
    startDestroyTimer() {
        clearInterval(this.destroyTimerInterval);
        this.destroyTimeLeft = 10;
        this.updateStatus();
        this.destroyTimerInterval = setInterval(() => {
            this.destroyTimeLeft--;
            if (this.destroyTimeLeft <= 0) {
                clearInterval(this.destroyTimerInterval);
                this.destroyNumber();
            } else {
                this.updateStatus();
            }
        }, 1000);
    }

    destroyNumber() {
        if (this.finished) return;
        const n = this.target;
        this.found.set(n, 'destroyed');
        const cellEl = document.querySelector(`.ts-cell[data-num="${n}"]`);
        if (cellEl) { cellEl.classList.add('destroyed'); cellEl.disabled = true; }
        window.showToast(`💥 Số ${n} bị huỷ diệt!`, 'error');
        this.target++;

        if (this.target > 100) {
            this.endGame();
            return;
        }
        if (this.shuffleMode === 'shuffle') {
            this.grid = this.shuffle(this.grid.slice());
            this.render();
        }
        this.startDestroyTimer();
    }

    // ---------- tạm dừng ----------
    togglePause() {
        if (!this.mode || this.finished) return;
        this.isPaused ? this.resumeGame() : this.pauseGame();
    }

    pauseGame() {
        if (this.isPaused || this.finished) return;
        this.isPaused = true;
        clearInterval(this.timerInterval);
        clearInterval(this.turnTimerInterval);
        clearInterval(this.destroyTimerInterval);
        this.timerInterval = null;
        this.turnTimerInterval = null;
        this.destroyTimerInterval = null;
        document.getElementById('ts-board')?.classList.add('ts-paused');
        this.pauseBtn?.classList.add('paused');
        if (this.pauseIcon) this.pauseIcon.innerHTML = PLAY_SVG;
        window.showToast('⏸️ Đã tạm dừng', 'info');
    }

    resumeGame() {
        if (!this.isPaused) return;
        this.isPaused = false;
        document.getElementById('ts-board')?.classList.remove('ts-paused');
        this.pauseBtn?.classList.remove('paused');
        if (this.pauseIcon) this.pauseIcon.innerHTML = PAUSE_SVG;

        if (this.mode === 'solo' || this.mode === 'destroy') {
            this.startTime = performance.now() - this.elapsed * 1000;
            this.timerInterval = setInterval(() => {
                this.elapsed = (performance.now() - this.startTime) / 1000;
                if (this.mode === 'solo') {
                    const leftEl = document.getElementById('ts-left');
                    if (leftEl) leftEl.textContent = `${this.elapsed.toFixed(1)}s`;
                }
            }, 100);
        }
        if (this.mode === 'destroy') {
            this.destroyTimerInterval = setInterval(() => {
                this.destroyTimeLeft--;
                if (this.destroyTimeLeft <= 0) {
                    clearInterval(this.destroyTimerInterval);
                    this.destroyNumber();
                } else {
                    this.updateStatus();
                }
            }, 1000);
        }
        if (this.mode === 'duo') {
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
        window.showToast('▶️ Tiếp tục', 'info');
    }

    // ---------- xử lý bấm số ----------
    tap(n) {
        if (this.finished || this.isPaused) return;
        const cellEl = document.querySelector(`.ts-cell[data-num="${n}"]`);
        if (!cellEl || cellEl.disabled) return;

        if (n === this.target) {
            const owner = this.mode === 'duo' ? this.turn : 'solo';
            this.found.set(n, owner);
            if (this.mode === 'duo') this.scores[this.turn]++;
            this.target++;

            if (this.target > 100) {
                if (this.shuffleMode !== 'shuffle') {
                    cellEl.classList.add(owner === 'solo' ? 'correct' : (owner === 1 ? 'correct-p1' : 'correct-p2'));
                    cellEl.disabled = true;
                }
                this.endGame();
                return;
            }

            if (this.shuffleMode === 'shuffle') {
                this.grid = this.shuffle(this.grid.slice());
                this.render();
            } else {
                cellEl.classList.add(owner === 'solo' ? 'correct' : (owner === 1 ? 'correct-p1' : 'correct-p2'));
                cellEl.disabled = true;
            }
            if (this.mode === 'duo') this.startDuoTurn(); // đúng -> giữ lượt, reset 10s
            else if (this.mode === 'destroy') this.startDestroyTimer(); // đúng -> reset 10s cho số kế tiếp
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
        if (this.pauseBtn) this.pauseBtn.style.display = 'none';
        const statusEl = document.getElementById('ts-status');

        if (this.mode === 'solo') {
            const finalTime = this.elapsed;
            statusEl?.classList.add('result-win');
            document.getElementById('ts-left').textContent = `${finalTime.toFixed(1)}s`;
            document.getElementById('ts-target').textContent = '✔️';
            document.getElementById('ts-sub').textContent = 'Hoàn thành!';
            document.getElementById('ts-timer').textContent = '0';

            this.saveRecordSolo(finalTime);

            const reward = calcSoloReward(finalTime, this.shuffleMode);
            addPoints('Tìm Số', `Tìm xong 1-100 trong ${finalTime.toFixed(1)}s`, reward)
                .then(actualAmount => {
                    this.lastReward = actualAmount;
                    this.updateStatus();
                    window.showToast(`🎉 Hoàn thành trong ${finalTime.toFixed(1)}s +${actualAmount} điểm`, 'success');
                    window.VTQuests?.trackPlay('timso');
                    window.VTQuests?.trackEarn(actualAmount);
                })
                .catch(() => window.showToast(`🎉 Hoàn thành trong ${finalTime.toFixed(1)}s`, 'success'));
        } else if (this.mode === 'destroy') {
            let foundCount = 0;
            this.found.forEach(v => { if (v === 'solo') foundCount++; });
            const finalTime = this.elapsed;

            statusEl?.classList.add(foundCount > 0 ? 'result-win' : 'result-lose');
            document.getElementById('ts-left').textContent = `${foundCount}`;
            document.getElementById('ts-target').textContent = `${finalTime.toFixed(1)}s`;
            document.getElementById('ts-sub').textContent = 'Kết thúc!';
            document.getElementById('ts-timer').textContent = '0';

            this.saveRecordDestroy(foundCount, finalTime);

            const reward = calcDestroyReward(foundCount, this.shuffleMode);
            addPoints('Tìm Số', `Chế độ Huỷ Diệt: tìm được ${foundCount}/100 số`, reward)
                .then(actualAmount => {
                    this.lastReward = actualAmount;
                    this.updateStatus();
                    window.showToast(`💥 Kết thúc! Tìm được ${foundCount}/100 số +${actualAmount} điểm`, 'success');
                    window.VTQuests?.trackPlay('timso');
                    window.VTQuests?.trackEarn(actualAmount);
                })
                .catch(() => window.showToast(`💥 Kết thúc! Tìm được ${foundCount}/100 số`, 'success'));
        } else {
            const s1 = this.scores[1], s2 = this.scores[2];
            const winner = s1 > s2 ? 1 : (s2 > s1 ? 2 : 0);
            statusEl?.classList.add(winner ? 'result-win' : 'result-draw');

            const leftEl = document.getElementById('ts-left');
            const timerEl = document.getElementById('ts-timer');
            leftEl.textContent = `P1: ${s1}`;
            timerEl.textContent = `P2: ${s2}`;

            if (winner === 1) {
                leftEl.className = 'stat-bet ts-win';
                timerEl.className = 'stat-profit ts-lose';
            } else if (winner === 2) {
                leftEl.className = 'stat-bet ts-lose';
                timerEl.className = 'stat-profit ts-win';
            } else {
                leftEl.className = 'stat-bet';
                timerEl.className = 'stat-profit zero';
            }

            document.getElementById('ts-target').textContent = winner ? `🏆 P${winner}` : '🤝';
            document.getElementById('ts-sub').textContent = winner ? `Người ${winner} thắng!` : 'Hoà!';
            window.showToast(winner ? `🎉 Người ${winner} thắng!` : '🤝 Hoà!', 'success');
            window.VTQuests?.trackPlay('timso');
        }
    }

    restart() {
        this.startGame();
    }

    // ---------- bxh: lưu lịch sử + cập nhật top-10 nếu đủ tốt ----------
    getDisplayName() {
        const user = auth.currentUser;
        if (!user) return 'Ẩn danh';
        return this.cachedNickname || (user.email ? user.email.split('@')[0] : 'Ẩn danh');
    }

    // Lịch sử: vẫn 1 write/ván như cũ, không đọc thêm gì (giữ nguyên hành vi cũ)
    async saveRecordSolo(finalTime) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, 'timso_records_solo'), {
                uid: user.uid,
                name: this.getDisplayName(),
                time: finalTime,
                shuffleMode: this.shuffleMode,
                createdAt: serverTimestamp()
            });
        } catch (e) {}
        this.maybeUpdateLeaderboardSolo(finalTime); // check + transaction chỉ khi đủ tốt
    }

    async saveRecordDestroy(foundCount, finalTime) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, 'timso_records_destroy'), {
                uid: user.uid,
                name: this.getDisplayName(),
                foundCount,
                time: finalTime,
                shuffleMode: this.shuffleMode,
                createdAt: serverTimestamp()
            });
        } catch (e) {}
        this.maybeUpdateLeaderboardDestroy(foundCount, finalTime);
    }

    // So sánh ngay trên cache client (this.lbLive, có sẵn từ listener) -> 0 read.
    // Chỉ khi thực sự đủ tốt để lọt top 10 mới chạy transaction (1 read + 1 write).
    async maybeUpdateLeaderboardSolo(finalTime) {
        const list = this.lbLive.solo;
        if (list.length >= 10 && finalTime >= list[list.length - 1].time) return; // không đủ tốt
        const user = auth.currentUser;
        if (!user) return;
        const ref = doc(db, 'timso_leaderboards', 'solo');
        try {
            await runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                const entries = snap.exists() ? (snap.data().entries || []) : [];
                entries.push({ uid: user.uid, name: this.getDisplayName(), time: finalTime, shuffleMode: this.shuffleMode });
                entries.sort((a, b) => a.time - b.time);
                tx.set(ref, { entries: entries.slice(0, 10) });
            });
        } catch (e) {}
    }

    async maybeUpdateLeaderboardDestroy(foundCount, finalTime) {
        const list = this.lbLive.destroy;
        if (list.length >= 10) {
            const worst = list[list.length - 1];
            const better = foundCount > worst.foundCount ||
                (foundCount === worst.foundCount && finalTime < worst.time);
            if (!better) return; // không đủ tốt
        }
        const user = auth.currentUser;
        if (!user) return;
        const ref = doc(db, 'timso_leaderboards', 'destroy');
        try {
            await runTransaction(db, async tx => {
                const snap = await tx.get(ref);
                const entries = snap.exists() ? (snap.data().entries || []) : [];
                entries.push({ uid: user.uid, name: this.getDisplayName(), foundCount, time: finalTime, shuffleMode: this.shuffleMode });
                entries.sort((a, b) => b.foundCount - a.foundCount || a.time - b.time);
                tx.set(ref, { entries: entries.slice(0, 10) });
            });
        } catch (e) {}
    }

    // ---------- bxh: hiển thị (đọc thẳng từ this.lbLive, không gọi Firestore) ----------
    openLeaderboard() {
        document.getElementById('ts-lb-modal').style.display = 'flex';
        this.switchLBTab(this.lbTab);
    }

    closeLeaderboard() {
        document.getElementById('ts-lb-modal').style.display = 'none';
    }

    switchLBTab(tab) {
        this.lbTab = tab;
        document.querySelectorAll('.ts-lb-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.renderLeaderboard(tab, this.lbLive[tab]);
    }

    // Không còn tốn read: listener realtime đã tự cập nhật this.lbLive,
    // nút refresh chỉ để vẽ lại UI cho chắc.
    refreshLeaderboard() {
        this.renderLeaderboard(this.lbTab, this.lbLive[this.lbTab]);
    }

    renderLeaderboard(tab, rows) {
        const listEl = document.getElementById('ts-lb-list');
        if (!rows.length) {
            listEl.innerHTML = '<div class="ts-lb-empty">Chưa có kỷ lục nào</div>';
            return;
        }
        listEl.innerHTML = rows.map((r, i) => {
            const rankNum = i + 1;
            const rowCls = rankNum <= 3 ? ` ts-lb-row-${rankNum}` : '';
            const rankCls = rankNum <= 3 ? ` ts-lb-rank-${rankNum}` : '';
            const shuffleTag = r.shuffleMode === 'shuffle' ? '<span class="ts-lb-tag">Đảo số</span>' : '';
            const valueText = tab === 'solo'
                ? `${r.time.toFixed(1)}s`
                : `${r.foundCount} · ${r.time.toFixed(1)}s`;
            const nameEl = document.createElement('div');
            nameEl.textContent = r.name || 'Ẩn danh';
            return `<div class="ts-lb-row${rowCls}"><span class="ts-lb-rank${rankCls}">#${rankNum}</span><span class="ts-lb-name">${nameEl.innerHTML}${shuffleTag}</span><span class="ts-lb-value">${valueText}</span></div>`;
        }).join('');
    }
}

new TimSo();
