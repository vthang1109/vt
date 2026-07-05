// ============================================================
// ===== CỜ VUA MULTIPLAYER (PvP qua phòng, dựa theo xidach-mp) =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getActiveBuff, getPetById, getTierById } from './pet.js';
import { initRoomChat, getMyNickname } from './room-chat.js';

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
let _user = null, _unsub = null, _unsubMe = null, _myBalance = 0;
let _settledRound = -1;
let _autoStartRound = -1;
let _drawModalShownFor = null;
let _actionLock = false;
let _lastRoomData = null, _gs = null;
let _lastDeclineHandled = null;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// --- KIỂM TRA THƯ VIỆN chess.js ---
if (typeof Chess === 'undefined') {
  const s = document.getElementById('status');
  if (s) s.textContent = '❌ Không tải được chess.js. Kiểm tra mạng.';
  throw new Error('Chess library not loaded');
}

const game = new Chess();
let selected = null;
let targets = [];

// Bộ quân cờ Cburnett (chuẩn Lichess/Wikipedia)
const PIECE_CDN_BASE = 'https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/';
const PIECE_SVG = {
  wk: `<img src="${PIECE_CDN_BASE}wK.svg" alt="wK" draggable="false">`,
  bk: `<img src="${PIECE_CDN_BASE}bK.svg" alt="bK" draggable="false">`,
  wq: `<img src="${PIECE_CDN_BASE}wQ.svg" alt="wQ" draggable="false">`,
  bq: `<img src="${PIECE_CDN_BASE}bQ.svg" alt="bQ" draggable="false">`,
  wr: `<img src="${PIECE_CDN_BASE}wR.svg" alt="wR" draggable="false">`,
  br: `<img src="${PIECE_CDN_BASE}bR.svg" alt="bR" draggable="false">`,
  wb: `<img src="${PIECE_CDN_BASE}wB.svg" alt="wB" draggable="false">`,
  bb: `<img src="${PIECE_CDN_BASE}bB.svg" alt="bB" draggable="false">`,
  wn: `<img src="${PIECE_CDN_BASE}wN.svg" alt="wN" draggable="false">`,
  bn: `<img src="${PIECE_CDN_BASE}bN.svg" alt="bN" draggable="false">`,
  wp: `<img src="${PIECE_CDN_BASE}wP.svg" alt="wP" draggable="false">`,
  bp: `<img src="${PIECE_CDN_BASE}bP.svg" alt="bP" draggable="false">`
};
function pieceChar(piece) {
  const key = (piece.color === 'w' ? 'w' : 'b') + piece.type;
  return PIECE_SVG[key] || '';
}

// ========== UTILS ==========
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateNavRoom(roomCode) {
  if (!roomCode) return;
  const logo = document.querySelector('.vt-top-nav .vt-nav-logo');
  if (!logo) return;
  let roomEl = logo.querySelector('.vt-room-id');
  if (!roomEl) {
    roomEl = document.createElement('span');
    roomEl.className = 'vt-room-id';
    logo.innerHTML = '';
    logo.appendChild(roomEl);
  }
  roomEl.innerHTML = `<span class="room-icon">♟️</span> #${roomCode}`;
}

// Chuyển tọa độ ô hiển thị (r,c) -> ô cờ thực, có tính đến việc bàn cờ xoay
// theo màu quân của người chơi đang xem (mỗi người thấy quân mình ở dưới).
function squareInfo(r, c, orientColor) {
  const rank = orientColor === 'b' ? (r + 1) : (8 - r);
  const fileIndex = orientColor === 'b' ? (7 - c) : c;
  const file = 'abcdefgh'[fileIndex];
  return {
    sq: file + rank,
    boardRow: 8 - rank,
    boardCol: fileIndex,
    isLight: (fileIndex + rank) % 2 === 0
  };
}

function findKingSquare(color) {
  const b = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.type === 'k' && p.color === color) {
        const file = 'abcdefgh'[c];
        const rank = 8 - r;
        return file + rank;
      }
    }
  }
  return null;
}

function flashInvalidSquare(sq) {
  const cellEl = document.querySelector(`#board .square[data-square="${sq}"]`);
  if (!cellEl) return;
  cellEl.classList.remove('invalid');
  void cellEl.offsetWidth;
  cellEl.classList.add('invalid');
  setTimeout(() => cellEl.classList.remove('invalid'), 400);
}

