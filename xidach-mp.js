// ===== XÌ DÁCH MULTIPLAYER (sử dụng cards.js) - Phần 1/2 =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from './cards.js';

const firebaseConfig = { apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY", authDomain:"lienquan-fake.firebaseapp.com", projectId:"lienquan-fake", storageBucket:"lienquan-fake.firebasestorage.app", messagingSenderId:"782694799992", appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d" };
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app); const auth = getAuth(app);

const ROOM_ID = new URLSearchParams(location.search).get('room');

let _user = null, _unsub = null, _unsubMe = null;
let _myBalance = 0;
let _settledRound = -1;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

onAuthStateChanged(auth, async (u) => {
  if (!u){ location.href='index.html'; return; }
  _user = u;
  _unsubMe = onSnapshot(doc(db,'users',_user.uid), (s) => {
    if (s.exists()) { _myBalance = s.data().points||0; document.getElementById('xd-balance').textContent = _myBalance.toLocaleString('vi-VN') + ' đ'; }
  });
  if (ROOM_ID) start();
});

function cardValue(card) {
  const v = card.v;
  if (v === 'A') return 1;
  if (['J','Q','K'].includes(v)) return 10;
  return parseInt(v);
}

function bestScore(cards) {
  let total = 0; let aces = 0;
  for (const c of cards) {
    const val = cardValue(c);
    total += val;
    if (c.v === 'A') aces++;
  }
  while (aces > 0 && total + 10 <= 21) { total += 10; aces--; }
  return total;
}

function status(cards) {
  const score = bestScore(cards);
  if (score > 21) return { score, tag: 'bust' };
  if (score === 21 && cards.length === 2) return { score: 21, tag: 'blackjack' };
  return { score, tag: 'ok' };
}

