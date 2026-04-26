// ===== XÌ DÁCH MULTIPLAYER (sử dụng cards.js) =====
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

// Hàm tính điểm dựa trên mảng card object (từ cards.js)
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
  while (aces > 0 && total + 10 <= 21) {
    total += 10;
    aces--;
  }
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
  else if (gs.phase === 'dealer') phEl.textContent = '🃏 Nhà cái mở bài...';
  else if (gs.phase === 'result') phEl.textContent = `📢 Vòng ${gs.round} — Kết quả`;

  // Bet row
  const myBet = gs.bets?.[_user.uid] || 0;
  if (gs.phase === 'betting' && !isHost) {
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else betRow.style.display = 'none';

  // Sắp xếp ghế
  const dealerUid = r.hostUid;
  const otherPlayers = (r.members || []).filter(uid => uid !== dealerUid && uid !== _user.uid);
  const seatsOrder = [dealerUid, ...otherPlayers, _user.uid];

  const tEl = document.getElementById('xd-table');
  tEl.innerHTML = '';

  for (const uid of seatsOrder) {
    const isDealer = (uid === dealerUid);
    const isMe = (uid === _user.uid);
    const hand = gs.hands?.[uid] || [];
    const standed = !!gs.stand?.[uid];
    const myBetAmt = gs.bets?.[uid] || 0;
    const stat = hand.length ? status(hand) : null;
    const isTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === uid;

    // Xác định bài hiển thị (che bài người khác)
    let visibleCards = [];
    if (isMe) {
      visibleCards = hand;
    } else if (isDealer) {
      if (gs.phase === 'playing') {
        visibleCards = hand.length ? [hand[0]] : [];
      } else {
        visibleCards = hand;
      }
    } else {
      if (gs.phase === 'result' || gs.phase === 'dealer') {
        visibleCards = hand;
      } else {
        visibleCards = [];
      }
    }

    // Tạo HTML bài
    let cardsHtml = '';
    if (!hand.length) {
      cardsHtml = '<div style="color:#64748b;font-size:12px;padding:18px 0">Chưa có bài</div>';
    } else if (visibleCards.length === hand.length) {
      cardsHtml = visibleCards.map(c => renderCardUI(c, false)).join('');
    } else {
      // Hiện mặt sau cho những lá bị che
      let backHtml = '';
      for (let i = 0; i < hand.length; i++) {
        if (i < visibleCards.length) {
          cardsHtml += renderCardUI(hand[i], false);
        } else {
          cardsHtml += renderCardUI(null, true); // mặt sau
        }
      }
    }

    // Class và tag
    let cls = 'xd-seat';
    if (isTurn) cls += ' turn';
    if (gs.phase === 'result' && gs.results?.[uid]) {
      const res = gs.results[uid];
      if (res.outcome === 'win') cls += ' win';
      else if (res.outcome === 'lose') cls += ' lose';
    }
    if (isMe) cls += ' me';
    if (isDealer) cls += ' dealer';

    let tagHtml = '';
    if (stat && (isMe || gs.phase !== 'playing')) {
      if (stat.tag === 'bust') tagHtml += '<span class="xd-seat-tag xd-tag-bust">Quắc</span>';
      else if (stat.tag === 'blackjack') tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì dách</span>';
      else if (standed && !isDealer) tagHtml += '<span class="xd-seat-tag xd-tag-stand">✋ Dằn</span>';
    }
    if (gs.phase === 'result' && gs.results?.[uid] && !isDealer) {
      const res = gs.results[uid];
      if (res.outcome === 'win') tagHtml += `<span class="xd-seat-tag" style="background:rgba(52,211,153,.2);color:#34d399">+${res.delta}đ</span>`;
      else if (res.outcome === 'lose') tagHtml += `<span class="xd-seat-tag xd-tag-bust">${res.delta}đ</span>`;
      else tagHtml += `<span class="xd-seat-tag xd-tag-stand">Hoà</span>`;
    }

    // Tên hiển thị (Nhà cái không có badge thừa)
    let nameHtml = '';
    if (isDealer) {
      nameHtml = `<span class="xd-seat-name">👑 Nhà Cái</span>`;
    } else {
      nameHtml = `<span class="xd-seat-name">${esc(r.memberInfo?.[uid]?.name || '?')} ${isMe ? '<span style="color:#fbbf24">(bạn)</span>' : ''}</span>`;
    }

    // Điểm số
    let scoreText = '';
    if (isDealer) {
      if (gs.phase !== 'playing' && stat) scoreText = stat.score;
      else if (gs.phase === 'playing' && visibleCards.length) scoreText = '?';
    } else {
      if (stat && (isMe || gs.phase !== 'playing')) scoreText = stat.score;
    }

    tEl.innerHTML += `
      <div class="${cls}">
        <div class="xd-seat-head">
          ${nameHtml}
          <div>${tagHtml}</div>
        </div>
        <div class="xd-cards">
          ${cardsHtml}
        </div>
        <div class="xd-seat-meta">
          <span class="xd-score">${scoreText}</span>
          ${myBetAmt > 0 ? `<span class="xd-bet">Cược: ${myBetAmt.toLocaleString('vi-VN')}đ</span>` : (isDealer ? '' : '<span class="xd-bet" style="color:#64748b">chưa đặt</span>')}
        </div>
      </div>
    `;
  }

  // Nút điều khiển
  const myTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === _user.uid;
  btnHit.style.display = myTurn ? 'inline-block' : 'none';
  btnStand.style.display = myTurn ? 'inline-block' : 'none';
  const allBetIn = (r.members || []).filter(u => u !== r.hostUid).every(u => (gs.bets?.[u] || 0) > 0);
  const anyBet = Object.values(gs.bets || {}).some(v => v > 0);
  btnDeal.style.display = (isHost && gs.phase === 'betting' && anyBet) ? 'inline-block' : 'none';
  btnDeal.disabled = !allBetIn;
  btnDeal.textContent = allBetIn ? '🃏 Chia bài' : '⏳ Chờ tất cả đặt cược';
  btnNext.style.display = (isHost && gs.phase === 'result') ? 'inline-block' : 'none';

  // Auto-settle
  if (gs.phase === 'result' && gs.round !== _settledRound) {
    _settledRound = gs.round;
    settleMyResult(r, gs);
  }
}

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

