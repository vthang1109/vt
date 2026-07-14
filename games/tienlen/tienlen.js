// ==================== TIẾN LÊN MIỀN NAM - OFFLINE (1 người + 3 AI) ====================
import { renderCardUI } from '../../cards.js';
import { auth } from '../../points.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints } from '../../points.js';
import { getActiveBuff } from '../../pet.js';

// nhãn & tỉ lệ ăn/thua theo chế độ chơi (áp trên mức cược)
const MODE_LABELS = { an_tat: 'Nhất ăn tất', nhi_ba_tu: 'Nhất Nhì Ba Tư', dem_la: 'Đếm lá' };
const RANK_PCT_NHI_BA_TU = [1, 0.5, -0.5, -1]; // Nhất/Nhì/Ba/Tư
const DEM_LA_PENALTY_PER_CARD = 0.1; // mỗi lá còn lại = 10% mức cược
const RANK_ORD = ['nhất', 'nhì', 'ba', 'tư'];

// luật thời gian mỗi lượt
const TURN_SECONDS = 30;
const RING_CIRC = 113;

// --- MÔ HÌNH LÁ BÀI ---
// rIdx: 0..12 tương ứng 3,4,5,6,7,8,9,10,J,Q,K,A,2 (2 là heo, mạnh nhất)
// sIdx: 0..3 tương ứng ♠,♣,♦,♥ (Bích < Chuồn < Rô < Cơ)
const RANK_LABELS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUIT_LABELS = ['♠','♣','♦','♥'];
const SUIT_RED = [false, false, true, true];
// độ mạnh chất bài thực tế: Bích < Chuồn < Rô < Cơ (Cơ mạnh nhất)
// chỉ số theo sIdx: 0=♠(bích) 1=♣(chuồn) 2=♦(rô) 3=♥(cơ)
const SUIT_STRENGTH = [0, 1, 2, 3];
window.__DEBUG_SUITS = SUIT_LABELS;
const RANK_TWO = 12; // idx của lá "2" (heo)

