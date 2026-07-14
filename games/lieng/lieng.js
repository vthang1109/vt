// lieng.js — Liêng (3 lá bài so điểm + tố) — chế độ cược
import { createDeck, renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, subscribeBalance } from '../../points.js';
import { getActivePetInfo } from '../../pet.js';

class Lieng {
    constructor() {
        this.player = { hand: [], revealed: false };
        this.ai = { hand: [], revealed: false };
        this.balance = 0;
        this.currentBet = 0;
        this.cachedBuffPct = 0;
        this.cachedPet = null;
        this.phase = 'betting';
        this.betSettled = true;
        this.unsubBalance = null;
        this.initAfterAuth();
    }

    async initAfterAuth() {
        await new Promise((resolve) => {
            const unsub = onAuthStateChanged(auth, (user) => {
                unsub();
                if (user) resolve();
                else location.href = 'index.html';
            });
        });

        const style = document.createElement('style');
        style.textContent = `
            @keyframes cardAppear { 0% { transform: translateY(-30px) rotate(-8deg) scale(0.8); opacity: 0; } 100% { transform: translateY(0) rotate(0) scale(1); opacity: 1; } }
            .card.card-flip-anim { animation: flipIn 0.4s ease; }
            @keyframes flipIn { 0% { transform: rotateY(90deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0deg) scale(1); opacity: 1; } }
        `;
        document.head.appendChild(style);

        this.listenBalance();
        this.refreshBuffCache();
        this.renderEmpty();
        this.bindEvents();
        document.getElementById('bc-bet-row').style.display = 'flex';
        window.game = this;
    }

    listenBalance() {
        if (this.unsubBalance) this.unsubBalance();
        this.unsubBalance = subscribeBalance(pts => {
            this.balance = pts;
            if (window.TopNav) window.TopNav.setPoints(this.balance);
        });
    }

    async refreshBuffCache() {
        try {
            const info = await getActivePetInfo();
            this.cachedBuffPct = info.buff;
            this.cachedPet = info.pet;
        } catch { this.cachedBuffPct = 0; this.cachedPet = null; }
    }

    bindEvents() {
        document.getElementById('btn-place-bet').addEventListener('click', () => this.placeBet());
        document.getElementById('btn-check').addEventListener('click', () => this.checkCards());
        document.getElementById('btn-fold').addEventListener('click', () => this.fold());
    }

    placeBet() {
        if (this.phase !== 'betting' && this.phase !== 'result') {
            window.showToast('⏳ Không thể đặt cược lúc này', 'warn');
            return;
        }
        if (this.betSettled === false) {
            window.showToast('⏳ Đang xử lý ván trước...', 'warn');
            return;
        }

        const amt = parseInt(document.getElementById('bc-bet-input').value);
        if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50 〄', 'warn'); return; }
        if (amt > this.balance) { window.showToast('Không đủ điểm!', 'error'); return; }

        this.currentBet = amt;
        this.betSettled = false;
        this.startGame(amt);
    }

    startGame(bet) {
        this.phase = 'playing';
        this.player.revealed = false;
        this.ai.revealed = false;

        document.getElementById('bc-bet-row').style.display = 'none';
        document.getElementById('bc-status').className = 'bc-status rolling zero-state';
        document.getElementById('bc-bet-stat').textContent = this.currentBet.toLocaleString('vi-VN');
        document.getElementById('bc-profit-stat').textContent = '0';
        document.getElementById('bc-profit-stat').className = 'stat-profit zero';
        document.getElementById('bc-status-msg').textContent = 'Đang chia bài...';
        document.getElementById('lieng-actions').style.display = 'none';
        document.getElementById('lieng-info').textContent = '';

        const deck = createDeck();
        this.ai.hand = [deck.pop(), deck.pop(), deck.pop()];
        this.player.hand = [deck.pop(), deck.pop(), deck.pop()];

        this.renderTable();

        setTimeout(() => {
            if (this.phase !== 'playing') return;
            document.getElementById('bc-status-msg').textContent = 'Chọn hành động';
            document.getElementById('lieng-actions').style.display = 'flex';
        }, 500);
    }

