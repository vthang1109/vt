// catte-mp.js — Cát Tê Multiplayer (PvP qua phòng)
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, updateDoc, onSnapshot, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from '../../cards.js';
import { subscribeUserData, addPoints } from '../../points.js';

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
let _actionLock = false;
let _room = null, _gs = null;
let _selectedIdx = -1;
let _lastDeclineHandled = null;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ===== CONSTANTS =====
const suitRank = { '♠':1, '♣':2, '♦':3, '♥':4 };
const valRank = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

// ===== UTILS =====
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sortHand(hand) {
  hand.sort((a, b) => {
    const s = (suitRank[b.s] || 0) - (suitRank[a.s] || 0);
    return s !== 0 ? s : (valRank[b.v] || 0) - (valRank[a.v] || 0);
  });
  return hand;
}

function canBeat(playCard, lastCard) {
  if (!lastCard) return true;
  if (playCard.s !== lastCard.s) return false;
  return (valRank[playCard.v] || 0) > (valRank[lastCard.v] || 0);
}

// ===== AUTH =====
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.leaveMpRoom());
  _unsubMe = subscribeUserData((data) => {
    if (data) {
      _myBalance = data.points || 0;
      if (window.TopNav) window.TopNav.setPoints(_myBalance);
    }
  });
  if (ROOM_ID) start();
});

// ===== ROOM LISTENER =====
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
    if (!r.gameState) return;
    render(r);
  });
}

function updateNavRoom(roomCode) {
  if (!roomCode) return;
  if (window.TopNav && window.TopNav.setRoomId) window.TopNav.setRoomId(roomCode, '♣️');
}

