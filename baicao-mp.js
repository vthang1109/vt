// ============================================================
// ===== BÀI CÀO MULTIPLAYER =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { createDeck, renderCardUI } from './cards.js';
import { getActiveBuff, getPetById, getTierById } from './pet.js';

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
let _notifiedRound = 0;
let _endingRound = false;
let _betConfirmed = false;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ========== UTILS ==========
function calculateScore(hand) {
  let total = 0;
  let isThreePictures = true;
  for (let card of hand) {
    const v = card.v;
    if (v === 'A') total += 1;
    else if (['J','Q','K'].includes(v)) total += 10;
    else total += parseInt(v);
    if (!['J','Q','K'].includes(v)) isThreePictures = false;
  }
  const normalScore = total % 10;
  const valueMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const values = hand.map(c => valueMap[c.v]).sort((a,b)=>a-b);
  let special = null, specialValue = 0, description = '';
  if (hand[0].v === hand[1].v && hand[1].v === hand[2].v) {
    special = 'SAP'; specialValue = values[0]; description = 'SÁP ' + (hand[0].v === 'A' ? 'A' : hand[0].v);
  } else if ((values[0] === 2 && values[1] === 3 && values[2] === 14) || (values[2] - values[0] === 2 && values[1] - values[0] === 1)) {
    special = 'LIENG';
    if (values[0] === 2 && values[1] === 3 && values[2] === 14) { specialValue = 0; description = 'LIÊNG A23'; }
    else { specialValue = values[2] - 3; const high = values[2]; const highName = high===14?'A':(high===13?'K':(high===12?'Q':(high===11?'J':high))); description = 'LIÊNG ' + highName; }
  } else if (isThreePictures) {
    special = 'DONG_HOA'; specialValue = 0; description = 'TIÊN';
  } else {
    special = null; specialValue = normalScore; description = normalScore + ' điểm';
  }
  return { score: normalScore, special, specialValue, description };
}

function getHandRank(special, specialValue) {
  if (special === 'SAP') return 2000 + specialValue;
  if (special === 'LIENG') return 1000 + specialValue;
  if (special === 'DONG_HOA') return 900;
  return specialValue;
}

function compareHands(playerHand, dealerHand) {
  const p = calculateScore(playerHand);
  const d = calculateScore(dealerHand);
  const pRank = getHandRank(p.special, p.specialValue);
  const dRank = getHandRank(d.special, d.specialValue);
  if (pRank > dRank) return { outcome: 'win', playerSpecial: p.special, dealerSpecial: d.special };
  if (pRank < dRank) return { outcome: 'lose', playerSpecial: p.special, dealerSpecial: d.special };
  return { outcome: 'draw', playerSpecial: p.special, dealerSpecial: d.special };
}

function getMultiplier(special) {
  if (special === 'SAP') return 4;
  if (special === 'LIENG') return 3;
  if (special === 'DONG_HOA') return 3;
  return 2;
}

function getSpecialClass(special) {
  if (special === 'SAP') return 'sap';
  if (special === 'LIENG') return 'lieng';
  if (special === 'DONG_HOA') return 'tien';
  return 'normal';
}

function getSpecialBannerClass(special) {
  if (special === 'SAP') return 'bc-result-special-sap';
  if (special === 'LIENG') return 'bc-result-special-lieng';
  if (special === 'DONG_HOA') return 'bc-result-special-tien';
  return null;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== AUTH ==========
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
  if (ROOM_ID) start();
});

// ========== FIREBASE LISTENER ==========
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    updateNavRoom(r.code || '------');
    if (r.gameType !== 'baicao' || !r.gameState) return;
    render(r);
  });
}

function updateNavRoom(roomCode) {
  if (!roomCode) return;
  const logo = document.querySelector('.vt-top-nav .vt-nav-logo');
  if (!logo) return;
  let roomEl = logo.querySelector('.bc-room-id');
  if (!roomEl) {
    roomEl = document.createElement('span');
    roomEl.className = 'bc-room-id';
    logo.innerHTML = '';
    logo.appendChild(roomEl);
  }
  roomEl.innerHTML = `<span class="room-icon">🃏</span> #${roomCode}`;
}

