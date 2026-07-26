// ============================================================
// ===== TIẾN LÊN MULTIPLAYER (2-4 người) — Nhất ăn tất =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from '../../cards.js';
import { getActiveBuff } from '../../pet.js';
import { initRoomChat, getMyNickname, showRoomDeletedPopup } from '../../room-chat.js';
import { subscribeUserData } from '../../points.js';

const fbConfig = {
  apiKey: "AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",
  authDomain: "lienquan-fake.firebaseapp.com",
  projectId: "lienquan-fake",
  storageBucket: "lienquan-fake.firebasestorage.app",
  messagingSenderId: "782694799992",
  appId: "1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(fbConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ROOM_ID = new URLSearchParams(location.search).get('room');
if (!ROOM_ID) document.body.innerHTML = `<div style="color:#fff;text-align:center;padding:60px">${mi('warning')} Thiếu mã phòng.</div>`;

const TURN_SECONDS = 30;
const RING_CIRC = 113;
const MIN_BET = 10;

let _user = null, _unsub = null, _unsubMe = null, _myBalance = 0, _myActivePet = null;
let _room = null, _gs = null, _actionLock = false;
let _autoStartKey = null, _settledKey = null;
let _turnTimer = null, _turnTimerFor = null, _turnRemaining = TURN_SECONDS;

// Multi-select cho bài trên tay
let _selectedSet = new Set();
let _originalHandKeys = [];   // cache vị trí gốc của các lá bài để giữ khoảng trống khi đánh

// ========== CARD UTILS (from tienlen.js) ==========
const RANK_LABELS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUIT_LABELS = ['♠','♣','♦','♥'];
const SUIT_STRENGTH = [0, 1, 2, 3];
const RANK_TWO = 12;

function mi(n, s) { return `<span class="material-symbols-outlined" style="font-size:${s||'inherit'};line-height:1;vertical-align:middle">${n}</span>`; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function label(c) { return RANK_LABELS[c.rIdx] + SUIT_LABELS[c.sIdx]; }
function cardKey(c) { return `${c.rIdx}-${c.sIdx}`; }
function sortHand(h) { return [...h].sort((a, b) => a.rIdx - b.rIdx || SUIT_STRENGTH[a.sIdx] - SUIT_STRENGTH[b.sIdx]); }
function isRedSuit(sIdx) { return sIdx >= 2; }
function forDisplay(card) { return { v: RANK_LABELS[card.rIdx], s: SUIT_LABELS[card.sIdx] }; }
function buildTlDeck(oldDeck) {
  return oldDeck.map(c => ({ rIdx: RANK_LABELS.indexOf(c.v), sIdx: SUIT_LABELS.indexOf(c.s) }));
}

// ── COMBO CLASSIFICATION ──
function isConsecutiveNoTwo(ranks) {
  if (ranks.some(r => r === RANK_TWO)) return false;
  for (let i = 1; i < ranks.length; i++) if (ranks[i] !== ranks[i - 1] + 1) return false;
  return new Set(ranks).size === ranks.length;
}

function classify(cards) {
  if (!cards || !cards.length) return null;
  const sorted = sortHand(cards);
  const n = sorted.length;
  const ranks = sorted.map(c => c.rIdx);
  const allSameRank = ranks.every(r => r === ranks[0]);

  if (n === 1) return { type: 'single', rank: ranks[0], length: 1, cards: sorted };
  if (n === 2) return allSameRank ? { type: 'pair', rank: ranks[0], length: 2, cards: sorted } : null;
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
  if (n >= 5 && isConsecutiveNoTwo(ranks)) return { type: 'straight', rank: ranks[n - 1], length: n, cards: sorted };
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

function topCard(combo) {
  const top = combo.cards.filter(c => c.rIdx === combo.rank);
  return top.reduce((a, b) => (SUIT_STRENGTH[b.sIdx] > SUIT_STRENGTH[a.sIdx] ? b : a), top[0]);
}

function normalBeat(newC, oldC) {
  if (newC.type !== oldC.type) return false;
  if ((newC.length || 0) !== (oldC.length || 0)) return false;
  if (newC.rank > oldC.rank) return true;
  if (newC.rank === oldC.rank) return SUIT_STRENGTH[topCard(newC).sIdx] > SUIT_STRENGTH[topCard(oldC).sIdx];
  return false;
}

function isBomb(newC, oldC) {
  const isQuad = newC.type === 'quad';
  const isTriplePS = newC.type === 'pairstraight' && newC.length === 3;
  const isQuadPS = newC.type === 'pairstraight' && newC.length === 4;

  const oldSingleHeo = oldC.type === 'single' && oldC.rank === RANK_TWO;
  const oldPairHeo = oldC.type === 'pair' && oldC.rank === RANK_TWO;
  const oldTriplePS = oldC.type === 'pairstraight' && oldC.length === 3;
  const oldQuad = oldC.type === 'quad';

  if (isQuad && (oldSingleHeo || oldPairHeo || oldTriplePS)) return true;
  if (isTriplePS && oldSingleHeo) return true;
  if (isQuadPS && (oldSingleHeo || oldPairHeo || oldTriplePS || oldQuad)) return true;
  return false;
}

function canBeat(newC, oldC) {
  if (!oldC) return true;
  return normalBeat(newC, oldC) || isBomb(newC, oldC);
}

function bombPenaltyPct(newC, oldC) {
  if (!oldC) return 0;
  const oldSingleHeo = oldC.type === 'single' && oldC.rank === RANK_TWO;
  const oldPairHeo = oldC.type === 'pair' && oldC.rank === RANK_TWO;
  const oldTriplePS = oldC.type === 'pairstraight' && oldC.length === 3;
  const oldQuad = oldC.type === 'quad';
  const newIsQuad = newC.type === 'quad';
  const newIsTriplePS = newC.type === 'pairstraight' && newC.length === 3;
  const newIsQuadPS = newC.type === 'pairstraight' && newC.length === 4;

  if (oldSingleHeo && newIsQuad) return isRedSuit(oldC.cards[0].sIdx) ? 100 : 50;
  if (oldPairHeo && (newIsQuad || newIsQuadPS)) return 200;
  if (oldPairHeo && newC.type === 'pair' && newC.rank === RANK_TWO) return 200;
  if ((oldTriplePS || oldQuad) && (newIsQuad || newIsTriplePS || newIsQuadPS)) return 200;
  return 0;
}

// Tìm bộ bài hợp lệ từ tay
function enumerateCombos(hand) {
  const combos = [];
  const byRank = {};
  for (const c of hand) { (byRank[c.rIdx] = byRank[c.rIdx] || []).push(c); }
  for (const r in byRank) byRank[r].sort((a, b) => SUIT_STRENGTH[a.sIdx] - SUIT_STRENGTH[b.sIdx]);

  for (const c of hand) combos.push(classify([c]));
  for (const r in byRank) {
    const cards = byRank[r];
    if (cards.length >= 2) combos.push(classify(cards.slice(0, 2)));
    if (cards.length >= 3) combos.push(classify(cards.slice(0, 3)));
    if (cards.length >= 4) combos.push(classify(cards.slice(0, 4)));
  }

  const uniqRanks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  let run = [];
  const flushRun = () => {
    if (run.length >= 3) {
      for (let len = 3; len <= run.length; len++) {
        for (let start = 0; start + len <= run.length; start++) {
          const seg = run.slice(start, start + len);
          combos.push(classify(seg.map(r => byRank[r][0])));
        }
      }
    }
    run = [];
  };
  for (let i = 0; i < uniqRanks.length; i++) {
    const r = uniqRanks[i];
    if (r === RANK_TWO) { flushRun(); continue; }
    if (run.length && r !== run[run.length - 1] + 1) flushRun();
    run.push(r);
  }
  flushRun();

  let prun = [];
  const flushPairRun = () => {
    if (prun.length >= 3) {
      for (let len = 3; len <= prun.length; len++) {
        for (let start = 0; start + len <= prun.length; start++) {
          const seg = prun.slice(start, start + len);
          combos.push(classify(seg.flatMap(r => byRank[r].slice(0, 2))));
        }
      }
    }
    prun = [];
  };
  for (let i = 0; i < uniqRanks.length; i++) {
    const r = uniqRanks[i];
    if (r === RANK_TWO || byRank[r].length < 2) { flushPairRun(); continue; }
    if (prun.length && r !== prun[prun.length - 1] + 1) flushPairRun();
    prun.push(r);
  }
  flushPairRun();

  return combos.filter(Boolean);
}

// Tính tất toán cuối ván (hỗ trợ cả 3 chế độ)
function computePayouts(gs) {
  const seats = gs.seats || [];
  const finished = gs.finished || [];
  const bet = gs.betAmount || 0;
  const chainP = gs.chainPenalties || {};
  const mode = gs.gameMode || 'an_tat';

  const ranking = [...finished];
  for (const u of seats) if (!ranking.includes(u)) ranking.push(u);
  const winner = ranking[0];

  // Tính phạt (heo, chặt, cháy — áp dụng cho tất cả chế độ)
  const penalties = {};
  let totalPct = 0;
  seats.forEach(uid => {
    const hand = gs.hands?.[uid] || [];
    let p = 0;
    if (uid !== winner) {
      hand.forEach(c => { if (c.rIdx === RANK_TWO) p += isRedSuit(c.sIdx) ? 100 : 50; });
      // Heo của người thắng không bị phạt
    }
    if (gs.chayBai?.[uid] || (uid !== winner && (hand.length || 0) >= 13)) p += 200;
    p += (chainP[uid] || 0);
    penalties[uid] = { penalty: p, rank: ranking.indexOf(uid) };
    if (uid !== winner) totalPct += p;
  });

  const deltas = {};
  const numPlayers = seats.length;

  seats.forEach(uid => {
    const rank = ranking.indexOf(uid);
    let baseDelta = 0;

    if (mode === 'nhi_ba_tu') {
      // Nhất Nhì Ba Tư
      const pct = [1, 0.5, -0.5, -1][rank] || -1;
      baseDelta = Math.round(bet * pct);
    } else if (mode === 'dem_la') {
      // Đếm lá: nhất ăn tất + phạt mỗi lá còn lại
      if (uid === winner) {
        let cardPenalty = 0;
        seats.forEach(u => {
          if (u !== winner) cardPenalty += (gs.hands?.[u]?.length || 0) * bet * 0.1;
        });
        baseDelta = bet * (numPlayers - 1) + Math.round(cardPenalty);
      } else {
        const cardPenalty = Math.round((gs.hands?.[uid]?.length || 0) * bet * 0.1);
        baseDelta = -bet - cardPenalty;
      }
    } else {
      // an_tat (mặc định)
      if (uid === winner) {
        baseDelta = bet * (numPlayers - 1);
      } else {
        baseDelta = -bet;
      }
    }

    // Cộng phạt (heo, chặt, cháy)
    if (uid === winner) {
      const bonus = Math.round(bet * totalPct / 100);
      const ownPenalty = Math.round(bet * penalties[uid].penalty / 100);
      deltas[uid] = { outcome: 'win', delta: baseDelta + bonus - ownPenalty, rank: 1 };
    } else {
      const extra = Math.round(bet * penalties[uid].penalty / 100);
      deltas[uid] = { outcome: 'lose', delta: baseDelta - extra, rank: rank + 1 };
    }
  });

  return deltas;
}

// ── HELPERS ──
function relativeSeats(seats, myUid) {
  const idx = seats.indexOf(myUid);
  if (idx < 0) return seats.filter(u => u !== myUid);
  return [...seats.slice(idx + 1), ...seats.slice(0, idx)];
}
function shortName(r, uid, myUid) {
  if (uid === myUid) return 'Bạn';
  const name = r.memberInfo?.[uid]?.name || '?';
  return name.split(' ').pop();
}
function applyAvatar(el, r, uid) {
  if (!el) return;
  const url = r.memberInfo?.[uid]?.avatarUrl;
  if (url) {
    el.style.backgroundImage = `url(${url})`;
    el.style.color = 'transparent';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.style.color = '';
    const name = r.memberInfo?.[uid]?.name || '?';
    el.textContent = (name.trim().charAt(0) || '?').toUpperCase();
  }
}
function updateNavRoom(code) {
  if (!code || !window.TopNav?.setRoomId) return;
  window.TopNav.setRoomId(code, `<img src="../../assets/icons/tienlen.png" style="height:14px;width:14px;vertical-align:middle;border-radius:2px">`);
}
function nextActivePlayer(gs, currentUid, finished) {
  const seats = gs.seats || [];
  const idx = seats.indexOf(currentUid);
  let n = (idx + 1) % seats.length;
  let guard = 0;
  while (finished.includes(seats[n]) && guard < seats.length) { n = (n + 1) % seats.length; guard++; }
  return seats[n];
}

// ========== AUTH ==========
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = '../../index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(async () => {
    window.__navigated = true;
    await window.quitGame?.();
  });
  _unsubMe = subscribeUserData((data) => {
    if (data) {
      _myBalance = data.points || 0;
      _myActivePet = data.activePet || null;
      if (window.TopNav) window.TopNav.setPoints(_myBalance);
    }
  });
  if (ROOM_ID) {
    start();
    const myName = await getMyNickname(db, _user.uid, _user.email);
    initRoomChat({ db, roomId: ROOM_ID, uid: _user.uid, getName: () => myName });
  }
});