function start(){
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db,'rooms',ROOM_ID), (snap) => {
    if (!snap.exists()){ document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>'; return; }
    const r = snap.data();
    document.getElementById('xd-room').textContent = '#' + (r.code||'------');
    if (r.gameType !== 'xidach') return;
    if (!r.gameState) return;
    render(r);
  });
}

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

  // Phase label
  if (gs.phase === 'betting') phEl.textContent = `🎰 Vòng ${gs.round} — Đặt cược (Nhà cái sẽ chia bài khi mọi người sẵn sàng)`;
  else if (gs.phase === 'playing') {
    const turnUid = gs.turnOrder?.[gs.turnIdx];
    if (turnUid === _user.uid) phEl.textContent = '🎯 Đến lượt BẠN — Rút thêm hay Dằn?';
    else if (turnUid) phEl.textContent = `⏳ Đang chờ ${esc(r.memberInfo?.[turnUid]?.name || 'người chơi')}...`;
    else phEl.textContent = '🃏 Nhà cái lật bài...';
  }
  else if (gs.phase === 'dealer') phEl.textContent = '🃏 Nhà cái đang bốc bài...';
  else if (gs.phase === 'result') phEl.textContent = `📢 Vòng ${gs.round} — Kết quả`;

  // Bet row — chỉ hiện cho người chơi chưa đặt
  const myBet = gs.bets?.[_user.uid] || 0;
  if (gs.phase === 'betting' && !isHost) {
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else betRow.style.display = 'none';

  // Thứ tự ghế
  const otherPlayers = (r.members || []).filter(uid => uid !== dealerUid && uid !== _user.uid);
  let seatsOrder;
  if (isHost) {
    seatsOrder = [...otherPlayers, dealerUid]; // nhà cái xuống dưới cùng
  } else {
    seatsOrder = [dealerUid, ...otherPlayers, _user.uid];
  }

  const tEl = document.getElementById('xd-table');
  tEl.innerHTML = '';

  // Thông tin nhà cái
  const dealerHand = gs.hands?.[dealerUid] || [];
  const dealerStat = dealerHand.length ? status(dealerHand) : null;
  const canEarlyReveal = dealerStat && isHost && gs.phase === 'playing' && (
    (dealerHand.length === 2 && dealerStat.score >= 15) ||
    (dealerHand.length >= 3 && dealerStat.score >= 16)
  );
  const dealerIsSpecial = dealerStat && (dealerStat.tag === 'blackjack' || dealerStat.score === 21);
  const dealerRevealedAll = !!(gs.dealerRevealedAll);

  for (const uid of seatsOrder) {
    const isDealer = (uid === dealerUid);
    const isMe = (uid === _user.uid);
    const hand = gs.hands?.[uid] || [];
    const standed = !!gs.stand?.[uid];
    const myBetAmt = gs.bets?.[uid] || 0;
    const stat = hand.length ? status(hand) : null;
    const isTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === uid;
    const isEarlyRevealed = !!(gs.earlyRevealed?.[uid]);
    const isSelfRevealed = !!(gs.revealed?.[uid]);

    // Số lá được nhìn thấy (úp bài khi không đủ điều kiện)
    let visibleCount = 0;
    if (isMe) {
      visibleCount = hand.length; // Người chơi luôn thấy bài mình
    } else if (isDealer) {
      // Nhà cái: mở hết nếu dealerRevealedAll, hoặc phase dealer/result
      visibleCount = (dealerRevealedAll || gs.phase === 'dealer' || gs.phase === 'result') ? hand.length : 0;
    } else {
      // Người chơi khác: mở khi result/dealer, hoặc bị khui, hoặc tự mở, hoặc nhà cái mở tất cả
      visibleCount = (gs.phase === 'result' || gs.phase === 'dealer' || isEarlyRevealed || isSelfRevealed || dealerRevealedAll)
        ? hand.length : 0;
    }

    // Render bài
    let cardsHtml = '';
    if (!hand.length) {
      cardsHtml = '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>';
    } else {
      for (let i = 0; i < hand.length; i++) {
        cardsHtml += renderCardUI(i < visibleCount ? hand[i] : null, i >= visibleCount);
      }
    }

    // CSS class
    let cls = 'xd-seat';
    if (isTurn) cls += ' turn';
    if (gs.phase === 'result' && gs.results?.[uid]) {
      const res = gs.results[uid];
      if (res.outcome === 'win') cls += ' win';
      else if (res.outcome === 'lose') cls += ' lose';
    }
    if (isMe || (isHost && isDealer)) cls += ' me';
    if (isDealer) cls += ' dealer';

    // Tags
    let tagHtml = '';
    const showStat = isMe || gs.phase === 'result' || gs.phase === 'dealer' || isEarlyRevealed || isSelfRevealed || dealerRevealedAll || (isDealer && dealerRevealedAll);
    if (stat && showStat) {
      if (stat.tag === 'bust') tagHtml += '<span class="xd-seat-tag xd-tag-bust">Quắc</span>';
      else if (stat.tag === 'blackjack') tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì dách ♠️</span>';
      else if (stat.score === 21) tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì bàn 21</span>';
      else if (standed && !isDealer) tagHtml += '<span class="xd-seat-tag xd-tag-stand">✋ Dằn</span>';
    }
    if (gs.phase === 'result' && gs.results?.[uid] && !isDealer) {
      const res = gs.results[uid];
      if (res.outcome === 'win') tagHtml += `<span class="xd-seat-tag" style="background:rgba(52,211,153,.2);color:#34d399">+${res.delta}đ</span>`;
      else if (res.outcome === 'lose') tagHtml += `<span class="xd-seat-tag xd-tag-bust">${res.delta}đ</span>`;
      else tagHtml += `<span class="xd-seat-tag xd-tag-stand">Hoà</span>`;
    }

    // Tên
    let nameHtml = isDealer
      ? `<span class="xd-seat-name">👑 Nhà Cái${isHost ? ' <span style="color:#fbbf24;font-size:12px">(bạn)</span>' : ''}</span>`
      : `<span class="xd-seat-name">${esc(r.memberInfo?.[uid]?.name || '?')}${isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}</span>`;

    // Điểm
    let scoreText = '';
    if (isDealer) {
      if ((dealerRevealedAll || gs.phase === 'dealer' || gs.phase === 'result') && stat) scoreText = stat.score;
      else scoreText = '?';
    } else {
      if (stat && (isMe || gs.phase === 'result' || gs.phase === 'dealer' || isEarlyRevealed || isSelfRevealed || dealerRevealedAll)) scoreText = stat.score;
    }

    // Nút mở bài cho người chơi (xì dách/xì bàn)
    let openBtnHtml = '';
    if (!isDealer && isMe && stat && (stat.tag === 'blackjack' || stat.score === 21) && gs.phase === 'playing' && !isSelfRevealed) {
      openBtnHtml = `<button onclick="revealMyHand()" class="xd-open-btn">🎉 Mở bài</button>`;
    }

    // Nút khui sớm (host, từng người)
    let earlyRevealBtn = '';
    if (isHost && canEarlyReveal && !isDealer && !isEarlyRevealed) {
      earlyRevealBtn = `<button onclick="earlyRevealPlayer('${uid}')" class="xd-early-btn">⚡ Khui bài</button>`;
    }

    tEl.innerHTML += `
      <div class="${cls}">
        <div class="xd-seat-head">
          ${nameHtml}
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${tagHtml}</div>
        </div>
        <div class="xd-cards">${cardsHtml}</div>
        <div class="xd-seat-meta">
          <span class="xd-score">${scoreText}</span>
          ${myBetAmt > 0 ? `<span class="xd-bet">Cược: ${myBetAmt.toLocaleString('vi-VN')}đ</span>` : (isDealer ? '' : '<span class="xd-bet" style="color:#64748b">chưa đặt</span>')}
        </div>
        ${openBtnHtml}${earlyRevealBtn}
      </div>
    `;
  }

  // Nút điều khiển người chơi
  const myTurn = !isHost && gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === _user.uid;
  btnHit.style.display = myTurn ? 'inline-block' : 'none';
  btnStand.style.display = myTurn ? 'inline-block' : 'none';

  // Nút Chia bài
  const allBetIn = (r.members || []).filter(u => u !== r.hostUid).every(u => (gs.bets?.[u] || 0) > 0);
  const anyBet = Object.values(gs.bets || {}).some(v => v > 0);
  btnDeal.style.display = (isHost && gs.phase === 'betting' && anyBet) ? 'inline-block' : 'none';
  btnDeal.disabled = !allBetIn;
  btnDeal.textContent = allBetIn ? '🃏 Chia bài' : '⏳ Chờ tất cả đặt cược';

  // Nút vòng mới
  btnNext.style.display = (isHost && gs.phase === 'result') ? 'inline-block' : 'none';

  // Nút bốc bài và Dừng cho nhà cái
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
    dealerDrawBtn.textContent = `🃏 Bốc bài (${dScore}đ)`;
    dealerStandBtn.textContent = `✋ Dừng (${dScore}đ)`;
  } else {
    dealerDrawBtn.style.display = 'none';
    dealerStandBtn.style.display = 'none';
  }

  // Auto-settle
  if (gs.phase === 'result' && gs.round !== _settledRound) {
    _settledRound = gs.round;
    settleMyResult(r, gs);
  }
}
// ===== XÌ DÁCH MULTIPLAYER (sử dụng cards.js) - Phần 2/2 =====

