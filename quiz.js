import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints, updateMission } from './points.js';

const firebaseConfig = {apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",authDomain:"lienquan-fake.firebaseapp.com",projectId:"lienquan-fake",storageBucket:"lienquan-fake.firebasestorage.app",messagingSenderId:"782694799992",appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Particle canvas
const bgC = document.getElementById('bg-canvas'), bgX = bgC.getContext('2d');
let bpts = [];
function resizeBg(){ bgC.width=innerWidth; bgC.height=innerHeight; }
resizeBg(); window.addEventListener('resize', resizeBg);
for(let i=0;i<40;i++) bpts.push({x:Math.random()*bgC.width,y:Math.random()*bgC.height,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,r:Math.random()*1.5+.5});
function drawBg(){ bgX.clearRect(0,0,bgC.width,bgC.height); bpts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=bgC.width; if(p.x>bgC.width)p.x=0; if(p.y<0)p.y=bgC.height; if(p.y>bgC.height)p.y=0; bgX.beginPath(); bgX.arc(p.x,p.y,p.r,0,Math.PI*2); bgX.fillStyle='rgba(56,189,248,0.5)'; bgX.fill(); }); requestAnimationFrame(drawBg); } drawBg();

// Auth
onAuthStateChanged(auth, async user => {
  if(user){ const pts = await getPoints(); const el = document.getElementById('nav-pts'); if(el) el.textContent = '★ ' + pts.toLocaleString('vi'); }
});

// ===== THANG ĐIỂM (đúng chuẩn ATLP) =====
// Câu 1..15, mức an toàn tại câu 5 (30đ) và câu 10 (160đ)
// Điểm tối đa câu 15: 500đ — hợp lý với hệ thống ban đầu 10.000đ
const PRIZE_LADDER = [
  { q: 1,  pts: 2,   safe: false },
  { q: 2,  pts: 5,   safe: false },
  { q: 3,  pts: 10,  safe: false },
  { q: 4,  pts: 18,  safe: false },
  { q: 5,  pts: 30,  safe: true  },  // 🛡️ mức an toàn 1
  { q: 6,  pts: 45,  safe: false },
  { q: 7,  pts: 65,  safe: false },
  { q: 8,  pts: 90,  safe: false },
  { q: 9,  pts: 120, safe: false },
  { q: 10, pts: 160, safe: true  },  // 🛡️ mức an toàn 2
  { q: 11, pts: 210, safe: false },
  { q: 12, pts: 260, safe: false },
  { q: 13, pts: 320, safe: false },
  { q: 14, pts: 400, safe: false },
  { q: 15, pts: 500, safe: false },  // 🏆 đỉnh
];

// Lấy điểm an toàn hiện tại (điểm tích lũy thấp nhất đảm bảo giữ được)
function getSafeFloor(currentQ) {
  // currentQ: 0-based index (0 = chưa trả lời câu nào)
  if (currentQ >= 10) return PRIZE_LADDER[9].pts; // đã qua câu 10
  if (currentQ >= 5)  return PRIZE_LADDER[4].pts;  // đã qua câu 5
  return 0;
}

