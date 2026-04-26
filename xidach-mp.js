// ===== XÌ DÁCH MULTIPLAYER (LUẬT MỚI) - PHẦN 1/2 =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from './cards.js';

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

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  _unsubMe = onSnapshot(doc(db, 'users', _user.uid), (s) => {
    if (s.exists()) {
      _myBalance = s.data().points || 0;
      const el = document.getElementById('xd-balance');
      if (el) el.textContent = _myBalance.toLocaleString('vi-VN') + ' đ';
    }
  });
  if (ROOM_ID) start();
});

/* ========== UTILS ========== */
function cardPoints(card) {
  const v = card.v;
  if (v === 'A') return 1;
  if (['J', 'Q', 'K'].includes(v)) return 10;
  return parseInt(v);
}

function bestScore(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    total += cardPoints(c);
    if (c.v === 'A') aces++;
  }
  while (aces > 0 && total + 10 <= 21) { total += 10; aces--; }
  return total;
}

function handStatus(hand) {
  const score = bestScore(hand);
  const len = hand.length;
  if (len === 2 && hand[0].v === 'A' && hand[1].v === 'A') return { score, tag: 'xi_bang' };
  if (len === 2) {
    const hasA = hand.some(c => c.v === 'A');
    const hasTen = hand.some(c => ['10','J','Q','K'].includes(c.v));
    if (hasA && hasTen) return { score: 21, tag: 'xi_dach' };
  }
  if (len >= 5 && score <= 21) return { score, tag: 'ngu_linh' };
  if (score > 21) return { score, tag: 'bust' };
  return { score, tag: 'ok' };
}

/* ========== FIREBASE LISTENER ========== */
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    document.getElementById('xd-room').textContent = '#' + (r.code || '------');
    if (r.gameType !== 'xidach' || !r.gameState) return;
    render(r);
  });
}

