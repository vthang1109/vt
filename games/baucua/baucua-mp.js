// ===== BẦU CUA MULTIPLAYER =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = { apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY", authDomain:"lienquan-fake.firebaseapp.com", projectId:"lienquan-fake", storageBucket:"lienquan-fake.firebasestorage.app", messagingSenderId:"782694799992", appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d" };
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app); const auth = getAuth(app);

const SYMBOLS = [
  { k:'bau',  i:'🎃' },
  { k:'cua',  i:'🦀' },
  { k:'tom',  i:'🦞' },
  { k:'ca',   i:'🐟' },
  { k:'ga',   i:'🐔' },
  { k:'nai',  i:'🦌' }
];

const ROOM_ID = new URLSearchParams(location.search).get('room');
let _user = null, _unsub = null;
let _chip = 500;
let _myBalance = 0;
let _settled = false;
let _settledRound = -1;
let _playerResults = {};
let _myBets = {};
let _lastProfit = 0;
let _isProcessingBet = false;
let _isInitialBalanceSet = false;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

onAuthStateChanged(auth, async (u) => {
  if (!u){ location.href='index.html'; return; }
  _user = u;
  buildBoard();
  bindChips();
  
  const snap = await getDoc(doc(db,'users',_user.uid));
  if (snap.exists()) {
    _myBalance = snap.data().points || 0;
    _isInitialBalanceSet = true;
    if (window.TopNav) window.TopNav.setPoints(_myBalance);
  }
  
  if (ROOM_ID) start();
});

function updateNavWithRoom(roomCode) {
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
  roomEl.innerHTML = `<span class="room-icon">🎲</span> #${roomCode}`;
}

function buildBoard(){
  const b = document.getElementById('bc-board');
  b.innerHTML = '';
  SYMBOLS.forEach(s => {
    const t = document.createElement('div');
    t.className = 'bc-tile';
    t.dataset.k = s.k;
    t.innerHTML = `
      <span class="bc-tile-icon">${s.i}</span>
      <span class="bc-tile-bet" data-bet="${s.k}">0</span>
      <span class="bc-tile-mult" data-mult="${s.k}" style="display:none"></span>
    `;
    t.addEventListener('click', () => placeBet(s.k));
    b.appendChild(t);
  });
}

function bindChips(){
  document.querySelectorAll('.bc-chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.bc-chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      _chip = parseInt(c.dataset.v);
    });
  });
}

function start(){
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db,'rooms',ROOM_ID), (snap) => {
    if (!snap.exists()){ document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá.</div>'; return; }
    const r = snap.data();
    const roomCode = r.code || '------';
    updateNavWithRoom(roomCode);
    if (r.gameType !== 'baucua') return;
    if (!r.gameState) return;
    render(r);
  });
}

function updateStatusBar(stake, phase, profit) {
  const statusEl = document.getElementById('bc-status');
  const stakeEl = document.getElementById('bc-stake');
  const phaseEl = document.getElementById('bc-phase');
  const profitEl = document.getElementById('bc-profit');

  statusEl.classList.remove('rolling', 'result-win', 'result-lose', 'result-draw');

  stakeEl.textContent = `${stake.toLocaleString('vi-VN')}`;

  if (phase === 'betting') {
    phaseEl.textContent = 'BET';
  } else if (phase === 'rolling') {
    phaseEl.textContent = 'LẮC';
    statusEl.classList.add('rolling');
  } else if (phase === 'result') {
    if (profit > 0) { phaseEl.textContent = 'WIN'; statusEl.classList.add('result-win'); }
    else if (profit < 0) { phaseEl.textContent = 'LOSE'; statusEl.classList.add('result-lose'); }
    else { phaseEl.textContent = 'DRAW'; statusEl.classList.add('result-draw'); }
  }

  if (profit > 0) {
    profitEl.textContent = `+${profit.toLocaleString('vi-VN')}`;
    profitEl.className = 'bc-profit positive';
  } else if (profit < 0) {
    profitEl.textContent = `${profit.toLocaleString('vi-VN')}`;
    profitEl.className = 'bc-profit negative';
  } else {
    profitEl.textContent = '+0';
    profitEl.className = 'bc-profit zero';
  }
}