// ===== 200 CÂU HỎI =====
const ALL_Q = [
  // === DỄ (câu 1-5) ===
  {q:"Hành tinh nào lớn nhất trong hệ Mặt Trời?",o:["Sao Mộc","Sao Thổ","Sao Thiên Vương","Sao Hải Vương"],a:0,d:1},
  {q:"Thủ đô của Nhật Bản là gì?",o:["Tokyo","Osaka","Kyoto","Hiroshima"],a:0,d:1},
  {q:"1 + 1 = ?",o:["2","3","1","0"],a:0,d:1},
  {q:"Loài hoa nào là quốc hoa của Việt Nam?",o:["Hoa sen","Hoa mai","Hoa đào","Hoa lan"],a:0,d:1},
  {q:"Nước chiếm bao nhiêu % diện tích Trái Đất?",o:["71%","61%","81%","51%"],a:0,d:1},
  {q:"Tháp Eiffel nằm ở thành phố nào?",o:["Paris","London","Rome","Berlin"],a:0,d:1},
  {q:"Căn bậc hai của 144 là?",o:["12","11","13","14"],a:0,d:1},
  {q:"Ai phát minh ra điện thoại?",o:["Alexander Graham Bell","Thomas Edison","Nikola Tesla","Marconi"],a:0,d:1},
  {q:"Công ty nào sản xuất iPhone?",o:["Apple","Samsung","Google","Sony"],a:0,d:1},
  {q:"Kim tự tháp Giza nằm ở đâu?",o:["Ai Cập","Iraq","Ấn Độ","Mexico"],a:0,d:1},
  {q:"Thủ đô Hà Nội có tên cũ là gì?",o:["Thăng Long","Phú Xuân","Đại La","Tống Bình"],a:0,d:1},
  {q:"Vịnh nào của VN được UNESCO công nhận Di sản thế giới?",o:["Vịnh Hạ Long","Vịnh Nha Trang","Vịnh Đà Nẵng","Vịnh Cam Ranh"],a:0,d:1},
  {q:"World Cup bóng đá được tổ chức mấy năm một lần?",o:["4 năm","2 năm","6 năm","8 năm"],a:0,d:1},
  {q:"Bóng rổ có bao nhiêu cầu thủ mỗi đội trên sân?",o:["5","6","4","7"],a:0,d:1},
  {q:"CPU là viết tắt của?",o:["Central Processing Unit","Computer Processing Unit","Central Program Unit","Core Processing Unit"],a:0,d:1},
  {q:"Ngày thống nhất đất nước Việt Nam là ngày nào?",o:["30/4/1975","2/9/1945","20/7/1954","7/5/1954"],a:0,d:1},
  {q:"Màu sắc nào không có trong cầu vồng?",o:["Hồng","Đỏ","Vàng","Tím"],a:0,d:1},
  {q:"Tháng nào có 28 ngày?",o:["Tất cả các tháng","Tháng 2","Tháng 2 và 11","Chỉ tháng 2"],a:0,d:1},
  {q:"Quốc gia nào có diện tích lớn nhất thế giới?",o:["Nga","Canada","Trung Quốc","Mỹ"],a:0,d:1},
  {q:"1 tá bằng bao nhiêu?",o:["12","10","20","24"],a:0,d:1},

  // === TRUNG BÌNH (câu 6-10) ===
  {q:"DNA là viết tắt của?",o:["Deoxyribonucleic acid","Dioxynucleic acid","Deoxyribose nucleotide","Dinitrogen acid"],a:0,d:2},
  {q:"Nguyên tố hóa học có ký hiệu Au là gì?",o:["Vàng","Bạc","Đồng","Sắt"],a:0,d:2},
  {q:"Số tiếp theo trong dãy 1,1,2,3,5,8,... là?",o:["13","11","12","14"],a:0,d:2},
  {q:"Tốc độ ánh sáng là bao nhiêu km/s?",o:["300.000","150.000","450.000","600.000"],a:0,d:2},
  {q:"Triều đại phong kiến nào tồn tại lâu nhất ở Việt Nam?",o:["Nhà Lý","Nhà Trần","Nhà Lê","Nhà Nguyễn"],a:2,d:2},
  {q:"Vitamin C còn được gọi là?",o:["Axit ascorbic","Axit citric","Axit lactic","Axit folic"],a:0,d:2},
  {q:"Lực hấp dẫn trên Mặt Trăng bằng bao nhiêu % so với Trái Đất?",o:["16.6%","25%","50%","33%"],a:0,d:2},
  {q:"Bao nhiêu xương trong cơ thể người trưởng thành?",o:["206","208","210","212"],a:0,d:2},
  {q:"Vua nào dời đô từ Hoa Lư về Thăng Long?",o:["Lý Thái Tổ","Lý Thái Tông","Đinh Tiên Hoàng","Lê Đại Hành"],a:0,d:2},
  {q:"5! (giai thừa 5) bằng?",o:["120","60","100","24"],a:0,d:2},
  {q:"Nguyên tố nào nhiều nhất trong khí quyển Trái Đất?",o:["Nitơ","Oxy","Argon","CO2"],a:0,d:2},
  {q:"Chiến dịch Điện Biên Phủ kết thúc năm nào?",o:["1954","1953","1955","1956"],a:0,d:2},
  {q:"Tổng các số từ 1 đến 100 bằng?",o:["5050","4950","5100","5000"],a:0,d:2},
  {q:"Ngôn ngữ lập trình nào được tạo bởi Brendan Eich?",o:["JavaScript","Java","TypeScript","CoffeeScript"],a:0,d:2},
  {q:"Đỉnh núi cao nhất Việt Nam là gì?",o:["Fansipan","Phu Luông","Ngọc Linh","Tây Côn Lĩnh"],a:0,d:2},
  {q:"Nhạc cụ truyền thống nào của Việt Nam có 16 dây?",o:["Đàn tranh","Đàn bầu","Đàn nguyệt","Đàn tỳ bà"],a:0,d:2},
  {q:"Người Việt Nam đầu tiên bay vào vũ trụ là ai?",o:["Phạm Tuân","Nguyễn Văn Cốc","Lê Trọng Tấn","Võ Nguyên Giáp"],a:0,d:2},
  {q:"Ai được coi là cha đẻ của máy tính?",o:["Alan Turing","Bill Gates","Steve Jobs","John von Neumann"],a:0,d:2},
  {q:"Đinh Tiên Hoàng đặt tên nước là gì?",o:["Đại Cồ Việt","Đại Việt","Đại Ngu","Việt Nam"],a:0,d:2},
  {q:"Sông nào dài nhất Việt Nam?",o:["Sông Mê Kông","Sông Hồng","Sông Đà","Sông Đồng Nai"],a:0,d:2},

  // === KHÓ (câu 11-15) ===
  {q:"Khởi nghĩa Hai Bà Trưng nổ ra năm nào?",o:["40 SCN","43 SCN","111 SCN","208 SCN"],a:0,d:3},
  {q:"Con tắc kè hoa thay đổi màu sắc để làm gì chủ yếu?",o:["Giao tiếp và điều chỉnh nhiệt độ","Ngụy trang săn mồi","Cảnh báo kẻ thù","Thu hút bạn tình"],a:0,d:3},
  {q:"Sách Guinness ghi nhận con người sống lâu nhất là bao nhiêu tuổi?",o:["122","115","118","120"],a:0,d:3},
  {q:"Võ sĩ đầu tiên của Việt Nam giành HCV Olympic?",o:["Hoàng Anh Tuấn","Nguyễn Thị Ánh Viên","Trần Hiếu Ngân","Nguyễn Tiến Minh"],a:2,d:3},
  {q:"Python được tạo ra năm nào?",o:["1991","1995","2000","1985"],a:0,d:3},
  {q:"Cây nào sống lâu nhất trên Trái Đất?",o:["Cây thông Bristlecone","Cây đại thụ","Cây baobab","Cây sồi"],a:0,d:3},
  {q:"Tế bào não gọi là?",o:["Nơ-ron","Hồng cầu","Bạch cầu","Tiểu cầu"],a:0,d:3},
  {q:"Định luật nào nói 'mỗi hành động đều có phản lực bằng và ngược chiều'?",o:["Định luật 3 Newton","Định luật 1 Newton","Định luật 2 Newton","Định luật Kepler"],a:0,d:3},
  {q:"Bao nhiêu phần trăm nước ngọt trên Trái Đất?",o:["3%","10%","20%","1%"],a:0,d:3},
  {q:"Hiện tượng cầu vồng xảy ra do?",o:["Tán xạ ánh sáng qua hơi nước","Phản xạ ánh sáng","Nhiễu xạ ánh sáng","Khúc xạ ánh sáng"],a:0,d:3},
  {q:"Gen di truyền nằm ở đâu trong tế bào?",o:["Nhân tế bào","Màng tế bào","Tế bào chất","Ty thể"],a:0,d:3},
  {q:"Ngôn ngữ nào có nhiều người nói nhất thế giới (tính cả bản ngữ lẫn học)?",o:["Tiếng Anh","Tiếng Trung","Tiếng Tây Ban Nha","Tiếng Hindi"],a:0,d:3},
  {q:"Dãy núi Himalaya thuộc châu nào?",o:["Châu Á","Châu Phi","Châu Mỹ","Châu Âu"],a:0,d:3},
  {q:"1 GB bằng bao nhiêu MB (theo chuẩn nhị phân)?",o:["1024 MB","1000 MB","512 MB","2048 MB"],a:0,d:3},
  {q:"Bão nhiệt đới ở Thái Bình Dương còn gọi là?",o:["Typhoon","Hurricane","Cyclone","Tornado"],a:0,d:3},
  {q:"Vitamin nào giúp đông máu?",o:["Vitamin K","Vitamin C","Vitamin D","Vitamin A"],a:0,d:3},
  {q:"Loài vật nào được coi là biểu tượng trường thọ ở châu Á?",o:["Rùa","Hổ","Rồng","Phượng hoàng"],a:0,d:3},
  {q:"'Big Bang' là học thuyết về điều gì?",o:["Nguồn gốc vũ trụ","Vụ nổ bom nguyên tử","Sự hình thành Trái Đất","Sự tuyệt chủng khủng long"],a:0,d:3},
  {q:"Công thức hóa học của muối ăn là?",o:["NaCl","NaOH","HCl","Na2O"],a:0,d:3},
  {q:"Số nguyên tố đầu tiên là?",o:["2","1","3","5"],a:0,d:3},
];

// ===== SHUFFLE =====
function shuffle(arr) {
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// Lấy 5 câu theo độ khó d
function pickByDiff(pool, d, n) {
  return shuffle(pool.filter(q=>q.d===d)).slice(0,n);
}

// Tạo 15 câu: 5 dễ + 5 trung bình + 5 khó
function buildSession() {
  const easy   = pickByDiff(ALL_Q, 1, 5);
  const mid    = pickByDiff(ALL_Q, 2, 5);
  const hard   = pickByDiff(ALL_Q, 3, 5);
  return [...easy, ...mid, ...hard];
}

// ===== QUIZ ENGINE =====
let questions = [], current = 0, answered = false;
let timeLeft = 30, timerInt = null;
let usedLifelines = {}, safeFloor = 0;

const Quiz = window.Quiz = {

  start() {
    questions   = buildSession();
    current     = 0;
    answered    = false;
    safeFloor   = 0;
    usedLifelines = { '5050': false, 'audience': false, 'time': false, 'skip': false };
    showScreen('game');
    buildLadder();
    resetLifelineUI();
    loadQ();
  },

  showMenu() {
    showScreen('menu');
  },

  use5050() {
    if(answered || usedLifelines['5050']) return;
    usedLifelines['5050'] = true;
    document.getElementById('ll-5050').classList.add('used');
    const wrongs = [...document.querySelectorAll('.qz-opt')].filter(b => b.dataset.correct !== '1');
    shuffle(wrongs).slice(0,2).forEach(b => b.classList.add('hidden-opt'));
  },

  useAudience() {
    if(answered || usedLifelines['audience']) return;
    usedLifelines['audience'] = true;
    document.getElementById('ll-audience').classList.add('used');
    const aud = document.getElementById('qz-audience');
    aud.innerHTML = '';
    const opts = [...document.querySelectorAll('.qz-opt')];
    // sinh % giả: đáp đúng có trọng số cao hơn
    let pcts = opts.map(b => b.dataset.correct==='1' ? 45+Math.random()*30 : 5+Math.random()*20);
    const total = pcts.reduce((s,v)=>s+v,0);
    pcts = pcts.map(v=>Math.round(v/total*100));
    const labels = ['A','B','C','D'];
    opts.forEach((_, i) => {
      const bar = document.createElement('div');
      bar.className = 'qz-aud-bar';
      bar.innerHTML = `<div class="qz-aud-fill" style="height:${pcts[i]}%"></div>
        <span class="qz-aud-label">${labels[i]}</span>
        <span class="qz-aud-pct">${pcts[i]}%</span>`;
      aud.appendChild(bar);
    });
    aud.classList.remove('hidden');
  },

  useTime() {
    if(answered || usedLifelines['time']) return;
    usedLifelines['time'] = true;
    document.getElementById('ll-time').classList.add('used');
    timeLeft = Math.min(timeLeft + 15, 45);
  },

  useSkip() {
    if(answered || usedLifelines['skip']) return;
    usedLifelines['skip'] = true;
    document.getElementById('ll-skip').classList.add('used');
    answered = true;
    clearInterval(timerInt);
    document.getElementById('qz-audience').classList.add('hidden');
    setTimeout(() => { current++; if(current>=15) endQuiz(); else loadQ(); }, 400);
  }
};

// ===== UI HELPERS =====
function showScreen(id) {
  document.querySelectorAll('.qz-screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

function resetLifelineUI() {
  ['ll-5050','ll-audience','ll-time','ll-skip'].forEach(id=>{
    const el=document.getElementById(id);
    el.classList.remove('used'); el.disabled=false;
  });
}

// Xây bảng thang điểm bên phải (từ cao → thấp)
function buildLadder() {
  const el = document.getElementById('qz-ladder');
  el.innerHTML = '';
  [...PRIZE_LADDER].reverse().forEach(row => {
    const div = document.createElement('div');
    div.className = 'qz-ladder-row' + (row.safe ? ' safe' : '');
    div.id = `ladder-q${row.q}`;
    div.innerHTML = `<span>${row.safe ? (row.q===15?'🏆':'🛡️') : ''} Câu ${row.q}</span>
                     <span class="qz-ladder-pts">${row.pts}</span>`;
    el.appendChild(div);
  });
}

function updateLadder() {
  PRIZE_LADDER.forEach((row, i) => {
    const el = document.getElementById(`ladder-q${row.q}`);
    if(!el) return;
    el.className = 'qz-ladder-row' + (row.safe ? ' safe' : '');
    if(i < current)        el.classList.add('done');
    else if(i === current) el.classList.add('current');
  });
}

// ===== LOAD CÂU HỎI =====
function loadQ() {
  answered = false;
  clearInterval(timerInt);
  timeLeft = 30;
  document.getElementById('qz-audience').classList.add('hidden');
  document.getElementById('qz-feedback').className = 'qz-feedback hidden';

  const q = questions[current];
  const idxs = shuffle([0,1,2,3]);
  const ladder = PRIZE_LADDER[current];

  document.getElementById('qz-question').textContent = q.q;
  document.getElementById('qz-count').textContent     = `Câu ${current+1}/15`;
  document.getElementById('qz-score-live').textContent = safeFloor;
  document.getElementById('qz-prog').style.width       = `${(current/15)*100}%`;

  const opts = document.getElementById('qz-options');
  opts.innerHTML = '';
  const labels = ['A. ','B. ','C. ','D. '];
  idxs.forEach((origIdx, pos) => {
    const btn = document.createElement('button');
    btn.className = 'qz-opt';
    btn.textContent = labels[pos] + q.o[origIdx];
    btn.dataset.correct = origIdx===q.a ? '1' : '0';
    btn.onclick = () => selectAnswer(btn, origIdx===q.a);
    opts.appendChild(btn);
  });

  updateLadder();
  startTimer();
}

// ===== TIMER =====
function startTimer() {
  updateTimerUI(timeLeft);
  timerInt = setInterval(() => {
    timeLeft--;
    updateTimerUI(timeLeft);
    if(timeLeft<=0){ clearInterval(timerInt); if(!answered) timeOut(); }
  }, 1000);
}

function updateTimerUI(t) {
  document.getElementById('qz-timer').textContent = t;
  const pct = (t/45)*100;
  document.getElementById('qz-ring').setAttribute('stroke-dasharray',`${pct} 100`);
  document.getElementById('qz-ring').style.stroke = t>10?'#38bdf8':t>5?'#fbbf24':'#f87171';
}

// ===== CHỌN ĐÁP ÁN =====
function selectAnswer(btn, isCorrect) {
  if(answered) return;
  answered = true;
  clearInterval(timerInt);
  document.getElementById('qz-audience').classList.add('hidden');

  document.querySelectorAll('.qz-opt').forEach(b=>{
    b.disabled = true;
    if(b.dataset.correct==='1') b.classList.add('correct');
  });

  const fb = document.getElementById('qz-feedback');
  const ladder = PRIZE_LADDER[current];

  if(isCorrect) {
    btn.classList.add('correct');
    // Cập nhật điểm an toàn nếu câu này là mốc
    if(ladder.safe) safeFloor = ladder.pts;
    fb.textContent = `✅ Chính xác! Đạt ${ladder.pts} điểm` + (ladder.safe ? ' 🛡️ (Mức an toàn!)' : '');
    fb.className = 'qz-feedback correct';
    document.getElementById('qz-score-live').textContent = ladder.pts;
    updateMission('quiz5', 1);
    setTimeout(() => { current++; if(current>=15) endQuiz(); else loadQ(); }, 1600);
  } else {
    btn.classList.add('wrong');
    fb.textContent = `❌ Sai! Bạn nhận được ${safeFloor} điểm (mức an toàn)`;
    fb.className = 'qz-feedback wrong';
    setTimeout(() => endQuiz(false), 1800);
  }
}

// Hết giờ
function timeOut() {
  answered = true;
  document.querySelectorAll('.qz-opt').forEach(b=>{
    b.disabled=true;
    if(b.dataset.correct==='1') b.classList.add('correct');
  });
  const fb = document.getElementById('qz-feedback');
  fb.textContent = `⏰ Hết giờ! Bạn nhận được ${safeFloor} điểm (mức an toàn)`;
  fb.className = 'qz-feedback timeout';
  setTimeout(() => endQuiz(false), 1800);
}

// ===== KẾT THÚC =====
async function endQuiz(completed = true) {
  clearInterval(timerInt);

  const reached   = current; // số câu đã qua (0-based next index)
  const earnedPts = completed ? PRIZE_LADDER[14].pts : safeFloor;
  const correctCount = completed ? 15 : (reached + (completed ? 0 : 0));

  // Tính câu đúng thực tế
  let actualCorrect = reached;
  if(!completed) actualCorrect = reached; // reached = số câu đã vượt qua thành công

  let emoji='😅', title='Dừng lại!';
  let msg = '';

  if(completed) {
    emoji='🏆'; title='Xuất sắc! Hoàn thành!';
    msg = `Bạn trả lời đúng cả 15 câu và nhận ${PRIZE_LADDER[14].pts} điểm!`;
  } else if(earnedPts===PRIZE_LADDER[9].pts) {
    emoji='⭐'; title='Khá giỏi!';
    msg = `Đã đạt mức an toàn câu 10 — giữ ${earnedPts} điểm.`;
  } else if(earnedPts===PRIZE_LADDER[4].pts) {
    emoji='😊'; title='Tốt lắm!';
    msg = `Đã đạt mức an toàn câu 5 — giữ ${earnedPts} điểm.`;
  } else if(earnedPts===0) {
    emoji='😢'; title='Chưa về đích!';
    msg = `Chưa qua mức an toàn nào. Điểm nhận: 0.`;
  } else {
    emoji='👍'; title='Không tệ!';
    msg = `Nhận ${earnedPts} điểm.`;
  }

  // Mức an toàn hiển thị
  let safeLabel = '—';
  if(earnedPts === PRIZE_LADDER[9].pts) safeLabel = 'Câu 10';
  else if(earnedPts === PRIZE_LADDER[4].pts) safeLabel = 'Câu 5';

  document.getElementById('res-emoji').textContent    = emoji;
  document.getElementById('res-title').textContent    = title;
  document.getElementById('res-message').textContent  = msg;
  document.getElementById('res-q').textContent        = actualCorrect;
  document.getElementById('res-safe').textContent     = safeLabel;
  document.getElementById('res-pts').textContent      = earnedPts;

  showScreen('result');

  if(auth.currentUser && earnedPts > 0) {
    await addPoints('Quiz', `Quiz hoàn thành (${actualCorrect}/15 câu)`, earnedPts);
    await updateMission('play3', 1);
    if(actualCorrect > 0) await updateMission('win1', 1);

    // Cập nhật nav điểm
    const pts = await getPoints();
    const el = document.getElementById('nav-pts');
    if(el) el.textContent = '★ ' + pts.toLocaleString('vi');
  }
}