window.addEventListener('pagehide', () => { if (!window.__navigated) window.quitGame?.(); });

// ========== ROOM LISTENER ==========
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      showRoomDeletedPopup();
      return;
    }
    const r = snap.data();
    _room = r;
    updateNavRoom(r.code || '------');
    if (r.gameType !== 'tienlen' || !r.gameState) return;
    render(r);
  });
}

// ========== RENDER ==========
function render(r) {
  const gs = r.gameState || {};
  _gs = gs;
  const uid = _user.uid;
  const members = r.members || [];
  const isHost = r.hostUid === uid;

  renderStatusBar(r, gs, uid);
  renderBetZone(r, gs, isHost, uid, members);
  renderTable(r, gs, uid);
  renderMyArea(r, gs, uid);

  if (gs.phase === 'playing' && gs.turn) startTurnTimerIfNeeded(gs);
  else clearTurnTimerLocal();

  // Tự động bắt đầu ván
  if (isHost && (!gs.phase || gs.phase === 'betting') && gs.betAmount && members.length >= 2) {
    const allConfirmed = members.every(u => gs.betConfirmed?.[u] === gs.betAmount);
    const key = String(gs.cycle || 0);
    if (allConfirmed && _autoStartKey !== key) {
      _autoStartKey = key;
      setTimeout(() => { if (_room?.hostUid === _user.uid) startMatch(); }, 500);
    }
  }

  // Cập nhật ghế chờ
  renderWaitingList(r);

  // Tất toán điểm
  if (gs.phase === 'result') {
    const key = String(gs.cycle || 0);
    if (_settledKey !== key) {
      _settledKey = key;
      settleMyResult(r, gs);
    }
  }
}

