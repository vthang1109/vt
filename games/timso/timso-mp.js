// timso-mp.js — Tìm Số Multiplayer qua phòng (rooms.js)
import { db, auth } from '../../points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================================================
//  STATE
// ============================================================
let roomId = null;
let roomData = null;
let myUid = null;
let myName = 'Bạn';
let myPoints = 0;

let board = [];        // mảng 100 số (1-100, đã xáo)
let found = [];        // mảng boolean 100 phần tử
let target = 1;        // số cần tìm (1-100)
let scores = { 1: 0, 2: 0 }; // điểm của P1, P2
let currentTurn = null; // uid của người đang chơi
let gameActive = false;
let gameOver = false;
let isMyTurn = false;
let turnTimeLeft = 10;
let turnTimerInterval = null;
let isProcessing = false;
let currentBet = 100;

// mapping: index trong members[] -> uid
let p1Uid = null;
let p2Uid = null;

let _unsubRoom = null;
const TURN_TIME = 10; // giây

// ============================================================
//  DOM REFS
// ============================================================
const $ = id => document.getElementById(id);
const statusEl = $('mp-status');
const p1El = $('mp-p1');
const p2El = $('mp-p2');
const p1Name = p1El.querySelector('.name');
const p2Name = p2El.querySelector('.name');
const p1Ready = $('mp-p1-ready');
const p2Ready = $('mp-p2-ready');
const p1Score = $('mp-score-p1');
const p2Score = $('mp-score-p2');
const btnReady = $('btn-ready-mp');
const btnStart = $('btn-start-mp');
const roomNameEl = $('mp-room-name');
const roomCodeEl = $('mp-room-code');
const resultModal = $('result-modal');
const waitingOverlay = $('mp-waiting-overlay');
const turnTimerEl = $('tsmp-turn-timer');
const boardEl = $('tsmp-board');
const tsStatus = $('tsmp-status');
const targetLabel = $('tsmp-target-label');
const remainingEl = $('tsmp-remaining');
const subEl = $('tsmp-sub');
const betDisplay = $('tsmp-bet-display');

// ============================================================
//  AUTH & INIT
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  myUid = user.uid;
  const snap = await getDoc(doc(db, 'users', user.uid));
  myName = snap.exists() ? (snap.data().nickname || user.email.split('@')[0]) : user.email.split('@')[0];
  myPoints = snap.exists() ? (snap.data().points || 0) : 0;

  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  if (!roomId) {
    statusEl.innerHTML = '⚠️ Không tìm thấy phòng. Quay lại danh sách.';
    return;
  }
  initRoom();
  updateNavPoints();
});

// ============================================================
//  UPDATE NAV POINTS
// ============================================================
function updateNavPoints() {
  const ptsStr = myPoints.toLocaleString('vi-VN');
  document.querySelectorAll('[data-points]').forEach(el => {
    el.textContent = ptsStr;
  });
  if (window.TopNav && typeof window.TopNav.setPoints === 'function') {
    window.TopNav.setPoints(myPoints);
  } else {
    const vtPts = document.getElementById('vtNavPts');
    if (vtPts) { vtPts.textContent = '⭐ ' + ptsStr; vtPts.classList.add('visible'); }
  }
  ['user-points-home', 'status-pts', 'pro-points', 'wd-pts', 'shPts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = ptsStr;
  });
}

// ============================================================
//  ROOM LISTENER
// ============================================================
function initRoom() {
  if (_unsubRoom) _unsubRoom();
  _unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (!snap.exists()) {
      statusEl.innerHTML = '❌ Phòng đã bị xoá hoặc không tồn tại.';
      return;
    }
    roomData = snap.data();
    renderRoomInfo();
    handleGameState(roomData);
  }, (err) => {
    console.error('room snapshot error', err);
    statusEl.innerHTML = '⚠️ Lỗi kết nối phòng.';
  });
}

