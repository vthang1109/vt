// ============================================================
// ===== AI LÀ TRIỆU PHÚ (ALTP) - MULTIPLAYER v2 =====
// ===== Bỏ cược • +50/-50 • Thưởng nhanh nhất +50 =====
// ============================================================
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, increment, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { subscribeUserData } from '../../points.js';
import { getActiveBuff } from '../../pet.js';
import { initRoomChat, getMyNickname, showRoomDeletedPopup } from '../../room-chat.js';
import { play, playOnce, stopAll } from '../../assets/sound.js';

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
let _user = null, _unsub = null, _unsubMe = null;
let _room = null, _myActivePet = null;
let _autoRevealing = false;
let _actionLock = false;
let _timerInterval = null;
let _myLocalHidden = [];   // per-player 50:50 hidden options (local)
let _myAudienceResult = null;  // per-player audience result (local)
let _myPhoneMsg = null;        // per-player phone message (local)
let _lastRoundTimer = 0;  // track which round the timer was started for

// Clean up
window.addEventListener('pagehide', () => { if (!window.__navigated) window.quitGame?.(); });
window.addEventListener('beforeunload', () => { if (!window.__navigated) window.quitGame?.(); });

// ========== BẢNG THƯỞNG OFFLINE (15 câu) — đồng bộ với altp.js ==========
const PRIZE_TABLE = [10, 20, 40, 70, 100, 150, 300, 600, 1200, 2000, 3000, 4000, 5500, 7500, 10000];
const SAFE_IDX = [4, 9]; // câu 5 và câu 10 (0-index: 4, 9)
const TIER_BY_RANGE = (idx) => idx < 5 ? 'de' : idx < 10 ? 'vua' : 'kho';

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

// ========== UTILS ==========
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function loadBank() {
  if (_bank) return _bank;
  try {
    const [de, vua, kho] = await Promise.all([
      fetch('data/altp-questions-de.json').then(r => r.json()),
      fetch('data/altp-questions-vua.json').then(r => r.json()),
      fetch('data/altp-questions-kho.json').then(r => r.json())
    ]);
    _bank = { de, vua, kho };
    return _bank;
  } catch (e) {
    showToast('Không tải được câu hỏi: ' + e.message, 'error');
    return { de: [], vua: [], kho: [] };
  }
}
let _bank = null;

function pickQuestionFromBank(bank, usedSet, idx) {
  const tier = TIER_BY_RANGE(idx);
  const pool = bank[tier] || [];
  const avail = pool.map((_, i) => i).filter(i => !usedSet.has(tier + i));
  const chooseFrom = avail.length ? avail : pool.map((_, i) => i);
  const pick = chooseFrom[Math.floor(Math.random() * chooseFrom.length)];
  usedSet.add(tier + pick);
  return pool[pick];
}

function fmt(n) { return (n || 0).toLocaleString('vi-VN'); }

function fmtScore(n) {
  const v = n || 0;
  return (v >= 0 ? '+' : '') + v;
}

// Thưởng chuỗi cuối game (giống hệt luật altp.js offline)
function computeFinalPrize(gs, uid) {
  const ps = (gs.streaks || {})[uid] || {};
  if (ps.streakBroken) return ps.safePrize || 0;
  // Chưa từng trả lời sai: nhận đúng giá trị bậc thang của câu đã trả lời đúng gần nhất
  // (không chỉ dừng ở mốc an toàn Q5/Q10 — nếu đúng hết 15 câu phải nhận full bậc 15)
  const roundIdx = gs.roundIdx || 0;
  return roundIdx > 0 ? (PRIZE_TABLE[roundIdx - 1] || 0) : 0;
}

// Tổng nhận cuối game = thưởng chuỗi (bậc thang) + điểm thưởng mỗi câu (+50/-50/+100 nhanh nhất)
function computeGrandTotal(gs, uid) {
  return computeFinalPrize(gs, uid) + (gs.scores?.[uid] || 0);
}

