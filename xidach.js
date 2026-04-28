// xidach.js — Xì Dách Offline (Chơi đơn vs Nhà Cái)
import { createDeck, renderCardUI } from './cards.js';
import { addPoints, getPoints } from './points.js';

class XiDach {
    constructor() {
        this.deck = [];
        this.dealer = { hand: [] };
        this.players = [{ hand: [], status: 'playing', result: '' }];
        this.balance = 0;
        this.currentBet = 0;
        this.dealerDone = false;
        this.isBusy = false;
        this.isPlayerFlipped = false;

        this.init();
    }

    async init() {
        const style = document.createElement('style');
        style.textContent = `
            .card-new { animation: cardAppear 0.4s ease-out forwards; }
            @keyframes cardAppear {
                0% { transform: translateY(-50px) rotate(-10deg); opacity: 0; }
                100% { transform: translateY(0) rotate(0); opacity: 1; }
            }
            .hand { display: flex; gap: 5px; justify-content: center; min-height: 120px; align-items: center; }
        `;
        document.head.appendChild(style);

        await this.refreshPts();
        this.bindEvents();
        window.game = this;
    }

    bindEvents() {
        document.querySelectorAll('.bet-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.getAttribute('data-amount');
                this.placeBet(amt === 'all' ? 'all' : parseInt(amt));
            });
        });

        // Đóng overlay khi click ra ngoài
        const betOverlay = document.getElementById('bet-selector');
        if (betOverlay) {
            betOverlay.addEventListener('click', (e) => {
                if (e.target === betOverlay) betOverlay.classList.remove('active');
            });
        }
        const modeOverlay = document.getElementById('mode-selector');
        if (modeOverlay) {
            modeOverlay.addEventListener('click', (e) => {
                if (e.target === modeOverlay) modeOverlay.classList.remove('active');
            });
        }
    }

    async refreshPts() {
        this.balance = await getPoints();
        const el = document.getElementById('nav-pts');
        if (el) el.textContent = '⭐ ' + this.balance.toLocaleString();
    }

    showModes() {
        document.getElementById('mode-selector').classList.add('active');
    }

    setMode(m) {
        if (m === 'solo') {
            document.getElementById('mode-selector').classList.remove('active');
            this.showBetting();
        }
    }

    async showBetting() {
        await this.refreshPts();
        const balEl = document.getElementById('current-balance');
        if (balEl) balEl.textContent = `Số dư: ⭐ ${this.balance.toLocaleString()}`;
        document.getElementById('bet-selector').classList.add('active');
    }

    async placeBet(amount) {
        if (amount === 'all') amount = this.balance;
        if (amount > this.balance || amount <= 0) return alert("Tiền không hợp lệ!");
        
        this.currentBet = amount;
        document.getElementById('bet-selector').classList.remove('active');
        
        await addPoints('Casino', 'Cược Xì Dách', -this.currentBet);
        await this.refreshPts();
        
        this.startDeal();
    }

    async startDeal() {
        if (this.isBusy) return;

        // Nếu đây là ván mới và đã có kết quả trước đó, trừ tiền cược
        if (this.players[0].result !== '') {
            await this.refreshPts();
            if (this.balance < this.currentBet) {
                return alert("Bạn không đủ tiền để tiếp tục mức cược này!");
            }
            await addPoints('Casino', 'Cược Xì Dách (Ván mới)', -this.currentBet);
            await this.refreshPts();
        }

        if (this.balance < 0) return alert("Hết tiền cược!");

        this.isBusy = true;
        this.dealerDone = false;
        this.isPlayerFlipped = false;
        this.players[0].result = '';

        const deck = createDeck();
        this.deck = deck;
        this.dealer.hand = [deck.pop(), deck.pop()];
        this.players[0].hand = [deck.pop(), deck.pop()];

        // Kiểm tra đặc biệt ngay sau khi chia bài
        if (this.checkSpecials(this.dealer.hand) || this.checkSpecials(this.players[0].hand)) {
            this.dealerDone = true;
            this.isPlayerFlipped = true;
            this.endGame();
        } else {
            this.render(false);
            this.updateButtons(true); // Cho phép nhấn nút MỞ BÀI
        }

        this.isBusy = false;
    }

    getScore(hand) {
        let s = 0, a = 0;
        for (let c of hand) {
            if (c.v === 'A') { a++; s += 11; }
            else if (['J', 'Q', 'K'].includes(c.v)) s += 10;
            else s += parseInt(c.v);
        }
        while (s > 21 && a > 0) { s -= 10; a--; }
        return s;
    }

    checkSpecials(hand) {
        if (hand.length !== 2) return null;
        const v = [hand[0].v, hand[1].v];
        if (v[0] === 'A' && v[1] === 'A') return 'AA';
        const isHigh = (val) => ['10', 'J', 'Q', 'K'].includes(val);
        if ((v[0] === 'A' && isHigh(v[1])) || (v[1] === 'A' && isHigh(v[0]))) return 'XD';
        return null;
    }

    async hit() {
        // Nếu chưa lật bài, lần nhấn đầu tiên là lật bài
        if (!this.isPlayerFlipped) {
            this.isPlayerFlipped = true;
            this.render(false);
            this.updateButtons(true);
            return;
        }

        const hand = this.players[0].hand;
        if (hand.length >= 5) return;
        
        const newCard = this.deck.pop();
        newCard.isNew = true;
        hand.push(newCard);
        
        const sc = this.getScore(hand);

        this.render(false);
        if (sc >= 21 || hand.length >= 5) {
            this.stand();
        } else {
            this.updateButtons(true);
        }
    }

    async stand() {
        await this.dealerTurnSolo();
    }

    async dealerTurnSolo() {
        this.isBusy = true;
        this.isPlayerFlipped = true;
        this.render(true);

        while (this.getScore(this.dealer.hand) < 15 && this.dealer.hand.length < 5) {
            await new Promise(r => setTimeout(r, 800));
            const newCard = this.deck.pop();
            newCard.isNew = true;
            this.dealer.hand.push(newCard);
            this.render(true);
        }

        this.dealerDone = true;
        this.endGame();
    }

    async endGame() {
        const dS = this.getScore(this.dealer.hand);
        const dL = this.dealer.hand.length;
        const dSpec = this.checkSpecials(this.dealer.hand);
        
        const p = this.players[0];
        const pS = this.getScore(p.hand);
        const pL = p.hand.length;
        const pSpec = this.checkSpecials(p.hand);

        let res = '';
        if (pSpec || dSpec) {
            if (pSpec === 'AA' && dSpec !== 'AA') res = 'AA';
            else if (pSpec === 'XD' && !dSpec) res = 'XD';
            else if (pSpec === dSpec && pSpec) res = 'HÒA';
            else res = 'THUA';
        } else if (pL === 5 && pS <= 21) {
            res = (dL === 5 && dS <= 21) ? (pS < dS ? 'NGŨ LINH' : (pS > dS ? 'THUA' : 'HÒA')) : 'NGŨ LINH';
        } else if (pS > 21) {
            res = (dS > 21) ? 'HÒA' : 'THUA';
        } else if (dL === 5 && dS <= 21) {
            res = 'THUA';
        } else if (dS > 21 || pS > dS) {
            res = 'THẮNG';
        } else if (pS === dS) {
            res = 'HÒA';
        } else {
            res = 'THUA';
        }

        p.result = res;

        let winMult = 0;
        if (['THẮNG', 'NGŨ LINH', 'XD', 'AA'].includes(res)) winMult = 2;
        else if (res === 'HÒA') winMult = 1;

        if (winMult > 0) {
            await addPoints('Casino', 'Kết quả Xì Dách', this.currentBet * winMult);
            await this.refreshPts();
        }
        
        this.render(true);
        this.updateButtons(false);
        this.isBusy = false;
        document.getElementById('status-msg').textContent = "VÁN ĐẤU KẾT THÚC";
    }

    updateButtons(canPlay) {
        const pS = this.getScore(this.players[0].hand);
        const pL = this.players[0].hand.length;
        const isGameOver = this.players[0].result !== '';

        const hitBtn = document.getElementById('btn-hit');
        const standBtn = document.getElementById('btn-stand');
        const dealBtn = document.getElementById('btn-deal');

        // Nút HIT (Mở bài / Rút bài)
        // Luôn bật nếu đến lượt và game chưa kết thúc
        hitBtn.disabled = !canPlay || isGameOver;
        
        if (!this.isPlayerFlipped) {
            // Chưa lật bài: nút hiển thị "MỞ BÀI", luôn bật (khi canPlay)
            hitBtn.textContent = "MỞ BÀI";
        } else {
            // Đã lật bài: nút hiển thị "RÚT BÀI", chỉ tắt nếu quá điểm hoặc quá lá
            if (pS >= 21 || pL >= 5) {
                hitBtn.disabled = true;
            }
            hitBtn.textContent = "RÚT BÀI";
        }

        // Nút DẰN chỉ bật khi đã lật bài và đủ 16 điểm hoặc 5 lá
        const hasEnough = (pS >= 16 || pL === 5);
        standBtn.disabled = !canPlay || !hasEnough || !this.isPlayerFlipped || isGameOver;

        // Nút VÁN MỚI chỉ bật khi game kết thúc
        dealBtn.disabled = !isGameOver;

        if (isGameOver) {
            document.getElementById('status-msg').textContent = "VÁN ĐẤU KẾT THÚC";
        }
    }

    render(showDealer = false) {
        const dScore = this.getScore(this.dealer.hand);
        const dSpec = this.checkSpecials(this.dealer.hand);
        const dL = this.dealer.hand.length;
        const p = this.players[0];
        
        let dTxt = '', dCls = '';
        
        if (this.dealerDone || p.result !== '') {
            if (dSpec) { dTxt = dSpec === 'AA' ? 'XÌ BÀN' : 'XÌ DÁCH'; dCls = 'result-special'; }
            else if (dL === 5 && dScore <= 21) { dTxt = 'NGŨ LINH'; dCls = 'result-special'; }
            else if (dScore > 21) { dTxt = 'QUẮC'; dCls = 'result-lose'; }
            else if (p.result !== '') {
                if (['THẮNG', 'NGŨ LINH', 'XD', 'AA'].includes(p.result)) { dTxt = 'THUA'; dCls = 'result-lose'; }
                else if (p.result === 'THUA') { dTxt = 'THẮNG'; dCls = 'result-win'; }
                else if (p.result === 'HÒA') { dTxt = 'HÒA'; dCls = 'result-draw'; }
            }
        }
        
        document.getElementById('dealer-container').innerHTML = `
            <div class="player-hand active" style="border: 2px solid #ef4444; background: rgba(239, 68, 68, 0.05);">
                ${dTxt ? `<div class="result-overlay ${dCls}">${dTxt}</div>` : ''}
                <div class="hand">
                    ${this.dealer.hand.map(c => {
                        const html = renderCardUI(c, !showDealer);
                        const finalHtml = (c.isNew) ? html.replace('class="card', 'class="card card-new') : html;
                        delete c.isNew;
                        return finalHtml;
                    }).join('')}
                </div>
                <div class="badge">NHÀ CÁI: ${showDealer ? `<span style="color:#facc15; font-size: 1.1em; font-weight: 900;">${dScore}</span>` : '???'}</div>
            </div>`;

        const pS = this.getScore(p.hand);
        const pSpec = this.checkSpecials(p.hand);
        let pTxt = '', pCls = '';

        if (p.result) {
            if (pSpec) { pTxt = pSpec === 'AA' ? 'XÌ BÀN' : 'XÌ DÁCH'; pCls = 'result-special'; }
            else if (p.result === 'NGŨ LINH') { pTxt = 'NGŨ LINH'; pCls = 'result-special'; }
            else if (pS > 21) { pTxt = 'QUẮC'; pCls = 'result-lose'; }
            else { pTxt = p.result; pCls = p.result === 'THẮNG' ? 'result-win' : (p.result === 'HÒA' ? 'result-draw' : 'result-lose'); }
        }
        
        document.getElementById('game-table').innerHTML = `
            <div class="player-hand active">
                ${pTxt ? `<div class="result-overlay ${pCls}">${pTxt}</div>` : ''}
                <div class="hand">
                    ${p.hand.map(c => {
                        const html = renderCardUI(c, !this.isPlayerFlipped);
                        const finalHtml = (c.isNew) ? html.replace('class="card', 'class="card card-new') : html;
                        delete c.isNew;
                        return finalHtml;
                    }).join('')}
                </div>
                <div class="badge">BẠN: <span style="color:#facc15; font-size: 1.1em; font-weight: 900;">${this.isPlayerFlipped ? pS : '???'}</span> - CƯỢC: <span style="color:#38bdf8;">${this.currentBet}</span></div>
            </div>`;
    }
}

new XiDach();