// ==================== BÀI NÓI DỐI — 4 NGƯỜI (1 người + 3 máy) ====================
import { renderCardUI } from '../../cards.js';
import { auth, db } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addPoints } from '../../points.js';
import { getActiveBuff } from '../../pet.js';
import { renderAvatar } from '../../avatar.js';

const SUIT_NAMES = ['♠', '♣', '♦', '♥'];
const SUIT_EMOJIS = { '♠': '♠️', '♣': '♣️', '♦': '♦️', '♥': '♥️' };
const SUIT_RANK = { '♠': 0, '♣': 1, '♦': 2, '♥': 3 };
const VAL_RANK = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
const PLAYER_NAMES = ['Bạn', 'Minh', 'Hoa', 'Tuấn'];
const TURN_SECONDS = 30;
const RING_CIRC = 113;
const WIRE_COLORS = ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6'];

// Giới hạn số lá đánh dựa trên số bài còn lại
function handSizeLimit(size) {
  if (size <= 1) return 1;
  return Math.min(3, size - 1);
}

// --- TRẠNG THÁI ---
let state = null;
let playerProfile = null; // { nickname, avatarUrl } từ Firestore
let turnTimer = { remaining: 0, playerIdx: null, interval: null };
let payoutSettled = false;
let lastTimerTurn = null;

function buildDeck() {
  const suits = ['♠','♣','♦','♥'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const s of suits) {
    for (const v of values) deck.push({ s, v });
  }
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
  return [...hand].sort((a, b) => SUIT_RANK[a.s] - SUIT_RANK[b.s] || VAL_RANK[a.v] - VAL_RANK[b.v]);
}
function cardKey(c) { return `${c.v}-${c.s}`; }

// === SPINNER CHỌN NGƯỜI ĐI ĐẦU ===
function showStarterSpinner(onComplete) {
  const overlay = document.getElementById('bnd-spinner-overlay');
  const wheel = document.getElementById('bnd-spinner-wheel');

  const spinnerColors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7'];
  const segmentAngle = 360 / 4;
  const picked = Math.floor(Math.random() * 4);

  // Set conic gradient background
  let gradientParts = [];
  for (let i = 0; i < 4; i++) {
    const from = i * segmentAngle;
    const to = (i + 1) * segmentAngle;
    gradientParts.push(`${spinnerColors[i]} ${from}deg ${to}deg`);
  }
  wheel.style.background = `conic-gradient(${gradientParts.join(', ')})`;

  // Add player labels
  const existingLabels = wheel.querySelectorAll('.bnd-spinner-label');
  existingLabels.forEach(el => el.remove());
  for (let i = 0; i < 4; i++) {
    const label = document.createElement('div');
    label.className = 'bnd-spinner-label';
    const angle = i * segmentAngle + segmentAngle / 2;
    const rad = (angle - 90) * Math.PI / 180;
    const r = 62;
    const cx = 100, cy = 100;
    label.textContent = PLAYER_NAMES[i];
    label.style.left = `${cx + r * Math.cos(rad) - 20}px`;
    label.style.top = `${cy + r * Math.sin(rad) - 6}px`;
    label.style.width = '40px';
    label.style.textAlign = 'center';
    wheel.appendChild(label);
  }

  // Reset wheel position
  wheel.classList.add('prepare');
  wheel.offsetHeight; // force reflow
  wheel.classList.remove('prepare');

  // Calculate rotation: multiple full spins + offset to land on picked segment
  // Pointer is at top (0deg). Segment i spans from i*90 to (i+1)*90 deg.
  // To land on segment i, we need the pointer at i*90 + 45 (middle of segment)
  // CSS rotation is clockwise, so we rotate counter-clockwise by the segment mid
  const targetDeg = picked * segmentAngle + segmentAngle / 2;
  const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
  const totalRotation = fullSpins * 360 + (360 - targetDeg);

  overlay.style.display = 'flex';

  // Start spin after a brief delay
  setTimeout(() => {
    wheel.style.transform = `rotate(${totalRotation}deg)`;
  }, 100);

  // After spin animation ends — làm mờ các ô không trúng, sáng ô trúng
  const spinDuration = 3900;
  setTimeout(() => {
    const labels = wheel.querySelectorAll('.bnd-spinner-label');
    labels.forEach((label, i) => {
      if (i === picked) {
        label.classList.add('winner');
      } else {
        label.classList.add('dim');
      }
    });

    setTimeout(() => {
      overlay.style.display = 'none';
      onComplete(picked);
    }, 1200);
  }, spinDuration);
}

// === KHỞI TẠO VÁN ===
function newGame(bet = 100, buffPct = 0, starter = null) {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  hands.forEach((h, i) => { hands[i] = sortHand(h); });

  // Xác định người đi đầu
  let firstPlayer = 0;
  if (starter !== null && starter >= 0 && starter < 4) {
    firstPlayer = starter;
  } else {
    // Tìm người có 2♠ (bài nhỏ nhất) nếu không có starter
    for (let i = 0; i < 4; i++) {
      const c = hands[i][0];
      if (c.v === '2' && c.s === '♠') { firstPlayer = i; break; }
    }
  }

  state = {
    hands,
    turn: firstPlayer,
    pile: [],          // [{by: playerIdx, cards: [...], declare: suit}]
    selected: new Set(),
    currentSuit: null,  // chất đang được giữ (persistent)
    bombWires: [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]],
    alive: [true, true, true, true],
    finished: [],       // players who emptied hand
    phase: 'playing',
    seatStatus: {},
    lastPlaySeq: 0,
    justPlayed: null,
    revealedPile: null, // {by, cards, declare} của lượt bị tố cáo (hiển thị face-up)
    over: false,
    betAmount: bet,
    buffPct,
    currentBet: bet,
    log: [],
  };
  return state;
}

