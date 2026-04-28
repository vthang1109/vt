// cards.js — Bộ bài dùng SVG trong assets/cards/svg/
// Định dạng: {chất}{giá_trị}.svg
// Chất: S (♠), H (♥), D (♦), C (♣)
// Giá trị: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K

function suitToCode(suit) {
    switch (suit) {
        case '♠': return 'S';
        case '♥': return 'H';
        case '♦': return 'D';
        case '♣': return 'C';
        default: return 'S';
    }
}

export function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const s of suits) {
        for (const v of values) {
            deck.push({ v, s });
        }
    }
    // Xáo Fisher–Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export function renderCardUI(card, hidden = false) {
    // Mặt sau: dùng ảnh back.svg thật, không tự vẽ background
    if (!card || hidden) {
        return `<img src="assets/cards/svg/back.png" class="card" alt="?" style="width:80px; height:auto; border-radius:6px; background:none;" />`;
    }
    const code = suitToCode(card.s);
    const value = card.v;
    const imgPath = `assets/cards/svg/${code}${value}.svg`;
    return `<img src="${imgPath}" class="card" alt="${value}${card.s}" style="width:80px; height:auto; border-radius:6px; background:none;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
            <span style="display:none; font-size:20px; font-weight:800;">${value}${card.s}</span>`;
}