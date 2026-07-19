// timso-mp.js — Tìm Số MP (cược + đối kháng)
import { db, auth, addPoints } from '../../points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// === STATE ===
var roomId = null, roomData = null, myUid = null, myName = 'Bạn', myPts = 0;
var p1Uid = null, p2Uid = null;
var board = [], found = [], target = 1, scores = {};
var active = false, over = false, tLeft = 10, timer = null, proc = false;
var _unsub = null, _quitting = false, _resultDone = false, _starting = false;
var curBet = 100, gameMode = 'shuffle';

// === DOM ===
function $(id){return document.getElementById(id)}
function qs(s){return document.querySelector(s)}
var waitEl = $('mp-wait'), waitT = $('mp-wait-t');
var betRow = $('mp-bet'), betSel = $('mp-bet-sel'), betHost = $('btn-bet-host'), betPly = $('btn-bet-player'), betInfo = $('mp-bet-info');
var modeSel = $('mp-mode-sel');
var sbar = $('ts-sbar'), lEl = $('ts-l'), tgEl = $('ts-tg'), sbEl = $('ts-sb'), rEl = $('ts-r');
var bd = $('ts-bd'), rsM = $('rs-modal');

// === AUTH ===
onAuthStateChanged(auth, async function(user){
  if(!user){window.location.href='index.html';return}
  myUid=user.uid;
  try{
    var snap=await getDoc(doc(db,'users',user.uid));
    var d=snap.exists()?snap.data():{};
    myName=d.nickname||user.email.split('@')[0];
    myPts=d.points||0;
  }catch(e){myName=user.email.split('@')[0]}

  var params=new URLSearchParams(window.location.search);
  roomId=params.get('room');
  if(!roomId){var a=$('mp-app');if(a)a.innerHTML='<p style="color:#fff;text-align:center;padding:60px">Thiếu mã phòng</p>';return}
  if(window.TopNav&&window.TopNav.setLeaveAction)window.TopNav.setLeaveAction(function(){window.quitGame()});
  listen();
});

window.addEventListener('pagehide',function(){if(window.quitGame)window.quitGame()});

// === LISTEN ===
function listen(){
  if(_unsub)_unsub();
  _unsub=onSnapshot(doc(db,'rooms',roomId),function(snap){
    if(!snap.exists()){var a=$('mp-app');if(a)a.innerHTML='<p style="color:#fff;text-align:center;padding:60px">Phòng đã bị xoá</p>';return}
    roomData=snap.data();
    render();
  },function(e){console.error(e)});
}