// === LƯỢT CHƠI ===
function playCards(playerIdx, cards, declareSuit) {
  if (!state || state.over) return { ok: false, msg: 'Ván đã kết thúc' };
  if (state.turn !== playerIdx) return { ok: false, msg: 'Chưa đến lượt bạn' };
  if (!cards || cards.length === 0) return { ok: false, msg: 'Phải đánh ít nhất 1 lá' };
  const maxPlay = handSizeLimit(state.hands[playerIdx].length);
  if (cards.length > maxPlay) return { ok: false, msg: `Chỉ được đánh tối đa ${maxPlay} lá` };
  if (!declareSuit || !SUIT_NAMES.includes(declareSuit)) return { ok: false, msg: 'Phải chọn chất' };

  // Chất đã cố định — người chơi PHẢI khai chất đó (nhưng có thể đánh bài khác chất để bluff)
  if (state.currentSuit && declareSuit !== state.currentSuit) {
    return { ok: false, msg: `Phải khai chất ${SUIT_EMOJIS[state.currentSuit] || state.currentSuit}` };
  }
  if (!state.currentSuit) {
    state.currentSuit = declareSuit; // thiết lập chất cố định
  }

  const hand = state.hands[playerIdx];
  const keys = new Set(cards.map(cardKey));
  const filtered = hand.filter(c => !keys.has(cardKey(c)));
  if (hand.length - filtered.length !== cards.length) return { ok: false, msg: 'Lá bài không hợp lệ' };
  state.hands[playerIdx] = filtered;

  state.pile.push({ by: playerIdx, cards: [...cards], declare: declareSuit });
  state.lastPlaySeq++;
  state.justPlayed = playerIdx;
  for (const k in state.seatStatus) if (state.seatStatus[k] === 'played') delete state.seatStatus[k];
  state.seatStatus[playerIdx] = 'played';

  // Kiểm tra hết bài
  if (state.hands[playerIdx].length === 0 && state.alive[playerIdx]) {
    state.finished.push(playerIdx);
    if (state.finished.length === 1) {
      state.over = true;
      settlePayout();
      return { ok: true, win: true };
    }
  }

  advanceTurn();
  return { ok: true };
}

function callBluff(callerIdx) {
  if (!state || state.over) return { ok: false, msg: 'Ván đã kết thúc' };
  if (state.turn !== callerIdx) return { ok: false, msg: 'Chưa đến lượt bạn' };
  if (state.pile.length === 0) return { ok: false, msg: 'Không có bài để tố cáo' };

  const last = state.pile[state.pile.length - 1];
  const targetIdx = last.by;
  if (targetIdx === callerIdx) return { ok: false, msg: 'Không thể tố cáo chính mình' };
  if (!state.alive[targetIdx]) return { ok: false, msg: 'Người đó đã bị loại' };

  // Nếu BẤT KỲ lá nào khác chất khai báo → nói dối
  const isBluff = last.cards.some(c => c.s !== last.declare);
  const callerCorrect = isBluff;

  // Người thua: nếu callerCorrect=true → target (người nói dối) thua
  // Nếu callerCorrect=false → caller (người tố cáo sai) thua
  const loser = callerCorrect ? targetIdx : callerIdx;
  const winner = callerCorrect ? callerIdx : targetIdx;

  // Lưu lại bài của người bị tố cáo để hiển thị face-up
  state.revealedPile = { 
    by: targetIdx, 
    cards: [...last.cards], 
    declare: last.declare, 
    isBluff,
    caller: callerIdx 
  };
  // Gom hết bài trên bàn vào tay người thua
  const allPileCards = state.pile.flatMap(p => p.cards);
  state.pile = [];
  state.hands[loser].push(...allPileCards);
  sortHand(state.hands[loser]);

  // Xoá seatStatus
  for (const k in state.seatStatus) delete state.seatStatus[k];

  // Số dây boom còn lại — popup sẽ xử lý cắt dây
  const wireStates = state.bombWires[loser];
  const remainingWires = wireStates.filter(Boolean).length;

  return { ok: true, bombLoser: loser, needPopup: true, winner, isBluff, targetIdx, callerIdx, remainingWires };
}

function nextAliveAfter(idx) {
  if (!state) return 0;
  for (let i = 1; i <= 4; i++) {
    const n = (idx + i) % 4;
    if (state.alive[n] && !state.finished.includes(n)) return n;
  }
  return idx; // shouldn't happen
}

function advanceTurn() {
  if (!state || state.over) return;
  const alivePlayers = [];
  for (let i = 0; i < 4; i++) {
    if (state.alive[i] && !state.finished.includes(i)) alivePlayers.push(i);
  }
  if (alivePlayers.length <= 1) {
    state.over = true;
    return;
  }
  let next = (state.turn + 1) % 4;
  let attempts = 0;
  while (attempts < 4 && (!state.alive[next] || state.finished.includes(next))) {
    next = (next + 1) % 4;
    attempts++;
  }
  state.turn = next;
}