// ========== AUTH ==========
onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  if (window.TopNav && window.TopNav.setLeaveAction) window.TopNav.setLeaveAction(async () => {
    window.__navigated = true;
    await window.quitGame?.();
  });
  _unsubMe = subscribeUserData((data) => {
    _myActivePet = data?.activePet || null;
    if (window.TopNav) window.TopNav.setPoints(data?.points || 0);
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
  if (!roomCode || !window.TopNav?.setRoomId) return;
  window.TopNav.setRoomId(roomCode, `<img src="../../assets/icons/altp.png" style="height:14px;width:14px;vertical-align:middle;border-radius:2px">`);
}

// ========== TIMER ==========
function startTimer(seconds) {
  stopTimer();
  let remaining = seconds;
  updateTimerDisplay(remaining);
  _timerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      updateTimerDisplay(0);
      stopTimer();
      // Auto-reveal when time runs out
      if (_room && _room.hostUid === _user.uid) {
        hostReveal();
      }
    } else {
      updateTimerDisplay(remaining);
    }
  }, 1000);
}

function updateTimerDisplay(remaining) {
  const el = document.getElementById('bc-right');
  if (el) {
    if (remaining <= 5) {
      el.innerHTML = `⏱ <span style="color:#ef4444">${remaining}s</span>`;
    } else {
      el.textContent = `⏱ ${remaining}s`;
    }
  }
}

function stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

// ========== FIREBASE LISTENER ==========
function start() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), (snap) => {
    if (!snap.exists()) {
      showRoomDeletedPopup();
      return;
    }
    const r = snap.data();
    _room = r;
    updateNavRoom(r.code || '------');
    if (r.gameType !== 'altp' || !r.gameState) {
      // Host setup phase
      document.getElementById('altp-qbox').style.display = 'none';
      document.getElementById('altp-options').style.display = 'none';
      document.getElementById('altp-players').innerHTML = '<div style="color:#64748b;text-align:center;padding:20px">⏳ Đang chờ host cấu hình...</div>';
      const actEl = document.getElementById('altp-actions');
      const _isHost = r.hostUid === _user.uid;
      if (_isHost) {
        // Show time limit selection
        actEl.innerHTML = `
          <div style="text-align:center;width:100%;padding:16px">
            <div style="color:#e0f2fe;font-weight:700;font-size:15px;margin-bottom:12px">⏱ CHỌN THỜI GIAN MỖI CÂU</div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button class="altp-timer-btn" data-t="15" onclick="window.selectTimeLimit(15)">🟢 15 giây</button>
              <button class="altp-timer-btn selected" data-t="30" onclick="window.selectTimeLimit(30)">🟡 30 giây</button>
              <button class="altp-timer-btn" data-t="45" onclick="window.selectTimeLimit(45)">🔴 45 giây</button>
            </div>
            <div style="margin-top:16px">
              <button class="altp-act-btn altp-act-green" onclick="window.hostInitGame()" style="padding:14px 40px;font-size:16px">🚀 BẮT ĐẦU GAME</button>
            </div>
          </div>`;
        document.querySelectorAll('.altp-timer-btn').forEach(b => {
          b.classList.toggle('selected', b.dataset.t === '30');
        });
      } else {
        actEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:16px">⏳ Chờ host cài đặt thời gian...</div>';
      }
      return;
    }

    // Tự động lật đáp án khi tất cả người chơi đã trả lời
    if (r.hostUid === _user.uid && r.gameState.phase === 'playing') {
      const gs = r.gameState;
      const members = r.members || [];
      const answeredCount = Object.keys(gs.answers || {}).length;
      if (members.length > 0 && answeredCount >= members.length && !_autoRevealing) {
        _autoRevealing = true;
        hostReveal().finally(() => { _autoRevealing = false; });
      }
    }

    render(r);
  });
}

// ========== TIME LIMIT SELECTION ==========
let _selectedTimeLimit = 30;

window.selectTimeLimit = function(seconds) {
  _selectedTimeLimit = seconds;
  document.querySelectorAll('.altp-timer-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.t) === seconds);
  });
};

