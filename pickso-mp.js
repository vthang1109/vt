// pickso-mp.js — Pick Số Multiplayer
// Luật: mỗi người lần lượt chọn 1 ô (1–100), ai chiếm nhiều ô hơn khi hết thì thắng
// Firestore writes tối thiểu: mỗi lượt = 1 updateDoc, settle = 1 updateDoc

import { db, auth, addPoints, getPoints } from './points.js';
import { getActiveBuff } from './pet.js';
import {
  doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const ROOM_ID = new URLSearchParams(location.search).get('room');
if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

let _user = null, _unsub = null, _unsubMe = null;
let _myBalance = 0;
let _settled = false; // chặn settle nhiều lần

// Màu cho từng người chơi (tối đa 6)
const COLORS = [
  { bg: 'rgba(56,189,248,.35)',  border: '#38bdf8', text: '#38bdf8',  label: '#38bdf8'  },
  { bg: 'rgba(248,113,113,.35)', border: '#f87171', text: '#f87171',  label: '#f87171'  },
  { bg: 'rgba(52,211,153,.35)',  border: '#34d399', text: '#34d399',  label: '#34d399'  },
  { bg: 'rgba(251,191,36,.35)',  border: '#fbbf24', text: '#fbbf24',  label: '#fbbf24'  },
  { bg: 'rgba(167,139,250,.35)', border: '#a78bfa', text: '#a78bfa',  label: '#a78bfa'  },
  { bg: 'rgba(251,146,60,.35)',  border: '#fb923c', text: '#fb923c',  label: '#fb923c'  },
];

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ========== AUTH ==========
onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'index.html'; return; }
  _user = u;
  // Lắng nghe balance (chỉ 1 listener)
  _unsubMe = onSnapshot(doc(db, 'users', _user.uid), s => {
    if (s.exists()) {
      _myBalance = s.data().points || 0;
      const el = document.getElementById('ps-balance');
      if (el) el.textContent = _myBalance.toLocaleString('vi-VN') + ' đ';
    }
  });
  if (ROOM_ID) startListen();
});

// ========== LISTEN ==========
function startListen() {
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db, 'rooms', ROOM_ID), snap => {
    if (!snap.exists()) {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>';
      return;
    }
    const r = snap.data();
    document.getElementById('ps-room').textContent = '#' + (r.code || '------');
    if (r.gameType !== 'pickso' || !r.gameState) return;
    render(r);
  });
}

// ========== RENDER ==========
function render(r) {
  const gs = r.gameState;
  const members = r.members || [];
  const isHost = r.hostUid === _user.uid;

  // Gán màu ổn định theo thứ tự members
  const colorMap = {}; // uid → color index
  members.forEach((uid, i) => colorMap[uid] = COLORS[i % COLORS.length]);

  // Phase text
  const phEl = document.getElementById('ps-phase');
  if (gs.phase === 'betting') {
    const myBet = gs.bets?.[_user.uid] || 0;
    phEl.textContent = myBet > 0 ? '✅ Đã đặt cược — Chờ người khác...' : '🎰 Đặt cược để bắt đầu';
  } else if (gs.phase === 'playing') {
    const turnUid = members[gs.turnIdx % members.length];
    if (turnUid === _user.uid) phEl.textContent = '🎯 Đến lượt BẠN — Chọn một ô!';
    else phEl.textContent = `⏳ Chờ ${esc(r.memberInfo?.[turnUid]?.name || '...')} chọn...`;
  } else if (gs.phase === 'result') {
    phEl.textContent = '🏆 Kết quả!';
  }

  // Bet row
  const betRow = document.getElementById('ps-bet-row');
  const myBet = gs.bets?.[_user.uid] || 0;
  betRow.style.display = (gs.phase === 'betting' && myBet === 0) ? 'flex' : 'none';

  // Scoreboard
  renderScores(r, colorMap);

  // Grid
  const gridWrap = document.getElementById('ps-grid-wrap');
  const turnBar = document.getElementById('ps-turn-bar');
  const legend = document.getElementById('ps-legend');

  if (gs.phase === 'playing' || gs.phase === 'result') {
    gridWrap.style.display = 'block';
    turnBar.style.display = 'block';
    legend.style.display = 'flex';
    renderGrid(r, colorMap);
    renderLegend(r, colorMap);
    renderTurnBar(r, colorMap);
  } else {
    gridWrap.style.display = 'none';
    turnBar.style.display = 'none';
    legend.style.display = 'none';
  }

  // Result
  const resEl = document.getElementById('ps-result');
  if (gs.phase === 'result') {
    resEl.style.display = 'block';
    renderResult(r, colorMap);
    // Settle points (chỉ 1 lần)
    if (!_settled) {
      _settled = true;
      settleMyResult(r, colorMap);
    }
  } else {
    resEl.style.display = 'none';
    _settled = false;
  }

  // Actions
  renderActions(r, isHost, colorMap);
}