// === AI ===
function aiDecide(playerIdx) {
  if (!state || state.over) return { type: 'pass' };
  const hand = state.hands[playerIdx];
  if (!hand || hand.length === 0) return { type: 'pass' };

  // AI có thể tố cáo (30%) hoặc đánh bài (70%)
  const lastPlay = state.pile.length > 0 ? state.pile[state.pile.length - 1] : null;
  const canCall = lastPlay && lastPlay.by !== playerIdx && state.alive[lastPlay.by];

  if (canCall && Math.random() < 0.3) {
    return { type: 'call' };
  }

  // Xác định chất cố định — AI phải khai chất này
  const forcedSuit = state.currentSuit || (lastPlay ? lastPlay.declare : null);

  // AI có thể chọn bài BẤT KỲ (kể cả khác chất) để bluff
  const aiMax = handSizeLimit(hand.length);
  const maxCards = Math.min(hand.length, Math.floor(Math.random() * aiMax) + 1);
  const cards = [];
  const used = new Set();
  for (let i = 0; i < maxCards; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * hand.length); } while (used.has(idx));
    used.add(idx);
    cards.push(hand[idx]);
  }

  let declareSuit;
  if (forcedSuit) {
    declareSuit = forcedSuit;
    // Random quyết định nói thật (55%) hay bluff (45%)
    const hasCorrectSuit = cards.some(c => c.s === forcedSuit);
    if (hasCorrectSuit && Math.random() < 0.55) {
      // NÓI THẬT: TẤT CẢ lá bài phải đúng chất (nếu có lá sai chất là bluff)
      const correctCards = cards.filter(c => c.s === forcedSuit);
      // Chỉ giữ lại các lá đúng chất
      return { type: 'play', cards: correctCards, declare: declareSuit };
    }
    // BLUFF (45%): giữ nguyên cards (không cần đúng chất)
    // Nếu không có lá đúng chất → đành bluff
  } else {
    // Lần đầu: chọn chất tự do (40% bluff, 60% nói thật)
    if (cards.length > 0 && Math.random() < 0.6) {
      declareSuit = cards[0].s;
    } else {
      const actualSuits = new Set(cards.map(c => c.s));
      const otherSuits = SUIT_NAMES.filter(s => !actualSuits.has(s));
      if (otherSuits.length > 0) {
        declareSuit = otherSuits[Math.floor(Math.random() * otherSuits.length)];
      } else {
        declareSuit = SUIT_NAMES[(SUIT_RANK[cards[0].s] + 1) % 4];
        if (cards.every(c => c.s === declareSuit)) declareSuit = SUIT_NAMES[(SUIT_RANK[cards[0].s] + 2) % 4];
      }
    }
  }
  return { type: 'play', cards, declare: declareSuit };
}

function runAiTurn(playerIdx, onDone) {
  setTimeout(() => {
    if (!state || state.over) { onDone?.(); return; }
    const decision = aiDecide(playerIdx);
    if (decision.type === 'call') {
      const res = callBluff(playerIdx);
      if (res.ok) {
        state.justPlayed = playerIdx;
        render();  // Hiển thị bài face-up trên bàn
        if (res.needPopup) {
          // Chờ 3s để người chơi thấy bài bị lật, sau đó mới hiện popup cắt dây
          setTimeout(() => {
            handleWirePopup(res, () => {
              state.revealedPile = null;
              render();
              onDone?.();
            });
          }, 3000);
        } else {
          state.revealedPile = null;
          onDone?.();
        }
      } else {
        // Nếu không thể tố cáo, đánh bài
        const fallback = aiDecide(playerIdx);
        if (fallback.type === 'play') {
          playCards(playerIdx, fallback.cards, fallback.declare);
          render();
        }
        onDone?.();
      }
    } else if (decision.type === 'play') {
      playCards(playerIdx, decision.cards, decision.declare);
      render();
      onDone?.();
    } else {
      // Pass: advance turn để không treo game
      advanceTurn();
      onDone?.();
    }
  }, 2000 + Math.random() * 1500);
}

// === XỬ LÝ KẾT QUẢ CẮT DÂY ===
function processWireCutResult(isBoom, loser, winner, cutWireIdx, onDone) {
  if (isBoom) {
    state.bombWires[loser] = [false, false, false, false];
    state.alive[loser] = false;
    state.hands[loser] = [];
    if (loser === 0) {
      // Người chơi nổ → kết thúc ván
      state.over = true;
      if (!state.finished.includes(winner)) state.finished.push(winner);
    }
    // Máy nổ → vẫn tiếp tục
  } else {
    // An toàn: cắt dây đó — set thành false
    if (cutWireIdx !== undefined && cutWireIdx >= 0 && cutWireIdx < 4) {
      state.bombWires[loser][cutWireIdx] = false;
    }
  }

  // Kiểm tra hết bài cho người thắng
  if (!state.over && state.hands[winner].length === 0 && state.alive[winner]) {
    state.finished.push(winner);
    if (state.finished.length === 1) {
      state.over = true;
    }
  }

  // Người BẮT BÀI (winner) được chọn chất mới
  if (!state.over) {
    state.currentSuit = null; // xoá chất cố định, winner sẽ chọn chất mới
    state.turn = winner;
  }

  onDone?.();
}

