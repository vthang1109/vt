// ==================== CÁT TÊ 4 NGƯỜI (1 người + 3 AI) ====================
// Luật: 6 lá/người · 6 vòng · Cùng chất & lớn hơn hoặc Úp bài · Vào tùng
import { renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from '../../points.js';
import { getActiveBuff } from '../../pet.js';

// ── CẤU HÌNH ──
const RANK_LABELS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_LABELS = ['♠','♣','♦','♥'];
const SUIT_STR = [0,1,2,3]; // ♠ < ♣ < ♦ < ♥
const AI_NAMES = ['Bạn', 'Minh', 'Hoa', 'Tuấn'];

const TURN_SECONDS = 25;
const RING_CIRC = 113;
const TOTAL_ROUNDS = 6;

// ── BỘ BÀI ──
function buildDeck() {
  const deck = [];
  for (let r = 0; r < 13; r++)
    for (let s = 0; s < 4; s++)
      deck.push({ rIdx: r, sIdx: s });
  return deck;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sortHand(hand) {
  return [...hand].sort((a, b) => SUIT_STR[a.sIdx] - SUIT_STR[b.sIdx] || a.rIdx - b.rIdx);
}
function cardLabel(c) { return RANK_LABELS[c.rIdx] + SUIT_LABELS[c.sIdx]; }
function cardKey(c) { return `${c.rIdx}-${c.sIdx}`; }

// ── TRẠNG THÁI ──
let state = null;
let currentNet = 0;
let payoutSettled = false;
let buffPct = 0;
let buffLoadPromise = null;

function newGame(bet = 100, buff = 0) {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  for (let i = 0; i < 24; i++) hands[i % 4].push(deck[i]);
  for (let i = 0; i < 4; i++) hands[i] = sortHand(hands[i]);

  // Tìm người có 2♠ (rIdx=0, sIdx=0) để đi trước
  let starter = 0;
  for (let i = 0; i < 4; i++) {
    if (hands[i].some(c => c.rIdx === 0 && c.sIdx === 0)) { starter = i; break; }
  }

  state = {
    hands,
    turn: starter,
    phase: 'playing',
    round: 1,
    tricks: [{ plays: [], leadSuit: null, currentHighest: null, highestPlayer: null, winner: null }],
    trickWins: [0, 0, 0, 0],
    winner: null,
    over: false,
    bet,
    buffPct: buff,
    selectedIdx: -1,
    lastActionMsg: '',
    // cho UI
    trickHistory: [],
    // Tùng tracking
    tungChecked: false,
    survivors: null,
    deadPlayers: null,
  };
  return state;
}

// ── KIỂM TRA ──
// Một lá có thể đánh được không? Nếu là bài tấn (phải theo chất & lớn hơn)
// Tìm người chơi kế tiếp còn sống (bỏ qua người đã chết Tùng ở vòng 5-6)
function nextAliveTurn(from) {
  let n = (from + 1) % 4;
  if (state.tungChecked && state.deadPlayers && state.deadPlayers.length > 0) {
    let guard = 0;
    while (state.deadPlayers.includes(n) && guard < 4) {
      n = (n + 1) % 4;
      guard++;
    }
  }
  return n;
}

function canPlayCard(card, leadSuit, currentHighest) {
  if (leadSuit === null || !currentHighest) return true; // đang dẫn đầu
  // Bắt buộc theo chất nếu có
  if (card.sIdx !== leadSuit) return false;
  // Phải lớn hơn lá cao nhất hiện tại
  return card.rIdx > currentHighest.rIdx;
}

// Có lá nào trong tay có thể theo chất và đánh được không?
function hasPlayableCard(hand, leadSuit, currentHighest) {
  if (leadSuit === null || !currentHighest) return hand.length > 0;
  return hand.some(c => c.sIdx === leadSuit && c.rIdx > currentHighest.rIdx);
}

// ── THỰC HIỆN 1 NƯỚC ĐÁNH ──
function playCard(playerIdx, cardIdx, faceDown = false) {
  if (!state || state.over || state.phase !== 'playing') return { ok: false, msg: 'Game over' };
  if (state.awaitingNextTrick) return { ok: false, msg: 'Đang chờ vòng tiếp theo...' };
  if (state.turn !== playerIdx) return { ok: false, msg: 'Không phải lượt bạn' };

  const hand = state.hands[playerIdx];
  if (cardIdx < 0 || cardIdx >= hand.length) return { ok: false, msg: 'Chọn lá bài hợp lệ' };

  const card = hand[cardIdx];
  const currentTrick = state.tricks[state.tricks.length - 1];

  // Nếu đang có leadSuit và phải theo chất
  if (currentTrick.leadSuit !== null && currentTrick.currentHighest && !faceDown) {
    // Người chơi chọn đánh (face up) - phải theo chất & lớn hơn
    if (!canPlayCard(card, currentTrick.leadSuit, currentTrick.currentHighest)) {
      // Kiểm tra xem có lá nào đánh được không
      if (hasPlayableCard(hand, currentTrick.leadSuit, currentTrick.currentHighest)) {
        return { ok: false, msg: 'Phải đánh cùng chất và lớn hơn!' };
      }
      // Nếu không có bài đánh được, bắt buộc úp bài
      return { ok: false, msg: 'Không có bài đánh! Hãy ÚP bài', mustFold: true };
    }
  } else if (currentTrick.leadSuit === null && faceDown) {
    return { ok: false, msg: 'Đang dẫn đầu, không thể úp bài' };
  }

  // Thực hiện đánh
  hand.splice(cardIdx, 1);

  const play = {
    playerIdx,
    card,
    faceDown,
    label: faceDown ? 'Úp' : cardLabel(card),
  };

  currentTrick.plays.push(play);

  // Nếu là người đầu tiên đánh (lead), set leadSuit
  if (currentTrick.plays.length === 1 && !faceDown) {
    currentTrick.leadSuit = card.sIdx;
    currentTrick.currentHighest = card;
    currentTrick.highestPlayer = playerIdx;
  } else if (!faceDown && card.sIdx === currentTrick.leadSuit) {
    // Cập nhật lá cao nhất nếu cùng chất
    if (card.rIdx > currentTrick.currentHighest.rIdx) {
      currentTrick.currentHighest = card;
      currentTrick.highestPlayer = playerIdx;
    }
  }

  // Chuyển lượt
  state.lastActionMsg = faceDown
    ? `${AI_NAMES[playerIdx]} úp bài`
    : `${AI_NAMES[playerIdx]} đánh ${cardLabel(card)}`;

  const nextPlayer = nextAliveTurn(playerIdx);

  // Kiểm tra đã đủ lượt trong vòng này (4 người, hoặc ít hơn nếu đã có người chết Tùng)
  const expectedPlays = (state.tungChecked && state.survivors) ? state.survivors.length : 4;
  if (currentTrick.plays.length === expectedPlays) {
    finishTrick(currentTrick);
  } else {
    state.turn = nextPlayer;
  }

  return { ok: true };
}

// ── HOÀN TẤT 1 VÒNG (giữ lá cuối trên bàn 2.5s trước khi mở vòng mới) ──
function finishTrick(trick) {
  // Kết thúc vòng: người có lá cao nhất chất chủ thắng
  // Nếu không ai đánh ngửa (toàn bộ úp), người đầu tiên thắng
  const firstFaceUp = trick.plays.find(p => !p.faceDown);
  const winner = firstFaceUp ? trick.highestPlayer : trick.plays[0].playerIdx;
  state.trickWins[winner]++;
  trick.winner = winner;
  state.trickHistory.push({
    round: state.round,
    plays: trick.plays.map(p => ({ ...p })),
    winner,
  });
  state.turn = winner;
  state.lastActionMsg = `${AI_NAMES[winner]} thắng vòng ${state.round}!`;
  state.round++;

  // SAU VÒNG 4: Kiểm tra Tùng
  if (state.round === 5 && !state.tungChecked) {
    checkTung();
  }

  // Giữ lá bài cuối trên bàn để người chơi kịp nhìn trước khi sang vòng mới
  state.awaitingNextTrick = true;
  state.pendingGameOver = state.round > TOTAL_ROUNDS;
}

let trickFreezeTimer = null;
function clearTrickFreeze() {
  if (trickFreezeTimer) { clearTimeout(trickFreezeTimer); trickFreezeTimer = null; }
}
function scheduleTrickAdvance() {
  if (trickFreezeTimer) return;
  trickFreezeTimer = setTimeout(() => {
    trickFreezeTimer = null;
    if (!state) return;
    state.awaitingNextTrick = false;
    if (state.pendingGameOver) {
      state.pendingGameOver = false;
      endGame();
    } else {
      state.tricks.push({ plays: [], leadSuit: null, currentHighest: null, highestPlayer: null, winner: null });
    }
    render();
    if (!state.over) maybeRunAi();
  }, 2500);
}

// ── KẾT THÚC GAME ──
function endGame() {
  state.over = true;
  state.phase = 'result';

  // Luật: Nhất ăn tất — người (hoặc những người) thắng nhiều vòng nhất chia nhau cả bàn
  const maxWins = Math.max(...state.trickWins);
  const winners = [];
  for (let i = 0; i < 4; i++) {
    if (state.trickWins[i] === maxWins) winners.push(i);
  }
  state.winners = winners;
  state.maxWins = maxWins;

  const bet = state.bet;
  const pot = bet * 4;

  let net;
  if (winners.includes(0)) {
    net = Math.round(pot / winners.length) - bet;
  } else {
    net = -bet;
  }

  // Buff pet (chỉ khi thắng)
  if (net > 0 && buffPct > 0) {
    net = Math.round(net * (1 + buffPct / 100));
  }

  currentNet = net;
}

// ── TÍNH ĐIỂM ──
// ── KIỂM TRA TÙNG SAU VÒNG 4 ──
function checkTung() {
  if (state.tungChecked) return;
  const survivors = [];
  const dead = [];
  for (let i = 0; i < 4; i++) {
    if (state.trickWins[i] > 0) survivors.push(i);
    else dead.push(i);
  }
  state.survivors = survivors;
  state.deadPlayers = dead;
  state.tungChecked = true;

  // Thông báo
  if (dead.length > 0 && survivors.length > 0) {
    state.lastActionMsg = `${survivors.map(i => AI_NAMES[i]).join(', ')} vào Tùng! ${dead.map(i => AI_NAMES[i]).join(', ')} chết Tùng!`;
  } else if (survivors.length > 0) {
    state.lastActionMsg = 'Tất cả vào Tùng!';
  } else {
    state.lastActionMsg = 'Tất cả chết Tùng!';
  }
}

// Người chết Tùng không còn tham gia đánh ở vòng 5-6 (đã bị bỏ qua lượt qua nextAliveTurn)

// ── AI ──
function aiDecide(playerIdx) {
  const hand = state.hands[playerIdx];
  const trick = state.tricks[state.tricks.length - 1];
  const leadSuit = trick.leadSuit;
  const currentHighest = trick.currentHighest;

  // Nếu đang dẫn đầu: đánh lá thấp nhất
  if (leadSuit === null || trick.plays.length === 0) {
    // Đánh lá thấp nhất
    return { type: 'play', cardIdx: 0, faceDown: false };
  }

  // Đang phải theo chất
  // Tìm lá cùng chất có thể đánh
  const playable = [];
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i];
    if (c.sIdx === leadSuit && c.rIdx > currentHighest.rIdx) {
      playable.push({ idx: i, card: c });
    }
  }

  if (playable.length > 0) {
    // Chọn lá thấp nhất có thể đánh (tiết kiệm bài mạnh)
    playable.sort((a, b) => a.card.rIdx - b.card.rIdx);
    return { type: 'play', cardIdx: playable[0].idx, faceDown: false };
  }

  // Không có bài đánh → úp bài lá thấp nhất (giữ bài mạnh cho lượt sau)
  return { type: 'fold', cardIdx: 0 };
}

