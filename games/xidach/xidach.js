// xidach.js — Xì Dách Offline (Máy cầm cái, luật mới)
import { createDeck, renderCardUI } from '../../cards.js';
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, subscribeBalance } from '../../points.js';
import { getActiveBuff } from '../../pet.js';
class XiDach {
    constructor() {
        this.deck = [];
        this.dealer = { hand: [] };
        this.players = [{ hand: [], result: '' }];
        this.botPlayers = [];
        this.balance = 0;
        this.currentBet = 0;
        this.mode = 'player';
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

        // Chip selection on menu
        document.querySelectorAll('.xd-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.xd-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('xd-bet-input').value = btn.dataset.amt;
            });
        });

        // Play button on menu
        document.getElementById('xd-play-btn').addEventListener('click', () => this.startGame());

        // Mode toggle
        document.querySelectorAll('.xd-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.xd-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
            });
        });

        // Game action buttons (hit / stand)
        document.getElementById('btn-hit').addEventListener('click', () => this.hit());
        document.getElementById('btn-stand').addEventListener('click', () => this.stand());

        this.listenBalance();
        this.refreshBuffCache();
        window.game = this;
    }

    async startGame() {
        // Đọc tiền cược từ menu
        const amt = parseInt(document.getElementById('xd-bet-input').value);
        if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50 ⭐', 'warn'); return; }
        if (amt > this.balance) { window.showToast('Không đủ điểm!', 'error'); return; }

        this.currentBet = amt;
        this.betSettled = false;

        // Ẩn menu, hiện game
        document.getElementById('xd-menu').classList.remove('active');
        document.getElementById('xd-menu').style.display = 'none';
        document.getElementById('xd-game').classList.add('active');
        document.getElementById('xd-game').style.display = 'flex';

        // Gắn sự kiện cho nút đặt cược (chỉ gắn 1 lần) cho các lượt sau
        const betBtn = document.getElementById('xd-bet-btn');
        if (betBtn && !betBtn._listener) {
            betBtn._listener = true;
            betBtn.onclick = () => this.placeBet();
        }

        // Pre-populate game bet input with menu's amount
        const gameInput = document.getElementById('xd-game-bet-input');
        if (gameInput) gameInput.value = amt;

        this.updateStatusBar('--', null);
        // Deal bài ngay từ lượt đầu
        await this.startDeal();
    }

    listenBalance() {
        if (this.unsubBalance) this.unsubBalance();
        this.unsubBalance = subscribeBalance(pts => { this.balance = pts; });
    }

    async refreshBuffCache() {
        try {
            const { getPetData, getPetById, getTierById } = await import('../../pet.js');
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

        const amt = parseInt(document.getElementById('xd-game-bet-input').value);
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

    // ========== BOT AI ==========
    botShouldHit(bot) {
        const score = this.getScore(bot.hand);
        const len = bot.hand.length;
        if (len >= 5) return false;
        // Luật Xì Dách: dưới 16 điểm bắt buộc phải rút
        if (score >= 16) return false;
        return true;
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

        try {
            this.deck = createDeck();
            if (!this.deck || this.deck.length < 4) throw new Error('Bộ bài không đủ lá');

            if (this.mode === 'dealer') {
                await this.dealerModeDeal();
            } else {
                await this.playerModeDeal();
            }
        } catch (e) {
            console.error('Lỗi khi chia bài:', e);
            window.showToast('Lỗi chia bài, thử lại', 'error');
            this.phase = 'betting';
            document.getElementById('xd-bet-row').style.display = 'flex';
        } finally {
            this.isBusy = false;
        }
    }

    async playerModeDeal() {
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
        }
    }

    async dealerModeDeal() {
        // Bot names
        const botNames = ['🤖 Bot 1', '🤖 Bot 2', '🤖 Bot 3'];
        this.botPlayers = botNames.map(name => ({ name, hand: [], result: '', bet: this.currentBet, checked: false }));

        // Dealer (player) gets 2 cards
        this.dealer = { hand: [this.deck.pop(), this.deck.pop()] };

        // Each bot gets 2 cards
        for (const bot of this.botPlayers) {
            bot.hand = [this.deck.pop(), this.deck.pop()];
        }

        this.render();
        await new Promise(r => setTimeout(r, 600));

        // Check dealer specials first (Xi Bàn / Xi Dách)
        const dSpec = this.checkSpecials(this.dealer.hand);
        if (dSpec) {
            // Dealer has Xi Bàn or Xi Dách — immediate result
            this.dealerDone = true;
            this.dealerResult = dSpec === 'xi_bang' ? 'XÌ BÀN' : 'XÌ DÁCH';
            this.phase = 'result';
            this.endGame();
            return;
        }

        // Check each bot for specials
        let botsToPlay = [];
        for (const bot of this.botPlayers) {
            const spec = this.checkSpecials(bot.hand);
            if (spec) {
                bot.result = spec === 'xi_bang' ? 'XÌ BÀN' : 'XÌ DÁCH';
                bot.checked = true;
            } else {
                botsToPlay.push(bot);
            }
        }

        // Bots without specials play automatically
        if (botsToPlay.length > 0) {
            await new Promise(r => setTimeout(r, 400));
            for (let i = 0; i < botsToPlay.length; i++) {
                const bot = botsToPlay[i];
                this.updateStatusBar(`Lượt ${bot.name}...`, null);
                await this.botPlay(bot, i);
                this.render();
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // Now it's the dealer's (player's) turn — interactive!
        this.dealerDone = true;
        this.phase = 'dealer';
        this.render();
        this.updateButtons();
        this.updateStatusBar('👑 Lượt của bạn', null, `Điểm: ${this.getScore(this.dealer.hand)}`);
    }

    async botPlay(bot, index) {
        let safety = 0;
        while (this.deck.length > 0 && this.botShouldHit(bot) && bot.hand.length < 5) {
            const card = this.deck.pop();
            if (!card) break;
            card.isNew = true;
            bot.hand.push(card);
            this.render();
            await new Promise(r => setTimeout(r, 700));
            safety++;
            if (safety > 10) break;
        }
    }

    // ========== DEALER ACTIONS (Cầm cái) ==========
    async dealerDraw() {
        if (this.phase !== 'dealer') return;
        const hand = this.dealer.hand;
        if (hand.length >= 5) return;
        const card = this.deck.pop();
        if (!card) return;
        card.isNew = true;
        hand.push(card);
        this.render();

        const stat = this.getHandStatus(hand);
        if (stat.tag === 'bust' || hand.length >= 5) {
            // Tự động xét tất
            await this.dealerCheckAll();
            return;
        }

        this.updateStatusBar('👑', null, `Điểm: ${this.getScore(hand)}`);
        this.updateButtons();
    }

    async dealerCheckBot(index) {
        if (this.phase !== 'dealer') return;
        const bot = this.botPlayers[index];
        if (!bot || bot.checked) return;

        const dStat = this.getHandStatus(this.dealer.hand);
        const bStat = this.getHandStatus(bot.hand);
        const { res } = this.resolveOne(bStat, dStat, this.currentBet);

        bot.result = res;
        bot.checked = true;
        this.render();

        if (this.botPlayers.every(b => b.checked)) {
            await this.finishDealerRound();
        }
    }

    async dealerCheckAll() {
        if (this.phase !== 'dealer') return;
        await this.finishDealerRound();
    }

    async finishDealerRound() {
        this.dealerDone = true;
        this.phase = 'result';
        await this.endGame();
    }

    nextRound() {
        if (this.phase !== 'betting') return;
        // Reset & quay về menu
        this.deck = [];
        this.dealer = { hand: [] };
        this.players = [{ hand: [], result: '' }];
        this.botPlayers = [];
        this.currentBet = 0;
        this.dealerDone = false;
        this.isPlayerFlipped = false;
        this.dealerResult = '';
        this.isBusy = false;

        document.getElementById('xd-game').classList.remove('active');
        document.getElementById('xd-game').style.display = 'none';
        document.getElementById('xd-menu').classList.add('active');
        document.getElementById('xd-menu').style.display = 'flex';
    }

    // Dealer plays automatically in player mode
    async dealerTurn() {
        if (this.mode === 'dealer') {
            return;
        }
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
        // Dealer mode actions
        if (this.mode === 'dealer') {
            if (this.phase === 'dealer') {
                await this.dealerDraw();
            } else if (this.phase === 'result' || this.phase === 'betting') {
                this.nextRound();
            }
            return;
        }
        // Player mode
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
        // Dealer mode: xét tất
        if (this.mode === 'dealer') {
            if (this.phase === 'dealer') {
                await this.dealerCheckAll();
            }
            return;
        }
        // Player mode
        this.isPlayerFlipped = true;
        this.phase = 'dealer';
        this.updateStatusBar('👑', null, `Bạn: ${this.getScore(this.players[0].hand)}`);
        document.getElementById('bc-status')?.classList.add('rolling');
        this.updateButtons(false);
        await new Promise(r => setTimeout(r, 1000));
        await this.dealerTurn();
    }



    async endGame() {
        if (this.mode === 'dealer') {
            await this.endDealerMode();
        } else {
            await this.endPlayerMode();
        }
    }

    resolveOne(playerStat, dealerStat, bet) {
        if (playerStat.tag === 'bust' && dealerStat.tag === 'bust') return { res: 'HÒA', delta: bet, dRes: 'QUẮC' };
        if (playerStat.tag === 'bust') return { res: 'QUẮC', delta: 0, dRes: 'THẮNG' };
        if (playerStat.tag === 'xi_bang' && dealerStat.tag !== 'xi_bang') return { res: 'XÌ BÀN', delta: bet * 2, dRes: null };
        if (playerStat.tag === 'xi_dach' && dealerStat.tag !== 'xi_dach' && dealerStat.tag !== 'xi_bang') return { res: 'XÌ DÁCH', delta: bet * 2, dRes: null };
        if (dealerStat.tag === 'xi_bang' || dealerStat.tag === 'xi_dach') return { res: 'THUA', delta: 0, dRes: null };
        if (playerStat.tag === 'ngu_linh' && dealerStat.tag !== 'ngu_linh') return { res: 'NGŨ LINH', delta: bet * 2, dRes: null };
        if (dealerStat.tag === 'ngu_linh' && playerStat.tag !== 'ngu_linh') return { res: 'THUA', delta: 0, dRes: null };
        if (dealerStat.tag === 'bust') return { res: 'THẮNG', delta: bet * 2, dRes: null };
        if (playerStat.score > dealerStat.score) return { res: 'THẮNG', delta: bet * 2, dRes: null };
        if (playerStat.score < dealerStat.score) return { res: 'THUA', delta: 0, dRes: null };
        return { res: 'HÒA', delta: bet, dRes: null };
    }

    async endPlayerMode() {
        const dStat = this.getHandStatus(this.dealer.hand);
        const pStat = this.getHandStatus(this.players[0].hand);
        const { res, delta } = this.resolveOne(pStat, dStat, this.currentBet);

        this.players[0].result = res;
        if (!this.dealerResult) {
            const dTag = dStat.tag;
            if (dTag === 'xi_bang') this.dealerResult = 'XÌ BÀN';
            else if (dTag === 'xi_dach') this.dealerResult = 'XÌ DÁCH';
            else if (dTag === 'ngu_linh') this.dealerResult = 'NGŨ LINH';
            else if (dTag === 'bust') this.dealerResult = 'QUẮC';
            else this.dealerResult = ['THẮNG','XÌ BÀN','XÌ DÁCH','NGŨ LINH'].includes(res) ? 'THUA' : res === 'HÒA' ? 'HÒA' : 'THẮNG';
        }

        await this.settlePoints(delta);
        this.render(true);
        this.updateButtons(false);
        document.getElementById('bc-status')?.classList.remove('rolling');
        this.updateStatusBar(res, delta - this.currentBet, `Điểm: ${pStat.score}`);
        this.isBusy = false;
        this.phase = 'betting';
        document.getElementById('xd-bet-row').style.display = 'flex';
    }

    async endDealerMode() {
        const dStat = this.getHandStatus(this.dealer.hand);
        let totalDelta = 0;
        let detailStr = '';

        // Dealer result is based on overall outcome
        let dealerWins = 0, dealerLosses = 0, draws = 0;

        for (const bot of this.botPlayers) {
            let delta, res;

            if (!bot.checked) {
                // Bot chưa xét: tính kết quả từ đầu
                const bStat = this.getHandStatus(bot.hand);
                const r = this.resolveOne(bStat, dStat, bot.bet);
                res = r.res;
                delta = r.delta;
            } else {
                // Bot đã xét: giữ nguyên kết quả cũ, tính delta từ result
                res = bot.result;
                if (res === 'THẮNG' || res === 'XÌ BÀN' || res === 'XÌ DÁCH' || res === 'NGŨ LINH') {
                    delta = bot.bet * 2;
                } else if (res === 'THUA' || res === 'QUẮC') {
                    delta = 0;
                } else { // HÒA
                    delta = bot.bet;
                }
            }
            bot.result = res;
            totalDelta += delta;

            // For dealer, reverse perspective
            const netPerBot = delta - bot.bet;
            if (netPerBot < 0) dealerWins++;
            else if (netPerBot > 0) dealerLosses++;
            else draws++;
        }

        // Net from dealer's perspective
        const dealerNet = -(totalDelta - (this.currentBet * this.botPlayers.length));
        // Preserve special dealer results (Xi Bàn, Xi Dách)
        if (this.dealerResult !== 'XÌ BÀN' && this.dealerResult !== 'XÌ DÁCH') {
            if (dealerNet > 0) this.dealerResult = 'THẮNG';
            else if (dealerNet < 0) this.dealerResult = 'THUA';
            else this.dealerResult = 'HÒA';
        }

        this.betSettled = true;
        let totalNet = dealerNet;
        let buffBonus = 0;
        if (dealerNet !== 0) {
            if (dealerNet > 0) {
                try {
                    const buffPct = await getActiveBuff();
                    if (buffPct > 0) {
                        buffBonus = Math.round(dealerNet * buffPct / 100);
                        totalNet = dealerNet + buffBonus;
                    }
                } catch {}
            }
            try {
                await addPoints('Casino', dealerNet > 0 ? 'Thắng Xì Dách (Cầm cái)' : 'Thua Xì Dách (Cầm cái)', totalNet, false);
            } catch(e){}
        }

        this.render(true);
        this.updateButtons(false);
        const subText = buffBonus > 0
            ? `${dealerWins}T-${dealerLosses}B-${draws}H 🐾+${buffBonus.toLocaleString('vi-VN')}`
            : `${dealerWins}T-${dealerLosses}B-${draws}H`;
        this.updateStatusBar(this.dealerResult, totalNet, subText);
        this.isBusy = false;
        this.phase = 'betting';
        document.getElementById('xd-bet-row').style.display = 'flex';
    }

    async settlePoints(delta) {
        this.betSettled = true;
        const net = delta - this.currentBet;
        if (net !== 0) {
            try {
                await addPoints('Casino', net > 0 ? 'Thắng Xì Dách' : 'Cược Xì Dách', net, false);
            } catch(e){}
        }
    }

    // ==================== RENDER ====================
    render(showDealer = false) {
        const tableEl = document.getElementById('xd-table');

        if (this.mode === 'dealer') {
            tableEl.innerHTML = this.renderDealerMode();
        } else {
            tableEl.innerHTML = this.renderPlayerMode(showDealer);
        }
    }

    renderPlayerMode(showDealer) {
        const dScore = this.getScore(this.dealer.hand);
        const p = this.players[0];
        const pScore = this.getScore(p.hand);

        const dealerResultHtml = this.makeResultOverlay(this.dealerResult, 'dealer');
        const playerResultHtml = this.makeResultOverlay(p.result, 'player');

        return `
            <div class="xd-seat dealer">
                ${dealerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">👑 Nhà Cái <span class="xd-score-inline">${showDealer || this.dealerDone ? dScore : '?'}</span></span>
                </div>
                <div class="xd-cards">
                    ${this.renderCards(this.dealer.hand, !showDealer && !this.dealerDone)}
                </div>
            </div>
            <div class="xd-seat me ${this.phase === 'playing' ? 'turn' : ''}">
                ${playerResultHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">Bạn <span class="xd-score-inline">${this.isPlayerFlipped || this.phase === 'result' ? pScore : '?'}</span></span>
                </div>
                <div class="xd-cards">
                    ${this.renderCards(p.hand, !this.isPlayerFlipped && this.phase !== 'result')}
                </div>
                <div class="xd-bet-badge">${this.currentBet ? this.currentBet.toLocaleString('vi-VN') + ' 〄' : ''}</div>
            </div>
        `;
    }

    renderDealerMode() {
        const dScore = this.getScore(this.dealer.hand);
        const dealerResultHtml = this.makeResultOverlay(this.dealerResult, 'dealer');

        let html = '';

        // Render bots TRƯỚC, dealer (player) SAU CÙNG
        this.botPlayers.forEach((bot, i) => {
            const bScore = this.getScore(bot.hand);
            const bResultHtml = this.makeResultOverlay(bot.result, 'player');
            const isTurn = this.phase === 'playing' && !bot.result;
            // Ẩn bài bot chưa được xét (chỉ hiện khi đã check hoặc phase result)
            const hideCards = this.phase !== 'result' && !bot.checked;
            // Nút XÉT BÀI — chỉ hiện ở phase dealer cho bot chưa xét
            let checkBtnHtml = '';
            if (this.phase === 'dealer' && !bot.checked) {
                checkBtnHtml = `<button class="xd-check-btn-neon" onclick="window.game.dealerCheckBot(${i})">XÉT BÀI</button>`;
            }
            html += `<div class="xd-seat ${isTurn ? 'turn' : ''} ${bot.result === 'THẮNG' ? 'win' : bot.result === 'THUA' || bot.result === 'QUẮC' ? 'lose' : ''}">
                ${bResultHtml}
                ${checkBtnHtml}
                <div class="xd-seat-head">
                    <span class="xd-seat-name">${bot.name} <span class="xd-score-inline">${hideCards ? '?' : bScore}</span></span>
                </div>
                <div class="xd-cards">
                    ${this.renderCards(bot.hand, hideCards)}
                </div>
                <div class="xd-bet-badge">${bot.bet ? bot.bet.toLocaleString('vi-VN') + ' 〄' : ''}</div>
            </div>`;
        });

        // Render dealer (player) CUỐI CÙNG
        html += `<div class="xd-seat dealer me">
            ${dealerResultHtml}
            <div class="xd-seat-head">
                <span class="xd-seat-name">👑 Bạn (Cầm cái) <span class="xd-score-inline">${dScore}</span></span>
            </div>
            <div class="xd-cards">
                ${this.renderCards(this.dealer.hand, false)}
            </div>
        </div>`;

        return html;
    }

    renderCards(hand, hide) {
        if (!hand || !hand.length) return '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>';
        return hand.map((c, i) => {
            const html = renderCardUI(c, hide);
            const finalHtml = c.isNew ? html.replace('class="card', 'class="card card-new') : html;
            delete c.isNew;
            return finalHtml;
        }).join('');
    }

    makeResultOverlay(result, type) {
        if (!result) return '';
        if (result === 'XÌ BÀN' || result === 'XÌ DÁCH' || result === 'NGŨ LINH') return `<div class="xd-result-overlay xd-result-special">${result}</div>`;
        if (result === 'QUẮC') return '<div class="xd-result-overlay xd-result-bust">QUẮC</div>';
        if (result === 'THẮNG') return '<div class="xd-result-overlay xd-result-win">THẮNG</div>';
        if (result === 'THUA') return '<div class="xd-result-overlay xd-result-lose">THUA</div>';
        if (result === 'HÒA') return '<div class="xd-result-overlay xd-result-draw">HÒA</div>';
        return '';
    }

    updateButtons(canPlay) {
        // Dealer mode: action buttons (Rút / Xét Tất / Vòng mới)
        if (this.mode === 'dealer') {
            if (this.phase === 'dealer') {
                const dScore = this.getScore(this.dealer.hand);
                const dLen = this.dealer.hand.length;
                const canCheck = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
                const allChecked = this.botPlayers.every(b => b.checked);

                document.getElementById('btn-hit').style.display = 'inline-block';
                document.getElementById('btn-hit').textContent = '➕ RÚT';
                document.getElementById('btn-hit').disabled = (dLen >= 5);

                document.getElementById('btn-stand').style.display = 'inline-block';
                document.getElementById('btn-stand').textContent = canCheck ? '✋ XÉT TẤT' : '✋ HẾT BÀI';
                document.getElementById('btn-stand').disabled = !canCheck || allChecked;
            } else if (this.phase === 'result' || this.phase === 'betting') {
                document.getElementById('btn-hit').style.display = 'inline-block';
                document.getElementById('btn-hit').textContent = '🔄 VÒNG MỚI';
                document.getElementById('btn-hit').disabled = false;
                document.getElementById('btn-stand').style.display = 'none';
            } else {
                document.getElementById('btn-hit').style.display = 'none';
                document.getElementById('btn-stand').style.display = 'none';
            }
            return;
        }
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
