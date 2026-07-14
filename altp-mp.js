// ============================================================
// ===== AI LÀ TRIỆU PHÚ (ALTP) - MULTIPLAYER =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getActiveBuff } from './pet.js';
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
const showToast = window.showToast || function(){};
let _user = null, _unsub = null, _unsubMe = null, _myBalance = 0;
let _room = null, _myActivePet = null;
let _bank = null;
let _actionLock = false;

// Clean up when leaving
window.addEventListener('pagehide', () => window.quitGame?.());
window.addEventListener('beforeunload', () => window.quitGame?.());

// ========== BẢNG THƯỞNG ==========
const PRIZE_TABLE = [10, 20, 40, 70, 100, 150, 300, 600, 1200, 2000, 3000, 4000, 5500, 7500, 10000];
const TIER_BY_RANGE = (idx) => idx < 5 ? 'de' : idx < 10 ? 'vua' : 'kho';

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ========== UTILS ==========
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function loadBank() {
  if (_bank) return _bank;
  try {
    const [de, vua, kho] = await Promise.all([
      fetch('games/altp/data/altp-questions-de.json').then(r => r.json()),
      fetch('games/altp/data/altp-questions-vua.json').then(r => r.json()),
      fetch('games/altp/data/altp-questions-kho.json').then(r => r.json())
    ]);
    _bank = { de, vua, kho };
    return _bank;
  } catch (e) {
    // fallback: try altp/offline/data
    const [de, vua, kho] = await Promise.all([
      fetch('altp/offline/data/altp-questions-de.json').then(r => r.json()),
      fetch('altp/offline/data/altp-questions-vua.json').then(r => r.json()),
      fetch('altp/offline/data/altp-questions-kho.json').then(r => r.json())
    ]);
    _bank = { de, vua, kho };
    return _bank;
  }
}

function pickQuestionFromBank(bank, usedSet, idx) {
  const tier = TIER_BY_RANGE(idx);
  const pool = bank[tier] || [];
  const avail = pool.map((_, i) => i).filter(i => !usedSet.has(tier + i));
  const chooseFrom = avail.length ? avail : pool.map((_, i) => i);
  const pick = chooseFrom[Math.floor(Math.random() * chooseFrom.length)];
  usedSet.add(tier + pick);
  return pool[pick];
}

function fmt(n) { return (n || 0).toLocaleString('vi-VN') + 'đ'; }

// ========== AUTH ==========
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

// ========== UPDATE NAV ROOM ==========
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
  roomEl.innerHTML = `<span class="room-icon">💰</span> #${roomCode}`;
}

// ========== FIREBASE LISTENER ==========
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
    if (r.gameType !== 'altp' || !r.gameState) {
    document.getElementById('altp-qbox').style.display = 'none';
    document.getElementById('altp-options').style.display = 'none';
    document.getElementById('altp-players').innerHTML = '<div style="color:#64748b;text-align:center;padding:20px">⏳ Đang chờ host cấu hình...</div>';
    const actEl = document.getElementById('altp-actions');
    if (isHost) {
      actEl.innerHTML = '<button class="altp-act-btn altp-act-green" onclick="hostInitGame()">🚀 Khởi tạo game</button>';
    } else {
      actEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:10px">⏳ Chờ host bắt đầu...</div>';
    }
    return;
  }
    render(r);
  });
}