function runAiTurn(playerIdx, onDone) {
  setTimeout(() => {
    if (!state || state.over) { onDone(); return; }
    const decision = aiDecide(playerIdx);
    if (decision.type === 'fold') {
      playCard(playerIdx, decision.cardIdx, true);
    } else {
      playCard(playerIdx, decision.cardIdx, false);
    }
    onDone();
  }, 2000);
}

// ── GIAO DIỆN ──
const setupBar = document.getElementById('setup-bar');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const betInput = document.getElementById('ct-bet-input');
const playBtn = document.getElementById('play-btn');
const foldBtn = document.getElementById('fold-btn');
const myHandEl = document.getElementById('my-hand');
const tableEl = document.getElementById('table-combo');

// Nút Ván mới / Về menu — nằm ngay dưới bài (thay chỗ nút Đánh/Úp khi ván kết thúc)
const xdActionsEl = foldBtn.parentElement;
const newGameBtn = document.createElement('button');
newGameBtn.id = 'ct-new-game-btn';
newGameBtn.className = 'btn-deal';
newGameBtn.textContent = 'Ván mới';
newGameBtn.style.display = 'none';
newGameBtn.addEventListener('click', () => window.restartGame());
xdActionsEl.appendChild(newGameBtn);

const menuBtn = document.createElement('button');
menuBtn.id = 'ct-menu-btn';
menuBtn.className = 'btn-hit';
menuBtn.textContent = 'Về menu';
menuBtn.style.display = 'none';
menuBtn.addEventListener('click', () => window.backToSetup());
xdActionsEl.appendChild(menuBtn);