// ===== STATUS BAR =====
function renderStatusBar(r, gs, uid) {
  const betEl = document.getElementById('tl-bet');
  const scoreEl = document.getElementById('tl-score');
  const subEl = document.getElementById('tl-score-sub');
  const profitEl = document.getElementById('tl-profit');
  const bar = document.getElementById('bc-status');
  bar.classList.remove('result-win', 'result-lose', 'result-draw');

  const modeLabel = MODE_LABELS[gs.gameMode] || 'Nhất ăn tất';
  
  if (gs.phase !== 'result') {
    betEl.textContent = gs.betAmount ? gs.betAmount.toLocaleString('vi-VN') : '';
    if (gs.phase === 'playing') {
      scoreEl.textContent = gs.turn === uid ? 'LƯỢT BẠN' : esc(shortName(r, gs.turn, uid)).toUpperCase();
      subEl.textContent = modeLabel + (gs.tableCombo ? ' · Chặn' : ' · Tự do');
      profitEl.textContent = String(_turnRemaining);
      profitEl.className = 'stat-profit timer-color' + (_turnRemaining <= 10 ? ' negative' : '');
    } else {
      scoreEl.textContent = (r.members || []).length < 2 ? 'CHỜ NGƯỜI CHƠI' : modeLabel;
      subEl.textContent = '';
      profitEl.textContent = '';
      profitEl.className = 'stat-profit zero';
    }
  } else {
    const res = gs.results?.[uid];
    const outcome = res?.outcome || 'draw';
    scoreEl.innerHTML = outcome === 'win' ? `${mi('emoji_events')} NHẤT` : outcome === 'lose' ? 'THUA' : 'HUỶ';
    subEl.textContent = outcome === 'lose' ? `Hạng ${res?.rank || '?'}/${gs.seats?.length || 4}` : '';
    const delta = res?.delta || 0;
    profitEl.textContent = delta === 0 ? '' : (delta > 0 ? '+' : '') + delta.toLocaleString('vi-VN');
    profitEl.className = 'stat-profit ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
    bar.classList.add(outcome === 'win' ? 'result-win' : outcome === 'lose' ? 'result-lose' : 'result-draw');
  }
}

const MODE_LABELS = { an_tat: 'Nhất ăn tất', nhi_ba_tu: 'Nhất Nhì Ba Tư', dem_la: 'Đếm lá' };

function modeIcon(m) {
  const icons = { an_tat: 'military_tech', nhi_ba_tu: 'workspace_premium', dem_la: 'description' };
  return mi(icons[m] || 'military_tech');
}

