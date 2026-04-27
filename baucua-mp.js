// ===== BẦU CUA MULTIPLAYER =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = { apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY", authDomain:"lienquan-fake.firebaseapp.com", projectId:"lienquan-fake", storageBucket:"lienquan-fake.firebasestorage.app", messagingSenderId:"782694799992", appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d" };
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app); const auth = getAuth(app);

const SYMBOLS = [
  { k:'bau',  i:'🍐', n:'Bầu' },
  { k:'cua',  i:'🦀', n:'Cua' },
  { k:'tom',  i:'🦐', n:'Tôm' },
  { k:'ca',   i:'🐟', n:'Cá' },
  { k:'ga',   i:'🐓', n:'Gà' },
  { k:'nai',  i:'🦌', n:'Nai' }
];

const ROOM_ID = new URLSearchParams(location.search).get('room');
let _user = null, _unsub = null, _unsubMe = null;
let _chip = 100;
let _myBalance = 0;
let _settled = false;       // đã settle vòng này chưa (tránh trừ/cộng nhiều lần)
let _settledRound = -1;

if (!ROOM_ID) document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:60px">⚠️ Thiếu mã phòng.</div>';

onAuthStateChanged(auth, async (u) => {
  if (!u){ location.href='index.html'; return; }
  _user = u;
  buildBoard();
  bindChips();
  // theo dõi balance
  _unsubMe = onSnapshot(doc(db,'users',_user.uid), (s) => {
    if (s.exists()) { _myBalance = s.data().points||0; document.getElementById('bc-balance').textContent = _myBalance.toLocaleString('vi-VN') + ' đ'; }
  });
  if (ROOM_ID) start();
});

function buildBoard(){
  const b = document.getElementById('bc-board');
  b.innerHTML = '';
  SYMBOLS.forEach(s => {
    const t = document.createElement('div');
    t.className = 'bc-tile';
    t.dataset.k = s.k;
    t.innerHTML = `<div class="bc-tile-icon">${s.i}</div><div class="bc-tile-name">${s.n}</div><div class="bc-tile-bet" data-bet="${s.k}"></div><div class="bc-tile-mult" data-mult="${s.k}" style="display:none"></div>`;
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
    document.getElementById('bc-room').textContent = '#' + (r.code||'------');
    if (r.gameType !== 'baucua') return;
    if (!r.gameState) return;
    render(r);
  });
}

function render(r){
  const gs = r.gameState;
  const isHost = r.hostUid === _user.uid;
  const isBetting = gs.phase === 'betting';
  const isResult = gs.phase === 'result';

  // Phase label
  const ph = document.getElementById('bc-phase');
  if (isBetting){ ph.className='bc-phase betting'; ph.textContent = `🎰 Vòng ${gs.round} — Đặt cược đi nào!`; }
  else if (gs.phase === 'rolling'){ ph.className='bc-phase rolling'; ph.textContent = '🎲 Đang lắc...'; }
  else { ph.className='bc-phase result'; ph.textContent = `📢 Vòng ${gs.round} — Kết quả`; }

  // Dice
  const dEl = document.getElementById('bc-dice');
  const dice = gs.dice || [null,null,null];
  dEl.innerHTML = '';
  for (let i=0;i<3;i++){
    const d = document.createElement('div');
    d.className = 'bc-die' + (gs.phase==='rolling'?' rolling':'');
    if (dice[i]){ const sym = SYMBOLS.find(s => s.k === dice[i]); d.textContent = sym ? sym.i : '?'; }
    else d.textContent = '?';
    dEl.appendChild(d);
  }

  // Tiles: highlight winners + show bets + multipliers
  const myUid = _user.uid;
  const counts = {}; SYMBOLS.forEach(s => counts[s.k] = 0);
  if (isResult && dice.every(Boolean)) dice.forEach(d => counts[d]++);
  document.querySelectorAll('.bc-tile').forEach(t => {
    const k = t.dataset.k;
    const myBet = (gs.bets?.[myUid]?.[k]) || 0;
    t.querySelector('[data-bet]').textContent = myBet > 0 ? '🪙 ' + myBet.toLocaleString('vi-VN') : '';
    const mult = t.querySelector('[data-mult]');
    if (isResult && counts[k] > 0){ t.classList.add('hot'); mult.textContent = 'x' + (counts[k]+1); mult.style.display = 'block'; }
    else { t.classList.remove('hot'); mult.style.display = 'none'; }
    t.classList.toggle('disabled', !isBetting);
  });

  // Players list (with bets total + result)
  const pEl = document.getElementById('bc-players');
  pEl.innerHTML = '';
  (r.members||[]).forEach(uid => {
    const info = (r.memberInfo||{})[uid] || {};
    const isMe = uid === _user.uid;
    const myBets = (gs.bets?.[uid]) || {};
    const total = Object.values(myBets).reduce((a,b) => a+b, 0);
    let resultHtml = '';
    if (isResult && dice.every(Boolean)){
      let payout = 0;
      Object.entries(myBets).forEach(([k,amt]) => { if (counts[k] > 0) payout += amt * (counts[k]+1); });
      const net = payout - total;
      if (total > 0) resultHtml = `<div class="bc-pl-result ${net>=0?'win':'lose'}">${net>=0?'+':''}${net.toLocaleString('vi-VN')}đ</div>`;
    }
    const div = document.createElement('div');
    div.className = 'bc-pl';
    div.innerHTML = `<div class="bc-pl-name">${esc(info.name||'?')} ${isMe?'<span style="color:#fbbf24">(bạn)</span>':''} ${uid===r.hostUid?'👑':''}</div>${total>0?`<div class="bc-pl-bet">Đặt: ${total.toLocaleString('vi-VN')}đ</div>`:''}${resultHtml}`;
    pEl.appendChild(div);
  });

  // Buttons
  document.getElementById('btn-roll').style.display = (isHost && isBetting) ? 'inline-block' : 'none';
  document.getElementById('btn-next').style.display = (isHost && isResult) ? 'inline-block' : 'none';

  // Auto-settle (mỗi user tự cộng/trừ điểm của chính mình, chỉ 1 lần)
  if (isResult && dice.every(Boolean) && _settledRound !== gs.round){
    _settledRound = gs.round;
    settleMyResult(gs, counts);
  }
  if (isBetting){ _settled = false; }
}