const betEl = document.getElementById('ct-bet');
const scoreEl = document.getElementById('ct-score');
const scoreSubEl = document.getElementById('ct-score-sub');
const profitEl = document.getElementById('ct-profit');
const statusBarEl = document.getElementById('bc-status');

const seatEls = {
  0: document.getElementById('seat-0'),
  1: document.getElementById('seat-1'),
  2: document.getElementById('seat-2'),
  3: document.getElementById('seat-3'),
};
const countEls = {
  1: document.getElementById('ct-count-1'),
  2: document.getElementById('ct-count-2'),
  3: document.getElementById('ct-count-3'),
};
const statusEls = {
  1: document.getElementById('ct-status-1'),
  2: document.getElementById('ct-status-2'),
  3: document.getElementById('ct-status-3'),
};
const tungBadgeEls = {
  1: document.getElementById('ct-tung-1'),
  2: document.getElementById('ct-tung-2'),
  3: document.getElementById('ct-tung-3'),
};

// ── TIMER ──
const turnTimer = { remaining: TURN_SECONDS, playerIdx: null, interval: null };
let lastTimerTurn = null;

function setRingProgress(playerIdx, fraction, warn) {
  const seat = seatEls[playerIdx];
  if (!seat) return;
  const fg = seat.querySelector('.seat-timer-fg');
  if (!fg) return;
  fg.style.strokeDashoffset = String(RING_CIRC * (1 - fraction));
  fg.classList.toggle('timer-warn', !!warn);
}