// === POPUP CẮT DÂY — LUXURY BOMB DESIGN ===
function handleWirePopup(result, onDone) {
  const popup = document.getElementById('bnd-wire-popup');
  const loser = result.bombLoser;
  const winner = result.winner;
  const names = PLAYER_NAMES;
  const remaining = result.remainingWires;
  const wireStates = state.bombWires[loser]; // boolean array [true,true,true,true]

  if (remaining <= 0) {
    processWireCutResult(true, loser, winner, -1, () => {
      render();
      showBombOverlay(loser);
      if (state.over) settlePayout();
      onDone?.();
    });
    return;
  }

  // Find active wire indices
  const activeIndices = [];
  for (let i = 0; i < 4; i++) {
    if (wireStates[i]) activeIndices.push(i);
  }

  // Boom is randomly among active wires
  const boomActiveIdx = Math.floor(Math.random() * activeIndices.length);
  const boomWireIdx = activeIndices[boomActiveIdx];

  // Build wires HTML — always show 4 wires
  function buildWiresHTML() {
    let dotsHTML = '';
    let cablesHTML = '';
    for (let i = 0; i < 4; i++) {
      const isCut = !wireStates[i];
      const cutClass = isCut ? ' cut' : '';
      const color = WIRE_COLORS[i];

      dotsHTML += `<div class="bnd-wire-col" data-wire="${i}" style="--wire-color:${color}">
        <div class="bnd-wire-dot${cutClass}" style="--wire-color:${color}"></div>
      </div>`;
      cablesHTML += `<div style="width:32px;display:flex;justify-content:center;align-items:flex-start">
          <div class="bnd-wire-cable${cutClass}" style="--wire-color:${color}"></div>
        </div>`;
    }
    return { dotsHTML, cablesHTML };
  }

  const initial = buildWiresHTML();

  popup.style.display = 'flex';
  popup.className = 'bnd-wire-popup active';
  popup.innerHTML = `
    <div class="bnd-wire-content">
      <div class="bnd-wire-header">💣 <span class="bnd-wire-header-name">${names[loser]}</span> bị phát hiện!</div>
      <div class="bnd-wire-body">
        <div class="bnd-bomb-diagram">
          <div class="bnd-wire-dots-row">${initial.dotsHTML}</div>
          <div class="bnd-wire-cables-row">${initial.cablesHTML}</div>
          <div class="bnd-wire-horizontal-track">
            <div class="bnd-wire-hbar"></div>
            <div class="bnd-wire-drop"></div>
          </div>
          <div class="bnd-bomb-icon" id="bnd-bomb-icon">
            <img src="boom.png" alt="Boom!"/>
          </div>
        </div>
        <div class="bnd-wire-status idle" id="bnd-wire-status-text">🔧 Chọn dây để cắt...</div>
      </div>
    </div>`;

  let handled = false;

  function handlePick(wireIdx) {
    if (handled) return;
    handled = true;

    const isBoom = wireIdx === boomWireIdx;
    const statusText = document.getElementById('bnd-wire-status-text');
    const bombIcon = document.getElementById('bnd-bomb-icon');

    // Mark chosen wire as cut visually
    const cols = popup.querySelectorAll('.bnd-wire-col');
    cols.forEach((col, i) => {
      if (i !== wireIdx) {
        col.style.opacity = '0.25';
        col.style.pointerEvents = 'none';
      }
    });

    const chosenDot = popup.querySelector(`.bnd-wire-col[data-wire="${wireIdx}"] .bnd-wire-dot`);
    const chosenCable = popup.querySelectorAll('.bnd-wire-cable')[wireIdx];

    if (chosenDot) chosenDot.classList.add('cut');
    if (chosenCable) chosenCable.classList.add('cut');

    if (isBoom) {
      // BOOM!
      bombIcon.innerHTML = '💥';
      bombIcon.className = 'bnd-bomb-icon shake';
      statusText.textContent = '💥 NỔ BOOM!';
      statusText.className = 'bnd-wire-status boom';

      // Flash the chosen wire
      chosenDot.style.animation = 'wireFlash 0.3s ease-out 4';
      chosenDot.style.boxShadow = '0 0 40px rgba(255,200,0,0.8)';

      // Cut the horizontal wire and drop too
      const hbar = popup.querySelector('.bnd-wire-hbar');
      const drop = popup.querySelector('.bnd-wire-drop');
      if (hbar) { hbar.style.height = '0'; hbar.style.opacity = '0'; }
      if (drop) { drop.style.height = '0'; drop.style.opacity = '0'; }

      setTimeout(() => {
        popup.style.display = 'none';
        popup.className = 'bnd-wire-popup';
        processWireCutResult(true, loser, winner, wireIdx, () => {
          render();
          showBombOverlay(loser);
          if (state.over) settlePayout();
          onDone?.();
        });
      }, 2000);
    } else {
      // Safe!
      bombIcon.innerHTML = '<img src="boom.png" alt="Safe" style="filter:drop-shadow(0 0 20px rgba(34,197,94,0.5))"/>';
      bombIcon.className = 'bnd-bomb-icon';
      statusText.textContent = '✅ An toàn! Cắt thành công!';
      statusText.className = 'bnd-wire-status safe';

      // Animate the wire disappearing
      chosenDot.style.transition = 'all 0.4s ease-out';
      chosenDot.style.transform = 'scale(0)';

      setTimeout(() => {
        popup.style.display = 'none';
        popup.className = 'bnd-wire-popup';
        processWireCutResult(false, loser, winner, wireIdx, () => {
          render();
          onDone?.();
        });
      }, 1200);
    }
  }

  // Assign click handlers
  if (loser === 0) {
    const cols = popup.querySelectorAll('.bnd-wire-col');
    cols.forEach((col, i) => {
      if (wireStates[i]) {
        // Only active (uncut) wires are clickable
        col.classList.add('clickable');
        col.style.cursor = 'pointer';
        col.addEventListener('click', () => {
          const idx = parseInt(col.dataset.wire);
          handlePick(idx);
        });
      } else {
        col.style.opacity = '0.35';
        col.style.pointerEvents = 'none';
      }
    });
  } else {
    // AI auto-picks after delay
    setTimeout(() => {
      const active = activeIndices;
      const pick = active[Math.floor(Math.random() * active.length)];
      handlePick(pick);
    }, 2000 + Math.random() * 1500);
  }
}

// === TIMER ===
function clearTurnTimer() {
  if (turnTimer.interval) clearInterval(turnTimer.interval);
  turnTimer.interval = null;
}

