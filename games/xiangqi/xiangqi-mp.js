// ============================================================
// ===== CỜ TƯỚNG MULTIPLAYER (PvP qua phòng, dựa theo chess-mp) =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getActiveBuff, getPetById, getTierById } from '../../pet.js';
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
let _user = null, _unsub = null, _unsubMe = null, _myBalance = 0, _myActivePet = null;
let _settledRound = -1;
let _autoStartRound = -1;
let _drawModalShownFor = null;
let _actionLock = false;
let _room = null, _gs = null;
let _lastDeclineHandled = null;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ==================== ENGINE CỜ TƯỚNG (LUẬT) — giống hệt xiangqi.js ====================
const PIECE_LABEL = {
  r: { k: '帥', a: '仕', e: '相', h: '傌', c: '俥', n: '炮', p: '兵' },
  b: { k: '將', a: '士', e: '象', h: '馬', c: '車', n: '砲', p: '卒' }
};

function createInitialBoard() {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ['c', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'c'];
  back.forEach((t, c) => { b[0][c] = { type: t, color: 'b' }; b[9][c] = { type: t, color: 'r' }; });
  [1, 7].forEach(c => { b[2][c] = { type: 'n', color: 'b' }; b[7][c] = { type: 'n', color: 'r' }; });
  [0, 2, 4, 6, 8].forEach(c => { b[3][c] = { type: 'p', color: 'b' }; b[6][c] = { type: 'p', color: 'r' }; });
  return b;
}
function cloneBoard(board) { return board.map(row => row.slice()); }
function opposite(color) { return color === 'r' ? 'b' : 'r'; }
function inBounds(r, c) { return r >= 0 && r <= 9 && c >= 0 && c <= 8; }
function inPalace(r, c, color) {
  return color === 'b' ? (r >= 0 && r <= 2 && c >= 3 && c <= 5) : (r >= 7 && r <= 9 && c >= 3 && c <= 5);
}
function findGeneral(board, color) {
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (p && p.type === 'k' && p.color === color) return [r, c];
  }
  return null;
}
function pushIfOk(board, moves, from, r, c, color) {
  if (!inBounds(r, c)) return;
  const t = board[r][c];
  if (!t || t.color !== color) moves.push({ from, to: [r, c] });
}
function generalMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function advisorMoves(board, r, c, color, moves) {
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (inPalace(nr, nc, color)) pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function elephantMoves(board, r, c, color, moves) {
  [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (color === 'b' && nr > 4) return;
    if (color === 'r' && nr < 5) return;
    if (board[r + dr / 2][c + dc / 2]) return;
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function horseMoves(board, r, c, color, moves) {
  [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) return;
    const leg = Math.abs(dr) === 2 ? [r + dr / 2, c] : [r, c + dc / 2];
    if (board[leg[0]][leg[1]]) return;
    pushIfOk(board, moves, [r, c], nr, nc, color);
  });
}
function chariotMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!t) { moves.push({ from: [r, c], to: [nr, nc] }); }
      else { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      nr += dr; nc += dc;
    }
  });
}
function cannonMoves(board, r, c, color, moves) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc, screen = false;
    while (inBounds(nr, nc)) {
      const t = board[nr][nc];
      if (!screen) {
        if (!t) moves.push({ from: [r, c], to: [nr, nc] });
        else screen = true;
      } else {
        if (t) { if (t.color !== color) moves.push({ from: [r, c], to: [nr, nc] }); break; }
      }
      nr += dr; nc += dc;
    }
  });
}
function pawnMoves(board, r, c, color, moves) {
  const fwd = color === 'b' ? 1 : -1;
  pushIfOk(board, moves, [r, c], r + fwd, c, color);
  const crossed = color === 'b' ? r >= 5 : r <= 4;
  if (crossed) {
    pushIfOk(board, moves, [r, c], r, c + 1, color);
    pushIfOk(board, moves, [r, c], r, c - 1, color);
  }
}
function generatePseudoMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (!p || p.color !== color) continue;
    if (p.type === 'k') generalMoves(board, r, c, color, moves);
    else if (p.type === 'a') advisorMoves(board, r, c, color, moves);
    else if (p.type === 'e') elephantMoves(board, r, c, color, moves);
    else if (p.type === 'h') horseMoves(board, r, c, color, moves);
    else if (p.type === 'c') chariotMoves(board, r, c, color, moves);
    else if (p.type === 'n') cannonMoves(board, r, c, color, moves);
    else if (p.type === 'p') pawnMoves(board, r, c, color, moves);
  }
  return moves;
}
function isAttacked(board, sq, byColor) {
  const moves = generatePseudoMoves(board, byColor);
  return moves.some(m => m.to[0] === sq[0] && m.to[1] === sq[1]);
}
function isInCheck(board, color) {
  const gp = findGeneral(board, color);
  if (!gp) return true;
  return isAttacked(board, gp, opposite(color));
}
function generalsFacing(board) {
  const rg = findGeneral(board, 'r'), bg = findGeneral(board, 'b');
  if (!rg || !bg || rg[1] !== bg[1]) return false;
  const c = rg[1], r1 = Math.min(rg[0], bg[0]), r2 = Math.max(rg[0], bg[0]);
  for (let r = r1 + 1; r < r2; r++) if (board[r][c]) return false;
  return true;
}
function simulateMove(board, move) {
  const nb = cloneBoard(board);
  nb[move.to[0]][move.to[1]] = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  return nb;
}
function generateLegalMoves(board, color) {
  const pseudo = generatePseudoMoves(board, color);
  return pseudo.filter(m => {
    const nb = simulateMove(board, m);
    if (isInCheck(nb, color)) return false;
    if (generalsFacing(nb)) return false;
    return true;
  });
}
function isGameOver(board, color) {
  if (!findGeneral(board, color)) return true;
  return generateLegalMoves(board, color).length === 0;
}
// ==================== HẾT PHẦN ENGINE ====================