// ============================================================
//  RENDER UI
// ============================================================
function renderRoomInfo() {
  if (!roomData) return;
  roomNameEl.textContent = roomData.name || 'Phòng Tìm Số';
  roomCodeEl.textContent = '#' + (roomData.code || '------');

  const members = roomData.members || [];
  const memberInfo = roomData.memberInfo || {};

  p1Uid = members[0] || null;
  p2Uid = members[1] || null;

  // P1
  if (p1Uid) {
    const info = memberInfo[p1Uid] || { name: '?', ready: false };
    p1Name.textContent = p1Uid === myUid ? myName + ' (bạn)' : info.name;
    p1Ready.textContent = info.ready ? '✅' : '⏳';
    p1Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p1Name.textContent = 'Đang chờ...';
    p1Ready.textContent = '⏳';
    p1Ready.className = 'wait-badge';
  }

  // P2
  if (p2Uid) {
    const info = memberInfo[p2Uid] || { name: '?', ready: false };
    p2Name.textContent = p2Uid === myUid ? myName + ' (bạn)' : info.name;
    p2Ready.textContent = info.ready ? '✅' : '⏳';
    p2Ready.className = info.ready ? 'ready-badge' : 'wait-badge';
  } else {
    p2Name.textContent = 'Đang chờ...';
    p2Ready.textContent = '⏳';
    p2Ready.className = 'wait-badge';
  }

  // Active turn highlight
  p1El.classList.toggle('active', currentTurn === p1Uid && gameActive && !gameOver);
  p2El.classList.toggle('active', currentTurn === p2Uid && gameActive && !gameOver);

  // Bắt đầu / sẵn sàng buttons
  const isHost = roomData.hostUid === myUid;
  if (isHost && roomData.status === 'lobby') {
    btnReady.style.display = 'none';
    btnStart.style.display = 'inline-block';
    const allReady = members.filter(u => u !== roomData.hostUid).every(u => memberInfo[u]?.ready);
    const enough = members.length >= 2;
    btnStart.disabled = !(allReady && enough);
    btnStart.textContent = enough ? (allReady ? '🚀 Bắt đầu' : '⏳ Chờ sẵn sàng') : '⏳ Cần 2 người';
  } else if (roomData.status === 'lobby') {
    btnStart.style.display = 'none';
    btnReady.style.display = 'inline-block';
    const myInfo = memberInfo[myUid] || { ready: false };
    btnReady.textContent = myInfo.ready ? '↩ Huỷ sẵn sàng' : '✅ Sẵn sàng';
    btnReady.classList.toggle('on', !!myInfo.ready);
  } else {
    btnReady.style.display = 'none';
    btnStart.style.display = 'none';
  }

  // Waiting overlay
  if (roomData.status === 'lobby' && members.length < 2) {
    waitingOverlay.classList.remove('hidden');
  } else {
    waitingOverlay.classList.add('hidden');
  }

  updateStatusBar();
}

// ============================================================
//  UPDATE STATUS BAR
// ============================================================
function updateStatusBar() {
  const members = roomData?.members || [];
  const memberInfo = roomData?.memberInfo || {};

  if (roomData?.status === 'lobby') {
    statusEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <span>🔄 Trong phòng chờ · ${members.length}/${roomData.maxPlayers || 2} người</span>
        <span style="color:#fbbf24;font-weight:700;">🪙 ${currentBet.toLocaleString('vi-VN')}</span>
      </div>
    `;
    statusEl.style.color = '#94a3b8';
    turnTimerEl.style.display = 'none';
    tsStatus.style.display = 'none';
    boardEl.style.display = 'none';
  } else if (roomData?.status === 'playing') {
    tsStatus.style.display = 'flex';
    boardEl.style.display = 'grid';
    turnTimerEl.style.display = 'block';

    if (gameActive && !gameOver) {
      const turnName = currentTurn === myUid ? 'bạn' : (memberInfo[currentTurn]?.name || 'đối thủ');
      const turnColor = currentTurn === myUid ? '#38bdf8' : '#f87171';

      statusEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span style="color:${turnColor};font-weight:800;">⚔️ Lượt của ${turnName}</span>
          <span style="color:#fbbf24;font-weight:700;">🪙 ${currentBet.toLocaleString('vi-VN')}</span>
        </div>
      `;
      statusEl.style.color = turnColor;

      // Turn timer
      const tCls = turnTimeLeft <= 3 ? 'tt-warn' : 'tt-active';
      turnTimerEl.innerHTML = `⏱️ <span class="${tCls}">${turnTimeLeft}s</span> — Lượt <span class="${tCls}">${turnName}</span>`;

      // Target & scores
      updateGameUI();
    } else if (gameOver) {
      // handled by result modal
    } else {
      statusEl.innerHTML = `<span>⏳ Đang tải trận đấu...</span>`;
      statusEl.style.color = '#94a3b8';
    }
  }
}