function render(r){
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const isBetting = gs.phase === 'betting';
  const isResult = gs.phase === 'result';
  const isRolling = gs.phase === 'rolling';

  let phaseText = 'betting';
  if (isRolling) phaseText = 'rolling';
  else if (isResult) phaseText = 'result';

  const myUid = _user.uid;
  const myBetsForStake = (gs.bets?.[myUid]) || {};
  const stakeTotal = Object.values(myBetsForStake).reduce((a,b) => a+b, 0);
  updateStatusBar(stakeTotal, phaseText, _lastProfit);

  const dEl = document.getElementById('bc-dice');
  const dice = gs.dice || [null,null,null];
  dEl.innerHTML = '';
  for (let i=0;i<3;i++){
    const d = document.createElement('div');
    d.className = 'bc-die' + (isRolling ? ' rolling' : '');
    if (dice[i]){ const sym = SYMBOLS.find(s => s.k === dice[i]); d.textContent = sym ? sym.i : '?'; }
    else d.textContent = '?';
    dEl.appendChild(d);
  }

  const counts = {}; 
  SYMBOLS.forEach(s => counts[s.k] = 0);
  if (isResult && dice.every(Boolean)) dice.forEach(d => counts[d]++);

  const myBets = myBetsForStake;
  _myBets = myBets;
  
  document.querySelectorAll('.bc-tile').forEach(t => {
    const k = t.dataset.k;
    const myBet = myBets[k] || 0;
    const betEl = t.querySelector('[data-bet]');
    betEl.textContent = myBet > 0 ? myBet.toLocaleString('vi-VN') : '0';
    
    if (myBet > 0 && isBetting) {
      t.classList.add('has-bet');
    } else {
      t.classList.remove('has-bet');
    }
    
    const mult = t.querySelector('[data-mult]');
    if (isResult && counts[k] > 0){ 
      t.classList.add('hot'); 
      mult.textContent = 'x' + (counts[k]+1); 
      mult.style.display = 'block'; 
    } else { 
      t.classList.remove('hot'); 
      mult.style.display = 'none'; 
    }
    t.classList.toggle('disabled', !isBetting);
  });

  const pEl = document.getElementById('bc-players');
  pEl.innerHTML = '';
  const memberResults = {};
  
  (r.members||[]).forEach(uid => {
    const info = (r.memberInfo||{})[uid] || {};
    const isMe = uid === _user.uid;
    const myBets2 = (gs.bets?.[uid]) || {};
    const total = Object.values(myBets2).reduce((a,b) => a+b, 0);
    
    let resultHtml = '';
    let isWin = false;
    let net = 0;
    let statusIcon = '';
    
    if (isResult && dice.every(Boolean)){
      let payout = 0;
      Object.entries(myBets2).forEach(([k,amt]) => { 
        if (counts[k] > 0) payout += amt * (counts[k]+1); 
      });
      net = payout - total;
      isWin = net > 0;
      
      // ICON TRÒN GÓC TRÊN PHẢI
      if (total > 0 && net !== 0) {
        statusIcon = isWin ? '🟢' : '🔴';
      } else if (total > 0 && net === 0) {
        statusIcon = '⚪';
      }
      
      if (total > 0) {
        if (net > 0) {
          resultHtml = `<div class="bc-pl-result-badge win">+${net.toLocaleString('vi-VN')}</div>`;
        } else if (net < 0) {
          resultHtml = `<div class="bc-pl-result-badge lose">${net.toLocaleString('vi-VN')}</div>`;
        } else {
          resultHtml = `<div class="bc-pl-result-badge draw">0</div>`;
        }
      }
    }
    
    memberResults[uid] = { isWin, net, total };
    
    const div = document.createElement('div');
    div.className = 'bc-pl';
    div.dataset.uid = uid;
    
    if (isResult && total > 0 && net !== 0) {
      div.classList.add(isWin ? 'win' : 'lose');
    }
    
    div.innerHTML = `
      <div class="bc-pl-name">
        ${esc(info.name||'?')} ${isMe ? '<span style="color:#fbbf24">(bạn)</span>' : ''} ${uid===r.hostUid?'👑':''}
      </div>
      ${statusIcon ? `<div class="bc-pl-status">${statusIcon}</div>` : ''}
      ${total > 0 ? `<div class="bc-pl-bet-badge">${total.toLocaleString('vi-VN')}</div>` : ''}
      ${resultHtml}
    `;
    pEl.appendChild(div);
  });

  _playerResults = memberResults;

  const btnRoll = document.getElementById('btn-roll');
  const btnNext = document.getElementById('btn-next');
  
  if (btnRoll) btnRoll.style.display = (isHost && isBetting) ? 'inline-block' : 'none';
  if (btnNext) btnNext.style.display = (isHost && isResult) ? 'inline-block' : 'none';

  if (isResult && dice.every(Boolean) && _settledRound !== gs.round){
    _settledRound = gs.round;
    settleMyResult(gs, counts);
  }
  if (isBetting){ _settled = false; }
}