function buildDeck() {
  const deck = [];
  for (let r = 0; r < 13; r++) {
    for (let s = 0; s < 4; s++) deck.push({ rIdx: r, sIdx: s });
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
  return [...hand].sort((a, b) => a.rIdx - b.rIdx || SUIT_STRENGTH[a.sIdx] - SUIT_STRENGTH[b.sIdx]);
}
function cardKey(c) { return `${c.rIdx}-${c.sIdx}`; }
function cardLabel(c) { return RANK_LABELS[c.rIdx] + SUIT_LABELS[c.sIdx]; }

// --- PHÂN LOẠI BỘ BÀI ---
function isConsecutiveNoTwo(ranksSorted) {
  if (ranksSorted.some(r => r === RANK_TWO)) return false;
  for (let i = 1; i < ranksSorted.length; i++) {
    if (ranksSorted[i] !== ranksSorted[i - 1] + 1) return false;
  }
  return new Set(ranksSorted).size === ranksSorted.length;
}

function classify(cards) {
  if (!cards || !cards.length) return null;
  const sorted = sortHand(cards);
  const n = sorted.length;
  const ranks = sorted.map(c => c.rIdx);
  const allSameRank = ranks.every(r => r === ranks[0]);

  if (n === 1) return { type: 'single', rank: ranks[0], length: 1, cards: sorted };
  if (n === 2) {
    if (allSameRank) return { type: 'pair', rank: ranks[0], length: 2, cards: sorted };
    return null;
  }
  if (n === 3) {
    if (allSameRank) return { type: 'triple', rank: ranks[0], length: 3, cards: sorted };
    if (isConsecutiveNoTwo(ranks)) return { type: 'straight', rank: ranks[2], length: 3, cards: sorted };
    return null;
  }
  if (n === 4) {
    if (allSameRank) return { type: 'quad', rank: ranks[0], length: 4, cards: sorted };
    if (isConsecutiveNoTwo(ranks)) return { type: 'straight', rank: ranks[3], length: 4, cards: sorted };
    return null;
  }
  if (n >= 5 && isConsecutiveNoTwo(ranks)) {
    return { type: 'straight', rank: ranks[n - 1], length: n, cards: sorted };
  }
  if (n >= 6 && n % 2 === 0) {
    const groups = {};
    for (const r of ranks) groups[r] = (groups[r] || 0) + 1;
    const uniqRanks = Object.keys(groups).map(Number).sort((a, b) => a - b);
    const allPairs = uniqRanks.every(r => groups[r] === 2);
    if (allPairs && isConsecutiveNoTwo(uniqRanks) && uniqRanks.length === n / 2) {
      return { type: 'pairstraight', rank: uniqRanks[uniqRanks.length - 1], length: n / 2, cards: sorted };
    }
  }
  return null;
}

// lấy lá bài "cao nhất" của 1 bộ (dùng để so chất khi bằng hạng)
function topCard(combo) {
  const topRankCards = combo.cards.filter(c => c.rIdx === combo.rank);
  return topRankCards.reduce((a, b) => (SUIT_STRENGTH[b.sIdx] > SUIT_STRENGTH[a.sIdx] ? b : a), topRankCards[0]);
}

// so sánh newC có thắng oldC theo luật thường (cùng loại, cùng độ dài, rank cao hơn)
function normalBeat(newC, oldC) {
  if (newC.type !== oldC.type) return false;
  if ((newC.length || 0) !== (oldC.length || 0)) return false;
  if (newC.rank > oldC.rank) return true;
  if (newC.rank === oldC.rank) {
    return SUIT_STRENGTH[topCard(newC).sIdx] > SUIT_STRENGTH[topCard(oldC).sIdx];
  }
  return false;
}
// luật chặt đặc biệt
function isBomb(newC, oldC) {
  const isQuad = newC.type === 'quad';
  const isTripleStraight = newC.type === 'pairstraight' && newC.length === 3; // ba đôi thông
  const isQuadStraight = newC.type === 'pairstraight' && newC.length === 4; // bốn đôi thông

  const oldSingleHeo = oldC.type === 'single' && oldC.rank === RANK_TWO;
  const oldPairHeo = oldC.type === 'pair' && oldC.rank === RANK_TWO;
  const oldTripleStraight = oldC.type === 'pairstraight' && oldC.length === 3;
  const oldQuad = oldC.type === 'quad';

  // đôi heo chặt đôi heo nhỏ hơn: cùng loại/độ dài, xử lý bởi normalBeat (so chất)

  if (isQuad) {
    if (oldSingleHeo) return true;      // tứ quý chặt 1 heo
    if (oldPairHeo) return true;        // tứ quý chặt đôi heo
    if (oldTripleStraight) return true; // tứ quý chặt ba đôi thông
    // tứ quý chặt tứ quý nhỏ hơn: normalBeat (cùng loại, so rank)
  }
  if (isTripleStraight) {
    if (oldSingleHeo) return true;      // ba đôi thông chặt 1 heo
    // ba đôi thông chặt ba đôi thông nhỏ hơn: normalBeat (cùng loại, so rank)
  }
  if (isQuadStraight) {
    if (oldSingleHeo) return true;      // bốn đôi thông chặt 1 heo
    if (oldPairHeo) return true;        // bốn đôi thông chặt đôi heo
    if (oldTripleStraight) return true; // bốn đôi thông chặt ba đôi thông
    if (oldQuad) return true;           // bốn đôi thông chặt mọi tứ quý
    // bốn đôi thông chặt bốn đôi thông nhỏ hơn: normalBeat (cùng loại, so rank)
  }
  return false;
}
function canBeat(newC, oldC) {
  if (!oldC) return true; // đang lead, tự do đánh
  const result = normalBeat(newC, oldC) || isBomb(newC, oldC);
  if (window.__TL_DEBUG) {
    console.log('[canBeat]', {
      new: newC.cards.map(cardLabel).join(' '), newType: newC.type, newRank: newC.rank,
      old: oldC.cards.map(cardLabel).join(' '), oldType: oldC.type, oldRank: oldC.rank,
      result,
    });
  }
  return result;
}

// % phạt (trên mức cược) áp cho người bị chặt trong pha newC chặt oldC
function bombPenaltyPct(newC, oldC) {
  if (!oldC) return 0;
  const oldIsSingleHeo = oldC.type === 'single' && oldC.rank === RANK_TWO;
  const oldIsPairHeo = oldC.type === 'pair' && oldC.rank === RANK_TWO;
  const oldIsTripleStraight = oldC.type === 'pairstraight' && oldC.length === 3;
  const oldIsQuad = oldC.type === 'quad';
  const newIsQuad = newC.type === 'quad';
  const newIsTripleStraight = newC.type === 'pairstraight' && newC.length === 3;
  const newIsQuadStraight = newC.type === 'pairstraight' && newC.length === 4;

  if (oldIsSingleHeo && newIsQuad) {
    const heoCard = oldC.cards[0];
    return SUIT_RED[heoCard.sIdx] ? 100 : 50; // heo đỏ 100% / heo đen 50%
  }
  if (oldIsPairHeo && newC.type === 'pair' && newC.rank === RANK_TWO) return 200; // đôi heo đè đôi heo
  if (oldIsPairHeo && (newIsQuad || newIsQuadStraight)) return 200; // chặt đôi heo bằng tứ quý/4 đôi thông
  if ((oldIsTripleStraight || oldIsQuad) && (newIsQuad || newIsTripleStraight || newIsQuadStraight)) return 200; // chặt đôi thông/tứ quý
  return 0;
}
if (typeof window !== 'undefined') window.__TL_debugHeo = (rIdx, sIdx) => ({ rank: RANK_LABELS[rIdx], suit: SUIT_LABELS[sIdx], isRed: SUIT_RED[sIdx], pct: SUIT_RED[sIdx] ? 100 : 50 });

// --- SINH CÁC BỘ BÀI HỢP LỆ TỪ TRÊN TAY (để AI xét nước đi) ---
function enumerateCombos(hand) {
  const combos = [];
  const byRank = {};
  for (const c of hand) { (byRank[c.rIdx] = byRank[c.rIdx] || []).push(c); }
  for (const r in byRank) byRank[r].sort((a, b) => SUIT_STRENGTH[a.sIdx] - SUIT_STRENGTH[b.sIdx]);

  // đơn
  for (const c of hand) combos.push(classify([c]));

  // đôi / bộ ba / tứ quý (ưu tiên dùng suit thấp trước, giữ suit cao dự phòng)
  for (const r in byRank) {
    const cards = byRank[r];
    if (cards.length >= 2) combos.push(classify(cards.slice(0, 2)));
    if (cards.length >= 3) combos.push(classify(cards.slice(0, 3)));
    if (cards.length >= 4) combos.push(classify(cards.slice(0, 4)));
  }

  // sảnh (dùng 1 lá mỗi rank, suit thấp nhất) - quét các đoạn liên tiếp không chứa "2"
  const uniqRanks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  let run = [];
  const flushStraightRuns = () => {
    if (run.length >= 3) {
      for (let len = 3; len <= run.length; len++) {
        for (let start = 0; start + len <= run.length; start++) {
          const seg = run.slice(start, start + len);
          const cards = seg.map(r => byRank[r][0]);
          combos.push(classify(cards));
        }
      }
    }
    run = [];
  };
  for (let i = 0; i < uniqRanks.length; i++) {
    const r = uniqRanks[i];
    if (r === RANK_TWO) { flushStraightRuns(); continue; }
    if (run.length && r !== run[run.length - 1] + 1) flushStraightRuns();
    run.push(r);
  }
  flushStraightRuns();

  // đôi thông (dùng 2 lá thấp nhất mỗi rank) - quét đoạn liên tiếp rank có >=2 lá
  let prun = [];
  const flushPairRuns = () => {
    if (prun.length >= 3) {
      for (let len = 3; len <= prun.length; len++) {
        for (let start = 0; start + len <= prun.length; start++) {
          const seg = prun.slice(start, start + len);
          const cards = seg.flatMap(r => byRank[r].slice(0, 2));
          combos.push(classify(cards));
        }
      }
    }
    prun = [];
  };
  for (let i = 0; i < uniqRanks.length; i++) {
    const r = uniqRanks[i];
    if (r === RANK_TWO || byRank[r].length < 2) { flushPairRuns(); continue; }
    if (prun.length && r !== prun[prun.length - 1] + 1) flushPairRuns();
    prun.push(r);
  }
  flushPairRuns();

  return combos.filter(Boolean);
}

function comboValueScore(c) {
  // điểm "mạnh" để AI ước lượng độ quý giá của bộ bài (ưu tiên giữ bomb/heo)
  let base = c.rank;
  if (c.type === 'quad') base += 100;
  if (c.type === 'pair' && c.rank === RANK_TWO) base += 200;
  return base;
}

// --- TRẠNG THÁI VÁN ---
const PLAYER_NAMES = ['Bạn', 'Minh', 'Hoa', 'Tuấn'];
let state = null;
let lastWinner = null; // hạng nhất ván trước sẽ đi trước ván sau

function newGame(mode = 'an_tat', bet = 100, buffPct = 0) {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  hands.forEach(h => h.sort((a, b) => a.rIdx - b.rIdx || SUIT_STRENGTH[a.sIdx] - SUIT_STRENGTH[b.sIdx]));

  let starter;
  let requireThreeSpades;
  if (lastWinner !== null) {
    // ván sau: người thắng ván trước đi trước, không bắt buộc 3♠
    starter = lastWinner;
    requireThreeSpades = false;
  } else {
    starter = 0;
    hands.forEach((h, i) => { if (h.some(c => c.rIdx === 0 && c.sIdx === 0)) starter = i; });
    requireThreeSpades = true;
  }

  state = {
    hands,
    turn: starter,
    tableCombo: null,
    tableStack: [],
    seatStatus: {},
    lastPlayer: null,
    passCount: 0,
    firstMove: true,
    requireThreeSpades,
    lastPlaySeq: 0,
    justPlayed: null,
    selected: new Set(),
    finished: [],
    over: false,
    log: [],
    mode,
    betAmount: bet,
    buffPct,
    pendingPenalties: { 0: 0, 1: 0, 2: 0, 3: 0 },
    chayBai: { 0: false, 1: false, 2: false, 3: false },
    bombChain: null,
  };
  return state;
}

function pushLog(msg) {
  state.log.unshift(msg);
  state.log = state.log.slice(0, 6);
}

// --- LƯỢT ĐI ---
function playCombo(playerIdx, cards) {
  const combo = classify(cards);
  if (!combo) return { ok: false, msg: 'Bộ bài không hợp lệ' };
  if (state.firstMove && state.requireThreeSpades) {
    if (!cards.some(c => c.rIdx === 0 && c.sIdx === 0)) {
      return { ok: false, msg: 'Ván mới phải đánh kèm 3♠' };
    }
  }
  if (!canBeat(combo, state.tableCombo)) {
    return { ok: false, msg: 'Không chặn được bài trên bàn' };
  }

  const oldCombo = state.tableCombo;
  const prevOwner = state.lastPlayer;
  const chatPct = bombPenaltyPct(combo, oldCombo);
  if (chatPct > 0) {
    if (state.bombChain) {
      state.bombChain.pct += chatPct;
      state.bombChain.victim = prevOwner;
    } else {
      state.bombChain = { victim: prevOwner, pct: chatPct };
    }
  } else if (state.bombChain) {
    finalizeBombChain();
  }

  const hand = state.hands[playerIdx];
  const keys = new Set(cards.map(cardKey));
  state.hands[playerIdx] = hand.filter(c => !keys.has(cardKey(c)));
  state.tableCombo = combo;
  for (const k in state.seatStatus) if (state.seatStatus[k] === 'played') delete state.seatStatus[k];
  state.seatStatus[playerIdx] = 'played';
  state.tableStack.push(combo);
  if (state.tableStack.length > 3) state.tableStack.shift();
  state.lastPlayer = playerIdx;
  state.passCount = 0;
  state.firstMove = false;
  state.lastPlaySeq = (state.lastPlaySeq || 0) + 1;
  state.justPlayed = playerIdx;
  pushLog(`${PLAYER_NAMES[playerIdx]} đánh ${combo.cards.map(cardLabel).join(' ')}`);

  if (state.hands[playerIdx].length === 0) {
    state.finished.push(playerIdx);
    pushLog(`🏆 ${PLAYER_NAMES[playerIdx]} về ${RANK_ORD[state.finished.length - 1]}!`);

    if (state.mode === 'nhi_ba_tu' && state.finished.length < 3) {
      advanceTurn();
      return { ok: true };
    }
    if (state.mode === 'nhi_ba_tu') {
      for (let i = 0; i < 4; i++) if (!state.finished.includes(i)) state.finished.push(i);
    }
    lastWinner = state.finished[0];
    finishGame();
    return { ok: true, win: true };
  }
  advanceTurn();
  return { ok: true };
}

function othersAllPassed() {
  for (let i = 0; i < 4; i++) {
    if (i === state.lastPlayer) continue;
    if (state.finished.includes(i)) continue;
    if (state.seatStatus[i] !== 'passed') return false;
  }
  return true;
}

function passTurn(playerIdx) {
  if (!state.tableCombo) return { ok: false, msg: 'Đang được đi tự do, không thể bỏ lượt' };
  state.seatStatus[playerIdx] = 'passed';
  pushLog(`${PLAYER_NAMES[playerIdx]} bỏ lượt`);
  if (othersAllPassed()) {
    finalizeBombChain();
    state.tableCombo = null;
    state.seatStatus = {};
    state.passCount = 0;
    state.turn = state.finished.includes(state.lastPlayer)
      ? nextActiveAfter(state.lastPlayer)
      : state.lastPlayer;
    pushLog(`${PLAYER_NAMES[state.turn]} được đi tự do`);
    return { ok: true };
  }
  advanceTurn();
  return { ok: true };
}

function hasQuadStraightBomb(playerIdx) {
  if (!state.tableCombo) return false;
  const hand = state.hands[playerIdx];
  const combos = enumerateCombos(hand).filter(c => c.type === 'pairstraight' && c.length === 4);
  return combos.some(c => canBeat(c, state.tableCombo));
}

function advanceTurn() {
  let next = state.turn;
  do {
    next = (next + 1) % 4;
  } while (
    (state.finished.includes(next) || (state.seatStatus[next] === 'passed' && !hasQuadStraightBomb(next))) &&
    !state.over
  );
  state.turn = next;
}

function nextActiveAfter(idx) {
  let n = idx;
  do { n = (n + 1) % 4; } while (state.finished.includes(n));
  return n;
}

// "chặt chồng": chỉ người bị chặt SAU CÙNG trong chuỗi chịu toàn bộ phạt cộng dồn
function finalizeBombChain() {
  if (state.bombChain) {
    const { victim, pct } = state.bombChain;
    state.pendingPenalties[victim] = (state.pendingPenalties[victim] || 0) + pct;
    state.bombChain = null;
  }
}

// heo còn sót (chưa bị chặt) + cháy bài khi ván kết thúc
function applyEndOfGamePenalties() {
  const winnerIdx = state.finished[0];
  for (let i = 0; i < 4; i++) {
    if (i === winnerIdx) continue;
    const hand = state.hands[i];
    if (!hand || !hand.length) continue;
    hand.forEach(c => {
      if (c.rIdx === RANK_TWO) {
        const pct = SUIT_RED[c.sIdx] ? 100 : 50; // heo đỏ 100% / heo đen 50%
        state.pendingPenalties[i] = (state.pendingPenalties[i] || 0) + pct;
      }
    });
    if (hand.length >= 13) {
      state.chayBai[i] = true; // cháy bài: chưa đánh được lá nào cả ván
    }
  }
}

function finishGame() {
  state.over = true;
  finalizeBombChain();
  applyEndOfGamePenalties();
}

// ==================== AI HEURISTIC ====================
function aiDecide(playerIdx) {
  const hand = state.hands[playerIdx];
  const table = state.tableCombo;
  const candidates = enumerateCombos(hand).filter(c => canBeat(c, table));

  // ràng buộc lượt đầu ván phải có 3♠
  const mustInclude3s = state.firstMove && state.requireThreeSpades;
  const filtered = mustInclude3s
    ? candidates.filter(c => c.cards.some(x => x.rIdx === 0 && x.sIdx === 0))
    : candidates;

  if (!filtered.length) {
    return table ? { type: 'pass' } : { type: 'pass' }; // không còn nước (hiếm khi xảy ra khi lead)
  }

  const opponents = [0, 1, 2, 3].filter(i => i !== playerIdx && !state.finished.includes(i));
  const dangerNear = opponents.some(i => state.hands[i].length <= 2);
  const selfNear = hand.length <= 4;

  if (!table) {
    // ĐANG ĐƯỢC LEAD: ưu tiên xả bộ dài trước, tránh dùng bomb trừ khi cuối ván
    const nonBomb = filtered.filter(c => !(c.type === 'quad' || (c.type === 'pair' && c.rank === RANK_TWO)));
    const pool = (nonBomb.length && !selfNear) ? nonBomb : filtered;
    pool.sort((a, b) => {
      const lenDiff = (b.length || 1) - (a.length || 1);
      if (lenDiff !== 0) return lenDiff;
      return comboValueScore(a) - comboValueScore(b);
    });
    return { type: 'play', combo: pool[0] };
  }

  // ĐANG PHẢI CHẶN
  filtered.sort((a, b) => comboValueScore(a) - comboValueScore(b));
  if (dangerNear || selfNear) {
    // ưu tiên chặn/rút ngắn bài nhanh: chọn bộ dài nhất có thể đánh
    const byLen = [...filtered].sort((a, b) => (b.length || 1) - (a.length || 1) || comboValueScore(a) - comboValueScore(b));
    return { type: 'play', combo: byLen[0] };
  }
  // bình thường: dùng bộ yếu nhất đủ để chặn, tiết kiệm bài mạnh
  return { type: 'play', combo: filtered[0] };
}

function runAiTurn(playerIdx, onDone) {
  setTimeout(() => {
    if (!state) return; // đã rời phòng giữa chừng, huỷ nốt lượt AI đang hẹn giờ
    const decision = aiDecide(playerIdx);
    if (decision.type === 'pass') {
      passTurn(playerIdx);
    } else {
      playCombo(playerIdx, decision.combo.cards);
    }
    onDone();
  }, 3000);
}

// ==================== GIAO DIỆN ====================
onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = 'index.html'; return; }
  loadPetBuff();
});