// === RENDER ===
function render(){
  if(!roomData)return;
  var r=roomData, mem=r.members||[], mInfo=r.memberInfo||{}, gs=r.gameState||{}, phase=gs.phase||'lobby', isHost=r.hostUid===myUid;
  // Show room code in top nav
  if(window.TopNav&&window.TopNav.setRoomId&&r.code)window.TopNav.setRoomId(r.code,'🔢');
  p1Uid=mem[0]||null; p2Uid=mem[1]||null;

  // === WAITING ===
  if(phase==='lobby'||mem.length<2){
    hide(sbar); hide(bd); hide(betRow); hide(betInfo);
    show(waitEl);
    if(waitT)waitT.textContent=mem.length<2?'Đang chờ người chơi...':'Đang chờ chủ phòng bắt đầu...';
    stopTimer();
    return;
  }

  // === BETTING ===
  if(phase==='betting'){
    hide(waitEl); hide(sbar); hide(bd);
    show(betRow); show(betInfo);
    stopTimer();

    if(isHost){
      show(betHost); hide(betPly); show(betSel); show(modeSel);
      var confirmed=!!gs.betConfirmed&&!!gs.betConfirmed[myUid];
      betHost.disabled=confirmed;
      betHost.textContent=confirmed?'Đã cược':'Xác nhận cược';
      betInfo.textContent=gs.betAmount
        ?'Cược '+numFmt(gs.betAmount)+' · '+(gs.mode==='fixed'?'📌 Cố định':'🔄 Đảo số')+' — Chờ người chơi xác nhận...'
        :(mem.length<2?'Cần 2 người':'Chọn mức cược, chế độ và xác nhận');
    }else{
      hide(betHost); hide(betSel); hide(modeSel);
      if(gs.betAmount){
        show(betPly);
        var c=!!gs.betConfirmed&&!!gs.betConfirmed[myUid];
        betPly.textContent=c?'Đã xác nhận':'Xác nhận';
        betPly.className='btn-bet-yes'+(c?' on':'');
        betPly.disabled=c;
        var modeLabel=gs.mode==='fixed'?'📌 Cố định':'🔄 Đảo số';
        betInfo.textContent='Cược '+numFmt(gs.betAmount)+' · '+modeLabel+' — Hãy xác nhận!';
      }else{
        hide(betPly);
        betInfo.textContent=mem.length<2?'Cần 2 người':'Chờ chủ phòng đặt cược...';
      }
    }

    // Auto-start when all confirmed
    if(gs.betAmount&&gs.betConfirmed&&!_starting){
      var allOk=mem.length>0&&mem.every(function(u){return gs.betConfirmed[u]});
      if(allOk&&mem.length>=2){_starting=true;startGameInternal()}
    }
    return;
  }

  // === PLAYING ===
  hide(waitEl); hide(betRow); hide(betInfo);
  show(sbar); show(bd);

  if(gs.board&&gs.board.length>0){
    curBet=gs.bet||curBet;
    board=gs.board; found=gs.found||[]; target=gs.target||1;
    scores=gs.scores||{};
    active=!gs.winner; over=!!gs.winner;
    tLeft=(gs.turnTimeLeft!==undefined&&gs.turnTimeLeft!==null)?gs.turnTimeLeft:10;

    drawBoard();
    if(active&&!over){startTimer();removeClass(bd,'mp-disabled');addClass(bd,'mp-clickable')}
    else{stopTimer();addClass(bd,'mp-disabled');removeClass(bd,'mp-clickable')}

    // Status bar — player names, countdown next to target
    var n1=mInfo[p1Uid]?mInfo[p1Uid].name:'P1', n2=mInfo[p2Uid]?mInfo[p2Uid].name:'P2';
    var s1=scores[p1Uid]||0, s2=scores[p2Uid]||0;
    if(lEl){lEl.textContent=n1+': '+s1;lEl.className='stat-bet'}
    if(rEl){rEl.textContent=n2+': '+s2;rEl.className='stat-profit zero'}
    if(active&&!over){
      var tc=tLeft<=3?' warn':'';
      if(tgEl)tgEl.innerHTML=target>100?'Done':'<span class="ts-num">'+target+'</span> <span class="ts-countdown'+tc+'">'+tLeft+'s</span>';
      var modeLabel=gs.mode==='fixed'?'📌 Cố định':'🔄 Đảo số';
      if(sbEl)sbEl.textContent='Cùng tìm! '+modeLabel;
    }
    if(gs.winner&&!_resultDone){_resultDone=true;showResult(gs)}
  }
}

function drawBoard(){
  if(!bd)return;
  if(!board||board.length===0){bd.innerHTML='<div style="color:#64748b;text-align:center;padding:20px">Đang tạo bảng...</div>';return}
  var h='';
  for(var i=0;i<board.length;i++){
    var n=board[i], ow=found&&found[i], cl='ts-cell', dis='';
    if(ow){cl+=ow===p1Uid?' correct-p1':' correct-p2';dis='disabled'}
    h+='<button class="'+cl+'" data-i="'+i+'" onclick="cellClick('+i+')" '+dis+'>'+n+'</button>'
  }
  bd.innerHTML=h;
}

