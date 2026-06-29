import { addPoints, getPoints } from './points.js';

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
        document.getElementById('total-score').innerHTML = 'Tổng<br>--';
        const notice = document.getElementById('result-notice');
        notice.style.display = 'block';
        notice.textContent = 'Đang lắc...';
        notice.className = 'info-box waiting';
    }

    // points.js tự ghi điểm vào #nav-pts (ẩn) qua onSnapshot realtime.
    // Theo dõi để đồng bộ sang TopNav.setPoints() và ô bank số dư kiểu xidach.
    watchNavPts() {
        const navEl = document.getElementById('nav-pts');
        if (!navEl) return;
        const sync = () => {
            const num = parseInt(navEl.textContent.replace(/[^\d]/g, '')) || 0;
            if (window.TopNav) window.TopNav.setPoints(num);
            const bankEl = document.getElementById('bc-balance-detail');
            if (bankEl) bankEl.textContent = num.toLocaleString('vi-VN') + ' đ';
        };
        sync();
        new MutationObserver(sync).observe(navEl, { childList: true, characterData: true, subtree: true });
    }

    async refreshPts() {
        const pts = await getPoints();
        let el = document.getElementById('nav-pts');
        if (!el) {
            // Tạo phần tử ẩn để points.js (không sửa) vẫn có chỗ ghi điểm realtime
            el = document.createElement('div');
            el.id = 'nav-pts';
            el.style.display = 'none';
            document.body.appendChild(el);
        }
        el.textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
        if (window.TopNav) window.TopNav.setPoints(pts || 0);
        const bankEl = document.getElementById('bc-balance-detail');
        if (bankEl) bankEl.textContent = (pts || 0).toLocaleString('vi-VN') + ' đ';
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
        // Nhấn vào bát để lắc
        document.getElementById('bowl').addEventListener('click', () => this.roll());
        document.getElementById('btn-clear').addEventListener('click', () => this.resetBoard());
    }

    async placeBet(choice) {
        if (this.isRolling) return;
        const notice = document.getElementById('result-notice');
        notice.textContent = 'Đang lắc...';
        notice.className = 'info-box waiting';
        const bal = await getPoints();
        if (bal < this.currentChip) {
            if (window.showToast) window.showToast('⚠️ Không đủ điểm để đặt cược!', 'warn');
            else alert('Không đủ điểm!');
            return;
        }
        await addPoints('Tài Xỉu', `Đặt ${choice}`, -this.currentChip);
        this.bets[choice] += this.currentChip;
        this.renderBets();
        this.updateTotalBet();
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

    updateTotalBet() {
        const total = Object.values(this.bets).reduce((a,b) => a+b, 0);
        document.getElementById('total-bet-val').textContent = total.toLocaleString('vi-VN');
    }

    async resetBoard() {
        if (this.isRolling) return;
        const total = Object.values(this.bets).reduce((a,b) => a+b, 0);
        if (total > 0) {
            await addPoints('Tài Xỉu', 'Huỷ cược', total);
            this.bets = { tai: 0, xiu: 0 };
            this.renderBets();
            this.updateTotalBet();
            await this.refreshPts();
        }
    }

    async roll() {
        if (this.isRolling) return;
        if (Object.values(this.bets).reduce((a,b)=>a+b, 0) === 0) {
            if (window.showToast) window.showToast('⚠️ Vui lòng đặt cược trước khi lắc!', 'warn');
            else alert('Vui lòng đặt cược!');
            return;
        }
        this.isRolling = true;
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = Array.from(document.querySelectorAll('xuc-xac'));
        document.getElementById('total-score').innerHTML = 'Tổng<br>--';
        const notice = document.getElementById('result-notice');
        notice.textContent = 'Đang lắc...';
        notice.className = 'info-box waiting';
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

        bowl.classList.remove('shaking');
        diceEls.forEach(el => el.setAttribute('rolling', 'false'));
        diceEls.forEach((el,i) => el.setAttribute('value', diceValues[i]));

        await new Promise(r => setTimeout(r, 400));
        lid.classList.add('open');
        document.getElementById('total-score').innerHTML = `Tổng<br>${total}`;
        await new Promise(r => setTimeout(r, 200));

        const totalBet = Object.values(this.bets).reduce((a,b)=>a+b,0);
        let winAmt = 0, net = 0;
        if (this.bets[result] > 0) winAmt = this.bets[result] * 2;
        net = winAmt - totalBet;
        if (winAmt > 0) await addPoints('Tài Xỉu', 'Thắng', winAmt);

        const notice = document.getElementById('result-notice');
        if (net > 0) {
            notice.textContent = `Lời: +${net.toLocaleString('vi-VN')}`;
            notice.className = 'info-box win';
        } else if (net < 0) {
            notice.textContent = `Lỗ: ${net.toLocaleString('vi-VN')}`;
            notice.className = 'info-box lose';
        } else {
            notice.textContent = 'Huề vốn';
            notice.className = 'info-box win';
        }

        if (window.VTQuests) {
            window.VTQuests.trackPlay('taixiu');
            if (net > 0) window.VTQuests.trackEarn(net);
        }

        this.bets = { tai: 0, xiu: 0 };
        this.renderBets();
        this.updateTotalBet();
        this.isRolling = false;
        bowl.classList.remove('disabled');
        await this.refreshPts();
    }
}

new TaiXiu();