// Mã hoá bàn cờ thành chuỗi 2-ký-tự/ô để lưu Firestore (tránh mảng lồng mảng không được hỗ trợ)
function boardToStr(board) {
  let s = '';
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    s += p ? p.color + p.type : '--';
  }
  return s;
}
function strToBoard(str) {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  const s = str || boardToStr(createInitialBoard());
  let i = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const chunk = s.substr(i, 2); i += 2;
    if (chunk !== '--') b[r][c] = { color: chunk[0], type: chunk[1] };
  }
  return b;
}

let board = createInitialBoard();
let turn = 'r';
let selected = null;
let targets = [];

// ========== UTILS ==========
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function updateNavRoom(roomCode) {
  if (!roomCode) return;
  if (window.TopNav && window.TopNav.setRoomId) window.TopNav.setRoomId(roomCode, '♟️');
}
// Xoay bàn cờ theo màu quân của người chơi đang xem (mỗi người thấy quân mình ở dưới)
function displayToBoard(r, c, myColor) {
  return myColor === 'b' ? [9 - r, 8 - c] : [r, c];
}
function flashInvalidSquare(r, c) {
  const cellEl = document.querySelector(`#board .xq-point[data-r="${r}"][data-c="${c}"]`);
  if (!cellEl) return;
  cellEl.classList.remove('invalid');
  void cellEl.offsetWidth;
  cellEl.classList.add('invalid');
  setTimeout(() => cellEl.classList.remove('invalid'), 400);
}

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
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

/* ========== FIREBASE LISTENER ========== */
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
    if (r.gameType !== 'xiangqi' || !r.gameState) return;
    render(r);
  });
}

/* ========== RENDER BÀN CỜ ========== */
function renderBoard(gs, myColor) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  const riverEl = document.createElement('div');
  riverEl.className = 'xq-river';
  riverEl.innerHTML = '<span>楚 河</span><span>漢 界</span>';
  boardEl.appendChild(riverEl);

  const inCheckNow = gs.phase === 'playing' && isInCheck(board, turn);
  const checkedGeneralSq = inCheckNow ? findGeneral(board, turn) : null;

  for (let dr = 0; dr < 10; dr++) {
    for (let dc = 0; dc < 9; dc++) {
      const [r, c] = displayToBoard(dr, dc, myColor);
      const cell = document.createElement('div');
      cell.className = 'xq-point';
      cell.dataset.r = r;
      cell.dataset.c = c;
      // Toạ độ vật lý trên màn hình (không đổi theo hướng nhìn) — dùng để neo các hoạ tiết cố định như dấu X cung tướng
      cell.dataset.dr = dr;
      cell.dataset.dc = dc;

      if (selected && selected[0] === r && selected[1] === c) cell.classList.add('selected');
      if (gs.lastMove && ((gs.lastMove.from[0] === r && gs.lastMove.from[1] === c) || (gs.lastMove.to[0] === r && gs.lastMove.to[1] === c))) cell.classList.add('last-move');
      if (targets.some(t => t[0] === r && t[1] === c)) {
        cell.classList.add('move');
        if (board[r][c]) cell.classList.add('capture');
      }
      if (checkedGeneralSq && checkedGeneralSq[0] === r && checkedGeneralSq[1] === c) cell.classList.add('king-check');

      const p = board[r][c];
      if (p) {
        const span = document.createElement('span');
        span.className = `xq-piece piece-${p.color}`;
        span.textContent = PIECE_LABEL[p.color][p.type];
        cell.appendChild(span);
      }

      cell.addEventListener('click', onPointClick);
      boardEl.appendChild(cell);
    }
  }
}

