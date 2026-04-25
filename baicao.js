import { createDeck, renderCardUI } from './cards.js';
import { addPoints, getPoints } from './points.js';

class BaiCao {
    constructor() {
        this.mode = 'solo';
        this.dealer = { hand: [], score: 0, special: null, specialValue: 0, description: '', revealed: [false, false, false] };
        this.player = { hand: [], score: 0, special: null, specialValue: 0, description: '', revealed: [false, false, false] };
        this.balance = 0;
        this.currentBet = 0;
        this.roundActive = false;
        this.canFlip = false;
        this.init();
    }

    async init() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes cardAppear { 0% { transform: translateY(-30px) rotate(-8deg) scale(0.8); opacity: 0; } 100% { transform: translateY(0) rotate(0) scale(1); opacity: 1; } }
            .card.flipping { animation: flipCard 0.4s ease-in-out; }
            @keyframes flipCard { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0deg); } }
            .card.card-flip-anim { animation: flipIn 0.4s ease; }
            @keyframes flipIn { 0% { transform: rotateY(90deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0deg) scale(1); opacity: 1; } }
            .hand { display: flex; gap: 10px; justify-content: center; min-height: 140px; align-items: center; flex-wrap: wrap; }
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
        document.getElementById('btn-flip').addEventListener('click', () => this.revealNextPlayerCard());
        document.getElementById('btn-deal').addEventListener('click', () => this.startNewRound());
        const betOverlay = document.getElementById('bet-selector');
        if (betOverlay) betOverlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
    }

    async refreshPts() {
        this.balance = await getPoints();
        const el = document.getElementById('nav-pts');
        if (el) el.textContent = '⭐ ' + this.balance.toLocaleString();
    }

    showModes() { document.getElementById('mode-selector').classList.add('active'); }

    setMode(m) {
        this.mode = m;
        document.getElementById('mode-selector').classList.remove('active');
        this.showBetOverlay();
    }

    async showBetOverlay() {
        await this.refreshPts();
        document.getElementById('current-balance').textContent = `Số dư: ⭐ ${this.balance.toLocaleString()}`;
        document.getElementById('bet-selector').classList.add('active');
        document.getElementById('status-msg').textContent = 'HÃY ĐẶT CƯỢC';
        document.getElementById('btn-deal').disabled = true;
        document.getElementById('btn-flip').style.display = 'none';
        const lastBet = localStorage.getItem('baicao_last_bet');
        document.querySelectorAll('.bet-opt').forEach(btn => {
            const amtAttr = btn.getAttribute('data-amount');
            btn.classList.remove('active-bet');
            if (lastBet && amtAttr === lastBet) btn.classList.add('active-bet');
            else if (lastBet === 'all' && amtAttr === 'all') btn.classList.add('active-bet');
        });
    }

    async placeBet(amount) {
        if (amount === 'all') amount = this.balance;
        if (amount > this.balance || amount <= 0) return alert('Số dư không đủ!');
        this.currentBet = amount;
        document.getElementById('bet-selector').classList.remove('active');
        localStorage.setItem('baicao_last_bet', amount);
        await addPoints('Casino', 'Cược Bài Cào', -amount);
        await this.refreshPts();
        this.startDeal();
    }

    async startNewRound() {
        if (this.roundActive) return;
        document.getElementById('bet-selector').classList.remove('active');
        const lastBet = localStorage.getItem('baicao_last_bet');
        if (lastBet) {
            let betAmount = lastBet === 'all' ? this.balance : parseInt(lastBet);
            if (isNaN(betAmount) || betAmount <= 0) { this.showBetOverlay(); return; }
            if (betAmount > this.balance) { alert('Không đủ điểm để cược lại mức cũ. Vui lòng chọn mức mới.'); this.showBetOverlay(); return; }
            this.currentBet = betAmount;
            await addPoints('Casino', 'Cược Bài Cào', -betAmount);
            await this.refreshPts();
            this.startDeal();
        } else { this.showBetOverlay(); }
    }

    startDeal() {
        if (this.roundActive) return;
        this.roundActive = true;
        this.canFlip = true;
        this.player.revealed = [false, false, false];
        this.dealer.revealed = [false, false, false];
        this.player.special = null;
        this.dealer.special = null;
        const deck = createDeck();
        this.dealer.hand = [deck.pop(), deck.pop(), deck.pop()];
        this.player.hand = [deck.pop(), deck.pop(), deck.pop()];
        const dealerRes = this.calculateScore(this.dealer.hand);
        const playerRes = this.calculateScore(this.player.hand);
        Object.assign(this.dealer, dealerRes);
        Object.assign(this.player, playerRes);
        this.renderBoth();
        document.getElementById('status-msg').textContent = '🎴 Hãy lật từng lá để khám phá!';
        document.getElementById('btn-deal').disabled = true;
        document.getElementById('btn-flip').style.display = 'inline-block';
        document.getElementById('btn-flip').disabled = false;
    }

    calculateScore(hand) {
        let total = 0;
        let isThreePictures = true;
        for (let card of hand) {
            const v = card.v;
            if (v === 'A') total += 1;
            else if (['J','Q','K'].includes(v)) total += 10;
            else total += parseInt(v);
            if (!['J','Q','K'].includes(v)) isThreePictures = false;
        }
        const normalScore = total % 10;
        const valueMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
        const values = hand.map(c => valueMap[c.v]).sort((a,b)=>a-b);
        let special = null, specialValue = 0, description = '';
        if (hand[0].v === hand[1].v && hand[1].v === hand[2].v) { special = 'SAP'; specialValue = values[0]; description = 'SÁP ' + (hand[0].v === 'A' ? 'A' : hand[0].v); }
        else if ((values[0] === 2 && values[1] === 3 && values[2] === 14) || (values[2] - values[0] === 2 && values[1] - values[0] === 1)) {
            special = 'LIENG';
            if (values[0] === 2 && values[1] === 3 && values[2] === 14) { specialValue = 0; description = 'LIÊNG A23'; }
            else { specialValue = values[2] - 3; const high = values[2]; const highName = high === 14 ? 'A' : (high === 13 ? 'K' : (high === 12 ? 'Q' : (high === 11 ? 'J' : high))); description = 'LIÊNG ' + highName; }
        }
        else if (isThreePictures) { special = 'DONG_HOA'; specialValue = 0; description = 'ĐỒNG HOA'; }
        else { special = null; specialValue = normalScore; description = normalScore + ' điểm'; }
        return { score: normalScore, special, specialValue, description };
    }

    getHandRank(special, specialValue) {
        if (special === 'SAP') return 2000 + specialValue;
        if (special === 'LIENG') return 1000 + specialValue;
        if (special === 'DONG_HOA') return 900;
        return specialValue;
    }

    compareHands() {
        const pRank = this.getHandRank(this.player.special, this.player.specialValue);
        const dRank = this.getHandRank(this.dealer.special, this.dealer.specialValue);
        if (pRank > dRank) return 'win';
        if (pRank < dRank) return 'lose';
        return 'draw';
    }

    async revealNextPlayerCard() {
        if (!this.canFlip || !this.roundActive) return;
        const idx = this.player.revealed.findIndex(r => !r);
        if (idx === -1) return;
        this.player.revealed[idx] = true;
        this.renderPlayer(idx);
        if (this.player.revealed.every(r => r)) {
            this.canFlip = false;
            document.getElementById('btn-flip').disabled = true;
            document.getElementById('status-msg').textContent = '🃏 Đã mở hết bài của bạn! Đang xem nhà cái...';
            await this.revealDealerCards();
        }
    }

    async revealDealerCards() {
        for (let i = 0; i < 3; i++) { await this.delay(700); this.dealer.revealed[i] = true; this.renderDealer(i); }
        await this.delay(500);
        this.endRound();
    }

    async endRound() {
        const result = this.compareHands();
        let multiplier = 0, msg = '';
        if (result === 'win') {
            multiplier = this.player.special === 'SAP' ? 4 : (this.player.special === 'LIENG' ? 3 : (this.player.special === 'DONG_HOA' ? 3 : 2));
            msg = `🎉 ${this.player.description} – Thắng!`;
            await addPoints('Casino', 'Thắng Bài Cào', this.currentBet * multiplier);
            if (window.VTQuests) { window.VTQuests.trackPlay('baicao'); window.VTQuests.trackWinSmart(); window.VTQuests.trackEarn(this.currentBet * (multiplier - 1)); }
        } else if (result === 'lose') { multiplier = 0; msg = `💸 ${this.player.description} – Thua`; if (window.VTQuests) window.VTQuests.trackPlay('baicao'); }
        else { multiplier = 1; msg = `🤝 ${this.player.description} – Hòa`; await addPoints('Casino', 'Hòa Bài Cào', this.currentBet); if (window.VTQuests) window.VTQuests.trackPlay('baicao'); }
        await this.refreshPts();
        document.getElementById('status-msg').textContent = msg + ' | Nhấn VÁN MỚI để tiếp';
        document.getElementById('btn-deal').disabled = false;
        document.getElementById('btn-flip').style.display = 'none';
        this.roundActive = false;
        this.showResultOverlay(result);
    }

    getSpecialClass(special) { if (special === 'SAP') return 'sap'; if (special === 'LIENG') return 'lieng'; if (special === 'DONG_HOA') return 'donghoa'; return 'normal'; }

    renderBoth() { this.renderDealer(null); this.renderPlayer(null); }
    renderPlayer(justRevealedIdx) { this._renderHand('game-table', this.player, 'BẠN', false, justRevealedIdx); }
    renderDealer(justRevealedIdx) { this._renderHand('dealer-section', this.dealer, 'NHÀ CÁI', true, justRevealedIdx); }

    _renderHand(containerId, entity, label, isDealer, justRevealedIdx) {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = `<div class="player-hand active" style="border: 2px solid ${isDealer ? '#ef4444' : '#0ea5e9'}; background: rgba(${isDealer ? '239,68,68' : '14,165,233'}, 0.05);"><div class="hand">`;
        entity.hand.forEach((card, i) => {
            const isRevealed = entity.revealed[i];
            let cardHtml = renderCardUI(card, !isRevealed);
            if (isRevealed && i === justRevealedIdx) cardHtml = cardHtml.replace('class="card', 'class="card card-flip-anim');
            html += cardHtml;
        });
        const allRevealed = entity.revealed.every(r => r);
        const specialClass = allRevealed ? this.getSpecialClass(entity.special) : 'normal';
        const scoreDisplay = allRevealed ? `<span class="hand-type ${specialClass}">${entity.description}</span>` : '<span class="hand-type normal">???</span>';
        html += `</div><div class="badge ${isDealer ? 'dealer' : ''}">${label}: ${scoreDisplay}</div></div>`;
        container.innerHTML = html;
    }

    showResultOverlay(result) {
        const playerEl = document.querySelector('#game-table .player-hand');
        const dealerEl = document.querySelector('#dealer-section .player-hand');
        [playerEl, dealerEl].forEach(el => { if (el) { const old = el.querySelector('.result-overlay'); if (old) old.remove(); el.style.position = 'relative'; } });
        const pRank = this.getHandRank(this.player.special, this.player.specialValue);
        const dRank = this.getHandRank(this.dealer.special, this.dealer.specialValue);
        const playerWins = pRank > dRank, dealerWins = dRank > pRank;
        const pText = this.player.description, dText = this.dealer.description;
        const pSpecialClass = this.player.special ? this.getSpecialClass(this.player.special) : '';
        const dSpecialClass = this.dealer.special ? this.getSpecialClass(this.dealer.special) : '';
        const playerCls = playerWins ? (pSpecialClass || 'result-win') : (dealerWins ? 'result-lose' : 'result-draw');
        const dealerCls = dealerWins ? (dSpecialClass || 'result-win') : (playerWins ? 'result-lose' : 'result-draw');
        this.addOverlayTo(playerEl, pText, playerCls);
        this.addOverlayTo(dealerEl, dText, dealerCls);
    }

    addOverlayTo(parent, text, className) {
        if (!parent) return;
        const overlay = document.createElement('div');
        overlay.className = `result-overlay ${className}`;
        overlay.textContent = text;
        parent.appendChild(overlay);
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

new BaiCao();