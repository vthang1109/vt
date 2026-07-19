// ============================================================
// ===== XÌ DÁCH MULTIPLAYER - PHẦN 1/2 =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from '../../cards.js';
import { getActiveBuff, getPetById, getTierById } from '../../pet.js';
import { initRoomChat, getMyNickname } from '../../room-chat.js';

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
let _room = null, _myActivePet = null;
let _settledRound = -1;
let _autoDealRound = -1;
let _dealerModalShownFor = null;
let _actionLock = false;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ========== UTILS ==========
function cardPoints(card) {
  const v = card.v;
  if (v === 'A') return 0;
  if (['J', 'Q', 'K'].includes(v)) return 10;
  return parseInt(v);
}

function bestScore(hand) {
  if (!hand || hand.length === 0) return 0;
  let totalWithoutAces = 0;
  let aceCount = 0;
  for (const c of hand) {
    if (c.v === 'A') {
      aceCount++;
    } else {
      totalWithoutAces += cardPoints(c);
    }
  }
  const len = hand.length;
  if (len === 2 && aceCount === 2) return 21;
  let possibleAceValues;
  if (len <= 3) {
    possibleAceValues = [1, 10, 11];
  } else {
    possibleAceValues = [1];
  }
  let best = 0;
  function tryAces(index, currentSum) {
    if (index === aceCount) {
      if (currentSum <= 21 && currentSum > best) {
        best = currentSum;
      } else if (currentSum > 21 && (best === 0 || currentSum < best)) {
        best = currentSum;
      }
      return;
    }
    for (const val of possibleAceValues) {
      tryAces(index + 1, currentSum + val);
    }
  }
  tryAces(0, totalWithoutAces);
  return best;
}

function handStatus(hand) {
  const score = bestScore(hand);
  const len = hand.length;
  if (len === 2 && hand[0].v === 'A' && hand[1].v === 'A') return { score, tag: 'xi_bang' };
  if (len === 2) {
    const hasA = hand.some(c => c.v === 'A');
    const hasTen = hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.v));
    if (hasA && hasTen) return { score: 21, tag: 'xi_dach' };
  }
  if (len === 5 && score <= 21) return { score, tag: 'ngu_linh' };
  if (score > 21) return { score, tag: 'bust' };
  return { score, tag: 'ok' };
}

function compareHands(playerHand, dealerHand, bet) {
  const pStat = handStatus(playerHand);
  const dStat = handStatus(dealerHand);

  if (pStat.tag === 'bust' && dStat.tag === 'bust') {
    return { outcome: 'draw', delta: 0 };
  }
  if (pStat.tag === 'bust') {
    return { outcome: 'lose', delta: -bet };
  }
  if (dStat.tag === 'bust') {
    return { outcome: 'win', delta: bet };
  }

  const pSpecial = (pStat.tag === 'xi_bang' || pStat.tag === 'xi_dach');
  const dSpecial = (dStat.tag === 'xi_bang' || dStat.tag === 'xi_dach');

  if (pSpecial && !dSpecial) {
    return { outcome: 'win', delta: bet };
  }
  if (dSpecial && !pSpecial) {
    return { outcome: 'lose', delta: -bet };
  }
  if (pSpecial && dSpecial) {
    return { outcome: 'draw', delta: 0 };
  }

  if (pStat.tag === 'ngu_linh' && dStat.tag === 'ngu_linh') {
    if (pStat.score < dStat.score) return { outcome: 'win', delta: bet };
    if (pStat.score > dStat.score) return { outcome: 'lose', delta: -bet };
    return { outcome: 'draw', delta: 0 };
  }
  if (pStat.tag === 'ngu_linh') {
    return { outcome: 'win', delta: bet };
  }
  if (dStat.tag === 'ngu_linh') {
    return { outcome: 'lose', delta: -bet };
  }

  if (pStat.score > dStat.score) {
    return { outcome: 'win', delta: bet };
  }
  if (pStat.score < dStat.score) {
    return { outcome: 'lose', delta: -bet };
  }
  return { outcome: 'draw', delta: 0 };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Cập nhật room ID lên nav giống baucua
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
  roomEl.innerHTML = `<span class="room-icon">🃏</span> #${roomCode}`;
}

// mới
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(() => window.quitGame());
  _unsubMe = onSnapshot(doc(db, 'users', _user.uid), (s) => {
    if (s.exists()) {
      _myBalance = s.data().points || 0;
      _myActivePet = s.data().activePet || null;
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
    if (r.gameType !== 'xidach' || !r.gameState) return;
    render(r);
  });
}

/* ========== RENDER ========== */
function render(r) {
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const dealerUid = r.hostUid;
  const phEl = document.getElementById('bc-mid');
  const leftEl = document.getElementById('bc-left');
  const rightEl = document.getElementById('bc-right');
  const betRow = document.getElementById('xd-bet-row');

  // Giữa: tên người đang tới lượt / trạng thái phase (không hiện số vòng)
  if (gs.phase === 'betting') phEl.textContent = '';
  else if (gs.phase === 'playing') {
    const turnUid = gs.turnOrder?.[gs.turnIdx];
    if (turnUid === _user.uid) phEl.textContent = esc(r.memberInfo?.[_user.uid]?.name || _user.displayName || 'Bạn');
    else if (turnUid) phEl.textContent = esc(r.memberInfo?.[turnUid]?.name || '...');
    else phEl.textContent = 'Đang chơi...';
  }
  else if (gs.phase === 'dealer') phEl.textContent = 'Nhà Cái';
  else if (gs.phase === 'result') {
    let outcome;
    if (isHost) {
      const d = gs.dealerDelta || 0;
      outcome = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw';
    } else {
      outcome = gs.results?.[_user.uid]?.outcome || 'draw';
    }
    phEl.textContent = outcome === 'win' ? 'WIN' : outcome === 'lose' ? 'LOSE' : 'DRAW';
  }

  // Trái: icon vương miện nếu là Cái (host); Con → tiền cược của mình
  if (isHost) {
    leftEl.textContent = '👑';
  } else {
    const myBetAmt = gs.bets?.[_user.uid] || 0;
    leftEl.textContent = myBetAmt ? myBetAmt.toLocaleString('vi-VN') : '';
  }

  // Phải: Cái → thắng/thua (dealerDelta); Con → tiền thắng/thua của mình
  if (isHost) {
    const delta = gs.dealerDelta || 0;
    rightEl.textContent = delta === 0 ? '' : (delta > 0 ? '+' : '') + delta.toLocaleString('vi-VN');
    rightEl.className = 'stat-profit ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
  } else {
    const myDelta = gs.results?.[_user.uid]?.delta || 0;
    rightEl.textContent = myDelta === 0 ? '' : (myDelta > 0 ? '+' : '') + myDelta.toLocaleString('vi-VN');
    rightEl.className = 'stat-profit ' + (myDelta > 0 ? 'positive' : myDelta < 0 ? 'negative' : 'zero');
  }

  let statusResultCls = '';
  if (gs.phase === 'result') {
    let outcome;
    if (isHost) {
      const d = gs.dealerDelta || 0;
      outcome = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw';
    } else {
      outcome = gs.results?.[_user.uid]?.outcome || 'draw';
    }
    statusResultCls = outcome === 'win' ? ' result-win' : outcome === 'lose' ? ' result-lose' : ' result-draw';
  }
  document.getElementById('bc-status').className = 'bc-status' + statusResultCls;

  const myBet = gs.bets?.[_user.uid] || 0;
  if (gs.phase === 'betting' && !isHost) {
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else {
    betRow.style.display = 'none';
  }

  const otherPlayers = (r.members || []).filter(uid => uid !== dealerUid && uid !== _user.uid);
  let seatsOrder = isHost
    ? [...otherPlayers, dealerUid]
    : [dealerUid, ...otherPlayers, _user.uid];

  const tEl = document.getElementById('xd-table');
  tEl.innerHTML = '';

  const dealerHand = gs.hands?.[dealerUid] || [];
  const dealerStat = dealerHand.length ? handStatus(dealerHand) : null;
  const dealerOpen = gs.phase === 'dealer' || gs.phase === 'result';

  for (const uid of seatsOrder) {
    const isDealer = (uid === dealerUid);
    const isMe = (uid === _user.uid);
    const hand = gs.hands?.[uid] || [];
    const stat = hand.length ? handStatus(hand) : null;
    const isTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === uid;
    const betAmt = gs.bets?.[uid] || 0;
    const checked = !!gs.dealerChecked?.[uid];

    let visibleCount = 0;
    if (isMe) {
      visibleCount = hand.length;
    } else if (isDealer) {
      visibleCount = dealerOpen ? hand.length : 0;
    } else {
      visibleCount = (gs.phase === 'result' || (gs.phase === 'dealer' && checked) || gs.results?.[uid]) ? hand.length : 0;
    }

    let cardsHtml = hand.length === 0
      ? '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>'
      : hand.map((c, i) => renderCardUI(i < visibleCount ? c : null, i >= visibleCount)).join('');

    let cls = 'xd-seat';
    if (isTurn) cls += ' turn';
    if (gs.results?.[uid]) {
      const res = gs.results[uid];
      if (res.outcome === 'win') cls += ' win';
      else if (res.outcome === 'lose') cls += ' lose';
    }
    if (isMe || (isHost && isDealer)) cls += ' me';
    if (isDealer) cls += ' dealer';

    let nameHtml = isDealer
      ? `👑 Nhà Cái${isHost ? ' <span style="color:#fbbf24;font-size:12px">(bạn)</span>' : ''}`
      : `${esc(r.memberInfo?.[uid]?.name || '?')}${isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}`;

    let scoreText = '';
    if (isDealer) {
      if (dealerOpen && stat) scoreText = stat.score;
      else scoreText = '?';
    } else {
      if (stat && (isMe || gs.phase === 'result' || (gs.phase === 'dealer' && checked)))
        scoreText = stat.score;
    }
    if (scoreText !== '') {
      nameHtml += ` <span class="xd-score-inline">${scoreText}</span>`;
    }

    let checkBtnHtml = '';
    if (isHost && gs.phase === 'dealer' && !isDealer && !checked) {
      const dScore = dealerStat ? dealerStat.score : 0;
      const dLen = dealerHand.length;
      const canCheck = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
      if (canCheck) {
        checkBtnHtml = `<button class="xd-check-btn-neon" onclick="hostCheckPlayer('${uid}')">XÉT BÀI</button>`;
      }
    }

    let resultOverlayHtml = '';
    if (gs.phase === 'result' || gs.results?.[uid]) {
      if (isDealer) {
        if (gs.phase === 'result') {
          if (dealerStat) {
            if (dealerStat.tag === 'xi_bang') {
              resultOverlayHtml = '<div class="xd-result-overlay xd-result-special">XÌ BÀN</div>';
            } else if (dealerStat.tag === 'xi_dach') {
              resultOverlayHtml = '<div class="xd-result-overlay xd-result-special">XÌ DÁCH</div>';
            } else if (dealerStat.tag === 'ngu_linh') {
              resultOverlayHtml = '<div class="xd-result-overlay xd-result-special">NGŨ LINH</div>';
            } else if (dealerStat.tag === 'bust') {
              resultOverlayHtml = '<div class="xd-result-overlay xd-result-bust">QUẮC</div>';
            }
          }
          if (!resultOverlayHtml) {
            const delta = gs.dealerDelta || 0;
            if (delta > 0) {
              resultOverlayHtml = `<div class="xd-result-overlay xd-result-win">+${delta.toLocaleString('vi-VN')}đ</div>`;
            } else if (delta < 0) {
              resultOverlayHtml = `<div class="xd-result-overlay xd-result-lose">${delta.toLocaleString('vi-VN')}đ</div>`;
            } else {
              resultOverlayHtml = '<div class="xd-result-overlay xd-result-draw">HÒA</div>';
            }
          }
        }
      } else if (gs.results?.[uid]) {
        const res = gs.results[uid];
        let overlayClass = '', overlayText = '';
        if (stat?.tag === 'xi_bang') {
          overlayClass = 'xd-result-special'; overlayText = 'XÌ BÀN';
        } else if (stat?.tag === 'xi_dach') {
          overlayClass = 'xd-result-special'; overlayText = 'XÌ DÁCH';
        } else if (stat?.tag === 'ngu_linh') {
          overlayClass = 'xd-result-special'; overlayText = 'NGŨ LINH';
        } else if (stat?.tag === 'bust') {
          overlayClass = 'xd-result-bust'; overlayText = 'QUẮC';
        } else if (res.outcome === 'win') {
          overlayClass = 'xd-result-win';
          overlayText = `+${res.delta.toLocaleString('vi-VN')}đ`;
        } else if (res.outcome === 'lose') {
          overlayClass = 'xd-result-lose';
          overlayText = `${res.delta.toLocaleString('vi-VN')}đ`;
        } else {
          overlayClass = 'xd-result-draw';
          overlayText = 'HÒA';
        }
        resultOverlayHtml = `<div class="xd-result-overlay ${overlayClass}">${overlayText}</div>`;
      }
    }

    let betBadgeHtml = '';
    if (!isDealer && betAmt > 0) {
      betBadgeHtml = `<div class="xd-bet-badge">${betAmt.toLocaleString('vi-VN')}đ</div>`;
    }

    let offerBtnHtml = '';
    if (isHost && gs.phase === 'result' && !isDealer) {
      offerBtnHtml = `<button class="xd-offer-btn-flat" onclick="hostOfferDealer('${uid}')">ĐỔI CÁI</button>`;
    }

    let offerConfirmHtml = '';
    if (isMe && !isHost && gs.dealerOffer?.uid === uid) {
      offerConfirmHtml = `
        <div class="xd-offer-confirm">
          <div class="xd-offer-text">Bạn có muốn làm Cái?</div>
          <div class="xd-offer-actions">
            <button class="xd-offer-decline" onclick="declineDealerOffer()">Từ chối</button>
            <button class="xd-offer-accept" onclick="acceptDealerOffer()">Đồng ý</button>
          </div>
        </div>`;
    }

    tEl.innerHTML += `
      <div class="${cls}">
        ${resultOverlayHtml}
        ${checkBtnHtml}
        ${offerBtnHtml}
        ${offerConfirmHtml}
        <div class="xd-seat-head">
          <span class="xd-seat-name">${nameHtml}</span>
        </div>
        <div class="xd-cards">${cardsHtml}</div>
        ${betBadgeHtml}
      </div>`;
  }

  const players = (r.members || []).filter(u => u !== dealerUid);
  const allBet = players.length > 0 && players.every(u => (gs.bets?.[u] || 0) > 0);

  // Tự động chia bài khi tất cả người chơi đã đặt cược xong
  if (isHost && gs.phase === 'betting' && allBet && gs.round !== _autoDealRound) {
    _autoDealRound = gs.round;
    setTimeout(() => { window.hostDeal(); }, 400);
  }

  /* ===== Hàng nút hành động dưới cùng ===== */
  const actEl = document.getElementById('xd-actions');
  if (isHost) {
    const dScore = dealerStat ? dealerStat.score : 0;
    const dLen = dealerHand.length;
    const canStop = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
    const drawEnabled = gs.phase === 'dealer';
    const checkAllEnabled = gs.phase === 'dealer' && canStop;
    const nextRoundEnabled = gs.phase === 'result';
    actEl.innerHTML = `
      <button class="xd-act-btn xd-act-blue" ${drawEnabled ? '' : 'disabled'} onclick="hostDealerDraw()">Rút Bài</button>
      <button class="xd-act-btn xd-act-orange" ${checkAllEnabled ? '' : 'disabled'} onclick="hostEndDealerTurn()">Xét Tất</button>
      <button class="xd-act-btn xd-act-yellow" ${nextRoundEnabled ? '' : 'disabled'} onclick="hostNextRound()">Vòng mới</button>
    `;
  } else {
    const myTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === _user.uid;
    const myHand = gs.hands?.[_user.uid] || [];
    const myScore = myHand.length ? bestScore(myHand) : 0;
    const canStand = myScore >= 16 || myHand.length === 5;
    const hitEnabled = myTurn;
    const standEnabled = myTurn && canStand;
    const reqPending = gs.dealerRequest?.uid === _user.uid;
    const reqEnabled = (gs.phase === 'betting' || gs.phase === 'result') && !reqPending;
    actEl.innerHTML = `
      <button class="xd-act-btn xd-act-blue" ${hitEnabled ? '' : 'disabled'} onclick="hit()">Rút Bài</button>
      <button class="xd-act-btn xd-act-purple" ${standEnabled ? '' : 'disabled'} onclick="stand()">Dằn</button>
      <button class="xd-act-btn xd-act-yellow" ${reqEnabled ? '' : 'disabled'} onclick="requestDealer()">${reqPending ? 'Đã gửi...' : 'Làm Cái'}</button>
    `;
  }

  /* ===== Popup yêu cầu đổi cái (chỉ host thấy) ===== */
  if (isHost && gs.dealerRequest) {
    showDealerRequestModal(r, gs.dealerRequest);
  } else {
    hideDealerRequestModal();
  }

  if (gs.phase === 'result' && gs.round !== _settledRound) {
    _settledRound = gs.round;
    settleMyResult(r, gs);
  }
}

function showDealerRequestModal(r, req) {
  if (_dealerModalShownFor === req.uid) return;
  _dealerModalShownFor = req.uid;
  let modal = document.getElementById('xd-dealer-req-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'xd-dealer-req-modal';
    modal.className = 'xd-modal-overlay';
    document.body.appendChild(modal);
  }
  const name = esc(req.name || r.memberInfo?.[req.uid]?.name || 'Người chơi');
  modal.innerHTML = `
    <div class="xd-modal-box">
      <div class="xd-modal-title">${name} muốn làm Cái</div>
      <div class="xd-modal-actions">
        <button class="xd-modal-btn decline" onclick="declineDealerRequest()">Từ chối</button>
        <button class="xd-modal-btn accept" onclick="acceptDealerRequest()">Đồng ý</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
}

function hideDealerRequestModal() {
  _dealerModalShownFor = null;
  const modal = document.getElementById('xd-dealer-req-modal');
  if (modal) modal.style.display = 'none';
}
// ============================================================
// ===== XÌ DÁCH MULTIPLAYER - PHẦN 2/2 =====
// ============================================================

/* ========== HÀNH ĐỘNG ========== */
window.placeBet = async function() {
  const amt = parseInt(document.getElementById('xd-bet-input').value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm', 'error'); return; }
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    if (window.VTQuests) window.VTQuests.trackPlay('xidach');
    showToast('✅ Đã đặt ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.hostDeal = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  const players = (r.members || []).filter(u => u !== r.hostUid && (gs.bets?.[u] || 0) > 0);
  if (players.length === 0) { showToast('Chưa ai cược', 'warn'); return; }

  const deck = createDeck();
  const hands = {};
  hands[r.hostUid] = [deck.pop(), deck.pop()];
  players.forEach(uid => { hands[uid] = [deck.pop(), deck.pop()]; });

  const dealerStat = handStatus(hands[r.hostUid]);
  const updates = {
    'gameState.phase': 'playing',
    'gameState.deck': deck,
    'gameState.hands': hands,
    'gameState.stands': {},
    'gameState.turnOrder': players,
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.revealed': {},
    'gameState.dealerChecked': {}
  };

  let dealerDelta = 0;

  if (dealerStat.tag === 'xi_bang' || dealerStat.tag === 'xi_dach') {
    updates['gameState.phase'] = 'result';
    updates['gameState.dealerChecked'] = Object.fromEntries(players.map(u => [u, true]));
    const results = {};
    players.forEach(uid => {
      const bet = gs.bets?.[uid] || 0;
      if (bet === 0) return;
      const playerHand = hands[uid];
      const playerStat = handStatus(playerHand);
      let outcome = 'lose', delta = -bet;
      if ((dealerStat.tag === 'xi_bang' && playerStat.tag === 'xi_bang') ||
          (dealerStat.tag === 'xi_dach' && playerStat.tag === 'xi_dach')) {
        outcome = 'draw'; delta = 0;
      } else if (playerStat.tag === 'xi_bang' || playerStat.tag === 'xi_dach') {
        outcome = 'win'; delta = bet;
      }
      results[uid] = { outcome, delta };
    });
    updates['gameState.results'] = results;
    for (const res of Object.values(results)) dealerDelta -= res.delta;
    updates['gameState.dealerDelta'] = dealerDelta;
  } else {
    const results = {};
    const checked = {};
    const newTurnOrder = [];
    for (const uid of players) {
      const playerHand = hands[uid];
      const playerStat = handStatus(playerHand);
      if (playerStat.tag === 'xi_bang' || playerStat.tag === 'xi_dach') {
        const bet = gs.bets?.[uid] || 0;
        results[uid] = { outcome: 'win', delta: bet };
        checked[uid] = true;
      } else {
        newTurnOrder.push(uid);
      }
    }
    if (Object.keys(results).length > 0) {
      updates['gameState.results'] = results;
      updates['gameState.dealerChecked'] = checked;
      for (const res of Object.values(results)) dealerDelta -= res.delta;
      updates['gameState.dealerDelta'] = dealerDelta;
    }
    updates['gameState.turnOrder'] = newTurnOrder;
    updates['gameState.turnIdx'] = 0;
    if (newTurnOrder.length === 0) {
      updates['gameState.phase'] = 'dealer';
    }
  }

  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

window.hit = async function() {
  if (_actionLock) return;
  _actionLock = true;
  try {
    const r = _room;
    if (!r) return;
    const gs = r.gameState;
    if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
    if ((gs.hands?.[_user.uid] || []).length >= 5) return;
    const deck = [...(gs.deck || [])];
    const hand = [...(gs.hands?.[_user.uid] || [])];
    if (deck.length === 0) { showToast('Hết bài', 'warn'); return; }
    hand.push(deck.pop());
    const stat = handStatus(hand);
    const updates = { 'gameState.deck': deck, [`gameState.hands.${_user.uid}`]: hand };
    if (stat.tag === 'bust' || hand.length >= 5 || stat.score >= 21) {
      updates[`gameState.stands.${_user.uid}`] = true;
      const stands = { ...(gs.stands || {}), [_user.uid]: true };
      let idx = gs.turnIdx;
      while (idx < gs.turnOrder.length && stands[gs.turnOrder[idx]]) idx++;
      updates['gameState.turnIdx'] = idx;
      if (idx >= gs.turnOrder.length) updates['gameState.phase'] = 'dealer';
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  } finally {
    _actionLock = false;
  }
};

window.stand = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  const hand = gs.hands?.[_user.uid] || [];
  const score = bestScore(hand);
  if (score < 16 && hand.length < 5) { showToast('Phải đủ 16 điểm hoặc Ngũ Linh', 'warn'); return; }
  const updates = { [`gameState.stands.${_user.uid}`]: true };
  const stands = { ...(gs.stands || {}), [_user.uid]: true };
  let idx = gs.turnIdx;
  while (idx < gs.turnOrder.length && stands[gs.turnOrder[idx]]) idx++;
  updates['gameState.turnIdx'] = idx;
  if (idx >= gs.turnOrder.length) updates['gameState.phase'] = 'dealer';
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

window.hostDealerDraw = async function() {
  if (_actionLock) return;
  _actionLock = true;
  try {
    const r = _room;
    if (!r) return;
    const gs = r.gameState;
    if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
    if ((gs.hands?.[r.hostUid] || []).length >= 5) return;
    let deck = [...(gs.deck || [])];
    let hand = [...(gs.hands?.[r.hostUid] || [])];
    if (deck.length === 0) { showToast('Hết bài', 'warn'); return; }
    hand.push(deck.pop());
    const updates = { 'gameState.deck': deck, [`gameState.hands.${r.hostUid}`]: hand };

    const newStat = handStatus(hand);
    if (newStat.tag === 'bust') {
      const players = (r.members || []).filter(u => u !== r.hostUid);
      const results = { ...(gs.results || {}) };
      for (const uid of players) {
        if (gs.dealerChecked?.[uid]) continue;
        const bet = gs.bets?.[uid] || 0;
        if (bet === 0) continue;
        const playerHand = gs.hands?.[uid] || [];
        const pStat = handStatus(playerHand);
        results[uid] = pStat.tag === 'bust' ? { outcome: 'draw', delta: 0 } : { outcome: 'win', delta: bet };
      }
      let dealerDelta = 0;
      for (const res of Object.values(results)) dealerDelta -= res.delta;
      updates['gameState.phase'] = 'result';
      updates['gameState.results'] = results;
      updates['gameState.dealerDelta'] = dealerDelta;
    }
    await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  } finally {
    _actionLock = false;
  }
};

window.hostCheckPlayer = async function(targetUid) {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dealerScore = bestScore(dealerHand);
  const dLen = dealerHand.length;
  
  const canCheck = (dLen === 2 && dealerScore >= 15) || (dLen >= 3 && dealerScore >= 16);
  if (!canCheck) { showToast('Chưa đủ điểm để xét bài!', 'warn'); return; }
  
  const targetHand = gs.hands?.[targetUid] || [];
  const bet = gs.bets?.[targetUid] || 0;
  const outcome = compareHands(targetHand, dealerHand, bet);
  
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.results.${targetUid}`]: outcome,
    [`gameState.dealerChecked.${targetUid}`]: true
  });
  
  showToast(`✅ Đã xét bài ${esc(r.memberInfo?.[targetUid]?.name || '?')}`, 'success');
};