const betEl = document.getElementById('tl-bet');
const scoreEl = document.getElementById('tl-score');
const scoreSubEl = document.getElementById('tl-score-sub');
const profitEl = document.getElementById('tl-profit');
const statusBarEl = document.getElementById('bc-status');

// tính thưởng/phạt cuối ván cho người chơi (idx 0), cache lại trong state
function computeFinalNet() {
  if (state.finalNet !== undefined) return state.finalNet;
  const ranking = [...state.finished];
  for (let i = 0; i < 4; i++) if (!ranking.includes(i)) ranking.push(i);
  const myRank = ranking.indexOf(0);
  const bet = state.betAmount || 100;
  const isWinner = myRank === 0;
  const isChay = !!state.chayBai[0];
  let net = 0;

  if (state.mode === 'nhi_ba_tu') {
    // cháy bài tính là thua, chỉ tính 1 lần (không cộng dồn với mức thua theo hạng)
    net = isChay ? -bet * 2 : bet * RANK_PCT_NHI_BA_TU[myRank];
  } else {
    if (isWinner) {
      net = bet * 3; // ăn tất từ 3 người còn lại
      if (state.mode === 'dem_la') {
        for (let i = 1; i < 4; i++) net += (state.hands[i]?.length || 0) * bet * DEM_LA_PENALTY_PER_CARD;
      }
    } else {
      // cháy bài tính là thua, chỉ tính 1 lần (thay cho khoản thua cơ bản, không cộng thêm)
      net = isChay ? -bet * 2 : -bet;
      if (state.mode === 'dem_la' && !isChay) {
        net -= (state.hands[0]?.length || 0) * bet * DEM_LA_PENALTY_PER_CARD;
      }
    }
  }

  // phạt bị chặt/bí heo của chính mình (nếu có, kể cả khi thắng nhưng từng bị chặt giữa ván)
  const ownPenaltyPct = (state.pendingPenalties[0] || 0) / 100;
  net -= bet * ownPenaltyPct;

  // người thắng thu thêm % phạt (bí heo, bị chặt) từ cả 3 người thua
  if (isWinner) {
    let bonusPct = 0;
    for (let i = 1; i < 4; i++) bonusPct += (state.pendingPenalties[i] || 0);
    net += bet * (bonusPct / 100);

    // người thắng thu thêm phần chênh lệch cháy bài của đối thủ (cháy bài = thua gấp đôi,
    // phần chênh lệch +1x mức cược so với thua thường được cộng cho người thắng)
    let chayBaiBonus = 0;
    for (let i = 1; i < 4; i++) if (state.chayBai[i]) chayBaiBonus += bet;
    net += chayBaiBonus;
  }

  // Buff Pet: chỉ áp dụng khi THẮNG (tăng thưởng), không giảm phạt khi thua
  if (isWinner && state.buffPct > 0) {
    net = net * (1 + state.buffPct / 100);
  }

  net = Math.round(net);
  state.finalNet = net;
  return net;
}