// Đặt cược
window.placeBet = async function() {
  const amt = parseInt(document.getElementById('xd-bet-input').value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50','warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm','error'); return; }
  try {
    await updateDoc(doc(db,'users',_user.uid), { points: _myBalance - amt });
    await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    if (window.VTQuests) window.VTQuests.trackPlay('xidach');
    showToast('✅ Đã đặt cược ' + amt.toLocaleString('vi-VN') + 'đ','success');
  } catch(e){ console.error(e); showToast('Lỗi đặt cược','error'); }
};

// Chia bài (host) - Tự động mở bài nếu nhà cái xì dách/xì bàn
window.hostDeal = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  const players = (r.members || []).filter(u => u !== r.hostUid && (gs.bets?.[u] || 0) > 0);
  if (players.length === 0) { showToast('Chưa ai cược','warn'); return; }
  const deck = createDeck();
  const hands = {};
  hands[r.hostUid] = [deck.pop(), deck.pop()]; // nhà cái 2 lá
  players.forEach(uid => { hands[uid] = [deck.pop(), deck.pop()]; });

  const dealerStat = status(hands[r.hostUid]);
  const updates = {
    'gameState.phase': 'playing',
    'gameState.deck': deck,
    'gameState.hands': hands,
    'gameState.stand': {},
    'gameState.turnOrder': players,
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.earlyRevealed': {},
    'gameState.earlyResults': {},
    'gameState.revealed': {},
    'gameState.dealerRevealedAll': false
  };

  // Nếu nhà cái xì dách/xì bàn -> tự động mở bài và chuyển sang kết quả
  if (dealerStat.tag === 'blackjack' || dealerStat.score === 21) {
    updates['gameState.dealerRevealedAll'] = true;
    updates['gameState.phase'] = 'result';
    // Tính kết quả luôn
    const results = {};
    players.forEach(uid => {
      const bet = gs.bets?.[uid] || 0;
      if (bet === 0) return;
      const playerHand = hands[uid];
      const playerStat = status(playerHand);
      let outcome = 'lose', delta = -bet;
      if (playerStat.tag === 'blackjack' || playerStat.score === 21) {
        outcome = 'draw';
        delta = 0;
      }
      results[uid] = { outcome, delta };
    });
    updates['gameState.results'] = results;
  }

  await updateDoc(doc(db,'rooms',ROOM_ID), updates);
};

