import { PARTY_CARDS } from './cards-party.js';

class UongDi {
    constructor() {
        this.deck = [...PARTY_CARDS];
        this.drawn = [];
        this.currentCard = null;
        this.init();
    }

    init() {
        this.shuffleDeck();
        this.bindEvents();
        this.updateStats();
        this.createConfirmModal();
    }

    createConfirmModal() {
        // Tạo modal xác nhận nếu chưa có
        if (document.getElementById('confirmModal')) return;
        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'confirm-overlay';
        modal.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-icon">⚠️</div>
                <div class="confirm-title">XÁC NHẬN</div>
                <div class="confirm-text">Bạn có chắc muốn làm mới toàn bộ bài?<br><small>Tất cả lịch sử sẽ bị xóa!</small></div>
                <div class="confirm-btns">
                    <button class="confirm-btn cancel-btn" id="confirmCancel">❌ HỦY</button>
                    <button class="confirm-btn ok-btn" id="confirmOk">✅ LÀM MỚI</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmCancel').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        document.getElementById('confirmOk').addEventListener('click', () => {
            modal.classList.remove('active');
            this.shuffleDeck();
            this.showToast('✅ Đã làm mới toàn bộ bài!', 'success');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    shuffleDeck() {
        this.deck = [...PARTY_CARDS].sort(() => Math.random() - 0.5);
        this.drawn = [];
        this.currentCard = null;
        this.updateStats();
        this.renderCard(null);
        this.renderHistory();
    }

    bindEvents() {
        document.getElementById('btnDraw').addEventListener('click', () => this.drawCard());
        document.getElementById('btnReset').addEventListener('click', () => {
            document.getElementById('confirmModal').classList.add('active');
        });
    }

    drawCard() {
        if (!this.deck || this.deck.length === 0) {
            this.showToast('🎉 Hết bài rồi! Nhấn LÀM MỚI để chơi tiếp.', 'warn');
            return;
        }

        const card = this.deck.pop();
        this.currentCard = card;
        this.drawn.push(card);
        this.renderCard(card);
        this.addHistory(card);
        this.updateStats();
    }

    renderCard(card) {
        const display = document.getElementById('cardDisplay');
        const badge = document.getElementById('cardBadge');
        const text = document.getElementById('cardText');
        const icon = document.getElementById('cardIcon');

        if (!card) {
            display.className = 'card-display';
            badge.textContent = '🃏 SẴN SÀNG';
            text.innerHTML = 'Nhấn nút bên dưới<br>để rút lá đầu tiên!';
            icon.textContent = '🃏';
            return;
        }

        const type = card.type || 'drink';
        display.className = 'card-display ' + type;

        const typeConfig = {
            drink:          { badge: '🍺 UỐNG', icon: '🍺' },
            choose:         { badge: '👆 CHỈ ĐỊNH', icon: '👆' },
            all:            { badge: '👥 TẤT CẢ', icon: '👥' },
            truth_or_drink: { badge: '💬 SỰ THẬT', icon: '💬' },
            dare_or_drink:  { badge: '🎯 THỬ THÁCH', icon: '🎯' },
            save_card:      { badge: '💾 LÁ MA', icon: '💾' },
            swap_card:      { badge: '🔄 ĐỔI LÁ', icon: '🔄' },
            double_next:    { badge: '✖️2 NHÂN ĐÔI', icon: '✖️' },
            reverse:        { badge: '↩️ QUAY LẠI', icon: '↩️' },
            free_pass:      { badge: '🆓 TỰ DO', icon: '🆓' },
            choose_two:     { badge: '✌️ CHỌN 2', icon: '✌️' },
            rock_paper:     { badge: '✊ OẲN TÙ TÌ', icon: '✊' },
            guess_number:   { badge: '🔢 ĐOÁN SỐ', icon: '🔢' },
            hold_breath:    { badge: '😤 NÍN THỞ', icon: '😤' },
            staring:        { badge: '👀 NHÌN MÃI', icon: '👀' },
            fun:            { badge: '🎉 VUI NHỘN', icon: '🎉' },
            rule:           { badge: '📏 ĐẶT LUẬT', icon: '📏' },
            penalty:        { badge: '⚠️ PHẠT', icon: '⚠️' }
        };

        const config = typeConfig[type] || { badge: '🃏 KHÁC', icon: '🃏' };
        badge.textContent = config.badge;
        icon.textContent = config.icon;
        text.textContent = card.text;
    }

    addHistory(card) {
        const list = document.getElementById('historyList');
        const empty = list.querySelector('.empty');
        if (empty) empty.remove();

        const item = document.createElement('div');
        item.className = 'history-item ' + (card.type || 'drink');
        item.innerHTML = `<span>🃏</span> <span>${card.text}</span>`;
        list.insertBefore(item, list.firstChild);

        while (list.children.length > 30) {
            list.removeChild(list.lastChild);
        }
    }

    renderHistory() {
        const list = document.getElementById('historyList');
        list.innerHTML = '<div class="history-item empty">Chưa có lá nào được rút</div>';
    }

    updateStats() {
        document.getElementById('drawnCount').textContent = this.drawn.length;
        document.getElementById('remainCount').textContent = this.deck ? this.deck.length : 0;
    }

    showToast(msg, type) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;top:20px;right:20px;z-index:9999;
            padding:14px 20px;border-radius:14px;
            background:rgba(4,20,40,0.97);border:2px solid ${type==='warn'?'#fbbf24':'#38bdf8'};
            color:#fff;font-size:15px;font-weight:800;font-family:'Nunito',sans-serif;
            box-shadow:0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(56,189,248,0.2);max-width:300px;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UongDi();
});