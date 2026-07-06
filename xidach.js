// xidach.js — Xì Dách Offline (Máy cầm cái, luật mới)
import { createDeck, renderCardUI } from './cards.js';
import { auth, db } from './points.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from './points.js';
class XiDach {
    constructor() {
        this.deck = [];
        this.dealer = { hand: [] };
        this.players = [{ hand: [], result: '' }];
        this.balance = 0;
        this.currentBet = 0;
        this.dealerDone = false;
        this.isBusy = false;
        this.isPlayerFlipped = false;
        this.phase = 'betting';
        this.dealerResult = '';
        this.unsubBalance = null;
        this.betSettled = true;
        this.cachedBuffPct = 0;
        this.cachedPetLabel = '🐾 Pet';
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
            .card-new { animation: cardAppear 0.4s ease-out forwards; }
            @keyframes cardAppear {
                0% { transform: translateY(-50px) rotate(-10deg); opacity: 0; }
                100% { transform: translateY(0) rotate(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        this.listenBalance();
        this.refreshBuffCache();
        window.game = this;

        document.getElementById('xd-bet-row').style.display = 'flex';
        this.updateStatusBar('--', null);
    }

    listenBalance() {
        if (this.unsubBalance) this.unsubBalance();
        this.unsubBalance = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
            if (snap.exists()) {
                this.balance = snap.data().points || 0;
            }
        });
    }

    async refreshBuffCache() {
        try {
            const { getPetData, getPetById, getTierById } = await import('./pet.js');
            const d = await getPetData();
            const pet = d.activePet ? getPetById(d.activePet) : null;
            this.cachedBuffPct = pet ? (getTierById(pet.tier).buff || 0) : 0;
            this.cachedPetLabel = pet ? `${pet.emoji} ${pet.name}` : '🐾 Pet';
        } catch {
            this.cachedBuffPct = 0;
            this.cachedPetLabel = '🐾 Pet';
        }
    }

    // ========== CẬP NHẬT STATUS BAR: [tổng cược] [thông báo + chi tiết] [lời-lỗ] ==========
    updateStatusBar(mid, net, sub = '') {
        const betEl = document.getElementById('xd-bet');
        const scoreEl = document.getElementById('xd-score');
        const subEl = document.getElementById('xd-score-sub');
        const profitEl = document.getElementById('xd-profit');
        const statusEl = document.getElementById('bc-status');

        // Rút gọn nhãn hiển thị trên status bar: chỉ Thắng/Thua/Hoà, không hiện tên đặc biệt (Xì Bàn, Xì Dách, Ngũ Linh, Quắc...)
        const winLabels = ['THẮNG', 'XÌ BÀN', 'XÌ DÁCH', 'NGŨ LINH'];
        const loseLabels = ['THUA', 'QUẮC'];
        let displayMid = mid;
        let resultKind = null; // 'win' | 'lose' | 'draw' | null
        if (winLabels.includes(mid)) { displayMid = 'WIN'; resultKind = 'win'; }
        else if (loseLabels.includes(mid)) { displayMid = 'LOSE'; resultKind = 'lose'; }
        else if (mid === 'HÒA') { displayMid = 'DRAW'; resultKind = 'draw'; }

        if (betEl) betEl.textContent = this.currentBet > 0 ? this.currentBet.toLocaleString('vi-VN') : '0';
        if (scoreEl) scoreEl.textContent = displayMid;
        if (subEl) subEl.textContent = sub;

        if (profitEl) {
            if (net === null) {
                profitEl.textContent = '+0';
                profitEl.className = 'stat-profit zero';
            } else if (net > 0) {
                profitEl.textContent = `+${net.toLocaleString('vi-VN')}`;
                profitEl.className = 'stat-profit positive';
            } else if (net < 0) {
                profitEl.textContent = `${net.toLocaleString('vi-VN')}`;
                profitEl.className = 'stat-profit negative';
            } else {
                profitEl.textContent = 'Huề';
                profitEl.className = 'stat-profit zero';
            }
        }

        if (statusEl) {
            statusEl.classList.remove('result-win', 'result-lose', 'result-draw', 'result-jackpot');
            if (resultKind === 'win') statusEl.classList.add('result-win');
            else if (resultKind === 'lose') statusEl.classList.add('result-lose');
            else if (resultKind === 'draw') statusEl.classList.add('result-draw');
        }
    }

    async placeBet() {
        if (this.isBusy) {
            window.showToast('⏳ Đang xử lý ván trước...', 'warn');
            return;
        }
        if (this.phase !== 'betting' && this.phase !== 'result') {
            window.showToast('⏳ Không thể đặt cược lúc này', 'warn');
            return;
        }

        const amt = parseInt(document.getElementById('xd-bet-input').value);
        if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50 ⭐', 'warn'); return; }
        if (amt > this.balance) { window.showToast('Không đủ điểm!', 'error'); return; }

        this.currentBet = amt;
        this.betSettled = false;
        try {
            // Bắt đầu ván mới
            await this.startDeal();
        } catch (e) {
            console.error(e);
            window.showToast('Lỗi chia bài: ' + e.message, 'error');
            // Khôi phục trạng thái
            this.phase = 'betting';
            document.getElementById('xd-bet-row').style.display = 'flex';
        }
    }

    async startDeal() {
        if (this.isBusy) return;
        if (this.balance < 50) { window.showToast('Không đủ điểm!', 'error'); return; }

        this.isBusy = true;
        this.dealerDone = false;
        this.isPlayerFlipped = false;
        this.players[0].result = '';
        this.dealerResult = '';
        this.phase = 'playing';

        // Ẩn ô cược
        document.getElementById('xd-bet-row').style.display = 'none';
        this.updateStatusBar('Đang chia bài', null);
        document.getElementById('bc-status')?.classList.add('rolling');

        try {
            // Tạo bộ bài mới
            this.deck = createDeck();
            if (!this.deck || this.deck.length < 4) {
                throw new Error('Bộ bài không đủ lá');
            }
            this.dealer.hand = [this.deck.pop(), this.deck.pop()];
            this.players[0].hand = [this.deck.pop(), this.deck.pop()];

            if (this.checkSpecials(this.dealer.hand) || this.checkSpecials(this.players[0].hand)) {
                this.dealerDone = true;
                this.isPlayerFlipped = true;
                this.phase = 'result';
                this.endGame();
            } else {
                this.render();
                this.updateButtons(true);
                this.updateStatusBar('Bạn', null, 'Bài úp');
                document.getElementById('bc-status')?.classList.remove('rolling');
            }
        } catch (e) {
            console.error('Lỗi khi chia bài:', e);
            window.showToast('Lỗi chia bài, thử lại', 'error');
            // Quay về betting
            this.phase = 'betting';
            document.getElementById('xd-bet-row').style.display = 'flex';
        } finally {
            this.isBusy = false;
        }
    }

    getScore(hand) {
        if (!hand || hand.length === 0) return 0;
        let total = 0, aces = 0;
        for (const c of hand) {
            if (c.v === 'A') aces++;
            else if (['J','Q','K'].includes(c.v)) total += 10;
            else total += parseInt(c.v);
        }
        if (hand.length === 2 && aces === 2) return 21;
        const possible = hand.length <= 3 ? [1,10,11] : [1];
        let best = 0;
        const tryAces = (idx, sum) => {
            if (idx === aces) {
                if (sum <= 21 && sum > best) best = sum;
                else if (sum > 21 && (best === 0 || sum < best)) best = sum;
                return;
            }
            for (const v of possible) tryAces(idx+1, sum+v);
        };
        tryAces(0, total);
        return best;
    }

    checkSpecials(hand) {
        if (hand.length !== 2) return null;
        const v = [hand[0].v, hand[1].v];
        if (v[0] === 'A' && v[1] === 'A') return 'xi_bang';
        const isHigh = (val) => ['10','J','Q','K'].includes(val);
        if ((v[0] === 'A' && isHigh(v[1])) || (v[1] === 'A' && isHigh(v[0]))) return 'xi_dach';
        return null;
    }

    getHandStatus(hand) {
        const score = this.getScore(hand);
        const len = hand.length;
        if (len === 2 && hand[0].v === 'A' && hand[1].v === 'A') return { score, tag: 'xi_bang' };
        if (len === 2) {
            const hasA = hand.some(c => c.v === 'A');
            const hasTen = hand.some(c => ['10','J','Q','K'].includes(c.v));
            if (hasA && hasTen) return { score: 21, tag: 'xi_dach' };
        }
        if (len === 5 && score <= 21) return { score, tag: 'ngu_linh' };
        if (score > 21) return { score, tag: 'bust' };
        return { score, tag: 'ok' };
    }

    async hit() {
        if (!this.isPlayerFlipped) {
            this.isPlayerFlipped = true;
            this.render();
            this.updateButtons(true);
            this.updateStatusBar('Bạn', null, `Điểm: ${this.getScore(this.players[0].hand)}`);
            return;
        }
        const hand = this.players[0].hand;
        if (hand.length >= 5) return;
        if (this.deck.length === 0) {
            window.showToast('Bộ bài đã hết!', 'warn');
            await this.stand();
            return;
        }
        const newCard = this.deck.pop();
        if (!newCard) {
            await this.stand();
            return;
        }
        newCard.isNew = true;
        hand.push(newCard);
        this.render();
        this.updateStatusBar('Bạn', null, `Điểm: ${this.getScore(hand)}`);
        if (this.getScore(hand) >= 21 || hand.length >= 5) await this.stand();
        else this.updateButtons(true);
    }

    async stand() {
        this.isPlayerFlipped = true;
        this.phase = 'dealer';
        this.updateStatusBar('Nhà cái', null, `Bạn: ${this.getScore(this.players[0].hand)}`);
        document.getElementById('bc-status')?.classList.add('rolling');
        this.updateButtons(false);
        await new Promise(r => setTimeout(r, 1000));
        await this.dealerTurn();
    }

    async dealerTurn() {
        this.isBusy = true;
        this.render(true);

        let safety = 0;
        while (this.deck.length > 0 && this.getScore(this.dealer.hand) < 15 && this.dealer.hand.length < 5) {
            const card = this.deck.pop();
            if (!card) break;
            card.isNew = true;
            this.dealer.hand.push(card);
            this.render(true);
            await new Promise(r => setTimeout(r, 800));
            safety++;
            if (safety > 20) break;
        }

        this.dealerDone = true;
        this.phase = 'result';
        this.endGame();
    }

    async endGame() {
        const dStat = this.getHandStatus(this.dealer.hand);
        const pStat = this.getHandStatus(this.players[0].hand);

        let res = '', delta = 0;

        if (pStat.tag === 'bust') {
            res = 'QUẮC';
            delta = 0;
            this.dealerResult = 'THẮNG';
        }
        else if (pStat.tag === 'xi_bang' && dStat.tag !== 'xi_bang') {
            res = 'XÌ BÀN';
            delta = this.currentBet * 2;
        }
        else if (pStat.tag === 'xi_dach' && dStat.tag !== 'xi_dach' && dStat.tag !== 'xi_bang') {
            res = 'XÌ DÁCH';
            delta = this.currentBet * 2;
        }
        else if (dStat.tag === 'xi_bang' || dStat.tag === 'xi_dach') {
            res = 'THUA';
            delta = 0;
        }
        else if (pStat.tag === 'ngu_linh' && dStat.tag !== 'ngu_linh') {
            res = 'NGŨ LINH';
            delta = this.currentBet * 2;
        }
        else if (dStat.tag === 'ngu_linh' && pStat.tag !== 'ngu_linh') {
            res = 'THUA';
            delta = 0;
        }
        else if (dStat.tag === 'bust') {
            res = 'THẮNG';
            delta = this.currentBet * 2;
        }
        else if (pStat.score > dStat.score) {
            res = 'THẮNG';
            delta = this.currentBet * 2;
        }
        else if (pStat.score < dStat.score) {
            res = 'THUA';
            delta = 0;
        }
        else {
            res = 'HÒA';
            delta = this.currentBet;
        }

        this.players[0].result = res;

        if (!this.dealerResult) {
            if (dStat.tag === 'xi_bang') this.dealerResult = 'XÌ BÀN';
            else if (dStat.tag === 'xi_dach') this.dealerResult = 'XÌ DÁCH';
            else if (dStat.tag === 'ngu_linh') this.dealerResult = 'NGŨ LINH';
            else if (dStat.tag === 'bust') this.dealerResult = 'QUẮC';
            else {
                if (res === 'THẮNG' || res === 'XÌ BÀN' || res === 'XÌ DÁCH' || res === 'NGŨ LINH') this.dealerResult = 'THUA';
                else if (res === 'THUA' || res === 'QUẮC') this.dealerResult = 'THẮNG';
                else this.dealerResult = 'HÒA';
            }
        }

        let buffBonus = 0;
        const buffPct = this.cachedBuffPct || 0;
        if (delta > this.currentBet && buffPct > 0) {
            buffBonus = Math.round((delta - this.currentBet) * buffPct / 100);
        }

        const net = delta - this.currentBet + buffBonus;
        this.betSettled = true;
        if (net !== 0) {
            try {
                await addPoints('Casino', net > 0 ? 'Thắng Xì Dách' : 'Cược Xì Dách', net, false);
                if (buffBonus > 0) {
                    window.showToast(`${this.cachedPetLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
                }
            } catch(e){}
        }

        this.render(true);
        this.updateButtons(false);

        document.getElementById('bc-status')?.classList.remove('rolling');
        this.updateStatusBar(res, net, `Điểm: ${pStat.score}`);

        this.isBusy = false;
        this.phase = 'betting';
        document.getElementById('xd-bet-row').style.display = 'flex';
    }

    // ==================== RENDER (ĐÃ SỬA LỖI NHẢY) ====================
    render(showDealer = false) {
        const dScore = this.getScore(this.dealer.hand);
        const dStat = this.getHandStatus(this.dealer.hand);
        const p = this.players[0];
        const pScore = this.getScore(p.hand);

        let dealerResultHtml = '';
        if (this.dealerDone || this.phase === 'result') {
            const dRes = this.dealerResult;
            if (dRes === 'XÌ BÀN' || dRes === 'XÌ DÁCH' || dRes === 'NGŨ LINH') {
                dealerResultHtml = `<div class="xd-result-overlay xd-result-special">${dRes}</div>`;
            } else if (dRes === 'QUẮC') {
                dealerResultHtml = '<div class="xd-result-overlay xd-result-bust">QUẮC</div>';
            } else if (dRes === 'THẮNG') {
                dealerResultHtml = '<div class="xd-result-overlay xd-result-win">THẮNG</div>';
            } else if (dRes === 'THUA') {
                dealerResultHtml = '<div class="xd-result-overlay xd-result-lose">THUA</div>';
            } else if (dRes === 'HÒA') {
                dealerResultHtml = '<div class="xd-result-overlay xd-result-draw">HÒA</div>';
            }
        }

        let playerResultHtml = '';
        if (p.result) {
            if (p.result === 'XÌ BÀN' || p.result === 'XÌ DÁCH' || p.result === 'NGŨ LINH') {
                playerResultHtml = `<div class="xd-result-overlay xd-result-special">${p.result}</div>`;
            } else if (p.result === 'QUẮC') {
                playerResultHtml = '<div class="xd-result-overlay xd-result-bust">QUẮC</div>';
            } else if (p.result === 'THẮNG') {
                playerResultHtml = '<div class="xd-result-overlay xd-result-win">THẮNG</div>';
            } else if (p.result === 'THUA') {
                playerResultHtml = '<div class="xd-result-overlay xd-result-lose">THUA</div>';
            } else if (p.result === 'HÒA') {
                playerResultHtml = '<div class="xd-result-overlay xd-result-draw">HÒA</div>';
            }
        }

        const tableEl = document.getElementById('xd-table');
        tableEl.innerHTML = `
            <div class="xd-seat dealer">
                ${dealerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">👑 Nhà Cái <span class="xd-score-inline">${showDealer || this.dealerDone ? dScore : '?'}</span></span>
                </div>
                <div class="xd-cards">
                    ${this.dealer.hand.length ? this.dealer.hand.map((c, i) => {
                        const shouldHide = !showDealer && !this.dealerDone;
                        const html = renderCardUI(c, shouldHide);
                        const finalHtml = c.isNew ? html.replace('class="card', 'class="card card-new') : html;
                        delete c.isNew;
                        return finalHtml;
                    }).join('') : '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>'}
                </div>
            </div>

            <div class="xd-seat me ${this.phase === 'playing' ? 'turn' : ''}">
                ${playerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="xd-score-inline">${this.isPlayerFlipped || this.phase === 'result' ? pScore : '?'}</span></span>
                </div>
                <div class="xd-cards">
                    ${p.hand.length ? p.hand.map((c, i) => {
                        const shouldHide = !this.isPlayerFlipped && this.phase !== 'result';
                        const html = renderCardUI(c, shouldHide);
                        const finalHtml = c.isNew ? html.replace('class="card', 'class="card card-new') : html;
                        delete c.isNew;
                        return finalHtml;
                    }).join('') : '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>'}
                </div>
                <div class="xd-bet-badge">${this.currentBet ? this.currentBet.toLocaleString('vi-VN') + 'đ' : ''}</div>
            </div>
        `;
    }

    updateButtons(canPlay) {
        const isPlayingPhase = this.phase === 'playing' && !this.players[0].result;
        document.getElementById('btn-hit').style.display = isPlayingPhase ? 'inline-block' : 'none';
        document.getElementById('btn-stand').style.display = isPlayingPhase ? 'inline-block' : 'none';

        if (canPlay && this.phase === 'playing') {
            const pScore = this.getScore(this.players[0].hand);
            const pLen = this.players[0].hand.length;
            const hitBtn = document.getElementById('btn-hit');
            hitBtn.disabled = (this.isPlayerFlipped && (pScore >= 21 || pLen >= 5));
            hitBtn.textContent = this.isPlayerFlipped ? 'RÚT BÀI' : 'MỞ BÀI';
            document.getElementById('btn-stand').disabled = !this.isPlayerFlipped || !(pScore >= 16 || pLen === 5);
        }
    }

    quit() {
        if (confirm('Bạn muốn rời game?')) {
            if (this.unsubBalance) this.unsubBalance();
            location.href = 'games.html';
        }
    }

    forfeitIfAbandoned() {
        if (this.betSettled || this.phase === 'betting') return;
        this.betSettled = true;
        addPoints('Casino', 'Xì Dách out phòng - mất cược', -this.currentBet, false).catch(() => {});
    }
}

new XiDach();
window.addEventListener('pagehide', () => window.game?.forfeitIfAbandoned());
window.addEventListener('beforeunload', () => window.game?.forfeitIfAbandoned());
