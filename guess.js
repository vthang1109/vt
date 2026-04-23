import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints, updateMission } from './points.js';

const firebaseConfig = {
  apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",authDomain:"lienquan-fake.firebaseapp.com",
  projectId:"lienquan-fake",storageBucket:"lienquan-fake.firebasestorage.app",
  messagingSenderId:"782694799992",appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Particles
const bgC = document.getElementById('bg-canvas'), bgX = bgC.getContext('2d');
let pts2 = [];
function resizeBg(){bgC.width=innerWidth;bgC.height=innerHeight}resizeBg();window.addEventListener('resize',resizeBg);
for(let i=0;i<40;i++)pts2.push({x:Math.random()*bgC.width,y:Math.random()*bgC.height,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,r:Math.random()*1.5+.5});
function drawBg(){bgX.clearRect(0,0,bgC.width,bgC.height);pts2.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=bgC.width;if(p.x>bgC.width)p.x=0;if(p.y<0)p.y=bgC.height;if(p.y>bgC.height)p.y=0;bgX.beginPath();bgX.arc(p.x,p.y,p.r,0,Math.PI*2);bgX.fillStyle='rgba(56,189,248,0.5)';bgX.fill();});requestAnimationFrame(drawBg);}drawBg();

let secret, maxGuesses=10, guesses=[], rangeMin=1, rangeMax=100, maxNum=100, over=false;

function init(){
  maxNum = parseInt(document.getElementById('g-diff').value);
  secret = Math.floor(Math.random()*maxNum)+1;
  maxGuesses = maxNum<=100?10:maxNum<=500?12:15;
  guesses=[]; rangeMin=1; rangeMax=maxNum; over=false;
  document.getElementById('g-hint').textContent='🤔 Hãy nhập số đầu tiên!';
  document.getElementById('g-hint').className='g-hint';
  document.getElementById('g-history').innerHTML='';
  document.getElementById('g-result').classList.add('hidden');
  document.getElementById('g-input').value='';
  document.getElementById('g-input').disabled=false;
  document.querySelector('.g-btn').disabled=false;
  document.getElementById('attempts-left').textContent=maxGuesses;
  renderDots();
  updateRange();
}

function renderDots(){
  const d=document.getElementById('g-dots');
  d.innerHTML='';
  for(let i=0;i<maxGuesses;i++){
    const dot=document.createElement('div');
    dot.className='g-dot'+(i<guesses.length?(guesses[i].correct?' used':' wrong'):'');
    d.appendChild(dot);
  }
}

function updateRange(){
  document.getElementById('range-min').textContent=rangeMin;
  document.getElementById('range-max').textContent=rangeMax;
  const pct=((rangeMax-rangeMin)/maxNum)*100;
  document.getElementById('range-fill').style.width=pct+'%';
}

window.doGuess = async function(){
  if(over) return;
  const val=parseInt(document.getElementById('g-input').value);
  if(isNaN(val)||val<1||val>maxNum){
    document.getElementById('g-hint').textContent=`⚠️ Nhập số từ 1 đến ${maxNum}!`;
    return;
  }
  document.getElementById('g-input').value='';

  const hint=document.getElementById('g-hint');
  const badge=document.createElement('div');
  badge.className='g-badge';

  if(val===secret){
    over=true;
    guesses.push({correct:true});
    badge.className='g-badge used'; badge.textContent=val+'✓';
    document.getElementById('g-history').appendChild(badge);
    renderDots();
    hint.textContent=`🎉 Đúng rồi! Số bí mật là ${secret}`;
    hint.className='g-hint';
    const remaining=maxGuesses-guesses.length+1;
    const pts=remaining>=8?50:remaining>=5?35:20;
    document.getElementById('g-input').disabled=true;
    document.querySelector('.g-btn').disabled=true;
    document.getElementById('res-emoji').textContent='🎉';
    document.getElementById('res-text').textContent='Bạn đoán đúng!';
    document.getElementById('res-pts').textContent=`+${pts} điểm`;
    document.getElementById('g-result').classList.remove('hidden');
    await addPoints('Đoán số','Thắng game',pts);
    await updateMission('win1');await updateMission('win3');await updateMission('win5');await updateMission('play3');
    refreshPts();
    return;
  }

  guesses.push({correct:false});
  if(val<secret){
    hint.textContent=`📈 ${val} — Nhỏ hơn! Thử số lớn hơn`;
    hint.className='g-hint low';
    if(val>rangeMin) rangeMin=val;
    badge.className='g-badge low'; badge.textContent=val+'↑';
  } else {
    hint.textContent=`📉 ${val} — Lớn hơn! Thử số nhỏ hơn`;
    hint.className='g-hint high';
    if(val<rangeMax) rangeMax=val;
    badge.className='g-badge high'; badge.textContent=val+'↓';
  }
  document.getElementById('g-history').appendChild(badge);
  document.getElementById('attempts-left').textContent=maxGuesses-guesses.length;
  renderDots();
  updateRange();

  if(guesses.length>=maxGuesses){
    over=true;
    hint.textContent=`😔 Hết lượt! Số bí mật là ${secret}`;
    hint.className='g-hint high';
    document.getElementById('g-input').disabled=true;
    document.querySelector('.g-btn').disabled=true;
    document.getElementById('res-emoji').textContent='😔';
    document.getElementById('res-text').textContent='Hết lượt rồi!';
    document.getElementById('res-pts').textContent='';
    document.getElementById('g-result').classList.remove('hidden');
    await updateMission('play3');
  }
}

window.newGame = init;

async function refreshPts(){
  try{const p=await getPoints();const n=document.getElementById('nav-pts');if(n)n.textContent='⭐ '+p.toLocaleString();}catch(e){}
}

onAuthStateChanged(auth,async(user)=>{
  if(!user){location.href='index.html';return;}
  init();
  const p=await getPoints();
  const n=document.getElementById('nav-pts');if(n)n.textContent='⭐ '+p.toLocaleString();
});