function updateGameUI() {
  if (!p1Uid || !p2Uid) return;
  const memberInfo = roomData?.memberInfo || {};
  const gameScores = roomData?.gameState?.scores || {};

  p1Score.textContent = gameScores[p1Uid] || 0;
  p2Score.textContent = gameScores[p2Uid] || 0;

  // Target number
  const gs = roomData?.gameState || {};
  const gsTarget = gs.target || 1;
  targetLabel.textContent = `🎯 ${gsTarget}`;
  const totalFound = gs.foundCount || 0;
  remainingEl.textContent = 100 - totalFound;
  subEl.textContent = `Số còn lại`;
  betDisplay.textContent = currentBet > 0 ? `🪙 ${currentBet.toLocaleString('vi-VN')}` : '';
}

// ============================================================
//  HANDLE GAME STATE
// ============================================================
function handleGameState(data) {
  if (data.status !== 'playing') {
    gameActive = false;
    gameOver = false;
    boardEl.classList.remove('mp-clickable', 'mp-disabled');
    boardEl.classList.add('mp-disabled');
    clearInterval(turnTimerInterval);
    return;
  }

  const gs = data.gameState || {};
  if (!gs.board) return;

  if (gs.bet) currentBet = gs.bet;

  // Parse board
  board = gs.board || [];
  found = gs.found || [];
  target = gs.target || 1;
  currentTurn = gs.currentTurn || null;
  gameOver = gs.winner !== null && gs.winner !== undefined;
  gameActive = !gameOver;

  // Scores
  if (gs.scores) {
    scores = gs.scores;
  }

  isMyTurn = currentTurn === myUid && !gameOver;

  // Render board
  renderBoard();

  // Turn timer
  if (gameActive && !gameOver) {
    if (gs.turnTimeLeft !== undefined) {
      turnTimeLeft = gs.turnTimeLeft;
    }
    startTurnTimer();
  } else {
    clearInterval(turnTimerInterval);
    boardEl.classList.remove('mp-clickable');
    boardEl.classList.add('mp-disabled');
  }

  // Clickable state
  if (isMyTurn && gameActive) {
    boardEl.classList.remove('mp-disabled');
    boardEl.classList.add('mp-clickable');
  } else {
    boardEl.classList.remove('mp-clickable');
    boardEl.classList.add('mp-disabled');
  }

  renderRoomInfo();

  if (gs.winner) {
    if (gs.winner !== 'draw') {
      showResultFromState(gs);
    } else {
      showResult('🤝', 'Hòa!', `+${currentBet.toLocaleString('vi-VN')} (hoàn cược)`, 'Cùng tìm được số lượng bằng nhau');
    }
  }
}

// ============================================================
//  BOARD RENDER
// ============================================================
function renderBoard() {
  if (!board || board.length === 0) {
    boardEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;grid-column:1/-1">Đang tạo bảng...</div>';
    return;
  }

  boardEl.innerHTML = board.map((num, idx) => {
    const isFound = found && found[idx];
    let cls = 'ts-cell';
    if (isFound) {
      // Xác định màu theo người tìm
      const owner = found[idx];
      if (owner === p1Uid) cls += ' correct-p1';
      else if (owner === p2Uid) cls += ' correct-p2';
      else cls += ' correct';
    }
    const disabled = isFound ? 'disabled' : '';
    return `<button class="${cls}" data-idx="${idx}" data-num="${num}" onclick="handleCellClick(${idx})" ${disabled}>${num}</button>`;
  }).join('');
}

// ============================================================
//  TURN TIMER
// ============================================================
function startTurnTimer() {
  clearInterval(turnTimerInterval);
  turnTimerInterval = setInterval(() => {
    turnTimeLeft--;
    if (turnTimeLeft <= 0) {
      clearInterval(turnTimerInterval);
      handleTurnTimeout();
    } else {
      updateTurnTimerDisplay();
    }
  }, 1000);
}

function stopTurnTimer() {
  clearInterval(turnTimerInterval);
  turnTimerInterval = null;
}

function updateTurnTimerDisplay() {
  if (!turnTimerEl || turnTimerEl.style.display === 'none') return;
  const memberInfo = roomData?.memberInfo || {};
  const turnName = currentTurn === myUid ? 'bạn' : (memberInfo[currentTurn]?.name || 'đối thủ');
  const tCls = turnTimeLeft <= 3 ? 'tt-warn' : 'tt-active';
  turnTimerEl.innerHTML = `⏱️ <span class="${tCls}">${turnTimeLeft}s</span> — Lượt <span class="${tCls}">${turnName}</span>`;
}

// ============================================================
//  TURN TIMEOUT
// ============================================================
async function handleTurnTimeout() {
  if (!gameActive || gameOver || isProcessing) return;
  isProcessing = true;

  try {
    window.showToast(`⏰ Hết giờ! Chuyển lượt`, 'warn');

    // Switch turn
    const nextTurn = currentTurn === p1Uid ? p2Uid : p1Uid;
    const gs = roomData?.gameState || {};

    const newGs = {
      ...gs,
      currentTurn: nextTurn,
      turnTimeLeft: TURN_TIME,
      lastAction: 'timeout'
    };

    await updateDoc(doc(db, 'rooms', roomId), { gameState: newGs });

  } catch (err) {
    console.error('handleTurnTimeout error:', err);
  } finally {
    isProcessing = false;
  }
}

// ============================================================
//  CELL CLICK
// ============================================================
window.handleCellClick = async function(idx) {
  if (!gameActive || gameOver || !isMyTurn || isProcessing) {
    if (!isMyTurn && gameActive && !gameOver) {
      window.showToast('🔴 Chưa đến lượt bạn!', 'warn');
    }
    return;
  }
  if (!roomId || !roomData) return;
  if (!board || !found) return;
  if (found[idx]) return; // đã tìm thấy

  const num = board[idx];
  const gs = roomData?.gameState || {};
  const gsTarget = gs.target || 1;

  if (num === gsTarget) {
    await handleCorrectClick(idx, gs);
  } else {
    await handleWrongClick(idx);
  }
};

async function handleCorrectClick(idx, gs) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const cellEl = boardEl.querySelector(`[data-idx="${idx}"]`);
    if (cellEl) { cellEl.classList.add('correct-p' + (currentTurn === p1Uid ? '1' : '2')); cellEl.disabled = true; }

    const newFound = (gs.found || []).slice();
    newFound[idx] = currentTurn;

    const newScores = { ...(gs.scores || {}) };
    newScores[currentTurn] = (newScores[currentTurn] || 0) + 1;

    const newTarget = (gs.target || 1) + 1;
    const foundCount = newFound.filter(f => f).length;

    const newGs = {
      ...gs,
      found: newFound,
      scores: newScores,
      target: newTarget,
      foundCount: foundCount,
      currentTurn: currentTurn, // giữ lượt nếu đúng
      turnTimeLeft: TURN_TIME,
      lastAction: 'correct',
      bet: currentBet
    };

    // Check win
    if (newTarget > 100) {
      const s1 = newScores[p1Uid] || 0;
      const s2 = newScores[p2Uid] || 0;

      if (s1 > s2) {
        newGs.winner = p1Uid;
      } else if (s2 > s1) {
        newGs.winner = p2Uid;
      } else {
        newGs.winner = 'draw';
      }
      gameOver = true;
      gameActive = false;
    }

    await updateDoc(doc(db, 'rooms', roomId), { gameState: newGs });

    if (newGs.winner) {
      if (newGs.winner === myUid) {
        const winAmount = currentBet * 2;
        try {
          const { addPoints } = await import('../../points.js');
          await addPoints('Tìm Số MP', `Thắng game (cược ${currentBet.toLocaleString('vi-VN')})`, winAmount);
          myPoints += winAmount;
          updateNavPoints();
        } catch (e) {}
      } else if (newGs.winner === 'draw') {
        try {
          const { addPoints } = await import('../../points.js');
          await addPoints('Tìm Số MP', `Hoàn cược (hòa)`, currentBet);
          myPoints += currentBet;
          updateNavPoints();
        } catch (e) {}
      }
      setTimeout(() => {
        if (newGs.winner === myUid) {
          showResult('🏆', '🎉 Bạn thắng!', `+${(currentBet * 2).toLocaleString('vi-VN')} điểm`, `Thắng cược ${currentBet.toLocaleString('vi-VN')}`);
        } else if (newGs.winner === 'draw') {
          showResult('🤝', 'Hòa!', `+${currentBet.toLocaleString('vi-VN')} (hoàn cược)`, 'Cùng tìm được số lượng bằng nhau');
        } else {
          const winnerName = roomData?.memberInfo?.[newGs.winner]?.name || 'Đối thủ';
          showResult('😔', `${winnerName} thắng!`, `-${currentBet.toLocaleString('vi-VN')} điểm`, 'Lần sau cố gắng nhé!');
        }
      }, 500);
    }
  } catch (err) {
    console.error('handleCorrectClick error:', err);
  } finally {
    isProcessing = false;
  }
}