// mới
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.quitGame());
  _unsubMe = onSnapshot(doc(db, 'users', _user.uid), (s) => {
    if (s.exists()) {
      _myBalance = s.data().points || 0;
      if (window.TopNav) window.TopNav.setPoints(_myBalance);
    }
  });
  if (ROOM_ID) {
    start();
    const myName = await getMyNickname(db, _user.uid, _user.email);
    initRoomChat({
      db,
      roomId: ROOM_ID,
      uid: _user.uid,
      getName: () => myName
    });
  }
});

/* ========== FIREBASE LISTENER ========== */
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    updateNavRoom(r.code || '------');
    if (r.gameType !== 'chess' || !r.gameState) return;
    render(r);
  });
}

/* ========== RENDER BÀN CỜ ========== */
function renderBoard(gs) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  const myColor = gs.colors?.[_user.uid] || 'w';
  const b = game.board();
  const inCheck = gs.phase === 'playing' && game.in_check();
  const checkedKingSq = inCheck ? findKingSquare(game.turn()) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const { sq, boardRow, boardCol, isLight } = squareInfo(r, c, myColor);
      const cell = document.createElement('div');
      cell.className = `square ${isLight ? 'light' : 'dark'}`;
      cell.dataset.square = sq;

      if (sq === selected) cell.classList.add('selected');
      if (gs.lastMove && (sq === gs.lastMove.from || sq === gs.lastMove.to)) cell.classList.add('last-move');
      if (targets.includes(sq)) {
        cell.classList.add('move');
        if (b[boardRow][boardCol]) cell.classList.add('capture');
      }
      if (sq === checkedKingSq) cell.classList.add('king-check');

      const p = b[boardRow][boardCol];
      if (p) {
        const span = document.createElement('span');
        span.className = `piece ${p.color === 'w' ? 'piece-white' : 'piece-black'}`;
        span.innerHTML = pieceChar(p);
        cell.appendChild(span);
      }

      cell.addEventListener('click', onSquareClick);
      boardEl.appendChild(cell);
    }
  }
}

function onSquareClick(e) {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing') return;
  const myColor = gs.colors?.[_user.uid];
  if (!myColor) return;
  if (gs.turn !== myColor) return;

  const sq = e.currentTarget.dataset.square;
  const piece = game.get(sq);

  if (selected) {
    if (sq === selected) {
      selected = null;
      targets = [];
      renderBoard(gs);
      return;
    }

    let move = null;
    try {
      move = game.move({ from: selected, to: sq, promotion: 'q' });
    } catch (_) {
      move = null;
    }

    if (move) {
      selected = null;
      targets = [];
      pushMove(move);
      return;
    }

    if (piece && piece.color === myColor) {
      selected = sq;
      targets = game.moves({ square: sq, verbose: true }).map(m => m.to);
      renderBoard(gs);
      return;
    }

    flashInvalidSquare(sq);
    return;
  }

  if (piece && piece.color === myColor) {
    selected = sq;
    targets = game.moves({ square: sq, verbose: true }).map(m => m.to);
  } else {
    selected = null;
    targets = [];
  }
  renderBoard(gs);
}