function updateStatusBar() {
  if (!state) return;
  statusBarEl.classList.remove('result-win', 'result-lose', 'result-draw');
  if (!state.over) {
    betEl.textContent = String(state.betAmount || 0);
    scoreEl.textContent = state.turn === 0 ? 'LƯỢT BẠN' : PLAYER_NAMES[state.turn].toUpperCase();
    scoreSubEl.textContent = state.tableCombo ? '' : 'Đi tự do';
    profitEl.textContent = String(turnTimer.remaining);
    profitEl.className = 'stat-profit timer-color' + (turnTimer.remaining <= 10 ? ' negative' : '');
    return;
  }
  const ranking = [...state.finished];
  for (let i = 0; i < 4; i++) if (!ranking.includes(i)) ranking.push(i);
  const myRank = ranking.indexOf(0);
  const net = computeFinalNet();
  betEl.textContent = `#${myRank + 1}`;
  scoreEl.textContent = myRank === 0 ? 'THẮNG' : (myRank === 3 ? 'CHÓT' : 'HẠNG ' + (myRank + 1));
  scoreSubEl.textContent = '';
  profitEl.textContent = (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
  profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');
  statusBarEl.classList.add(net > 0 ? 'result-win' : net < 0 ? 'result-lose' : 'result-draw');
}

let payoutSettled = false;

// Kết thúc 1 ván: ghi Firestore NGAY (1 lượt ghi/ván) — an toàn, không rủi ro mất dữ liệu
// nếu trình duyệt bị đóng đột ngột.
async function settlePayout() {
  if (payoutSettled) return;
  payoutSettled = true;
  const net = computeFinalNet();
  const ranking = [...state.finished];
  for (let i = 0; i < 4; i++) if (!ranking.includes(i)) ranking.push(i);
  const myRank = ranking.indexOf(0);
  try {
    await addPoints('Casino', `Tiến Lên [${MODE_LABELS[state.mode]}] hạng ${myRank + 1}`, net, false);
  } catch (e) {
    console.error(e);
    window.showToast?.('Lỗi cộng điểm: ' + e.message, 'error');
  }
}

function forfeitIfAbandoned() {
  if (!state || state.over || payoutSettled) return;
  payoutSettled = true;
  const bet = state.betAmount || 100;
  addPoints('Casino', `Tiến Lên [${MODE_LABELS[state.mode]}] out phòng - mất cược`, -bet, false)
    .catch(e => console.error(e));
}
window.addEventListener('pagehide', forfeitIfAbandoned);
window.addEventListener('beforeunload', forfeitIfAbandoned);

const setupBar = document.getElementById('setup-bar');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const modeChips = document.querySelectorAll('.tl-mode-chip');
const betInput = document.getElementById('tl-bet-input');


let selectedMode = 'an_tat';
let activeBuffPct = 0;
let buffLoadPromise = null;
let currentMode = 'an_tat', currentBet = 100, currentBuffPct = 0;

// Mặc định chọn mode đầu tiên
modeChips[0]?.classList.add('selected');

modeChips.forEach(chip => {
  chip.addEventListener('click', () => {
    modeChips.forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedMode = chip.dataset.mode;
  });
});

function loadPetBuff() {
  if (!buffLoadPromise) {
    buffLoadPromise = getActiveBuff()
      .then(buff => { activeBuffPct = buff > 0 ? buff : 0; return activeBuffPct; })
      .catch(() => { activeBuffPct = 0; return 0; });
  }
  return buffLoadPromise;
}
const playBtn = document.getElementById('play-btn');
const passBtn = document.getElementById('pass-btn');
const myHandEl = document.getElementById('my-hand');
const tableEl = document.getElementById('table-combo');
const resultBox = document.getElementById('result-box');

// ==================== TIMER 30S/LƯỢT ====================
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
      handleTurnTimeout(playerIdx);
      return;
    }
    setRingProgress(playerIdx, turnTimer.remaining / TURN_SECONDS, turnTimer.remaining <= 10);
    updateStatusBar();
  }, 1000);
}