async function handleWrongClick(idx) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const cellEl = boardEl.querySelector(`[data-idx="${idx}"]`);
    if (cellEl) {
      cellEl.classList.add('wrong');
      setTimeout(() => cellEl.classList.remove('wrong'), 300);
    }

    window.showToast('❌ Sai số! Chuyển lượt', 'error');

    // Switch turn
    const nextTurn = currentTurn === p1Uid ? p2Uid : p1Uid;
    const gs = roomData?.gameState || {};

    const newGs = {
      ...gs,
      currentTurn: nextTurn,
      turnTimeLeft: TURN_TIME,
      lastAction: 'wrong'
    };

    await updateDoc(doc(db, 'rooms', roomId), { gameState: newGs });

  } catch (err) {
    console.error('handleWrongClick error:', err);
  } finally {
    isProcessing = false;
  }
}

// ============================================================
//  RESULT
// ============================================================
function showResultFromState(gs) {
  const winner = gs.winner;
  if (winner === 'draw') {
    showResult('🤝', 'Hòa!', `+${currentBet.toLocaleString('vi-VN')} (hoàn cược)`, 'Không ai thắng');
    return;
  }
  const isMe = winner === myUid;
  const memberInfo = roomData.memberInfo || {};
  const winnerName = isMe ? 'Bạn' : (memberInfo[winner]?.name || 'Người chơi');

  if (isMe) {
    showResult('🏆', '🎉 Bạn thắng!', `+${(currentBet * 2).toLocaleString('vi-VN')} điểm`, `Thắng cược ${currentBet.toLocaleString('vi-VN')}`);
  } else {
    showResult('😔', `${winnerName} thắng!`, `-${currentBet.toLocaleString('vi-VN')} điểm`, 'Lần sau cố gắng nhé!');
  }
}

function showResult(emoji, title, pts, sub) {
  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-pts').textContent = pts || '';
  document.getElementById('result-sub').textContent = sub || '';
  resultModal.classList.remove('hidden');
}

// ============================================================
//  RESET GAME
// ============================================================
window.closeResultAndContinue = function() {
  resultModal.classList.add('hidden');
  resetGameState();
};