// ===== RENDER =====
function render(r) {
  const gs = r.gameState || {};
  _gs = gs;

  const uid = _user.uid;
  const members = r.members || [];
  const oppUid = members.find(u => u !== uid);
  const isHost = r.hostUid === uid;
  const isMeP1 = members[0] === uid;
  const myPlayerId = isMeP1 ? 'p1' : 'p2';

  const statusEl = document.getElementById('mp-status');
  const p1Name = document.querySelector('#mp-p1 .name');
  const p2Name = document.querySelector('#mp-p2 .name');
  const p1Ready = document.getElementById('mp-p1-ready');
  const p2Ready = document.getElementById('mp-p2-ready');
  const p1Cards = document.getElementById('mp-cards-p1');
  const p2Cards = document.getElementById('mp-cards-p2');
  const p1El = document.getElementById('mp-p1');
  const p2El = document.getElementById('mp-p2');
  const btnReady = document.getElementById('btn-ready-mp');
  const btnStart = document.getElementById('btn-start-mp');
  const actEl = document.getElementById('mp-actions');
  const waitingOverlay = document.getElementById('mp-waiting-overlay');

  // Room info
  document.getElementById('mp-room-name').textContent = r.name || 'Phòng Cát Tê';
  document.getElementById('mp-room-code').textContent = '#' + (r.code || '------');

  // Player names
  const mi = r.memberInfo || {};
  if (members[0]) {
    const info = mi[members[0]] || { name: '?', ready: false };
    p1Name.textContent = members[0] === uid ? (info.name || 'Bạn') + ' (bạn)' : (info.name || '?');
    p1Ready.textContent = info.ready ? '✅' : '⏳';
    p1Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p1Name.textContent = 'Đang chờ...';
    p1Ready.textContent = '⏳';
    p1Ready.className = 'wait-badge';
  }
  if (members[1]) {
    const info = mi[members[1]] || { name: '?', ready: false };
    p2Name.textContent = members[1] === uid ? (info.name || 'Bạn') + ' (bạn)' : (info.name || '?');
    p2Ready.textContent = info.ready ? '✅' : '⏳';
    p2Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p2Name.textContent = 'Đang chờ...';
    p2Ready.textContent = '⏳';
    p2Ready.className = 'wait-badge';
  }

  // Cards left
  if (gs.hands) {
    const p1CardCount = (gs.hands.p1 || []).length;
    const p2CardCount = (gs.hands.p2 || []).length;
    p1Cards.textContent = `(${p1CardCount} lá)`;
    p2Cards.textContent = `(${p2CardCount} lá)`;
  }

  // Active turn
  const turnP = gs.turn; // 'p1' or 'p2'
  p1El.classList.toggle('active', turnP === 'p1');
  p2El.classList.toggle('active', turnP === 'p2');

  // If no gameState yet, just show lobby
  if (r.status === 'lobby' || !gs.phase) {
    document.getElementById('ctmp-status').style.display = 'none';
    document.getElementById('ctmp-table').style.display = 'none';
    document.getElementById('ctmp-hand').style.display = 'none';
    document.getElementById('ctmp-game-actions').style.display = 'none';
    document.getElementById('ctmp-bet-zone').style.display = '';

    if (isHost) {
      btnReady.style.display = 'none';
      btnStart.style.display = 'inline-block';
      const allReady = members.filter(u => u !== r.hostUid).every(u => mi[u]?.ready);
      const enough = members.length >= 2;
      btnStart.disabled = !(allReady && enough);
      btnStart.textContent = enough ? (allReady ? '🚀 Bắt đầu' : '⏳ Chờ sẵn sàng') : '⏳ Cần 2 người';
    } else {
      btnStart.style.display = 'none';
      btnReady.style.display = 'inline-block';
      const myInfo = mi[uid] || { ready: false };
      btnReady.textContent = myInfo.ready ? '↩ Huỷ sẵn sàng' : '✅ Sẵn sàng';
      btnReady.classList.toggle('on', !!myInfo.ready);
    }
    actEl.style.display = '';

    statusEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <span>🔄 Trong phòng chờ · ${members.length}/${r.maxPlayers || 2} người</span>
        <span style="color:#fbbf24;font-weight:700;">🪙 ${gs.betAmount ? gs.betAmount.toLocaleString('vi-VN') : '?'}</span>
      </div>
    `;
    statusEl.style.color = '#94a3b8';

    if (members.length < 2) waitingOverlay.classList.remove('hidden');
    else waitingOverlay.classList.add('hidden');

    renderBetZone(r, gs, isHost, uid, oppUid);

    // Auto-start check
    const allBet = gs.betAmount && members[0] && members[1] && (gs.bets?.[members[0]] || 0) > 0 && (gs.bets?.[members[1]] || 0) > 0;
    if (isHost && allBet && gs.round !== _autoStartRoundFlag) {
      _autoStartRoundFlag = gs.round;
      setTimeout(() => { hostStartMatch(); }, 400);
    }

    // Decline refund
    if (isHost && gs.betDeclinedBy) {
      const key = `${gs.round}:${gs.betDeclinedBy}`;
      if (_lastDeclineHandled !== key) {
        _lastDeclineHandled = key;
        refundDeclinedBet(gs);
      }
    }
    return;
  }

  // Playing or result
  actEl.style.display = 'none';
  waitingOverlay.classList.add('hidden');
  document.getElementById('ctmp-bet-zone').style.display = 'none';
  document.getElementById('ctmp-status').style.display = 'flex';
  document.getElementById('ctmp-table').style.display = 'flex';

  // Game state
  const hands = gs.hands || {};
  const played = gs.played || {};
  const myHand = hands[myPlayerId] || [];
  const oppPlayerId = myPlayerId === 'p1' ? 'p2' : 'p1';
  const oppHand = hands[oppPlayerId] || [];

  // Last card
  const lastCard = gs.lastCard || null;
  const lastPlayedBy = gs.lastPlayedBy || null;

  // Render table
  renderTable(played, lastCard, lastPlayedBy, myPlayerId, oppPlayerId);

  // Render my hand
  if (gs.phase === 'playing') {
    document.getElementById('ctmp-hand').style.display = '';
    renderHand(myHand, turnP === myPlayerId);
    document.getElementById('ctmp-game-actions').style.display = turnP === myPlayerId ? 'flex' : 'none';
  } else {
    document.getElementById('ctmp-hand').style.display = 'none';
    document.getElementById('ctmp-game-actions').style.display = 'none';
  }

  // Counts
  document.getElementById('ctmp-my-count').textContent = `${myHand.length} lá`;
  document.getElementById('ctmp-opp-count').textContent = `${oppHand.length} lá`;

  // Status bar
  const betStat = document.getElementById('ctmp-bet-stat');
  const roundEl = document.getElementById('ctmp-round');
  const subEl = document.getElementById('ctmp-sub');
  const profitEl = document.getElementById('ctmp-profit');

  const myBet = gs.bets?.[uid] || 0;
  betStat.textContent = myBet.toLocaleString('vi-VN');

  if (gs.phase === 'playing') {
    const turnLabel = turnP === myPlayerId ? 'Lượt của bạn' : 'Lượt đối thủ';
    roundEl.textContent = `Lượt ${gs.round || 1}`;
    subEl.textContent = turnLabel;
    profitEl.textContent = '';
    profitEl.className = 'stat-profit zero';
    document.getElementById('ctmp-status').className = 'bc-status';

    document.getElementById('ctmp-info').textContent = gs.lastActionMessage || '';
  } else if (gs.phase === 'result') {
    const outcome = gs.result === 'draw' ? 'draw' : (gs.winnerPlayerId === myPlayerId ? 'win' : 'lose');

    roundEl.textContent = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'HÒA';
    subEl.textContent = '';
    document.getElementById('ctmp-status').className = 'bc-status ' + (outcome === 'win' ? 'result-win' : outcome === 'lose' ? 'result-lose' : 'result-draw');

    let net = 0;
    if (outcome === 'win') net = gs.bets?.[oppUid] || 0;
    else if (outcome === 'lose') net = -(myBet || 0);
    profitEl.textContent = net === 0 ? '' : (net > 0 ? '+' : '') + net.toLocaleString('vi-VN');
    profitEl.className = 'stat-profit ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero');

    document.getElementById('ctmp-info').textContent = gs.lastActionMessage || '';

    // Show result modal
    const members = r.members || [];
    const oppUid = members.find(u => u !== uid);
    const myBet = gs.bets?.[uid] || 0;
    const oppBet = gs.bets?.[oppUid] || 0;
    const outcome = gs.result === 'draw' ? 'draw' : (gs.winnerPlayerId === (members[0] === uid ? 'p1' : 'p2') ? 'win' : 'lose');

    if (outcome === 'win') {
      showResult('🏆', '🎉 Bạn thắng!', `+${oppBet.toLocaleString('vi-VN')}đ`, 'Thắng cược Cát Tê');
    } else if (outcome === 'draw') {
      showResult('🤝', 'Hòa!', `+${myBet.toLocaleString('vi-VN')}đ (hoàn cược)`, 'Không ai thắng');
    } else {
      showResult('😔', 'Bạn thua!', `-${myBet.toLocaleString('vi-VN')}đ`, 'Lần sau cố gắng nhé!');
    }

    // Action buttons
    document.getElementById('ctmp-game-actions').style.display = 'none';
    const hostAction = document.getElementById('host-action-area');
    if (isHost) {
      if (!hostAction) {
        const div = document.createElement('div');
        div.id = 'host-action-area';
        div.style.cssText = 'text-align:center;margin-top:10px';
        div.innerHTML = '<button class="btn-start-mp" onclick="hostNextRound()">⟳ Ván mới</button>';
        document.getElementById('ctmp-hand').parentNode.insertBefore(div, document.getElementById('ctmp-hand'));
      }
    } else {
      const ha = document.getElementById('host-action-area');
      if (ha) {
        ha.innerHTML = '<span style="color:#94a3b8;font-size:13px">⏳ Chờ chủ phòng bắt đầu ván mới...</span>';
      } else {
        const div = document.createElement('div');
        div.id = 'host-action-area';
        div.style.cssText = 'text-align:center;margin-top:10px;color:#94a3b8;font-size:13px';
        div.textContent = '⏳ Chờ chủ phòng bắt đầu ván mới...';
        document.getElementById('ctmp-hand').parentNode.insertBefore(div, document.getElementById('ctmp-hand'));
      }
    }

    if (gs.round !== _settledRound) {
      _settledRound = gs.round;
      settleMyResult(r, gs);
    }
  }
}

// ===== RENDER TABLE =====
function renderTable(played, lastCard, lastPlayedBy, myPid, oppPid) {
  const myPlayed = played[myPid] || [];
  const oppPlayed = played[oppPid] || [];

  document.getElementById('ctmp-opp-cards').innerHTML = oppPlayed.length
    ? oppPlayed.map(c => renderCardUI(c)).join('')
    : '<span style="color:#64748b;font-size:12px">Chưa đánh</span>';

  document.getElementById('ctmp-my-cards').innerHTML = myPlayed.length
    ? myPlayed.map(c => renderCardUI(c)).join('')
    : '<span style="color:#64748b;font-size:12px">Chưa đánh</span>';
}

// ===== RENDER HAND =====
function renderHand(hand, isMyTurn) {
  if (!hand || hand.length === 0) {
    document.getElementById('ctmp-hand').innerHTML = '<div style="color:#64748b;text-align:center;padding:10px">Hết bài!</div>';
    return;
  }
  document.getElementById('ctmp-hand').innerHTML = hand.map((c, i) => {
    const sel = i === _selectedIdx ? 'selected' : '';
    const dis = isMyTurn ? '' : 'disabled';
    return `<div class="ctmp-hand-card ${sel} ${dis}" data-idx="${i}" onclick="${isMyTurn ? `selectCard(${i})` : ''}">${renderCardUI(c)}</div>`;
  }).join('');
}

// ===== SELECT CARD =====
window.selectCard = function(idx) {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  const members = _room.members || [];
  const isMeP1 = members[0] === uid;
  const myPlayerId = isMeP1 ? 'p1' : 'p2';
  if (gs.turn !== myPlayerId) return;

  _selectedIdx = _selectedIdx === idx ? -1 : idx;
  const hands = gs.hands || {};
  const myHand = hands[myPlayerId] || [];
  renderHand(myHand, true);
};

// ===== PLAY CARD =====
window.playSelectedCard = async function() {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  const members = _room.members || [];
  const isMeP1 = members[0] === uid;
  const myPlayerId = isMeP1 ? 'p1' : 'p2';
  if (gs.turn !== myPlayerId) return;
  if (_selectedIdx < 0) {
    window.showToast('Chọn 1 lá bài trước!', 'warn');
    return;
  }

  const hands = JSON.parse(JSON.stringify(gs.hands || {}));
  const myHand = hands[myPlayerId] || [];
  if (_selectedIdx >= myHand.length) return;

  const card = myHand[_selectedIdx];
  const lastCard = gs.lastCard || null;
  const lastPlayedBy = gs.lastPlayedBy || null;

  // Cần đánh bài cùng chất lớn hơn nếu đối thủ vừa đánh
  if (lastPlayedBy && lastPlayedBy !== myPlayerId && lastCard) {
    if (!canBeat(card, lastCard)) {
      window.showToast('Không thể đánh lá này! Cần cùng chất và lớn hơn', 'warn');
      return;
    }
  }

  _actionLock = true;

  try {
    myHand.splice(_selectedIdx, 1);
    hands[myPlayerId] = myHand;

    const played = JSON.parse(JSON.stringify(gs.played || {}));
    if (!played[myPlayerId]) played[myPlayerId] = [];
    played[myPlayerId].push(card);

    const nextTurn = myPlayerId === 'p1' ? 'p2' : 'p1';
    const oppPlayerId = nextTurn;
    const oppHand = hands[oppPlayerId] || [];
    const newRound = (gs.round || 1) + 1;

    // Check if opponent can beat
    const oppLastCard = card;
    let canOppBeat = false;
    for (const c of oppHand) {
      if (canBeat(c, oppLastCard)) { canOppBeat = true; break; }
    }

    let winnerPlayerId = null;
    let result = null;
    let msg = `Bạn đã đánh ${cardDisplay(card)}`;

    if (myHand.length === 0) {
      // Win by playing all cards
      winnerPlayerId = myPlayerId;
      result = 'play_all';
      msg = 'Bạn đã hết bài!';
    } else if (oppHand.length === 0) {
      winnerPlayerId = oppPlayerId;
      result = 'play_all';
      msg = 'Đối thủ đã hết bài!';
    } else if (!canOppBeat) {
      // Opponent can't beat - current player wins
      winnerPlayerId = myPlayerId;
      result = 'opponent_cant_beat';
      msg = 'Đối thủ không thể đỡ! Bạn thắng!';
    }

    const updates = {
      'gameState.hands': hands,
      'gameState.played': played,
      'gameState.lastCard': card,
      'gameState.lastPlayedBy': myPlayerId,
      'gameState.turn': nextTurn,
      'gameState.round': newRound,
      'gameState.lastActionMessage': msg
    };

    if (winnerPlayerId) {
      updates['gameState.phase'] = 'result';
      updates['gameState.result'] = result;
      updates['gameState.winnerPlayerId'] = winnerPlayerId;
    }

    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);

    _selectedIdx = -1;

  } catch (err) {
    console.error('playSelectedCard error:', err);
    window.showToast('❌ Lỗi khi đánh bài', 'error');
  } finally {
    _actionLock = false;
  }
};

// ===== FOLD =====
window.foldGame = async function() {
  if (_actionLock) return;
  const gs = _gs;
  if (!gs || gs.phase !== 'playing') return;
  const uid = _user.uid;
  const members = _room.members || [];
  const isMeP1 = members[0] === uid;
  const myPlayerId = isMeP1 ? 'p1' : 'p2';
  if (gs.turn !== myPlayerId) return;

  _actionLock = true;
  try {
    const oppPlayerId = myPlayerId === 'p1' ? 'p2' : 'p1';
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'result',
      'gameState.result': 'fold',
      'gameState.winnerPlayerId': oppPlayerId,
      'gameState.lastActionMessage': 'Bạn đã bỏ bài!'
    });
  } catch (err) {
    console.error('foldGame error:', err);
  } finally {
    _actionLock = false;
  }
};

function cardDisplay(c) {
  return `${c.v}${c.s}`;
}

// ===== BET ZONE =====
function renderBetZone(r, gs, isHost, uid, oppUid) {
  const zone = document.getElementById('ctmp-bet-zone');
  const betAmount = gs.betAmount || null;
  const oppConfirmed = oppUid && !!gs.bets?.[oppUid];
  const meConfirmed = !!gs.bets?.[uid];

  if (isHost) {
    if (!betAmount) {
      zone.innerHTML = `
        <div class="ctmp-bet-picker">
          <div class="ctmp-bet-picker-label">Chọn mức cược cho ván này</div>
          <div class="ctmp-bet-picker-row">
            <input id="ctmp-bet-input" type="number" min="50" step="50" value="100"/>
          </div>
          <div class="ctmp-bet-quick">
            <button type="button" onclick="quickBet(100)">100</button>
            <button type="button" onclick="quickBet(200)">200</button>
            <button type="button" onclick="quickBet(500)">500</button>
            <button type="button" onclick="quickBet(1000)">1000</button>
          </div>
          <button class="ctmp-bet-confirm-btn" onclick="hostSetBet()">✅ Đặt mức cược</button>
        </div>`;
    } else {
      zone.innerHTML = `<div class="ctmp-bet-waiting">⏳ Đã đặt mức cược <b>${betAmount.toLocaleString('vi-VN')}đ</b> — đang chờ đối thủ xác nhận...</div>`;
    }
    return;
  }

  if (!betAmount) {
    zone.innerHTML = `<div class="ctmp-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>`;
  } else if (!meConfirmed) {
    zone.innerHTML = `
      <div class="ctmp-bet-confirm-card">
        <div class="ctmp-bet-confirm-title">Chủ phòng muốn đặt cược</div>
        <div class="ctmp-bet-confirm-amt">${betAmount.toLocaleString('vi-VN')}đ</div>
        <div class="ctmp-bet-confirm-actions">
          <button class="decline" onclick="declineBet()">Từ chối</button>
          <button class="accept" onclick="acceptBet()">Đồng ý</button>
        </div>
      </div>`;
  } else {
    zone.innerHTML = `<div class="ctmp-bet-waiting">✅ Đã xác nhận cược ${betAmount.toLocaleString('vi-VN')}đ — đang bắt đầu ván đấu...</div>`;
  }
}