    calculateScore(hand) {
        let total = 0;
        let allPictures = true;
        for (const card of hand) {
            const v = card.v;
            if (v === 'A') total += 1;
            else if (['J','Q','K'].includes(v)) total += 10;
            else total += parseInt(v);
            if (!['J','Q','K'].includes(v)) allPictures = false;
        }
        const normalScore = total % 10;
        const valMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
        const values = hand.map(c => valMap[c.v]).sort((a,b)=>a-b);
        const suits = hand.map(c => c.s);
        const suitRank = { '♠':1, '♣':2, '♦':3, '♥':4 };

        let special = null, specialVal = 0, description = '';

        if (hand[0].v === hand[1].v && hand[1].v === hand[2].v) {
            special = 'SAP'; specialVal = values[0]; description = `SÁP ${hand[0].v}`;
        } else if ((values[0]+1 === values[1] && values[1]+1 === values[2]) || 
                 (values[0] === 2 && values[1] === 3 && values[2] === 14)) {
            special = 'LIENG';
            const high = values[2] === 14 && values[0] === 2 ? 3 : values[2];
            specialVal = high;
            const nameMap = {14:'A',13:'K',12:'Q',11:'J'};
            const highName = nameMap[high] || high;
            description = `LIÊNG ${highName}`;
        } else if (allPictures) {
            special = 'ANH';
            specialVal = values.reduce((a,b)=>a+b,0);
            const high = values[2];
            const nameMap = {14:'A',13:'K',12:'Q',11:'J'};
            const highName = nameMap[high] || high;
            description = `ẢNH ${highName}`;
        } else {
            special = 'DIEM';
            specialVal = normalScore;
            description = `${normalScore} nút`;
        }

        const highSuit = suits.reduce((a,b) => suitRank[a] > suitRank[b] ? a : b);
        return { special, specialVal, description, highSuit };
    }

    getHandRank(res) {
        const ranks = { 'SAP':5, 'LIENG':4, 'ANH':3, 'DIEM':2 };
        return ranks[res.special] * 1000 + res.specialVal;
    }

    compareHands() {
        const pRes = this.calculateScore(this.player.hand);
        const aRes = this.calculateScore(this.ai.hand);
        const pRank = this.getHandRank(pRes);
        const aRank = this.getHandRank(aRes);
        if (pRank > aRank) return { result: 'win', pRes, aRes };
        if (pRank < aRank) return { result: 'lose', pRes, aRes };
        const suitRank = { '♠':1, '♣':2, '♦':3, '♥':4 };
        if (suitRank[pRes.highSuit] > suitRank[aRes.highSuit]) return { result: 'win', pRes, aRes };
        if (suitRank[pRes.highSuit] < suitRank[aRes.highSuit]) return { result: 'lose', pRes, aRes };
        return { result: 'draw', pRes, aRes };
    }

    async checkCards() {
        if (this.phase !== 'playing') return;
        this.phase = 'result';
        document.getElementById('lieng-actions').style.display = 'none';
        document.getElementById('bc-status-msg').textContent = 'Kết quả...';

        this.player.revealed = true;
        this.renderTable();
        await this.delay(600);

        this.ai.revealed = true;
        this.renderTable();
        await this.delay(600);

        await this.endRound();
    }

    async fold() {
        if (this.phase !== 'playing') return;
        this.phase = 'result';
        document.getElementById('lieng-actions').style.display = 'none';
        
        this.player.revealed = true;
        this.ai.revealed = true;
        this.renderTable();
        await this.delay(400);

        const net = -this.currentBet;
        this.betSettled = true;
        if (net !== 0) {
            try { await addPoints('Lieng', 'Bỏ bài Liêng', net, false); } catch {}
        }

        document.getElementById('bc-status').className = 'bc-status result-lose';
        document.getElementById('bc-status-msg').textContent = 'BỎ BÀI';
        document.getElementById('bc-profit-stat').textContent = `-${this.currentBet.toLocaleString('vi-VN')}`;
        document.getElementById('bc-profit-stat').className = 'stat-profit negative';
        document.getElementById('lieng-info').innerHTML = `😢 Bạn đã bỏ bài · Mất ${this.currentBet}đ`;

        this.phase = 'betting';
        document.getElementById('bc-bet-row').style.display = 'flex';
    }

    async endRound() {
        const { result, pRes, aRes } = this.compareHands();
        
        const pDesc = `<span class="hand-type ${pRes.special.toLowerCase()}">${pRes.description}</span>`;
        const aDesc = `<span class="hand-type ${aRes.special.toLowerCase()}">${aRes.description}</span>`;
        
        let net = 0, buffBonus = 0, bonusText = '';
        if (result === 'win') {
            const profit = this.currentBet;
            if (this.cachedBuffPct > 0) {
                buffBonus = Math.round(profit * this.cachedBuffPct / 100);
                net = profit + buffBonus;
            } else {
                net = profit;
            }
            document.getElementById('bc-status').className = 'bc-status result-win';
            document.getElementById('bc-status-msg').textContent = 'THẮNG!';
            if (window.VTQuests) { window.VTQuests.trackPlay('lieng'); window.VTQuests.trackWinSmart(); window.VTQuests.trackEarn(net); }
        } else if (result === 'lose') {
            net = -this.currentBet;
            document.getElementById('bc-status').className = 'bc-status result-lose';
            document.getElementById('bc-status-msg').textContent = 'THUA';
            if (window.VTQuests) window.VTQuests.trackPlay('lieng');
        } else {
            net = 0;
            document.getElementById('bc-status').className = 'bc-status result-draw';
            document.getElementById('bc-status-msg').textContent = 'HÒA';
            if (window.VTQuests) window.VTQuests.trackPlay('lieng');
        }

        this.betSettled = true;
        if (net !== 0) {
            try {
                await addPoints('Lieng', net > 0 ? 'Thắng Liêng' : 'Thua Liêng', net, false);
                if (buffBonus > 0 && this.cachedPet) {
                    bonusText = `+ thú cưng ${this.cachedPet.emoji} bonus ${this.cachedBuffPct}%`;
                }
            } catch {}
        }

        const profitEl = document.getElementById('bc-profit-stat');
        profitEl.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
        profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');

        const resultText = result === 'win' ? '🎉 Bạn thắng!' : result === 'lose' ? '😢 Bạn thua!' : '🤝 Hòa!';
        document.getElementById('lieng-info').innerHTML = `
            <div class="lieng-result-line">${resultText} ${bonusText}</div>
            <div class="lieng-result-line">Bạn: ${pDesc} | Máy: ${aDesc}</div>
        `;

        this.phase = 'betting';
        document.getElementById('bc-bet-row').style.display = 'flex';
    }

    renderEmpty() {
        document.getElementById('xd-table').innerHTML = `
            <div class="xd-seat dealer">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">🤖 Máy <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards"><div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div></div>
            </div>
            <div class="xd-seat me">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards"><div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div></div>
                <div class="xd-bet-badge" id="bc-bet-badge"></div>
            </div>`;
    }

    renderTable() {
        const pCardHtml = this.player.hand.length
            ? this.player.hand.map(c => renderCardUI(c, !this.player.revealed)).join('')
            : '<div style="color:#64748b">Chưa có bài</div>';
        const aCardHtml = this.ai.hand.length
            ? this.ai.hand.map(c => renderCardUI(c, !this.ai.revealed)).join('')
            : '<div style="color:#64748b">Chưa có bài</div>';

        document.getElementById('xd-table').innerHTML = `
            <div class="xd-seat dealer">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">🤖 Máy <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards">${aCardHtml}</div>
            </div>
            <div class="xd-seat me">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards">${pCardHtml}</div>
                <div class="xd-bet-badge">${this.currentBet ? this.currentBet.toLocaleString('vi-VN') + ' 〄' : ''}</div>
            </div>`;
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    forfeitIfAbandoned() {
        if (this.betSettled || this.phase === 'betting') return;
        this.betSettled = true;
        addPoints('Lieng', 'Liêng out phòng - mất cược', -this.currentBet, false).catch(() => {});
    }
}

new Lieng();
window.addEventListener('pagehide', () => { window.game?.forfeitIfAbandoned(); window.game?.unsubBalance?.(); });
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());
