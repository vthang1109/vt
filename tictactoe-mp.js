// ===== TIC-TAC-TOE MULTIPLAYER =====
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = { apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY", authDomain:"lienquan-fake.firebaseapp.com", projectId:"lienquan-fake", storageBucket:"lienquan-fake.firebasestorage.app", messagingSenderId:"782694799992", appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d" };
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app); const auth = getAuth(app);

const ROOM_ID = new URLSearchParams(location.search).get('room');
const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
let _user = null, _unsub = null, _lastBoard = null;

if (!ROOM_ID) document.getElementById('ttt-content').innerHTML = '<div class="ttt-error">⚠️ Thiếu mã phòng.</div>';

onAuthStateChanged(auth, (u) => { if (!u){ location.href='index.html'; return;} _user=u; if(ROOM_ID) start(); });

function start(){
  if (_unsub) _unsub();
  _unsub = onSnapshot(doc(db,'rooms',ROOM_ID), (snap) => {
    if (!snap.exists()){ document.getElementById('ttt-content').innerHTML='<div class="ttt-error">Phòng đã bị xoá.</div>'; return; }
    const r = snap.data();
    document.getElementById('ttt-room').textContent = '#' + (r.code||'------');
    if (r.gameType !== 'tictactoe'){ document.getElementById('ttt-content').innerHTML='<div class="ttt-error">Sai loại game.</div>'; return; }
    if (!r.gameState){ setStatus('Đang khởi tạo...', 'wait'); return; }
    render(r);
  });
}

function render(r){
  const gs = r.gameState; const players = gs.players||[]; const symbols = gs.symbols||{}; const memberInfo = r.memberInfo||{};
  const pEl = document.getElementById('ttt-players'); pEl.innerHTML='';
  players.forEach(uid => {
    const sym = symbols[uid]||'?'; const isTurn = gs.currentTurn===uid && !gs.winner; const isMe = uid===_user.uid;
    const name = memberInfo[uid]?.name || (isMe?'Bạn':'?');
    const div = document.createElement('div'); div.className='ttt-player'+(isTurn?' turn':'');
    div.innerHTML = `<div class="ttt-p-sym ${sym}">${sym}</div><div><div class="ttt-p-name">${esc(name)} ${isMe?'<span style="color:#fbbf24;font-size:11px">(bạn)</span>':''}</div><div class="ttt-p-status">${isTurn?'⏳ Đang đến lượt':'Chờ'}</div></div>`;
    pEl.appendChild(div);
  });
  const bEl = document.getElementById('ttt-board');
  if (_lastBoard !== gs.board){
    bEl.innerHTML='';
    for (let i=0;i<9;i++){
      const ch = gs.board[i]; const cell = document.createElement('div');
      cell.className = 'ttt-cell' + (ch!=='.'?' filled '+ch:'');
      cell.textContent = ch==='.'?'':ch;
      cell.addEventListener('click', () => onCellClick(i, r));
      bEl.appendChild(cell);
    }
    _lastBoard = gs.board;
  }
  if (gs.winner && gs.winLine) gs.winLine.forEach(i => bEl.children[i]?.classList.add('win'));
  const actions = document.getElementById('ttt-actions');
  if (gs.winner){
    actions.style.display='flex';
    if (gs.winner==='draw') setStatus('🤝 Hoà!', 'wait');
    else if (gs.winner===_user.uid) setStatus('🏆 Bạn thắng!', 'win');
    else setStatus('💔 ' + esc(memberInfo[gs.winner]?.name||'Đối thủ') + ' đã thắng', 'lose');
  } else {
    actions.style.display='none';
    if (gs.currentTurn===_user.uid) setStatus('🎯 Đến lượt bạn — quân ' + (symbols[_user.uid]||'?'), 'your-turn');
    else setStatus('⏳ Chờ ' + esc(memberInfo[gs.currentTurn]?.name||'Đối thủ') + '...', 'wait');
  }
}

function setStatus(t,c){ const el=document.getElementById('ttt-status'); el.className='ttt-status '+c; el.innerHTML=t; }

async function onCellClick(idx, r){
  const gs = r.gameState; if (gs.winner) return;
  if (gs.currentTurn !== _user.uid){ showToast('Chưa đến lượt bạn','warn'); return; }
  if (gs.board[idx] !== '.') return;
  const mySym = gs.symbols[_user.uid]; if (!mySym) return;
  const newBoard = gs.board.substring(0,idx) + mySym + gs.board.substring(idx+1);
  const winLine = checkWin(newBoard, mySym);
  const moveCount = (gs.moveCount||0) + 1;
  let winner = null;
  if (winLine) winner = _user.uid;
  else if (moveCount >= 9) winner = 'draw';
  const otherUid = gs.players.find(p => p !== _user.uid);
  const updates = { 'gameState.board':newBoard, 'gameState.moveCount':moveCount, 'gameState.currentTurn':otherUid };
  if (winner){ updates['gameState.winner']=winner; updates['gameState.winLine']=winLine||[]; updates['status']='ended'; }
  try {
    await updateDoc(doc(db,'rooms',ROOM_ID), updates);
    if (winner === _user.uid){
      try {
        const uref = doc(db,'users',_user.uid); const us = await getDoc(uref);
        const cur = us.exists()?(us.data().points||0):0;
        await updateDoc(uref, { points: cur+50, lastUpdate: serverTimestamp() });
        if (window.VTQuests){ window.VTQuests.trackEarn(50); window.VTQuests.trackWinSmart(); }
        showToast('🎉 +50đ thắng Tic-Tac-Toe!','success');
      } catch(e){}
    }
  } catch(e){ console.error(e); showToast('Lỗi gửi nước đi','error'); }
}

function checkWin(b, s){ for (const line of WINS) if (line.every(i => b[i]===s)) return line; return null; }

window.requestRematch = async function(){
  const snap = await getDoc(doc(db,'rooms',ROOM_ID)); if (!snap.exists()) return;
  const r = snap.data(); if (r.hostUid !== _user.uid){ showToast('Chỉ chủ phòng mới chơi lại','warn'); return; }
  const players = r.gameState?.players || r.members.slice(0,2);
  await updateDoc(doc(db,'rooms',ROOM_ID), {
    status:'playing', 'gameState.board':'.........', 'gameState.currentTurn':players[1]||players[0],
    'gameState.winner':null, 'gameState.winLine':null, 'gameState.moveCount':0
  });
  _lastBoard=null;
};

window.quitGame = async function(){
  try {
    const snap = await getDoc(doc(db,'rooms',ROOM_ID));
    if (snap.exists()){
      const r = snap.data();
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