// ========== RENDER ==========
function render(r) {
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const leftEl = document.getElementById('bc-left');
  const midEl = document.getElementById('bc-mid');
  const rightEl = document.getElementById('bc-right');

  // STATUS BAR
  if (gs.phase === 'betting') {
    midEl.textContent = '🎯 Đặt cược';
  } else if (gs.phase === 'playing') {
    midEl.textContent = `Câu ${gs.roundIdx + 1}`;
  } else if (gs.phase === 'revealed') {
    const correct = gs.currentQ?.c;
    const myAnswer = gs.answers?.[_user.uid];
    const correctStr = ['A', 'B', 'C', 'D'][correct];
    if (myAnswer === undefined || myAnswer === null) midEl.textContent = `👀 Đáp án: ${correctStr}`;
    else midEl.textContent = myAnswer === correct ? '✅ Đúng!' : '❌ Sai!';
  } else if (gs.phase === 'result') {
    midEl.textContent = '🏁 Kết thúc';
  }

  // Left: tổng người chơi hoặc tiền cược
  const players = (r.members || []).length;
  leftEl.textContent = `👥 ${players}`;

  // Right: điểm của mình
  const myScore = gs.scores?.[_user.uid] || 0;
  rightEl.textContent = fmt(myScore);
  rightEl.className = 'stat-profit ' + (myScore > 0 ? 'positive' : 'zero');

  // ===== CÂU HỎI =====
  const qbox = document.getElementById('altp-qbox');
  const qtext = document.getElementById('altp-qtext');
  const optEl = document.getElementById('altp-options');
  const lifeEl = document.getElementById('altp-lifelines');
  const audEl = document.getElementById('altp-audience');
  const phoneEl = document.getElementById('altp-phone-msg');

  if (gs.phase === 'playing' || gs.phase === 'revealed') {
    const q = gs.currentQ;
    if (q) {
      qtext.textContent = q.q;
      qbox.style.display = 'block';
      qbox.classList.toggle('reveal', gs.phase === 'revealed');

      const keys = ['A', 'B', 'C', 'D'];
      optEl.style.display = 'grid';
      const myAnswer = gs.answers?.[_user.uid];
      const revealCorrect = gs.phase === 'revealed';
      const disabled = myAnswer !== undefined || revealCorrect;

      optEl.innerHTML = q.o.map((opt, i) => {
        let cls = 'altp-opt';
        if (disabled && myAnswer === i) cls += ' picked';
        if (revealCorrect && i === q.c) cls += ' correct';
        if (revealCorrect && myAnswer === i && myAnswer !== q.c) cls += ' wrong';
        if (gs.hiddenOptions?.includes(i)) cls += ' hidden-5050';

        // Count how many players chose this option
        const count = gs.answerCounts?.[i] || 0;

        return `<button class="${cls}" id="altp-opt-${i}" onclick="selectAnswer(${i})" ${disabled ? 'disabled' : ''}>
          <span class="altp-opt-key">${keys[i]}.</span> ${esc(opt)}
          ${count > 0 ? `<span class="altp-opt-count">${count}</span>` : ''}
        </button>`;
      }).join('');

      // Lifelines for host
      if (isHost && gs.phase === 'playing') {
        lifeEl.style.display = 'flex';
        document.getElementById('life-5050').disabled = gs.lifelines?.fifty || false;
        document.getElementById('life-audience').disabled = gs.lifelines?.audience || false;
        document.getElementById('life-phone').disabled = gs.lifelines?.phone || false;
      } else {
        lifeEl.style.display = 'none';
      }

      // Audience result
      if (gs.lifelines?.audience && gs.audienceResult) {
        audEl.style.display = 'flex';
        audEl.innerHTML = gs.audienceResult.map((v, i) =>
          `<div class="altp-audience-bar" style="height:${Math.max(v, 3)}%"><span>${keys[i]} ${v}%</span></div>`
        ).join('');
      } else {
        audEl.style.display = 'none';
      }

      // Phone result
      if (gs.lifelines?.phone && gs.phoneMsg) {
        phoneEl.textContent = gs.phoneMsg;
        phoneEl.style.display = 'block';
      } else {
        phoneEl.style.display = 'none';
      }

      // Hide hidden options
      document.querySelectorAll('.altp-opt.hidden-5050').forEach(el => el.style.visibility = 'hidden');
    }
  } else {
    qbox.style.display = 'none';
    optEl.style.display = 'none';
    lifeEl.style.display = 'none';
    audEl.style.display = 'none';
    phoneEl.style.display = 'none';
  }

  // ===== BẢNG NGƯỜI CHƠI =====
  const playersEl = document.getElementById('altp-players');
  const memberList = (r.members || []).filter(uid => uid !== r.hostUid);
  const hostId = r.hostUid;

  let allPlayers = [];
  if (r.memberInfo) {
    allPlayers = [hostId, ...memberList].map(uid => {
      const info = r.memberInfo?.[uid] || {};
      const score = gs.scores?.[uid] || 0;
      const answered = gs.answers?.[uid] !== undefined && gs.answers?.[uid] !== null;
      const correct = gs.phase === 'revealed' && gs.answers?.[uid] === gs.currentQ?.c;
      const wrong = gs.phase === 'revealed' && answered && !correct;
      return { uid, name: info.name || '?', score, answered, correct, wrong, isMe: uid === _user.uid, isHost: uid === hostId };
    });
  }

  playersEl.innerHTML = allPlayers.map(p => {
    let statusClass = 'waiting', statusText = '⏳';
    if (p.isHost) { statusText = '👑'; statusClass = ''; }
    else if (p.correct) { statusText = '✅'; statusClass = 'correct'; }
    else if (p.wrong) { statusText = '❌'; statusClass = 'wrong'; }
    else if (p.answered) { statusText = '📝'; statusClass = 'answered'; }
    return `<div class="altp-player-row ${p.isMe ? 'me' : ''}">
      <span class="altp-player-name">${esc(p.name)}${p.isMe ? ' <span style="color:#fbbf24">(bạn)</span>' : ''}</span>
      <span class="altp-player-score">${fmt(p.score)}</span>
      <span class="altp-player-status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');

  // ===== BET ROW =====
  const betRow = document.getElementById('altp-bet-row');
  if (gs.phase === 'betting' && !isHost) {
    const myBet = gs.bets?.[_user.uid] || 0;
    betRow.style.display = myBet > 0 ? 'none' : 'flex';
  } else {
    betRow.style.display = 'none';
  }

  // ===== ACTIONS =====
  const actEl = document.getElementById('altp-actions');

  if (isHost) {
    const nextRoundEnabled = gs.phase === 'betting' || gs.phase === 'result';
    const startQEnabled = gs.phase === 'betting' && (gs.bets && Object.keys(gs.bets).length > 0);
    const revealEnabled = gs.phase === 'playing' && Object.keys(gs.answers || {}).length > 0;
    actEl.innerHTML = `
      <button class="altp-act-btn altp-act-green" ${startQEnabled ? '' : 'disabled'} onclick="hostNextQuestion()">🎯 Chọn câu hỏi</button>
      <button class="altp-act-btn altp-act-blue" ${revealEnabled ? '' : 'disabled'} onclick="hostReveal()">🔍 Lật đáp án</button>
      <button class="altp-act-btn altp-act-yellow" ${nextRoundEnabled ? '' : 'disabled'} onclick="hostNextRound()">🔄 Vòng mới</button>
    `;
  } else {
    const hasAnswered = gs.answers?.[_user.uid] !== undefined && gs.answers?.[_user.uid] !== null;
    const canAnswer = gs.phase === 'playing' && !hasAnswered;
    const canBet = gs.phase === 'betting';
    actEl.innerHTML = `
      <button class="altp-act-btn altp-act-green" ${canBet ? '' : 'disabled'} onclick="placeBet()">✅ Đặt cược</button>
    `;
  }

  // ===== SELF-RESULT (kết thúc vòng) =====
  if (gs.phase === 'result' && gs.round !== _settledRound) {
    _settledRound = gs.round;
    settleMyResult(r, gs);
  }
}

let _settledRound = -1;

// ========== PLAYER ACTIONS ==========
window.selectAnswer = async function(idx) {
  if (_actionLock) return;
  _actionLock = true;
  try {
    const r = _room;
    if (!r) return;
    const gs = r.gameState;
    if (gs.phase !== 'playing') return;
    const myAnswer = gs.answers?.[_user.uid];
    if (myAnswer !== undefined && myAnswer !== null) return;
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.answers.${_user.uid}`]: idx
    });
    if (window.VTQuests) window.VTQuests.trackPlay('altp');
  } finally {
    _actionLock = false;
  }
};

