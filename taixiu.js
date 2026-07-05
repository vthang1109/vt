import { addPoints, getPoints } from './points.js';
import { getActiveBuff, getPetById } from './pet.js';
import { auth, db } from './points.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

class TaiXiu {
    constructor() {
        this.bets = { tai: 0, xiu: 0 };
        this.currentChip = 1000;
        this.isRolling = false;
        this.init();
    }

    async init() {
        await this.refreshPts();
        this.bindEvents();
        this.watchNavPts();
        this.updateStatusBar(null, null, null);
    }

    watchNavPts() {
        const navEl = document.getElementById('nav-pts');
        if (!navEl) return;
        const sync = () => {
            const num = parseInt(navEl.textContent.replace(/[^\d]/g, '')) || 0;
            if (window.TopNav) window.TopNav.setPoints(num);
        };
        sync();
        new MutationObserver(sync).observe(navEl, { childList: true, characterData: true, subtree: true });
    }

    async refreshPts() {
        const pts = await getPoints();
        let el = document.getElementById('nav-pts');
        if (!el) {
            el = document.createElement('div');
            el.id = 'nav-pts';
            el.style.display = 'none';
            document.body.appendChild(el);
        }
        el.textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
        if (window.TopNav) window.TopNav.setPoints(pts || 0);
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

    async placeBet(choice) {
        if (this.isRolling) return;
        const bal = await getPoints();
        if (bal < this.currentChip) {
            if (window.showToast) window.showToast('⚠️ Không đủ điểm để đặt cược!', 'warn');
            return;
        }
        await addPoints('Tài Xỉu', `Đặt ${choice}`, -this.currentChip);
        this.bets[choice] += this.currentChip;
        this.renderBets();
        this.updateStatusBar(null, null, null);
        await this.refreshPts();
    }

    renderBets() {
        for (let c in this.bets) {
            const el = document.getElementById(`bet-${c}`);
            if (el) el.textContent = this.bets[c].toLocaleString('vi-VN');
            const card = document.querySelector(`.bet-card[data-id="${c}"]`);
            if (card) card.classList.toggle('has-bet', this.bets[c] > 0);
        }
    }

    async resetBoard() {
        if (this.isRolling) return;
        const total = Object.values(this.bets).reduce((a,b) => a+b, 0);
        if (total > 0) {
            await addPoints('Tài Xỉu', 'Huỷ cược', total);
            this.bets = { tai: 0, xiu: 0 };
            this.renderBets();
            this.updateStatusBar(null, null, null);
            await this.refreshPts();
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

    async finishRoll() {
        const diceValues = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
        const total = diceValues.reduce((a,b)=>a+b);
        const result = total >= 11 ? 'tai' : 'xiu';
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
            try {
                buffPct = await getActiveBuff();
                if (buffPct > 0) buffBonus = Math.round(this.bets[result] * buffPct / 100);
            } catch {}
        }
        const net = winAmt - totalBet + buffBonus;
        if (winAmt > 0) {
            await addPoints('Tài Xỉu', 'Thắng', winAmt + buffBonus, false);
            if (buffBonus > 0) {
                let petLabel = '🐾 Pet';
                try {
                    const ud = await getDoc(doc(db, 'users', auth.currentUser.uid));
                    const pet = ud.data()?.activePet ? getPetById(ud.data().activePet) : null;
                    if (pet) petLabel = `${pet.emoji} ${pet.name}`;
                } catch {}
                window.showToast?.(`${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
            }
        }

        if (statusEl) statusEl.classList.remove('rolling');
        this.bets = { tai: 0, xiu: 0 };
        this.renderBets();
        this.updateStatusBar(total, net, result);

        if (window.VTQuests) {
            window.VTQuests.trackPlay('taixiu');
            if (net > 0) window.VTQuests.trackEarn(net);
        }

        this.isRolling = false;
        bowl.classList.remove('disabled');
        await this.refreshPts();
    }
}

new TaiXiu();