// ========== RENDER ==========
function render(r) {
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const leftEl = document.getElementById('bc-left');
  const midEl = document.getElementById('bc-mid');
  const rightEl = document.getElementById('bc-right');

  // ===== STATUS BAR =====
  const statusEl = document.getElementById('bc-status');
  statusEl.classList.remove('result-win', 'result-lose');

  // Reset local state mỗi câu mới
  if (gs.roundIdx && gs.roundIdx !== _lastRoundTimer) {
    _myLocalHidden = [];
    _myAudienceResult = null;
    _myPhoneMsg = null;
  }

  // Timer: start/stop cho tất cả client
  if (gs.phase === 'playing') {
    if (!_timerInterval || _lastRoundTimer !== gs.roundIdx) {
      _lastRoundTimer = gs.roundIdx;
      startTimer(gs.timeLimit || 30);
    }
  } else {
    if (_timerInterval) stopTimer();
  }

  // Tính delta cho câu này (hiện bên phải khi reveal)
  const myAnswer = gs.answers?.[_user.uid];
  const correct = gs.currentQ?.c;
  let myDelta = null;
  if (gs.phase === 'revealed') {
    if (myAnswer !== undefined && myAnswer !== null) {
      if (myAnswer === correct) {
        myDelta = 50 + (gs.fastestUid === _user.uid ? 50 : 0);
      } else {
        myDelta = -50;
      }
    } else {
      myDelta = -50; // not answered = wrong
    }
  }

  if (gs.phase === 'waiting') {
    midEl.textContent = 'Chuẩn bị...';
    leftEl.textContent = '0';
    leftEl.className = 'stat-bet';
    rightEl.textContent = `${gs.timeLimit || 30}s`;
    rightEl.className = 'stat-profit zero';
  } else if (gs.phase === 'playing') {
    midEl.textContent = `Câu ${gs.roundIdx || 1}/15`;
    const myScore = gs.scores?.[_user.uid] || 0;
    leftEl.textContent = fmtScore(myScore);
    leftEl.className = 'stat-bet ' + (myScore >= 0 ? 'positive' : 'negative');
    // Timer hiện bên phải (do updateTimerDisplay cập nhật)
    rightEl.className = 'stat-profit zero';
  } else if (gs.phase === 'revealed') {
    const correctStr = ['A', 'B', 'C', 'D'][correct];
    if (myAnswer === undefined || myAnswer === null) {
      midEl.textContent = `Đáp án: ${correctStr}`;
    } else {
      const isCorrect = myAnswer === correct;
      midEl.textContent = isCorrect ? 'Đúng!' : 'Sai!';
      statusEl.classList.add(isCorrect ? 'result-win' : 'result-lose');
    }
    const myScore = gs.scores?.[_user.uid] || 0;
    leftEl.textContent = fmtScore(myScore);
    leftEl.className = 'stat-bet ' + (myScore >= 0 ? 'positive' : 'negative');
    // Phải: hiện +/- của câu này
    if (myDelta !== null) {
      rightEl.textContent = (myDelta >= 0 ? '+' : '') + myDelta;
      rightEl.className = 'stat-profit ' + (myDelta >= 0 ? 'positive' : 'negative');
    }
  } else if (gs.phase === 'result') {
    // Tổng nhận = thưởng chuỗi + điểm thưởng mỗi câu
    const grandTotal = computeGrandTotal(gs, _user.uid);
    const correctCount = gs.streaks?.[_user.uid]?.correctCount || 0;
    midEl.textContent = grandTotal > 0 ? 'WIN' : 'LOSE';
    statusEl.classList.add(grandTotal > 0 ? 'result-win' : 'result-lose');
    leftEl.textContent = fmtScore(grandTotal) + 'đ';
    leftEl.className = 'stat-bet ' + (grandTotal >= 0 ? 'positive' : 'negative');
    rightEl.textContent = `✅ ${correctCount}/15`;
    rightEl.className = 'stat-profit zero';
  }

  // ===== CÂU HỎI =====
  const qbox = document.getElementById('altp-qbox');
  const qtext = document.getElementById('altp-qtext');
  const optEl = document.getElementById('altp-options');
  const lifeEl = document.getElementById('altp-lifelines');
  const audEl = document.getElementById('altp-audience');
  const phoneEl = document.getElementById('altp-phone-msg');

  if (gs.phase === 'waiting') {
    // Show waiting message
    qbox.style.display = 'none';
    optEl.style.display = 'none';
    lifeEl.style.display = 'none';
    audEl.style.display = 'none';
    phoneEl.style.display = 'none';
  } else if (gs.phase === 'playing' || gs.phase === 'revealed') {
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
        if (gs.hiddenOptions?.includes(i) || _myLocalHidden.includes(i)) cls += ' hidden-5050';

        // Count how many players chose this option
        const count = gs.answerCounts?.[i] || 0;

        return `<button class="${cls}" id="altp-opt-${i}" onclick="selectAnswer(${i})" ${disabled ? 'disabled' : ''}>
          <span class="altp-opt-key">${keys[i]}.</span> ${esc(opt)}
          ${count > 0 ? `<span class="altp-opt-count">${count}</span>` : ''}
        </button>`;
      }).join('');

      // Show fastest badge if revealed
      if (gs.phase === 'revealed' && gs.fastestUid) {
        const fastestNote = document.getElementById('altp-fastest-note') || (() => {
          const el = document.createElement('div');
          el.id = 'altp-fastest-note';
          el.style.cssText = 'text-align:center;margin:8px 0;font-size:13px;font-weight:700';
          qbox.parentNode.insertBefore(el, qbox.nextSibling);
          return el;
        })();
        if (gs.fastestUid === _user.uid) {
          fastestNote.innerHTML = '⚡ Bạn trả lời nhanh nhất! +50 thưởng';
          fastestNote.style.color = '#fbbf24';
        } else {
          const info = r.memberInfo?.[gs.fastestUid];
          fastestNote.innerHTML = `⚡ ${esc(info?.name || 'Ai đó')} trả lời nhanh nhất! +50 thưởng`;
          fastestNote.style.color = '#38bdf8';
        }
        fastestNote.style.display = 'block';
      } else {
        const fn = document.getElementById('altp-fastest-note');
        if (fn) fn.style.display = 'none';
      }

      // Lifelines cho tất cả người chơi (riêng lẻ mỗi người)
      if (gs.phase === 'playing') {
        lifeEl.style.display = 'flex';
        const myLifelines = gs.lifelines?.[_user.uid] || {};
        document.getElementById('life-5050').disabled = myLifelines.fifty || false;
        document.getElementById('life-audience').disabled = myLifelines.audience || false;
        document.getElementById('life-phone').disabled = myLifelines.phone || false;
      } else {
        lifeEl.style.display = 'none';
      }

      // Audience result (Firestore or local)
      const audData = _myAudienceResult || (gs.lifelines?.[_user.uid]?.audience ? gs.audienceResult : null);
      if (audData) {
        audEl.style.display = 'flex';
        audEl.innerHTML = audData.map((v, i) =>
          `<div class="altp-audience-bar" style="height:${Math.max(v, 3)}%"><span>${keys[i]} ${v}%</span></div>`
        ).join('');
      } else {
        audEl.style.display = 'none';
      }

      // Phone result (Firestore or local)
      const phoneText = _myPhoneMsg || (gs.lifelines?.[_user.uid]?.phone ? gs.phoneMsg : null);
      if (phoneText) {
        phoneEl.textContent = phoneText;
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

  // ===== BẢNG XẾP HẠNG ONLINE =====
  const playersEl = document.getElementById('altp-players');
  const memberList = (r.members || []).filter(uid => uid !== r.hostUid);
  const hostId = r.hostUid;

  // Sort by online score descending
  const allPlayers = [hostId, ...memberList];
  const ranked = [...allPlayers].sort((a, b) => (gs.scores?.[b] || 0) - (gs.scores?.[a] || 0));

  playersEl.innerHTML = '';
  if (r.memberInfo) {
    ranked.forEach((uid, rankIdx) => {
      const info = r.memberInfo?.[uid] || {};
      const score = gs.scores?.[uid] || 0;
      const answered = gs.answers?.[uid] !== undefined && gs.answers?.[uid] !== null;
      const correct = gs.phase === 'revealed' && gs.answers?.[uid] === gs.currentQ?.c;
      const wrong = gs.phase === 'revealed' && answered && !correct;
      const isMe = uid === _user.uid;

      // Determine result styling
      let resultCls = '';
      let deltaStr = '';
      let grandTotal = 0;

      if (gs.phase === 'result') {
        grandTotal = computeGrandTotal(gs, uid);
        if (grandTotal > 0) resultCls = 'win';
        else if (grandTotal < 0) resultCls = 'lose';
      } else if (wrong) {
        resultCls = 'lose';
        deltaStr = '-50';
      } else if (correct) {
        resultCls = 'win';
        const wasFastest = gs.fastestUid === uid;
        deltaStr = wasFastest ? '+100' : '+50';
      }

      // Per-player streak display
      const myStreak = (gs.streaks || {})[uid] || {};
      const streakCount = myStreak.correctStreak || 0;
      const streakBroken = myStreak.streakBroken || false;

      // Rank medal
      let rankBadge = '';
      if (rankIdx === 0 && gs.phase === 'result') rankBadge = '🥇';
      else if (rankIdx === 1 && gs.phase === 'result') rankBadge = '🥈';
      else if (rankIdx === 2 && gs.phase === 'result') rankBadge = '🥉';

      const div = document.createElement('div');
      div.className = 'bc-pl';
      if (resultCls) div.classList.add(resultCls);

      // Streak display ở góc trên phải (thay thế icon tròn đỏ xanh)
      let streakIcon = '';
      if (streakCount > 0) {
        streakIcon = `🔥${streakCount}`;
      } else if (streakBroken) {
        streakIcon = '💔';
      }

      div.innerHTML = `
        <div class="bc-pl-name">
          ${rankBadge || `#${rankIdx + 1}`} ${esc(info.name || '?')} ${isMe ? '<span style="color:#fbbf24">(bạn)</span>' : ''} ${uid === hostId ? '👑' : ''}
        </div>
        ${streakIcon ? `<div class="bc-pl-status">${streakIcon}</div>` : ''}
        ${gs.phase === 'result'
          ? `<div class="bc-pl-bet-badge">${fmtScore(grandTotal)}đ</div>
             <div class="bc-pl-result-badge ${grandTotal > 0 ? 'win' : 'lose'}">✅ ${myStreak.correctCount || 0}/15</div>`
          : (score !== 0 ? `<div class="bc-pl-bet-badge">${fmtScore(score)}</div>` : '')}
        ${gs.phase !== 'result' && deltaStr ? `<div class="bc-pl-result-badge ${resultCls === 'win' ? 'win' : 'lose'}">${deltaStr}</div>` : ''}
      `;
      playersEl.appendChild(div);
    });
  }

  // ===== ACTIONS =====
  const actEl = document.getElementById('altp-actions');

  if (isHost) {
    if (gs.phase === 'waiting') {
      actEl.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="altp-act-btn altp-act-green" onclick="window.hostStartGame()" style="padding:14px 40px">🚀 BẮT ĐẦU</button>
        </div>`;
    } else if (gs.phase === 'playing') {
      const hasAnswers = Object.keys(gs.answers || {}).length > 0;
      actEl.innerHTML = `
        <button class="altp-act-btn altp-act-blue" ${hasAnswers ? '' : 'disabled'} onclick="window.hostReveal()">🔍 Lật đáp án</button>
        <button class="altp-act-btn altp-act-red" onclick="window.forceReveal()">⏰ Hết giờ</button>`;
    } else if (gs.phase === 'revealed') {
      const nextRoundEnabled = (gs.roundIdx || 0) < 15;
      actEl.innerHTML = `
        <button class="altp-act-btn altp-act-green" ${nextRoundEnabled ? '' : 'disabled'} onclick="window.hostNextQuestion()">➡️ Câu tiếp theo</button>
        ${!nextRoundEnabled ? '<button class="altp-act-btn altp-act-yellow" onclick="window.hostEndGame()">🏁 Kết thúc game</button>' : ''}`;
    } else if (gs.phase === 'result') {
      actEl.innerHTML = `
        <button class="altp-act-btn altp-act-green" onclick="window.hostRestartGame()" style="display:inline-flex;align-items:center;justify-content:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.35 1.83l1.46 1.46A6.995 6.995 0 0 0 19 13c0-3.87-3.13-7-7-7zm-6 7c0-.65.13-1.26.35-1.83L4.89 9.71A6.995 6.995 0 0 0 5 13c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5z"/></svg> Chơi lại</button>
        <button class="altp-act-btn altp-act-red" onclick="window.quitGame()" style="display:inline-flex;align-items:center;justify-content:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg> Rời phòng</button>`;
    }
  } else {
    // Non-host player actions
    if (gs.phase === 'waiting') {
      actEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:10px">⏳ Chờ host bắt đầu...</div>';
    } else if (gs.phase === 'playing') {
      const hasAnswered = gs.answers?.[_user.uid] !== undefined && gs.answers?.[_user.uid] !== null;
      actEl.innerHTML = hasAnswered
        ? '<div style="color:#34d399;text-align:center;padding:10px">✅ Đã trả lời! Chờ kết quả...</div>'
        : '<div style="color:#fbbf24;text-align:center;padding:10px">🤔 Đang chọn đáp án...</div>';
    } else if (gs.phase === 'revealed') {
      actEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:10px">⏳ Chờ host chuyển câu...</div>';
    } else if (gs.phase === 'result') {
      actEl.innerHTML = '<div style="color:#fbbf24;text-align:center;padding:10px">🏁 Game đã kết thúc!</div>';
    }
  }
}

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

    // Record answer and track order for fastest bonus
    const currentOrder = gs.answerOrder || [];
    const newOrder = currentOrder.includes(_user.uid) ? currentOrder : [...currentOrder, _user.uid];

    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.answers.${_user.uid}`]: idx,
      'gameState.answerOrder': newOrder
    });

    // Play sound: correct option or wrong
    const correct = gs.currentQ?.c;
    if (idx === correct) {
      playOnce('correct', { volume: 0.4 });
    } else {
      playOnce('wrong', { volume: 0.4 });
    }

    if (window.VTQuests) window.VTQuests.trackPlay('altp');
  } finally {
    _actionLock = false;
  }
};

// ========== HOST ACTIONS ==========

// Bước 1: Khởi tạo game với time limit
window.hostInitGame = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameType': 'altp',
      'gameState': {
        phase: 'waiting',
        timeLimit: _selectedTimeLimit || 30,
        scores: {},
        answers: {},
        answerOrder: [],
        answerCounts: {},
        currentQ: null,
        roundIdx: 0,
        usedQuestions: [],
        hiddenOptions: [],
        lifelines: {},
        audienceResult: null,
        phoneMsg: null,
        streaks: {},
        fastestUid: null,
        timerEndAt: null
      }
    });
    showToast('✅ Game đã sẵn sàng!', 'success');
  } catch (e) {
    showToast('Lỗi khởi tạo: ' + e.message, 'error');
  }
  _myLocalHidden = [];
  _myAudienceResult = null;
  _myPhoneMsg = null;
};

// Bước 2: Host bắt đầu game (chuyển từ waiting → playing câu 1)
window.hostStartGame = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  stopAll();
  play('bg', { loop: true, volume: 0.25 });
  // Trigger câu hỏi đầu tiên
  await hostNextQuestion(true);
};

// Bước 3: Chọn câu hỏi tiếp theo
window.hostNextQuestion = async function(isFirst = false) {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  const roundIdx = (gs.roundIdx || 0);

  // Check if all 15 questions done
  if (roundIdx >= 15 && !isFirst) {
    await hostEndGame();
    return;
  }

  const bank = await loadBank();
  const used = new Set(gs.usedQuestions || []);
  const q = pickQuestionFromBank(bank, used, roundIdx);
  if (!q) { showToast('Hết câu hỏi!', 'warn'); return; }

  // Convert used Set back to array (keys are like "de0", "de1", "vua5", etc.)
  const newUsed = [...used];
  const nextRoundIdx = roundIdx + 1;

  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'playing',
      'gameState.currentQ': q,
      'gameState.roundIdx': nextRoundIdx,
      'gameState.answers': {},
      'gameState.answerOrder': [],
      'gameState.answerCounts': {},
      'gameState.usedQuestions': newUsed,
      'gameState.hiddenOptions': [],
      'gameState.audienceResult': null,
      'gameState.phoneMsg': null,
      'gameState.fastestUid': null
    });
    showToast(`📝 Câu ${nextRoundIdx}/15!`, 'success');
    _myLocalHidden = [];
    _myAudienceResult = null;
    _myPhoneMsg = null;
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

// Bước 4: Lật đáp án + tính điểm
window.hostReveal = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  const gs = r.gameState;
  if (gs.phase !== 'playing') return;

  stopTimer();

  // Calculate answer counts
  const answers = gs.answers || {};
  const counts = [0, 0, 0, 0];
  for (const uid of Object.keys(answers)) {
    const ans = answers[uid];
    if (ans >= 0 && ans < 4) counts[ans]++;
  }

  const currentQ = gs.currentQ;
  const correct = currentQ?.c;
  const oldScores = gs.scores || {};
  const newScores = { ...oldScores };
  const oldStreaks = gs.streaks || {};
  const newStreaks = { ...oldStreaks };
  let fastestUid = null;

  // Determine fastest correct answer
  const answerOrder = gs.answerOrder || [];
  for (const uid of answerOrder) {
    const ans = answers[uid];
    if (ans === correct) {
      fastestUid = uid;
      break;
    }
  }

  // Calculate scores
  for (const uid of Object.keys(answers)) {
    const ans = answers[uid];
    if (ans === correct) {
      // +50 for correct
      newScores[uid] = (newScores[uid] || 0) + 50;
      // +50 bonus for fastest
      if (uid === fastestUid) {
        newScores[uid] = (newScores[uid] || 0) + 50;
      }
    } else {
      // -50 for wrong
      newScores[uid] = (newScores[uid] || 0) - 50;
    }
  }

  // Handle timeout (players who didn't answer)
  if (r.members) {
    for (const uid of r.members) {
      if (answers[uid] === undefined || answers[uid] === null) {
        // Not answered = wrong = -50
        if (gs.phase === 'playing') {
          newScores[uid] = (newScores[uid] || 0) - 50;
        }
      }
    }
  }

  // Update per-player streak (offline)
  if (correct !== undefined && r.members) {
    const roundIdx = gs.roundIdx || 1;
    for (const uid of r.members) {
      let ps = newStreaks[uid] || { correctStreak: 0, streakBroken: false, safePrize: 0, correctCount: 0 };
      ps = { ...ps };
      const ans = answers[uid];
      if (ans === correct) {
        // Correct answer: tăng chuỗi + tổng số câu đúng
        ps.correctCount = (ps.correctCount || 0) + 1;
        if (!ps.streakBroken) ps.correctStreak = (ps.correctStreak || 0) + 1;
      } else if (!ps.streakBroken) {
        // Wrong or unanswered: break streak, claim nearest safe milestone
        ps.streakBroken = true;
        let nearestSafe = 0;
        for (const si of SAFE_IDX) {
          if (si + 1 <= roundIdx - 1) nearestSafe = PRIZE_TABLE[si] || 0;
        }
        ps.safePrize = nearestSafe;
      }
      newStreaks[uid] = ps;
    }
  }

  play('correct');

  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'revealed',
      'gameState.answerCounts': counts,
      'gameState.scores': newScores,
      'gameState.streaks': newStreaks,
      'gameState.fastestUid': fastestUid
    });
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

// Force reveal (host ends timer early)
window.forceReveal = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  stopTimer();
  // Mark all unanswered as timeout
  const gs = r.gameState;
  const answers = { ...(gs.answers || {}) };
  // For members who haven't answered, they'll get -50 in hostReveal
  await hostReveal();
};



// Kết thúc game
window.hostEndGame = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  stopTimer();

  const gs = r.gameState;

  // Trả thưởng tổng cộng (streak + điểm thưởng mỗi câu), 1 lần duy nhất, gộp thành 1 batch để giảm số lần ghi
  if (r.members && r.members.length > 0) {
    const batch = writeBatch(db);
    let hasPayout = false;
    for (const uid of r.members) {
      const grandTotal = computeGrandTotal(gs, uid);
      if (grandTotal !== 0) {
        batch.update(doc(db, 'users', uid), { points: increment(grandTotal) });
        hasPayout = true;
      }
    }
    if (hasPayout) {
      try { await batch.commit(); } catch (e) {}
    }
  }

  stopAll();
  play('final');

  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState.phase': 'result'
    });
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

// Chơi lại
window.hostRestartGame = async function() {
  const r = _room;
  if (!r || r.hostUid !== _user.uid) return;
  try {
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      'gameState': {
        phase: 'waiting',
        timeLimit: _selectedTimeLimit || 30,
        scores: {},
        answers: {},
        answerOrder: [],
        answerCounts: {},
        currentQ: null,
        roundIdx: 0,
        usedQuestions: [],
        hiddenOptions: [],
        lifelines: {},
        audienceResult: null,
        phoneMsg: null,
        streaks: {},
        fastestUid: null,
        timerEndAt: null
      }
    });
    _myLocalHidden = [];
    _myAudienceResult = null;
    _myPhoneMsg = null;
    showToast('🔄 Đã reset game!', 'success');
    stopTimer();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
};

// ========== LIFELINES (Riêng lẻ mỗi người) ==========
window.useFiftyFifty = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (!gs.currentQ) return;
  const myLifelines = gs.lifelines?.[_user.uid] || {};
  if (myLifelines.fifty) return;

  const correct = gs.currentQ.c;
  const wrongIdxs = [0, 1, 2, 3].filter(i => i !== correct);
  const toHide = wrongIdxs.sort(() => Math.random() - 0.5).slice(0, 2);
  _myLocalHidden = toHide;

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.lifelines.${_user.uid}.fifty`]: true
  });

  // Ẩn options ngay lập tức
  toHide.forEach(i => {
    const btn = document.getElementById(`altp-opt-${i}`);
    if (btn) btn.style.visibility = 'hidden';
  });
};