window.placeBet = async function() {
  const amt = parseInt(document.getElementById('altp-bet-input').value);
  if (!amt || amt < 10) { showToast('Cược tối thiểu 10', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm', 'error'); return; }
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), { [`gameState.bets.${_user.uid}`]: amt });
    showToast('✅ Đã cược ' + amt.toLocaleString('vi-VN') + 'đ', 'success');
  } catch (e) { showToast('Lỗi', 'error'); }
};

// ========== HOST ACTIONS ==========
window.hostInitGame = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameType': 'altp',
      'gameState': {
        phase: 'betting',
        scores: {},
        bets: {},
        answers: {},
        answerCounts: {},
        currentQ: null,
        roundIdx: 0,
        round: 1,
        usedQuestions: [],
        hiddenOptions: [],
        lifelines: { fifty: false, audience: false, phone: false },
        audienceResult: null,
        phoneMsg: null,
        lastPaid: {}
      }
    });
    showToast('✅ Game đã sẵn sàng!', 'success');
  } catch (e) {
    showToast('Lỗi khởi tạo: ' + e.message, 'error');
  }
};

window.hostNextQuestion = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const bank = await loadBank();
  const gs = r.gameState;
  const roundIdx = (gs.roundIdx || 0);

  // Pick a question
  const used = new Set(gs.usedQuestions || []);
  const q = pickQuestionFromBank(bank, used, roundIdx);
  if (!q) { showToast('Hết câu hỏi!', 'warn'); return; }

  const newUsed = [...used];
  const tier = TIER_BY_RANGE(roundIdx);
  const pick = (gs.usedQuestions?.length || 0);
  newUsed.push(tier + pick);

  let questionIndex = roundIdx;
  if (roundIdx >= 15) questionIndex = roundIdx % 15;
  
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'playing',
      'gameState.currentQ': q,
      'gameState.roundIdx': questionIndex,
      'gameState.answers': {},
      'gameState.answerCounts': {},
      'gameState.usedQuestions': newUsed,
      'gameState.hiddenOptions': [],
      'gameState.audienceResult': null,
      'gameState.phoneMsg': null,
      'gameState.lifelines': { fifty: false, audience: false, phone: false }
    });
    showToast('📝 Câu hỏi đã được chọn!', 'success');
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