function handleTurnTimeout(playerIdx) {
  if (!state || state.over || state.turn !== playerIdx) return;
  if (state.tableCombo) {
    pushLog(`${PLAYER_NAMES[playerIdx]} hết giờ, tự động bỏ lượt`);
    passTurn(playerIdx);
  } else {
    // đến lượt tự do mà hết giờ: hệ thống tự động đánh 1 lá hợp lệ
    const hand = state.hands[playerIdx];
    let autoCard = null;
    if (state.firstMove && state.requireThreeSpades) {
      autoCard = hand.find(c => c.rIdx === 0 && c.sIdx === 0) || null;
    }
    if (!autoCard && hand.length) {
      autoCard = hand[0];
      for (const c of hand) {
        if (c.rIdx < autoCard.rIdx || (c.rIdx === autoCard.rIdx && c.sIdx < autoCard.sIdx)) autoCard = c;
      }
    }
    if (autoCard) {
      pushLog(`${PLAYER_NAMES[playerIdx]} hết giờ, hệ thống tự động đánh ${cardLabel(autoCard)}`);
      playCombo(playerIdx, [autoCard]);
    }
  }
  if (playerIdx === 0) state.selected.clear();
  render();
  maybeRunAi();
}

const seatEls = {
  0: document.getElementById('seat-0'),
  1: document.getElementById('seat-1'),
  2: document.getElementById('seat-2'),
  3: document.getElementById('seat-3'),
};