function renderScores(r, colorMap) {
  const gs = r.gameState;
  const members = r.members || [];
  const picks = gs.picks || {}; // uid → [numbers]
  const el = document.getElementById('ps-scores');
  el.innerHTML = '';
  members.forEach(uid => {
    const col = colorMap[uid];
    const name = r.memberInfo?.[uid]?.name || '?';
    const count = (picks[uid] || []).length;
    const bet = gs.bets?.[uid] || 0;
    const isMyTurn = gs.phase === 'playing' && members[gs.turnIdx % members.length] === uid;
    const isWinner = gs.phase === 'result' && gs.winners?.includes(uid);
    const div = document.createElement('div');
    div.className = 'ps-score-card' + (isMyTurn ? ' my-turn' : '') + (isWinner ? ' winner' : '');
    div.style.borderColor = isMyTurn ? col.border : (isWinner ? '#fbbf24' : '');
    div.innerHTML = `
      <div class="sc-name" style="color:${col.label}">${esc(uid === _user.uid ? 'Bạn' : name)}</div>
      <div class="sc-count" style="color:${col.text}">${count}</div>
      <div class="sc-bet">${bet > 0 ? bet.toLocaleString('vi-VN') + 'đ' : 'chưa cược'}</div>
      ${isWinner ? '<div class="sc-tag" style="color:#fbbf24">🏆 Thắng!</div>' : ''}
    `;
    el.appendChild(div);
  });
}

function renderGrid(r, colorMap) {
  const gs = r.gameState;
  const members = r.members || [];
  const picks = gs.picks || {};
  const isMyTurn = gs.phase === 'playing' && members[gs.turnIdx % members.length] === _user.uid;

  // Build reverse map: number → uid
  const numOwner = {};
  members.forEach(uid => {
    (picks[uid] || []).forEach(n => numOwner[n] = uid);
  });

  const grid = document.getElementById('ps-grid');
  grid.innerHTML = '';
  for (let n = 1; n <= 100; n++) {
    const owner = numOwner[n];
    const cell = document.createElement('div');
    cell.className = 'ps-cell';
    cell.textContent = n;

    if (owner) {
      const col = colorMap[owner];
      cell.classList.add('taken');
      if (owner === _user.uid) cell.classList.add('mine');
      cell.style.background = col.bg;
      cell.style.borderColor = col.border;
      cell.style.color = col.text;
    } else if (gs.phase === 'playing') {
      if (!isMyTurn) cell.classList.add('disabled');
      else cell.onclick = () => pickNumber(n);
    }

    grid.appendChild(cell);
  }
}

function renderLegend(r, colorMap) {
  const members = r.members || [];
  const el = document.getElementById('ps-legend');
  el.innerHTML = '';
  members.forEach(uid => {
    const col = colorMap[uid];
    const name = r.memberInfo?.[uid]?.name || '?';
    const item = document.createElement('div');
    item.className = 'ps-legend-item';
    item.innerHTML = `<div class="ps-legend-dot" style="background:${col.bg};border:1.5px solid ${col.border}"></div><span style="color:${col.label}">${esc(uid === _user.uid ? 'Bạn' : name)}</span>`;
    el.appendChild(item);
  });
}

function renderTurnBar(r, colorMap) {
  const gs = r.gameState;
  const members = r.members || [];
  const el = document.getElementById('ps-turn-bar');
  if (gs.phase !== 'playing') { el.style.display = 'none'; return; }
  const totalPicked = Object.values(gs.picks || {}).reduce((s, arr) => s + arr.length, 0);
  const turnUid = members[gs.turnIdx % members.length];
  const col = colorMap[turnUid];
  const name = turnUid === _user.uid ? 'Bạn' : (r.memberInfo?.[turnUid]?.name || '?');
  el.style.display = 'block';
  el.innerHTML = `Lượt ${totalPicked + 1}/100 — <span style="color:${col?.label}">${esc(name)}</span> đang chọn`;
}

function renderResult(r, colorMap) {
  const gs = r.gameState;
  const members = r.members || [];
  const picks = gs.picks || {};
  const el = document.getElementById('ps-result');

  // Sort by count desc
  const sorted = [...members].sort((a, b) => (picks[b]||[]).length - (picks[a]||[]).length);
  const maxCount = (picks[sorted[0]] || []).length;
  const winners = gs.winners || [];

  let html = '<h3>🏆 Kết quả</h3>';
  sorted.forEach(uid => {
    const col = colorMap[uid];
    const name = uid === _user.uid ? 'Bạn' : (r.memberInfo?.[uid]?.name || '?');
    const count = (picks[uid] || []).length;
    const bet = gs.bets?.[uid] || 0;
    const isWinner = winners.includes(uid);
    const isDraw = winners.length > 1 && isWinner;
    const delta = gs.deltas?.[uid] || 0;
    const cls = isWinner ? (isDraw ? 'res-draw' : 'res-win') : 'res-lose';
    const sign = delta > 0 ? '+' : '';
    html += `<div class="ps-result-row">
      <span style="color:${col.label};font-weight:700">${esc(name)}</span>
      <span>${count} ô · ${bet.toLocaleString('vi-VN')}đ</span>
      <span class="${cls}">${sign}${delta.toLocaleString('vi-VN')}đ</span>
    </div>`;
  });
  el.innerHTML = html;
}

function renderActions(r, isHost, colorMap) {
  const gs = r.gameState;
  const el = document.getElementById('ps-actions');
  el.innerHTML = '';
  if (gs.phase === 'betting' && isHost) {
    // Host có thể start khi tất cả đã bet
    const members = r.members || [];
    const allBet = members.every(uid => (gs.bets?.[uid] || 0) > 0);
    if (allBet) {
      const btn = document.createElement('button');
      btn.className = 'btn-ps-start';
      btn.textContent = '🎮 Bắt đầu!';
      btn.onclick = hostStart;
      el.appendChild(btn);
    }
  }
  if (gs.phase === 'result' && isHost) {
    const btn = document.createElement('button');
    btn.className = 'btn-ps-next';
    btn.textContent = '▶ Vòng mới';
    btn.onclick = hostNextRound;
    el.appendChild(btn);
  }
}

// ========== ACTIONS ==========

// Đặt cược — 1 write
window.placeBet = async function() {
  const amt = parseInt(document.getElementById('ps-bet-input').value);
  if (!amt || amt < 50) { showToast('Cược tối thiểu 50đ', 'warn'); return; }
  if (amt > _myBalance) { showToast('Không đủ điểm!', 'error'); return; }
  try {
    await addPoints('Casino', 'Cược Pick Số', -amt);
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.bets.${_user.uid}`]: amt
    });
    showToast('✅ Đã đặt cược!', 'success');
  } catch(e) { showToast('Lỗi đặt cược', 'error'); }
};

// Host bắt đầu game — 1 write
async function hostStart() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  // Shuffle turn order
  const members = [...(r.members || [])];
  for (let i = members.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [members[i],members[j]]=[members[j],members[i]];
  }
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'playing',
    'gameState.turnOrder': members,
    'gameState.turnIdx': 0,
    'gameState.picks': Object.fromEntries(r.members.map(u => [u, []]))
  });
}

// Chọn số — 1 write per pick
async function pickNumber(n) {
  if (!_user) return;
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  const gs = r.gameState;
  const members = r.members || [];
  const turnUid = (gs.turnOrder || members)[gs.turnIdx % members.length];
  if (turnUid !== _user.uid) { showToast('Chưa đến lượt bạn!', 'warn'); return; }

  const allPicks = gs.picks || {};
  const numOwner = {};
  members.forEach(uid => (allPicks[uid]||[]).forEach(x => numOwner[x] = uid));
  if (numOwner[n]) { showToast('Số này đã được chọn!', 'warn'); return; }

  const myPicks = [...(allPicks[_user.uid] || []), n];
  const totalPicked = Object.values(allPicks).reduce((s,a) => s+a.length, 0) + 1;
  const nextTurnIdx = gs.turnIdx + 1;

  // Nếu hết 100 ô → chuyển sang result, tính winner ngay trong cùng 1 write
  if (totalPicked === 100) {
    // Tính winner
    const newPicks = { ...allPicks, [_user.uid]: myPicks };
    const counts = {};
    members.forEach(uid => counts[uid] = (newPicks[uid]||[]).length);
    const maxC = Math.max(...Object.values(counts));
    const winners = members.filter(u => counts[u] === maxC);
    const totalBet = members.reduce((s,u) => s + (gs.bets?.[u]||0), 0);

    // Tính delta: winner(s) chia đôi pot, loser mất cược
    const deltas = {};
    members.forEach(uid => {
      const bet = gs.bets?.[uid] || 0;
      if (winners.includes(uid)) {
        // Được hoàn cược + chia phần thắng từ losers
        const loserTotal = members.filter(u => !winners.includes(u)).reduce((s,u)=>s+(gs.bets?.[u]||0),0);
        deltas[uid] = Math.floor(loserTotal / winners.length); // net gain (cược đã bị trừ trước)
      } else {
        deltas[uid] = -bet;
      }
    });

    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.picks.${_user.uid}`]: myPicks,
      'gameState.phase': 'result',
      'gameState.winners': winners,
      'gameState.deltas': deltas,
      'gameState.turnIdx': nextTurnIdx
    });
  } else {
    // Chỉ cập nhật pick + turnIdx — 1 write
    await updateDoc(doc(db, 'rooms', ROOM_ID), {
      [`gameState.picks.${_user.uid}`]: myPicks,
      'gameState.turnIdx': nextTurnIdx
    });
  }
}

// ========== SETTLE POINTS ==========
// Chỉ gọi 1 lần khi phase = result, mỗi client tự settle cho mình
async function settleMyResult(r, colorMap) {
  const gs = r.gameState;
  const delta = gs.deltas?.[_user.uid];
  if (delta === undefined) return;
  const bet = gs.bets?.[_user.uid] || 0;
  const winners = gs.winners || [];
  const isWinner = winners.includes(_user.uid);
  const isDraw = winners.length > 1 && isWinner;

  if (isWinner) {
    // Hoàn cược
    try { await addPoints('Casino', 'Hoàn cược Pick Số', bet); } catch(e) {}
    // Tiền thắng (có pet buff)
    if (delta > 0) {
      try { await addPoints('Casino', 'Thắng Pick Số', delta); } catch(e) {}
      showToast(`🎉 ${isDraw ? 'Hoà thắng' : 'Thắng'} +${delta.toLocaleString('vi-VN')}đ!`, 'success');
    } else {
      showToast('🤝 Hoà — hoàn cược!', 'info');
    }
    if (window.VTQuests) {
      window.VTQuests.trackEarn(bet + delta);
      if (!isDraw) window.VTQuests.trackWinSmart();
    }
  } else {
    showToast(`💸 Thua ${bet.toLocaleString('vi-VN')}đ`, 'warn');
  }
}

// ========== HOST NEXT ROUND ==========
async function hostNextRound() {
  const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  _settled = false;
  await updateDoc(doc(db, 'rooms', ROOM_ID), {
    'gameState.phase': 'betting',
    'gameState.bets': {},
    'gameState.picks': {},
    'gameState.turnOrder': [],
    'gameState.turnIdx': 0,
    'gameState.winners': [],
    'gameState.deltas': {},
    'gameState.round': (r.gameState.round || 1) + 1
  });
}

// ========== QUIT ==========
window.quitGame = async function() {
  try {
    const snap = await getDoc(doc(db, 'rooms', ROOM_ID));
    if (snap.exists()) {
      const r = snap.data();
      // Hoàn cược nếu đang betting
      if (r.gameState?.phase === 'betting') {
        const myBet = r.gameState.bets?.[_user.uid] || 0;
        if (myBet > 0) {
          try { await addPoints('Casino', 'Hoàn cược Pick Số', myBet); } catch(e) {}
        }
      }
      if (r.hostUid === _user.uid) {
        await deleteDoc(doc(db, 'rooms', ROOM_ID));
      } else {
        const remaining = (r.members||[]).filter(u => u !== _user.uid);
        if (!remaining.length) {
          await deleteDoc(doc(db, 'rooms', ROOM_ID));
        } else {
          const mi = { ...(r.memberInfo || {}) };
          delete mi[_user.uid];
          await updateDoc(doc(db, 'rooms', ROOM_ID), {
            members: arrayRemove(_user.uid),
            memberInfo: mi
          });
        }
      }
    }
  } catch(e) {}
  if (_unsub) _unsub();
  if (_unsubMe) _unsubMe();
  location.href = 'rooms.html';
};