window.hostReveal = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;

  // Calculate answer counts
  const answers = gs.answers || {};
  const counts = [0, 0, 0, 0];
  for (const uid of Object.keys(answers)) {
    const ans = answers[uid];
    if (ans >= 0 && ans < 4) counts[ans]++;
  }

  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'revealed',
      'gameState.answerCounts': counts
    });
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

window.hostNextRound = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;

  // Calculate scores
  const gs = r.gameState;
  const answers = gs.answers || {};
  const bets = gs.bets || {};
  const currentQ = gs.currentQ;
  const oldScores = gs.scores || {};
  const newScores = { ...oldScores };

  if (currentQ && gs.phase === 'revealed') {
    const correct = currentQ.c;
    for (const uid of Object.keys(answers)) {
      const ans = answers[uid];
      const bet = bets[uid] || 0;
      if (ans === correct) {
        // Correct answer: win bet amount
        newScores[uid] = (newScores[uid] || 0) + bet;
      }
    }
  }

  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'betting',
      'gameState.currentQ': null,
      'gameState.answers': {},
      'gameState.answerCounts': {},
      'gameState.hiddenOptions': [],
      'gameState.audienceResult': null,
      'gameState.phoneMsg': null,
      'gameState.lifelines': { fifty: false, audience: false, phone: false },
      'gameState.scores': newScores,
      'gameState.round': (gs.round || 1) + 1,
      'gameState.bets': {}
    });
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