// ===== BET ZONE (có chọn chế độ chơi) =====
function renderBetZone(r, gs, isHost, uid, members) {
  const zone = document.getElementById('bet-zone');
  if (gs.phase && gs.phase !== 'betting') { zone.style.display = 'none'; zone.innerHTML = ''; return; }
  zone.style.display = '';

  if (members.length < 2) {
    zone.innerHTML = `<div class="tlmp-bet-waiting">${mi('hourglass_empty')} Đang chờ người chơi... (${members.length}/${r.maxPlayers || 4})</div>`;
    return;
  }

  const betAmount = gs.betAmount || null;
  const myConfirmed = !!(betAmount && gs.betConfirmed?.[uid] === betAmount);
  const confirmedCount = betAmount ? members.filter(u => gs.betConfirmed?.[u] === betAmount).length : 0;
  const currentMode = gs.gameMode || 'an_tat';

  if (isHost) {
    const modeKeys = ['an_tat', 'nhi_ba_tu', 'dem_la'];
    zone.innerHTML = `
      <div class="tlmp-bet-card">
        <div class="tlmp-mode-chips">
          ${modeKeys.map(m => `<button class="tlmp-mode-chip ${m === currentMode ? 'selected' : ''}" onclick="setGameMode('${m}')">${modeIcon(m)} ${MODE_LABELS[m]}</button>`).join('')}
        </div>
        <div class="tlmp-bet-picker">
          <div class="label">Chọn mức cược · ${members.length} người · ${MODE_LABELS[currentMode]}</div>
          <div class="row"><input id="tl-bet-input" type="number" min="${MIN_BET}" step="10" value="${betAmount || 100}"/></div>
          <div class="tlmp-bet-quick">
            <button onclick="quickBet(100)">100</button>
            <button onclick="quickBet(200)">200</button>
            <button onclick="quickBet(500)">500</button>
            <button onclick="quickBet(1000)">1000</button>
          </div>
          <button class="tlmp-bet-confirm" onclick="hostSetBet()">${betAmount ? `${mi('refresh')} Đổi cược` : `${mi('check_circle')} Đặt cược`}</button>
        </div>
        ${betAmount ? `<div class="tlmp-bet-status">Đã xác nhận ${confirmedCount}/${members.length}${myConfirmed ? '' : ' · Bạn chưa xác nhận'}</div>` : ''}
        ${betAmount && !myConfirmed ? `<button class="tlmp-bet-confirm" onclick="confirmBet()">${mi('check_circle')} Xác nhận ${betAmount.toLocaleString('vi-VN')}đ</button>` : ''}
      </div>`;
    return;
  }

  if (!betAmount) {
    zone.innerHTML = `<div class="tlmp-bet-waiting">${mi('hourglass_empty')} Đang chờ chủ phòng chọn mức cược...</div>`;
  } else if (!myConfirmed) {
    zone.innerHTML = `
      <div class="tlmp-bet-card">
        <div class="label">${modeIcon(currentMode)} ${MODE_LABELS[currentMode]}</div>
        <div class="amount">${betAmount.toLocaleString('vi-VN')}đ</div>
        <button class="tlmp-bet-confirm" onclick="confirmBet()">${mi('check_circle')} Xác nhận</button>
      </div>`;
  } else {
    zone.innerHTML = `
      <div class="tlmp-bet-card">
        <div class="label">${mi('check_circle')} ${MODE_LABELS[currentMode]} · ${betAmount.toLocaleString('vi-VN')}đ</div>
        <div class="tlmp-bet-status">Đã xác nhận ${confirmedCount}/${members.length}</div>
      </div>`;
  }
}

window.setGameMode = async function(mode) {
  if (!_room || _room.hostUid !== _user.uid) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.gameMode': mode });
  } catch (e) { console.error(e); }
};

window.quickBet = function(amt) {
  const el = document.getElementById('tl-bet-input');
  if (el) el.value = amt;
};
window.hostSetBet = async function() {
  if (!_room || _room.hostUid !== _user.uid) return;
  const el = document.getElementById('tl-bet-input');
  const amt = parseInt(el?.value);
  if (!amt || amt < MIN_BET) return;
  if (amt > _myBalance) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': amt,
      [`gameState.betConfirmed.${_user.uid}`]: amt
    });
  } catch (e) { console.error(e); }
};
window.confirmBet = async function() {
  const r = _room; if (!r) return;
  const amt = r.gameState?.betAmount;
  if (!amt) return;
  if (amt > _myBalance) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.betConfirmed.${_user.uid}`]: amt });
  } catch (e) { console.error(e); }
};

// ===== BÀN CHƠI =====
function renderTable(r, gs, uid) {
  const seats = gs.seats?.length ? gs.seats : (r.members || []);
  const inGame = gs.phase === 'playing' || gs.phase === 'result';
  document.getElementById('game-screen').style.display = inGame ? '' : 'none';
  if (!inGame) return;

  const others = relativeSeats(seats, uid);
  const slotIds = ['seat-left', 'seat-top', 'seat-right', 'seat-bottom'];
  slotIds.forEach((slotId, i) => {
    const el = document.getElementById(slotId);
    const oppUid = others[i];
    if (!oppUid) { el.style.display = 'none'; return; }
    el.style.display = '';
    renderSeat(el, r, gs, oppUid, uid);
  });

  const modeEl = document.getElementById('tl-round-info');
  modeEl.style.display = inGame ? '' : 'none';
  if (gs.phase === 'playing' && !gs.tableCombo) {
    modeEl.innerHTML = `${mi('gesture')} Đi tự do · ${MODE_LABELS[gs.gameMode] || 'Nhất ăn tất'}`;
  } else if (gs.phase === 'playing') {
    modeEl.textContent = (MODE_LABELS[gs.gameMode] || 'Nhất ăn tất');
  } else {
    modeEl.textContent = MODE_LABELS[gs.gameMode] || 'Nhất ăn tất';
  }

  const comboEl = document.getElementById('table-combo');
  const tc = gs.tableCombo;
  if (gs.phase === 'playing' && tc) {
    const ownerName = gs.lastPlayer ? esc(shortName(r, gs.lastPlayer, uid)) : '';
    comboEl.innerHTML = `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:4px">
      ${tc.cards.map((c, i) => {
        const cardD = forDisplay(c);
        return `<div class="card-slot" style="margin-left:${i === 0 ? 0 : -32}px">${renderCardUI(cardD)}</div>`;
      }).join('')}
      <div style="font-size:10px;color:#94a3b8;text-align:center;width:100%;margin-top:4px">${ownerName}</div>
    </div>`;
  } else if (gs.phase === 'playing') {
    comboEl.innerHTML = '<span class="table-empty">— Đi tự do —</span>';
  } else if (gs.phase === 'result') {
    comboEl.innerHTML = renderResultBox(r, gs, uid);
  } else {
    comboEl.innerHTML = '';
  }
}

function renderSeat(el, r, gs, oppUid, myUid) {
  const avatarEl = el.querySelector('.seat-avatar');
  applyAvatar(avatarEl, r, oppUid);
  const nameEl = el.querySelector('.seat-name');
  if (nameEl) nameEl.textContent = shortName(r, oppUid, myUid);

  const isTurn = gs.phase === 'playing' && gs.turn === oppUid;
  el.classList.toggle('active-turn', isTurn);

  const countEl = el.querySelector('.tlmp-card-count');
  if (countEl) {
    const hand = gs.hands?.[oppUid] || [];
    if (gs.phase === 'result' || gs.finished?.includes(oppUid)) {
      const ranking = [...(gs.finished || [])];
      for (const u of gs.seats || []) if (!ranking.includes(u)) ranking.push(u);
      const rnk = ranking.indexOf(oppUid);
      countEl.textContent = rnk >= 0 ? `#${rnk + 1}` : '?';
      el.classList.add('finished');
    } else {
      countEl.textContent = `${hand.length} lá`;
      el.classList.remove('finished');
    }
  }

  el.classList.toggle('seat-passed', !!(gs.whoPassedThisRound || []).includes(oppUid));
  el.querySelector('.seat-timer-fg')?.classList.remove('timer-warn');

  const statusEl = el.querySelector('.seat-status');
  if (statusEl) {
    if ((gs.whoPassedThisRound || []).includes(oppUid)) {
      statusEl.textContent = 'Bỏ lượt'; statusEl.className = 'seat-status pass-status';
    } else if (gs.phase === 'playing' && gs.lastPlayer === oppUid && gs.tableCombo) {
      statusEl.textContent = 'Đã đánh'; statusEl.className = 'seat-status play-status';
    } else {
      statusEl.textContent = ''; statusEl.className = 'seat-status';
    }
  }
}

function renderResultBox(r, gs, uid) {
  const winners = gs.winners || [];
  if (!winners.length) {
    return `<div class="result-box"><div class="emoji">${mi('block','28px')}</div><div class="title">Ván đã huỷ</div></div>`;
  }
  const iWon = winners.includes(uid);
  const name = shortName(r, winners[0], uid);
  return `<div class="result-box">
    <div class="emoji">${iWon ? mi('emoji_events','32px') : mi('sentiment_dissatisfied','28px')}</div>
    <div class="title">${esc(name)} về Nhất!</div>
    <div class="sub">${gs.finished?.length || 1}/${gs.seats?.length || 4} người đã hết bài</div>
  </div>`;
}

// ===== TAY BÀI + HÀNH ĐỘNG (multi-select) =====
function renderMyArea(r, gs, uid) {
  const area = document.getElementById('my-area');
  const inGame = gs.phase === 'playing' || gs.phase === 'result';
  area.style.display = inGame ? '' : 'none';
  if (!inGame) { document.getElementById('my-corner-avatar').style.display = 'none'; return; }
  document.getElementById('my-corner-avatar').style.display = '';

  applyAvatar(document.getElementById('my-avatar'), r, uid);
  const myNameEl = document.getElementById('my-name');
  if (myNameEl) myNameEl.textContent = shortName(r, uid, uid);

  const hand = gs.hands?.[uid] || [];

  // ── Free-play indicator: hiển thị lá nhỏ nhất (chỉ tham khảo) ──
  let fpEl = document.getElementById('tlmp-fp-indicator');
  if (!fpEl) {
    fpEl = document.createElement('div');
    fpEl.id = 'tlmp-fp-indicator';
    fpEl.style.cssText = 'position:absolute;top:-2px;right:0;font-size:10px;font-weight:700;text-align:center;padding:2px 8px;border-radius:8px;line-height:1.4;transition:all .2s;white-space:nowrap;z-index:10;pointer-events:none';
    const topEl = document.getElementById('tl-my-top');
    if (topEl) { topEl.style.position = 'relative'; topEl.appendChild(fpEl); }
  }
  const myTurnFp = gs.phase === 'playing' && gs.turn === uid && !gs.finished?.includes(uid);
  if (myTurnFp && !gs.tableCombo && gs.firstMove) {
    // Lượt đầu: hiển thị 3♠
    const has3S = hand.some(c => c.rIdx === 0 && c.sIdx === 0);
    fpEl.innerHTML = has3S ? '♠ Phải đánh kèm 3♠' : `${mi('explore')} Tự do`;
    fpEl.style.background = 'rgba(239,68,68,0.12)';
    fpEl.style.color = '#fca5a5';
    fpEl.style.border = '1px solid rgba(239,68,68,0.2)';
    fpEl.style.display = '';
  } else if (myTurnFp && !gs.tableCombo) {
    // Lượt tự do (không phải lượt đầu): đánh gì cũng được
    const minCard = hand.reduce((m, c) => c.rIdx < m.rIdx ? c : m, hand[0]);
    const cardLabel = minCard ? RANK_LABELS[minCard.rIdx] + SUIT_LABELS[minCard.sIdx] : '';
    fpEl.innerHTML = `${mi('explore')} Tự do · nhỏ: ${cardLabel}`;
    fpEl.style.background = 'rgba(56,189,248,0.1)';
    fpEl.style.color = '#7dd3fc';
    fpEl.style.border = '1px solid rgba(56,189,248,0.2)';
    fpEl.style.display = '';
  } else {
    fpEl.style.display = 'none';
  }
  const myTurn = gs.phase === 'playing' && gs.turn === uid;
  const finished = gs.finished?.includes(uid);

  // Luôn đồng bộ _originalHandKeys với tay bài hiện tại (các lá tự gần lại sau khi đánh)
  _originalHandKeys = hand.map(c => cardKey(c));

  const handEl = document.getElementById('my-hand');
  handEl.innerHTML = '';
  
  if (hand.length === 0) {
    handEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:10px">Hết bài!</div>';
  } else {
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      const sel = _selectedSet.has(i) ? 'selected' : '';
      const dis = (myTurn && !finished) ? '' : 'disabled';
      const cardD = forDisplay(card);
      handEl.innerHTML += `<div class="card-slot ${sel} ${dis}" onclick="${myTurn && !finished ? `selectCard(${i})` : ''}">${renderCardUI(cardD)}</div>`;
    }
  }

  // Ẩn combo preview trên bàn — chỉ hiển thị trên ghế
  const comboPreviewEl = document.getElementById('combo-preview');
  if (comboPreviewEl) comboPreviewEl.style.display = 'none';

  const actEl = document.getElementById('actions');
  if (gs.phase === 'result') {
    const isHost = r.hostUid === uid;
    actEl.innerHTML = isHost
      ? `<div style="display:flex;gap:8px;justify-content:center">
          <button id="tl-new-game-btn" onclick="hostNextRound()">${mi('refresh')} Ván mới</button>
          <button id="tl-change-bet-btn" onclick="hostChangeBet()">${mi('settings')} Đổi cược</button>
        </div>`
      : `<div class="tlmp-waiting-text">${mi('hourglass_empty')} Chờ chủ phòng bắt đầu ván mới...</div>`;
    return;
  }

  if (!myTurn || finished) { actEl.innerHTML = ''; return; }

  const tc = gs.tableCombo;
  const canPass = !!tc;
  const havePlayable = enumerateCombos(hand).some(c => canBeat(c, tc));
  const selectedCards = [..._selectedSet].map(i => {
    const key = _originalHandKeys[i];
    return hand.find(c => cardKey(c) === key);
  }).filter(Boolean);
  const previewCombo = classify(selectedCards);
  let validPlay = selectedCards.length > 0 && previewCombo && canBeat(previewCombo, tc);
  // Đi tự do (không có bài chặn): được đánh bất kỳ bộ hợp lệ nào, 
  // không bắt buộc phải đánh lá nhỏ nhất (chỉ lượt đầu mới bắt buộc 3♠)
  // Chỉ kiểm tra 3♠ ở lượt đầu (đã có validation riêng trong playCard)

  actEl.innerHTML = `
    <button id="pass-btn" class="${(!havePlayable && canPass) ? 'pass-glow' : ''}" ${canPass ? '' : 'disabled'} onclick="passTurn()">Bỏ lượt</button>
    <button id="play-btn" class="${(!havePlayable && canPass) ? 'pass-glow' : ''}" ${validPlay ? '' : 'disabled'} onclick="playCard()">Đánh</button>
  `;
}

