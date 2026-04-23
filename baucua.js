import { addPoints, getPoints } from './points.js';

class BauCua {
    constructor() {
        this.items = [
            { id: 'bau', emoji: '🎃' }, { id: 'cua', emoji: '🦀' },
            { id: 'tom', emoji: '🦞' }, { id: 'ca',  emoji: '🐟' },
            { id: 'ga',  emoji: '🐔' }, { id: 'nai', emoji: '🦌' }
        ];
        this.currentChip = 1000;
        this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
        this.isRolling = false;
        this.init();
    }

    async init() {
        this.createResultNoticeElement();
        await this.refreshPts();
        this.bindEvents();
    }

    // Tạo bảng thông báo Neon trong khu vực bát
    createResultNoticeElement() {
        const bowlContainer = document.querySelector('.bowl-container');
        if (bowlContainer && !document.getElementById('result-notice')) {
            const noticeEl = document.createElement('div');
            noticeEl.id = 'result-notice';
            noticeEl.className = 'result-notice';
            bowlContainer.appendChild(noticeEl);
        }
    }

    async refreshPts() {
        const pts = await getPoints();
        const el = document.getElementById('pts-value');
        if (el) el.textContent = (pts || 0).toLocaleString();
    }

    bindEvents() {
        // Sự kiện đặt cược
        document.querySelectorAll('.bet-card').forEach(card => {
            card.onclick = () => this.placeBet(card.dataset.id);
        });

        // Sự kiện chọn mức cược (chip)
        document.querySelectorAll('.chip[data-amt]').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentChip = parseInt(chip.dataset.amt);
            };
        });

        // Nút điều khiển
        document.getElementById('btn-roll').onclick = () => this.roll();
        document.getElementById('btn-clear').onclick = () => this.resetBoard();
    }

    async placeBet(id) {
        if (this.isRolling) return;
        this.hideResultNotice();
        const bal = await getPoints();
        if (bal < this.currentChip) return alert("Không đủ tiền đặt cược!");
        
        await addPoints('Bầu Cua', `Đặt ${id}`, -this.currentChip);
        this.bets[id] += this.currentChip;
        this.renderBets();
        this.updateTotalBet();
        await this.refreshPts();
    }

    renderBets() {
        for (let id in this.bets) {
            const el = document.getElementById(`bet-${id}`);
            const card = document.querySelector(`.bet-card[data-id="${id}"]`);
            if (el) el.textContent = this.bets[id].toLocaleString();
            if (card) {
                this.bets[id] > 0 ? card.classList.add('has-bet') : card.classList.remove('has-bet');
            }
        }
    }

    updateTotalBet() {
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        const el = document.getElementById('total-bet-val');
        if (el) el.textContent = total.toLocaleString();
    }

    async resetBoard() {
        if (this.isRolling) return;
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total > 0) {
            await addPoints('Bầu Cua', 'Huỷ cược', total);
            this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
            this.renderBets();
            this.updateTotalBet();
            await this.refreshPts();
        }
    }

    async roll() {
        if (this.isRolling) return;
        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (totalBet === 0) return alert("Vui lòng đặt cược trước khi lắc!");

        this.hideResultNotice();
        this.isRolling = true;
        
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));
        
        // Đóng nắp và ẩn xúc xắc cũ
        lid.classList.remove('open');
        diceEls.forEach(el => el.classList.remove('reveal'));
        
        // Rung bát
        bowl.classList.add('rolling');
        document.getElementById('btn-roll').disabled = true;

        let count = 0;
        const spin = setInterval(() => {
            // Xúc xắc nhảy ảo bên dưới nắp
            diceEls.forEach(el => {
                el.textContent = this.items[Math.floor(Math.random() * 6)].emoji;
            });
            if (count++ > 15) {
                clearInterval(spin);
                this.finishRoll();
            }
        }, 80);
    }

    async finishRoll() {
        const results = Array.from({length: 3}, () => this.items[Math.floor(Math.random() * 6)]);
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));

        // 1. Dừng rung
        bowl.classList.remove('rolling');
        
        // 2. Gán kết quả thật vào xúc xắc (vẫn đang ẩn dưới nắp)
        results.forEach((res, i) => {
            diceEls[i].textContent = res.emoji;
        });

        await new Promise(r => setTimeout(r, 500));

        // 3. MỞ NẮP VÀ HIỆN XÚC XẮC ĐỒNG LOẠT
        lid.classList.add('open'); 
        diceEls.forEach(el => el.classList.add('reveal'));

        // Đợi hiệu ứng mở nắp hoàn tất rồi tính điểm
        await new Promise(r => setTimeout(r, 600));
        
        let winAmt = 0;
        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);
        const resCounts = {};
        results.forEach(r => resCounts[r.id] = (resCounts[r.id] || 0) + 1);

        for (let id in this.bets) {
            if (this.bets[id] > 0 && resCounts[id]) {
                // Tiền thắng = Tiền gốc đặt + (Tiền cược * số lượng hột trúng)
                winAmt += this.bets[id] + (this.bets[id] * resCounts[id]);
            }
        }

        if (winAmt > 0) {
            await addPoints('Bầu Cua', 'Thắng', winAmt);
            const net = winAmt - totalBet;
            if (net > 0) {
                this.showResultNotice(`Lời: ${net.toLocaleString()}`, 'notice-profit');
            } else if (net < 0) {
                this.showResultNotice(`Lỗ: ${Math.abs(net).toLocaleString()}`, 'notice-lost');
            } else {
                this.showResultNotice(`Hòa vốn`, 'notice-profit');
            }
        } else {
            this.showResultNotice(`MẤT TRẮNG`, 'notice-lost');
        }

        // Reset dữ liệu bàn cược cho ván mới
        this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
        this.renderBets();
        this.updateTotalBet();
        this.isRolling = false;
        document.getElementById('btn-roll').disabled = false;
        await this.refreshPts();
    }

    showResultNotice(text, className) {
        const el = document.getElementById('result-notice');
        if (el) {
            el.textContent = text;
            el.className = 'result-notice ' + className;
            el.style.display = 'block';
        }
    }

    hideResultNotice() {
        const el = document.getElementById('result-notice');
        if (el) el.style.display = 'none';
    }
}

new BauCua();