// ========== RENDER ==========
function render(r) {
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const dealerUid = r.hostUid; // host là nhà cái

  const phEl = document.getElementById('bc-mid');
  const leftEl = document.getElementById('bc-left');
  const rightEl = document.getElementById('bc-right');
  const betRow = document.getElementById('bc-bet-row');

  // === STATUS BAR ===
  if (gs.phase === 'betting') {
    phEl.textContent = 'BET';
    if (isHost) {
      leftEl.textContent = `${gs.betAmount || 100}`;
      rightEl.textContent = '';
      rightEl.className = 'stat-profit zero';
    } else {
      const myBet = gs.bets?.[_user.uid] || 0;
      leftEl.textContent = myBet ? `${myBet}` : 'Chờ cược';
      rightEl.textContent = '';
      rightEl.className = 'stat-profit zero';
    }
  } else if (gs.phase === 'playing') {
    phEl.textContent = 'Đang lật bài...';
    leftEl.textContent = `${gs.betAmount || 100}`;
    const myBet = gs.bets?.[_user.uid] || 0;
    rightEl.textContent = myBet ? `${myBet}` : '';
    rightEl.className = 'stat-profit zero';
  } else if (gs.phase === 'result') {
    if (isHost) {
      const delta = gs.dealerDelta || 0;
      phEl.textContent = delta > 0 ? 'WIN' : delta < 0 ? 'LOSE' : 'DRAW';
      rightEl.textContent = delta === 0 ? '' : (delta > 0 ? '+' : '') + delta.toLocaleString('vi-VN');
      rightEl.className = 'stat-profit ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero');
    } else {
      const myResult = gs.results?.[_user.uid];
      if (myResult) {
        phEl.textContent = myResult.outcome === 'win' ? 'WIN' : myResult.outcome === 'lose' ? 'LOSE' : 'DRAW';
        rightEl.textContent = myResult.delta === 0 ? '' : (myResult.delta > 0 ? '+' : '') + myResult.delta.toLocaleString('vi-VN');
        rightEl.className = 'stat-profit ' + (myResult.delta > 0 ? 'positive' : myResult.delta < 0 ? 'negative' : 'zero');
      } else {
        phEl.textContent = 'Kết thúc';
        rightEl.textContent = '';
        rightEl.className = 'stat-profit zero';
      }
    }
  }

  let statusCls = '';
  if (gs.phase === 'result') {
    if (isHost) {
      const d = gs.dealerDelta || 0;
      statusCls = d > 0 ? ' result-win' : d < 0 ? ' result-lose' : ' result-draw';
    } else {
      const myResult = gs.results?.[_user.uid];
      if (myResult) {
        statusCls = myResult.outcome === 'win' ? ' result-win' : myResult.outcome === 'lose' ? ' result-lose' : ' result-draw';
      }
    }
  }
  document.getElementById('bc-status').className = 'bc-status' + statusCls;

  // === THÔNG BÁO KẾT QUẢ VÁN (mỗi người 1 lần / round) ===
  if (gs.phase === 'result' && gs.round !== _notifiedRound) {
    _notifiedRound = gs.round;
    if (isHost) {
      const d = gs.dealerDelta || 0;
      const msg = d > 0 ? `Bạn thắng +${d.toLocaleString('vi-VN')}` : d < 0 ? `Bạn thua ${d.toLocaleString('vi-VN')}` : 'Hòa';
      showToast(msg, d > 0 ? 'success' : d < 0 ? 'error' : 'info');
    } else {
      const myResult = gs.results?.[_user.uid];
      if (myResult) {
        const d = myResult.delta || 0;
        const msg = myResult.outcome === 'win' ? `Bạn thắng +${d.toLocaleString('vi-VN')}` : myResult.outcome === 'lose' ? `Bạn thua ${d.toLocaleString('vi-VN')}` : 'Hòa';
        showToast(msg, myResult.outcome === 'win' ? 'success' : myResult.outcome === 'lose' ? 'error' : 'info');
      }
    }
  }

  // === BET ROW (chỉ host hiện ở ván đầu) ===
  if (isHost && gs.phase === 'betting' && !gs.betConfirmed) {
    betRow.style.display = 'flex';
  } else {
    betRow.style.display = 'none';
  }

  // Host tự rà soát: nếu tất cả bài đã mở (do bất kỳ ai mở lá cuối) thì tự kết thúc ván
  if (isHost && gs.phase === 'playing' && !_endingRound && isFullyRevealed(r)) {
    _endingRound = true;
    hostEndRound().finally(() => { _endingRound = false; });
  }

  // === TABLE ===
  const tEl = document.getElementById('bc-table');
  const players = (r.members || []).filter(uid => uid !== dealerUid);
  const allPlayers = [dealerUid, ...players];

  tEl.innerHTML = '';

  const myBet = gs.bets?.[_user.uid] || 0;
  const betAmount = gs.betAmount || 100;
  const allRevealed = gs.revealed || {};

  for (const uid of allPlayers) {
    const isDealer = uid === dealerUid;
    const isMe = uid === _user.uid;
    const hand = gs.hands?.[uid] || [];
    const revealed = allRevealed[uid] || [];
    let result = gs.results?.[uid];
    if (isDealer && gs.phase === 'result') {
      const dd = gs.dealerDelta || 0;
      result = { outcome: dd > 0 ? 'win' : dd < 0 ? 'lose' : 'draw', delta: dd };
    }

    let cls = 'bc-seat';
    if (isDealer) cls += ' dealer';
    if (isMe) cls += ' me';
    if (result) {
      cls += result.outcome === 'win' ? ' win' : result.outcome === 'lose' ? ' lose' : ' draw';
    }

    // Hiển thị bài: nếu phase result thì hiện hết, ngược lại hiện theo revealed
    let showAll = gs.phase === 'result';
    let cardsHtml = hand.length === 0
      ? '<div style="color:#64748b;font-size:12px;padding:8px 0">Chưa có bài</div>'
      : hand.map((c, i) => {
          const hidden = !showAll && !(revealed && revealed[i]);
          return renderCardUI(hidden ? null : c, hidden);
        }).join('');

    // Tính điểm hiển thị
    let scoreText = '';
    let scoreHtml = '';
    if (hand.length === 3 && (showAll || (revealed && revealed.every(r => r)))) {
      const calc = calculateScore(hand);
      if (calc.special) {
        scoreText = `<span class="hand-type ${getSpecialClass(calc.special)}">${calc.description}</span>`;
      } else {
        scoreText = calc.description;
      }
      const clsInline = calc.special ? 'bc-score-inline plain' : 'bc-score-inline';
      scoreHtml = `<span class="${clsInline}">${scoreText}</span>`;
    } else if (hand.length > 0) {
      scoreHtml = '<span class="bc-score-inline">?</span>';
    }

    // Result overlay
    let resultHtml = '';
    if (result) {
      let overlayClass = '';
      let overlayText = '';
      if (result.outcome === 'win') {
        const pCalc = calculateScore(hand);
        const specialBanner = getSpecialBannerClass(pCalc.special);
        if (specialBanner) {
          overlayClass = specialBanner;
          overlayText = pCalc.description;
        } else {
          overlayClass = 'bc-result-win';
          overlayText = `+${result.delta.toLocaleString('vi-VN')}`;
        }
      } else if (result.outcome === 'lose') {
        overlayClass = 'bc-result-lose';
        overlayText = `${result.delta.toLocaleString('vi-VN')}`;
      } else {
        overlayClass = 'bc-result-draw';
        overlayText = 'HÒA';
      }
      resultHtml = `<div class="bc-result-overlay ${overlayClass}">${overlayText}</div>`;
    }

    // Bet badge
    let betBadgeHtml = '';
    if (!isDealer && gs.bets?.[uid] && gs.bets[uid] > 0) {
      betBadgeHtml = `<div class="bc-bet-badge">${gs.bets[uid].toLocaleString('vi-VN')}</div>`;
    }

    // Name
    let nameHtml = isDealer
      ? `👑 Nhà Cái${isHost ? ' <span style="color:#fbbf24;font-size:12px">(bạn)</span>' : ''}`
      : `${esc(r.memberInfo?.[uid]?.name || '?')}${isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}`;

    // Thêm badge bet info nếu phase betting và chưa đặt cược
    let betInfoHtml = '';
    if (gs.phase === 'betting' && !isDealer && !gs.bets?.[uid]) {
      betInfoHtml = `<span class="bc-bet-info">⏳ Chờ cược</span>`;
    }

    tEl.innerHTML += `
      <div class="${cls}">
        ${resultHtml}
        <div class="bc-seat-head">
          <span class="bc-seat-name">${nameHtml} ${scoreHtml} ${betInfoHtml}</span>
        </div>
        <div class="bc-cards">${cardsHtml}</div>
        ${betBadgeHtml}
      </div>`;
  }

  // === ACTIONS ===
  const actEl = document.getElementById('bc-actions');
  const isPlaying = gs.phase === 'playing';
  const isResult = gs.phase === 'result';
  const isBetting = gs.phase === 'betting';
  const myHand = gs.hands?.[_user.uid] || [];
  const myRevealed = allRevealed[_user.uid] || [];
  const allMyRevealed = myRevealed.length === 3 && myRevealed.every(r => r);
  const canRevealOne = isPlaying && !allMyRevealed && myHand.length === 3;
  const canRevealAll = isPlaying && myHand.length === 3 && !allMyRevealed;
  const canNewRound = isResult && isHost;

  actEl.innerHTML = `
    <button class="bc-act-btn bc-act-blue" ${canRevealOne ? '' : 'disabled'} onclick="revealOne()">Mở 1 lá</button>
    <button class="bc-act-btn bc-act-green" ${canRevealAll ? '' : 'disabled'} onclick="revealAll()">Mở tất cả</button>
    <button class="bc-act-btn bc-act-yellow" ${canNewRound ? '' : 'disabled'} onclick="hostNewRound()">Ván mới</button>
  `;
}