function clearTurnTimer() {
  if (turnTimer.interval) clearInterval(turnTimer.interval);
  turnTimer.interval = null;
}

function startTurnTimer(playerIdx) {
  clearTurnTimer();
  if (!state || state.over || state.phase !== 'playing') return;
  turnTimer.playerIdx = playerIdx;
  turnTimer.remaining = TURN_SECONDS;
  setRingProgress(playerIdx, 1, false);
  updateStatusBar();
  turnTimer.interval = setInterval(() => {
    turnTimer.remaining--;
    if (turnTimer.remaining <= 0) {
      clearTurnTimer();
      setRingProgress(playerIdx, 0, true);
      handleTurnTimeout(playerIdx);
      return;
    }
    setRingProgress(playerIdx, turnTimer.remaining / TURN_SECONDS, turnTimer.remaining <= 10);
    updateStatusBar();
  }, 1000);
}

function handleTurnTimeout(playerIdx) {
  if (!state || state.over) return;
  if (state.turn !== playerIdx) return;

  // Tự động đánh lá đầu tiên hoặc úp bài
  const hand = state.hands[playerIdx];
  const trick = state.tricks[state.tricks.length - 1];

  if (trick.leadSuit === null || trick.plays.length === 0) {
    if (hand.length > 0) {
      playCard(playerIdx, 0, false);
    }
  } else {
    // Đang phòng thủ: kiểm tra có bài đánh không
    let canPlay = false;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].sIdx === trick.leadSuit && hand[i].rIdx > trick.currentHighest.rIdx) {
        canPlay = true;
        playCard(playerIdx, i, false);
        break;
      }
    }
    if (!canPlay && hand.length > 0) {
      playCard(playerIdx, hand.length - 1, true);
    }
  }

  if (playerIdx === 0) state.selectedIdx = -1;
  render();
  maybeRunAi();
}