async function pushMove(move) {
  if (_actionLock) return;
  _actionLock = true;
  try {
    const fen = game.fen();
    const lastMove = { from: move.from, to: move.to };
    const updates = {
      'gameState.fen': fen,
      'gameState.lastMove': lastMove,
      'gameState.turn': game.turn(),
      'gameState.moveCount': (_gs?.moveCount || 0) + 1
    };
    if (game.in_checkmate()) {
      updates['gameState.phase'] = 'result';
      updates['gameState.result'] = 'checkmate';
      updates['gameState.winnerUid'] = _user.uid;
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
      updates['gameState.phase'] = 'result';
      updates['gameState.result'] = 'draw';
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  } finally {
    _actionLock = false;
  }
}

/* ========== RENDER TOÀN TRANG ========== */
function render(r) {
  _lastRoomData = r;
  const gs = r.gameState || {};
  _gs = gs;

  const uid = _user.uid;
  const members = r.members || [];
  const oppUid = members.find(u => u !== uid);
  const isHost = r.hostUid === uid;

  const scoreEl = document.getElementById('chess-score');
  const scoreSubEl = document.getElementById('chess-score-sub');
  const profitEl = document.getElementById('chess-profit');
  const betValueEl = document.getElementById('chess-bet-value');
  const meLabel = document.getElementById('side-me-label');
  const oppLabel = document.getElementById('side-opp-label');
  const sideMe = document.getElementById('side-me');
  const sideOpp = document.getElementById('side-opp');
  const statusEl = document.getElementById('status');
  const actEl = document.getElementById('chess-actions');
  const bcStatusEl = document.getElementById('bc-status');

  meLabel.textContent = 'BẠN';
  oppLabel.textContent = esc(r.memberInfo?.[oppUid]?.name || 'Đối thủ');
  bcStatusEl.className = 'bc-status';
  sideMe.classList.remove('active-turn');
  sideOpp.classList.remove('active-turn');

  if (members.length < 2) {
    document.getElementById('board').innerHTML = '';
    statusEl.textContent = 'Đối thủ đã rời phòng.';
    actEl.innerHTML = '';
    document.getElementById('chess-bet-zone').innerHTML = '';
    hideDrawModal();
    return;
  }

  if (gs.phase === 'betting' || !gs.phase) {
    game.reset();
    selected = null;
    targets = [];
    renderBoard(gs);

    betValueEl.textContent = '0';
    profitEl.textContent = '+0'; profitEl.className = 'stat-profit zero';
    scoreEl.textContent = '--'; scoreSubEl.textContent = 'Đặt cược';
    statusEl.textContent = 'Chủ phòng chọn mức cược, đối thủ xác nhận để bắt đầu ván đấu.';
    actEl.innerHTML = '';
    hideDrawModal();

    renderBetZone(r, gs, isHost, uid, oppUid);

    // Nếu đối thủ vừa từ chối mức cược: chủ phòng hoàn tiền cược và reset (chỉ xử lý 1 lần/round)
    if (isHost && gs.betDeclinedBy) {
      const key = `${gs.round}:${gs.betDeclinedBy}`;
      if (_lastDeclineHandled !== key) {
        _lastDeclineHandled = key;
        refundDeclinedBet(gs);
      }
    }

    const p1 = members[0], p2 = members[1];
    const allBet = gs.betAmount && p1 && p2 && (gs.bets?.[p1] || 0) > 0 && (gs.bets?.[p2] || 0) > 0;
    if (isHost && allBet && gs.round !== _autoStartRound) {
      _autoStartRound = gs.round;
      setTimeout(() => { hostStartMatch(); }, 400);
    }
    return;
  }

  // playing hoặc result
  document.getElementById('chess-bet-zone').innerHTML = '';
  game.load(gs.fen || game.fen());

  const myColor = gs.colors?.[uid];
  const myBet = gs.bets?.[uid] || 0;
  const oppBet = gs.bets?.[oppUid] || 0;
  betValueEl.textContent = myBet.toLocaleString('vi-VN');

  renderBoard(gs);

  if (gs.phase === 'playing') {
    const turnLabel = gs.turn === 'w' ? 'Trắng' : 'Đen';
    const myTurn = gs.turn === myColor;
    scoreEl.textContent = turnLabel.toUpperCase();
    scoreSubEl.textContent = myTurn ? 'Lượt của bạn' : 'Lượt đối thủ';
    profitEl.textContent = '+0'; profitEl.className = 'stat-profit zero';
    statusEl.textContent = game.in_check() ? `Đang bị chiếu: ${turnLabel}.` : `Lượt đi: ${turnLabel}`;
    bcStatusEl.classList.toggle('in-check', game.in_check());
    bcStatusEl.classList.add('in-progress');
    if (myTurn) sideMe.classList.add('active-turn'); else sideOpp.classList.add('active-turn');

    const drawPendingMine = gs.drawOffer?.uid === uid;
    const canOfferDraw = !gs.drawOffer;
    actEl.innerHTML = `
      <button class="chess-act-btn chess-act-red" onclick="resignGame()">🏳️ Đầu hàng</button>
      <button class="chess-act-btn chess-act-blue" ${canOfferDraw ? '' : 'disabled'} onclick="offerDraw()">${drawPendingMine ? 'Đã đề nghị...' : '🤝 Đề nghị hòa'}</button>
    `;

    if (gs.drawOffer && gs.drawOffer.uid !== uid) {
      showDrawModal(r, gs.drawOffer);
    } else {
      hideDrawModal();
    }
  } else if (gs.phase === 'result') {
    bcStatusEl.classList.remove('in-progress');
    hideDrawModal();

    let outcome;
    if (gs.result === 'draw') outcome = 'draw';
    else outcome = gs.winnerUid === uid ? 'win' : 'lose';

    scoreEl.textContent = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'HÒA';
    scoreSubEl.textContent = '';
    bcStatusEl.classList.add(outcome === 'win' ? 'result-win' : outcome === 'lose' ? 'result-lose' : 'result-draw');

    let net = 0;
    if (outcome === 'win') net = oppBet;
    else if (outcome === 'lose') net = -myBet;
    profitEl.classList.remove('positive', 'negative', 'zero');
    if (net > 0) { profitEl.textContent = `+${net.toLocaleString('vi-VN')}`; profitEl.classList.add('positive'); }
    else if (net < 0) { profitEl.textContent = `${net.toLocaleString('vi-VN')}`; profitEl.classList.add('negative'); }
    else { profitEl.textContent = 'Huề'; profitEl.classList.add('zero'); }

    let reasonText = '';
    if (gs.result === 'checkmate') reasonText = 'Chiếu hết.';
    else if (gs.result === 'resign') reasonText = (gs.winnerUid === uid ? 'Đối thủ đã đầu hàng.' : 'Bạn đã đầu hàng.');
    else if (gs.result === 'draw') reasonText = 'Hòa cờ.';
    statusEl.textContent = `${reasonText} ${outcome === 'win' ? 'Bạn thắng!' : outcome === 'lose' ? 'Bạn thua.' : ''}`.trim();

    actEl.innerHTML = isHost
      ? `<button class="chess-act-btn chess-act-yellow" onclick="hostNextRound()">⟳ Ván mới</button>`
      : `<span class="chess-wait-host">Chờ chủ phòng bắt đầu ván mới...</span>`;

    if (gs.round !== _settledRound) {
      _settledRound = gs.round;
      settleMyResult(r, gs);
    }
  }
}

/* ========== VÙNG ĐẶT CƯỢC (chủ phòng chọn mức, đối thủ xác nhận) ========== */
function renderBetZone(r, gs, isHost, uid, oppUid) {
  const zone = document.getElementById('chess-bet-zone');
  const betAmount = gs.betAmount || null;
  const oppConfirmed = oppUid && !!gs.bets?.[oppUid];
  const meConfirmed = !!gs.bets?.[uid];

  if (isHost) {
    if (!betAmount) {
      zone.innerHTML = `
        <div class="chess-bet-picker">
          <div class="chess-bet-picker-label">Chọn mức cược cho ván này</div>
          <div class="chess-bet-picker-row">
            <input id="chess-bet-input" type="number" min="50" step="50" value="100"/>
          </div>
          <div class="chess-bet-quick">
            <button type="button" onclick="chessQuickBet(100)">100</button>
            <button type="button" onclick="chessQuickBet(200)">200</button>
            <button type="button" onclick="chessQuickBet(500)">500</button>
            <button type="button" onclick="chessQuickBet(1000)">1000</button>
          </div>
          <button class="chess-bet-confirm-btn" onclick="hostSetBet()">✅ Đặt mức cược</button>
        </div>`;
    } else {
      zone.innerHTML = `<div class="chess-bet-waiting">⏳ Đã đặt mức cược <b>${betAmount.toLocaleString('vi-VN')}đ</b> — đang chờ đối thủ xác nhận...</div>`;
    }
    return;
  }

  // không phải host
  if (!betAmount) {
    zone.innerHTML = `<div class="chess-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>`;
  } else if (!meConfirmed) {
    zone.innerHTML = `
      <div class="chess-bet-confirm-card">
        <div class="chess-bet-confirm-title">Chủ phòng muốn đặt cược</div>
        <div class="chess-bet-confirm-amt">${betAmount.toLocaleString('vi-VN')}đ</div>
        <div class="chess-bet-confirm-actions">
          <button class="decline" onclick="declineBet()">Từ chối</button>
          <button class="accept" onclick="acceptBet()">Đồng ý</button>
        </div>
      </div>`;
  } else {
    zone.innerHTML = `<div class="chess-bet-waiting">✅ Đã xác nhận cược ${betAmount.toLocaleString('vi-VN')}đ — đang bắt đầu ván đấu...</div>`;
  }
}

window.chessQuickBet = function(amt) {
  const el = document.getElementById('chess-bet-input');
  if (el) el.value = amt;
};

window.hostSetBet = async function() {
  const el = document.getElementById('chess-bet-input');
  const amt = parseInt(el?.value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm', 'error'); return; }
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: _myBalance - amt });
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': amt,
      [`gameState.bets.${_user.uid}`]: amt
    });
    showToast('✅ Đã đặt mức cược ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.acceptBet = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  const amt = gs.betAmount;
  if (!amt || gs.bets?.[_user.uid]) return;
  if (amt > _myBalance) { showToast('Không đủ điểm để đồng ý mức cược này', 'error'); return; }
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: _myBalance - amt });
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    showToast('✅ Đã xác nhận cược', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.declineBet = async function() {
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.betDeclinedBy': _user.uid });
  } catch (e) { console.error(e); }
};