function startTurnTimer(playerIdx) {
  clearTurnTimer();
  if (!state || state.over) return;
  turnTimer.playerIdx = playerIdx;
  turnTimer.remaining = TURN_SECONDS;
  setRingProgress(playerIdx, 1, false);
  updateStatusBar();
  turnTimer.interval = setInterval(() => {
    turnTimer.remaining--;
    if (turnTimer.remaining <= 0) {
      clearTurnTimer();
      setRingProgress(playerIdx, 0, true);
      handleTimeout(playerIdx);
      return;
    }
    setRingProgress(playerIdx, turnTimer.remaining / TURN_SECONDS, turnTimer.remaining <= 10);
    updateStatusBar();
  }, 1000);
}

function setRingProgress(playerIdx, fraction, warn) {
  const seat = document.getElementById(`seat-${playerIdx}`);
  if (!seat) return;
  const fg = seat.querySelector('.seat-timer-fg');
  if (!fg) return;
  fg.style.strokeDashoffset = String(RING_CIRC * (1 - fraction));
  fg.classList.toggle('timer-warn', !!warn);
}

function handleTimeout(playerIdx) {
  if (!state || state.over || state.turn !== playerIdx) return;
  // Hết giờ: tự động đánh 1 lá rẻ nhất (hoặc tố cáo nếu có thể)
  const lastPlay = state.pile.length > 0 ? state.pile[state.pile.length - 1] : null;
  if (lastPlay && lastPlay.by !== playerIdx && state.alive[lastPlay.by] && Math.random() < 0.3) {
    const res = callBluff(playerIdx);
    if (res.ok) {
      render();
      if (res.needPopup) {
        setTimeout(() => {
          handleWirePopup(res, () => { state.revealedPile = null; render(); maybeRunAi(); });
        }, 3000);
      } else {
        state.revealedPile = null;
        maybeRunAi();
      }
      return;
    }
  }
  const hand = state.hands[playerIdx];
  if (hand && hand.length > 0) {
    const card = hand[0]; // lá yếu nhất (đã sort)
    // Khai chất theo chất cố định nếu có, không thì theo chất lá bài
    const declare = state.currentSuit || card.s;
    playCards(playerIdx, [card], declare);
  }
  render();
  maybeRunAi();
}

const seatEls = {
  0: document.getElementById('seat-0'),
  1: document.getElementById('seat-1'),
  2: document.getElementById('seat-2'),
  3: document.getElementById('seat-3'),
};

// === RENDER ===
let currentDeclare = null; // chất người chơi đã chọn

function renderCard(c, selected = false) {
  const wrap = document.createElement('div');
  wrap.className = 'card-slot' + (selected ? ' selected' : '');
  wrap.dataset.key = cardKey(c);
  wrap.innerHTML = renderCardUI({ v: c.v, s: c.s });
  return wrap;
}

function renderFaceDown() {
  const wrap = document.createElement('div');
  wrap.className = 'card-slot';
  wrap.innerHTML = renderCardUI({ v: '', s: '' }, true);
  return wrap;
}