// ── RENDER ──
function render() {
  if (!state) return;

  // Tay người chơi
  myHandEl.innerHTML = '';
  const hand = state.hands[0];
  const isMyTurn = state.turn === 0 && !state.over && state.phase === 'playing' && !state.awaitingNextTrick;

  hand.forEach((c, i) => {
    const selected = i === state.selectedIdx;
    const wrap = document.createElement('div');
    wrap.className = 'card-slot' + (selected ? ' selected' : '') + (isMyTurn ? '' : ' disabled');
    wrap.dataset.key = cardKey(c);
    wrap.innerHTML = renderCardUI({ v: RANK_LABELS[c.rIdx], s: SUIT_LABELS[c.sIdx] });
    if (isMyTurn) {
      wrap.addEventListener('click', () => {
        state.selectedIdx = state.selectedIdx === i ? -1 : i;
        render();
      });
    }
    myHandEl.appendChild(wrap);
  });

  // Bàn chơi: hiển thị các lá đã đánh trong vòng hiện tại
  tableEl.innerHTML = '';
  const trick = state.tricks[state.tricks.length - 1];
  if (trick.plays && trick.plays.length > 0) {
    const container = document.createElement('div');
    container.className = 'ct-trick-cards';
    trick.plays.forEach((p, i) => {
      const cardWrap = document.createElement('div');
      cardWrap.className = 'ct-trick-card' + (p.faceDown ? ' folded' : ' played');
      if (p.faceDown) {
        cardWrap.innerHTML = renderCardUI(null, true);
      } else {
        cardWrap.innerHTML = renderCardUI({ v: RANK_LABELS[p.card.rIdx], s: SUIT_LABELS[p.card.sIdx] });
      }
      // Nhãn tên người chơi
      const label = document.createElement('div');
      label.className = 'ct-trick-label' + (p.playerIdx === trick.highestPlayer ? ' winner' : '') + (p.faceDown ? ' up' : ' danh');
      label.textContent = AI_NAMES[p.playerIdx];
      cardWrap.appendChild(label);
      container.appendChild(cardWrap);
    });
    tableEl.appendChild(container);
  } else {
    tableEl.innerHTML = '<span class="table-empty">— Đi tự do —</span>';
  }

  // Vòng hiện tại
  const roundDisplay = document.getElementById('ct-round-display');
  const tableArea = document.querySelector('.table-area');
  
  if (state.over) {
    roundDisplay.style.display = 'none';
    tableArea?.classList.remove('round-chung');
  } else {
    roundDisplay.style.display = '';

    // VÒNG CHƯNG BÀI (5-6): chỉ hiện tên giai đoạn, không đếm số vòng
    if (state.tungChecked && state.round >= 5) {
      roundDisplay.className = 'ct-round-display chung';
      roundDisplay.textContent = 'Chưng Bài';
      tableArea?.classList.add('round-chung');
    } else {
      roundDisplay.className = 'ct-round-display';
      roundDisplay.innerHTML = `Vòng <span id="ct-round-num">${state.round}</span>/4`;
      tableArea?.classList.remove('round-chung');
    }
  }

  // Ghế AI
  for (let i = 1; i <= 3; i++) {
    const seat = seatEls[i];
    const cntEl = countEls[i];
    const stEl = statusEls[i];
    const tungEl = tungBadgeEls[i];
    if (cntEl) cntEl.textContent = state.hands[i] ? `${state.hands[i].length} lá` : '0 lá';
    seat.classList.toggle('active-turn', state.turn === i && !state.over);

    const isAlive = state.trickWins[i] > 0;
    if (tungEl) {
      if (isAlive) {
        tungEl.style.display = '';
        tungEl.textContent = 'Tùng';
        tungEl.classList.remove('rot');
      } else if (state.tungChecked) {
        tungEl.style.display = '';
        tungEl.textContent = 'Rớt';
        tungEl.classList.add('rot');
      } else {
        tungEl.style.display = 'none';
        tungEl.classList.remove('rot');
      }
    }

    if (state.tungChecked || state.over) {
      seat.classList.toggle('dead', !isAlive);
    } else {
      seat.classList.remove('dead');
    }

    if (stEl) {
      stEl.className = 'seat-status';
      if (!state.over) {
        const trick = state.tricks[state.tricks.length - 1];
        const p = trick?.plays?.find(p => p.playerIdx === i);
        if (p) {
          stEl.textContent = p.faceDown ? 'Úp bài' : 'Đã đánh';
          stEl.classList.add(p.faceDown ? 'up-bai' : 'danh-bai');
          seat.classList.toggle('played', !p.faceDown);
          seat.classList.toggle('folded', p.faceDown);
        } else if (state.turn === i && !state.awaitingNextTrick) {
          stEl.textContent = 'Đang suy nghĩ...';
          stEl.classList.add('danh-bai');
        } else {
          stEl.textContent = '';
        }
      } else {
        stEl.textContent = '';
      }
    }
  }

  // Ghế người chơi (seat-0): hiển thị avatar + timer ring
  const seat0 = seatEls[0];
  seat0.style.display = '';
  const cnt0 = seat0.querySelector('.seat-count');
  if (cnt0) {
    cnt0.textContent = state.hands[0] ? `${state.hands[0].length} lá` : '0 lá';
  }
  const name0 = seat0.querySelector('.seat-name');
  if (name0) name0.textContent = 'Bạn';
  seat0.classList.toggle('active-turn', state.turn === 0 && !state.over);

  // Huy hiệu Tùng góc trái
  const tungBadgePlayer = document.getElementById('ct-my-tung-badge');
  if (state.trickWins[0] > 0) {
    tungBadgePlayer.style.display = '';
    tungBadgePlayer.textContent = 'Tùng';
    tungBadgePlayer.classList.remove('rot');
  } else if (state.tungChecked) {
    tungBadgePlayer.style.display = '';
    tungBadgePlayer.textContent = 'Rớt';
    tungBadgePlayer.classList.add('rot');
  } else {
    tungBadgePlayer.style.display = 'none';
    tungBadgePlayer.classList.remove('rot');
  }

  // Nút
  const myTurn = state.turn === 0 && !state.over && state.phase === 'playing' && !state.awaitingNextTrick;
  playBtn.style.display = myTurn ? '' : 'none';
  foldBtn.style.display = myTurn ? '' : 'none';
  playBtn.disabled = !myTurn || state.selectedIdx < 0;

  // Người chơi đã chết Tùng → không thể đánh, tự động úp
  if (myTurn && state.deadPlayers && state.deadPlayers.includes(0)) {
    playBtn.style.display = 'none';
    foldBtn.style.display = 'none';
  } else if (myTurn) {
    playBtn.style.display = '';
    foldBtn.style.display = '';
    // Úp bài: luôn cho phép (giữ lá lại) khi không phải người dẫn đầu vòng
    const trick = state.tricks[state.tricks.length - 1];
    if (trick.leadSuit !== null && trick.plays.length > 0) {
      const hasAnyPlayable = hasPlayableCard(state.hands[0], trick.leadSuit, trick.currentHighest);
      playBtn.disabled = state.selectedIdx < 0;
      foldBtn.disabled = state.selectedIdx < 0;
      playBtn.classList.toggle('pass-glow', !hasAnyPlayable);
      foldBtn.classList.toggle('pass-glow', !hasAnyPlayable);
    } else {
      playBtn.disabled = state.selectedIdx < 0;
      foldBtn.disabled = true;
      foldBtn.classList.remove('pass-glow');
      playBtn.classList.remove('pass-glow');
    }
  }

  updateStatusBar();
  newGameBtn.style.display = state.over ? '' : 'none';
  menuBtn.style.display = state.over ? '' : 'none';
  if (state.over) {
    clearTurnTimer();
    lastTimerTurn = null;
    settlePayout();
  } else if (state.awaitingNextTrick) {
    clearTurnTimer();
    lastTimerTurn = null;
  } else if (lastTimerTurn !== state.turn) {
    lastTimerTurn = state.turn;
    startTurnTimer(state.turn);
  }
}

