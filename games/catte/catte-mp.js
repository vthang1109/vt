// ============================================================
// ===== CÁT TÊ MULTIPLAYER (2-4 người) — theo luật catte.js offline =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from '../../cards.js';
import { getActiveBuff } from '../../pet.js';
import { initRoomChat, getMyNickname } from '../../room-chat.js';
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
if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

const TOTAL_ROUNDS = 6;
const TUNG_AFTER_ROUND = 4;
const TURN_SECONDS = 25;
const RING_CIRC = 113;
const MIN_BET = 10;

let _user = null, _unsub = null, _unsubMe = null, _myBalance = 0, _myActivePet = null;
let _room = null, _gs = null, _selectedIdx = -1, _actionLock = false;
let _autoStartKey = null, _advancedTrickKey = null, _settledKey = null;
let _trickTimer = null;
let _turnTimer = null, _turnTimerFor = null, _turnRemaining = TURN_SECONDS;

// ========== CARD UTILS ==========
const suitRank = { '♠': 1, '♣': 2, '♦': 3, '♥': 4 };
const valRank = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sortHand(hand) {
  return hand.sort((a, b) => (suitRank[a.s] - suitRank[b.s]) || (valRank[a.v] - valRank[b.v]));
}
function cardDisplay(c) { return `${c.v}${c.s}`; }

function canPlayCard(card, leadSuit, currentHighest) {
  if (!leadSuit || !currentHighest) return true;
  if (card.s !== leadSuit) return false;
  return valRank[card.v] > valRank[currentHighest.v];
}
function hasPlayableCard(hand, leadSuit, currentHighest) {
  if (!leadSuit || !currentHighest) return hand.length > 0;
  return hand.some(c => c.s === leadSuit && valRank[c.v] > valRank[currentHighest.v]);
}
// Người kế tiếp còn sống (bỏ qua người đã chết Tùng ở vòng 5-6)
function nextAliveTurn(fromUid, seats, gs) {
  const idx = seats.indexOf(fromUid);
  let n = (idx + 1) % seats.length;
  if (gs.tungChecked && gs.deadPlayers?.length) {
    let guard = 0;
    while (gs.deadPlayers.includes(seats[n]) && guard < seats.length) { n = (n + 1) % seats.length; guard++; }
  }
  return seats[n];
}
// Danh sách đối thủ theo thứ tự lượt, bắt đầu từ người kế tiếp sau mình
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
  window.TopNav.setRoomId(code, '♣️');
}

// ========== AUTH ==========
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = '../../index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.quitGame());
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

window.addEventListener('pagehide', () => window.quitGame?.());

// ========== ROOM LISTENER ==========
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    _room = r;
    updateNavRoom(r.code || '------');
    if (r.gameType !== 'catte' || !r.gameState) return;
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

  if (gs.phase === 'playing' && !gs.currentTrick?.completed) startTurnTimerIfNeeded(gs);
  else clearTurnTimerLocal();

  // Tự động bắt đầu ván khi mọi người đã xác nhận cược
  if (isHost && (!gs.phase || gs.phase === 'betting') && gs.betAmount && members.length >= 2) {
    const allConfirmed = members.every(u => gs.betConfirmed?.[u] === gs.betAmount);
    const key = String(gs.cycle || 0);
    if (allConfirmed && _autoStartKey !== key) {
      _autoStartKey = key;
      setTimeout(() => { if (_room?.hostUid === _user.uid) startMatch(); }, 500);
    }
  }

  // Host điều khiển chuyển vòng sau khi 1 trick hoàn tất (giữ bài 2.5s)
  if (gs.phase === 'playing' && gs.currentTrick?.completed) {
    const key = `${gs.cycle || 0}:${gs.round}`;
    if (isHost && _advancedTrickKey !== key) {
      _advancedTrickKey = key;
      if (_trickTimer) clearTimeout(_trickTimer);
      _trickTimer = setTimeout(() => { advanceTrick(); }, 2500);
    }
  }

  // Cập nhật ghế chờ
  renderWaitingList(r);

  // Tất toán điểm khi có kết quả
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
  const betEl = document.getElementById('ct-bet');
  const scoreEl = document.getElementById('ct-score');
  const subEl = document.getElementById('ct-score-sub');
  const profitEl = document.getElementById('ct-profit');
  const bar = document.getElementById('bc-status');
  bar.classList.remove('result-win', 'result-lose', 'result-draw');

  if (gs.phase !== 'result') {
    betEl.textContent = gs.betAmount ? gs.betAmount.toLocaleString('vi-VN') : '';
    if (gs.phase === 'playing') {
      scoreEl.textContent = gs.turn === uid ? 'LƯỢT BẠN' : esc(shortName(r, gs.turn, uid)).toUpperCase();
      subEl.textContent = (gs.tungChecked && gs.round >= 5) ? 'Chưng Bài'
        : (gs.currentTrick?.leadSuit ? `Vòng ${gs.round}/4` : `Vòng ${gs.round}/4 · Đi tự do`);
      profitEl.textContent = String(_turnRemaining);
      profitEl.className = 'stat-profit timer-color' + (_turnRemaining <= 10 ? ' negative' : '');
    } else {
      scoreEl.textContent = (r.members || []).length < 2 ? 'CHỜ NGƯỜI CHƠI' : 'CHỜ CƯỢC';
      subEl.textContent = '';
      profitEl.textContent = '';
      profitEl.className = 'stat-profit zero';
    }
  } else {
    const res = gs.results?.[uid];
    const outcome = res?.outcome || 'draw';
    scoreEl.textContent = outcome === 'win' ? 'THẮNG' : outcome === 'lose' ? 'THUA' : 'HUỶ';
    subEl.textContent = '';
    const delta = res?.delta || 0;
    profitEl.textContent = delta === 0 ? '' : (delta > 0 ? '+' : '') + delta.toLocaleString('vi-VN');
    profitEl.className = 'stat-profit ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
    bar.classList.add(outcome === 'win' ? 'result-win' : outcome === 'lose' ? 'result-lose' : 'result-draw');
  }
}