async function resetGameState() {
  if (!roomId || !roomData) return;
  try {
    const members = roomData.members || [];
    const p1 = members[0] || null;
    const p2 = members[1] || null;

    // Tạo board mới
    const newBoard = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
    const newFound = Array(100).fill(null);

    gameOver = false;
    gameActive = true;
    isProcessing = false;
    currentTurn = p1;
    isMyTurn = p1 === myUid;
    turnTimeLeft = TURN_TIME;

    const newGs = {
      board: newBoard,
      found: newFound,
      target: 1,
      foundCount: 0,
      scores: {},
      currentTurn: p1,
      winner: null,
      lastAction: null,
      turnTimeLeft: TURN_TIME,
      players: members,
      bet: currentBet
    };
    // Gán score ban đầu cho cả 2 thành 0
    newGs.scores[p1] = 0;
    newGs.scores[p2] = 0;

    await updateDoc(doc(db, 'rooms', roomId), { gameState: newGs });

    renderBoard();
    renderRoomInfo();
    window.showToast(`🔄 Ván mới! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');

  } catch (err) {
    console.error('resetGameState error:', err);
    window.showToast('Không thể reset game', 'error');
  }
}

// ============================================================
//  SHUFFLE
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
//  READY / START
// ============================================================
window.toggleMpReady = async function() {
  if (!roomId || !roomData) return;
  const memberInfo = roomData.memberInfo || {};
  const me = memberInfo[myUid] || { name: myName, ready: false };
  me.ready = !me.ready;
  memberInfo[myUid] = me;
  await updateDoc(doc(db, 'rooms', roomId), { memberInfo });
};

window.startMpGame = async function() {
  if (!roomId || !roomData) return;
  if (roomData.hostUid !== myUid) {
    window.showToast('Chỉ chủ phòng mới bắt đầu được', 'warn');
    return;
  }
  const members = roomData.members || [];
  if (members.length < 2) {
    window.showToast('Cần ít nhất 2 người', 'warn');
    return;
  }

  if (myPoints < currentBet) {
    window.showToast(`❌ Bạn không đủ tiền! Cần ${currentBet.toLocaleString('vi-VN')}, bạn có ${myPoints.toLocaleString('vi-VN')}`, 'error');
    return;
  }

  // Trừ tiền host
  try {
    const { addPoints } = await import('../../points.js');
    await addPoints('Tìm Số MP', `Đặt cược ${currentBet.toLocaleString('vi-VN')}`, -currentBet);
    myPoints -= currentBet;
    updateNavPoints();
  } catch (e) {
    window.showToast('❌ Không thể trừ tiền cược!', 'error');
    return;
  }

  const p1 = members[0];
  const p2 = members[1];

  // Tạo board
  const newBoard = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  const newFound = Array(100).fill(null);
  const scores = {};
  scores[p1] = 0;
  scores[p2] = 0;

  const gameState = {
    board: newBoard,
    found: newFound,
    target: 1,
    foundCount: 0,
    scores: scores,
    currentTurn: p1,
    winner: null,
    lastAction: null,
    turnTimeLeft: TURN_TIME,
    players: members,
    bet: currentBet
  };

  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    gameState,
    startedAt: serverTimestamp()
  });

  window.showToast(`🚀 Trận đấu bắt đầu! Cược ${currentBet.toLocaleString('vi-VN')}`, 'success');
};

// ============================================================
//  LEAVE ROOM
// ============================================================
window.leaveMpRoom = async function() {
  if (!roomId) {
    window.location.href = 'rooms.html';
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.hostUid === myUid && data.status === 'lobby') {
        await deleteDoc(doc(db, 'rooms', roomId));
      } else {
        const memberInfo = data.memberInfo || {};
        delete memberInfo[myUid];
        await updateDoc(doc(db, 'rooms', roomId), {
          members: data.members.filter(u => u !== myUid),
          memberInfo
        });
      }
    }
  } catch (err) {
    console.error('leave error:', err);
  }
  if (_unsubRoom) { _unsubRoom(); _unsubRoom = null; }
  window.location.href = 'rooms.html';
};

// ============================================================
//  TOAST HELPER
// ============================================================
window.showToast = function(msg, type = 'info') {
  const c = { info: '#38bdf8', success: '#34d399', warn: '#fbbf24', error: '#f87171' };
  const t = document.createElement('div');
  t.style.cssText = `pointer-events:all;padding:11px 16px;border-radius:12px;background:rgba(4,20,40,0.97);border:1px solid ${c[type]||c.info};color:#e0f2fe;font-size:13px;font-weight:400;font-family:'Science Gothic', sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

console.log('🎮 Tìm Số Multiplayer loaded');
console.log(`🪙 Mức cược mặc định: ${currentBet.toLocaleString('vi-VN')}`);