function updateStatusBar() {
  if (!state) return;
  statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
  if (!state.over) {
    betEl.textContent = String(state.bet || 0);
    scoreEl.textContent = state.turn === 0 ? 'LƯỢT BẠN' : AI_NAMES[state.turn].toUpperCase();
    if (state.tungChecked && state.round >= 5) {
      scoreSubEl.textContent = 'Chưng Bài';
    } else {
      scoreSubEl.textContent = state.tricks[state.tricks.length - 1]?.leadSuit !== null
        ? `Vòng ${state.round}/4`
        : `Vòng ${state.round}/4 · Đi tự do`;
    }
    profitEl.textContent = String(turnTimer.remaining);
    profitEl.className = 'stat-profit timer-color' + (turnTimer.remaining <= 10 ? ' negative' : '');
    return;
  }
  scoreEl.textContent = currentNet >= 0 ? 'THẮNG' : 'THUA';
  scoreSubEl.textContent = '';
  profitEl.textContent = (currentNet > 0 ? '+' : '') + currentNet.toLocaleString('vi-VN');
  profitEl.className = 'stat-profit ' + (currentNet > 0 ? 'positive' : currentNet < 0 ? 'negative' : 'zero');
  statusBarEl.classList.add(currentNet >= 0 ? 'result-win' : 'result-lose');
}

