// cards.js
const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♣', color: 'black' },
  { symbol: '♥', color: 'red'   },
  { symbol: '♦', color: 'red'   }
];

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

/**
 * Tạo bộ bài 52 lá đã xáo trộn
 */
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit: suit.symbol, color: suit.color });
    }
  }
  // Xáo bài Fisher‑Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Trả về HTML của 1 lá bài
 * @param {Object|null} card - đối tượng {rank, suit, color} hoặc null nếu úp
 * @param {boolean} hidden - true -> mặt úp
 */
export function renderCardUI(card, hidden = false) {
  if (hidden || !card) {
    return `<div class="card hidden"></div>`;
  }
  return `
    <div class="card ${card.color}">
      <div class="card-corner top">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
      <div class="card-center">${card.suit}</div>
      <div class="card-corner bottom">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
    </div>
  `;
}