window.hostEndDealerTurn = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dealerScore = bestScore(dealerHand);
  const dLen = dealerHand.length;
  const canStop = (dLen === 2 && dealerScore >= 15) || (dLen >= 3 && dealerScore >= 16);
  if (!canStop) { showToast('Chưa đủ điểm để kết thúc!', 'warn'); return; }

  const players = (r.members || []).filter(u => u !== r.hostUid);
  const results = { ...(gs.results || {}) };
  
  for (const uid of players) {
    if (!gs.dealerChecked?.[uid]) {
      const bet = gs.bets?.[uid] || 0;
      if (bet === 0) continue;
      const playerHand = gs.hands?.[uid] || [];
      results[uid] = compareHands(playerHand, dealerHand, bet);
    }
  }

  let dealerDelta = 0;
  for (const res of Object.values(results)) dealerDelta -= res.delta;

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.results': results,
    'gameState.dealerChecked': Object.fromEntries(players.map(u => [u, true])),
    'gameState.dealerDelta': dealerDelta
  });
};



async function settleMyResult(r, gs) {
  if (r.hostUid === _user.uid) {
    const dealerDelta = gs.dealerDelta || 0;
    let dealerBuffBonus = 0, dealerBuffPct = 0;
    if (dealerDelta > 0) {
      try {
        dealerBuffPct = await getActiveBuff();
        if (dealerBuffPct > 0) dealerBuffBonus = Math.round(dealerDelta * dealerBuffPct / 100);
      } catch {}
    }
    const totalDealerDelta = dealerDelta + dealerBuffBonus;
    if (dealerDelta !== 0) {
      await updateDoc(doc(db, 'users', _user.uid), { points: increment(totalDealerDelta) });
      if (dealerBuffBonus > 0) {
        await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.dealerDelta': totalDealerDelta });
      }
      showToast(totalDealerDelta >= 0 ? `🎉 Nhà cái thu ${totalDealerDelta.toLocaleString('vi-VN')}đ` : `💸 Nhà cái lỗ ${(-totalDealerDelta).toLocaleString('vi-VN')}đ`, totalDealerDelta >= 0 ? 'success' : 'warn');
      if (window.VTQuests && totalDealerDelta > 0) window.VTQuests.trackEarn(totalDealerDelta);
    }
    return;
  }
  const res = gs.results?.[_user.uid];
  if (!res) return;
  const bet = gs.bets?.[_user.uid] || 0;

  if (res.outcome === 'win') {
    let winAmount = res.delta;
    let buffBonus = 0;
    let buffPct = 0;
    try {
      buffPct = await getActiveBuff();
      if (buffPct > 0) {
        buffBonus = Math.round(winAmount * buffPct / 100);
      }
    } catch {}
    const netGain = winAmount + buffBonus;
    await updateDoc(doc(db, 'users', _user.uid), { points: increment(netGain) });
    if (buffBonus > 0) {
      await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.results.${_user.uid}.delta`]: winAmount + buffBonus });
    }

    if (buffBonus > 0) {
      const petData = (() => {
        try {
          const activePetId = _myActivePet;
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

  } else if (res.outcome === 'lose') {
    await updateDoc(doc(db, 'users', _user.uid), { points: increment(-bet) });
    showToast(`💸 Thua ${bet.toLocaleString('vi-VN')}đ`, 'warn');

  } else {
    showToast(`🤝 Hoà`, 'info');
  }
}

window.hostNextRound = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.hands': {},
    'gameState.bets': {},
    'gameState.stands': {},
    'gameState.turnOrder': [],
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.deck': [],
    'gameState.revealed': {},
    'gameState.dealerChecked': {},
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

window.hostTransferDealer = async function(targetUid) {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  const phase = r.gameState?.phase;
  if (phase !== 'result' && phase !== 'betting') return;
  if (!targetUid || targetUid === r.hostUid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    hostUid: targetUid,
    'gameState.phase': 'betting',
    'gameState.hands': {},
    'gameState.bets': {},
    'gameState.stands': {},
    'gameState.turnOrder': [],
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.deck': [],
    'gameState.revealed': {},
    'gameState.dealerChecked': {},
    'gameState.dealerRequest': null,
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

window.requestDealer = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid === _user.uid) return;
  const phase = r.gameState?.phase;
  if (phase !== 'betting' && phase !== 'result') { showToast('Chờ ván kết thúc', 'warn'); return; }
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.dealerRequest': { uid: _user.uid, name: r.memberInfo?.[_user.uid]?.name || 'Người chơi' }
  });
  showToast('✅ Đã gửi yêu cầu làm Cái', 'success');
};

window.acceptDealerRequest = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  const req = r.gameState?.dealerRequest;
  if (!req) return;
  await window.hostTransferDealer(req.uid);
};

window.declineDealerRequest = async function() {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.dealerRequest': null });
};

window.hostOfferDealer = async function(targetUid) {
  const r = _room;
  if (!r) return;
  if (r.hostUid !== _user.uid) return;
  if (r.gameState?.phase !== 'result') return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.dealerOffer': { uid: targetUid, name: r.memberInfo?.[targetUid]?.name || 'Người chơi' }
  });
};

window.acceptDealerOffer = async function() {
  const r = _room;
  if (!r) return;
  const offer = r.gameState?.dealerOffer;
  if (!offer || offer.uid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    hostUid: _user.uid,
    'gameState.phase': 'betting',
    'gameState.hands': {},
    'gameState.bets': {},
    'gameState.stands': {},
    'gameState.turnOrder': [],
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.deck': [],
    'gameState.revealed': {},
    'gameState.dealerChecked': {},
    'gameState.dealerOffer': null,
    'gameState.dealerRequest': null,
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

window.declineDealerOffer = async function() {
  const r = _room;
  if (!r) return;
  const offer = r.gameState?.dealerOffer;
  if (!offer || offer.uid !== _user.uid) return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.dealerOffer': null });
};

window.quitGame = async function() {
  try {
    const r = _room;
    if (r) {
      const myBet = r.gameState?.phase === 'betting' ? (r.gameState.bets?.[_user.uid] || 0) : 0;
      if (myBet > 0) {
        await updateDoc(doc(db, 'users', _user.uid), { points: increment(-myBet) });
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
  } catch (e) {}
  location.href = 'rooms.html';
};