function onPointClick(e) {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing') return;
  const myColor = gs.colors?.[_user.uid];
  if (!myColor) return;
  if (turn !== myColor) return;

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const piece = board[r][c];

  if (selected) {
    if (selected[0] === r && selected[1] === c) {
      selected = null; targets = []; renderBoard(gs, myColor); return;
    }
    const isLegal = targets.some(t => t[0] === r && t[1] === c);
    if (isLegal) {
      const move = { from: selected, to: [r, c] };
      selected = null; targets = [];
      pushMove(move);
      return;
    }
    if (piece && piece.color === turn) {
      selected = [r, c];
      targets = generateLegalMoves(board, turn).filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
      renderBoard(gs, myColor);
      return;
    }
    flashInvalidSquare(r, c);
    return;
  }

  if (piece && piece.color === turn) {
    selected = [r, c];
    targets = generateLegalMoves(board, turn).filter(m => m.from[0] === r && m.from[1] === c).map(m => m.to);
  }
  renderBoard(gs, myColor);
}

async function pushMove(move) {
  if (_actionLock) return;
  _actionLock = true;
  try {
    const nb = simulateMove(board, move);
    const nextTurn = opposite(turn);
    const updates = {
      'gameState.boardStr': boardToStr(nb),
      'gameState.lastMove': { from: move.from, to: move.to },
      'gameState.turn': nextTurn,
      'gameState.moveCount': (_gs?.moveCount || 0) + 1
    };
    if (isGameOver(nb, nextTurn)) {
      updates['gameState.phase'] = 'result';
      updates['gameState.result'] = 'checkmate';
      updates['gameState.winnerUid'] = _user.uid;
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  } finally {
    _actionLock = false;
  }
}

/* ========== RENDER TOÀN TRANG ========== */
function render(r) {
  const gs = r.gameState || {};
  _gs = gs;

  const uid = _user.uid;
  const members = r.members || [];
  const oppUid = members.find(u => u !== uid);
  const isHost = r.hostUid === uid;

  const scoreEl = document.getElementById('xq-score');
  const scoreSubEl = document.getElementById('xq-score-sub');
  const profitEl = document.getElementById('xq-profit');
  const oppNameEl = document.getElementById('xq-opp-name');
  const sidePlayerEl = document.getElementById('side-player');
  const sideMachineEl = document.getElementById('side-machine');
  const statusEl = document.getElementById('status');
  const actEl = document.getElementById('xq-actions');
  const bcStatusEl = document.getElementById('bc-status');

  sideMachineEl.style.display = '';
  oppNameEl.textContent = esc(r.memberInfo?.[oppUid]?.name || 'Đối thủ');
  bcStatusEl.className = 'bc-status';
  sidePlayerEl.classList.remove('active-turn');
  sideMachineEl.classList.remove('active-turn');
  profitEl.textContent = '';
  profitEl.className = 'stat-profit zero';

  if (members.length < 2) {
    document.getElementById('board').innerHTML = '';
    statusEl.textContent = 'Đối thủ đã rời phòng.';
    actEl.innerHTML = '';
    document.getElementById('xq-bet-zone').innerHTML = '';
    hideDrawModal();
    return;
  }

  const myColor = gs.colors?.[uid] || 'r';

  if (gs.phase === 'betting' || !gs.phase) {
    board = createInitialBoard();
    turn = 'r';
    selected = null; targets = [];
    renderBoard(gs, myColor);

    scoreEl.textContent = '--'; scoreSubEl.textContent = 'Đặt cược';
    statusEl.textContent = 'Chủ phòng chọn mức cược, đối thủ xác nhận để bắt đầu ván đấu.';
    actEl.innerHTML = '';
    hideDrawModal();

    renderBetZone(r, gs, isHost, uid, oppUid);

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
  document.getElementById('xq-bet-zone').innerHTML = '';
  board = strToBoard(gs.boardStr);
  turn = gs.turn || 'r';

  const myBet = gs.bets?.[uid] || 0;
  const oppBet = gs.bets?.[oppUid] || 0;

  renderBoard(gs, myColor);

  if (gs.phase === 'playing') {
    const turnLabel = turn === 'r' ? 'Đỏ' : 'Đen';
    const myTurn = turn === myColor;
    const inCheckNow = isInCheck(board, turn);
    scoreEl.textContent = inCheckNow ? 'CHIẾU TƯỚNG' : '';
    scoreSubEl.textContent = inCheckNow ? '' : 'Lượt đi';
    statusEl.textContent = inCheckNow ? `Đang bị chiếu: ${turnLabel}.` : `Lượt đi: ${turnLabel}`;
    bcStatusEl.classList.toggle('in-check', inCheckNow);
    bcStatusEl.classList.add('in-progress');
    (myTurn ? sidePlayerEl : sideMachineEl).classList.add('active-turn');

    const drawPendingMine = gs.drawOffer?.uid === uid;
    const canOfferDraw = !gs.drawOffer;
    actEl.innerHTML = `
      <button class="xq-act-btn xq-act-red" onclick="resignGame()">🏳️ Đầu hàng</button>
      <button class="xq-act-btn xq-act-blue" ${canOfferDraw ? '' : 'disabled'} onclick="offerDraw()">${drawPendingMine ? 'Đã đề nghị...' : '🤝 Đề nghị hòa'}</button>
    `;

    if (gs.drawOffer && gs.drawOffer.uid !== uid) showDrawModal(r, gs.drawOffer);
    else hideDrawModal();

  } else if (gs.phase === 'result') {
    bcStatusEl.classList.remove('in-progress');
    hideDrawModal();

    let outcome;
    if (gs.result === 'draw') outcome = 'draw';
    else outcome = gs.winnerUid === uid ? 'win' : 'lose';

    scoreEl.textContent = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'HÒA';
    scoreSubEl.textContent = '';
    bcStatusEl.classList.add(outcome === 'win' ? 'result-win' : outcome === 'lose' ? 'result-lose' : 'result-draw');
    sideMachineEl.style.display = 'none';

    let net = 0;
    if (outcome === 'win') net = oppBet;
    else if (outcome === 'lose') net = -myBet;
    profitEl.textContent = net === 0 ? '' : (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
    profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');

    let reasonText = '';
    if (gs.result === 'checkmate') reasonText = 'Hết nước đi (chiếu bí).';
    else if (gs.result === 'resign') reasonText = (gs.winnerUid === uid ? 'Đối thủ đã đầu hàng.' : 'Bạn đã đầu hàng.');
    else if (gs.result === 'draw') reasonText = 'Hòa cờ.';
    statusEl.textContent = `${reasonText} ${outcome === 'win' ? 'Bạn thắng!' : outcome === 'lose' ? 'Bạn thua.' : ''}`.trim();

    actEl.innerHTML = isHost
      ? `<button class="xq-act-btn xq-act-yellow" onclick="hostNextRound()">⟳ Ván mới</button>`
      : `<span class="xq-wait-host">Chờ chủ phòng bắt đầu ván mới...</span>`;

    if (gs.round !== _settledRound) {
      _settledRound = gs.round;
      settleMyResult(r, gs);
    }
  }
}

/* ========== VÙNG ĐẶT CƯỢC ========== */
function renderBetZone(r, gs, isHost, uid, oppUid) {
  const zone = document.getElementById('xq-bet-zone');
  const betAmount = gs.betAmount || null;
  const meConfirmed = !!gs.bets?.[uid];

  if (isHost) {
    if (!betAmount) {
      zone.innerHTML = `
        <div class="xq-bet-picker">
          <div class="xq-bet-picker-label">Chọn mức cược cho ván này</div>
          <div class="xq-bet-picker-row">
            <input id="xq-bet-input" type="number" min="50" step="50" value="100"/>
          </div>
          <div class="xq-bet-quick">
            <button type="button" onclick="xqQuickBet(100)">100</button>
            <button type="button" onclick="xqQuickBet(200)">200</button>
            <button type="button" onclick="xqQuickBet(500)">500</button>
            <button type="button" onclick="xqQuickBet(1000)">1000</button>
          </div>
          <button class="xq-bet-confirm-btn" onclick="hostSetBet()">✅ Đặt mức cược</button>
        </div>`;
    } else {
      zone.innerHTML = `<div class="xq-bet-waiting">⏳ Đã đặt mức cược <b>${betAmount.toLocaleString('vi-VN')}đ</b> — đang chờ đối thủ xác nhận...</div>`;
    }
    return;
  }

  if (!betAmount) {
    zone.innerHTML = `<div class="xq-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>`;
  } else if (!meConfirmed) {
    zone.innerHTML = `
      <div class="xq-bet-confirm-card">
        <div class="xq-bet-confirm-title">Chủ phòng muốn đặt cược</div>
        <div class="xq-bet-confirm-amt">${betAmount.toLocaleString('vi-VN')}đ</div>
        <div class="xq-bet-confirm-actions">
          <button class="decline" onclick="declineBet()">Từ chối</button>
          <button class="accept" onclick="acceptBet()">Đồng ý</button>
        </div>
      </div>`;
  } else {
    zone.innerHTML = `<div class="xq-bet-waiting">✅ Đã xác nhận cược ${betAmount.toLocaleString('vi-VN')}đ — đang bắt đầu ván đấu...</div>`;
  }
}

window.xqQuickBet = function(amt) {
  const el = document.getElementById('xq-bet-input');
  if (el) el.value = amt;
};

window.hostSetBet = async function() {
  const el = document.getElementById('xq-bet-input');
  const amt = parseInt(el?.value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm', 'error'); return; }
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: increment(-amt) });
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': amt,
      [`gameState.bets.${_user.uid}`]: amt
    });
    showToast('✅ Đã đặt mức cược ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.acceptBet = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  const amt = gs.betAmount;
  if (!amt || gs.bets?.[_user.uid]) return;
  if (amt > _myBalance) { showToast('Không đủ điểm để đồng ý mức cược này', 'error'); return; }
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: increment(-amt) });
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    showToast('✅ Đã xác nhận cược', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.declineBet = async function() {
  try { await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.betDeclinedBy': _user.uid }); }
  catch (e) { console.error(e); }
};

async function refundDeclinedBet(gs) {
  const amt = gs.betAmount || 0;
  try {
    if (amt > 0) {
      await updateDoc(doc(db, 'users', _user.uid), { points: increment(amt) });
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
  let modal = document.getElementById('xq-draw-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'xq-draw-modal';
    modal.className = 'xq-modal-overlay';
    document.body.appendChild(modal);
  }
  const name = esc(offer.name || r.memberInfo?.[offer.uid]?.name || 'Đối thủ');
  modal.innerHTML = `
    <div class="xq-modal-box">
      <div class="xq-modal-title">${name} đề nghị hòa</div>
      <div class="xq-modal-actions">
        <button class="xq-modal-btn decline" onclick="declineDraw()">Từ chối</button>
        <button class="xq-modal-btn accept" onclick="acceptDraw()">Đồng ý</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}
function hideDrawModal() {
  _drawModalShownFor = null;
  const modal = document.getElementById('xq-draw-modal');
  if (modal) modal.style.display = 'none';
}

/* ========== HÀNH ĐỘNG ========== */
async function hostStartMatch() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  if (gs.phase !== 'betting') return;
  const members = r.members || [];
  if (members.length < 2) return;
  const p1 = members[0], p2 = members[1];
  if (!((gs.bets?.[p1] || 0) > 0 && (gs.bets?.[p2] || 0) > 0)) return;

  const flip = Math.random() < 0.5;
  const redUid = flip ? p2 : p1;
  const blackUid = flip ? p1 : p2;

  if (window.VTQuests) window.VTQuests.trackPlay('xiangqi');
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.colors': { [redUid]: 'r', [blackUid]: 'b' },
    'gameState.boardStr': boardToStr(createInitialBoard()),
    'gameState.turn': 'r',
    'gameState.lastMove': null,
    'gameState.moveCount': 0,
    'gameState.players': [redUid, blackUid],
    'gameState.result': null,
    'gameState.winnerUid': null,
    'gameState.drawOffer': null
  });
}

function showResignConfirm() {
  let modal = document.getElementById('xq-resign-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'xq-resign-modal';
    modal.className = 'xq-modal-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="xq-modal-box">
      <div class="xq-modal-title">Bạn chắc chắn muốn đầu hàng ván này?</div>
      <div class="xq-modal-actions">
        <button class="xq-modal-btn decline" onclick="hideResignConfirm()">Hủy</button>
        <button class="xq-modal-btn danger" onclick="confirmResign()">🏳️ Đầu hàng</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}
window.hideResignConfirm = function() {
  const modal = document.getElementById('xq-resign-modal');
  if (modal) modal.style.display = 'none';
};
window.confirmResign = async function() {
  window.hideResignConfirm();
  try {
    await _executeResign();
  } catch (e) {
    console.error(e);
    showToast('Lỗi khi đầu hàng, thử lại', 'error');
  }
};
window.resignGame = function() {
  showResignConfirm();
};
async function _executeResign() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  const oppUid = (r.members || []).find(u => u !== _user.uid);
  if (!oppUid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.result': 'resign',
    'gameState.winnerUid': oppUid
  });
}

window.offerDraw = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (gs.phase !== 'playing' || gs.drawOffer) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.drawOffer': { uid: _user.uid, name: r.memberInfo?.[_user.uid]?.name || 'Người chơi' }
  });
  showToast('✅ Đã gửi đề nghị hòa', 'success');
};

window.acceptDraw = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  const offer = gs.drawOffer;
  if (!offer || offer.uid === _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.result': 'draw',
    'gameState.drawOffer': null
  });
};

window.declineDraw = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  const offer = gs.drawOffer;
  if (!offer || offer.uid === _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.drawOffer': null });
};

window.hostNextRound = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.bets': {},
    'gameState.betAmount': null,
    'gameState.betDeclinedBy': null,
    'gameState.colors': {},
    'gameState.boardStr': null,
    'gameState.turn': 'r',
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
    await updateDoc(doc(db, 'users', uid), { points: increment(totalRefund) });

    if (buffBonus > 0) {
      const pet = _myActivePet ? getPetById(_myActivePet) : null;
      const tier = pet ? getTierById(pet.tier) : null;
      const petLabel = pet ? `${pet.emoji} ${pet.name}` : '🐾 Pet';
      showToast(`🎉 Thắng +${winAmount.toLocaleString('vi-VN')}đ  ${petLabel} +${buffBonus.toLocaleString('vi-VN')}đ (${buffPct}%)!`, 'success');
    } else {
      showToast(`🎉 Thắng +${winAmount.toLocaleString('vi-VN')}đ!`, 'success');
    }
    if (window.VTQuests) { window.VTQuests.trackEarn(winAmount + buffBonus); window.VTQuests.trackWinSmart(); }

  } else if (outcome === 'draw') {
    await updateDoc(doc(db, 'users', uid), { points: increment(myBet) });
    showToast('🤝 Hoà, hoàn lại cược', 'info');

  } else {
    showToast(`💸 Thua ${myBet.toLocaleString('vi-VN')}đ`, 'warn');
  }
}

/* ========== THOÁT PHÒNG ========== */
window.quitGame = async function() {
  try {
    const r = _room;
    if (r) {
      const gs = r.gameState || {};
      if (gs.phase === 'betting') {
        const myBet = gs.bets?.[_user.uid] || 0;
        if (myBet > 0) {
          await updateDoc(doc(db, 'users', _user.uid), { points: increment(myBet) });
        }
      }

      // Thoát ngang giữa ván đang chơi (chưa có kết quả) → xử thua, đối thủ được xử thắng
      // (dùng đúng field như _executeResign() có sẵn)
      let forfeited = false;
      if (gs.phase === 'playing' && !gs.result && !gs.winnerUid) {
        const oppUid = (r.members || []).find(u => u !== _user.uid);
        if (oppUid) {
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            'gameState.phase': 'result',
            'gameState.result': 'resign',
            'gameState.winnerUid': oppUid
          });
          forfeited = true;
        }
      }

      if (r.hostUid === _user.uid && !forfeited) {
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
  } catch (e) {}
  location.href = 'rooms.html';
};
