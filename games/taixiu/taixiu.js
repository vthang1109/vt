import { addPoints, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

class TaiXiu {
    constructor() {
        this.bets = { tai: 0, xiu: 0 };
        this.currentChip = 1000;
        this.isRolling = false;
        this.cachedBuffPct = 0;
        this.balance = 0;
        this.ready = false;
        this.unsubBalance = null;
        this.init();
    }

    async init() {
        await new Promise(resolve => {
            const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
        });
        await this.listenBalance();
        await this.refreshBuffCache();
        this.ready = true;
        this.setupSplash();
        this.bindEvents();
        this.updateStatusBar(null, null, null);
        window.txGame = this;
    }

    setupSplash() {
        const playBtn = document.getElementById('tx-play-btn');
        const menu = document.getElementById('tx-menu');
        const gameScreen = document.getElementById('tx-game-screen');
        if (!playBtn || !menu || !gameScreen) return;
        
        // Handle preset chip selection
        document.querySelectorAll('#tx-menu .preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#tx-menu .preset-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });

        playBtn.addEventListener('click', () => {
            // Sync selected chip value to game
            const activeChip = document.querySelector('#tx-menu .preset-chip.active');
            if (activeChip) {
                const amt = parseInt(activeChip.dataset.amt);
                document.querySelectorAll('.chip[data-amt]').forEach(c => {
                    c.classList.remove('active');
                    if (parseInt(c.dataset.amt) === amt) c.classList.add('active');
                });
                if (window.txGame) window.txGame.currentChip = amt;
            }
            menu.classList.remove('active');
            menu.style.display = 'none';
            gameScreen.classList.add('active');
            gameScreen.style.display = '';
        });
    }

    async refreshBuffCache() {
        try {
            const info = await getActivePetInfo();
            this.cachedBuffPct = info.buff;
            this.cachedPet = info.pet;
        } catch { this.cachedBuffPct = 0; this.cachedPet = null; }
    }

    // Sync realtime từ points.js, nhưng chỉ ghi đè this.balance khi KHÔNG có cược đang treo
    // (tránh đè optimistic update lúc đặt cược trước khi finishRoll ghi Firestore).
    listenBalance() {
        return new Promise(resolve => {
            let first = true;
            this.unsubBalance = subscribeBalance(pts => {
                const totalBet = Object.values(this.bets).reduce((a,b)=>a+b,0);
                if (totalBet === 0) {
                    this.balance = pts || 0;
                    if (window.TopNav) window.TopNav.setPoints(this.balance);
                }
                if (first) { first = false; resolve(); }
            });
        });
    }

    // Cập nhật status bar: [tổng cược] [Tài/Xỉu + điểm + chi tiết cược] [lời/lỗ]
    updateStatusBar(score, net, result) {
        const totalBet = Object.values(this.bets).reduce((a,b)=>a+b,0);
        const betEl = document.getElementById('tx-bet');
        const scoreEl = document.getElementById('total-score');
        const subEl = document.getElementById('tx-side-detail');
        const profitEl = document.getElementById('tx-profit');
        const statusEl = document.getElementById('bc-status');

        if (betEl) betEl.textContent = totalBet > 0 ? totalBet.toLocaleString('vi-VN') : '0';

        if (scoreEl) {
            if (score !== null && result) {
                const label = result === 'tai' ? 'Tài' : 'Xỉu';
                scoreEl.textContent = `${label} ${score}`;
            } else {
                scoreEl.textContent = score !== null ? score : '--';
            }
        }

        if (subEl) {
            if (this.bets.tai > 0 || this.bets.xiu > 0) {
                subEl.textContent = `Tài ${this.bets.tai.toLocaleString('vi-VN')} · Xỉu ${this.bets.xiu.toLocaleString('vi-VN')}`;
            } else {
                subEl.textContent = '';
            }
        }

        if (profitEl) {
            if (net === null) {
                profitEl.textContent = '+0';
                profitEl.className = 'stat-profit zero';
            } else if (net > 0) {
                profitEl.textContent = `+${net.toLocaleString('vi-VN')}`;
                profitEl.className = 'stat-profit positive';
            } else if (net < 0) {
                profitEl.textContent = net.toLocaleString('vi-VN');
                profitEl.className = 'stat-profit negative';
            } else {
                profitEl.textContent = 'Huề';
                profitEl.className = 'stat-profit zero';
            }
        }

        // Thanh status sáng theo kết quả: thắng=xanh, thua=đỏ, hoà=trắng
        if (statusEl) {
            statusEl.classList.remove('result-win', 'result-lose', 'result-draw');
            if (net !== null) {
                if (net > 0) statusEl.classList.add('result-win');
                else if (net < 0) statusEl.classList.add('result-lose');
                else statusEl.classList.add('result-draw');
            }
        }
    }

    bindEvents() {
        document.querySelectorAll('.bet-card').forEach(card => {
            card.addEventListener('click', () => this.placeBet(card.dataset.id));
        });
        document.querySelectorAll('.chip[data-amt]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentChip = parseInt(chip.dataset.amt);
            });
        });
        document.getElementById('bowl').addEventListener('click', () => this.roll());
        document.getElementById('btn-clear').addEventListener('click', () => this.resetBoard());
    }

    // Không ghi Firestore ở đây nữa — chỉ trừ điểm local để hiện UI, tiền cược sẽ được
    // gộp thành 1 lượt ghi net duy nhất trong finishRoll().
    placeBet(choice) {
        if (this.isRolling) return;
        if (!this.ready) {
            if (window.showToast) window.showToast('⏳ Đang tải điểm, vui lòng thử lại sau 1 giây!', 'info');
            return;
        }
        if (this.balance < this.currentChip) {
            if (window.showToast) window.showToast('⚠️ Không đủ điểm để đặt cược!', 'warn');
            return;
        }
        this.balance -= this.currentChip;
        this.bets[choice] += this.currentChip;
        this.renderBets();
        this.updateStatusBar(null, null, null);
        if (window.TopNav) window.TopNav.setPoints(this.balance);
    }

    renderBets() {
        for (let c in this.bets) {
            const el = document.getElementById(`bet-${c}`);
            if (el) el.textContent = this.bets[c].toLocaleString('vi-VN');
            const card = document.querySelector(`.bet-card[data-id="${c}"]`);
            if (card) card.classList.toggle('has-bet', this.bets[c] > 0);
        }
    }

    // Huỷ cược chỉ hoàn lại local, không cần ghi Firestore vì chưa từng trừ ở DB.
    resetBoard() {
        if (this.isRolling) return;
        const total = Object.values(this.bets).reduce((a,b) => a+b, 0);
        if (total > 0) {
            this.balance += total;
            this.bets = { tai: 0, xiu: 0 };
            this.renderBets();
            this.updateStatusBar(null, null, null);
            if (window.TopNav) window.TopNav.setPoints(this.balance);
        }
    }

    async roll() {
        if (this.isRolling) return;
        if (Object.values(this.bets).reduce((a,b)=>a+b, 0) === 0) {
            if (window.showToast) window.showToast('⚠️ Vui lòng đặt cược trước khi lắc!', 'warn');
            return;
        }
        this.isRolling = true;
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = Array.from(document.querySelectorAll('xuc-xac'));
        const statusEl = document.getElementById('bc-status');
        const scoreEl = document.getElementById('total-score');
        const subEl = document.getElementById('tx-side-detail');

        if (scoreEl) scoreEl.textContent = '...';
        if (subEl) subEl.textContent = `Tài ${this.bets.tai.toLocaleString('vi-VN')} · Xỉu ${this.bets.xiu.toLocaleString('vi-VN')}`;
        if (statusEl) {
            statusEl.classList.add('rolling');
            statusEl.classList.remove('result-win', 'result-lose', 'result-draw');
        }

        bowl.classList.add('disabled');
        lid.classList.remove('open');
        bowl.classList.add('shaking');
        diceEls.forEach(el => el.setAttribute('rolling', 'true'));

        let count = 0;
        const spin = setInterval(() => {
            diceEls.forEach(el => el.setAttribute('value', Math.floor(Math.random()*6)+1));
            if (++count >= 15) { clearInterval(spin); this.finishRoll(); }
        }, 80);
    }

    // Ghi Firestore NGAY 1 LẦN DUY NHẤT cho cả ván: net = (tiền thắng + buff) - tổng cược.
    async finishRoll() {
        // Game Hack force (chọn kết quả từ admin)
        let diceValues, total, result;
        if (this._adminForcedRoll) {
          const f = this._adminForcedRoll;
          this._adminForcedRoll = null;
          diceValues = f.values;
          total = f.total;
          result = f.result;
        } else {
          diceValues = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
          total = diceValues.reduce((a,b)=>a+b);
          result = total >= 11 ? 'tai' : 'xiu';
        }
        // Admin force
        if (window.__ADMIN_FORCED_RESULT === 'win') {
          if (this.bets.tai > 0 && this.bets.xiu === 0) result = 'tai';
          else if (this.bets.xiu > 0 && this.bets.tai === 0) result = 'xiu';
          else result = this.bets.tai >= this.bets.xiu ? 'tai' : 'xiu';
          if (result === 'tai') diceValues = [6,6,6]; else diceValues = [1,1,1];
          total = diceValues.reduce((a,b)=>a+b);
        } else if (window.__ADMIN_FORCED_RESULT === 'lose') {
          if (this.bets.tai > 0 && this.bets.xiu === 0) result = 'xiu';
          else if (this.bets.xiu > 0 && this.bets.tai === 0) result = 'tai';
          else result = this.bets.tai >= this.bets.xiu ? 'xiu' : 'tai';
          if (result === 'tai') diceValues = [6,6,6]; else diceValues = [1,1,1];
          total = diceValues.reduce((a,b)=>a+b);
        }
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = Array.from(document.querySelectorAll('xuc-xac'));
        const statusEl = document.getElementById('bc-status');

        bowl.classList.remove('shaking');
        diceEls.forEach(el => el.setAttribute('rolling', 'false'));
        diceEls.forEach((el,i) => el.setAttribute('value', diceValues[i]));

        await new Promise(r => setTimeout(r, 400));
        lid.classList.add('open');
        await new Promise(r => setTimeout(r, 200));

        const totalBet = Object.values(this.bets).reduce((a,b)=>a+b,0);
        let winAmt = 0;
        if (this.bets[result] > 0) winAmt = this.bets[result] * 2;
        let buffBonus = 0, buffPct = 0;
        if (winAmt > 0) {
            buffPct = this.cachedBuffPct;
            if (buffPct > 0) buffBonus = Math.round(this.bets[result] * buffPct / 100);
        }
        const net = winAmt - totalBet + buffBonus;

        if (net !== 0) {
            try {
                await addPoints('Tài Xỉu', net > 0 ? 'Thắng' : 'Thua', net, false);
            } catch (e) {
                console.error(e);
                window.showToast?.('Lỗi cộng điểm: ' + e.message, 'error');
            }
        }
        // Local đã trừ totalBet lúc đặt cược rồi, giờ chỉ cộng lại phần thắng + buff.
        this.balance += (winAmt + buffBonus);
        if (window.TopNav) window.TopNav.setPoints(this.balance);

        if (buffBonus > 0) {
            const petLabel = this.cachedPet ? `${this.cachedPet.emoji} ${this.cachedPet.name}` : '🐾 Pet';
            window.showToast?.(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
        }

        if (statusEl) statusEl.classList.remove('rolling');
        this.bets = { tai: 0, xiu: 0 };
        this.renderBets();
        this.updateStatusBar(total, net, result);

        if (window.VTQuests) {
            window.VTQuests.trackPlay('taixiu');
            if (net > 0) {
                window.VTQuests.trackEarn(net);
                window.VTQuests.trackGameWin('taixiu');
            }
        }

        this.isRolling = false;
        bowl.classList.remove('disabled');
    }

    // Nếu người chơi thoát/đóng tab khi đã đặt cược nhưng chưa lắc xong, tính thua toàn bộ cược
    // (vì cược mới chỉ trừ ở local, chưa từng ghi Firestore).
    forfeitIfAbandoned() {
        const total = Object.values(this.bets).reduce((a,b) => a+b, 0);
        if (total > 0) {
            addPoints('Tài Xỉu', 'Bỏ ván - mất cược', -total, false).catch(() => {});
        }
    }
}

