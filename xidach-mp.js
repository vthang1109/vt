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
  else if (gs.phase === 'dealer') phEl.textContent = '🃏 Nhà cái mở bài...';
  else if (gs.phase === 'result') phEl.textContent = `📢 Vòng ${gs.round} — Kết quả`;
  else if (gs.phase === 'early_reveal') phEl.textContent = '⚡ Nhà cái mạnh — đang khui bài!';

  // Bet row (người chơi, không phải nhà cái)
  const myBet = gs.bets?.[_user.uid] || 0;
  if (gs.phase === 'betting' && !isHost) {
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else betRow.style.display = 'none';

  // Sắp xếp ghế: nhà cái trên cùng, bản thân dưới cùng
  // FIX: Loại trừ nhà cái khỏi otherPlayers, tránh hiển thị 2 lần
  const otherPlayers = (r.members || []).filter(uid => uid !== dealerUid && uid !== _user.uid);
  // Nếu user là nhà cái thì seatsOrder = [dealer] + others, không có _user.uid thêm lần nữa
  let seatsOrder;
  if (isHost) {
    seatsOrder = [dealerUid, ...otherPlayers];
  } else {
    seatsOrder = [dealerUid, ...otherPlayers, _user.uid];
  }

  const tEl = document.getElementById('xd-table');
  tEl.innerHTML = '';

  // Kiểm tra nhà cái có đủ điểm để khui sớm không
  const dealerHand = gs.hands?.[dealerUid] || [];
  const dealerStat = dealerHand.length ? status(dealerHand) : null;
  const canEarlyReveal = dealerStat && isHost && gs.phase === 'playing' && (
    (dealerHand.length === 2 && dealerStat.score >= 15) ||
    (dealerHand.length === 3 && dealerStat.score >= 16)
  );

  for (const uid of seatsOrder) {
    const isDealer = (uid === dealerUid);
    const isMe = (uid === _user.uid);
    const hand = gs.hands?.[uid] || [];
    const standed = !!gs.stand?.[uid];
    const myBetAmt = gs.bets?.[uid] || 0;
    const stat = hand.length ? status(hand) : null;
    const isTurn = gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === uid;

    // Kiểm tra bài có bị khui sớm không
    const isEarlyRevealed = !!(gs.earlyRevealed?.[uid]);

    // Xác định bài hiển thị (che bài người khác)
    let visibleCards = [];
    if (isMe) {
      // Người chơi luôn thấy bài của mình
      visibleCards = hand;
    } else if (isDealer) {
      // FIX: Nhà cái úp hết khi phase=playing, chỉ mở khi dealer/result/early_reveal
      if (gs.phase === 'playing' || gs.phase === 'betting') {
        visibleCards = []; // úp hết
      } else {
        visibleCards = hand; // mở hết
      }
    } else {
      // Người chơi khác
      if (gs.phase === 'result' || gs.phase === 'dealer' || gs.phase === 'early_reveal' || isEarlyRevealed) {
        visibleCards = hand;
      } else if (isMe) {
        visibleCards = hand;
      } else {
        visibleCards = []; // úp hết
      }
    }

    // Tạo HTML bài
    let cardsHtml = '';
    if (!hand.length) {
      cardsHtml = '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>';
    } else {
      // FIX: Sửa lại logic render bài - không bị lỗi biến backHtml
      for (let i = 0; i < hand.length; i++) {
        if (i < visibleCards.length) {
          cardsHtml += renderCardUI(hand[i], false); // mặt ngửa
        } else {
          cardsHtml += renderCardUI(null, true); // mặt úp
        }
      }
    }

    // Class và tag
    let cls = 'xd-seat';
    if (isTurn) cls += ' turn';
    if ((gs.phase === 'result' || gs.phase === 'early_reveal') && gs.results?.[uid]) {
      const res = gs.results[uid];
      if (res.outcome === 'win') cls += ' win';
      else if (res.outcome === 'lose') cls += ' lose';
    }
    if (isMe) cls += ' me';
    if (isDealer) cls += ' dealer';

    // Tag hiển thị trạng thái
    let tagHtml = '';
    // FIX: Bài quắc vẫn úp, chỉ hiện tag cho chính mình
    const showStat = isMe || gs.phase === 'result' || gs.phase === 'dealer' || gs.phase === 'early_reveal' || isEarlyRevealed || isDealer;
    if (stat && showStat) {
      if (stat.tag === 'bust') {
        // FIX: Người chơi quắc vẫn úp bài, nhưng hiện tag Quắc cho chính mình
        if (isMe) tagHtml += '<span class="xd-seat-tag xd-tag-bust">Quắc</span>';
        else if (gs.phase === 'result' || gs.phase === 'early_reveal' || isEarlyRevealed) tagHtml += '<span class="xd-seat-tag xd-tag-bust">Quắc</span>';
      } else if (stat.tag === 'blackjack') {
        tagHtml += '<span class="xd-seat-tag xd-tag-blackjack">Xì dách</span>';
      } else if (standed && !isDealer && (isMe || gs.phase !== 'playing')) {
        tagHtml += '<span class="xd-seat-tag xd-tag-stand">✋ Dằn</span>';
      }
    }

    // Tag kết quả thắng/thua (chỉ hiển thị cho người có liên quan hoặc ở result)
    const showResult = gs.phase === 'result' || (gs.phase === 'early_reveal' && isEarlyRevealed);
    if (showResult && gs.results?.[uid] && !isDealer) {
      const res = gs.results[uid];
      if (res.outcome === 'win') tagHtml += `<span class="xd-seat-tag" style="background:rgba(52,211,153,.2);color:#34d399">+${res.delta}đ</span>`;
      else if (res.outcome === 'lose') tagHtml += `<span class="xd-seat-tag xd-tag-bust">${res.delta}đ</span>`;
      else tagHtml += `<span class="xd-seat-tag xd-tag-stand">Hoà</span>`;
    }

    // Tên hiển thị
    let nameHtml = '';
    if (isDealer) {
      nameHtml = `<span class="xd-seat-name">👑 Nhà Cái</span>`;
    } else {
      nameHtml = `<span class="xd-seat-name">${esc(r.memberInfo?.[uid]?.name || '?')}${isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}</span>`;
    }

    // Điểm số - chỉ hiện cho mình hoặc khi mở bài
    let scoreText = '';
    if (isDealer) {
      if (gs.phase !== 'playing' && gs.phase !== 'betting' && stat) scoreText = stat.score;
      else if (gs.phase === 'playing') scoreText = '?';
    } else {
      if (stat && (isMe || showResult || isEarlyRevealed)) scoreText = stat.score;
    }

    // Nút Mở bài khi người chơi xì dách / xì bàn (score 21)
    let openBtnHtml = '';
    if (isMe && stat && (stat.tag === 'blackjack' || stat.score === 21) && gs.phase === 'playing') {
      openBtnHtml = `<button onclick="revealMyHand()" style="margin-top:6px;padding:6px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:800;font-family:'Nunito',sans-serif;font-size:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1f1f1f">🎉 Mở bài</button>`;
    }

    // Nút khui sớm cho nhà cái (chỉ host thấy)
    let earlyRevealBtn = '';
    if (isHost && canEarlyReveal && gs.phase === 'playing' && !isDealer) {
      // Chỉ show nút cho từng người chơi chưa bị khui
      if (!isEarlyRevealed) {
        earlyRevealBtn = `<button onclick="earlyRevealPlayer('${uid}')" style="margin-top:4px;padding:5px 12px;border-radius:8px;border:none;cursor:pointer;font-weight:800;font-family:'Nunito',sans-serif;font-size:11px;background:linear-gradient(135deg,#f87171,#dc2626);color:#fff">⚡ Khui bài</button>`;
      }
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
        ${openBtnHtml}
        ${earlyRevealBtn}
      </div>
    `;
  }

  // Nút điều khiển
  // FIX: Nhà cái không có lượt chơi trong turnOrder nên không hiện nút Rút/Dằn cho host
  const myTurn = !isHost && gs.phase === 'playing' && gs.turnOrder?.[gs.turnIdx] === _user.uid;
  btnHit.style.display = myTurn ? 'inline-block' : 'none';
  btnStand.style.display = myTurn ? 'inline-block' : 'none';

  const allBetIn = (r.members || []).filter(u => u !== r.hostUid).every(u => (gs.bets?.[u] || 0) > 0);
  const anyBet = Object.values(gs.bets || {}).some(v => v > 0);
  btnDeal.style.display = (isHost && gs.phase === 'betting' && anyBet) ? 'inline-block' : 'none';
  btnDeal.disabled = !allBetIn;
  btnDeal.textContent = allBetIn ? '🃏 Chia bài' : '⏳ Chờ tất cả đặt cược';
  btnNext.style.display = (isHost && gs.phase === 'result') ? 'inline-block' : 'none';

  // Nút bốc bài cho nhà cái (khi phase=dealer)
  let dealerDrawBtn = document.getElementById('btn-dealer-draw');
  if (!dealerDrawBtn) {
    dealerDrawBtn = document.createElement('button');
    dealerDrawBtn.id = 'btn-dealer-draw';
    dealerDrawBtn.className = 'btn-deal';
    dealerDrawBtn.style.background = 'linear-gradient(135deg,#fbbf24,#f59e0b)';
    dealerDrawBtn.style.color = '#1f1f1f';
    dealerDrawBtn.onclick = hostDealerDraw;
    document.querySelector('.xd-actions').insertBefore(dealerDrawBtn, document.querySelector('.btn-leave-xd'));
  }
  dealerDrawBtn.style.display = (isHost && gs.phase === 'dealer') ? 'inline-block' : 'none';
  // Cập nhật text nút dựa trên điểm nhà cái
  if (isHost && gs.phase === 'dealer') {
    const dScore = dealerStat ? dealerStat.score : 0;
    dealerDrawBtn.textContent = dScore < 17 ? `🃏 Bốc bài (${dScore} điểm)` : `✅ Kết thúc (${dScore} điểm)`;
  }

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
// FIX: Nhà cái chia bài, tất cả úp (dealer cũng úp), phase -> playing
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
  // FIX: Chia bài - nhà cái 2 lá úp hết, người chơi 2 lá
  hands[r.hostUid] = [deck.pop(), deck.pop()];
  players.forEach(uid => { hands[uid] = [deck.pop(), deck.pop()]; });
  
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.deck': deck,
    'gameState.hands': hands,
    'gameState.stand': {},
    'gameState.turnOrder': players,
    'gameState.turnIdx': 0,
    'gameState.results': {},
    'gameState.earlyRevealed': {}
  });
};

// Rút bài (người chơi)
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
  // FIX: Quắc vẫn advance nhưng bài vẫn úp (không tự khui)
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
    // FIX: Chuyển sang phase dealer, host tự bốc bài thủ công
    await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx, 'gameState.phase': 'dealer' });
  } else {
    await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.turnIdx': idx });
  }
}

// FIX: Nhà cái bốc bài thủ công (nút bấm)
async function hostDealerDraw() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid) return;
  if (gs.phase !== 'dealer') return;

  let deck = [...(gs.deck || [])];
  let hand = [...(gs.hands?.[r.hostUid] || [])];
  const score = bestScore(hand);

  if (score >= 17 || hand.length >= 5) {
    // Đủ điểm hoặc đủ bài -> kết thúc
    await finishDealerAndSettle(r, hand, deck);
  } else {
    // Bốc thêm 1 lá
    if (deck.length === 0) { showToast('Hết bài!','warn'); return; }
    hand.push(deck.pop());
    const newScore = bestScore(hand);
    await updateDoc(doc(db,'rooms',ROOM_ID), {
      'gameState.deck': deck,
      [`gameState.hands.${r.hostUid}`]: hand
    });
    if (newScore >= 17 || hand.length >= 5 || newScore > 21) {
      // Tự kết thúc nếu đủ điều kiện
      const updatedSnap = await getDoc(doc(db,'rooms',ROOM_ID));
      const updatedR = updatedSnap.data();
      await finishDealerAndSettle(updatedR, hand, deck);
    }
  }
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
    [`gameState.hands.${r.hostUid}`]: dealerHand,
    'gameState.results': results
  });
}

// ===== TÍNH NĂNG MỚI: Khui sớm bài người chơi =====
// Nhà cái đủ điểm (2 lá >= 15 hoặc 3 lá >= 16) có thể khui bài từng người
window.earlyRevealPlayer = async function(targetUid) {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (r.hostUid !== _user.uid) return;
  if (gs.phase !== 'playing') return;

  // Kiểm tra lại điều kiện nhà cái
  const dealerHand = gs.hands?.[r.hostUid] || [];
  const dealerScore = bestScore(dealerHand);
  const canReveal = (dealerHand.length === 2 && dealerScore >= 15) || (dealerHand.length === 3 && dealerScore >= 16);
  if (!canReveal) { showToast('Chưa đủ điểm để khui','warn'); return; }

  // Tính kết quả riêng cho người bị khui
  const targetHand = gs.hands?.[targetUid] || [];
  const targetStat = status(targetHand);
  const dealerStat = status(dealerHand);
  const bet = gs.bets?.[targetUid] || 0;

  let outcome = 'lose'; let delta = -bet;
  if (targetStat.tag === 'bust') { outcome = 'lose'; delta = -bet; }
  else if (dealerStat.tag === 'bust') { outcome = 'win'; delta = bet; }
  else if (targetStat.tag === 'blackjack' && dealerStat.tag !== 'blackjack') { outcome = 'win'; delta = Math.floor(bet * 1.5); }
  else if (targetStat.score > dealerScore) { outcome = 'win'; delta = bet; }
  else if (targetStat.score === dealerScore) { outcome = 'draw'; delta = 0; }

  // Lưu kết quả riêng vào earlyResults, đánh dấu đã khui
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    [`gameState.earlyRevealed.${targetUid}`]: true,
    [`gameState.earlyResults.${targetUid}`]: { outcome, delta }
  });

  showToast(`⚡ Đã khui bài ${esc(r.memberInfo?.[targetUid]?.name || '?')}`, 'info');
};

// ===== TÍNH NĂNG MỚI: Mở bài khi Xì dách / Xì bàn =====
window.revealMyHand = async function() {
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data(); const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  const hand = gs.hands?.[_user.uid] || [];
  const stat = status(hand);
  if (stat.tag !== 'blackjack' && stat.score !== 21) return;

  // Đánh dấu người này tự mở bài
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    [`gameState.revealed.${_user.uid}`]: true
  });
  showToast('🎉 Đã mở bài cho mọi người xem!', 'success');
};

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
    'gameState.earlyRevealed': {},
    'gameState.earlyResults': {},
    'gameState.revealed': {},
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