// ========== LIFELINES (Host Only) ==========
window.useFiftyFifty = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (!gs.currentQ || gs.lifelines?.fifty) return;
  const correct = gs.currentQ.c;
  const wrongIdxs = [0, 1, 2, 3].filter(i => i !== correct);
  const toHide = wrongIdxs.sort(() => Math.random() - 0.5).slice(0, 2);
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.hiddenOptions': toHide,
    'gameState.lifelines.fifty': true
  });
};

window.useAskAudience = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (!gs.currentQ || gs.lifelines?.audience) return;

  // Sinh tỉ lệ phần trăm
  const correct = gs.currentQ.c;
  let vals = [0, 0, 0, 0];
  let remain = 100;
  const correctShare = 40 + Math.floor(Math.random() * 35);
  vals[correct] = correctShare;
  remain -= correctShare;
  const others = [0, 1, 2, 3].filter(i => i !== correct);
  others.forEach((idx, k) => {
    const isLast = k === others.length - 1;
    const share = isLast ? remain : Math.floor(Math.random() * (remain / (others.length - k) * 1.5));
    vals[idx] = Math.min(share, remain);
    remain -= vals[idx];
  });

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.audienceResult': vals,
    'gameState.lifelines.audience': true
  });
};

window.usePhoneFriend = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (!gs.currentQ || gs.lifelines?.phone) return;

  const correct = gs.currentQ.c;
  const keys = ['A', 'B', 'C', 'D'];
  const isRight = Math.random() < 0.75;
  const suggested = isRight ? correct : [0, 1, 2, 3].filter(i => i !== correct)[Math.floor(Math.random() * 3)];
  const confidence = isRight ? ['khá chắc chắn', 'khá tự tin'][Math.floor(Math.random() * 2)] : ['không chắc lắm', 'phân vân'][Math.floor(Math.random() * 2)];
  const msg = `📞 "Tôi nghĩ đáp án là ${keys[suggested]}, tôi ${confidence}!"`;

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phoneMsg': msg,
    'gameState.lifelines.phone': true
  });
};

// ========== SETTLE RESULT ==========
async function settleMyResult(r, gs) {
  // Chỉ thanh toán số điểm kiếm được trong vòng này (delta)
  const lastPaid = gs.lastPaid?.[_user.uid] || 0;
  const currentScore = gs.scores?.[_user.uid] || 0;
  const delta = currentScore - lastPaid;
  if (delta <= 0) return;

  let buffBonus = 0;
  try {
    const buffPct = await getActiveBuff();
    if (buffPct > 0) buffBonus = Math.round(delta * buffPct / 100);
  } catch {}

  const total = delta + buffBonus;
  try {
    await updateDoc(doc(db, 'users', _user.uid), { points: increment(total) });
    // Lưu mốc đã thanh toán
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.lastPaid.${_user.uid}`]: currentScore
    });
    if (buffBonus > 0) {
      showToast(`🎉 Thắng +${delta.toLocaleString('vi-VN')}đ 🐾 +${buffBonus.toLocaleString('vi-VN')}đ`, 'success');
    } else {
      showToast(`🎉 Thắng +${delta.toLocaleString('vi-VN')}đ!`, 'success');
    }
    if (window.VTQuests) { window.VTQuests.trackEarn(total); window.VTQuests.trackWinSmart(); }
  } catch (e) {
    console.error('Settle error:', e);
  }
}

// ========== QUIT ==========
window.quitGame = async function() {
  try {
    const r = _room;
    if (r) {
      if (r.hostUid === _user.uid) {
        await deleteDoc(doc(db, 'rooms', ROOM_ID));
      } else {
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'rooms', ROOM_ID));
        } else {
          const mi = r.memberInfo || {};
          delete mi[_user.uid];
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            members: arrayRemove(_user.uid),
            memberInfo: mi
          });
        }
      }
    }
  } catch (e) {}
  location.href = 'rooms.html';
};