// ========== CHIA BÀI (dùng chung cho ván đầu & ván mới) ==========
function buildDealUpdates(r, betAmount, nextRound) {
  const deck = createDeck();
  const dealerUid = r.hostUid;
  const players = (r.members || []).filter(u => u !== dealerUid);

  const hands = {};
  hands[dealerUid] = [deck.pop(), deck.pop(), deck.pop()];
  for (const uid of players) {
    hands[uid] = [deck.pop(), deck.pop(), deck.pop()];
  }

  const revealed = {};
  revealed[dealerUid] = [false, false, false];
  for (const uid of players) {
    revealed[uid] = [false, false, false];
  }

  const bets = {};
  for (const uid of players) {
    bets[uid] = betAmount;
  }

  return {
    'gameState.phase': 'playing',
    'gameState.hands': hands,
    'gameState.revealed': revealed,
    'gameState.bets': bets,
    'gameState.results': {},
    'gameState.dealerDelta': 0,
    'gameState.round': nextRound,
    'gameState.betAmount': betAmount,
    'gameState.betConfirmed': true
  };
}

// ========== HÀNH ĐỘNG ==========
window.confirmBet = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  if (r.gameState?.betConfirmed) return;

  const select = document.getElementById('bc-bet-select');
  const amount = parseInt(select.value);
  if (!amount || amount < 50) { showToast('Mức cược tối thiểu 50', 'warn'); return; }

  const updates = buildDealUpdates(r, amount, 1);
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
  showToast(`Mức cược ${amount} đã xác nhận, bài đã chia`, 'success');
};