/* ========== RENDER ========== */
function render(r) {
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const dealerUid = r.hostUid;
  const phEl = document.getElementById('xd-phase');
  const betRow = document.getElementById('xd-bet-row');
  const btnHit = document.getElementById('btn-hit');
  const btnStand = document.getElementById('btn-stand');
  const btnDeal = document.getElementById('btn-deal');
  const btnNext = document.getElementById('btn-next-round');

  // Cập nhật phase text
  if (gs.phase === 'betting') phEl.textContent = `🎰 Vòng ${gs.round} — Hãy đặt cược`;
  else if (gs.phase === 'playing') {
    const turnUid = gs.turnOrder?.[gs.turnIdx];
    if (turnUid === _user.uid) phEl.textContent = '🎯 Đến lượt BẠN';
    else if (turnUid) phEl.textContent = `⏳ Chờ ${esc(r.memberInfo?.[turnUid]?.name || '...')}`;
    else phEl.textContent = '⏳ Đang chơi...';
  }
  else if (gs.phase === 'dealer') phEl.textContent = '🃏 Nhà cái đang xét bài';
  else if (gs.phase === 'result') phEl.textContent = `📢 Kết quả vòng ${gs.round}`;

  // Bet row
  const myBet = gs.bets?.[_user.uid] || 0;
  if (gs.phase === 'betting' && !isHost) {
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else {
    betRow.style.display = 'none';
  }

  // Xác định thứ tự hiển thị ghế
  const otherPlayers = (r.members || []).filter(uid => uid !== dealerUid && uid !== _user.uid);
  let seatsOrder = isHost
    ? [...otherPlayers, dealerUid]
    : [dealerUid, ...otherPlayers, _user.uid];

  const tEl = document.getElementById('xd-table');
  tEl.innerHTML = '';

  const dealerHand = gs.hands?.[dealerUid] || [];
  const dealerStat = dealerHand.length ? handStatus(dealerHand) : null;
  const dealerCanReveal = dealerStat && isHost && gs.phase === 'playing' && (
    (dealerHand.length === 2 && dealerStat.score >= 15) ||
    (dealerHand.length >= 3 && dealerStat.score >= 16)
  );
  const dealerAllOpen = !!(gs.dealerRevealedAll);

  for (const uid of seatsOrder) {
    const isDealer = (uid === dealerUid);
    const isMe = (uid === _user.uid);
    const hand = gs.hands?.[uid] || [];
    const stat = hand.length ? handStatus(hand) : null;
    const standed = !!gs.stands?.[uid];
    const isTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === uid;
    const betAmt = gs.bets?.[uid] || 0;

    // Xác định số lá được mở
    let visibleCount = 0;
    if (isMe) {
      visibleCount = hand.length;
    } else if (isDealer) {
      visibleCount = (dealerAllOpen || gs.phase === 'dealer' || gs.phase === 'result') ? hand.length : 0;
    } else {
      visibleCount = (gs.phase === 'result' || gs.phase === 'dealer' || dealerAllOpen || gs.earlyRevealed?.[uid] || gs.revealed?.[uid])
        ? hand.length : 0;
    }

    let cardsHtml = hand.length === 0
      ? '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>'
      : hand.map((c, i) => renderCardUI(i < visibleCount ? c : null, i >= visibleCount)).join('');

    let cls = 'xd-seat';
    if (isTurn) cls += ' turn';
    if (gs.phase === 'result' && gs.results?.[uid]) {
      const res = gs.results[uid];
      if (res.outcome === 'win') cls += ' win';
      else if (res.outcome === 'lose') cls += ' lose';
    }
    if (isMe || (isHost && isDealer)) cls += ' me';
    if (isDealer) cls += ' dealer';

    let tagHtml = '';
    const showStat = isMe || gs.phase === 'result' || gs.phase === 'dealer' || dealerAllOpen || gs.earlyRevealed?.[uid] || gs.revealed?.[uid];
    if (stat && showStat) {
      if (stat.tag === 'xi_bang') tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì Bàng</span>';
      else if (stat.tag === 'xi_dach') tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì Dách</span>';
      else if (stat.tag === 'ngu_linh') tagHtml += '<span class="xd-seat-tag" style="background:linear-gradient(45deg,#facc15,#fb923c);color:#000">Ngũ Linh</span>';
      else if (stat.tag === 'bust') tagHtml += '<span class="xd-seat-tag xd-tag-bust">Quắc</span>';
      else if (standed && !isDealer) tagHtml += '<span class="xd-seat-tag xd-tag-stand">✋ Dừng</span>';
    }
    if (gs.phase === 'result' && gs.results?.[uid] && !isDealer) {
      const res = gs.results[uid];
      if (res.outcome === 'win') tagHtml += `<span class="xd-seat-tag" style="background:rgba(52,211,153,.2);color:#34d399">+${res.delta}đ</span>`;
      else if (res.outcome === 'lose') tagHtml += `<span class="xd-seat-tag xd-tag-bust">${res.delta}đ</span>`;
      else tagHtml += `<span class="xd-seat-tag xd-tag-stand">Hoà</span>`;
    }

    let nameHtml = isDealer
      ? `👑 Nhà Cái${isHost ? ' <span style="color:#fbbf24;font-size:12px">(bạn)</span>' : ''}`
      : `${esc(r.memberInfo?.[uid]?.name || '?')}${isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}`;

    let scoreText = '';
    if (isDealer) {
      if ((dealerAllOpen || gs.phase === 'dealer' || gs.phase === 'result') && stat) scoreText = stat.score;
      else scoreText = '?';
    } else {
      if (stat && (isMe || gs.phase === 'result' || gs.phase === 'dealer' || dealerAllOpen || gs.earlyRevealed?.[uid] || gs.revealed?.[uid]))
        scoreText = stat.score;
    }

    // Nút mở bài (người chơi có Xì Bàng/Dách)
    let openBtnHtml = '';
    if (!isDealer && isMe && stat && (stat.tag === 'xi_bang' || stat.tag === 'xi_dach') && gs.phase === 'playing' && !gs.revealed?.[uid]) {
      openBtnHtml = `<button onclick="revealMyHand()" class="xd-open-btn">🎉 Mở bài</button>`;
    }

    // Nút khui bài (dành cho host)
    let earlyRevealBtn = '';
    if (isHost && dealerCanReveal && !isDealer && !gs.earlyRevealed?.[uid] && gs.phase === 'playing') {
      earlyRevealBtn = `<button onclick="earlyRevealPlayer('${uid}')" class="xd-early-btn">⚡ Khui bài</button>`;
    }

    tEl.innerHTML += `
      <div class="${cls}">
        <div class="xd-seat-head">
          <span class="xd-seat-name">${nameHtml}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${tagHtml}</div>
        </div>
        <div class="xd-cards">${cardsHtml}</div>
        <div class="xd-seat-meta">
          <span class="xd-score">${scoreText}</span>
          ${betAmt > 0 ? `<span class="xd-bet">Cược: ${betAmt.toLocaleString('vi-VN')}đ</span>` : (isDealer ? '' : '<span class="xd-bet" style="color:#64748b">chưa đặt</span>')}
        </div>
        ${openBtnHtml}${earlyRevealBtn}
      </div>`;
  }

  // Nút người chơi
  const myTurn = !isHost && gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === _user.uid;
  const myHand = gs.hands?.[_user.uid] || [];
  const myScore = myHand.length ? bestScore(myHand) : 0;
  const canStand = myScore >= 16 || myHand.length >= 5;
  btnHit.style.display = myTurn ? 'inline-block' : 'none';
  btnStand.style.display = myTurn ? 'inline-block' : 'none';
  btnStand.disabled = !canStand;

  // Nút Chia bài (host)
  const players = (r.members || []).filter(u => u !== dealerUid);
  const allBet = players.every(u => (gs.bets?.[u] || 0) > 0);
  const anyBet = Object.values(gs.bets || {}).some(v => v > 0);
  btnDeal.style.display = (isHost && gs.phase === 'betting') ? 'inline-block' : 'none';
  btnDeal.disabled = !allBet;
  btnDeal.textContent = allBet ? '🃏 Chia bài' : '⏳ Chờ đặt cược';

  // Nút Vòng mới
  btnNext.style.display = (isHost && gs.phase === 'result') ? 'inline-block' : 'none';

  // Nút bốc/dừng cho dealer
  let dealerDrawBtn = document.getElementById('btn-dealer-draw');
  let dealerStandBtn = document.getElementById('btn-dealer-stand');
  if (!dealerDrawBtn) {
    dealerDrawBtn = document.createElement('button');
    dealerDrawBtn.id = 'btn-dealer-draw';
    dealerDrawBtn.className = 'btn-deal';
    dealerDrawBtn.style.cssText = 'background:linear-gradient(135deg,#0ea5e9,#38bdf8);color:#fff;';
    dealerDrawBtn.onclick = hostDealerDraw;
    document.querySelector('.xd-actions').insertBefore(dealerDrawBtn, document.querySelector('.btn-leave-xd'));
  }
  if (!dealerStandBtn) {
    dealerStandBtn = document.createElement('button');
    dealerStandBtn.id = 'btn-dealer-stand';
    dealerStandBtn.className = 'btn-deal';
    dealerStandBtn.style.cssText = 'background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1f1f1f;';
    dealerStandBtn.onclick = hostDealerStand;
    document.querySelector('.xd-actions').insertBefore(dealerStandBtn, document.querySelector('.btn-leave-xd'));
  }
  if (isHost && gs.phase === 'dealer') {
    dealerDrawBtn.style.display = 'inline-block';
    dealerStandBtn.style.display = 'inline-block';
    const dScore = dealerStat ? dealerStat.score : 0;
    const dLen = dealerHand.length;
    const canStop = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
    dealerStandBtn.disabled = !canStop;
    dealerStandBtn.textContent = canStop ? `✋ Dừng & Xét (${dScore}đ)` : `⏳ Chưa đủ điểm (${dScore}đ)`;
    dealerDrawBtn.textContent = `🃏 Bốc thêm`;
  } else {
    dealerDrawBtn.style.display = 'none';
    dealerStandBtn.style.display = 'none';
  }

  // Auto-settle khi vào result
  if (gs.phase === 'result' && gs.round !== _settledRound) {
    _settledRound = gs.round;
    settleMyResult(r, gs);
  }
}
// ===== XÌ DÁCH MULTIPLAYER (LUẬT MỚI) - PHẦN 2/2 =====

/* ========== HÀNH ĐỘNG ========== */
window.placeBet = async function() {
  const amt = parseInt(document.getElementById('xd-bet-input').value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm', 'error'); return; }
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: _myBalance - amt });
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    if (window.VTQuests) window.VTQuests.trackPlay('xidach');
    showToast('✅ Đã đặt ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { console.error(e); showToast('Lỗi', 'error'); }
};

window.hostDeal = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
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
    'gameState.earlyRevealed': {},
    'gameState.earlyResults': {},
    'gameState.revealed': {},
    'gameState.dealerRevealedAll': false
  };

  if (dealerStat.tag === 'xi_bang' || dealerStat.tag === 'xi_dach') {
    updates['gameState.dealerRevealedAll'] = true;
    updates['gameState.phase'] = 'result';
    const results = {};
    players.forEach(uid => {
      const bet = gs.bets?.[uid] || 0;
      if (bet === 0) return;
      const playerHand = hands[uid];
      const playerStat = handStatus(playerHand);
      let outcome = 'lose', delta = -bet;
      if ((dealerStat.tag === 'xi_bang' && playerStat.tag === 'xi_bang') ||
          (dealerStat.tag === 'xi_dach' && playerStat.tag === 'xi_dach')) {
        outcome = 'draw';
        delta = 0;
      } else if (playerStat.tag === 'xi_bang' || playerStat.tag === 'xi_dach') {
        outcome = 'win';
        delta = bet;
      }
      results[uid] = { outcome, delta };
    });
    updates['gameState.results'] = results;
  }

  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