window.selectCard = function(idx) {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing' || gs.turn !== _user.uid) return;
  if (idx < 0 || idx >= _originalHandKeys.length) return;
  if (gs.finished?.includes(_user.uid)) return;

  if (_selectedSet.has(idx)) _selectedSet.delete(idx);
  else _selectedSet.add(idx);
  renderMyArea(_room, gs, _user.uid);
};

// ===== ĐÁNH BÀI =====
window.playCard = async function() {
  if (_actionLock) return;
  const r = _room, gs = _gs;
  if (!r || !gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  if (gs.turn !== uid) return;
  if (gs.finished?.includes(uid)) return;

  const hand = gs.hands?.[uid] || [];
  const selectedCards = [..._selectedSet].map(i => {
    const key = _originalHandKeys[i];
    return hand.find(c => cardKey(c) === key);
  }).filter(Boolean);
  if (!selectedCards.length) return;

  const combo = classify(selectedCards);
  if (!combo) { window.showToast?.('Bộ bài không hợp lệ!', 'warn'); return; }
  if (!canBeat(combo, gs.tableCombo)) { window.showToast?.('Không chặn được!', 'warn'); return; }
  // Lượt tự do: không bắt buộc đánh lá nhỏ nhất (chỉ lượt đầu mới cần 3♠)
  // Validation 3♠ ở lượt đầu đã có ngay dưới đây
  if (gs.firstMove && !selectedCards.some(c => c.rIdx === 0 && c.sIdx === 0)) {
    window.showToast?.('Lượt đầu phải đánh kèm 3♠!', 'warn'); return;
  }

  _actionLock = true;
  try {
    const oldCombo = gs.tableCombo;
    const prevOwner = gs.lastPlayer;
    const pct = bombPenaltyPct(combo, oldCombo);

    const chainP = { ...(gs.chainPenalties || {}) };
    let msg = '';
    if (pct > 0 && prevOwner != null) {
      chainP[prevOwner] = (chainP[prevOwner] || 0) + pct;
      msg = `${mi('bolt')} ${esc(shortName(r, uid, uid))} chặt ${esc(shortName(r, prevOwner, uid))}!`;
    }

    const keySet = new Set(selectedCards.map(cardKey));
    const newHand = hand.filter(c => !keySet.has(cardKey(c)));
    const finished = [...(gs.finished || [])];

    const updates = {
      [`gameState.hands.${uid}`]: newHand,
      'gameState.tableCombo': combo,
      'gameState.lastPlayer': uid,
      'gameState.passCount': 0,
      'gameState.whoPassedThisRound': [],
      'gameState.firstMove': false,
      'gameState.chainPenalties': chainP,
      'gameState.lastActionMsg': msg || `${esc(shortName(r, uid, uid))} đánh ${combo.cards.map(c => label(c)).join(' ')}`
    };

    if (newHand.length === 0) {
      finished.push(uid);
      updates['gameState.finished'] = finished;
      updates['gameState.lastActionMsg'] = `${mi('emoji_events')} ${esc(shortName(r, uid, uid))} về Nhất!`;

      if (finished.length >= gs.seats.length - 1) {
        const deltas = computePayouts({ ...gs, hands: { ...gs.hands, [uid]: [] }, finished, chainPenalties: chainP });
        updates['gameState.phase'] = 'result';
        updates['gameState.results'] = deltas;
        updates['gameState.winners'] = [uid];
        const lastUid = gs.seats.find(u => !finished.includes(u));
        if (lastUid) finished.push(lastUid);
        updates['gameState.finished'] = finished;
        // Lưu người về nhất để đi trước ván sau
        updates['gameState.lastWinner'] = finished[0] || null;
      } else {
        updates['gameState.turn'] = nextActivePlayer(gs, uid, finished);
        updates['gameState.tableCombo'] = null;
        updates['gameState.lastPlayer'] = null;
        updates['gameState.whoPassedThisRound'] = [];
      }
    } else {
      updates['gameState.turn'] = nextPlayerAfter(uid, gs.seats, finished);
    }

    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
    _selectedSet.clear();
  } catch (e) { console.error('playCard error:', e); }
  finally { _actionLock = false; }
};

function nextPlayerAfter(uid, seats, finished) {
  const idx = seats.indexOf(uid);
  let n = (idx + 1) % seats.length;
  let guard = 0;
  while (finished.includes(seats[n]) && guard < seats.length) { n = (n + 1) % seats.length; guard++; }
  return seats[n];
}

// ===== BỎ LƯỢT =====
window.passTurn = async function() {
  if (_actionLock) return;
  const r = _room, gs = _gs;
  if (!r || !gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  if (gs.turn !== uid) return;
  if (!gs.tableCombo) { window.showToast?.('Đang đi tự do, không thể bỏ lượt!', 'warn'); return; }

  _actionLock = true;
  try {
    const whoPassed = [...(gs.whoPassedThisRound || []), uid];
    const seats = gs.seats || [];
    const finished = gs.finished || [];
    const active = seats.filter(u => !finished.includes(u));
    const allPassed = active.every(u => u === gs.lastPlayer || whoPassed.includes(u));

    let updates = { 'gameState.whoPassedThisRound': whoPassed };

    if (allPassed) {
      const newTurn = gs.lastPlayer != null ? gs.lastPlayer : nextActivePlayer(gs, uid, finished);
      updates['gameState.turn'] = newTurn;
      updates['gameState.tableCombo'] = null;
      updates['gameState.lastPlayer'] = null;
      updates['gameState.passCount'] = 0;
      updates['gameState.whoPassedThisRound'] = [];
      updates['gameState.lastActionMsg'] = `${mi('refresh')} ${esc(shortName(r, newTurn, uid))} được đi tự do`;
    } else {
      updates['gameState.turn'] = nextActivePlayer(gs, uid, finished);
      updates['gameState.lastActionMsg'] = `${esc(shortName(r, uid, uid))} bỏ lượt`;
    }

    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
    _selectedSet.clear();
  } catch (e) { console.error('passTurn error:', e); }
  finally { _actionLock = false; }
};

// ===== BẮT ĐẦU VÁN =====
async function startMatch() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  const members = r.members || [];
  if (members.length < 2 || !gs.betAmount) return;
  if (!members.every(u => gs.betConfirmed?.[u] === gs.betAmount)) return;

  const deck = buildTlDeck(createDeck());
  const seats = [...members];
  const hands = {};
  seats.forEach(uid => { hands[uid] = []; });
  const cardsPerPlayer = Math.min(13, Math.floor(deck.length / seats.length));
  for (let i = 0; i < seats.length * cardsPerPlayer; i++) {
    hands[seats[i % seats.length]].push(deck.pop());
  }
  seats.forEach(uid => hands[uid] = sortHand(hands[uid]));

  // Xác định người đi trước: ưu tiên nhất ván trước, nếu không thì tìm 3♠, nếu không có 3♠ thì ai có lá nhỏ nhất
  let starter, has3S = false;
  const lastWinner = gs.lastWinner;
  if (lastWinner && seats.includes(lastWinner)) {
    // Ván sau: người nhất ván trước đi trước
    starter = lastWinner;
  } else {
    const threeSUid = seats.find(uid => hands[uid].some(c => c.rIdx === 0 && c.sIdx === 0));
    if (threeSUid) {
      starter = threeSUid;
      has3S = true;
    } else {
      // Không có 3♠: tìm người có lá nhỏ nhất (so rank trước, chất sau)
      let bestUid = seats[0];
      let bestCard = hands[bestUid].reduce((m, c) => (c.rIdx < m.rIdx || (c.rIdx === m.rIdx && SUIT_STRENGTH[c.sIdx] < SUIT_STRENGTH[m.sIdx])) ? c : m);
      for (let i = 1; i < seats.length; i++) {
        const uid = seats[i];
        const c = hands[uid].reduce((m, c) => (c.rIdx < m.rIdx || (c.rIdx === m.rIdx && SUIT_STRENGTH[c.sIdx] < SUIT_STRENGTH[m.sIdx])) ? c : m);
        if (c.rIdx < bestCard.rIdx || (c.rIdx === bestCard.rIdx && SUIT_STRENGTH[c.sIdx] < SUIT_STRENGTH[bestCard.sIdx])) {
          bestCard = c;
          bestUid = uid;
        }
      }
      starter = bestUid;
    }
  }

  _selectedSet.clear();

  const starterLabel = r.memberInfo?.[starter]?.name || '?';

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.seats': seats,
    'gameState.hands': hands,
    'gameState.turn': starter,
    'gameState.tableCombo': null,
    'gameState.lastPlayer': null,
    'gameState.passCount': 0,
    'gameState.whoPassedThisRound': [],
    'gameState.firstMove': has3S,
    'gameState.finished': [],
    'gameState.chainPenalties': {},
    'gameState.chayBai': {},
    'gameState.results': null,
    'gameState.winners': null,
    'gameState.lastActionMsg': `Bắt đầu! ${esc(starterLabel)} đánh trước`
  });
  if (window.VTQuests) window.VTQuests.trackPlay('tienlen');
}

