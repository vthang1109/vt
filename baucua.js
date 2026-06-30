import { addPoints, getPoints, db, auth } from './points.js';
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
            this._unsubBalance = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                if (snap.exists()) {
                    this._myBalance = snap.data().points || 0;
                    this.syncNavPoints();
                }
            });
        }

        const pts = await getPoints();
        this._myBalance = pts || 0;
        
        this.buildBoard();
        this.bindEvents();
        this.updateStatusBar('betting', 0);
        this.syncNavPoints();
        this.updateRollButton('roll');
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
        
        statusEl.classList.remove('rolling', 'result-win', 'result-lose', 'result-draw');
        statusEl.style.background = '';
        statusEl.style.borderColor = '';
        
        const totalBet = this.getTotalBet();
        
        roundEl.textContent = totalBet > 0 ? totalBet.toLocaleString('vi-VN') : '0';
        roundEl.style.color = '#fbbf24';
        roundEl.style.fontFamily = "'Orbitron', monospace";
        roundEl.style.fontWeight = '900';
        roundEl.style.fontSize = '18px';
        
        if (phase === 'rolling') {
            statusEl.classList.add('rolling');
        } else if (phase === 'result') {
            if (profit > 0) statusEl.classList.add('result-win');
            else if (profit < 0) statusEl.classList.add('result-lose');
            else statusEl.classList.add('result-draw');
        }
        
        if (profit > 0) {
            profitEl.textContent = `+${profit.toLocaleString('vi-VN')}`;
            profitEl.className = 'bc-profit positive';
        } else if (profit < 0) {
            profitEl.textContent = `${profit.toLocaleString('vi-VN')}`;
            profitEl.className = 'bc-profit negative';
        } else {
            profitEl.textContent = '+0';
            profitEl.className = 'bc-profit zero';
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

    // ========== CẬP NHẬT BALANCE GỘP ==========
    async updateBalance(amount, reason) {
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

    // ========== ĐẶT CƯỢC ==========
    async placeBet(id) {
        if (this.isRolling || this._isResultShowing) {
            console.log('Không thể đặt cược lúc này');
            return;
        }
        if (this._isProcessingBet) {
            console.log('Đang xử lý cược');
            return;
        }
        if (this.currentChip > this._myBalance) {
            console.log('Không đủ tiền:', this.currentChip, '>', this._myBalance);
            return;
        }

        this._isProcessingBet = true;

        try {
            const newBalance = await this.updateBalance(-this.currentChip, `Đặt ${id}`);
            
            if (newBalance === null) {
                this._isProcessingBet = false;
                return;
            }
            
            this.bets[id] += this.currentChip;
            this.updateTileUI(id, this.bets[id]);
            this.updateStatusBar('betting', this.lastProfit);
            
        } catch (e) {
            console.error('Lỗi đặt cược:', e);
        }

        this._isProcessingBet = false;
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

    // Reset tất cả cược về 0 (chỉ local, không ghi Firestore vì tiền đã được xử lý)
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

    resetBoard = async function() {
        if (this.isRolling || this._isResultShowing) return;
        
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total === 0) return;

        try {
            const newBalance = await this.updateBalance(total, 'Huỷ cược');
            
            if (newBalance === null) return;
            
            this.resetAllBets();

            this.lastProfit = 0;
            this.updateStatusBar('betting', 0);
        } catch (e) {
            console.error(e);
        }
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

        let profit = 0;

        if (winAmt > 0) {
            const newBalance = await this.updateBalance(winAmt, 'Thắng');
            if (newBalance === null) {
                console.error('Không thể cập nhật balance');
                this.isRolling = false;
                if (btnRoll) btnRoll.disabled = false;
                return;
            }
            profit = winAmt - totalBet;
            this.lastProfit = profit;
            
            if (window.VTQuests) {
                window.VTQuests.trackPlay('baucua');
                if (profit > 0) window.VTQuests.trackEarn(profit);
            }
        } else {
            profit = -totalBet;
            this.lastProfit = profit;
            if (window.VTQuests) {
                window.VTQuests.trackPlay('baucua');
            }
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
}

// Khởi chạy
new BauCua();