window.backToSetup = function backToSetup() {
  gameScreen.style.display = 'none';
  setupBar.style.display = '';
  statusBarEl.style.display = 'none';
  newGameBtn.style.display = 'none';
  menuBtn.style.display = 'none';
  clearTurnTimer();
  clearTrickFreeze();
  state = null;
  lastTimerTurn = null;
};

window.restartGame = function() {
  const bet = state?.bet || 100;
  payoutSettled = false;
  newGameBtn.style.display = 'none';
  menuBtn.style.display = 'none';
  clearTrickFreeze();
  newGame(bet, buffPct);
  lastTimerTurn = null;
  render();
  maybeRunAi();
};

// ── SETTLEMENT ──
async function settlePayout() {
  if (payoutSettled) return;
  payoutSettled = true;
  const net = currentNet;
  try {
    if (net !== 0) {
      await addPoints('Casino', net > 0 ? 'Thắng Cát Tê' : 'Thua Cát Tê', net, false);
    }
  } catch (e) {
    console.error(e);
  }
}

function forfeitIfAbandoned() {
  if (!state || state.over || payoutSettled) return;
  payoutSettled = true;
  const bet = state.bet || 100;
  addPoints('Casino', 'Cát Tê out - mất cược', -bet, false).catch(() => {});
}
window.addEventListener('pagehide', forfeitIfAbandoned);
window.addEventListener('beforeunload', forfeitIfAbandoned);

// ── ACTION HANDLERS ──
function afterPlayerAction() {
  state.selectedIdx = -1;
  render();
  maybeRunAi();
}

function maybeRunAi() {
  if (!state || state.over) { render(); return; }

  if (state.awaitingNextTrick) { render(); scheduleTrickAdvance(); return; }

  if (state.turn === 0) { render(); return; }
  const p = state.turn;
  render();
  runAiTurn(p, () => {
    afterAiStep();
  });
}

function afterAiStep() {
  maybeRunAi();
}

// ── EVENTS ──
onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = 'index.html'; return; }
  loadPetBuff();
});

function loadPetBuff() {
  if (!buffLoadPromise) {
    buffLoadPromise = getActiveBuff()
      .then(buff => { buffPct = buff > 0 ? buff : 0; return buffPct; })
      .catch(() => { buffPct = 0; return 0; });
  }
  return buffLoadPromise;
}

startBtn.addEventListener('click', async () => {
  const bet = Math.max(10, parseInt(betInput.value, 10) || 100);
  await loadPetBuff();
  payoutSettled = false;
  clearTrickFreeze();
  newGame(bet, buffPct);
  lastTimerTurn = null;
  setupBar.style.display = 'none';
  gameScreen.style.display = '';
  statusBarEl.style.display = '';
  render();
  maybeRunAi();
});

playBtn.addEventListener('click', () => {
  if (state.selectedIdx < 0) {
    window.showToast?.('Chọn 1 lá bài trước!', 'warn');
    return;
  }
  const res = playCard(0, state.selectedIdx, false);
  if (!res.ok) {
    if (res.mustFold) {
      window.showToast?.('Không có bài đánh! Bấm "Úp bài"', 'warn');
    } else {
      window.showToast?.(res.msg, 'error');
    }
    return;
  }
  afterPlayerAction();
});

foldBtn.addEventListener('click', () => {
  if (state.selectedIdx < 0) {
    window.showToast?.('Chọn lá muốn úp!', 'warn');
    return;
  }
  const trick = state.tricks[state.tricks.length - 1];
  if (trick.leadSuit === null || trick.plays.length === 0) {
    window.showToast?.('Đang dẫn đầu, không thể úp bài!', 'warn');
    return;
  }
  const res = playCard(0, state.selectedIdx, true);
  if (!res.ok) {
    window.showToast?.(res.msg, 'error');
    return;
  }
  afterPlayerAction();
});