function render() {
  if (!state) return;

  // Tay người chơi
  const myHandEl = document.getElementById('my-hand');
  myHandEl.innerHTML = '';
  const hand = state.hands[0];
  if (hand && hand.length > 0 && state.alive[0]) {
    hand.forEach(c => {
      const selected = state.selected.has(cardKey(c));
      const el = renderCard(c, selected);
      el.addEventListener('click', () => {
        if (state.turn !== 0 || state.over) return;
        const k = cardKey(c);
        // Bài Nói Dối: người chơi có thể chọn BẤT KỲ lá nào (để bluff), không giới hạn chất
        if (state.selected.has(k)) {
          state.selected.delete(k);
        } else if (state.selected.size < handSizeLimit(hand.length)) {
          state.selected.add(k);
        } else {
          window.showToast?.('Chỉ được chọn tối đa 3 lá!', 'warn');
        }
        render();
      });
      myHandEl.appendChild(el);
    });
  } else if (state.alive[0] === false) {
    myHandEl.innerHTML = '<div style="color:#ef4444;font-size:14px;font-weight:700;padding:20px">💥 NỔ BOOM! Bạn đã bị loại</div>';
  } else if (state.finished.includes(0)) {
    myHandEl.innerHTML = '<div style="color:#34d399;font-size:14px;font-weight:700;padding:20px">🎉 Bạn hết bài!</div>';
  } else {
    myHandEl.innerHTML = '<div style="color:#64748b;font-size:13px;padding:20px">⏳ Đang chờ...</div>';
  }

  // Bàn: bài trên bàn + bài bị tố cáo face-up
  const tableEl = document.getElementById('table-combo');
  tableEl.innerHTML = '';

  // Hiển thị bài bị tố cáo (face-up) trên bàn — KHÔNG phải trong popup
  if (state.revealedPile && state.revealedPile.cards && state.revealedPile.cards.length > 0) {
    const rp = state.revealedPile;
    const group = document.createElement('div');
    group.className = 'table-play-group';
    const inner = document.createElement('div');
    inner.className = 'table-play-inner bnd-revealed-cards';
    rp.cards.forEach(c => {
      const card = renderCard(c);
      card.style.animation = 'revealFlip 0.5s ease-out';
      inner.appendChild(card);
    });
    const actualSuits = [...new Set(rp.cards.map(c => c.s))];
    const actualSuitsStr = actualSuits.map(s => SUIT_EMOJIS[s] || s).join('');
    const isBluff = rp.isBluff;
    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.9);padding:2px 10px;border-radius:6px';
    label.textContent = `${PLAYER_NAMES[rp.by]}: nói ${SUIT_EMOJIS[rp.declare] || rp.declare} → thực tế ${actualSuitsStr} · ${isBluff ? 'NÓI DỐI!' : 'NÓI THẬT'}`;
    if (isBluff) { label.style.color = '#f87171'; label.style.background = 'rgba(239,68,68,0.15)'; }
    else { label.style.color = '#34d399'; label.style.background = 'rgba(52,211,153,0.15)'; }
    inner.style.position = 'relative';
    inner.style.paddingBottom = '28px';
    inner.style.transform = 'scale(1.05)';
    inner.appendChild(label);
    group.appendChild(inner);
    tableEl.appendChild(group);
  } else if (state.pile.length > 0) {
    const offsets = [{ x: 0, y: 0 }, { x: 18, y: -18 }, { x: -18, y: -34 }];
    const start = Math.max(0, state.pile.length - 3);
    const visiblePile = state.pile.slice(start);
    visiblePile.forEach((entry, idx) => {
      const group = document.createElement('div');
      const back = visiblePile.length - 1 - idx;
      group.className = 'table-play-group' + (back > 0 ? ' table-play-old' : '');
      group.style.zIndex = idx + 1;
      const off = offsets[back] || offsets[offsets.length - 1];
      group.style.transform = `translate(${off.x}px, ${off.y}px)`;
      const inner = document.createElement('div');
      inner.className = 'table-play-inner';
      // Luôn hiển thị lá bài úp
      entry.cards.forEach(() => inner.appendChild(renderFaceDown()));
      // Thêm nhãn chất đã tuyên bố
      const label = document.createElement('div');
      label.style.cssText = 'position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;color:#fbbf24;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8)';
      label.textContent = `${PLAYER_NAMES[entry.by]}: ${SUIT_EMOJIS[entry.declare] || entry.declare}`;
      inner.style.position = 'relative';
      inner.appendChild(label);
      if (back === 0) inner.classList.add('play-in', `from-${entry.by}`);
      group.appendChild(inner);
      tableEl.appendChild(group);
    });
  } else if (!state.revealedPile) {
    tableEl.innerHTML = '<div class="table-empty">— Bàn trống —</div>';
  }    // Ghế
  for (let i = 0; i < 4; i++) {
    const seat = document.getElementById(`seat-${i}`);
    if (!seat) continue;
    const alive = state.alive[i];
    const isDead = !alive;
    const cnt = seat.querySelector('.seat-count');
    if (cnt) {
      if (isDead) cnt.textContent = '';
      else if (state.finished.includes(i)) cnt.textContent = '🏆';
      else cnt.textContent = `${state.hands[i].length} lá`;
    }
    const name = seat.querySelector('.seat-name');
    if (name) {
      name.textContent = alive ? PLAYER_NAMES[i] : PLAYER_NAMES[i];
      name.style.color = isDead ? '#ef4444' : '';
    }
    // Avatar khớp vòng tròn — lấp đầy badge, che tên + số lá
    if (i === 0 && playerProfile) {
      const badge = seat.querySelector('.seat-badge');
      if (badge && !badge.querySelector('.seat-avatar')) {
        badge.style.padding = '0';
        badge.innerHTML = '';
        const av = document.createElement('div');
        av.className = 'seat-avatar';
        av.style.cssText = 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#fff;overflow:hidden';
        badge.appendChild(av);
        renderAvatar(av, playerProfile, '100%');
      } else if (badge) {
        const av = badge.querySelector('.seat-avatar');
        if (av) renderAvatar(av, playerProfile, '100%');
      }
    }
    const ring = seat.querySelector('.seat-ring');
    if (ring) ring.style.opacity = alive ? '1' : '0.3';
    // Ghế chết: đỏ và mờ
    seat.classList.toggle('seat-dead', isDead);

    seat.classList.toggle('active-turn', state.turn === i && !state.over && alive);
    seat.classList.toggle('seat-passed', state.seatStatus[i] === 'passed');
    seat.classList.toggle('seat-played', state.seatStatus[i] === 'played');

    // Dây boom — 4 dây màu sắc
    const wiresEl = document.getElementById(`wires-${i}`);
    if (wiresEl) {
      wiresEl.innerHTML = '';
      if (alive) {
        if (i === 0) {
          wiresEl.className = 'player-seat-wires';
        } else {
          wiresEl.className = 'seat-wires top-center';
        }
        // Luôn hiển thị 4 chấm — đã cắt thì rỗng ruột
        const wireBools = state.bombWires[i];
        for (let w = 0; w < 4; w++) {
          const dot = document.createElement('span');
          const isActive = wireBools[w];
          dot.className = 'bnd-wire-dot-seat ' + (isActive ? 'active' : 'cut');
          dot.style.setProperty('--dot-color', WIRE_COLORS[w]);
          if (isActive && i === 0) {
            // Player's uncut wires pulse subtly
            dot.classList.add('pulse');
          }
          wiresEl.appendChild(dot);
        }
      }
    }

    // Status
    const statusEl = document.getElementById(`bnd-status-${i}`);
    if (statusEl) {
      if (isDead) { statusEl.textContent = 'Đã chết'; statusEl.className = 'seat-status seat-dead-status'; }
      else if (state.finished.includes(i)) { statusEl.textContent = '🏆 Hết bài!'; statusEl.className = 'seat-status play-status'; }
      else if (state.seatStatus[i] === 'played') { statusEl.textContent = 'Đã đánh'; statusEl.className = 'seat-status play-status'; }
      else { statusEl.textContent = ''; statusEl.className = 'seat-status'; }
    }
  }

  // Round info — chỉ hiển thị chất
  const roundInfo = document.getElementById('bnd-round-info');
  if (roundInfo) {
    roundInfo.textContent = state.over
      ? '🏁'
      : state.currentSuit ? `${SUIT_EMOJIS[state.currentSuit]}` : '🎯';
  }

  const lastPlay = state.pile.length > 0 ? state.pile[state.pile.length - 1] : null;
  const myTurn = state.turn === 0 && !state.over && state.alive[0];

  const actions = document.getElementById('bnd-actions');
  const declareDiv = document.getElementById('bnd-declare');
  const playBtn = document.getElementById('bnd-play-cards-btn');
  const callBtn = document.getElementById('bnd-call-btn');
  const newRoundBtn = document.getElementById('bnd-new-round-btn');

  const canCall = lastPlay && lastPlay.by !== 0 && state.alive[lastPlay.by];

  if (state.over) {
    declareDiv.style.display = 'none';
    actions.style.display = 'flex';
    playBtn.style.display = 'none';
    callBtn.style.display = 'none';
    newRoundBtn.style.display = '';
    updateStatusBar();
    return;
  }

  if (!state.alive[0]) {
    actions.style.display = 'none';
    declareDiv.style.display = 'none';
    return;
  }

  if (myTurn) {
    if (state.currentSuit) {
      // Chất đã được cố định — chỉ hiện hành động
      declareDiv.style.display = 'none';
      actions.style.display = 'flex';
      playBtn.style.display = '';
      callBtn.style.display = canCall ? '' : 'none';
      newRoundBtn.style.display = 'none';
      playBtn.disabled = state.selected.size === 0;
      playBtn.textContent = `Đánh (${state.selected.size}/${handSizeLimit(hand.length)})`;
    } else if (currentDeclare) {
      // Đã chọn chất (lần đầu ván này)
      declareDiv.style.display = 'none';
      actions.style.display = 'flex';
      playBtn.style.display = '';
      callBtn.style.display = canCall ? '' : 'none';
      newRoundBtn.style.display = 'none';
      playBtn.disabled = state.selected.size === 0;
      playBtn.textContent = `Đánh (${state.selected.size}/${handSizeLimit(hand.length)})`;
    } else {
      // Chưa có chất — hiển thị bộ chọn chất
      actions.style.display = 'none';
      declareDiv.style.display = 'block';
      const container = document.getElementById('bnd-declare-options');
      container.innerHTML = SUIT_NAMES.map(s =>
        `<button class="bnd-declare-btn" data-suit="${s}">${SUIT_EMOJIS[s] || s}</button>`
      ).join('');
      container.querySelectorAll('.bnd-declare-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentDeclare = btn.dataset.suit;
          render();
        });
      });
    }
  } else {
    actions.style.display = 'none';
    declareDiv.style.display = 'none';
    newRoundBtn.style.display = 'none';
  }

  // Timer
  if (state.over) {
    clearTurnTimer();
    lastTimerTurn = null;
  } else if (lastTimerTurn !== state.turn) {
    lastTimerTurn = state.turn;
    startTurnTimer(state.turn);
  }

  updateStatusBar();
}