window.useAskAudience = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (!gs.currentQ) return;
  const myLifelines = gs.lifelines?.[_user.uid] || {};
  if (myLifelines.audience) return;

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
  _myAudienceResult = vals;

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.lifelines.${_user.uid}.audience`]: true
  });
};

window.usePhoneFriend = async function() {
  const r = _room;
  if (!r) return;
  const gs = r.gameState;
  if (!gs.currentQ) return;
  const myLifelines = gs.lifelines?.[_user.uid] || {};
  if (myLifelines.phone) return;

  const correct = gs.currentQ.c;
  const keys = ['A', 'B', 'C', 'D'];
  const isRight = Math.random() < 0.75;
  const suggested = isRight ? correct : [0, 1, 2, 3].filter(i => i !== correct)[Math.floor(Math.random() * 3)];
  const confidence = isRight ? ['khá chắc chắn', 'khá tự tin'][Math.floor(Math.random() * 2)] : ['không chắc lắm', 'phân vân'][Math.floor(Math.random() * 2)];
  _myPhoneMsg = `📞 \"Tôi nghĩ đáp án là ${keys[suggested]}, tôi ${confidence}!\"`;

  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    [`gameState.lifelines.${_user.uid}.phone`]: true
  });
};

// ========== QUIT ==========
window.quitGame = async function() {
  stopTimer();
  try {
    const r = _room;
    if (r) {
      if (r.hostUid === _user.uid) {
        // Chuyển chủ phòng cho người kế tiếp thay vì xoá phòng
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db, 'rooms', ROOM_ID));
        } else {
          const newHost = remaining[0];
          const mi = r.memberInfo || {};
          delete mi[_user.uid];
          const wInfo = { ...(r.waitingMemberInfo || {}) };
          delete wInfo[_user.uid];
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            hostUid: newHost,
            members: arrayRemove(_user.uid),
            memberInfo: mi,
            waitingMembers: arrayRemove(_user.uid),
            waitingMemberInfo: wInfo
          });
        }
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
  location.href = '../../app/rooms.html';
};