// Chia bài (host)
window.hostDeal = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState || {};
  const players = (r.members || []).filter(u => u !== r.hostUid && (gs.bets?.[u] || 0) > 0);
  if (players.length === 0) { showToast('Chưa ai cược','warn'); return; }
  
  const deck = createDeck(); // tạo bộ bài 52 lá trộn
  const hands = {};
  // Mỗi người 2 lá, nhà cái 2 lá
  hands[r.hostUid] = [deck.pop(), deck.pop()];
  players.forEach(uid => { hands[uid] = [deck.pop(), deck.pop()]; });
  
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.deck': deck,
    'gameState.hands': hands,
    'gameState.stand': {},
    'gameState.turnOrder': players,
    'gameState.turnIdx': 0,
    'gameState.results': {}
  });
};

// Rút bài
window.hit = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.turnOrder?.[gs.turnIdx] !== _user.uid) return;
  const deck = [...(gs.deck || [])];
  const hand = [...(gs.hands?.[_user.uid] || [])];
  if (deck.length === 0) { showToast('Hết bài!','warn'); return; }
  hand.push(deck.pop());
  const stat = status(hand);
  const updates = {
    'gameState.deck': deck,
    [`gameState.hands.${_user.uid}`]: hand
  };
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

// Chuyển lượt hoặc kết thúc vòng chơi
async function advanceTurnIfNeeded() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  let idx = gs.turnIdx;
  // Tìm người tiếp theo chưa stand
  while (idx < gs.turnOrder.length && gs.stand?.[gs.turnOrder[idx]]) idx++;
  if (idx >= gs.turnOrder.length) {
    // Tất cả đã dằn -> chuyển sang dealer
    if (r.hostUid === _user.uid) {
      await dealerPlay(r);
    } else {
      await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx, 'gameState.phase': 'dealer' });
    }
  } else {
    await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx });
  }
}

// Nhà cái tự động rút bài (đã sửa lỗi)
async function dealerPlay(r) {
  let deck = [...(r.gameState.deck || [])];
  let hand = [...(r.gameState.hands?.[r.hostUid] || [])];
  // Nhà cái rút cho đến khi đủ 17 điểm hoặc quá 5 lá
  while (bestScore(hand) < 17 && hand.length < 5 && deck.length > 0) {
    hand.push(deck.pop());
  }
  const dealerStat = status(hand);
  const results = {};
  (r.members || []).forEach(uid => {
    if (uid === r.hostUid) return;
    const bet = r.gameState.bets?.[uid] || 0;
    if (bet === 0) return;
    const playerHand = r.gameState.hands?.[uid] || [];
    const playerStat = status(playerHand);
    let outcome = 'lose';
    let delta = -bet;
    if (playerStat.tag === 'bust') {
      outcome = 'lose'; delta = -bet;
    } else if (dealerStat.tag === 'bust') {
      outcome = 'win'; delta = bet;
    } else if (playerStat.tag === 'blackjack' && dealerStat.tag !== 'blackjack') {
      outcome = 'win'; delta = Math.floor(bet * 1.5);
    } else if (playerStat.score > dealerStat.score) {
      outcome = 'win'; delta = bet;
    } else if (playerStat.score === dealerStat.score) {
      outcome = 'draw'; delta = 0;
    }
    results[uid] = { outcome, delta };
  });
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.deck': deck,
    [`gameState.hands.${r.hostUid}`]: hand,
    'gameState.results': results
  });
}

// Xử lý kết quả cho người chơi (cộng trừ điểm)
async function settleMyResult(r, gs) {
  if (r.hostUid === _user.uid) {
    // Nhà cái: tổng lỗ/lãi
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
  // Người chơi
  const bet = gs.bets?.[_user.uid] || 0;
  const res = gs.results?.[_user.uid];
  if (!res) return;
  const refund = bet + res.delta; // thắng: bet+delta (delta=bet), thua: delta=-bet -> refund=0, hoà refund=bet
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

// Vòng mới
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