window.hit = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  const deck = [...(gs.deck || [])];
  const hand = [...(gs.hands?.[_user.uid] || [])];
  if (deck.length === 0) { showToast('Hết bài', 'warn'); return; }
  hand.push(deck.pop());
  const stat = handStatus(hand);
  const updates = { 'gameState.deck': deck, [`gameState.hands.${_user.uid}`]: hand };
  let advance = false;
  if (stat.tag === 'bust' || hand.length >= 5 || stat.score >= 21) {
    updates[`gameState.stands.${_user.uid}`] = true;
    advance = true;
  }
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  if (advance) await advanceTurn();
};

window.stand = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  const hand = gs.hands?.[_user.uid] || [];
  const score = bestScore(hand);
  if (score < 16 && hand.length < 5) { showToast('Phải đủ 16 điểm hoặc Ngũ Linh', 'warn'); return; }
  await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.stands.${_user.uid}`]: true });
  await advanceTurn();
};

async function advanceTurn() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  let idx = gs.turnIdx;
  while (idx < gs.turnOrder.length && gs.stands?.[gs.turnOrder[idx]]) idx++;
  if (idx >= gs.turnOrder.length) {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.turnIdx': idx, 'gameState.phase': 'dealer' });
  } else {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.turnIdx': idx });
  }
}

async function hostDealerDraw() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  let deck = [...(gs.deck || [])];
  let hand = [...(gs.hands?.[r.hostUid] || [])];
  if (deck.length === 0) { showToast('Hết bài', 'warn'); return; }
  hand.push(deck.pop());
  await updateDoc(doc(db, 'rooms', ROOM_ID), { 'gameState.deck': deck, [`gameState.hands.${r.hostUid}`]: hand });
}

async function hostDealerStand() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dLen = dealerHand.length;
  const dScore = bestScore(dealerHand);
  const canStop = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
  if (!canStop) { showToast('Chưa đủ điểm để xét bài!', 'warn'); return; }
  await finishDealer(r, dealerHand, gs.deck || []);
}

async function finishDealer(r, dealerHand, deck) {
  const players = (r.members || []).filter(u => u !== r.hostUid);
  const results = {};
  for (const uid of players) {
    const bet = r.gameState.bets?.[uid] || 0;
    if (bet === 0) continue;
    const playerHand = r.gameState.hands?.[uid] || [];
    const outcome = compareHands(playerHand, dealerHand, bet);
    results[uid] = outcome;
  }
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.deck': deck,
    [`gameState.hands.${r.hostUid}`]: dealerHand,
    'gameState.results': results
  });
}

function compareHands(playerHand, dealerHand, bet) {
  const pStat = handStatus(playerHand);
  const dStat = handStatus(dealerHand);
  let outcome = 'lose', delta = -bet;

  if (pStat.tag === 'bust') {
    if (dStat.tag === 'bust') { outcome = 'draw'; delta = 0; }
    else { outcome = 'lose'; delta = -bet; }
    return { outcome, delta };
  }
  if (dStat.tag === 'bust') { outcome = 'win'; delta = bet; return { outcome, delta }; }

  const pRank = getRank(pStat);
  const dRank = getRank(dStat);
  if (pRank > dRank) { outcome = 'win'; delta = bet; }
  else if (pRank < dRank) { outcome = 'lose'; delta = -bet; }
  else {
    if (pStat.tag === 'ngu_linh') {
      if (pStat.score < dStat.score) { outcome = 'win'; delta = bet; }
      else if (pStat.score > dStat.score) { outcome = 'lose'; delta = -bet; }
      else { outcome = 'draw'; delta = 0; }
    } else {
      if (pStat.score > dStat.score) { outcome = 'win'; delta = bet; }
      else if (pStat.score < dStat.score) { outcome = 'lose'; delta = -bet; }
      else { outcome = 'draw'; delta = 0; }
    }
  }
  return { outcome, delta };
}

function getRank(stat) {
  if (stat.tag === 'xi_bang') return 5;
  if (stat.tag === 'xi_dach') return 4;
  if (stat.tag === 'ngu_linh') return 3;
  return 1;
}

window.earlyRevealPlayer = async function(targetUid) {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'playing') return;
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dScore = bestScore(dealerHand);
  const dLen = dealerHand.length;
  const canReveal = (dLen === 2 && dScore >= 15) || (dLen >= 3 && dScore >= 16);
  if (!canReveal) { showToast('Chưa đủ điểm để khui', 'warn'); return; }
  const targetHand = gs.hands?.[targetUid] || [];
  const bet = gs.bets?.[targetUid] || 0;
  const outcome = compareHands(targetHand, dealerHand, bet);
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.earlyRevealed.${targetUid}`]: true,
    [`gameState.earlyResults.${targetUid}`]: outcome
  });
};