// ===== VÁN MỚI =====
function renderWaitingList(r) {
  const waiters = r.waitingMembers || [];
  const el = document.getElementById('tlmp-waiting-list');
  const namesEl = document.getElementById('tlmp-waiting-names');
  if (!el || !namesEl) return;
  if (waiters.length) {
    el.style.display = '';
    namesEl.innerHTML = waiters.map(uid => {
      const info = (r.waitingMemberInfo||{})[uid] || { name: '?' };
      return '<span>' + esc(info.name) + '</span>';
    }).join('');
  } else {
    el.style.display = 'none';
  }
}

window.hostNextRound = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  _selectedSet.clear();
  
  // Chuyển ghế chờ vào members cho ván mới
  const waiters = r.waitingMembers || [];
  const waitingInfo = r.waitingMemberInfo || {};
  const members = [...(r.members || [])];
  const memberInfo = { ...(r.memberInfo || {}) };
  let hasNewMembers = false;
  
  if (waiters.length) {
    waiters.forEach(uid => {
      if (!members.includes(uid)) {
        members.push(uid);
        memberInfo[uid] = waitingInfo[uid] || { name: '?', ready: true };
        hasNewMembers = true;
      }
    });
  }
  
  // Giữ nguyên betConfirmed — nếu cùng members + cùng cược → auto-start kích hoạt ngay
  const gs = r.gameState || {};
  const updates = {
    'gameState.phase': 'betting',
    'gameState.seats': [],
    'gameState.hands': {},
    'gameState.turn': null,
    'gameState.tableCombo': null,
    'gameState.lastPlayer': null,
    'gameState.passCount': 0,
    'gameState.whoPassedThisRound': [],
    'gameState.firstMove': false,
    'gameState.finished': [],
    'gameState.chainPenalties': {},
    'gameState.chayBai': {},
    'gameState.results': null,
    'gameState.winners': null,
    'gameState.lastActionMsg': null,
    'gameState.cycle': (gs.cycle || 0) + 1
  };
  
  // Nếu có thành viên mới → reset betConfirmed để họ xác nhận lại
  if (hasNewMembers) {
    updates['gameState.betConfirmed'] = {};
  }
  // Nếu không có thành viên mới → giữ nguyên betConfirmed
  // (auto-start sẽ kích hoạt nếu tất cả đã confirm cùng mức cược)
  
  if (waiters.length) {
    updates.members = members;
    updates.memberInfo = memberInfo;
    updates.waitingMembers = [];
    updates.waitingMemberInfo = {};
  }
  
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

// ===== ĐỔI CƯỢC (vào betting phase, reset confirm để đặt lại) =====
window.hostChangeBet = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  _selectedSet.clear();
  
  // Reset game state + xoá betConfirmed để mọi người đặt lại
  const gs = r.gameState || {};
  const updates = {
    'gameState.phase': 'betting',
    'gameState.seats': [],
    'gameState.hands': {},
    'gameState.turn': null,
    'gameState.tableCombo': null,
    'gameState.lastPlayer': null,
    'gameState.passCount': 0,
    'gameState.whoPassedThisRound': [],
    'gameState.firstMove': false,
    'gameState.finished': [],
    'gameState.chainPenalties': {},
    'gameState.chayBai': {},
    'gameState.results': null,
    'gameState.winners': null,
    'gameState.lastActionMsg': null,
    'gameState.betConfirmed': {},   // Xoá confirm cũ → mọi người phải xác nhận lại
    'gameState.cycle': (gs.cycle || 0) + 1
  };
  
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

