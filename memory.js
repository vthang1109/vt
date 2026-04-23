import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints } from './points.js';
import { createRoom as _createRoom, joinRoom as _joinRoom, listenRoom, updateRoomState, deleteRoom } from './room.js';

const firebaseConfig = {apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",authDomain:"lienquan-fake.firebaseapp.com",projectId:"lienquan-fake",storageBucket:"lienquan-fake.firebasestorage.app",messagingSenderId:"782694799992",appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Particle bg
const bgC = document.getElementById('bg-canvas'), bgX = bgC.getContext('2d');
let bpts = [];
function resizeBg(){ bgC.width=innerWidth; bgC.height=innerHeight; }
resizeBg(); window.addEventListener('resize', resizeBg);
for(let i=0;i<35;i++) bpts.push({x:Math.random()*bgC.width,y:Math.random()*bgC.height,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.5+.5});
function drawBg(){ bgX.clearRect(0,0,bgC.width,bgC.height); bpts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=bgC.width; if(p.x>bgC.width)p.x=0; if(p.y<0)p.y=bgC.height; if(p.y>bgC.height)p.y=0; bgX.beginPath(); bgX.arc(p.x,p.y,p.r,0,Math.PI*2); bgX.fillStyle='rgba(56,189,248,0.45)'; bgX.fill(); }); requestAnimationFrame(drawBg); } drawBg();

onAuthStateChanged(auth, async user => {
  if(user){ const pts = await getPoints(); const el=document.getElementById('nav-pts'); if(el) el.textContent=pts+' điểm'; }
});

// ===== EMOJIS =====
const EMOJIS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦋','🌺','⭐','🍕','🎮','🚀','🎯','💎','🔥','🌈'];

// ===== STATE =====
let mode = 'solo'; // solo | local | online
let cards = [], flipped = [], matched = 0;
let p1Score = 0, p2Score = 0, currentPlayer = 1;
let timerInt = null, seconds = 0;
let canFlip = true;
let roomId = null, myRole = null, unsubRoom = null;

function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

