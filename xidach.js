import { createRoom, joinRoom, listenRoom, updateRoomState } from './room.js';
import { createDeck, renderCardUI } from './cards.js';
import { addPoints, getPoints } from './points.js';

class XiDach {
    constructor() {
        this.deck = [];
        this.mode = 'solo'; 
        this.role = 'host'; 
        this.roomId = null;
        this.dealer = { hand: [] };
        this.players = [{ hand: [], status: 'playing', result: '' }];
        this.balance = 0;
        this.currentBet = 0;
        this.dealerDone = false;
        this.unsubscribe = null;
        this.isBusy = false;
        this.isPlayerFlipped = false; // Trạng thái lật bài người chơi

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
        this.mode = m;
        document.getElementById('mode-selector').classList.remove('active');
        this.showBetting();
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

    async createOnlineRoom() {
        const state = { dealerHand: [], playerHand: [], deck: [], isDealerDone: false, gameStarted: false, result: '', bet: 0 };
        const res = await createRoom("xidach", state);
        if (res.error) return alert(res.error);
        this.roomId = res.roomId;
        this.role = 'host';
        this.mode = 'online';
        this.startListening();
        alert("Mã phòng của bạn: " + res.roomId);
    }

    async joinOnlineRoom(id) {
        if (!id) return alert("Vui lòng nhập ID phòng!");
        const res = await joinRoom(id);
        if (res.error) return alert(res.error);
        this.roomId = res.roomId;
        this.role = 'guest';
        this.mode = 'online';
        this.startListening();
    }

    startListening() {
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = listenRoom(this.roomId, (data) => this.syncGame(data));
        document.getElementById('mode-selector').classList.remove('active');
    }

    async syncGame(roomData) {
        if (!roomData) return;
        const state = roomData.state;
        this.dealer.hand = state.dealerHand || [];
        this.players[0].hand = state.playerHand || [];
        this.deck = state.deck || [];
        this.dealerDone = state.isDealerDone;
        this.players[0].result = state.result || '';
        this.currentBet = state.bet || 0;

        // Online mode mặc định lật bài khi game chạy
        if (state.gameStarted) this.isPlayerFlipped = true;

        this.render(this.dealerDone);

        const isMyTurn = (this.role === roomData.turn);
        const gameStarted = state.gameStarted;
        const msg = document.getElementById('status-msg');

        if (gameStarted) {
            msg.textContent = isMyTurn ? "LƯỢT CỦA BẠN" : "ĐỐI THỦ ĐANG ĐI...";
        }

        this.updateButtons(isMyTurn && gameStarted && !this.dealerDone);

        if (this.dealerDone && state.result && !gameStarted) {
            await this.refreshPts();
        }
    }

    async startDeal() {
        if (this.isBusy) return;

        if (this.mode === 'solo' && this.players[0].result !== '') {
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
        this.isPlayerFlipped = false; // Reset trạng thái úp bài cho ván mới

        const deck = createDeck();
        const dH = [deck.pop(), deck.pop()];
        const pH = [deck.pop(), deck.pop()];

        if (this.mode === 'online') {
            await updateRoomState(this.roomId, { 
                dealerHand: dH, 
                playerHand: pH, 
                deck: deck, 
                isDealerDone: false, 
                gameStarted: true, 
                result: '',
                bet: this.currentBet 
            }, "guest"); 
            this.isBusy = false;
        } else {
            this.deck = deck;
            this.dealer.hand = dH;
            this.players[0].hand = pH;
            this.players[0].result = '';
            this.isBusy = false;

            if (this.checkSpecials(dH) || this.checkSpecials(pH)) {
                this.dealerDone = true;
                this.isPlayerFlipped = true; // Hiện bài ngay nếu có xì dách/xì bàn
                this.endGame();
            } else {
                this.render(false);
                this.updateButtons(true);
            }
        }
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
        // --- ĐÃ THÊM: LOGIC MỞ BÀI XONG MỚI RÚT ---
        if (!this.isPlayerFlipped) {
            this.isPlayerFlipped = true;
            this.render(false);
            this.updateButtons(true);
            return;
        }

        const hand = (this.mode === 'online' && this.role === 'host') ? this.dealer.hand : this.players[0].hand;
        if (hand.length >= 5) return;
        
        const newCard = this.deck.pop();
        newCard.isNew = true; 
        hand.push(newCard);
        
        const sc = this.getScore(hand);

        if (this.mode === 'online') {
            const update = (this.role === 'guest') ? { playerHand: hand, deck: this.deck } : { dealerHand: hand, deck: this.deck };
            await updateRoomState(this.roomId, update, this.role);
            if (sc >= 21 || hand.length >= 5) this.stand();
        } else {
            this.render(false);
            if (sc >= 21 || hand.length >= 5) this.stand(); else this.updateButtons(true);
        }
    }

    async stand() {
        if (this.mode === 'online') {
            if (this.role === 'guest') {
                await updateRoomState(this.roomId, { playerHand: this.players[0].hand }, "host");
            } else {
                this.dealerDone = true;
                this.endGame();
            }
        } else {
            this.dealerTurnSolo();
        }
    }

    async dealerTurnSolo() {
        this.isBusy = true;
        this.isPlayerFlipped = true; // Đảm bảo bài người chơi lật khi nhà cái đi
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

        if (winMult > 0 && this.mode === 'solo') {
            await addPoints('Casino', 'Kết quả Xì Dách', this.currentBet * winMult);
            await this.refreshPts();
        }

        if (this.mode === 'online' && this.role === 'host') {
            await updateRoomState(this.roomId, { 
                result: res, 
                gameStarted: false, 
                isDealerDone: true,
                dealerHand: this.dealer.hand 
            }, "host", "finished");
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
        hitBtn.disabled = !canPlay || (this.isPlayerFlipped && (pS >= 21 || pL >= 5));
        
        // --- ĐÃ THÊM: ĐỔI TÊN NÚT ---
        hitBtn.textContent = this.isPlayerFlipped ? "RÚT BÀI" : "MỞ BÀI";

        const hasEnough = (pS >= 16 || pL === 5);
        document.getElementById('btn-stand').disabled = !canPlay || !hasEnough || !this.isPlayerFlipped;
        document.getElementById('btn-deal').disabled = (this.mode === 'online' && this.role === 'guest') || !isGameOver;
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
                        const finalHtml = (c.isNew) ? html.replace('class=\"card', 'class=\"card card-new') : html;
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
                        // --- ĐÃ THÊM: KIỂM SOÁT ÚP BÀI NGƯỜI CHƠI ---
                        const html = renderCardUI(c, !this.isPlayerFlipped);
                        const finalHtml = (c.isNew) ? html.replace('class=\"card', 'class=\"card card-new') : html;
                        delete c.isNew;
                        return finalHtml;
                    }).join('')}
                </div>
                <div class="badge">BẠN: <span style="color:#facc15; font-size: 1.1em; font-weight: 900;">${this.isPlayerFlipped ? pS : '???'}</span> - CƯỢC: <span style="color:#38bdf8;">${this.currentBet}</span></div>
            </div>`;
    }
}

new XiDach();