// ===== TURN TIMER =====
function clearTurnTimerLocal() {
  if (_turnTimer) clearInterval(_turnTimer);
  _turnTimer = null; _turnTimerFor = null;
  setActiveRing(null, 1, false);
}
function startTurnTimerIfNeeded(gs) {
  if (_turnTimerFor === gs.turn) return;
  clearTurnTimerLocal();
  _turnTimerFor = gs.turn;
  _turnRemaining = TURN_SECONDS;
  setActiveRing(gs.turn, 1, false);
  _turnTimer = setInterval(() => {
    _turnRemaining--;
    setActiveRing(gs.turn, Math.max(_turnRemaining, 0) / TURN_SECONDS, _turnRemaining <= 10);
    renderStatusBar(_room, _gs, _user.uid);
    if (_turnRemaining <= 0) {
      clearTurnTimerLocal();
      if (_user.uid === gs.turn) autoPlayOnTimeout();
    }
  }, 1000);
}
function setActiveRing(turnUid, fraction, warn) {
  document.querySelectorAll('.seat-timer-fg').forEach(fg => {
    fg.style.strokeDashoffset = '0'; fg.classList.remove('timer-warn');
  });
  if (!turnUid || !_room) return;
  let fg;
  if (turnUid === _user.uid) {
    // Lượt của mình: hiển thị ring trên avatar của mình
    fg = document.getElementById('my-corner-avatar')?.querySelector('.seat-timer-fg');
  } else {
    const seats = _gs?.seats?.length ? _gs.seats : (_room.members || []);
    const others = relativeSeats(seats, _user.uid);
    const slotIds = ['seat-left', 'seat-top', 'seat-right', 'seat-bottom'];
    const slotIdx = others.indexOf(turnUid);
    if (slotIdx < 0) return;
    fg = document.getElementById(slotIds[slotIdx])?.querySelector('.seat-timer-fg');
  }
  if (fg) {
    fg.style.strokeDashoffset = String(RING_CIRC * (1 - fraction));
    fg.classList.toggle('timer-warn', !!warn);
  }
}
function autoPlayOnTimeout() {
  const gs = _gs;
  if (!gs || gs.turn !== _user.uid) return;
  const hand = gs.hands?.[_user.uid] || [];
  if (!hand.length) return;

  if (gs.tableCombo) { window.passTurn(); return; }

  _selectedSet.clear();
  
  // Tìm lá bài cần đánh, sau đó tra vị trí trong _originalHandKeys
  let targetCard;
  if (gs.firstMove) {
    targetCard = hand.find(c => c.rIdx === 0 && c.sIdx === 0) || hand[0];
  } else {
    targetCard = hand[0];
  }
  const cacheIdx = _originalHandKeys.findIndex(k => k === cardKey(targetCard));
  if (cacheIdx >= 0) _selectedSet.add(cacheIdx);
  
  window.playCard();
}

// ===== TẤT TOÁN =====
async function settleMyResult(r, gs) {
  const uid = _user.uid;
  const res = gs.results?.[uid];
  if (!res) return;
  try {
    if (res.outcome === 'win') {
      let buffPct = 0;
      try { buffPct = await getActiveBuff(); } catch {}
      const bonus = buffPct > 0 ? Math.round(res.delta * buffPct / 100) : 0;
      await updateDoc(doc(db, 'users', uid), { points: increment(res.delta + bonus) });
      if (window.VTQuests) { window.VTQuests.trackEarn(res.delta + bonus); window.VTQuests.trackWinSmart(); }
    } else if (res.outcome === 'lose' && res.delta !== 0) {
      await updateDoc(doc(db, 'users', uid), { points: increment(res.delta) });
    }
  } catch (e) { console.error(e); }
}

// ===== THOÁT =====
async function forfeitMatch(r, gs, leaverUid) {
  const seats = gs.seats || [];
  const bet = gs.betAmount || 0;
  const results = {};
  seats.forEach(u => {
    results[u] = u === leaverUid ? { outcome: 'lose', delta: -bet, rank: seats.length } : { outcome: 'draw', delta: 0, rank: 0 };
  });
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.results': results,
    'gameState.winners': [],
    'gameState.lastActionMsg': `${esc(r.memberInfo?.[leaverUid]?.name || '?')} đã rời — huỷ ván!`
  });
  // settleMyResult sẽ xử lý trừ điểm, không trừ 2 lần
}

window.quitGame = async function () {
  try {
    const r = _room;
    if (r) {
      const gs = r.gameState || {};
      if (gs.phase === 'playing' && (gs.seats || []).includes(_user.uid)) {
        await forfeitMatch(r, gs, _user.uid);
      }
      if (r.hostUid === _user.uid) {
        // Chuyển chủ phòng cho người kế tiếp thay vì xoá phòng
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'rooms', ROOM_ID));
        } else {
          const newHost = remaining[0];
          const mi = { ...(r.memberInfo || {}) };
          delete mi[_user.uid];
          const wInfo = { ...(r.waitingMemberInfo || {}) };
          delete wInfo[_user.uid];
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            hostUid: newHost,
            members: arrayRemove(_user.uid),
            memberInfo: mi,
            waitingMembers: arrayRemove(_user.uid),
            waitingMemberInfo: wInfo
          });
        }
      } else if ((r.members || []).length <= 1) {
        await deleteDoc(doc(db, 'rooms', ROOM_ID));
      } else {
        const mi = { ...(r.memberInfo || {}) };
        delete mi[_user.uid];
        // Cũng xoá khỏi ghế chờ nếu có
        const wInfo = { ...(r.waitingMemberInfo || {}) };
        delete wInfo[_user.uid];
        await updateDoc(doc(db, 'rooms', ROOM_ID), {
          members: arrayRemove(_user.uid),
          memberInfo: mi,
          waitingMembers: arrayRemove(_user.uid),
          waitingMemberInfo: wInfo
        });
      }
    }
  } catch (e) { console.error(e); }
  if (_unsub) { _unsub(); _unsub = null; }
  location.href = '../../app/rooms.html';
};

console.log(`${mi('favorite')} Tiến Lên MP loaded`);