// === BET ===
window.betAction=async function(){
  if(!roomId||!roomData)return;
  var r=roomData, gs=r.gameState||{}, isHost=r.hostUid===myUid;

  if(isHost){
    if(gs.phase==='playing')return;
    var amt=parseInt(betSel.value);
    if(!amt||amt<50){toast('Mức cược tối thiểu 50','warn');return}
    if(myPts<amt){toast('Không đủ tiền! Có '+numFmt(myPts)+', cần '+numFmt(amt),'error');return}
    try{
      await addPoints('Tìm Số MP','Đặt cược '+numFmt(amt),-amt);
      myPts-=amt;
    }catch(e){toast('Không thể trừ tiền cược!','error');return}
    var cf=Object.assign({},gs.betConfirmed||{},{[myUid]:true});
    curBet=amt;
    gameMode=modeSel?modeSel.value:'shuffle';
    await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{phase:'betting',betAmount:amt,betConfirmed:cf,bet:amt,mode:gameMode})});
  }else{
    if(gs.phase!=='betting'||!gs.betAmount)return;
    if(gs.betConfirmed&&gs.betConfirmed[myUid])return;
    if(myPts<gs.betAmount){toast('Không đủ tiền!','error');return}
    try{
      await addPoints('Tìm Số MP','Xác nhận cược '+numFmt(gs.betAmount),-gs.betAmount);
      myPts-=gs.betAmount;
    }catch(e){toast('Không thể trừ tiền!','error');return}
    var cf=Object.assign({},gs.betConfirmed||{},{[myUid]:true});
    await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{betConfirmed:cf})});
  }
};

function shuffleArray(a){
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}
  return a;
}

async function startGameInternal(){
  if(!roomId||!roomData)return;
  var r=roomData, mem=r.members||[], p1=mem[0], p2=mem[1];
  if(!p1||!p2)return;

  var gs=r.gameState||{};
  // Luôn shuffle board ban đầu cho cả 2 chế độ
  var nb=shuffleArray(Array.from({length:100},function(_,i){return i+1}));
  var sc={};sc[p1]=0;sc[p2]=0;

  var ng=Object.assign({},gs,{
    phase:'playing',board:nb,found:Array(100).fill(null),target:1,scores:sc,
    winner:null,turnTimeLeft:10
  });
  await updateDoc(doc(db,'rooms',roomId),{gameState:ng});
  _starting=false;
}

function shuffleRemaining(board,found){
  var idxs=[],vals=[];
  for(var i=0;i<board.length;i++){
    if(!found[i]){idxs.push(i);vals.push(board[i])}
  }
  shuffleArray(vals);
  for(var i=0;i<idxs.length;i++){board[idxs[i]]=vals[i]}
  return board;
}

// === TIMER ===
function startTimer(){stopTimer();timer=setInterval(function(){tLeft--;if(tLeft<=0){stopTimer();timeout()}else updateTimer()},1000)}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function updateTimer(){
  if(over||!active)return;
  var tc=tLeft<=3?' warn':'';
  if(tgEl)tgEl.innerHTML=target>100?'Done':'<span class="ts-num">'+target+'</span> <span class="ts-countdown'+tc+'">'+tLeft+'s</span>';
}

async function timeout(){
  if(!active||over||proc)return; proc=true;
  try{
    var gs=(roomData&&roomData.gameState)||{};
    await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{turnTimeLeft:10})});
  }catch(e){console.error(e)}
  proc=false;
}

// === CLICK ===
window.cellClick=async function(idx){
  if(!active||over||proc)return;
  if(!roomId||!roomData||(found&&found[idx]))return;
  var num=board[idx], gs=(roomData&&roomData.gameState)||{}, gsTarget=gs.target||1;
  if(num===gsTarget)await correct(idx,gs); else await wrong(idx);
};

async function correct(idx,gs){
  if(proc)return; proc=true;
  try{
    var nf=(gs.found||[]).slice(); nf[idx]=myUid;
    var ns=Object.assign({},gs.scores||{}); ns[myUid]=(ns[myUid]||0)+1;
    var nt=(gs.target||1)+1;
    var nb=(gs.board||[]).slice();
    var mode=gs.mode||'shuffle';
    // Đảo số: shuffle các vị trí chưa tìm thấy
    if(mode==='shuffle'&&nt<=100)shuffleRemaining(nb,nf);
    var ng=Object.assign({},gs,{found:nf,scores:ns,target:nt,board:nb,turnTimeLeft:10});
    if(nt>100){
      var s1=ns[p1Uid]||0,s2=ns[p2Uid]||0;
      ng.winner=s1>s2?p1Uid:(s2>s1?p2Uid:'draw');
      active=false;over=true;stopTimer();
      if(bd){removeClass(bd,'mp-clickable');addClass(bd,'mp-disabled')}
    }
    await updateDoc(doc(db,'rooms',roomId),{gameState:ng});
  }catch(e){console.error(e)}
  proc=false;
}