function showScreen(id){
  document.querySelectorAll('.mem-screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

// ===== PUBLIC API =====
window.Memory = {
  showMenu(){
    if(unsubRoom){ unsubRoom(); unsubRoom=null; }
    if(roomId){ deleteRoom(roomId); roomId=null; }
    clearInterval(timerInt);
    showScreen('menu');
  },

  start(m){
    mode = m;
    p1Score=0; p2Score=0; currentPlayer=1; matched=0; seconds=0; canFlip=true;
    flipped=[];

    // Setup players
    const p1name = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Người chơi 1';
    document.getElementById('p1-name').textContent = mode==='solo' ? p1name : 'Người chơi 1';
    document.getElementById('p2-name').textContent = 'Người chơi 2';
    document.getElementById('p1-score').textContent = '0';
    document.getElementById('p2-score').textContent = '0';

    const p2info = document.getElementById('p2-info');
    const turnEl = document.getElementById('turn-indicator');
    if(mode==='solo'){
      p2info.style.display='none';
      turnEl.classList.add('hidden');
    } else {
      p2info.style.display='flex';
      turnEl.classList.remove('hidden');
      updateTurnUI();
    }

    // Tạo bảng 5x5 = 25 ô, 12 cặp + 1 ô đặc biệt (wildcard)
    const emojiPairs = shuffle(EMOJIS).slice(0,12);
    const cardData = shuffle([...emojiPairs, ...emojiPairs, '⭐']);
    cards = cardData.map((e,i)=>({ id:i, emoji:e, flipped:false, matched:false }));

    renderBoard();
    showScreen('game');
    startTimer();
  },

  startOnline(){
    if(!auth.currentUser){ alert('Cần đăng nhập để chơi online!'); return; }
    showScreen('online');
    document.getElementById('room-waiting').classList.add('hidden');
    document.getElementById('online-msg').textContent='';
  },

  async createRoom(){
    if(!auth.currentUser) return;
    const emojiPairs = shuffle(EMOJIS).slice(0,12);
    const cardData = shuffle([...emojiPairs, ...emojiPairs, '⭐']);
    const initCards = cardData.map((e,i)=>({ id:i, emoji:e, flipped:false, matched:false }));

    const res = await _createRoom('memory', { cards: initCards, p1Score:0, p2Score:0, currentPlayer:1, matched:0 });
    if(res.error){ document.getElementById('online-msg').textContent=res.error; return; }

    roomId = res.roomId; myRole = 'host';
    document.getElementById('room-id-display').textContent = roomId;
    document.getElementById('room-waiting').classList.remove('hidden');

    unsubRoom = listenRoom(roomId, data => {
      if(data.status==='playing') startOnlineGame(data);
    });
  },

  async joinRoom(){
    const id = document.getElementById('room-input').value.trim();
    if(id.length!==6){ document.getElementById('online-msg').textContent='Mã phòng 6 số!'; return; }
    if(!auth.currentUser){ document.getElementById('online-msg').textContent='Cần đăng nhập!'; return; }

    const res = await _joinRoom(id);
    if(res.error){ document.getElementById('online-msg').textContent=res.error; return; }

    roomId = id; myRole = 'guest';
    unsubRoom = listenRoom(roomId, data => startOnlineGame(data));
  },
};

function startOnlineGame(data){
  if(unsubRoom) unsubRoom(); // Sẽ reset listener
  mode='online';
  const state = data.state;
  cards = state.cards;
  p1Score = state.p1Score; p2Score = state.p2Score;
  currentPlayer = state.currentPlayer; matched = state.matched;
  flipped=[]; canFlip=true; seconds=0;

  document.getElementById('p1-name').textContent = data.host.name;
  document.getElementById('p2-name').textContent = data.guest?.name || 'Đối thủ';
  document.getElementById('p2-info').style.display='flex';
  document.getElementById('turn-indicator').classList.remove('hidden');

  renderBoard();
  showScreen('game');
  startTimer();

  // Listen tiếp cho moves
  unsubRoom = listenRoom(roomId, syncOnline);
}

function syncOnline(data){
  if(data.status==='finished') return;
  const state = data.state;
  cards = state.cards; p1Score=state.p1Score; p2Score=state.p2Score;
  currentPlayer=state.currentPlayer; matched=state.matched;
  updateScoreUI(); updateTurnUI();
  renderBoard();
  if(matched===12) endGame();
}

function renderBoard(){
  const board = document.getElementById('mem-board');
  board.innerHTML='';
  cards.forEach(card=>{
    const el = document.createElement('div');
    el.className = 'mem-card' + (card.flipped?' flipped':'') + (card.matched?' matched':'');
    el.dataset.id = card.id;
    el.innerHTML = `<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">${card.emoji}</div></div>`;
    if(!card.matched && !card.flipped) el.onclick = () => flipCard(card.id);
    board.appendChild(el);
  });
}

function flipCard(id){
  if(!canFlip) return;
  if(mode==='online'){
    const myTurn = (myRole==='host' && currentPlayer===1) || (myRole==='guest' && currentPlayer===2);
    if(!myTurn) return;
  }
  const card = cards[id];
  if(card.flipped || card.matched) return;
  if(flipped.length>=2) return;

  card.flipped=true;
  flipped.push(id);
  renderBoard();

  if(flipped.length===2) checkMatch();
}

function checkMatch(){
  canFlip=false;
  const [a,b] = flipped.map(id=>cards[id]);

  setTimeout(()=>{
    if(a.emoji===b.emoji){
      // Match!
      a.matched=true; b.matched=true;
      matched++;
      if(currentPlayer===1) p1Score++; else p2Score++;
      updateScoreUI();
      document.getElementById('mem-pairs').textContent = `${matched}/12 cặp`;
      flipped=[];
      canFlip=true;
      if(mode==='online') pushOnlineState();
      if(matched===12) setTimeout(endGame, 400);
    } else {
      // No match
      a.flipped=false; b.flipped=false;
      if(mode==='local' || mode==='online'){
        currentPlayer = currentPlayer===1 ? 2 : 1;
        updateTurnUI();
      }
      flipped=[];
      renderBoard();
      canFlip=true;
      if(mode==='online') pushOnlineState();
    }
  }, 900);
}

async function pushOnlineState(){
  if(!roomId) return;
  await updateRoomState(roomId, { cards, p1Score, p2Score, currentPlayer, matched }, currentPlayer===1?'host':'guest', matched===12?'finished':'playing');
}

function updateScoreUI(){
  document.getElementById('p1-score').textContent=p1Score;
  document.getElementById('p2-score').textContent=p2Score;
  document.getElementById('p1-info').classList.toggle('active', currentPlayer===1);
  document.getElementById('p2-info').classList.toggle('active', currentPlayer===2);
}

function updateTurnUI(){
  const name = currentPlayer===1 ? document.getElementById('p1-name').textContent : document.getElementById('p2-name').textContent;
  document.getElementById('turn-name').textContent=name;
  updateScoreUI();
}

function startTimer(){
  clearInterval(timerInt);
  timerInt = setInterval(()=>{
    seconds++;
    const m=Math.floor(seconds/60), s=seconds%60;
    document.getElementById('mem-timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },1000);
}

async function endGame(){
  clearInterval(timerInt);
  if(unsubRoom){ unsubRoom(); unsubRoom=null; }

  let emoji='🏆', title='', statsHTML='';

  if(mode==='solo'){
    emoji='🏆'; title=`Hoàn thành! ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    statsHTML=`<div class="mem-res-stat"><span class="mem-res-stat-val">${p1Score}</span><span class="mem-res-stat-label">Cặp tìm được</span></div><div class="mem-res-stat"><span class="mem-res-stat-val">${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}</span><span class="mem-res-stat-label">Thời gian</span></div>`;
    if(auth.currentUser) await addPoints('Memory Card','Hoàn thành',p1Score*3);
  } else {
    const p1n=document.getElementById('p1-name').textContent;
    const p2n=document.getElementById('p2-name').textContent;
    if(p1Score>p2Score){ emoji='🏆'; title=`${p1n} thắng!`; }
    else if(p2Score>p1Score){ emoji='🎉'; title=`${p2n} thắng!`; }
    else { emoji='🤝'; title='Hòa!'; }
    statsHTML=`<div class="mem-res-stat"><span class="mem-res-stat-val" style="color:#38bdf8">${p1Score}</span><span class="mem-res-stat-label">${p1n}</span></div><div class="mem-res-stat"><span class="mem-res-stat-val" style="color:#f472b6">${p2Score}</span><span class="mem-res-stat-label">${p2n}</span></div>`;
    if(auth.currentUser && mode==='online' && roomId) await deleteRoom(roomId);
  }

  document.getElementById('res-emoji').textContent=emoji;
  document.getElementById('res-title').textContent=title;
  document.getElementById('mem-res-stats').innerHTML=statsHTML;
  showScreen('result');
}