// ===== BET ZONE (chủ phòng chọn cược, nhà con xác nhận 1 lần) =====
function renderBetZone(r, gs, isHost, uid, members) {
  const zone = document.getElementById('bet-zone');
  if (gs.phase && gs.phase !== 'betting') { zone.style.display = 'none'; zone.innerHTML = ''; return; }
  zone.style.display = '';

  if (members.length < 2) {
    zone.innerHTML = `<div class="ctmp-bet-waiting">⏳ Đang chờ người chơi... (${members.length}/4)</div>`;
    return;
  }

  const betAmount = gs.betAmount || null;
  const myConfirmed = !!(betAmount && gs.betConfirmed?.[uid] === betAmount);
  const confirmedCount = betAmount ? members.filter(u => gs.betConfirmed?.[u] === betAmount).length : 0;

  if (isHost) {
    zone.innerHTML = `
      <div class="ctmp-bet-card">
        <div class="ctmp-bet-picker">
          <div class="label">Chọn mức cược · ${members.length} người</div>
          <div class="row"><input id="ct-bet-input" type="number" min="${MIN_BET}" step="10" value="${betAmount || 100}"/></div>
          <div class="ctmp-bet-quick">
            <button onclick="quickBet(100)">100</button>
            <button onclick="quickBet(200)">200</button>
            <button onclick="quickBet(500)">500</button>
            <button onclick="quickBet(1000)">1000</button>
          </div>
          <button class="ctmp-bet-confirm" onclick="hostSetBet()">${betAmount ? '🔄 Đổi cược' : '✅ Đặt cược'}</button>
        </div>
        ${betAmount ? `<div class="ctmp-bet-status">Đã xác nhận ${confirmedCount}/${members.length}${myConfirmed ? '' : ' · Bạn chưa xác nhận'}</div>` : ''}
        ${betAmount && !myConfirmed ? `<button class="ctmp-bet-confirm" onclick="confirmBet()">✅ Xác nhận ${betAmount.toLocaleString('vi-VN')}đ</button>` : ''}
      </div>`;
    return;
  }

  if (!betAmount) {
    zone.innerHTML = `<div class="ctmp-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>`;
  } else if (!myConfirmed) {
    zone.innerHTML = `
      <div class="ctmp-bet-card">
        <div class="label">Chủ phòng đặt cược</div>
        <div class="amount">${betAmount.toLocaleString('vi-VN')}đ</div>
        <button class="ctmp-bet-confirm" onclick="confirmBet()">✅ Xác nhận</button>
      </div>`;
  } else {
    zone.innerHTML = `
      <div class="ctmp-bet-card">
        <div class="label">✅ Đã xác nhận ${betAmount.toLocaleString('vi-VN')}đ</div>
        <div class="ctmp-bet-status">Đã xác nhận ${confirmedCount}/${members.length}</div>
      </div>`;
  }
}

window.quickBet = function (amt) {
  const el = document.getElementById('ct-bet-input');
  if (el) el.value = amt;
};

window.hostSetBet = async function () {
  if (!_room || _room.hostUid !== _user.uid) return;
  const el = document.getElementById('ct-bet-input');
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

window.confirmBet = async function () {
  const r = _room; if (!r) return;
  const amt = r.gameState?.betAmount;
  if (!amt) return;
  if (amt > _myBalance) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.betConfirmed.${_user.uid}`]: amt });
  } catch (e) { console.error(e); }
};

// ===== BÀN CHƠI (giống catte offline: seat-top/left/right + trick cards) =====
function renderTable(r, gs, uid) {
  const seats = gs.seats?.length ? gs.seats : (r.members || []);
  const inGame = gs.phase === 'playing' || gs.phase === 'result';
  document.getElementById('game-screen').style.display = inGame ? '' : 'none';
  if (!inGame) return;

  const others = relativeSeats(seats, uid);
  ['seat-left', 'seat-top', 'seat-right'].forEach((slotId, i) => {
    const el = document.getElementById(slotId);
    const oppUid = others[i];
    if (!oppUid) { el.style.display = 'none'; return; }
    el.style.display = '';
    renderSeat(el, r, gs, oppUid, uid);
  });

  const roundDisplay = document.getElementById('ct-round-display');
  const tableArea = document.getElementById('game-screen');
  if (gs.phase !== 'playing') {
    roundDisplay.style.display = 'none';
    tableArea.classList.remove('round-chung');
  } else {
    roundDisplay.style.display = '';
    if (gs.tungChecked && gs.round >= 5) {
      roundDisplay.className = 'ct-round-display chung';
      roundDisplay.textContent = 'Chưng Bài';
      tableArea.classList.add('round-chung');
    } else {
      roundDisplay.className = 'ct-round-display';
      roundDisplay.innerHTML = `Vòng <span>${gs.round || 1}</span>/4`;
      tableArea.classList.remove('round-chung');
    }
  }

  const comboEl = document.getElementById('table-combo');
  const trick = gs.currentTrick;
  if (gs.phase === 'playing' && trick?.plays?.length) {
    comboEl.innerHTML = `<div class="ct-trick-cards">${trick.plays.map(p => {
      const name = esc(shortName(r, p.uid, uid));
      const isWinner = trick.completed && p.uid === trick.winner;
      const cardHtml = p.faceDown ? renderCardUI(null, true) : renderCardUI(p.card);
      return `<div class="ct-trick-card ${p.faceDown ? 'folded' : 'played'}">${cardHtml}<div class="ct-trick-label ${isWinner ? 'winner' : ''} ${p.faceDown ? 'up' : 'danh'}">${name}</div></div>`;
    }).join('')}</div>`;
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

  const isTurn = gs.phase === 'playing' && gs.turn === oppUid && !gs.currentTrick?.completed;
  el.classList.toggle('active-turn', isTurn);

  const wins = gs.trickWins?.[oppUid] || 0;
  const tungEl = el.querySelector('.seat-tung-badge');
  if (tungEl) {
    if (wins > 0) { tungEl.style.display = ''; tungEl.textContent = 'Tùng'; tungEl.classList.remove('rot'); }
    else if (gs.tungChecked) { tungEl.style.display = ''; tungEl.textContent = 'Rớt'; tungEl.classList.add('rot'); }
    else { tungEl.style.display = 'none'; tungEl.classList.remove('rot'); }
  }
  el.classList.toggle('dead', !!(gs.tungChecked && gs.deadPlayers?.includes(oppUid)));

  const stEl = el.querySelector('.seat-status');
  if (stEl) {
    stEl.className = 'seat-status';
    el.classList.remove('played', 'folded');
    const p = gs.currentTrick?.plays?.find(p => p.uid === oppUid);
    if (gs.phase !== 'playing') {
      stEl.textContent = '';
    } else if (p) {
      stEl.textContent = p.faceDown ? 'Úp bài' : 'Đã đánh';
      stEl.classList.add(p.faceDown ? 'up-bai' : 'danh-bai');
      el.classList.add(p.faceDown ? 'folded' : 'played');
    } else if (isTurn) {
      stEl.textContent = 'Đang suy nghĩ...';
      stEl.classList.add('danh-bai');
    } else {
      stEl.textContent = '';
    }
  }
}

function renderResultBox(r, gs, uid) {
  const winners = gs.winners || [];
  if (!winners.length) {
    return `<div class="result-box"><div class="emoji">🚫</div><div class="title">Ván đã huỷ</div></div>`;
  }
  const names = winners.map(w => esc(shortName(r, w, uid))).join(', ');
  const iWon = winners.includes(uid);
  return `<div class="result-box">
    <div class="emoji">${iWon ? '🏆' : '😔'}</div>
    <div class="title">${names} thắng ${gs.maxWins || 0} vòng!</div>
  </div>`;
}

// ===== TAY BÀI + HÀNH ĐỘNG CỦA TÔI =====
function renderMyArea(r, gs, uid) {
  const area = document.getElementById('my-area');
  const inGame = gs.phase === 'playing' || gs.phase === 'result';
  area.style.display = inGame ? '' : 'none';
  if (!inGame) { document.getElementById('my-corner-avatar').style.display = 'none'; return; }
  document.getElementById('my-corner-avatar').style.display = '';

  const avatarEl = document.getElementById('my-avatar');
  applyAvatar(avatarEl, r, uid);
  const myNameEl = document.getElementById('my-name');
  if (myNameEl) myNameEl.textContent = shortName(r, uid, uid);

  const hand = gs.hands?.[uid] || [];
  const isMyTurn = gs.phase === 'playing' && gs.turn === uid && !gs.currentTrick?.completed;
  const dead = !!(gs.tungChecked && gs.deadPlayers?.includes(uid));

  const handEl = document.getElementById('my-hand');
  handEl.innerHTML = hand.length === 0
    ? '<div style="color:#64748b;text-align:center;padding:10px">Hết bài!</div>'
    : hand.map((c, i) => {
      const sel = i === _selectedIdx ? 'selected' : '';
      const dis = isMyTurn ? '' : 'disabled';
      return `<div class="card-slot ${sel} ${dis}" onclick="${isMyTurn ? `selectCard(${i})` : ''}">${renderCardUI(c)}</div>`;
    }).join('');

  const tungBadge = document.getElementById('ct-my-tung-badge');
  const myWins = gs.trickWins?.[uid] || 0;
  if (myWins > 0) { tungBadge.style.display = ''; tungBadge.textContent = 'Tùng'; tungBadge.classList.remove('rot'); }
  else if (gs.tungChecked) { tungBadge.style.display = ''; tungBadge.textContent = 'Rớt'; tungBadge.classList.add('rot'); }
  else { tungBadge.style.display = 'none'; }

  const actEl = document.getElementById('actions');
  if (gs.phase === 'result') {
    const isHost = r.hostUid === uid;
    actEl.innerHTML = isHost
      ? `<button id="ct-new-game-btn" onclick="hostNextRound()">🔄 Ván mới</button>`
      : `<div class="ctmp-waiting-text">⏳ Chờ chủ phòng bắt đầu ván mới...</div>`;
    return;
  }

  if (!isMyTurn || dead) { actEl.innerHTML = ''; return; }

  const trick = gs.currentTrick || {};
  const canFold = !!trick.leadSuit && (trick.plays?.length || 0) > 0;
  const hasPlayable = !trick.leadSuit ? true : hasPlayableCard(hand, trick.leadSuit, trick.currentHighest);
  actEl.innerHTML = `
    <button id="fold-btn" class="${(!hasPlayable && canFold) ? 'pass-glow' : ''}" ${canFold && _selectedIdx >= 0 ? '' : 'disabled'} onclick="foldHand()">Úp bài</button>
    <button id="play-btn" class="${(!hasPlayable && canFold) ? 'pass-glow' : ''}" ${_selectedIdx >= 0 ? '' : 'disabled'} onclick="playCard()">Đánh</button>
  `;
}

window.selectCard = function (idx) {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing' || gs.turn !== _user.uid) return;
  _selectedIdx = _selectedIdx === idx ? -1 : idx;
  renderMyArea(_room, gs, _user.uid);
};

// ===== ĐÁNH BÀI / ÚP BÀI =====
window.playCard = async function (faceDown = false) {
  if (_actionLock) return;
  const r = _room, gs = _gs;
  if (!r || !gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  if (gs.turn !== uid) return;
  const hand = gs.hands?.[uid] || [];
  if (_selectedIdx < 0 || _selectedIdx >= hand.length) return;

  const card = hand[_selectedIdx];
  const trick = gs.currentTrick || { plays: [], leadSuit: null, currentHighest: null, highestUid: null };

  if (trick.leadSuit && trick.currentHighest && !faceDown) {
    if (!canPlayCard(card, trick.leadSuit, trick.currentHighest)) {
      if (hasPlayableCard(hand, trick.leadSuit, trick.currentHighest)) {
        return;
      }
      return;
    }
  } else if (!trick.leadSuit && faceDown) {
    return;
  }

  _actionLock = true;
  try {
    const newHand = [...hand];
    newHand.splice(_selectedIdx, 1);

    const plays = [...(trick.plays || []), { uid, card, faceDown }];
    let leadSuit = trick.leadSuit, currentHighest = trick.currentHighest, highestUid = trick.highestUid;
    if (plays.length === 1 && !faceDown) {
      leadSuit = card.s; currentHighest = card; highestUid = uid;
    } else if (!faceDown && card.s === leadSuit && valRank[card.v] > valRank[currentHighest.v]) {
      currentHighest = card; highestUid = uid;
    }

    const seats = gs.seats || [];
    const expected = (gs.tungChecked && gs.survivors) ? gs.survivors.length : seats.length;
    const name = esc(r.memberInfo?.[uid]?.name || 'Người chơi');

    const updates = { [`gameState.hands.${uid}`]: newHand };

    if (plays.length === expected) {
      const firstFaceUp = plays.find(p => !p.faceDown);
      const winnerUid = firstFaceUp ? highestUid : plays[0].uid;
      const trickWins = { ...(gs.trickWins || {}) };
      trickWins[winnerUid] = (trickWins[winnerUid] || 0) + 1;
      const newRound = (gs.round || 1) + 1;

      updates['gameState.currentTrick'] = { plays, leadSuit, currentHighest, highestUid, completed: true, winner: winnerUid };
      updates['gameState.trickWins'] = trickWins;
      updates['gameState.turn'] = winnerUid;
      updates['gameState.round'] = newRound;
      updates['gameState.lastActionMsg'] = `${esc(r.memberInfo?.[winnerUid]?.name || '?')} thắng vòng ${gs.round}!`;

      if (newRound === TUNG_AFTER_ROUND + 1 && !gs.tungChecked) {
        const survivors = seats.filter(u => trickWins[u] > 0);
        const dead = seats.filter(u => !trickWins[u]);
        updates['gameState.tungChecked'] = true;
        updates['gameState.survivors'] = survivors;
        updates['gameState.deadPlayers'] = dead;

        // Chỉ còn ≤1 người sống → thắng luôn, không cần chưng bài vòng 5-6
        if (survivors.length <= 1) {
          const bet = gs.betAmount || 0;
          const pot = bet * seats.length;
          const results = {};
          if (survivors.length === 1) {
            const winner = survivors[0];
            seats.forEach(u => {
              results[u] = u === winner ? { outcome: 'win', delta: pot - bet } : { outcome: 'lose', delta: -bet };
            });
            updates['gameState.winners'] = survivors;
            updates['gameState.maxWins'] = trickWins[winner] || 0;
            updates['gameState.lastActionMsg'] = `${esc(r.memberInfo?.[winner]?.name || '?')} thắng luôn — mọi người khác rớt tùng!`;
          } else {
            seats.forEach(u => { results[u] = { outcome: 'draw', delta: 0 }; });
            updates['gameState.winners'] = [];
            updates['gameState.maxWins'] = 0;
            updates['gameState.lastActionMsg'] = 'Tất cả rớt tùng — hoà!';
          }
          updates['gameState.phase'] = 'result';
          updates['gameState.results'] = results;
        }
      }
    } else {
      updates['gameState.currentTrick'] = { plays, leadSuit, currentHighest, highestUid, completed: false, winner: null };
      updates['gameState.turn'] = nextAliveTurn(uid, seats, gs);
      updates['gameState.lastActionMsg'] = faceDown ? `${name} úp bài` : `${name} đánh ${cardDisplay(card)}`;
    }

    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
    _selectedIdx = -1;
  } catch (e) {
    console.error('playCard error:', e);
  } finally {
    _actionLock = false;
  }
};

window.foldHand = async function () {
  if (_selectedIdx < 0) return;
  await window.playCard(true);
};

// Host: sau 2.5s giữ bài trên bàn, chuyển vòng mới hoặc kết thúc ván
async function advanceTrick() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (!gs || gs.phase !== 'playing' || !gs.currentTrick?.completed) return;

  if ((gs.round || 1) > TOTAL_ROUNDS) {
    await finishGame(r, gs);
  } else {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.currentTrick': { plays: [], leadSuit: null, currentHighest: null, highestUid: null, completed: false, winner: null }
    });
  }
}

// ===== BẮT ĐẦU VÁN =====
async function startMatch() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  const members = r.members || [];
  if (members.length < 2 || !gs.betAmount) return;
  if (!members.every(u => gs.betConfirmed?.[u] === gs.betAmount)) return;

  const deck = createDeck();
  const seats = [...members];
  const hands = {};
  seats.forEach(uid => { hands[uid] = []; });
  for (let i = 0; i < seats.length * 6; i++) hands[seats[i % seats.length]].push(deck.pop());
  seats.forEach(uid => sortHand(hands[uid]));

  let starter = seats[0];
  for (const uid of seats) {
    if (hands[uid].some(c => c.v === '2' && c.s === '♠')) { starter = uid; break; }
  }

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.seats': seats,
    'gameState.hands': hands,
    'gameState.turn': starter,
    'gameState.round': 1,
    'gameState.currentTrick': { plays: [], leadSuit: null, currentHighest: null, highestUid: null, completed: false, winner: null },
    'gameState.trickWins': Object.fromEntries(seats.map(u => [u, 0])),
    'gameState.tungChecked': false,
    'gameState.survivors': null,
    'gameState.deadPlayers': null,
    'gameState.results': null,
    'gameState.winners': null,
    'gameState.maxWins': null,
    'gameState.lastActionMsg': `Bắt đầu! ${esc(r.memberInfo?.[starter]?.name || '?')} đánh trước`
  });
  if (window.VTQuests) window.VTQuests.trackPlay('catte');
}

// ===== KẾT THÚC VÁN — Nhất ăn tất =====
async function finishGame(r, gs) {
  const seats = gs.seats || [];
  const trickWins = gs.trickWins || {};
  const maxWins = Math.max(...seats.map(u => trickWins[u] || 0));
  const winners = seats.filter(u => (trickWins[u] || 0) === maxWins);
  const bet = gs.betAmount || 0;
  const pot = bet * seats.length;
  const share = Math.round(pot / winners.length);

  const results = {};
  seats.forEach(u => {
    results[u] = winners.includes(u) ? { outcome: 'win', delta: share - bet } : { outcome: 'lose', delta: -bet };
  });

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.results': results,
    'gameState.winners': winners,
    'gameState.maxWins': maxWins
  });
}

function renderWaitingList(r) {
  const waiters = r.waitingMembers || [];
  const el = document.getElementById('ctmp-waiting-list');
  const namesEl = document.getElementById('ctmp-waiting-names');
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

window.hostNextRound = async function () {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  
  // Chuyển ghế chờ vào members cho ván mới
  const waiters = r.waitingMembers || [];
  const waitingInfo = r.waitingMemberInfo || {};
  const updates = {};
  if (waiters.length) {
    const members = [...(r.members || [])];
    const memberInfo = { ...(r.memberInfo || {}) };
    let changed = false;
    waiters.forEach(uid => {
      if (!members.includes(uid)) {
        members.push(uid);
        memberInfo[uid] = waitingInfo[uid] || { name: '?', ready: true };
        changed = true;
      }
    });
    if (changed) {
      updates.members = members;
      updates.memberInfo = memberInfo;
    }
    updates.waitingMembers = [];
    updates.waitingMemberInfo = {};
  }
  
  // Giữ nguyên betAmount & betConfirmed để nhà con không phải xác nhận lại nếu mức cược không đổi
  updates['gameState.phase'] = 'betting';
  updates['gameState.seats'] = [];
  updates['gameState.hands'] = {};
  updates['gameState.turn'] = null;
  updates['gameState.round'] = 0;
  updates['gameState.currentTrick'] = null;
  updates['gameState.trickWins'] = {};
  updates['gameState.tungChecked'] = false;
  updates['gameState.survivors'] = null;
  updates['gameState.deadPlayers'] = null;
  updates['gameState.results'] = null;
  updates['gameState.winners'] = null;
  updates['gameState.maxWins'] = null;
  updates['gameState.lastActionMsg'] = null;

  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

// ===== TURN TIMER (chạy cục bộ trên mỗi client; chỉ người đến lượt mới tự hết giờ) =====
function clearTurnTimerLocal() {
  if (_turnTimer) clearInterval(_turnTimer);
  _turnTimer = null;
  _turnTimerFor = null;
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
    fg.style.strokeDashoffset = '0';
    fg.classList.remove('timer-warn');
  });
  if (!turnUid || !_room) return;
  let fg;
  if (turnUid === _user.uid) {
    // Lượt của mình: hiển thị ring trên avatar của mình
    fg = document.getElementById('my-corner-avatar')?.querySelector('.seat-timer-fg');
  } else {
    const seats = _gs?.seats?.length ? _gs.seats : (_room.members || []);
    const others = relativeSeats(seats, _user.uid);
    const slotIds = ['seat-left', 'seat-top', 'seat-right'];
    const slotIdx = others.indexOf(turnUid);
    if (slotIdx < 0) return;
    const el = document.getElementById(slotIds[slotIdx]);
    fg = el?.querySelector('.seat-timer-fg');
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
  const trick = gs.currentTrick || {};
  if (!trick.leadSuit || !trick.plays?.length) {
    _selectedIdx = 0;
    window.playCard(false);
    return;
  }
  const idx = hand.findIndex(c => c.s === trick.leadSuit && valRank[c.v] > valRank[trick.currentHighest.v]);
  if (idx >= 0) { _selectedIdx = idx; window.playCard(false); }
  else { _selectedIdx = hand.length - 1; window.playCard(true); }
}

// ===== TẤT TOÁN ĐIỂM =====
async function settleMyResult(r, gs) {
  const uid = _user.uid;
  const res = gs.results?.[uid];
  if (!res) return;
  try {
    if (res.outcome === 'win') {
      const winAmt = res.delta;
      let buffBonus = 0, buffPct = 0;
      try {
        buffPct = await getActiveBuff();
        if (buffPct > 0) buffBonus = Math.round(winAmt * buffPct / 100);
      } catch {}
      const net = winAmt + buffBonus;
      await updateDoc(doc(db, 'users', uid), { points: increment(net) });
      if (window.VTQuests) { window.VTQuests.trackEarn(net); window.VTQuests.trackWinSmart(); }
    } else if (res.outcome === 'lose') {
      if (res.delta !== 0) await updateDoc(doc(db, 'users', uid), { points: increment(res.delta) });
    }
  } catch (e) { console.error(e); }
}

// ===== RỜI PHÒNG (huỷ ván nếu đang chơi dở — người rời mất cược) =====
async function forfeitMatch(r, gs, leaverUid) {
  const seats = gs.seats || [];
  const bet = gs.betAmount || 0;
  const results = {};
  seats.forEach(u => {
    results[u] = u === leaverUid ? { outcome: 'lose', delta: -bet } : { outcome: 'draw', delta: 0 };
  });
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.results': results,
    'gameState.winners': [],
    'gameState.maxWins': 0,
    'gameState.lastActionMsg': `${esc(r.memberInfo?.[leaverUid]?.name || '?')} đã rời — huỷ ván!`
  });
  if (bet > 0) {
    try { await updateDoc(doc(db, 'users', leaverUid), { points: increment(-bet) }); } catch (e) { console.error(e); }
  }
}

window.quitGame = async function () {
  try {
    const r = _room;
    if (r) {
      const gs = r.gameState || {};
      const stillIn = (gs.seats || []).includes(_user.uid) && !(gs.tungChecked && gs.deadPlayers?.includes(_user.uid));
      if (gs.phase === 'playing' && stillIn) {
        await forfeitMatch(r, gs, _user.uid);
      }
      if (r.hostUid === _user.uid) {
        await deleteDoc(doc(db, 'rooms', ROOM_ID));
      } else {
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'rooms', ROOM_ID));
        } else {
          const mi = r.memberInfo || {};
          delete mi[_user.uid];
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
    }
  } catch (e) { console.error(e); }
  if (_unsub) { _unsub(); _unsub = null; }
  location.href = '../../app/rooms.html';
};

console.log('♣️ Cát Tê MP loaded');