function renderCard(c, selected) {
  const wrap = document.createElement('div');
  wrap.className = 'card-slot' + (selected ? ' selected' : '');
  wrap.dataset.key = cardKey(c);
  wrap.innerHTML = renderCardUI({ v: RANK_LABELS[c.rIdx], s: SUIT_LABELS[c.sIdx] });
  return wrap;
}

function render() {
  if (!state) return;
  // tay người chơi
  myHandEl.innerHTML = '';
  const hand = state.hands[0];
  hand.forEach(c => {
    const selected = state.selected.has(cardKey(c));
    const el = renderCard(c, selected);
    el.addEventListener('click', () => {
      const k = cardKey(c);
      if (state.selected.has(k)) state.selected.delete(k); else state.selected.add(k);
      render();
    });
    myHandEl.appendChild(el);
  });

  // bàn
  tableEl.innerHTML = '';
  if (state.tableStack.length) {
    const offsets = [{ x: 0, y: 0 }, { x: 18, y: -18 }, { x: -18, y: -34 }];
    const justPlayedBy = state.justPlayed;
    state.tableStack.forEach((combo, idx) => {
      const group = document.createElement('div');
      const back = state.tableStack.length - 1 - idx;
      group.className = 'table-play-group' + (back > 0 ? ' table-play-old' : '');
      group.style.zIndex = idx + 1;
      const off = offsets[back] || offsets[offsets.length - 1];
      group.style.transform = `translate(${off.x}px, ${off.y}px)`;
      const inner = document.createElement('div');
      inner.className = 'table-play-inner';
      combo.cards.forEach(c => inner.appendChild(renderCard(c, false)));
      if (back === 0 && justPlayedBy !== null && justPlayedBy !== undefined) inner.classList.add('play-in', `from-${justPlayedBy}`);
      group.appendChild(inner);
      tableEl.appendChild(group);
    });
    state.justPlayed = null;
  } else {
    tableEl.innerHTML = '<span class="table-empty">— Đi tự do —</span>';
  }

  // ghế AI: số lá còn lại / thứ hạng khi kết thúc
  let ranking = null;
  if (state.over) {
    ranking = [...state.finished];
    for (let i = 0; i < 4; i++) if (!ranking.includes(i)) ranking.push(i);
  }
  for (let i = 1; i <= 3; i++) {
    const seat = seatEls[i];
    seat.querySelector('.seat-count').textContent = state.over
      ? `#${ranking.indexOf(i) + 1}`
      : `${state.hands[i].length} lá`;
    seat.classList.toggle('active-turn', state.turn === i && !state.over);
    seat.classList.toggle('seat-passed', state.seatStatus[i] === 'passed');
    seat.classList.toggle('seat-played', state.seatStatus[i] === 'played');
  }
  seatEls[0].classList.toggle('active-turn', state.turn === 0 && !state.over);

  if (state.over) {
    clearTurnTimer();
    lastTimerTurn = null;
  } else if (lastTimerTurn !== state.turn) {
    lastTimerTurn = state.turn;
    startTurnTimer(state.turn);
  }

  // nút
  const myTurn = state.turn === 0 && !state.over;
  playBtn.style.display = myTurn ? '' : 'none';
  passBtn.style.display = myTurn ? '' : 'none';
  playBtn.disabled = !myTurn || state.selected.size === 0;
  passBtn.disabled = !myTurn || !state.tableCombo;
  const canBeatTable = myTurn && state.tableCombo && enumerateCombos(state.hands[0]).some(c => canBeat(c, state.tableCombo));
  passBtn.classList.toggle('pass-glow', myTurn && !!state.tableCombo && !canBeatTable);

  updateStatusBar();
  if (state.over) settlePayout();

  resultBox.style.display = 'none';
}