new TaiXiu();

// ── ADMIN HACK: CHỌN KẾT QUẢ ────────────────────────────
if (window.__ADMIN_GAME_HACKS) {
  window.__ADMIN_GAME_HACKS.push({
    id: 'taixiu_choose_result',
    label: 'Chọn kết quả',
    icon: '⚀',
    render: (container, closeModal) => {
      container.innerHTML = `
        <p style="color:#94a3b8;font-size:12px;margin-bottom:10px;">Chọn kết quả cho ván lắc</p>
        <div id="txHackStatus" style="color:#34d399;font-size:12px;font-weight:700;margin-bottom:8px;min-height:18px;"></div>
        <div style="display:flex;gap:12px;justify-content:center;margin-bottom:14px;">
          <button id="txHackTai" style="
            flex:1;padding:20px;border-radius:14px;border:2px solid rgba(239,68,68,0.3);
            background:rgba(239,68,68,0.08);color:#f87171;font-size:18px;font-weight:700;
            cursor:pointer;transition:all 0.2s;font-family:'Nunito',sans-serif;
          " onmouseover="this.style.borderColor='rgba(239,68,68,0.6)';this.style.background='rgba(239,68,68,0.15)'"
             onmouseout="this.style.borderColor='rgba(239,68,68,0.3)';this.style.background='rgba(239,68,68,0.08)'">🔴 TÀI<br><span style="font-size:12px;color:#fca5a5">11-18 điểm</span></button>
          <button id="txHackXiu" style="
            flex:1;padding:20px;border-radius:14px;border:2px solid rgba(56,189,248,0.3);
            background:rgba(56,189,248,0.08);color:#38bdf8;font-size:18px;font-weight:700;
            cursor:pointer;transition:all 0.2s;font-family:'Nunito',sans-serif;
          " onmouseover="this.style.borderColor='rgba(56,189,248,0.6)';this.style.background='rgba(56,189,248,0.15)'"
             onmouseout="this.style.borderColor='rgba(56,189,248,0.3)';this.style.background='rgba(56,189,248,0.08)'">🔵 XỈU<br><span style="font-size:12px;color:#7dd3fc">3-10 điểm</span></button>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">Hoặc nhập tổng điểm cụ thể (3-18):</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input id="txHackTotal" type="number" min="3" max="18" value="11" style="
              width:80px;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);
              background:rgba(0,0,0,0.3);color:#e0f2fe;font-size:16px;text-align:center;outline:none;
            ">
            <button id="txHackSetTotal" class="green">🎯 Set tổng</button>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
            ${[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map(n => `
              <button class="txHackNum" data-n="${n}" style="
                width:32px;height:32px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);
                background:rgba(255,255,255,0.03);color:#94a3b8;font-size:11px;font-weight:600;
                cursor:pointer;transition:all 0.15s;
              " onmouseover="this.style.borderColor='rgba(56,189,248,0.3)';this.style.background='rgba(56,189,248,0.08)'"
                 onmouseout="this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'">${n}</button>
            `).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="txHackClose" style="flex:1;background:rgba(148,163,184,0.1);color:#94a3b8;border-color:rgba(148,163,184,0.2);">✕ Đóng</button>
        </div>
      `;

      const status = document.getElementById('txHackStatus');

      document.getElementById('txHackTai')?.addEventListener('click', () => {
        const g = window.txGame;
        if (!g) { if (status) status.textContent = '❌ Game chưa sẵn sàng'; return; }
        g._adminForcedRoll = { result: 'tai', values: [6,6,6], total: 18 };
        if (status) status.textContent = '✅ Kết quả: 🔴 TÀI (6+6+6 = 18)'; status.style.color = '#f87171';
      });

      document.getElementById('txHackXiu')?.addEventListener('click', () => {
        const g = window.txGame;
        if (!g) { if (status) status.textContent = '❌ Game chưa sẵn sàng'; return; }
        g._adminForcedRoll = { result: 'xiu', values: [1,1,1], total: 3 };
        if (status) status.textContent = '✅ Kết quả: 🔵 XỈU (1+1+1 = 3)'; status.style.color = '#38bdf8';
      });

      document.getElementById('txHackSetTotal')?.addEventListener('click', () => {
        const input = document.getElementById('txHackTotal');
        const total = parseInt(input?.value);
        if (isNaN(total) || total < 3 || total > 18) { if (status) status.textContent = '⚠️ Nhập số từ 3-18'; return; }
        const g = window.txGame;
        if (!g) { if (status) status.textContent = '❌ Game chưa sẵn sàng'; return; }
        
        // Generate dice values that sum to the total
        let v1 = Math.min(6, Math.max(1, total - 12));
        let remaining = total - v1;
        let v2 = Math.min(6, Math.max(1, remaining - 6));
        let v3 = remaining - v2;
        if (v3 < 1 || v3 > 6) { v2 = Math.min(6, Math.max(1, total - v1 - 1)); v3 = total - v1 - v2; }
        if (v3 < 1 || v3 > 6) { v1 = Math.min(6, Math.max(1, total - 6)); v2 = Math.min(6, Math.max(1, total - v1 - 1)); v3 = total - v1 - v2; }
        
        const result = total >= 11 ? 'tai' : 'xiu';
        g._adminForcedRoll = { result, values: [v1, v2, v3], total };
        if (status) {
          status.textContent = `✅ Tổng ${total}: ${result === 'tai' ? '🔴 TÀI' : '🔵 XỈU'} (${v1}+${v2}+${v3})`;
          status.style.color = result === 'tai' ? '#f87171' : '#38bdf8';
        }
      });

      document.querySelectorAll('.txHackNum').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('txHackTotal').value = btn.dataset.n;
          document.getElementById('txHackSetTotal')?.click();
        });
      });

      document.getElementById('txHackClose')?.addEventListener('click', closeModal);
    }
  });

}
window.addEventListener('pagehide', () => { if (!window.__navigated) { window.txGame?.forfeitIfAbandoned(); window.txGame?.unsubBalance?.(); } });
window.addEventListener('beforeunload', () => { if (!window.__navigated) window.txGame?.forfeitIfAbandoned(); });

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.txGame?.forfeitIfAbandoned();document.getElementById('tx-menu').classList.add('active');document.getElementById('tx-menu').style.display='';document.getElementById('tx-game-screen').classList.remove('active');document.getElementById('tx-game-screen').style.display='none'})}},100);