window.revealMyHand = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  const hand = gs.hands?.[_user.uid] || [];
  const stat = handStatus(hand);
  if (stat.tag !== 'xi_bang' && stat.tag !== 'xi_dach') return;
  await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.revealed.${_user.uid}`]: true });
};

async function settleMyResult(r, gs) {
  if (r.hostUid === _user.uid) {
    let dealerDelta = 0;
    for (const res of Object.values(gs.results || {})) dealerDelta -= res.delta;
    if (dealerDelta !== 0) {
      const us = await getDoc(doc(db, 'users', _user.uid));
      const cur = us.exists() ? (us.data().points || 0) : 0;
      await updateDoc(doc(db, 'users', _user.uid), { points: cur + dealerDelta });
      showToast(dealerDelta >= 0 ? `🎉 Nhà cái thu ${dealerDelta.toLocaleString('vi-VN')}đ` : `💸 Nhà cái lỗ ${(-dealerDelta).toLocaleString('vi-VN')}đ`, dealerDelta >= 0 ? 'success' : 'warn');
      if (window.VTQuests && dealerDelta > 0) window.VTQuests.trackEarn(dealerDelta);
    }
    return;
  }
  const res = gs.results?.[_user.uid];
  if (!res) return;
  const bet = gs.bets?.[_user.uid] || 0;
  const refund = bet + res.delta;
  if (refund > 0) {
    const us = await getDoc(doc(db, 'users', _user.uid));
    const cur = us.exists() ? (us.data().points || 0) : 0;
    await updateDoc(doc(db, 'users', _user.uid), { points: cur + refund });
  }
  if (res.outcome === 'win') {
    showToast(`🎉 Thắng +${res.delta.toLocaleString('vi-VN')}đ!`, 'success');
    if (window.VTQuests) { window.VTQuests.trackEarn(res.delta); window.VTQuests.trackWinSmart(); }
  } else if (res.outcome === 'lose') {
    showToast(`💸 Thua ${bet.toLocaleString('vi-VN')}đ`, 'warn');
  } else {
    showToast(`🤝 Hoà`, 'info');
  }
}

window.hostNextRound = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
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
    'gameState.earlyRevealed': {},
    'gameState.earlyResults': {},
    'gameState.revealed': {},
    'gameState.dealerRevealedAll': false,
    'gameState.round': (r.gameState.round || 1) + 1
  });
};

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
      if (r.hostUid === _user.uid) await deleteDoc(doc(db, 'rooms', ROOM_ID));
      else {
        const mi = r.memberInfo || {};
        delete mi[_user.uid];
        await updateDoc(doc(db, 'rooms', ROOM_ID), { members: arrayRemove(_user.uid), memberInfo: mi });
      }
    }
  } catch (e) {}
  location.href = 'rooms.html';
};

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }