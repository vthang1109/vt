// baicao.js — Bài Cào Online (đặt cược giống Xì Dách)
import { createDeck, renderCardUI } from './cards.js';
import { auth, db } from './points.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from './points.js';
import { getActiveBuff, getPetById } from './pet.js';

class BaiCao {
    constructor() {
        this.dealer = { hand: [], score: 0, special: null, specialValue: 0, description: '', revealed: [false, false, false] };
        this.player = { hand: [], score: 0, special: null, specialValue: 0, description: '', revealed: [false, false, false] };
        this.balance = 0;
        this.currentBet = 0;
        this.cachedBuffPct = 0;
        this.phase = 'betting'; // betting | playing | result
        this.canFlip = false;
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
        this.unsubBalance = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
            if (snap.exists()) {
                this.balance = snap.data().points || 0;
                if (window.TopNav) TopNav.setPoints(this.balance);
            }
        });
    }

    async refreshBuffCache() {
        try { this.cachedBuffPct = await getActiveBuff(); } catch { this.cachedBuffPct = 0; }
    }

    bindEvents() {
        document.getElementById('btn-place-bet').addEventListener('click', () => this.placeBet());
        document.getElementById('btn-flip').addEventListener('click', () => this.revealNextPlayerCard());
    }

    // Không ghi Firestore ở đây nữa — chỉ kiểm tra điểm bằng dữ liệu cache từ onSnapshot,
    // tiền cược sẽ được tính gộp thành 1 lượt ghi net khi kết thúc ván (endRound).
    async placeBet() {
        if (this.phase !== 'betting' && this.phase !== 'result') {
            window.showToast('⏳ Không thể đặt cược lúc này', 'warn');
            return;
        }

        const amt = parseInt(document.getElementById('bc-bet-input').value);
        if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50 ⭐', 'warn'); return; }
        if (amt > this.balance) { window.showToast('Không đủ điểm!', 'error'); return; }

        this.currentBet = amt;
        this.betSettled = false;
        this.startDeal();
    }

    startDeal() {
        this.phase = 'playing';
        this.canFlip = true;
        this.player.revealed = [false, false, false];
        this.dealer.revealed = [false, false, false];
        this.player.special = null;
        this.dealer.special = null;

        document.getElementById('bc-bet-row').style.display = 'none';
        document.getElementById('bc-status').className = 'bc-status rolling zero-state';
        document.getElementById('bc-bet-stat').textContent = this.currentBet.toLocaleString('vi-VN');
        document.getElementById('bc-profit-stat').textContent = '0';
        document.getElementById('bc-profit-stat').className = 'stat-profit zero';

        const deck = createDeck();
        this.dealer.hand = [deck.pop(), deck.pop(), deck.pop()];
        this.player.hand = [deck.pop(), deck.pop(), deck.pop()];
        const dealerRes = this.calculateScore(this.dealer.hand);
        const playerRes = this.calculateScore(this.player.hand);
        Object.assign(this.dealer, dealerRes);
        Object.assign(this.player, playerRes);

        this.renderTable();
        document.getElementById('bc-status-msg').textContent = 'Lật';
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
        if (hand[0].v === hand[1].v && hand[1].v === hand[2].v) {
            special = 'SAP'; specialValue = values[0]; description = 'SÁP ' + (hand[0].v === 'A' ? 'A' : hand[0].v);
        } else if ((values[0] === 2 && values[1] === 3 && values[2] === 14) || (values[2] - values[0] === 2 && values[1] - values[0] === 1)) {
            special = 'LIENG';
            if (values[0] === 2 && values[1] === 3 && values[2] === 14) { specialValue = 0; description = 'LIÊNG A23'; }
            else { specialValue = values[2] - 3; const high = values[2]; const highName = high===14?'A':(high===13?'K':(high===12?'Q':(high===11?'J':high))); description = 'LIÊNG ' + highName; }
        } else if (isThreePictures) {
            special = 'DONG_HOA'; specialValue = 0; description = 'TIÊN';
        } else {
            special = null; specialValue = normalScore; description = normalScore + ' điểm';
        }
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
        if (!this.canFlip || this.phase !== 'playing') return;
        const idx = this.player.revealed.findIndex(r => !r);
        if (idx === -1) return;
        this.player.revealed[idx] = true;
        this.renderTable(idx, null);
        if (this.player.revealed.every(r => r)) {
            this.canFlip = false;
            document.getElementById('btn-flip').disabled = true;
            document.getElementById('bc-status-msg').textContent = 'Lật';
            await this.revealDealerCards();
        }
    }

    async revealDealerCards() {
        for (let i = 0; i < 3; i++) {
            await this.delay(700);
            this.dealer.revealed[i] = true;
            this.renderTable(null, i);
        }
        await this.delay(500);
        this.endRound();
    }

    // Ghi Firestore NGAY 1 LẦN DUY NHẤT cho cả ván: net = lời/lỗ thực tế
    // (không còn trừ cược lúc đặt + cộng thắng lúc kết thúc như trước — gộp lại thành 1 lượt ghi).
    async endRound() {
        const result = this.compareHands();
        let multiplier = 0, net = 0, buffBonus = 0, buffPct = 0, petLabel = '🐾 Pet';
        if (result === 'win') {
            multiplier = this.player.special === 'SAP' ? 4 : (this.player.special === 'LIENG' ? 3 : (this.player.special === 'DONG_HOA' ? 3 : 2));
            const profit = this.currentBet * (multiplier - 1);
            buffPct = this.cachedBuffPct;
            if (buffPct > 0) buffBonus = Math.round(profit * buffPct / 100);
            net = profit + buffBonus;
            if (window.VTQuests) { window.VTQuests.trackPlay('baicao'); window.VTQuests.trackWinSmart(); window.VTQuests.trackEarn(net); }
        } else if (result === 'lose') {
            multiplier = 0;
            net = -this.currentBet;
            if (window.VTQuests) window.VTQuests.trackPlay('baicao');
        } else {
            multiplier = 1;
            net = 0;
            if (window.VTQuests) window.VTQuests.trackPlay('baicao');
        }

        this.betSettled = true;
        if (net !== 0) {
            try {
                await addPoints('Casino', net > 0 ? 'Thắng Bài Cào' : 'Cược Bài Cào', net, false);
                if (buffBonus > 0) {
                    try {
                        const ud = await getDoc(doc(db, 'users', auth.currentUser.uid));
                        const pet = ud.data()?.activePet ? getPetById(ud.data().activePet) : null;
                        if (pet) petLabel = `${pet.emoji} ${pet.name}`;
                    } catch {}
                }
            } catch (e) {
                console.error(e);
                window.showToast('Lỗi cộng điểm: ' + e.message, 'error');
            }
        }

        const statusCls = result === 'win' ? 'result-win' : result === 'lose' ? 'result-lose' : 'result-draw';
        const msg = result === 'win' ? 'WIN' : result === 'lose' ? 'LOSE' : 'DRAW';
        document.getElementById('bc-status').className = 'bc-status ' + statusCls;
        document.getElementById('bc-status-msg').textContent = msg;
        const profitEl = document.getElementById('bc-profit-stat');
        profitEl.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
        profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');
        document.getElementById('btn-flip').style.display = 'none';
        this.renderTable(null, null, result);

        this.phase = 'betting';
        document.getElementById('bc-bet-row').style.display = 'flex';
    }

    getSpecialClass(special) {
        if (special === 'SAP') return 'sap';
        if (special === 'LIENG') return 'lieng';
        if (special === 'DONG_HOA') return 'tien';
        return 'normal';
    }

    renderEmpty() {
        document.getElementById('xd-table').innerHTML = `
            <div class="xd-seat dealer">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">👑 Nhà Cái <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards"><div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div></div>
            </div>
            <div class="xd-seat me">
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="xd-score-inline">?</span></span>
                </div>
                <div class="xd-cards"><div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div></div>
            </div>`;
    }

    renderTable(justRevealedPlayer = null, justRevealedDealer = null, result = null) {
        const p = this.player;
        const d = this.dealer;
        const allPlayerRevealed = p.revealed.every(r => r);
        const allDealerRevealed = d.revealed.every(r => r);

        const pScoreText = allPlayerRevealed
            ? (p.special ? `<span class="hand-type ${this.getSpecialClass(p.special)}">${p.description}</span>` : p.description)
            : '?';
        const dScoreText = allDealerRevealed
            ? (d.special ? `<span class="hand-type ${this.getSpecialClass(d.special)}">${d.description}</span>` : d.description)
            : '?';
        const pInlineCls = (allPlayerRevealed && p.special) ? 'xd-score-inline plain' : 'xd-score-inline';
        const dInlineCls = (allDealerRevealed && d.special) ? 'xd-score-inline plain' : 'xd-score-inline';

        let playerResultHtml = '', dealerResultHtml = '';
        if (result) {
            const pCls = result === 'win' ? 'xd-result-win' : result === 'lose' ? 'xd-result-lose' : 'xd-result-draw';
            const dCls = result === 'lose' ? 'xd-result-win' : result === 'win' ? 'xd-result-lose' : 'xd-result-draw';
            const pText = result === 'win' ? 'THẮNG' : result === 'lose' ? 'THUA' : 'HÒA';
            const dText = result === 'lose' ? 'THẮNG' : result === 'win' ? 'THUA' : 'HÒA';
            const specialBannerClass = (special) => special === 'SAP' ? 'xd-result-special' : special === 'LIENG' ? 'xd-result-lieng' : special === 'DONG_HOA' ? 'xd-result-tien' : null;
            const pSpecialCls = result === 'win' ? specialBannerClass(p.special) : null;
            const dSpecialCls = result === 'lose' ? specialBannerClass(d.special) : null;
            playerResultHtml = pSpecialCls
                ? `<div class="xd-result-overlay ${pSpecialCls}">${p.description}</div>`
                : `<div class="xd-result-overlay ${pCls}">${pText}</div>`;
            dealerResultHtml = dSpecialCls
                ? `<div class="xd-result-overlay ${dSpecialCls}">${d.description}</div>`
                : `<div class="xd-result-overlay ${dCls}">${dText}</div>`;
        }

        const dealerCardsHtml = d.hand.length
            ? d.hand.map((c, i) => {
                const hidden = !d.revealed[i];
                const html = renderCardUI(c, hidden);
                return (i === justRevealedDealer) ? html.replace('class="card', 'class="card card-flip-anim') : html;
              }).join('')
            : '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>';

        const playerCardsHtml = p.hand.length
            ? p.hand.map((c, i) => {
                const hidden = !p.revealed[i];
                const html = renderCardUI(c, hidden);
                return (i === justRevealedPlayer) ? html.replace('class="card', 'class="card card-flip-anim') : html;
              }).join('')
            : '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>';

        document.getElementById('xd-table').innerHTML = `
            <div class="xd-seat dealer">
                ${dealerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">👑 Nhà Cái <span class="${dInlineCls}">${dScoreText}</span></span>
                </div>
                <div class="xd-cards">${dealerCardsHtml}</div>
            </div>
            <div class="xd-seat me ${this.phase === 'playing' ? 'turn' : ''}">
                ${playerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="${pInlineCls}">${pScoreText}</span></span>
                </div>
                <div class="xd-cards">${playerCardsHtml}</div>
                <div class="xd-bet-badge">${this.currentBet ? '⭐ ' + this.currentBet.toLocaleString('vi-VN') : ''}</div>
            </div>`;
    }

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    // Nếu người chơi thoát/đóng tab giữa ván (đã đặt cược nhưng chưa endRound), tính thua cược.
    forfeitIfAbandoned() {
        if (this.betSettled || this.phase === 'betting') return;
        this.betSettled = true;
        addPoints('Casino', 'Bài Cào out phòng - mất cược', -this.currentBet, false).catch(() => {});
    }
}

new BaiCao();
window.addEventListener('pagehide', () => window.game?.forfeitIfAbandoned());
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());