function getSelectedCards() {
  const hand = state.hands[0];
  return hand.filter(c => state.selected.has(cardKey(c)));
}

function afterPlayerAction() {
  state.selected.clear();
  render();
  maybeRunAi();
}

function maybeRunAi() {
  if (state.over) { render(); return; }
  if (state.turn === 0) { render(); return; }
  const p = state.turn;
  render();
  runAiTurn(p, () => {
    afterAiStep();
  });
}
function afterAiStep() {
  render();
  if (!state.over && state.turn !== 0) {
    maybeRunAi();
  }
}

startBtn.addEventListener('click', async () => {
  currentMode = selectedMode || 'an_tat';
  currentBet = Math.max(10, parseInt(betInput.value, 10) || 100);
  await loadPetBuff();
  currentBuffPct = activeBuffPct;
  newGame(currentMode, currentBet, currentBuffPct);
  payoutSettled = false;
  lastTimerTurn = null;
  setupBar.style.display = 'none';
  gameScreen.style.display = '';
  statusBarEl.style.display = '';
  render();
  maybeRunAi();
});


playBtn.addEventListener('click', () => {
  const cards = getSelectedCards();
  if (!cards.length) { window.showToast?.('Chọn ít nhất 1 lá', 'warn'); return; }
  const res = playCombo(0, cards);
  if (!res.ok) { window.showToast?.(res.msg, 'error'); return; }
  afterPlayerAction();
});

passBtn.addEventListener('click', () => {
  const res = passTurn(0);
  if (!res.ok) { window.showToast?.(res.msg, 'warn'); return; }
  afterPlayerAction();
});