window.quickBet = function(amt) {
  const el = document.getElementById('ctmp-bet-input');
  if (el) el.value = amt;
};

window.hostSetBet = async function() {
  const el = document.getElementById('ctmp-bet-input');
  const amt = parseInt(el?.value);
  if (!amt || amt < 50) { window.showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > _myBalance) { window.showToast('Không đủ điểm', 'error'); return; }
  try {
    await addPoints('Cát Tê', 'Đặt cược', -amt);
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': amt,
      [`gameState.bets.${_user.uid}`]: amt
    });
    window.showToast('✅ Đã đặt mức cược ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { console.error(e); window.showToast('Lỗi', 'error'); }
};

window.acceptBet = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  const amt = gs.betAmount;
  if (!amt || gs.bets?.[_user.uid]) return;
  if (amt > _myBalance) { window.showToast('Không đủ điểm để đồng ý mức cược này', 'error'); return; }
  try {
    await addPoints('Cát Tê', 'Đặt cược', -amt);
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    window.showToast('✅ Đã xác nhận cược', 'success');
  } catch (e) { console.error(e); window.showToast('Lỗi', 'error'); }
};

window.declineBet = async function() {
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.betDeclinedBy': _user.uid });
  } catch (e) { console.error(e); }
};

async function refundDeclinedBet(gs) {
  const amt = gs.betAmount || 0;
  try {
    if (amt > 0) {
      await addPoints('Cát Tê', 'Hoàn cược', amt);
      window.showToast(`↩️ Đối thủ từ chối mức cược, đã hoàn lại ${amt.toLocaleString('vi-VN')}đ`, 'info');
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.betAmount': null,
      'gameState.bets': {},
      'gameState.betDeclinedBy': null
    });
  } catch (e) { console.error(e); }
}

let _autoStartRoundFlag = -1;

// ===== START MATCH =====
window.startMpGame = async function() {
  if (!_room) return;
  if (_room.hostUid !== _user.uid) {
    window.showToast('Chỉ chủ phòng mới bắt đầu được', 'warn');
    return;
  }
  const members = _room.members || [];
  if (members.length < 2) {
    window.showToast('Cần ít nhất 2 người', 'warn');
    return;
  }
  // Kiểm tra xem đã có cược chưa
  const gs = _room.gameState || {};
  if (!gs.betAmount || !members.every(u => (gs.bets?.[u] || 0) > 0)) {
    window.showToast('Cả 2 người cần đặt cược trước!', 'warn');
    return;
  }
  hostStartMatch();
};

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

  // Create deck and deal
  const deck = createDeck();
  const hand1 = [], hand2 = [];
  for (let i = 0; i < 6; i++) {
    hand1.push(deck.pop());
    hand2.push(deck.pop());
  }
  sortHand(hand1);
  sortHand(hand2);

  if (window.VTQuests) window.VTQuests.trackPlay('catte');

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.hands': { p1: hand1, p2: hand2 },
    'gameState.played': { p1: [], p2: [] },
    'gameState.lastCard': null,
    'gameState.lastPlayedBy': null,
    'gameState.turn': 'p1',
    'gameState.round': 1,
    'gameState.lastActionMessage': 'Bắt đầu! P1 đánh trước',
    'gameState.result': null,
    'gameState.winnerPlayerId': null
  });
}

// ===== HOST NEXT ROUND =====
window.hostNextRound = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  _selectedIdx = -1;
  const ha = document.getElementById('host-action-area');
  if (ha) ha.remove();
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.bets': {},
    'gameState.betAmount': null,
    'gameState.betDeclinedBy': null,
    'gameState.hands': {},
    'gameState.played': {},
    'gameState.lastCard': null,
    'gameState.lastPlayedBy': null,
    'gameState.turn': 'p1',
    'gameState.round': 1,
    'gameState.lastActionMessage': null,
    'gameState.result': null,
    'gameState.winnerPlayerId': null,
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

// ===== SETTLE RESULT =====
async function settleMyResult(r, gs) {
  const uid = _user.uid;
  const members = r.members || [];
  const oppUid = members.find(u => u !== uid);
  const myBet = gs.bets?.[uid] || 0;
  const oppBet = gs.bets?.[oppUid] || 0;
  const outcome = gs.result === 'draw' ? 'draw' : (gs.winnerPlayerId === (members[0] === uid ? 'p1' : 'p2') ? 'win' : 'lose');

  try {
    if (outcome === 'win') {
      const winAmount = oppBet;
      if (myBet > 0) await addPoints('Cát Tê', 'Hoàn cược', myBet);
      await addPoints('Cát Tê', 'Thắng Cát Tê', winAmount);
      window.showToast(`🎉 Thắng +${winAmount.toLocaleString('vi-VN')}đ!`, 'success');
    } else if (outcome === 'draw') {
      if (myBet > 0) await addPoints('Cát Tê', 'Hoàn cược (hòa)', myBet);
      window.showToast('🤝 Hoà, hoàn lại cược', 'info');
    } else {
      window.showToast(`💸 Thua ${myBet.toLocaleString('vi-VN')}đ`, 'warn');
    }
  } catch (e) {
    console.error(e);
  }
}

