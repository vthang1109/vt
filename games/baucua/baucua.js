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
        this.setupSplash();
        this.updateStatusBar('betting', 0);
        this.updateRollButton('roll');
        window.bcGame = this;
    }

    setupSplash() {
        const splashScreen = document.getElementById('bc-splash');
        const gameContainer = document.getElementById('bc-game');
        const startBtn = document.getElementById('bc-btn-start');

        if (!startBtn || !splashScreen || !gameContainer) return;

        startBtn.addEventListener('click', () => {
            splashScreen.classList.remove('active');
            splashScreen.style.display = 'none';
            gameContainer.classList.add('active');
        });
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
            t.classList.remove('has-bet', 'win-flash', 'lose-flash');
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
        
        // Xóa hiệu ứng hot + flash
        document.querySelectorAll('.bc-tile').forEach(t => {
            t.classList.remove('hot', 'win-flash', 'lose-flash');
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
        // Game Hack force (chọn mặt từ admin)
        if (this._adminForcedResults && this._adminForcedResults.length === 3) {
          const forced = this._adminForcedResults;
          this._adminForcedResults = null;
          // Chạy luồng kết quả forced
          this._lastResults = forced;
          const btnRoll2 = document.getElementById('btn-roll');
          const diceEls2 = [0, 1, 2].map(i => document.getElementById('dice-' + i));
          forced.forEach((res, i) => {
            if (diceEls2[i]) { diceEls2[i].textContent = res.emoji; diceEls2[i].classList.remove('rolling'); }
          });
          await new Promise(r => setTimeout(r, 600));
          const resCounts = {};
          forced.forEach(r => resCounts[r.id] = (resCounts[r.id] || 0) + 1);
          let winAmt = 0;
          const totalBet2 = Object.values(this.bets).reduce((a, b) => a + b, 0);
          for (let id in this.bets) { if (this.bets[id] > 0 && resCounts[id]) winAmt += this.bets[id] * (1 + resCounts[id]); }
          document.querySelectorAll('.bc-tile').forEach(t => {
            const id = t.dataset.id;
            if (resCounts[id] > 0) { t.classList.add('hot'); const m = t.querySelector('[data-mult]'); if (m) { m.textContent = 'x' + (resCounts[id] + 1); m.style.display = 'block'; } }
            if (this.bets[id] > 0) t.classList.add(resCounts[id] > 0 ? 'win-flash' : 'lose-flash');
          });
          let buffBonus = 0, buffPct = 0;
          if (winAmt > 0) { const rp = winAmt - totalBet2; if (rp > 0) { buffPct = this.cachedBuffPct; if (buffPct > 0) buffBonus = Math.round(rp * buffPct / 100); } }
          const net = winAmt - totalBet2 + buffBonus;
          let committed = false;
          if (net !== 0 && this._userId) {
            const nb = await this.commitBalance(net, winAmt > 0 ? 'Thắng' : 'Thua');
            if (nb === null) { this.isRolling = false; if (btnRoll2) btnRoll2.disabled = false; return; }
            committed = true;
          }
          if (!committed) { this._myBalance += (winAmt + buffBonus); this.syncNavPoints(); }
          if (buffBonus > 0) { const pl = this.cachedPet ? this.cachedPet.emoji + ' ' + this.cachedPet.name : '🐾 Pet'; window.showToast?.(pl + ' +' + buffBonus.toLocaleString('vi-VN') + ' (' + buffPct + '%)!', 'success'); }
          const profit = winAmt - totalBet2 + buffBonus;
          this.lastProfit = profit;
          if (window.VTQuests) { window.VTQuests.trackPlay('baucua'); if (profit > 0) { window.VTQuests.trackEarn(profit); window.VTQuests.trackGameWin('baucua'); } }
          this.updateStatusBar('result', profit);
          this.updateAllBetsUI();
          diceEls2.forEach((el, i) => { if (resCounts[forced[i].id] > 0) el.classList.add('win'); });
          this.isRolling = false;
          this._isResultShowing = true;
          if (btnRoll2) btnRoll2.disabled = false;
          this.updateRollButton('newgame');
          return;
        }

        // Admin force: pick results based on __ADMIN_FORCED_RESULT
        let results;
        if (window.__ADMIN_FORCED_RESULT === 'win') {
          // Tìm item có cược cao nhất → cho ra cả 3 mặt
          const maxBet = Math.max(...Object.values(this.bets));
          const topItems = this.items.filter(i => this.bets[i.id] === maxBet && maxBet > 0);
          if (topItems.length) {
            const pick = topItems[Math.floor(Math.random() * topItems.length)];
            results = [pick, pick, pick];
          } else {
            results = Array.from({ length: 3 }, () => this.items[Math.floor(Math.random() * 6)]);
          }
        } else if (window.__ADMIN_FORCED_RESULT === 'lose') {
          // Tìm item không có cược → cho ra 3 mặt đó
          const noBetItems = this.items.filter(i => !this.bets[i.id] || this.bets[i.id] === 0);
          if (noBetItems.length) {
            results = Array.from({ length: 3 }, () => noBetItems[Math.floor(Math.random() * noBetItems.length)]);
          } else {
            // Tất cả đều có cược: pick item ít cược nhất
            const minBet = Math.min(...Object.values(this.bets).filter(v => v > 0));
            const minItems = this.items.filter(i => this.bets[i.id] === minBet);
            results = Array.from({ length: 3 }, () => minItems[Math.floor(Math.random() * minItems.length)]);
          }
        } else {
          results = Array.from({ length: 3 }, () => this.items[Math.floor(Math.random() * 6)]);
        }
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
            if (this.bets[id] > 0) {
                t.classList.add(resCounts[id] > 0 ? 'win-flash' : 'lose-flash');
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

        let committed = false;
        if (net !== 0 && this._userId) {
            const newBalance = await this.commitBalance(net, winAmt > 0 ? 'Thắng' : 'Thua');
            if (newBalance === null) {
                console.error('Không thể cập nhật balance');
                this.isRolling = false;
                if (btnRoll) btnRoll.disabled = false;
                return;
            }
            committed = true;
        }
        // Chỉ cộng tay khi chưa commit qua Firestore (net=0 hoặc chưa đăng nhập)
        if (!committed) {
            this._myBalance += (winAmt + buffBonus);
            this.syncNavPoints();
        }

        if (buffBonus > 0) {
            const petLabel = this.cachedPet ? `${this.cachedPet.emoji} ${this.cachedPet.name}` : '🐾 Pet';
            window.showToast?.(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}〄 (${buffPct}%)!`, 'success');
        }

        const profit = winAmt - totalBet + buffBonus;
        this.lastProfit = profit;

        if (window.VTQuests) {
            window.VTQuests.trackPlay('baucua');
            if (profit > 0) {
                window.VTQuests.trackEarn(profit);
                window.VTQuests.trackGameWin('baucua');
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

    // Nếu người chơi thoát/đóng tab khi đã đặt cược nhưng chưa lắc xong, tính thua toàn bộ cược
    // (vì cược mới chỉ trừ ở local, chưa từng ghi Firestore).
    forfeitIfAbandoned() {
        if (this._forfeited) return;
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total > 0) {
            this._forfeited = true;
            addPoints('Casino', 'Bầu Cua out phòng - mất cược', -total, false).catch(() => {});
        }
    }
}

// Khởi chạy
new BauCua();

// ── ADMIN HACK: CHỌN KẾT QUẢ ────────────────────────────
if (window.__ADMIN_GAME_HACKS) {
  window.__ADMIN_GAME_HACKS.push({
    id: 'baucua_choose_result',
    label: 'Chọn mặt',
    icon: '🎲',
    render: (container, closeModal) => {
      container.innerHTML = `
        <p style="color:#94a3b8;font-size:12px;margin-bottom:10px;">Chọn 3 mặt xúc xắc</p>
        <div id="bcHackStatus" style="color:#34d399;font-size:12px;font-weight:700;margin-bottom:8px;min-height:18px;"></div>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
          <div style="flex:1;text-align:center;">
            <div style="font-size:10px;color:#64748b;margin-bottom:4px;">Xúc xắc 1</div>
            <div id="bcHackDice0" style="
              width:64px;height:64px;margin:0 auto;
              background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.15);
              border-radius:12px;display:flex;align-items:center;justify-content:center;
              font-size:32px;cursor:pointer;transition:border-color 0.2s;
            ">🎃</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="font-size:10px;color:#64748b;margin-bottom:4px;">Xúc xắc 2</div>
            <div id="bcHackDice1" style="
              width:64px;height:64px;margin:0 auto;
              background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.15);
              border-radius:12px;display:flex;align-items:center;justify-content:center;
              font-size:32px;cursor:pointer;transition:border-color 0.2s;
            ">🦀</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="font-size:10px;color:#64748b;margin-bottom:4px;">Xúc xắc 3</div>
            <div id="bcHackDice2" style="
              width:64px;height:64px;margin:0 auto;
              background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.15);
              border-radius:12px;display:flex;align-items:center;justify-content:center;
              font-size:32px;cursor:pointer;transition:border-color 0.2s;
            ">🦞</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px;">
          ${['🎃','🦀','🦞','🐟','🐔','🦌'].map((emoji, i) => `
            <button class="bcHackFace" data-face="${['bau','cua','tom','ca','ga','nai'][i]}" data-emoji="${emoji}" style="
              padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);
              background:rgba(255,255,255,0.03);color:#e0f2fe;font-size:24px;
              cursor:pointer;transition:all 0.15s;
            " onmouseover="this.style.borderColor='rgba(52,211,153,0.4)';this.style.background='rgba(52,211,153,0.1)'"
               onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.03)'">${emoji}</button>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <button id="bcHackApply" class="green" style="flex:1">🎯 Áp dụng</button>
          <button id="bcHackSame" class="yellow" style="flex:1">🔂 3 mặt giống</button>
          <button id="bcHackClose" style="background:rgba(148,163,184,0.1);color:#94a3b8;border-color:rgba(148,163,184,0.2);">✕</button>
        </div>
      `;

      const items = ['bau','cua','tom','ca','ga','nai'];
      const emojis = ['🎃','🦀','🦞','🐟','🐔','🦌'];
      let diceVals = ['bau', 'cua', 'tom'];
      let currentDice = 0;

      function updateDiceUI() {
        for (let i = 0; i < 3; i++) {
          const el = document.getElementById('bcHackDice' + i);
          if (el) {
            const idx = items.indexOf(diceVals[i]);
            el.textContent = emojis[idx] || '?';
            el.style.borderColor = i === currentDice ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.15)';
          }
        }
      }

      document.querySelectorAll('.bcHackFace').forEach(btn => {
        btn.addEventListener('click', () => {
          diceVals[currentDice] = btn.dataset.face;
          updateDiceUI();
          currentDice = (currentDice + 1) % 3;
        });
      });

      [0,1,2].forEach(i => {
        const el = document.getElementById('bcHackDice' + i);
        if (el) el.addEventListener('click', () => { currentDice = i; updateDiceUI(); });
      });

      document.getElementById('bcHackApply')?.addEventListener('click', () => {
        const g = window.bcGame;
        if (!g) { document.getElementById('bcHackStatus').textContent = '❌ Game chưa sẵn sàng'; return; }
        // Map face IDs to item objects
        const resultItems = diceVals.map(id => g.items.find(i => i.id === id)).filter(Boolean);
        if (resultItems.length !== 3) { document.getElementById('bcHackStatus').textContent = '⚠️ Chưa chọn đủ 3 mặt'; return; }
        
        // Force results by overriding finishRoll
        g._adminForcedResults = resultItems;
        document.getElementById('bcHackStatus').textContent = `✅ Kết quả: ${resultItems.map(r => r.emoji).join(' ')}`;
      });

      document.getElementById('bcHackSame')?.addEventListener('click', () => {
        const face = diceVals[currentDice];
        diceVals = [face, face, face];
        updateDiceUI();
      });

      document.getElementById('bcHackClose')?.addEventListener('click', closeModal);
      updateDiceUI();
    }
  });

}
window.addEventListener('pagehide', () => { if (!window.__navigated) { window.bcGame?.forfeitIfAbandoned(); window.bcGame?._unsubBalance?.(); } });
window.addEventListener('beforeunload', () => { if (!window.__navigated) window.bcGame?.forfeitIfAbandoned(); });

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.bcGame?.forfeitIfAbandoned();document.getElementById('bc-splash').classList.add('active');document.getElementById('bc-splash').style.display='';document.getElementById('bc-game').classList.remove('active')})}},100);