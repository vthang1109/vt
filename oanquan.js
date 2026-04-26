import { addPoints, getPoints } from './points.js';

class OAnQuan {
    constructor() {
        // Dân mỗi ô: 5, Quan: 1
        this.board = [5,5,5,5,5, 5,5,5,5,5]; // 10 ô dân
        this.quan = [1, 1]; // [AI, Player]
        this.score = [0, 0]; // [AI, Player]
        this.turn = 1; // 0 = AI, 1 = Player
        this.gameOver = false;
        this.init();
    }

    async init() {
        await this.refreshPts();
        this.render();
        this.bindEvents();
    }

    async refreshPts() {
        const pts = await getPoints();
        document.getElementById('nav-pts').textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
    }

    bindEvents() {
        document.getElementById('btnNew').addEventListener('click', () => this.reset());
    }

    reset() {
        this.board = [5,5,5,5,5, 5,5,5,5,5];
        this.quan = [1, 1];
        this.score = [0, 0];
        this.turn = 1;
        this.gameOver = false;
        document.getElementById('resultModal').classList.remove('active');
        this.render();
    }

    render() {
        // Hàng trên (ô AI: 0-4)
        const topRow = document.getElementById('topRow');
        topRow.innerHTML = '';
        for (let i = 4; i >= 0; i--) {
            topRow.innerHTML += this.renderCell(i, false);
        }

        // Hàng dưới (ô Player: 5-9)
        const bottomRow = document.getElementById('bottomRow');
        bottomRow.innerHTML = '';
        for (let i = 5; i <= 9; i++) {
            bottomRow.innerHTML += this.renderCell(i, true);
        }

        // Quan
        document.getElementById('aiQuanCount').textContent = this.quan[0];
        document.getElementById('playerQuanCount').textContent = this.quan[1];

        // Điểm
        document.getElementById('aiScore').textContent = this.score[0];
        document.getElementById('playerScore').textContent = this.score[1];

        // Turn
        document.getElementById('turnIndicator').textContent = this.turn === 1 ? '👆 LƯỢT BẠN' : '🤖 AI ĐANG ĐI...';
    }

    renderCell(index, isPlayer) {
        const count = this.board[index];
        const canSelect = isPlayer && this.turn === 1 && count > 0 && !this.gameOver;
        return `
            <div class="cell ${canSelect ? 'selectable' : ''} ${count === 0 ? 'empty' : ''}"
                 onclick="${canSelect ? `game.selectCell(${index})` : ''}">
                <span class="cell-count">${count}</span>
                <span class="cell-label">Ô ${index + 1}</span>
            </div>`;
    }

    selectCell(index) {
        if (this.turn !== 1 || this.gameOver) return;
        if (this.board[index] === 0) return;

        const result = this.spread(index, 1);
        this.score[1] += result.collected;
        this.board = result.board;
        this.quan = result.quan;
        this.score[0] += result.opponentCollected;

        this.render();
        this.checkGameOver();
        if (!this.gameOver) {
            this.turn = 0;
            setTimeout(() => this.aiMove(), 800);
        }
    }

    aiMove() {
        if (this.gameOver) return;
        // Chọn ô có nhiều dân nhất bên AI (0-4)
        let bestIdx = -1;
        let maxVal = -1;
        for (let i = 0; i <= 4; i++) {
            if (this.board[i] > maxVal) {
                maxVal = this.board[i];
                bestIdx = i;
            }
        }
        if (bestIdx === -1 || this.board[bestIdx] === 0) {
            this.turn = 1;
            this.render();
            return;
        }

        const result = this.spread(bestIdx, 0);
        this.score[0] += result.collected;
        this.board = result.board;
        this.quan = result.quan;
        this.score[1] += result.opponentCollected;

        this.render();
        this.checkGameOver();
        if (!this.gameOver) {
            this.turn = 1;
            this.render();
        }
    }

    spread(startIdx, playerSide) {
        let board = [...this.board];
        let quan = [...this.quan];
        let stones = board[startIdx];
        board[startIdx] = 0;
        let idx = startIdx;
        let collected = 0;
        let opponentCollected = 0;

        while (stones > 0) {
            idx = (idx + 1) % 12; // 0-4: ô AI, 5-9: ô Player, 10: Quan AI, 11: Quan Player

            if (idx === 10 && playerSide === 0) { // Quan AI khi AI đang rải
                quan[0]++;
                stones--;
                continue;
            }
            if (idx === 11 && playerSide === 1) { // Quan Player khi Player đang rải
                quan[1]++;
                stones--;
                continue;
            }

            // Ô dân
            const cellIdx = idx <= 4 ? idx : (idx <= 10 ? idx - 1 : 9);
            board[cellIdx]++;
            stones--;

            // Kiểm tra ăn
            if (stones === 0) {
                const nextIdx = (idx + 1) % 12;
                if (playerSide === 1 && cellIdx >= 5 && cellIdx <= 9 && board[cellIdx] === 0) {
                    // Player ăn ô đối diện
                    const opposite = 4 - (cellIdx - 5);
                    if (board[opposite] > 0) {
                        collected += board[opposite];
                        board[opposite] = 0;
                    }
                } else if (playerSide === 0 && cellIdx >= 0 && cellIdx <= 4 && board[cellIdx] === 0) {
                    const opposite = 9 - cellIdx;
                    if (board[opposite] > 0) {
                        opponentCollected += board[opposite];
                        board[opposite] = 0;
                    }
                }
            }
        }

        // Ăn quan nếu ô bên cạnh trống
        return { board, quan, collected, opponentCollected };
    }

    checkGameOver() {
        const totalStones = this.board.reduce((a,b) => a+b, 0) + this.quan[0] + this.quan[1];
        if (totalStones === 0 || (this.quan[0] === 0 && this.quan[1] === 0)) {
            this.gameOver = true;
            this.score[0] += this.quan[0];
            this.score[1] += this.quan[1];
            this.quan = [0, 0];
            this.render();
            this.endGame();
        }
    }

    async endGame() {
        const pScore = this.score[1];
        const aiScore = this.score[0];
        let title, text, reward = 0;

        if (pScore > aiScore) {
            title = '🏆 BẠN THẮNG!';
            text = `Bạn: ${pScore} - AI: ${aiScore}`;
            reward = 50;
        } else if (aiScore > pScore) {
            title = '💀 AI THẮNG';
            text = `Bạn: ${pScore} - AI: ${aiScore}`;
            reward = 5;
        } else {
            title = '🤝 HÒA';
            text = `Bạn: ${pScore} - AI: ${aiScore}`;
            reward = 20;
        }

        try { await addPoints('Ô Ăn Quan', title, reward); await this.refreshPts(); } catch(e) {}
        if (window.VTQuests) { window.VTQuests.trackPlay('oanquan'); if (reward > 20) window.VTQuests.trackEarn(reward); }

        document.getElementById('resultTitle').textContent = title;
        document.getElementById('resultText').textContent = text + ` | +${reward}đ`;
        document.getElementById('resultModal').classList.add('active');
    }
}

window.game = new OAnQuan();