// === STATUS BAR ===
function updateStatusBar() {
  if (!state) return;
  const betEl = document.getElementById('bc-bet-stat');
  const msgEl = document.getElementById('bc-status-msg');
  const profitEl = document.getElementById('bc-profit-stat');
  const statusBar = document.getElementById('bc-status');
  statusBar.classList.remove('result-win', 'result-lose', 'result-draw');

  if (!state.over) {
    betEl.textContent = String(state.betAmount || 0);
    msgEl.textContent = state.turn === 0 ? 'LƯỢT BẠN' : PLAYER_NAMES[state.turn].toUpperCase();
    profitEl.textContent = String(turnTimer.remaining);
    profitEl.className = 'stat-profit timer-color' + (turnTimer.remaining <= 10 ? ' negative' : '');
    return;
  }

  const winner = (state.finished.length > 0 && state.finished[0] >= 0)
    ? state.finished[0]
    : state.alive.indexOf(true);
  const isWin = winner === 0;
  const net = isWin ? state.betAmount * 3 : -state.betAmount;
  const finalNet = state.buffPct > 0 && isWin ? Math.round(net * (1 + state.buffPct / 100)) : net;

  betEl.textContent = PLAYER_NAMES[winner];
  msgEl.textContent = isWin ? 'THẮNG!' : 'THUA';
  profitEl.textContent = (finalNet > 0 ? '+' : '') + finalNet.toLocaleString('vi-VN');
  profitEl.className = 'stat-profit ' + (finalNet > 0 ? 'positive' : finalNet < 0 ? 'negative' : 'zero');
  statusBar.classList.add(isWin ? 'result-win' : 'result-lose');
}

// === KẾT TOÁN ===
async function settlePayout() {
  if (payoutSettled) return;
  payoutSettled = true;
  if (!state) return;

  const winner = state.finished[0] >= 0 ? state.finished[0] : state.alive.indexOf(true);
  const isWin = winner === 0;
  const net = isWin ? state.betAmount * 3 : -state.betAmount;
  const finalNet = state.buffPct > 0 && isWin ? Math.round(net * (1 + state.buffPct / 100)) : net;

  try {
    await addPoints('Casino', `Bài Nói Dối ${isWin ? 'Thắng' : 'Thua'}`, finalNet, false);
  } catch (e) {
    console.error(e);
    window.showToast?.('Lỗi cộng điểm: ' + e.message, 'error');
  }
}

// === BOMB EXPLOSION OVERLAY ===
function showBombOverlay(loserIdx) {
  const overlay = document.getElementById('bnd-bomb-overlay');
  if (!overlay) return;
  const isPlayer = loserIdx === 0;
  overlay.style.display = 'flex';
  overlay.className = 'bnd-bomb-overlay active';
  overlay.innerHTML = isPlayer
    ? `<div class="bnd-bomb-icon-big">💥</div><div class="bnd-bomb-text">BOOM! Bạn nổ tung!</div><div class="bnd-bomb-sub">${PLAYER_NAMES[loserIdx]} bị loại!</div>`
    : `<div class="bnd-bomb-icon-big">💥</div><div class="bnd-bomb-text">${PLAYER_NAMES[loserIdx]} nổ tung!</div><div class="bnd-bomb-sub">Bạn còn sống!</div>`;
  setTimeout(() => {
    overlay.className = 'bnd-bomb-overlay';
    overlay.style.display = 'none';
  }, 2000);
}

function forfeitIfAbandoned() {
  if (!state || state.over || payoutSettled) return;
  payoutSettled = true;
  const bet = state.betAmount || 100;
  addPoints('Casino', 'Bài Nói Dối out phòng - mất cược', -bet, false).catch(() => {});
}
window.addEventListener('pagehide', forfeitIfAbandoned);
window.addEventListener('beforeunload', forfeitIfAbandoned);

// === KHỞI TẠO ===
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = 'index.html'; return; }
  // Load profile từ Firestore để lấy avatar + nickname
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      playerProfile = { nickname: d.nickname || user.displayName || 'Bạn', avatarUrl: d.avatarUrl || '' };
      PLAYER_NAMES[0] = playerProfile.nickname;
    }
  } catch (e) {
    console.error('Lỗi load profile:', e);
    playerProfile = { nickname: 'Bạn', avatarUrl: '' };
  }
});

const playBtnMenu = document.getElementById('bnd-play-btn');
const betInput = document.getElementById('bnd-bet-input');
const tlMenu = document.getElementById('bnd-menu');
const gameScreen = document.getElementById('bnd-game-screen');
const statusBar = document.getElementById('bc-status');

let activeBuffPct = 0;
let buffLoadPromise = null;

async function loadBuff() {
  if (!buffLoadPromise) {
    buffLoadPromise = getActiveBuff()
      .then(b => { activeBuffPct = b > 0 ? b : 0; return activeBuffPct; })
      .catch(() => { activeBuffPct = 0; return 0; });
  }
  return buffLoadPromise;
}

playBtnMenu.addEventListener('click', async () => {
  const bet = Math.max(50, parseInt(betInput.value, 10) || 100);
  await loadBuff();
  currentDeclare = null;
  payoutSettled = false;
  lastTimerTurn = null;
  // Ẩn dòng chọn cược khi bắt đầu chơi
  document.getElementById('bc-bet-row').style.display = 'none';
  tlMenu.classList.remove('active');
  tlMenu.style.display = 'none';
  gameScreen.classList.add('active');
  gameScreen.style.display = '';
  statusBar.style.display = '';

  // Spinner chọn người đi đầu
  showStarterSpinner((starterIdx) => {
    newGame(bet, activeBuffPct, starterIdx);
    render();
    maybeRunAi();
  });
});

function maybeRunAi() {
  if (!state || state.over) { render(); return; }
  if (state.turn === 0) { render(); return; }
  if (!state.alive[state.turn]) { advanceTurn(); maybeRunAi(); return; }
  render();
  runAiTurn(state.turn, () => {
    if (!state || state.over) return;
    render();
    if (state.turn !== 0 && !state.over) {
      maybeRunAi();
    }
  });
}

// === EVENTS ===
document.getElementById('bnd-play-cards-btn').addEventListener('click', () => {
  if (!state || state.over || state.turn !== 0) return;
  const declaredSuit = state.currentSuit || currentDeclare;
  if (!declaredSuit) { window.showToast('Chọn chất trước!', 'warn'); return; }
  const cards = [...state.selected].map(k => {
    return state.hands[0].find(c => cardKey(c) === k);
  }).filter(Boolean);
  if (cards.length === 0) { window.showToast('Chọn ít nhất 1 lá!', 'warn'); return; }
  state.selected.clear();
  // Chỉ clear currentDeclare nếu chưa có chất cố định
  if (!state.currentSuit) currentDeclare = null;
  playCards(0, cards, declaredSuit);
  render();
  maybeRunAi();
});

document.getElementById('bnd-call-btn').addEventListener('click', () => {
  if (!state || state.over || state.turn !== 0) return;
  currentDeclare = null;
  const res = callBluff(0);
  if (!res.ok) { window.showToast(res.msg, 'error'); return; }
  render();  // Hiển thị bài face-up trên bàn
  // Ẩn action buttons trong lúc chờ reveal
  document.getElementById('bnd-actions').style.display = 'none';
  if (res.needPopup) {
    // Chờ 3s để thấy bài bị lật trên bàn, sau đó mới popup cắt dây
    setTimeout(() => {
      handleWirePopup(res, () => {
        state.revealedPile = null;
        render();
        if (!state.over) maybeRunAi();
        else settlePayout();
      });
    }, 3000);
  } else {
    state.revealedPile = null;
    render();
    maybeRunAi();
  }
});

document.getElementById('bnd-new-round-btn').addEventListener('click', () => {
  clearTurnTimer();
  lastTimerTurn = null;
  currentDeclare = null;
  payoutSettled = false;
  const bet = state ? state.betAmount : 100;
  // Người thắng ván trước đi trước
  const prevWinner = state && !state.over
    ? -1
    : (state.finished[0] >= 0 ? state.finished[0] : state.alive.indexOf(true));
  if (prevWinner >= 0) {
    newGame(bet, activeBuffPct, prevWinner);
    render();
    maybeRunAi();
  } else {
    showStarterSpinner((starterIdx) => {
      newGame(bet, activeBuffPct, starterIdx);
      render();
      maybeRunAi();
    });
  }
});

// Rời game
setTimeout(function(){
  if(window.TopNav && typeof window.TopNav.setLeaveAction === "function"){
    window.TopNav.setLeaveAction(function(){ window.location.href = "../../games.html"; });
  }
}, 100);