async function wrong(idx){
  if(proc)return; proc=true;
  try{
    var el=qs('[data-i="'+idx+'"]');
    if(el){el.classList.add('wrong');setTimeout(function(){el.classList.remove('wrong')},300)}
  }catch(e){console.error(e)}
  proc=false;
}

// === RESULT ===
function showResult(gs){
  stopTimer();
  if(bd){removeClass(bd,'mp-clickable');addClass(bd,'mp-disabled')}
  var w=gs.winner, mi=(roomData&&roomData.memberInfo)||{}, s1=scores[p1Uid]||0, s2=scores[p2Uid]||0;
  var n1=mi[p1Uid]?mi[p1Uid].name:'P1', n2=mi[p2Uid]?mi[p2Uid].name:'P2';
  if(w==='draw'){
    if(lEl)lEl.className='stat-bet'; if(rEl)rEl.className='stat-profit zero';
    if(tgEl)tgEl.textContent='Hoà'; if(sbEl)sbEl.textContent='Hoà!';
    openRs('🤝','Hoà!',n1+': '+s1+' · '+n2+': '+s2,'');
  }else if(w===myUid){
    var mp=w===p1Uid;
    if(lEl)lEl.className=mp?'stat-bet ts-win':'stat-bet ts-lose';
    if(rEl)rEl.className=mp?'stat-profit ts-lose':'stat-profit ts-win';
    if(tgEl)tgEl.textContent='Thắng'; if(sbEl)sbEl.textContent='Bạn thắng!';
    openRs('🏆','Bạn thắng!',n1+': '+s1+' · '+n2+': '+s2,'');
    addPoints('Tìm Số MP','Thắng',50).catch(function(){});
  }else{
    var wn=mi[w]?mi[w].name:'Đối thủ', mp=w===p1Uid;
    if(lEl)lEl.className=mp?'stat-bet ts-win':'stat-bet ts-lose';
    if(rEl)rEl.className=mp?'stat-profit ts-lose':'stat-profit ts-win';
    if(tgEl)tgEl.textContent='Thua'; if(sbEl)sbEl.textContent=wn+' thắng!';
    openRs('😔',wn+' thắng!',n1+': '+s1+' · '+n2+': '+s2,'');
  }
}

function openRs(emoji,title,pts,sub){
  setText('rs-em',emoji); setText('rs-tl',title);
  setText('rs-pt',pts||''); setText('rs-sb',sub||'');
  if(rsM)rsM.classList.remove('hidden');
}

window.gameReset=async function(){
  _resultDone=false;_starting=false;
  if(!roomId||!roomData)return;
  try{
    var mem=roomData.members||[], p1=mem[0], p2=mem[1];
    if(!p1||!p2)return;
    await updateDoc(doc(db,'rooms',roomId),{status:'lobby',gameState:{phase:'lobby'}});
  }catch(e){console.error(e)}
};

// === QUIT ===
window.quitGame=async function(){
  if(_quitting)return; _quitting=true;
  if(!roomId){window.location.href='../../app/rooms.html';return}
  try{
    var snap=await getDoc(doc(db,'rooms',roomId));
    if(snap.exists()){
      var r=snap.data();
      if(r.hostUid===myUid){await deleteDoc(doc(db,'rooms',roomId))}else{
        var rem=(r.members||[]).filter(function(u){return u!==myUid});
        if(rem.length===0){await deleteDoc(doc(db,'rooms',roomId))}else{
          var mi=Object.assign({},r.memberInfo||{}); delete mi[myUid];
          await updateDoc(doc(db,'rooms',roomId),{members:arrayRemove(myUid),memberInfo:mi})
        }
      }
    }
  }catch(e){console.error(e)}
  if(_unsub){_unsub();_unsub=null}
  window.location.href='../../app/rooms.html';
};

// === HELPERS ===
function setText(id,v){var e=$(id);if(e)e.textContent=v}
function hide(e){if(e)e.style.display='none'}
function show(e){if(e)e.style.display=''}
function addClass(e,c){if(e)e.classList.add(c)}
function removeClass(e,c){if(e)e.classList.remove(c)}
function toast(m,t){if(window.showToast)window.showToast(m,t)}
function numFmt(n){return n.toLocaleString('vi-VN')}

console.log('Tìm Số MP loaded');