// ===== LEAVE ROOM =====
window.leaveMpRoom = async function() {
  if (!ROOM_ID) { location.href = 'rooms.html'; return; }
  try {
    const r = _room;
    if (r) {
      const gs = r.gameState || {};
      if (gs.phase === 'betting') {
        const myBet = gs.bets?.[_user.uid] || 0;
        if (myBet > 0) await addPoints('Cát Tê', 'Hoàn cược (rời phòng)', myBet);
      }
      if (gs.phase === 'playing' && !gs.result && !gs.winnerPlayerId) {
        const oppUid = (r.members || []).find(u => u !== _user.uid);
        if (oppUid) {
          const isMeP1 = r.members[0] === _user.uid;
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            'gameState.phase': 'result',
            'gameState.result': 'leave',
            'gameState.winnerPlayerId': isMeP1 ? 'p2' : 'p1',
            'gameState.lastActionMessage': 'Đối thủ đã rời phòng!'
          });
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
  if (_unsub) { _unsub(); _unsub = null; }
  location.href = 'rooms.html';
};

// ===== READY / START =====
window.toggleMpReady = async function() {
  if (!ROOM_ID || !_room) return;
  const memberInfo = _room.memberInfo || {};
  const me = memberInfo[_user.uid] || { name: '', ready: false };
  me.ready = !me.ready;
  memberInfo[_user.uid] = me;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { memberInfo });
};

// ===== RESULT HANDLING =====
window.closeResultAndContinue = function() {
  document.getElementById('result-modal').classList.add('hidden');
  const r = _room;
  if (r && r.hostUid === _user.uid) {
    hostNextRound();
  }
};

function showResult(emoji, title, pts, sub) {
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-pts').textContent = pts || '';
  document.getElementById('result-sub').textContent = sub || '';
  document.getElementById('result-modal').classList.remove('hidden');
}

// ===== TOAST =====
window.showToast = function(msg, type = 'info') {
  const c = { info: '#38bdf8', success: '#34d399', warn: '#fbbf24', error: '#f87171' };
  const t = document.createElement('div');
  t.style.cssText = `pointer-events:all;padding:11px 16px;border-radius:12px;background:rgba(4,20,40,0.97);border:1px solid ${c[type]||c.info};color:#e0f2fe;font-size:13px;font-weight:400;font-family:'Science Gothic', sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

console.log('♣️ Cát Tê Multiplayer loaded');