window.revealOne = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  
  const revealed = gs.revealed?.[_user.uid] || [];
  const idx = revealed.findIndex(r => !r);
  if (idx === -1) return;
  
  const newRevealed = [...revealed];
  newRevealed[idx] = true;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.revealed.${_user.uid}`]: newRevealed
  });

  await checkAllRevealed();
};

window.revealAll = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;
  
  const revealed = gs.revealed?.[_user.uid] || [];
  const newRevealed = [true, true, true];
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.revealed.${_user.uid}`]: newRevealed
  });
  
  // Kiểm tra xem tất cả đã mở hết chưa (host tự động kết thúc)
  await checkAllRevealed();
};

function isFullyRevealed(r) {
  const gs = r.gameState;
  const dealerUid = r.hostUid;
  const players = (r.members || []).filter(u => u !== dealerUid);
  const allRevealed = gs.revealed || {};
  const allPlayersRevealed = players.every(uid => {
    const rev = allRevealed[uid] || [];
    return rev.length === 3 && rev.every(x => x);
  });
  const dealerRevealed = (allRevealed[dealerUid] || []).length === 3 && (allRevealed[dealerUid] || []).every(x => x);
  return allPlayersRevealed && dealerRevealed;
}

async function checkAllRevealed() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;

  if (isFullyRevealed(r) && r.hostUid === _user.uid) {
    await hostEndRound();
  }
}