async function placeBet(k){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.gameState?.phase !== 'betting'){ showToast('Ngoài lượt cược','warn'); return; }
  if (_chip > _myBalance){ showToast('Không đủ điểm để cược','error'); return; }
  // Trừ điểm ngay (giữ tiền cược)
  const cur = (r.gameState.bets?.[_user.uid]?.[k]) || 0;
  try {
    await updateDoc(doc(db,'users',_user.uid), { points: _myBalance - _chip });
    await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.bets.${_user.uid}.${k}`]: cur + _chip });
    if (window.VTQuests) window.VTQuests.trackPlay('baucua');
  } catch(e){ console.error(e); showToast('Lỗi đặt cược','error'); }
}

window.clearMyBets = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.gameState?.phase !== 'betting'){ showToast('Chỉ huỷ trong lúc cược','warn'); return; }
  const myBets = r.gameState.bets?.[_user.uid] || {};
  const refund = Object.values(myBets).reduce((a,b) => a+b, 0);
  if (refund === 0) return;
  try {
    await updateDoc(doc(db,'users',_user.uid), { points: _myBalance + refund });
    await updateDoc(doc(db,'rooms',ROOM_ID), { [`gameState.bets.${_user.uid}`]: {} });
    showToast('↩ Đã hoàn ' + refund.toLocaleString('vi-VN') + 'đ', 'info');
  } catch(e){ console.error(e); showToast('Lỗi huỷ cược','error'); }
};

window.hostRoll = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID));
  if (!snap.exists()) return;
  const r = snap.data();
  if (r.hostUid !== _user.uid) return;
  if (r.gameState.phase !== 'betting') return;
  // Phase rolling 1.5s rồi result
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
};

async function settleMyResult(gs, counts){
  if (_settled) return;
  _settled = true;
  const myBets = gs.bets?.[_user.uid] || {};
  let payout = 0; let stake = 0;
  Object.entries(myBets).forEach(([k,amt]) => { stake += amt; if (counts[k] > 0) payout += amt * (counts[k]+1); });
  if (stake === 0) return;
  try {
    if (payout > 0){
      // Cộng tiền thắng (đã trừ stake lúc đặt cược)
      const us = await getDoc(doc(db,'users',_user.uid));
      const cur = us.exists() ? (us.data().points||0) : 0;
      await updateDoc(doc(db,'users',_user.uid), { points: cur + payout });
      const net = payout - stake;
      showToast(net >= 0 ? '🎉 Thắng ' + net.toLocaleString('vi-VN') + 'đ!' : '💸 Lỗ ' + (-net).toLocaleString('vi-VN') + 'đ', net>=0?'success':'warn');
      if (window.VTQuests && net > 0) window.VTQuests.trackEarn(net);
    } else {
      showToast('💸 Thua ' + stake.toLocaleString('vi-VN') + 'đ', 'warn');
    }
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
          const us = await getDoc(doc(db,'users',_user.uid));
          const cur = us.exists() ? (us.data().points||0) : 0;
          await updateDoc(doc(db,'users',_user.uid), { points: cur + refund });
        }
      }
      if (r.hostUid === _user.uid) {
        await deleteDoc(doc(db,'rooms',ROOM_ID)); // Sửa: host rời → xóa phòng
      } else {
        const remaining = (r.members || []).filter(u => u !== _user.uid);
        if (remaining.length === 0) {
          await deleteDoc(doc(db,'rooms',ROOM_ID)); // Sửa: không còn ai → xóa phòng
        } else {
          const mi = r.memberInfo||{}; delete mi[_user.uid];
          await updateDoc(doc(db,'rooms',ROOM_ID), { members: arrayRemove(_user.uid), memberInfo: mi });
        }
      }
    }
  } catch(e){}
  location.href='rooms.html';
};

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
