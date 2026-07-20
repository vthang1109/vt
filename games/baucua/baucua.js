import { addPoints, db, auth, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class BauCua {
    constructor() {
        this.items = [
            { id: 'bau', emoji: '🎃' },
            { id: 'cua', emoji: '🦀' },
            { id: 'tom', emoji: '🦞' },
            { id: 'ca',  emoji: '🐟' },
            { id: 'ga',  emoji: '🐔' },
            { id: 'nai', emoji: '🦌' }
        ];

        this.currentChip = 500;
        this.bets = {};
        this.isRolling = false;
        this.lastProfit = 0;
        this._isProcessingBet = false;
        this._myBalance = 0;
        this._unsubBalance = null;
        this._userId = null;
        this._isResultShowing = false;
        this._lastResults = null;
        this.cachedBuffPct = 0;

        this.items.forEach(item => {
            this.bets[item.id] = 0;
        });

        this.init();
    }

    async init() {
        const user = await new Promise(resolve => {
            const unsub = onAuthStateChanged(auth, (u) => {
                unsub();
                resolve(u);
            });
        });

        if (user) {
            this._userId = user.uid;
        }

        await this.listenBalance();
        this.refreshBuffCache();

        this.buildBoard();
        this.bindEvents();
        this.updateStatusBar('betting', 0);
        this.updateRollButton('roll');
        window.bcGame = this;
    }

    // Sync realtime từ points.js, chỉ ghi đè _myBalance khi không có cược đang treo.
    listenBalance() {
        return new Promise(resolve => {
            let first = true;
            this._unsubBalance = subscribeBalance(pts => {
                if (this.getTotalBet() === 0) {
                    this._myBalance = pts || 0;
                    this.syncNavPoints();
                }
                if (first) { first = false; resolve(); }
            });
        });
    }

    async refreshBuffCache() {
        try {
            const info = await getActivePetInfo();
            this.cachedBuffPct = info.buff;
            this.cachedPet = info.pet;
        } catch { this.cachedBuffPct = 0; this.cachedPet = null; }
    }

    syncNavPoints() {
        if (window.TopNav) {
            window.TopNav.setPoints(this._myBalance);
        }
    }

    updateRollButton(mode) {
        const btnRoll = document.getElementById('btn-roll');
        if (!btnRoll) return;
        
        if (mode === 'roll') {
            btnRoll.textContent = '🎲 Lắc';
            btnRoll.className = 'btn-action btn-roll';
            btnRoll.disabled = this.isRolling;
        } else if (mode === 'newgame') {
            btnRoll.textContent = '🔄 Ván mới';
            btnRoll.className = 'btn-action btn-newgame';
            btnRoll.disabled = false;
        }
    }

    buildBoard() {
        const board = document.getElementById('bc-board');
        if (!board) return;
        board.innerHTML = '';
        
        this.items.forEach(item => {
            const tile = document.createElement('div');
            tile.className = 'bc-tile';
            tile.dataset.id = item.id;
            tile.innerHTML = `
                <span class="bc-tile-icon">${item.emoji}</span>
                <span class="bc-tile-bet" data-bet="${item.id}">0</span>
                <span class="bc-tile-mult" data-mult="${item.id}" style="display:none"></span>
            `;
            tile.addEventListener('click', () => this.placeBet(item.id));
            board.appendChild(tile);
        });
    }

    updateAllBetsUI() {
        this.items.forEach(item => {
            this.updateTileUI(item.id, this.bets[item.id]);
        });
    }

    getTotalBet() {
        return Object.values(this.bets).reduce((a, b) => a + b, 0);
    }

    updateStatusBar(phase, profit) {
        const statusEl = document.getElementById('bc-status');
        if (!statusEl) return;
        
        const roundEl = document.getElementById('bc-round');
        const profitEl = document.getElementById('bc-profit');
        const msgEl = document.getElementById('bc-status-msg');
        
        statusEl.classList.remove('rolling', 'result-win', 'result-lose', 'result-draw');
        statusEl.style.background = '';
        statusEl.style.borderColor = '';
        
        const totalBet = this.getTotalBet();
        
        roundEl.textContent = totalBet > 0 ? totalBet.toLocaleString('vi-VN') : '0';

        if (msgEl) {
            msgEl.textContent = phase === 'rolling' ? 'Đang lắc...' : (phase === 'result' ? 'Kết quả' : '');
        }
        
        if (phase === 'rolling') {
            statusEl.classList.add('rolling');
        } else if (phase === 'result') {
            if (profit > 0) statusEl.classList.add('result-win');
            else if (profit < 0) statusEl.classList.add('result-lose');
            else statusEl.classList.add('result-draw');
        }
        
        if (profit > 0) {
            profitEl.textContent = `+${profit.toLocaleString('vi-VN')}`;
            profitEl.className = 'stat-profit positive';
        } else if (profit < 0) {
            profitEl.textContent = `${profit.toLocaleString('vi-VN')}`;
            profitEl.className = 'stat-profit negative';
        } else {
            profitEl.textContent = '+0';
            profitEl.className = 'stat-profit zero';
        }
    }

    bindEvents() {
        document.querySelectorAll('.bc-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.bc-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentChip = parseInt(chip.dataset.v);
            });
        });

        const btnRoll = document.getElementById('btn-roll');
        if (btnRoll) {
            btnRoll.addEventListener('click', () => {
                if (this._isResultShowing) {
                    this.startNewGame();
                } else {
                    this.roll();
                }
            });
        }

        const btnClear = document.getElementById('btn-clear');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.resetBoard());
        }
    }

    // Ghi Firestore 1 lượt (transaction) — chỉ dùng khi kết thúc ván (finishRoll) hoặc
    // khi thoát ngang (forfeitIfAbandoned). Không còn gọi ở placeBet/resetBoard.
    async commitBalance(amount, reason) {
        if (!this._userId) return this._myBalance;
        
        try {
            const newBalance = await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', this._userId);
                const userDoc = await transaction.get(userRef);
                
                if (!userDoc.exists()) {
                    throw new Error('User không tồn tại');
                }
                
                const currentPoints = userDoc.data().points || 0;
                const updated = currentPoints + amount;
                
                if (updated < 0) {
                    throw new Error('Số dư không đủ');
                }
                
                transaction.update(userRef, { points: updated });
                return updated;
            });
            
            this._myBalance = newBalance;
            this.syncNavPoints();
            return newBalance;
            
        } catch (e) {
            console.error('Lỗi cập nhật balance:', e);
            return null;
        }
    }

    // Không ghi Firestore ở đây nữa — chỉ trừ điểm local để hiện UI, tiền cược sẽ được
    // gộp thành 1 lượt ghi net duy nhất trong finishRoll().
    placeBet(id) {
        if (this.isRolling || this._isResultShowing) {
            console.log('Không thể đặt cược lúc này');
            return;
        }
        if (this.currentChip > this._myBalance) {
            console.log('Không đủ tiền:', this.currentChip, '>', this._myBalance);
            return;
        }

        this._myBalance -= this.currentChip;
        this.bets[id] += this.currentChip;
        this.updateTileUI(id, this.bets[id]);
        this.updateStatusBar('betting', this.lastProfit);
        this.syncNavPoints();
    }

    updateTileUI(id, amount) {
        const tiles = document.querySelectorAll('.bc-tile');
        tiles.forEach(t => {
            if (t.dataset.id === id) {
                const betEl = t.querySelector('[data-bet]');
                betEl.textContent = amount > 0 ? amount.toLocaleString('vi-VN') : '0';
                
                if (amount > 0) {
                    t.classList.add('has-bet');
                } else {
                    t.classList.remove('has-bet');
                }
            }
        });
    }

    // Reset tất cả cược về 0 (chỉ local, không ghi Firestore vì tiền chưa từng bị trừ ở DB)
    resetAllBets() {
        this.items.forEach(item => {
            this.bets[item.id] = 0;
        });

        document.querySelectorAll('.bc-tile').forEach(t => {
            t.classList.remove('has-bet');
            const betEl = t.querySelector('[data-bet]');
            betEl.textContent = '0';
        });
    }

    // Huỷ cược chỉ hoàn lại local, không cần ghi Firestore.
    resetBoard() {
        if (this.isRolling || this._isResultShowing) return;
        
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total === 0) return;

        this._myBalance += total;
        this.resetAllBets();
        this.lastProfit = 0;
        this.updateStatusBar('betting', 0);
        this.syncNavPoints();
    }

    resetDice() {
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));
        diceEls.forEach(el => {
            if (el) {
                el.textContent = '?';
                el.classList.remove('win', 'rolling');
            }
        });
    }

    // ========== BẮT ĐẦU VÁN MỚI ==========
    startNewGame() {
        this._isResultShowing = false;
        this._lastResults = null;
        
        // Reset dice
        this.resetDice();
        
        // Xóa hiệu ứng hot
        document.querySelectorAll('.bc-tile').forEach(t => {
            t.classList.remove('hot');
            const multEl = t.querySelector('[data-mult]');
            if (multEl) multEl.style.display = 'none';
        });
        
        // Reset profit
        this.lastProfit = 0;
        
        // RESET TẤT CẢ CƯỢC VỀ 0
        this.resetAllBets();
        this.updateStatusBar('betting', 0);
        
        // Cập nhật nút về Lắc
        this.updateRollButton('roll');
    }

    roll = async function() {
        if (this.isRolling || this._isResultShowing) return;

        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (totalBet === 0) return;

        this.isRolling = true;
        this.updateRollButton('roll');
        this.updateStatusBar('rolling', this.lastProfit);

        const btnRoll = document.getElementById('btn-roll');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));

        diceEls.forEach(el => el.classList.remove('win'));
        if (btnRoll) btnRoll.disabled = true;

        let count = 0;
        const maxCount = 15;
        const spinInterval = setInterval(() => {
            diceEls.forEach(el => {
                el.textContent = this.items[Math.floor(Math.random() * 6)].emoji;
                el.classList.add('rolling');
            });
            count++;
            if (count >= maxCount) {
                clearInterval(spinInterval);
                this.finishRoll();
            }
        }, 80);
    }

    // Ghi Firestore NGAY 1 LẦN DUY NHẤT cho cả ván: net = (tiền thắng + buff) - tổng cược.
    finishRoll = async function() {
        const results = Array.from({ length: 3 }, () => this.items[Math.floor(Math.random() * 6)]);
        this._lastResults = results;

        const btnRoll = document.getElementById('btn-roll');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));

        results.forEach((res, i) => {
            diceEls[i].textContent = res.emoji;
            diceEls[i].classList.remove('rolling');
        });

        await new Promise(r => setTimeout(r, 600));

        const resCounts = {};
        results.forEach(r => resCounts[r.id] = (resCounts[r.id] || 0) + 1);

        let winAmt = 0;
        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);

        for (let id in this.bets) {
            if (this.bets[id] > 0 && resCounts[id]) {
                winAmt += this.bets[id] * (1 + resCounts[id]);
            }
        }

        document.querySelectorAll('.bc-tile').forEach(t => {
            const id = t.dataset.id;
            if (resCounts[id] > 0) {
                t.classList.add('hot');
                const multEl = t.querySelector('[data-mult]');
                if (multEl) {
                    multEl.textContent = 'x' + (resCounts[id] + 1);
                    multEl.style.display = 'block';
                }
            }
        });

        let buffBonus = 0, buffPct = 0;
        if (winAmt > 0) {
            const roundProfit = winAmt - totalBet;
            if (roundProfit > 0) {
                buffPct = this.cachedBuffPct;
                if (buffPct > 0) buffBonus = Math.round(roundProfit * buffPct / 100);
            }
        }
        const net = winAmt - totalBet + buffBonus;

        if (net !== 0) {
            const newBalance = await this.commitBalance(net, winAmt > 0 ? 'Thắng' : 'Thua');
            if (newBalance === null) {
                console.error('Không thể cập nhật balance');
                this.isRolling = false;
                if (btnRoll) btnRoll.disabled = false;
                return;
            }
        }
        // Local đã trừ totalBet lúc đặt cược rồi, giờ chỉ cộng lại phần thắng + buff.
        this._myBalance += (winAmt + buffBonus);
        this.syncNavPoints();

        if (buffBonus > 0) {
            const petLabel = this.cachedPet ? `${this.cachedPet.emoji} ${this.cachedPet.name}` : '🐾 Pet';
            window.showToast?.(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}〄 (${buffPct}%)!`, 'success');
        }

        const profit = winAmt - totalBet + buffBonus;
        this.lastProfit = profit;

        if (window.VTQuests) {
            window.VTQuests.trackPlay('baucua');
            if (profit > 0) window.VTQuests.trackEarn(profit);
        }

        this.updateStatusBar('result', profit);

        // GIỮ NGUYÊN SỐ TIỀN CƯỢC TRÊN MỖI CON - KHÔNG RESET
        // Cập nhật lại UI để hiển thị đúng
        this.updateAllBetsUI();

        diceEls.forEach((el, i) => {
            if (resCounts[results[i].id] > 0) el.classList.add('win');
        });

        this.isRolling = false;
        this._isResultShowing = true;
        if (btnRoll) btnRoll.disabled = false;

        // Đổi nút thành "Ván mới"
        this.updateRollButton('newgame');
    }

    // Nếu người chơi thoát/đóng tab khi đã đặt cược nhưng chưa lắc xong, tính thua toàn bộ cược
    // (vì cược mới chỉ trừ ở local, chưa từng ghi Firestore).
    forfeitIfAbandoned() {
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total > 0) {
            addPoints('Casino', 'Bầu Cua out phòng - mất cược', -total, false).catch(() => {});
        }
    }
}

// Khởi chạy
new BauCua();
window.addEventListener('pagehide', () => { window.bcGame?.forfeitIfAbandoned(); window.bcGame?._unsubBalance?.(); });
window.addEventListener('beforeunload', () => window.bcGame?.forfeitIfAbandoned());

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.location.href="../../games.html"})}},100);