window.hostEndRound = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;

  const dealerUid = r.hostUid;
  const dealerHand = gs.hands?.[dealerUid] || [];
  const players = (r.members || []).filter(u => u !== dealerUid);
  const betAmount = gs.betAmount || 100;
  const results = {};
  let dealerDelta = 0;

  for (const uid of players) {
    const playerHand = gs.hands?.[uid] || [];
    if (playerHand.length === 0) continue;
    const bet = gs.bets?.[uid] || betAmount;
    const result = compareHands(playerHand, dealerHand);
    let delta = 0;
    if (result.outcome === 'win') {
      const multiplier = getMultiplier(result.playerSpecial);
      delta = bet * (multiplier - 1);
    } else if (result.outcome === 'lose') {
      const multiplier = getMultiplier(result.dealerSpecial);
      delta = -bet * (multiplier - 1);
    } else {
      delta = 0;
    }
    results[uid] = { outcome: result.outcome, delta };
    dealerDelta -= delta;
  }

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'result',
    'gameState.results': results,
    'gameState.dealerDelta': dealerDelta
  });

  // Xử lý điểm cho host
  if (dealerDelta !== 0) {
    const us = await getDoc(doc(db, 'users', _user.uid));
    const cur = us.exists() ? (us.data().points || 0) : 0;
    await updateDoc(doc(db, 'users', _user.uid), { points: cur + dealerDelta });
    if (window.VTQuests && dealerDelta > 0) window.VTQuests.trackEarn(dealerDelta);
  }

  // Xử lý điểm cho người chơi
  for (const [uid, res] of Object.entries(results)) {
    if (uid === _user.uid) continue;
    if (res.delta !== 0) {
      const us = await getDoc(doc(db, 'users', uid));
      const cur = us.exists() ? (us.data().points || 0) : 0;
      await updateDoc(doc(db, 'users', uid), { points: cur + res.delta });
    }
  }

};

window.hostNewRound = async function() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;

  const betAmount = r.gameState?.betAmount || 100;
  const nextRound = (r.gameState?.round || 0) + 1;
  const updates = buildDealUpdates(r, betAmount, nextRound);
  await updateDoc(doc(db, 'rooms', ROOM_ID), updates);
};

// ========== QUIT ==========
window.quitGame = async function() {
  try {
    const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
    if (snap.exists()) {
      const r = snap.data();
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