// Chỉ chủ phòng gọi: hoàn lại tiền cược của chính mình rồi reset mức cược để chọn lại
async function refundDeclinedBet(gs) {
  const amt = gs.betAmount || 0;
  try {
    if (amt > 0) {
      const us = await getDoc(doc(db, 'users', _user.uid));
      const cur = us.exists() ? (us.data().points || 0) : 0;
      await updateDoc(doc(db, 'users', _user.uid), { points: cur + amt });
      showToast(`↩️ Đối thủ từ chối mức cược, đã hoàn lại ${amt.toLocaleString('vi-VN')}đ`, 'info');
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': null,
      'gameState.bets': {},
      'gameState.betDeclinedBy': null
    });
  } catch (e) { console.error(e); }
}

function showDrawModal(r, offer) {
  if (_drawModalShownFor === offer.uid) return;
  _drawModalShownFor = offer.uid;
  let modal = document.getElementById('chess-draw-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chess-draw-modal';
    modal.className = 'chess-modal-overlay';
    document.body.appendChild(modal);
  }
  const name = esc(offer.name || r.memberInfo?.[offer.uid]?.name || 'Đối thủ');
  modal.innerHTML = `
    <div class="chess-modal-box">
      <div class="chess-modal-title">${name} đề nghị hòa</div>
      <div class="chess-modal-actions">
        <button class="chess-modal-btn decline" onclick="declineDraw()">Từ chối</button>
        <button class="chess-modal-btn accept" onclick="acceptDraw()">Đồng ý</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

function hideDrawModal() {
  _drawModalShownFor = null;
  const modal = document.getElementById('chess-draw-modal');
  if (modal) modal.style.display = 'none';
}

/* ========== HÀNH ĐỘNG ========== */
async function hostStartMatch() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  if (gs.phase !== 'betting') return;
  const members = r.members || [];
  if (members.length < 2) return;
  const p1 = members[0], p2 = members[1];
  if (!((gs.bets?.[p1] || 0) > 0 && (gs.bets?.[p2] || 0) > 0)) return;

  const flip = Math.random() < 0.5;
  const whiteUid = flip ? p2 : p1;
  const blackUid = flip ? p1 : p2;

  game.reset();
  if (window.VTQuests) window.VTQuests.trackPlay('chess');
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.colors': { [whiteUid]: 'w', [blackUid]: 'b' },
    'gameState.fen': game.fen(),
    'gameState.turn': 'w',
    'gameState.lastMove': null,
    'gameState.moveCount': 0,
    'gameState.players': [whiteUid, blackUid],
    'gameState.result': null,
    'gameState.winnerUid': null,
    'gameState.drawOffer': null
  });
}

window.resignGame = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  const oppUid = (r.members || []).find(u => u !== _user.uid);
  if (!oppUid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.result': 'resign',
    'gameState.winnerUid': oppUid
  });
};

window.offerDraw = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing' || gs.drawOffer) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.drawOffer': { uid: _user.uid, name: r.memberInfo?.[_user.uid]?.name || 'Người chơi' }
  });
  showToast('✅ Đã gửi đề nghị hòa', 'success');
};

window.acceptDraw = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  const offer = gs.drawOffer;
  if (!offer || offer.uid === _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.result': 'draw',
    'gameState.drawOffer': null
  });
};

window.declineDraw = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  const offer = gs.drawOffer;
  if (!offer || offer.uid === _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.drawOffer': null });
};

window.hostNextRound = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.bets': {},
    'gameState.betAmount': null,
    'gameState.betDeclinedBy': null,
    'gameState.colors': {},
    'gameState.fen': null,
    'gameState.turn': 'w',
    'gameState.lastMove': null,
    'gameState.moveCount': 0,
    'gameState.result': null,
    'gameState.winnerUid': null,
    'gameState.drawOffer': null,
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

/* ========== THANH TOÁN CƯỢC ========== */
async function settleMyResult(r, gs) {
  const uid = _user.uid;
  const members = r.members || [];
  const oppUid = members.find(u => u !== uid);
  const myBet = gs.bets?.[uid] || 0;
  const oppBet = gs.bets?.[oppUid] || 0;
  const outcome = gs.result === 'draw' ? 'draw' : (gs.winnerUid === uid ? 'win' : 'lose');

  if (outcome === 'win') {
    const winAmount = oppBet;
    let buffBonus = 0, buffPct = 0;
    try {
      buffPct = await getActiveBuff();
      if (buffPct > 0) buffBonus = Math.round(winAmount * buffPct / 100);
    } catch {}
    const totalRefund = myBet + winAmount + buffBonus;
    const us = await getDoc(doc(db, 'users', uid));
    const cur = us.exists() ? (us.data().points || 0) : 0;
    await updateDoc(doc(db, 'users', uid), { points: cur + totalRefund });

    if (buffBonus > 0) {
      const petData = await (async () => {
        try {
          const ud = await getDoc(doc(db, 'users', uid));
          const activePetId = ud.data()?.activePet;
          if (!activePetId) return null;
          const pet = getPetById(activePetId);
          const tier = pet ? getTierById(pet.tier) : null;
          return pet ? { emoji: pet.emoji, name: pet.name, tierName: tier?.name } : null;
        } catch { return null; }
      })();
      const petLabel = petData ? `${petData.emoji} ${petData.name}` : '🐾 Pet';
      showToast(`🎉 Thắng +${winAmount.toLocaleString('vi-VN')}đ  ${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
    } else {
      showToast(`🎉 Thắng +${winAmount.toLocaleString('vi-VN')}đ!`, 'success');
    }
    if (window.VTQuests) { window.VTQuests.trackEarn(winAmount + buffBonus); window.VTQuests.trackWinSmart(); }

  } else if (outcome === 'draw') {
    const us = await getDoc(doc(db, 'users', uid));
    const cur = us.exists() ? (us.data().points || 0) : 0;
    await updateDoc(doc(db, 'users', uid), { points: cur + myBet });
    showToast('🤝 Hoà, hoàn lại cược', 'info');

  } else {
    showToast(`💸 Thua ${myBet.toLocaleString('vi-VN')}đ`, 'warn');
  }
}

/* ========== THOÁT PHÒNG ========== */
window.quitGame = async function() {
  try {
    const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
    if (snap.exists()) {
      const r = snap.data();
      if (r.gameState?.phase === 'betting') {
        const myBet = r.gameState.bets?.[_user.uid] || 0;
        if (myBet > 0) {
          const us = await getDoc(doc(db, 'users', _user.uid));
          const cur = us.exists() ? (us.data().points || 0) : 0;
          await updateDoc(doc(db, 'users', _user.uid), { points: cur + myBet });
        }
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
          await updateDoc(doc(db, 'rooms', ROOM_ID), { members: arrayRemove(_user.uid), memberInfo: mi });
        }
      }
    }
  } catch (e) {}
  location.href = 'rooms.html';
};