// Rút bài (người chơi)
window.hit = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (isHost) return; // Host không dùng nút này
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  const deck = [...(gs.deck || [])];
  const hand = [...(gs.hands?.[_user.uid] || [])];
  if (deck.length === 0) { showToast('Hết bài!','warn'); return; }
  hand.push(deck.pop());
  const stat = status(hand);
  const updates = { 'gameState.deck': deck, [`gameState.hands.${_user.uid}`]: hand };
  let advance = false;
  if (stat.tag === 'bust' || hand.length >= 5 || stat.score === 21) {
    updates[`gameState.stand.${_user.uid}`] = true;
    advance = true;
  }
  await updateDoc(doc(db,'rooms',ROOM_ID), updates);
  if (advance) await advanceTurnIfNeeded();
};

// Dằn bài
window.stand = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.stand.${_user.uid}`]: true });
  await advanceTurnIfNeeded();
};

// Chuyển lượt
async function advanceTurnIfNeeded() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  let idx = gs.turnIdx;
  while (idx < gs.turnOrder.length && gs.stand?.[gs.turnOrder[idx]]) idx++;
  if (idx >= gs.turnOrder.length) {
    await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx, 'gameState.phase': 'dealer' });
  } else {
    await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx });
  }
}

// Nhà cái bốc bài (không giới hạn 17)
async function hostDealerDraw() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  let deck = [...(gs.deck || [])];
  let hand = [...(gs.hands?.[r.hostUid] || [])];
  if (deck.length === 0) { showToast('Hết bài!','warn'); return; }
  hand.push(deck.pop());
  await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.deck': deck, [`gameState.hands.${r.hostUid}`]: hand });
}

// Nhà cái dừng bốc -> chuyển sang kết quả
async function hostDealerStand() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'dealer') return;
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const deck = gs.deck || [];
  await finishDealerAndSettle(r, dealerHand, deck);
}

// Tính kết quả và lưu
async function finishDealerAndSettle(r, dealerHand, deck) {
  const dealerStat = status(dealerHand);
  const results = {};
  (r.members || []).forEach(uid => {
    if (uid === r.hostUid) return;
    const bet = r.gameState.bets?.[uid] || 0;
    if (bet === 0) return;
    const playerHand = r.gameState.hands?.[uid] || [];
    const playerStat = status(playerHand);
    let outcome = 'lose', delta = -bet;
    if (playerStat.tag === 'bust') { outcome = 'lose'; delta = -bet; }
    else if (dealerStat.tag === 'bust') { outcome = 'win'; delta = bet; }
    else if (playerStat.tag === 'blackjack' && dealerStat.tag !== 'blackjack') { outcome = 'win'; delta = Math.floor(bet * 1.5); }
    else if (playerStat.score > dealerStat.score) { outcome = 'win'; delta = bet; }
    else if (playerStat.score === dealerStat.score) { outcome = 'draw'; delta = 0; }
    results[uid] = { outcome, delta };
  });
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.deck': deck,
    [`gameState.hands.${r.hostUid}`]: dealerHand,
    'gameState.results': results
  });
}

// Khui sớm từng người (nhà cái mạnh)
window.earlyRevealPlayer = async function(targetUid) {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid || gs.phase !== 'playing') return;
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dealerScore = bestScore(dealerHand);
  const canReveal = (dealerHand.length === 2 && dealerScore >= 15) || (dealerHand.length >= 3 && dealerScore >= 16);
  if (!canReveal) { showToast('Chưa đủ điểm để khui','warn'); return; }
  const targetHand = gs.hands?.[targetUid] || [];
  const targetStat = status(targetHand);
  const dealerStat = status(dealerHand);
  const bet = gs.bets?.[targetUid] || 0;
  let outcome = 'lose', delta = -bet;
  if (targetStat.tag === 'bust') { outcome = 'lose'; delta = -bet; }
  else if (dealerStat.tag === 'bust') { outcome = 'win'; delta = bet; }
  else if (targetStat.tag === 'blackjack' && dealerStat.tag !== 'blackjack') { outcome = 'win'; delta = Math.floor(bet * 1.5); }
  else if (targetStat.score > dealerScore) { outcome = 'win'; delta = bet; }
  else if (targetStat.score === dealerScore) { outcome = 'draw'; delta = 0; }
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    [`gameState.earlyRevealed.${targetUid}`]: true,
    [`gameState.earlyResults.${targetUid}`]: { outcome, delta }
  });
  showToast(`⚡ Đã khui bài ${esc(r.memberInfo?.[targetUid]?.name || '?')}`, 'info');
};

// Người chơi tự mở bài (xì dách/xì bàn)
window.revealMyHand = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  const hand = gs.hands?.[_user.uid] || [];
  const stat = status(hand);
  if (stat.tag !== 'blackjack' && stat.score !== 21) return;
  await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.revealed.${_user.uid}`]: true });
  showToast('🎉 Đã mở bài cho mọi người xem!', 'success');
};

// Settle kết quả
async function settleMyResult(r, gs) {
  if (r.hostUid === _user.uid) {
    let dealerDelta = 0;
    Object.values(gs.results || {}).forEach(res => { dealerDelta -= res.delta; });
    if (dealerDelta !== 0) {
      try {
        const us = await getDoc(doc(db,'users',_user.uid));
        const cur = us.exists() ? (us.data().points || 0) : 0;
        await updateDoc(doc(db,'users',_user.uid), { points: cur + dealerDelta });
        showToast(dealerDelta >= 0 ? `🎉 Nhà cái thu ${dealerDelta.toLocaleString('vi-VN')}đ` : `💸 Nhà cái lỗ ${(-dealerDelta).toLocaleString('vi-VN')}đ`, dealerDelta >= 0 ? 'success' : 'warn');
        if (window.VTQuests && dealerDelta > 0) window.VTQuests.trackEarn(dealerDelta);
      } catch(e) { console.error(e); }
    }
    return;
  }
  const bet = gs.bets?.[_user.uid] || 0;
  const res = gs.results?.[_user.uid];
  if (!res) return;
  const refund = bet + res.delta;
  if (refund > 0) {
    try {
      const us = await getDoc(doc(db,'users',_user.uid));
      const cur = us.exists() ? (us.data().points || 0) : 0;
      await updateDoc(doc(db,'users',_user.uid), { points: cur + refund });
    } catch(e) { console.error(e); }
  }
  if (res.outcome === 'win') {
    showToast(`🎉 Thắng +${res.delta.toLocaleString('vi-VN')}đ!`, 'success');
    if (window.VTQuests) { window.VTQuests.trackEarn(res.delta); window.VTQuests.trackWinSmart(); }
  } else if (res.outcome === 'lose') {
    showToast(`💸 Thua ${bet.toLocaleString('vi-VN')}đ`, 'warn');
  } else {
    showToast(`🤝 Hoà — hoàn ${bet.toLocaleString('vi-VN')}đ`, 'info');
  }
}

// Vòng mới — reset toàn bộ để nút Chia bài xuất hiện lại
window.hostNextRound = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.hands': {},
    'gameState.bets': {},
    'gameState.stand': {},
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

// Rời phòng
window.quitGame = async function() {
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (snap.exists()) {
      const r = snap.data();
      if (r.gameState?.phase === 'betting') {
        const myBet = r.gameState.bets?.[_user.uid] || 0;
        if (myBet > 0) {
          const us = await getDoc(doc(db,'users',_user.uid));
          const cur = us.exists() ? (us.data().points || 0) : 0;
          await updateDoc(doc(db,'users',_user.uid), { points: cur + myBet });
        }
      }
      if (r.hostUid === _user.uid) await deleteDoc(doc(db,'rooms',ROOM_ID));
      else {
        const mi = r.memberInfo || {};
        delete mi[_user.uid];
        await updateDoc(doc(db,'rooms',ROOM_ID), { members: arrayRemove(_user.uid), memberInfo: mi });
      }
    }
  } catch(e) {}
  location.href = 'rooms.html';
};

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }