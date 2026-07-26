// timso-mp.js — Tìm Số MP (cược + đối kháng + huỷ diệt)
import { db, auth, addPoints } from '../../points.js';
import {
  doc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayRemove, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initRoomChat, getMyNickname } from '../../room-chat.js';

// === STATE ===
var roomId = null, roomData = null, myUid = null, myName = 'Bạn', myPts = 0;
var p1Uid = null, p2Uid = null;
var board = [], found = [], target = 1, scores = {}, destroyedCount = 0;
var active = false, over = false, tLeft = 10, timer = null;
var _unsub = null, _quitting = false, _resultDone = false, _starting = false;
var _clicking = false;
var curBet = 100, shuffleMode = 'shuffle', gameType = 'race'; // race | destroy

// === DOM ===
function $(id){return document.getElementById(id)}
function qs(s){return document.querySelector(s)}
var waitEl = $('mp-wait'), waitT = $('mp-wait-t');
var betZone = $('ts-bet-zone');
var sbar = $('ts-sbar'), lEl = $('ts-l'), tgEl = $('ts-tg'), sbEl = $('ts-sb'), rEl = $('ts-r');
var bd = $('ts-bd'), rsBanner = $('ts-rs-banner');


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
  if(window.TopNav&&window.TopNav.setLeaveAction)window.TopNav.setLeaveAction(async function(){window.__navigated=true;await window.quitGame?.()});
  listen();
  getMyNickname(db, myUid, user.email).then(function(nm){
    initRoomChat({db:db, roomId:roomId, uid:myUid, getName:function(){return nm}});
  });
});

window.addEventListener('pagehide',function(){if(!window.__navigated&&window.quitGame)window.quitGame()});

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
  if(window.TopNav&&window.TopNav.setRoomId&&r.code)window.TopNav.setRoomId(r.code,'<span class="material-symbols-outlined" style="font-size:14px;line-height:1;vertical-align:middle">search</span>');
  p1Uid=mem[0]||null; p2Uid=mem[1]||null;

  // === WAITING ===
  if(phase==='lobby'||mem.length<2){
    hide(sbar); hide(bd); hide(betZone);
    show(waitEl);
    if(waitT)waitT.textContent=mem.length<2?'Đang chờ người chơi...':'Đang chờ chủ phòng bắt đầu...';
    stopTimer();
    return;
  }

  // === BETTING ===
  if(phase==='betting'){
    hide(waitEl); hide(sbar); hide(bd);
    show(betZone);
    stopTimer();
    renderBetZone(r,gs,isHost);
    // Auto-start when all confirmed
    if(gs.betConfirmed&&gs.betAmount&&!_starting){
      var allOk=mem.length>0&&mem.every(function(u){return gs.betConfirmed[u]});
      if(allOk&&mem.length>=2){_starting=true;startGameInternal()}
    }
    return;
  }

  // === PLAYING ===
  hide(waitEl); hide(betZone);
  show(sbar); show(bd);

  if(gs.board&&gs.board.length>0){
    curBet=gs.bet||curBet;
    gameType=gs.gameType||'race';
    board=gs.board; found=gs.found||[]; target=gs.target||1;
    scores=gs.scores||{};
    active=!gs.winner; over=!!gs.winner;
    tLeft=(gs.turnTimeLeft!==undefined&&gs.turnTimeLeft!==null)?gs.turnTimeLeft:10;

    drawBoard();
    if(active&&!over){startTimer();removeClass(bd,'mp-disabled');addClass(bd,'mp-clickable')}
    else{stopTimer();addClass(bd,'mp-disabled');removeClass(bd,'mp-clickable')}

    // Destroy mode stats
    if(gameType==='destroy'){
      var dc=0; for(var di=0;di<(found||[]).length;di++){if(found[di]==='__x__')dc++}
      destroyedCount=dc;
    }

    // Status bar
    var n1=mInfo[p1Uid]?mInfo[p1Uid].name:'P1', n2=mInfo[p2Uid]?mInfo[p2Uid].name:'P2';
    var s1=scores[p1Uid]||0, s2=scores[p2Uid]||0;
    if(lEl){lEl.textContent=n1+': '+s1;lEl.className='stat-bet'}
    if(rEl){rEl.textContent=n2+': '+s2;rEl.className='stat-profit zero'}
    if(active&&!over){
      var tc=tLeft<=3?' warn':'';
      if(tgEl)tgEl.innerHTML=target>100?'Done':'<span class="ts-num">'+target+'</span> <span class="ts-countdown'+tc+'">'+tLeft+'s</span>';
      var modeLabel=gameType==='destroy'?'💥 Huỷ diệt':(shuffleMode==='fixed'?'📌 Cố định':'🔄 Đảo số');
      if(sbEl)sbEl.textContent=(gameType==='race'?'Cùng tìm! ':'Tìm nhanh! ')+modeLabel;
    }
    if(gs.winner&&!_resultDone){_resultDone=true;showResult(gs)}
  }
}

// === BET ZONE (chess-style) ===
function renderBetZone(r,gs,isHost){
  if(!betZone)return;
  var gsType=gs.gameType||'race', gsMode=gs.mode||'shuffle';
  var hostGameType=gsType, hostShuffleMode=gsMode;

  if(isHost){
    var confirmed=!!gs.betConfirmed&&!!gs.betConfirmed[myUid];
    if(gs.betAmount&&confirmed){
      betZone.innerHTML='<div class="ts-bet-waiting">⏳ Đã đặt cược <b>'+numFmt(gs.betAmount)+'đ</b> · '+(gsType==='destroy'?'💥 Huỷ diệt':'🏁 Đua')+' · '+(gsMode==='fixed'?'📌 Cố định':'🔄 Đảo số')+' — đang chờ đối thủ...</div>';
      return;
    }
    betZone.innerHTML=''+
      '<div class="ts-bet-picker">'+
        '<div class="ts-bet-picker-title">🎯 Chọn mức cược</div>'+
        '<div class="ts-bet-picker-row">'+
          '<input id="ts-bet-input" type="number" min="50" step="50" value="100"/>'+
        '</div>'+
        '<div class="ts-bet-quick">'+
          '<button type="button" onclick="tsQuickBet(100)">100</button>'+
          '<button type="button" onclick="tsQuickBet(200)">200</button>'+
          '<button type="button" onclick="tsQuickBet(500)">500</button>'+
          '<button type="button" onclick="tsQuickBet(1000)">1K</button>'+
          '<button type="button" onclick="tsQuickBet(5000)">5K</button>'+
        '</div>'+
        '<div class="ts-bet-opts">'+
          '<button class="ts-bet-opt-btn'+(hostGameType==='race'?' active':'')+'" data-ts-type="race" onclick="tsToggleType(this)">🏁 Đua</button>'+
          '<button class="ts-bet-opt-btn'+(hostGameType==='destroy'?' active':'')+'" data-ts-type="destroy" onclick="tsToggleType(this)">💥 Huỷ diệt</button>'+
        '</div>'+
        '<div class="ts-bet-opts">'+
          '<button class="ts-bet-opt-btn'+(hostShuffleMode==='shuffle'?' active':'')+'" data-ts-mode="shuffle" onclick="tsToggleMode(this)">🔄 Đảo số</button>'+
          '<button class="ts-bet-opt-btn'+(hostShuffleMode==='fixed'?' active':'')+'" data-ts-mode="fixed" onclick="tsToggleMode(this)">📌 Cố định</button>'+
        '</div>'+
        '<button class="ts-bet-confirm-btn" id="ts-host-confirm" onclick="tsHostSetBet()">✅ Đặt cược</button>'+
      '</div>';
  }else{
    // Đối thủ
    if(!gs.betAmount){
      betZone.innerHTML='<div class="ts-bet-waiting">⏳ Đang chờ chủ phòng chọn mức cược...</div>';
    }else if(!gs.betConfirmed||!gs.betConfirmed[myUid]){
      var canAccept=myPts>=gs.betAmount;
      betZone.innerHTML=''+
        '<div class="ts-bet-confirm-card">'+
          '<div class="ts-bet-confirm-info">Chủ phòng muốn đặt cược · <span>'+(gsType==='destroy'?'💥 Huỷ diệt':'🏁 Đua')+'</span></div>'+
          '<div class="ts-bet-confirm-amt">'+numFmt(gs.betAmount)+'đ</div>'+
          '<div class="ts-bet-confirm-type">'+(gsMode==='fixed'?'📌 Cố định':'🔄 Đảo số')+'</div>'+
          '<div class="ts-bet-confirm-actions">'+
            '<button class="decline" onclick="tsDeclineBet()"'+(canAccept?'':' disabled')+'>Từ chối</button>'+
            '<button class="accept" onclick="tsAcceptBet()"'+(canAccept?'':' disabled')+'>'+(canAccept?'Đồng ý':'Không đủ tiền')+'</button>'+
          '</div>'+
        '</div>';
    }else{
      betZone.innerHTML='<div class="ts-bet-waiting">✅ Đã xác nhận cược <b>'+numFmt(gs.betAmount)+'đ</b> — đang bắt đầu...</div>';
    }
  }
}

// === BET ACTIONS ===
window.tsQuickBet=function(amt){
  var el=$('ts-bet-input');
  if(el)el.value=amt;
};

window.tsToggleType=function(btn){
  document.querySelectorAll('[data-ts-type]').forEach(function(b){b.classList.toggle('active',b===btn)});
};

window.tsToggleMode=function(btn){
  document.querySelectorAll('[data-ts-mode]').forEach(function(b){b.classList.toggle('active',b===btn)});
};

window.tsHostSetBet=async function(){
  if(!roomId||!roomData)return;
  var gs=roomData.gameState||{};
  if(gs.phase==='playing')return;
  var el=$('ts-bet-input'), amt=parseInt(el?el.value:0);
  if(!amt||amt<50){toast('Cược tối thiểu 50','warn');return}
  if(myPts<amt){toast('Không đủ tiền! Có '+numFmt(myPts)+', cần '+numFmt(amt),'error');return}
  var typeEl=document.querySelector('[data-ts-type].active'), gt=typeEl?typeEl.dataset.tsType:'race';
  var modeEl=document.querySelector('[data-ts-mode].active'), sm=modeEl?modeEl.dataset.tsMode:'shuffle';
  try{
    await addPoints('Tìm Số MP','Đặt cược '+numFmt(amt),-amt);
    myPts-=amt;
  }catch(e){toast('Không thể trừ tiền cược!','error');return}
  curBet=amt;gameType=gt;shuffleMode=sm;
  var cf=Object.assign({},gs.betConfirmed||{},{[myUid]:true});
  await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{phase:'betting',betAmount:amt,betConfirmed:cf,bet:amt,gameType:gt,mode:sm})});
};

window.tsAcceptBet=async function(){
  if(!roomId||!roomData)return;
  var gs=roomData.gameState||{};
  if(gs.phase!=='betting'||!gs.betAmount)return;
  if(gs.betConfirmed&&gs.betConfirmed[myUid])return;
  if(myPts<gs.betAmount){toast('Không đủ tiền!','error');return}
  try{
    await addPoints('Tìm Số MP','Xác nhận cược '+numFmt(gs.betAmount),-gs.betAmount);
    myPts-=gs.betAmount;
  }catch(e){toast('Không thể trừ tiền!','error');return}
  var cf=Object.assign({},gs.betConfirmed||{},{[myUid]:true});
  await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{betConfirmed:cf})});
};

window.tsDeclineBet=async function(){
  if(!roomId||!roomData)return;
  // Hoàn tiền cho host
  var gs=roomData.gameState||{}, amt=gs.betAmount||0;
  if(amt>0){try{await addPoints('Tìm Số MP','Hoàn cược (từ chối)',amt)}catch(e){}}
  await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{betAmount:null,betConfirmed:{},bet:null})});
  toast('Đã từ chối cược','info');
};

// === GAME START ===
function shuffleArray(a){
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}
  return a;
}

async function startGameInternal(){
  if(!roomId||!roomData)return;
  var r=roomData, mem=r.members||[], p1=mem[0], p2=mem[1];
  if(!p1||!p2)return;

  var gs=r.gameState||{};
  var nb=shuffleArray(Array.from({length:100},function(_,i){return i+1}));
  var sc={};sc[p1]=0;sc[p2]=0;
  var gt=gs.gameType||'race';

  var ng=Object.assign({},gs,{
    phase:'playing',board:nb,found:Array(100).fill(null),target:1,scores:sc,
    winner:null,turnTimeLeft:10,gameType:gt
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

// === DRAW BOARD ===
function drawBoard(){
  if(!bd)return;
  if(!board||board.length===0){bd.innerHTML='<div style="color:#64748b;text-align:center;padding:20px">Đang tạo bảng...</div>';return}
  var h='';
  for(var i=0;i<board.length;i++){
    var n=board[i], ow=found&&found[i], cl='ts-cell', dis='';
    if(ow==='__x__'){cl+=' destroyed';dis='disabled'}
    else if(ow){cl+=ow===p1Uid?' correct-p1':' correct-p2';dis='disabled'}
    h+='<button class="'+cl+'" data-i="'+i+'" onclick="cellClick('+i+')" '+dis+'>'+n+'</button>'
  }
  bd.innerHTML=h;
  if(rsBanner&&!over)rsBanner.style.display='none';
}

// === TIMER ===
function startTimer(){stopTimer();timer=setInterval(function(){tLeft--;if(tLeft<=0){stopTimer();handleTimeout()}else updateTimer()},1000)}
function stopTimer(){if(timer){clearInterval(timer);timer=null}}
function updateTimer(){
  if(over||!active)return;
  var tc=tLeft<=3?' warn':'';
  if(tgEl)tgEl.innerHTML=target>100?'Done':'<span class="ts-num">'+target+'</span> <span class="ts-countdown'+tc+'">'+tLeft+'s</span>';
}

async function handleTimeout(){
  if(!active||over)return;
  if(gameType==='destroy'){
    await destroyNumber();
  }else{
    try{
      var gs=(roomData&&roomData.gameState)||{};
      await updateDoc(doc(db,'rooms',roomId),{gameState:Object.assign({},gs,{turnTimeLeft:10})});
    }catch(e){console.error(e)}
  }
}

// === DESTROY NUMBER (transaction) ===
async function destroyNumber(){
  if(!active||over||_clicking)return;
  // Capture target tại thời điểm timeout — KHÔNG dùng gs.target
  // vì gs.target có thể đã thay đổi nếu client kia destroy trước
  var capturedTarget = target;
  _clicking=true;
  try{
    await runTransaction(db,async function(transaction){
      var ref=doc(db,'rooms',roomId);
      var snap=await transaction.get(ref);
      if(!snap.exists())return;
      var rd=snap.data(), gs=rd.gameState||{};
      if(gs.winner||gs.phase!=='playing')return;

      var nf=(gs.found||[]).slice();
      // Tìm vị trí của capturedTarget (số đã bị timeout), không phải target hiện tại
      var idx=-1;
      var nb=(gs.board||[]).slice();
      for(var i=0;i<nb.length;i++){
        if(!nf[i]&&nb[i]===capturedTarget){idx=i;break}
      }
      if(idx===-1){ // Số này đã được xử lý (bởi client kia) → chỉ reset timer
        transaction.update(ref,{gameState:Object.assign({},gs,{turnTimeLeft:10})});
        return;
      }
      // Đánh dấu bị huỷ diệt
      nf[idx]='__x__';
      var nt=Math.max(gs.target||1,capturedTarget+1);
      var mode=gs.mode||'shuffle';
      if(mode==='shuffle'&&nt<=100)shuffleRemaining(nb,nf);

      var ng=Object.assign({},gs,{found:nf,target:nt,board:nb,turnTimeLeft:10});
      if(nt>100){
        var mem=rd.members||[],p1u=mem[0],p2u=mem[1];
        var scr=gs.scores||{};
        var s1=scr[p1u]||0,s2=scr[p2u]||0;
        ng.winner=s1>s2?p1u:(s2>s1?p2u:'draw');
      }
      transaction.update(ref,{gameState:ng});
    });
  }catch(e){console.error('Destroy transaction failed:',e)}
  _clicking=false;
}

// === CLICK (transaction) ===
window.cellClick=async function(idx){
  if(!active||over||_clicking)return;
  if(!roomId||!roomData)return;
  if(found&&found[idx])return;

  _clicking=true;
  try{
    var result=await runTransaction(db,async function(transaction){
      var ref=doc(db,'rooms',roomId);
      var snap=await transaction.get(ref);
      if(!snap.exists())return null;
      var rd=snap.data(), gs=rd.gameState||{};
      if(gs.winner||gs.phase!=='playing')return null;

      var nf=(gs.found||[]).slice();
      if(nf[idx])return {taken:true};

      var num=(gs.board||[])[idx];
      var gsTarget=gs.target||1;
      if(num!==gsTarget)return {wrong:true,idx:idx};

      // Đúng!
      nf[idx]=myUid;
      var ns=Object.assign({},gs.scores||{});
      ns[myUid]=(ns[myUid]||0)+1;
      var nt=gsTarget+1;
      var nb=(gs.board||[]).slice();
      var mode=gs.mode||'shuffle';
      if(mode==='shuffle'&&nt<=100)shuffleRemaining(nb,nf);

      var ng=Object.assign({},gs,{found:nf,scores:ns,target:nt,board:nb,turnTimeLeft:10});
      if(nt>100){
        var mem=rd.members||[],p1u=mem[0],p2u=mem[1];
        var s1=ns[p1u]||0,s2=ns[p2u]||0;
        ng.winner=s1>s2?p1u:(s2>s1?p2u:'draw');
      }

      transaction.update(ref,{gameState:ng});
      return {correct:true};
    });

    if(result&&result.taken){
      toast('Số này đã được tìm thấy!','warn');
    }else if(result&&result.wrong){
      var el=qs('[data-i="'+idx+'"]');
      if(el){el.classList.add('wrong');setTimeout(function(){el.classList.remove('wrong')},300)}
    }
  }catch(e){
    console.error('Transaction failed:',e);
  }
  _clicking=false;
};

// === RESULT (inline) ===
function showResult(gs){
  stopTimer();
  if(bd){removeClass(bd,'mp-clickable');addClass(bd,'mp-disabled')}
  var w=gs.winner, mi=(roomData&&roomData.memberInfo)||{}, s1=scores[p1Uid]||0, s2=scores[p2Uid]||0;
  var n1=mi[p1Uid]?mi[p1Uid].name:'P1', n2=mi[p2Uid]?mi[p2Uid].name:'P2';
  var emoji,title,sub;
  var isDestroy=gameType==='destroy';
  var extra=isDestroy?' · 💥 '+destroyedCount+' bị huỷ':'';
  if(w==='draw'){
    if(lEl)lEl.className='stat-bet'; if(rEl)rEl.className='stat-profit zero';
    if(tgEl)tgEl.textContent='Hoà'; if(sbEl)sbEl.textContent='Hoà nhau!';
    emoji='🤝'; title='Hoà!'; sub=n1+': '+s1+' · '+n2+': '+s2+extra;
  }else if(w===myUid){
    var mp=w===p1Uid;
    if(lEl)lEl.className=mp?'stat-bet ts-win':'stat-bet ts-lose';
    if(rEl)rEl.className=mp?'stat-profit ts-lose':'stat-profit ts-win';
    if(tgEl)tgEl.textContent='Thắng'; if(sbEl)sbEl.textContent='Bạn thắng!';
    emoji='🏆'; title='Bạn thắng!'; sub=n1+': '+s1+' · '+n2+': '+s2+extra;
    addPoints('Tìm Số MP','Thắng',50).catch(function(){});
  }else{
    var wn=mi[w]?mi[w].name:'Đối thủ', mp=w===p1Uid;
    if(lEl)lEl.className=mp?'stat-bet ts-win':'stat-bet ts-lose';
    if(rEl)rEl.className=mp?'stat-profit ts-lose':'stat-profit ts-win';
    if(tgEl)tgEl.textContent='Thua'; if(sbEl)sbEl.textContent=wn+' thắng!';
    emoji='😔'; title=wn+' thắng!'; sub=n1+': '+s1+' · '+n2+': '+s2+extra;
  }
  if(rsBanner){
    setText('rs-b-em',emoji); setText('rs-b-tl',title); setText('rs-b-sub',sub);
    rsBanner.style.display='flex';
  }
}

window.gameReset=async function(){
  _resultDone=false;_starting=false;
  if(rsBanner)rsBanner.style.display='none';
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
      if(r.hostUid===myUid){
        // Chuyển chủ phòng cho người kế tiếp thay vì xoá phòng
        var rem=(r.members||[]).filter(function(u){return u!==myUid});
        if(rem.length===0){await deleteDoc(doc(db,'rooms',roomId))}else{
          var newHost=rem[0];
          var mi=Object.assign({},r.memberInfo||{}); delete mi[myUid];
          await updateDoc(doc(db,'rooms',roomId),{hostUid:newHost,members:arrayRemove(myUid),memberInfo:mi})
        }
      }else{
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
