// cards.js
export const suits = [
    { n: 'bich', s: '♠', c: 'black' },
    { n: 'chuon', s: '♣', c: 'black' },
    { n: 'co', s: '♥', c: 'red' },
    { n: 'ro', s: '♦', c: 'red' }
];
export const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck() {
    let deck = [];
    suits.forEach(s => {
        values.forEach(v => {
            deck.push({ v, suit: s.s, color: s.c });
        });
    });
    return deck.sort(() => Math.random() - 0.5);
}

export function renderCardUI(card, isHidden = false) {
    if (isHidden) return `<div class="card hidden"><div class="card-back"></div></div>`;
    
    return `
        <div class="card ${card.color}">
            <div class="card-top">${card.v}<span>${card.suit}</span></div>
            <div class="card-center">${card.suit}</div>
            <div class="card-bottom">${card.v}<span>${card.suit}</span></div>
        </div>
    `;
}