async function placeBet(k){
  if (_isProcessingBet) return;
  if (!_isInitialBalanceSet) return;
  if (_chip > _myBalance){ return; }
  
  _isProcessingBet = true;
  
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (!snap.exists()) { _isProcessingBet = false; return; }
    const r = snap.data();
    if (r.gameState?.phase !== 'betting') { _isProcessingBet = false; return; }
    
    const cur = (r.gameState.bets?.[_user.uid]?.[k]) || 0;
    const newBet = cur + _chip;
    const newBalance = _myBalance - _chip;
    
    await updateDoc(doc(db,'users',_user.uid), { points: newBalance });
    await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.bets.${_user.uid}.${k}`]: newBet });
    
    _myBalance = newBalance;
    if (window.TopNav) window.TopNav.setPoints(_myBalance);
    if (window.VTQuests) window.VTQuests.trackPlay('baucua');
    
    updateTileUI(k, newBet);
    
  } catch(e){ console.error(e); }
  _isProcessingBet = false;
}

function updateTileUI(k, newBet) {
  const tiles = document.querySelectorAll('.bc-tile');
  tiles.forEach(t => {
    const key = t.dataset.k;
    if (key === k) {
      const betEl = t.querySelector('[data-bet]');
      betEl.textContent = newBet > 0 ? newBet.toLocaleString('vi-VN') : '0';
      
      if (newBet > 0) {
        t.classList.add('has-bet');
      } else {
        t.classList.remove('has-bet');
      }
    }
  });
}

window.clearMyBets = async function(){
  if (_isProcessingBet) return;
  _isProcessingBet = true;
  
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (!snap.exists()) { _isProcessingBet = false; return; }
    const r = snap.data();
    if (r.gameState?.phase !== 'betting') { _isProcessingBet = false; return; }
    
    const myBets = r.gameState.bets?.[_user.uid] || {};
    const refund = Object.values(myBets).reduce((a,b) => a+b, 0);
    if (refund === 0) { _isProcessingBet = false; return; }
    
    const newBalance = _myBalance + refund;
    
    await updateDoc(doc(db,'users',_user.uid), { points: newBalance });
    await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.bets.${_user.uid}`]: {} });
    
    _myBalance = newBalance;
    if (window.TopNav) window.TopNav.setPoints(_myBalance);
    
    document.querySelectorAll('.bc-tile').forEach(t => {
      t.classList.remove('has-bet');
      const betEl = t.querySelector('[data-bet]');
      betEl.textContent = '0';
    });
    
  } catch(e){ console.error(e); }
  _isProcessingBet = false;
};

window.hostRoll = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  if (r.gameState.phase !== 'betting') return;
  
  await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.phase':'rolling' });
  const dice = [
    SYMBOLS[Math.floor(Math.random()*6)].k,
    SYMBOLS[Math.floor(Math.random()*6)].k,
    SYMBOLS[Math.floor(Math.random()*6)].k
  ];
  setTimeout(async () => {
    try { await updateDoc(doc(db,'rooms',ROOM_ID), { 'gameState.phase':'result', 'gameState.dice': dice }); } catch(e){}
  }, 1600);
};

window.hostNext = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    'gameState.phase':'betting',
    'gameState.dice':[null,null,null],
    'gameState.bets': {},
    'gameState.round': (r.gameState.round||1) + 1
  });
  
  _lastProfit = 0;
  document.querySelectorAll('.bc-tile').forEach(t => {
    t.classList.remove('has-bet');
    const betEl = t.querySelector('[data-bet]');
    betEl.textContent = '0';
  });
};

async function settleMyResult(gs, counts){
  if (_settled) return;
  _settled = true;
  const myBets = gs.bets?.[_user.uid] || {};
  let payout = 0; let stake = 0;
  Object.entries(myBets).forEach(([k,amt]) => { stake += amt; if (counts[k] > 0) payout += amt * (counts[k]+1); });
  
  if (stake === 0) {
    _lastProfit = 0;
    updateStatusBar(gs.round, 'result', _lastProfit);
    return;
  }
  
  try {
    if (payout > 0){
      const net = payout - stake;
      const newBalance = _myBalance + payout;
      await updateDoc(doc(db,'users',_user.uid), { points: newBalance });
      _myBalance = newBalance;
      if (window.TopNav) window.TopNav.setPoints(_myBalance);
      _lastProfit = net;
      if (window.VTQuests && net > 0) window.VTQuests.trackEarn(net);
    } else {
      _lastProfit = -stake;
    }
    updateStatusBar(gs.round, 'result', _lastProfit);
  } catch(e){ console.error(e); }
}

window.quitGame = async function(){
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (snap.exists()){
      const r = snap.data();
      if (r.gameState?.phase === 'betting'){
        const myBets = r.gameState.bets?.[_user.uid] || {};
        const refund = Object.values(myBets).reduce((a,b) => a+b, 0);
        if (refund > 0){
          await updateDoc(doc(db,'users',_user.uid), { points: _myBalance + refund });
        }
      }
      if (r.hostUid === _user.uid) {
        await deleteDoc(doc(db,'rooms',ROOM_ID));
      } else {
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db,'rooms',ROOM_ID));
        } else {
          const mi = r.memberInfo||{}; delete mi[_user.uid];
          const wInfo = { ...(r.waitingMemberInfo || {}) };
          delete wInfo[_user.uid];
          await updateDoc(doc(db,'rooms',ROOM_ID), {
            members: arrayRemove(_user.uid),
            memberInfo: mi,
            waitingMembers: arrayRemove(_user.uid),
            waitingMemberInfo: wInfo
          });
        }
      }
    }
  } catch(e){}
  location.href='rooms.html';
};

window.addEventListener('pagehide', () => window.quitGame?.());

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }