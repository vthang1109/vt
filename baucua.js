import { addPoints, getPoints } from './points.js';

class BauCua {
    constructor() {
        // Danh sách 6 con vật (emoji khớp với HTML)
        this.items = [
            { id: 'bau', emoji: '🎃' },
            { id: 'cua', emoji: '🦀' },
            { id: 'tom', emoji: '🦞' },
            { id: 'ca',  emoji: '🐟' },
            { id: 'ga',  emoji: '🐔' },
            { id: 'nai', emoji: '🦌' }
        ];

        // Mức chip đang chọn
        this.currentChip = 1000;

        // Lượng tiền đã đặt cho mỗi ô
        this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };

        // Trạng thái đang lắc
        this.isRolling = false;

        this.init();
    }

    async init() {
        await this.refreshPts();
        this.bindEvents();

        // Ẩn thông báo kết quả ban đầu
        const notice = document.getElementById('result-notice');
        if (notice) notice.style.display = 'none';
    }

    // ========== HIỂN THỊ ĐIỂM ==========
    async refreshPts() {
        const pts = await getPoints();
        const el = document.getElementById('nav-pts');
        // Đồng bộ với Xì Dách: hiển thị "⭐ 1000"
        if (el) el.textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
    }

    // ========== GÁN SỰ KIỆN ==========
    bindEvents() {
        // Đặt cược khi click vào ô
        document.querySelectorAll('.bet-card').forEach(card => {
            card.addEventListener('click', () => this.placeBet(card.dataset.id));
        });

        // Chọn mức chip
        document.querySelectorAll('.chip[data-amt]').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentChip = parseInt(chip.dataset.amt);
            });
        });

        // Nút Lắc
        document.getElementById('btn-roll').addEventListener('click', () => this.roll());

        // Nút Xoá cược
        document.getElementById('btn-clear').addEventListener('click', () => this.resetBoard());
    }

    // ========== ĐẶT CƯỢC ==========
    async placeBet(id) {
        if (this.isRolling) return;

        // Ẩn thông báo cũ nếu có
        const notice = document.getElementById('result-notice');
        if (notice) notice.style.display = 'none';

        // Kiểm tra số dư
        const bal = await getPoints();
        if (bal < this.currentChip) {
            alert('Không đủ điểm để đặt cược!');
            return;
        }

        // Trừ điểm ngay khi đặt
        await addPoints('Bầu Cua', `Đặt ${id}`, -this.currentChip);
        this.bets[id] += this.currentChip;

        // Cập nhật giao diện
        this.renderBets();
        this.updateTotalBet();
        await this.refreshPts();
    }

    // ========== HIỂN THỊ SỐ TIỀN TRÊN Ô CƯỢC ==========
    renderBets() {
        for (let id in this.bets) {
            const betEl = document.getElementById(`bet-${id}`);
            const cardEl = document.querySelector(`.bet-card[data-id="${id}"]`);
            if (betEl) betEl.textContent = this.bets[id].toLocaleString('vi-VN');
            if (cardEl) {
                if (this.bets[id] > 0) {
                    cardEl.classList.add('has-bet');
                } else {
                    cardEl.classList.remove('has-bet');
                }
            }
        }
    }

    updateTotalBet() {
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        const el = document.getElementById('total-bet-val');
        if (el) el.textContent = total.toLocaleString('vi-VN');
    }

    // ========== HUỶ CƯỢC ==========
    async resetBoard() {
        if (this.isRolling) return;
        const total = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (total > 0) {
            // Hoàn lại toàn bộ tiền đã đặt
            await addPoints('Bầu Cua', 'Huỷ cược', total);
            this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
            this.renderBets();
            this.updateTotalBet();
            await this.refreshPts();
        }
    }

    // ========== LẮC BẦU CUA ==========
    async roll() {
        if (this.isRolling) return;

        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);
        if (totalBet === 0) {
            alert('Vui lòng đặt cược trước khi lắc!');
            return;
        }

        this.isRolling = true;
        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));
        const notice = document.getElementById('result-notice');
        if (notice) notice.style.display = 'none';

        // Đóng nắp, ẩn xúc xắc cũ
        lid.classList.remove('open');
        diceEls.forEach(el => el.classList.remove('reveal'));

        // Rung bát
        bowl.classList.add('rolling');
        document.getElementById('btn-roll').disabled = true;

        // Giả lập xúc xắc nhảy trong 1.2 giây
        let count = 0;
        const maxCount = 15; // 15 * 80ms = 1200ms
        const spinInterval = setInterval(() => {
            diceEls.forEach(el => {
                el.textContent = this.items[Math.floor(Math.random() * 6)].emoji;
            });
            count++;
            if (count >= maxCount) {
                clearInterval(spinInterval);
                this.finishRoll();
            }
        }, 80);
    }

    async finishRoll() {
        // Sinh kết quả ngẫu nhiên 3 con
        const results = Array.from({ length: 3 }, () => this.items[Math.floor(Math.random() * 6)]);

        const bowl = document.getElementById('bowl');
        const lid = document.getElementById('bowl-lid');
        const diceEls = [0, 1, 2].map(i => document.getElementById(`dice-${i}`));

        // Dừng rung
        bowl.classList.remove('rolling');

        // Gán giá trị thật (vẫn ẩn dưới nắp)
        results.forEach((res, i) => {
            diceEls[i].textContent = res.emoji;
        });

        // Đợi 1 chút rồi mở nắp
        await new Promise(r => setTimeout(r, 400));
        lid.classList.add('open');
        diceEls.forEach(el => el.classList.add('reveal'));

        // Đợi animation mở nắp hoàn tất
        await new Promise(r => setTimeout(r, 600));

        // Tính kết quả
        const resCounts = {};
        results.forEach(r => resCounts[r.id] = (resCounts[r.id] || 0) + 1);

        let winAmt = 0;  // tổng tiền nhận về (gốc + lãi)
        const totalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);

        for (let id in this.bets) {
            if (this.bets[id] > 0 && resCounts[id]) {
                // Tiền thắng = tiền gốc (đã trừ khi đặt) + tiền thưởng thêm
                // Đặt 1000, ra 1 con -> nhận 2000 (lời 1000), ra 2 con -> 3000...
                winAmt += this.bets[id] * (1 + resCounts[id]);
            }
        }

        if (winAmt > 0) {
            await addPoints('Bầu Cua', 'Thắng', winAmt);
            const net = winAmt - totalBet;
            if (net > 0) {
                this.showResultNotice(`Lời: +${net.toLocaleString('vi-VN')}`, 'notice-profit');
            } else if (net < 0) {
                this.showResultNotice(`Lỗ: ${net.toLocaleString('vi-VN')}`, 'notice-lost');
            } else {
                this.showResultNotice('Hoà vốn', 'notice-profit');
            }
            // Ghi nhận cho nhiệm vụ
            if (window.VTQuests) {
                window.VTQuests.trackPlay('baucua');
                if (net > 0) window.VTQuests.trackEarn(net);
            }
        } else {
            // Thua toàn bộ
            this.showResultNotice('Mất trắng', 'notice-lost');
            if (window.VTQuests) {
                window.VTQuests.trackPlay('baucua');
            }
        }

        // Reset bàn cược
        this.bets = { bau: 0, cua: 0, tom: 0, ca: 0, ga: 0, nai: 0 };
        this.renderBets();
        this.updateTotalBet();
        this.isRolling = false;
        document.getElementById('btn-roll').disabled = false;
        await this.refreshPts();
    }

    // ========== THÔNG BÁO KẾT QUẢ ==========
    showResultNotice(text, className) {
        const el = document.getElementById('result-notice');
        if (el) {
            el.textContent = text;
            el.className = 'result-notice ' + className;
            el.style.display = 'block';
        }
    }
}

// Khởi chạy game
new BauCua();