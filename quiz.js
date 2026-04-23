import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addPoints, getPoints, updateMission } from './points.js';

const firebaseConfig = {apiKey:"AIzaSyBupVBUTEJnBSBTShXKm8qnIJ8dGl4hQoY",authDomain:"lienquan-fake.firebaseapp.com",projectId:"lienquan-fake",storageBucket:"lienquan-fake.firebasestorage.app",messagingSenderId:"782694799992",appId:"1:782694799992:web:2d8e4a28626c3bbae8ab8d"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Particle canvas
const bgC = document.getElementById('bg-canvas'), bgX = bgC.getContext('2d');
let bpts = [];
function resizeBg(){ bgC.width = innerWidth; bgC.height = innerHeight; }
resizeBg(); window.addEventListener('resize', resizeBg);
for(let i=0;i<40;i++) bpts.push({x:Math.random()*bgC.width,y:Math.random()*bgC.height,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,r:Math.random()*1.5+.5});
function drawBg(){ bgX.clearRect(0,0,bgC.width,bgC.height); bpts.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=bgC.width; if(p.x>bgC.width)p.x=0; if(p.y<0)p.y=bgC.height; if(p.y>bgC.height)p.y=0; bgX.beginPath(); bgX.arc(p.x,p.y,p.r,0,Math.PI*2); bgX.fillStyle='rgba(56,189,248,0.5)'; bgX.fill(); }); requestAnimationFrame(drawBg); } drawBg();

// Auth
onAuthStateChanged(auth, async user => {
  if(user){ const pts = await getPoints(); const el = document.getElementById('nav-pts'); if(el) el.textContent = pts + ' điểm'; }
});

// ===== 200 CÂU HỎI =====
const ALL_Q = [
  {q:"Năm nào nước Việt Nam Dân chủ Cộng hòa ra đời?",o:["1945","1954","1975","1930"],a:0},
  {q:"Ai là chủ tịch nước đầu tiên của Việt Nam?",o:["Hồ Chí Minh","Tôn Đức Thắng","Trường Chinh","Phạm Văn Đồng"],a:0},
  {q:"Chiến dịch Điện Biên Phủ kết thúc năm nào?",o:["1954","1953","1955","1956"],a:0},
  {q:"Ngày thống nhất đất nước Việt Nam là ngày nào?",o:["30/4/1975","2/9/1945","20/7/1954","7/5/1954"],a:0},
  {q:"Vua nào dời đô từ Hoa Lư về Thăng Long?",o:["Lý Thái Tổ","Lý Thái Tông","Đinh Tiên Hoàng","Lê Đại Hành"],a:0},
  {q:"Triều đại phong kiến nào tồn tại lâu nhất ở Việt Nam?",o:["Nhà Lý","Nhà Trần","Nhà Lê","Nhà Nguyễn"],a:2},
  {q:"Người Việt Nam đầu tiên bay vào vũ trụ là ai?",o:["Phạm Tuân","Nguyễn Văn Cốc","Lê Trọng Tấn","Võ Nguyên Giáp"],a:0},
  {q:"Khởi nghĩa Hai Bà Trưng nổ ra năm nào?",o:["40 SCN","43 SCN","111 SCN","208 SCN"],a:0},
  {q:"Đinh Tiên Hoàng đặt tên nước là gì?",o:["Đại Cồ Việt","Đại Việt","Đại Ngu","Việt Nam"],a:0},
  {q:"Thủ đô Hà Nội có tên cũ là gì?",o:["Thăng Long","Phú Xuân","Đại La","Tống Bình"],a:0},
  {q:"Sông nào dài nhất Việt Nam?",o:["Sông Mê Kông","Sông Hồng","Sông Đà","Sông Đồng Nai"],a:0},
  {q:"Đỉnh núi cao nhất Việt Nam là gì?",o:["Fansipan","Phu Luông","Ngọc Linh","Tây Côn Lĩnh"],a:0},
  {q:"Việt Nam có bao nhiêu tỉnh thành?",o:["63","61","64","58"],a:0},
  {q:"Thành phố nào đông dân nhất Việt Nam?",o:["TP. Hồ Chí Minh","Hà Nội","Đà Nẵng","Cần Thơ"],a:0},
  {q:"Vịnh nào của Việt Nam được UNESCO công nhận là Di sản thế giới?",o:["Vịnh Hạ Long","Vịnh Nha Trang","Vịnh Đà Nẵng","Vịnh Cam Ranh"],a:0},
  {q:"Đồng bằng nào lớn nhất Việt Nam?",o:["Đồng bằng sông Cửu Long","Đồng bằng sông Hồng","Đồng bằng Thanh-Nghệ-Tĩnh","Đồng bằng Duyên hải Nam Trung Bộ"],a:0},
  {q:"Hồ nào lớn nhất Việt Nam?",o:["Hồ Ba Bể","Hồ Tây","Hồ Xuân Hương","Hồ Núi Cốc"],a:0},
  {q:"Tỉnh nào có diện tích lớn nhất Việt Nam?",o:["Nghệ An","Gia Lai","Đắk Lắk","Lào Cai"],a:0},
  {q:"Nước chiếm bao nhiêu % diện tích Trái Đất?",o:["71%","61%","81%","51%"],a:0},
  {q:"Tốc độ ánh sáng là bao nhiêu km/s?",o:["300.000","150.000","450.000","600.000"],a:0},
  {q:"Nguyên tố nào nhiều nhất trong khí quyển Trái Đất?",o:["Nitơ","Oxy","Argon","CO2"],a:0},
  {q:"DNA là viết tắt của?",o:["Deoxyribonucleic acid","Dioxynucleic acid","Deoxyribose nucleotide","Dinitrogen acid"],a:0},
  {q:"Hành tinh nào lớn nhất trong hệ Mặt Trời?",o:["Sao Mộc","Sao Thổ","Sao Thiên Vương","Sao Hải Vương"],a:0},
  {q:"Ai phát minh ra điện thoại?",o:["Alexander Graham Bell","Thomas Edison","Nikola Tesla","Guglielmo Marconi"],a:0},
  {q:"Nguyên tố hóa học có ký hiệu Au là gì?",o:["Vàng","Bạc","Đồng","Sắt"],a:0},
  {q:"Bao nhiêu xương trong cơ thể người trưởng thành?",o:["206","208","210","212"],a:0},
  {q:"Nhiệt độ sôi của nước ở điều kiện tiêu chuẩn là?",o:["100°C","90°C","110°C","95°C"],a:0},
  {q:"Lực hấp dẫn trên Mặt Trăng bằng bao nhiêu % so với Trái Đất?",o:["16.6%","25%","50%","33%"],a:0},
  {q:"Ai là người phát triển thuyết tương đối?",o:["Albert Einstein","Isaac Newton","Stephen Hawking","Niels Bohr"],a:0},
  {q:"Vitamin C còn được gọi là?",o:["Axit ascorbic","Axit citric","Axit lactic","Axit folic"],a:0},
  {q:"Công thức hóa học của muối ăn là?",o:["NaCl","NaOH","HCl","Na2O"],a:0},
  {q:"Hành tinh nào gần Mặt Trời nhất?",o:["Sao Thủy","Sao Kim","Trái Đất","Sao Hỏa"],a:0},
  {q:"π (pi) xấp xỉ bằng?",o:["3.14159","3.14256","3.14169","3.14149"],a:0},
  {q:"Căn bậc hai của 144 là?",o:["12","11","13","14"],a:0},
  {q:"1 tá bằng bao nhiêu?",o:["12","10","20","24"],a:0},
  {q:"Số nguyên tố đầu tiên là?",o:["2","1","3","5"],a:0},
  {q:"Tam giác đều có tổng các góc bằng?",o:["180°","270°","360°","90°"],a:0},
  {q:"World Cup bóng đá được tổ chức mấy năm một lần?",o:["4 năm","2 năm","6 năm","8 năm"],a:0},
  {q:"Môn thể thao nào có thuật ngữ 'love' nghĩa là điểm 0?",o:["Tennis","Cầu lông","Bóng bàn","Golf"],a:0},
  {q:"Bóng rổ có bao nhiêu cầu thủ mỗi đội trên sân?",o:["5","6","4","7"],a:0},
  {q:"Sân bóng đá tiêu chuẩn dài bao nhiêu mét?",o:["105m","100m","110m","90m"],a:0},
  {q:"Kỷ lục thế giới 100m của Usain Bolt là?",o:["9.58s","9.69s","9.72s","9.81s"],a:0},
  {q:"Olympic được tổ chức mấy năm một lần?",o:["4 năm","2 năm","6 năm","8 năm"],a:0},
  {q:"CPU là viết tắt của?",o:["Central Processing Unit","Computer Processing Unit","Central Program Unit","Core Processing Unit"],a:0},
  {q:"HTTP là viết tắt của?",o:["HyperText Transfer Protocol","HyperText Transmission Protocol","High Transfer Text Protocol","HyperText Transport Protocol"],a:0},
  {q:"Công ty nào tạo ra hệ điều hành Android?",o:["Google","Apple","Microsoft","Samsung"],a:0},
  {q:"AI nghĩa là gì?",o:["Artificial Intelligence","Automated Interface","Advanced Internet","Applied Information"],a:0},
  {q:"1 GB bằng bao nhiêu MB?",o:["1024 MB","1000 MB","512 MB","2048 MB"],a:0},
  {q:"Công ty nào sản xuất iPhone?",o:["Apple","Samsung","Google","Sony"],a:0},
  {q:"WWW là viết tắt của?",o:["World Wide Web","World Wire Web","Wide World Web","World Web Wire"],a:0},
  {q:"RAM là viết tắt của?",o:["Random Access Memory","Read Access Memory","Random Array Memory","Read Array Memory"],a:0},
  {q:"Kim tự tháp Giza nằm ở đâu?",o:["Ai Cập","Iraq","Ấn Độ","Mexico"],a:0},
  {q:"Vạn Lý Trường Thành nằm ở đâu?",o:["Trung Quốc","Mông Cổ","Nhật Bản","Hàn Quốc"],a:0},
  {q:"Tháp Eiffel nằm ở thành phố nào?",o:["Paris","London","Rome","Berlin"],a:0},
  {q:"Ngôn ngữ nào có nhiều người nói nhất thế giới?",o:["Tiếng Anh","Tiếng Trung","Tiếng Tây Ban Nha","Tiếng Hindi"],a:0},
  {q:"Quốc gia nào có diện tích lớn nhất thế giới?",o:["Nga","Canada","Trung Quốc","Mỹ"],a:0},
  {q:"Quốc gia nào đông dân nhất thế giới?",o:["Ấn Độ","Trung Quốc","Mỹ","Indonesia"],a:0},
  {q:"Thủ đô của Nhật Bản là gì?",o:["Tokyo","Osaka","Kyoto","Hiroshima"],a:0},
  {q:"Phở có nguồn gốc từ tỉnh nào?",o:["Nam Định","Hà Nội","Hải Phòng","Ninh Bình"],a:0},
  {q:"Nước mắm làm từ gì?",o:["Cá và muối","Tôm và muối","Mực và muối","Cua và muối"],a:0},
  {q:"Cà phê trứng nổi tiếng ở thành phố nào?",o:["Hà Nội","TP HCM","Đà Lạt","Huế"],a:0},
  {q:"Động vật nào có thời gian mang thai dài nhất?",o:["Voi","Cá voi","Tê giác","Hà mã"],a:0},
  {q:"Loài chim nào chạy nhanh nhất?",o:["Đà điểu","Chim cánh cụt","Vẹt","Đại bàng"],a:0},
  {q:"Loài động vật nào ngủ đứng?",o:["Ngựa","Bò","Lợn","Chó"],a:0},
  {q:"Nhạc cụ nào có nhiều dây nhất?",o:["Đàn harp","Đàn guitar","Đàn piano","Đàn violin"],a:0},
  {q:"Nhạc cụ truyền thống nào của Việt Nam có 16 dây?",o:["Đàn tranh","Đàn bầu","Đàn nguyệt","Đàn tỳ bà"],a:0},
  {q:"Bộ phim nào có doanh thu cao nhất mọi thời đại?",o:["Avatar","Avengers: Endgame","Titanic","Star Wars"],a:0},
  {q:"Số tiếp theo trong dãy 1, 1, 2, 3, 5, 8, ... là?",o:["13","11","12","14"],a:0},
  {q:"5! (giai thừa 5) bằng?",o:["120","60","100","24"],a:0},
  {q:"Tổng các số từ 1 đến 100 bằng?",o:["5050","4950","5100","5000"],a:0},
  {q:"Màu sắc nào không có trong cầu vồng?",o:["Hồng","Đỏ","Vàng","Tím"],a:0},
  {q:"Loài hoa nào là quốc hoa của Việt Nam?",o:["Hoa sen","Hoa mai","Hoa đào","Hoa lan"],a:0},
  {q:"Bão nhiệt đới ở Thái Bình Dương còn gọi là?",o:["Typhoon","Hurricane","Cyclone","Tornado"],a:0},
  {q:"Nếu bạn có 3 quả táo và lấy đi 2 quả, bạn có bao nhiêu quả?",o:["2","1","3","0"],a:0},
  {q:"Tháng nào có 28 ngày?",o:["Tất cả các tháng","Tháng 2","Tháng 2 và tháng 11","Chỉ tháng 2"],a:0},
  {q:"Quá trình cây tự tổng hợp chất hữu cơ từ CO2 và H2O là?",o:["Quang hợp","Hô hấp","Tiêu hóa","Bài tiết"],a:0},
  {q:"Tế bào não gọi là?",o:["Nơ-ron","Hồng cầu","Bạch cầu","Tiểu cầu"],a:0},
  {q:"Vitamin nào giúp đông máu?",o:["Vitamin K","Vitamin C","Vitamin D","Vitamin A"],a:0},
  {q:"Đơn vị đo cường độ dòng điện là?",o:["Ampe","Volt","Ohm","Watt"],a:0},
  {q:"Định luật nào nói 'mỗi hành động đều có phản lực bằng và ngược chiều'?",o:["Định luật 3 Newton","Định luật 1 Newton","Định luật 2 Newton","Định luật Kepler"],a:0},
  {q:"Ngày Quốc tế Phụ nữ là ngày nào?",o:["8/3","9/3","7/3","10/3"],a:0},
  {q:"Ngày Quốc tế Thiếu nhi là ngày nào?",o:["1/6","2/6","31/5","15/6"],a:0},
  {q:"'Big Bang' là học thuyết về điều gì?",o:["Nguồn gốc vũ trụ","Vụ nổ bom nguyên tử","Sự hình thành Trái Đất","Sự tuyệt chủng khủng long"],a:0},
  {q:"Đèn giao thông sử dụng bao nhiêu màu?",o:["3","2","4","5"],a:0},
  {q:"1 năm có bao nhiêu giây?",o:["31.536.000","30.000.000","365.000","3.153.600"],a:0},
  {q:"Quốc gia nào có hình dạng giống chiếc ủng?",o:["Ý","Tây Ban Nha","Hy Lạp","Bồ Đào Nha"],a:0},
  {q:"Ai được coi là cha đẻ của máy tính?",o:["Alan Turing","Bill Gates","Steve Jobs","John von Neumann"],a:0},
  {q:"Python được tạo ra năm nào?",o:["1991","1995","2000","1985"],a:0},
  {q:"Ngôn ngữ lập trình nào được tạo bởi Brendan Eich?",o:["JavaScript","Java","TypeScript","CoffeeScript"],a:0},
  {q:"Võ sĩ đầu tiên của Việt Nam giành HCV Olympic?",o:["Hoàng Anh Tuấn","Nguyễn Thị Ánh Viên","Trần Hiếu Ngân","Nguyễn Tiến Minh"],a:2},
  {q:"Bao nhiêu phần trăm nước ngọt trên Trái Đất?",o:["3%","10%","20%","1%"],a:0},
  {q:"Cây nào sống lâu nhất trên Trái Đất?",o:["Cây thông Bristlecone","Cây đại thụ","Cây baobab","Cây sồi"],a:0},
  {q:"Sách Guinness ghi nhận con người sống lâu nhất là bao nhiêu tuổi?",o:["122","115","118","120"],a:0},
  {q:"Phím nào giúp chụp màn hình trên Windows?",o:["Print Screen","F12","Ctrl+S","Alt+F4"],a:0},
  {q:"Con tắc kè hoa thay đổi màu sắc để làm gì?",o:["Giao tiếp và điều chỉnh nhiệt độ","Ngụy trang săn mồi","Cảnh báo kẻ thù","Thu hút bạn tình"],a:0},
  {q:"Dãy núi Himalaya nằm ở châu nào?",o:["Châu Á","Châu Phi","Châu Mỹ","Châu Âu"],a:0},
  {q:"Sông Amazon nằm ở châu nào?",o:["Nam Mỹ","Bắc Mỹ","Châu Phi","Châu Á"],a:0},
  {q:"Loài vật nào được coi là biểu tượng của sự trường thọ ở châu Á?",o:["Rùa","Hổ","Rồng","Phượng hoàng"],a:0},
  {q:"Màu cờ của Việt Nam là?",o:["Đỏ và vàng","Xanh và trắng","Đỏ và trắng","Vàng và xanh"],a:0},
  {q:"Bún bò Huế có vị gì đặc trưng?",o:["Cay và chua","Ngọt và béo","Mặn và đắng","Chua và ngọt"],a:0},
  {q:"Trái tim người đập bao nhiêu lần/phút trung bình?",o:["70-80","50-60","90-100","40-50"],a:0},
  {q:"Gen di truyền nằm ở đâu?",o:["Nhân tế bào","Màng tế bào","Tế bào chất","Ty thể"],a:0},
  {q:"Hiện tượng cầu vồng xảy ra do?",o:["Tán xạ ánh sáng qua hơi nước","Phản xạ ánh sáng","Nhiễu xạ ánh sáng","Khúc xạ ánh sáng"],a:0},
  {q:"'Cogito ergo sum' là câu của ai?",o:["Descartes","Socrates","Plato","Aristotle"],a:0},
  {q:"Loài cá nào có thể leo cây?",o:["Cá trèo cây","Cá hồi","Cá chép","Cá mú"],a:0},
  {q:"Oscar là giải thưởng điện ảnh của nước nào?",o:["Mỹ","Anh","Pháp","Ý"],a:0},
  {q:"Mạng xã hội nào có nhiều người dùng nhất thế giới?",o:["Facebook","Instagram","TikTok","Twitter"],a:0},
  {q:"Biển nào nhỏ nhất thế giới?",o:["Biển Baltic","Biển Caspi","Biển Đỏ","Biển Đen"],a:0},
  {q:"Con cá mập là loài cá hay động vật có vú?",o:["Cá","Động vật có vú","Bò sát","Lưỡng cư"],a:0},
  {q:"Bánh mì Việt Nam được làm từ bột gì?",o:["Bột mì","Bột gạo","Bột ngô","Bột sắn"],a:0},
  {q:"Nốt nhạc nào không có trong 7 nốt cơ bản?",o:["H","Đô","Rê","Mi"],a:0},
  {q:"Đơn vị tiền tệ của Việt Nam là?",o:["Đồng","Tiền","Hào","Xu"],a:0},
  {q:"CLB bóng đá nào vô địch V-League nhiều nhất?",o:["Hà Nội FC","Hoàng Anh Gia Lai","TP.HCM","Bình Dương"],a:0},
];

// ===== QUIZ STATE =====
let questions=[], current=0, score=0, correct=0, wrong=0;
let timerInt=null, timeLeft=45, answered=false;
let lifelines = { ll5050: true, audience: true, time: true, skip: true };

function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

function showScreen(id){
  document.querySelectorAll('.qz-screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

// ===== PUBLIC API =====
window.Quiz = {
  showMenu(){ showScreen('menu'); },

  start(count){
    questions = shuffle(ALL_Q).slice(0, count);
    current=0; score=0; correct=0; wrong=0;
    lifelines = { ll5050: true, audience: true, time: true, skip: true };
    resetLifelineUI();
    showScreen('game');
    loadQ();
  },

  use5050(){
    if(!lifelines.ll5050 || answered) return;
    lifelines.ll5050 = false;
    document.getElementById('ll-5050').classList.add('used');
    const q = questions[current];
    const opts = document.querySelectorAll('.qz-opt');
    let removed = 0;
    opts.forEach((btn, i) => {
      if(btn.dataset.correct === '0' && removed < 2){
        btn.classList.add('hidden-opt');
        removed++;
      }
    });
  },

  useAudience(){
    if(!lifelines.audience || answered) return;
    lifelines.audience = false;
    document.getElementById('ll-audience').classList.add('used');
    const q = questions[current];
    const aud = document.getElementById('qz-audience');
    aud.classList.remove('hidden');
    aud.innerHTML = '';
    // Tạo % giả - đáp án đúng ~55-75%
    const correctPct = Math.floor(Math.random()*20)+55;
    const remaining = 100 - correctPct;
    const opts = document.querySelectorAll('.qz-opt');
    const pcts = [];
    let sum = 0;
    opts.forEach((btn, i) => {
      if(btn.dataset.correct === '1'){
        pcts.push(correctPct);
      } else {
        const p = i === opts.length-1 ? remaining - sum : Math.floor(Math.random()*(remaining/2));
        pcts.push(p); sum += p;
      }
    });
    opts.forEach((btn, i) => {
      const bar = document.createElement('div');
      bar.className = 'qz-aud-bar';
      const label = btn.textContent.substring(0,8)+(btn.textContent.length>8?'...':'');
      bar.innerHTML = `<div class="qz-aud-fill" style="height:${Math.max(pcts[i]*1.2,4)}px"></div><span class="qz-aud-label">${label}</span><span class="qz-aud-pct">${pcts[i]}%</span>`;
      aud.appendChild(bar);
    });
  },

  useTime(){
    if(!lifelines.time || answered) return;
    lifelines.time = false;
    document.getElementById('ll-time').classList.add('used');
    timeLeft += 15;
    updateTimerUI(timeLeft);
  },

  useSkip(){
    if(!lifelines.skip || answered) return;
    lifelines.skip = false;
    document.getElementById('ll-skip').classList.add('used');
    answered = true;
    clearInterval(timerInt);
    document.getElementById('qz-audience').classList.add('hidden');
    setTimeout(()=>{ current++; if(current>=questions.length) endQuiz(); else loadQ(); }, 500);
  }
};

function resetLifelineUI(){
  ['ll-5050','ll-audience','ll-time','ll-skip'].forEach(id=>{
    const el = document.getElementById(id);
    el.classList.remove('used');
    el.disabled = false;
  });
}

function loadQ(){
  answered = false;
  clearInterval(timerInt);
  timeLeft = 45;
  document.getElementById('qz-audience').classList.add('hidden');
  document.getElementById('qz-feedback').className = 'qz-feedback hidden';

  const q = questions[current];
  const idxs = shuffle([0,1,2,3]);

  document.getElementById('qz-question').textContent = q.q;
  document.getElementById('qz-count').textContent = `${current+1}/${questions.length}`;
  document.getElementById('qz-score-live').textContent = `⭐ ${score}`;
  document.getElementById('qz-prog').style.width = `${(current/questions.length)*100}%`;

  const opts = document.getElementById('qz-options');
  opts.innerHTML = '';
  idxs.forEach(origIdx => {
    const btn = document.createElement('button');
    btn.className = 'qz-opt';
    btn.textContent = q.o[origIdx];
    btn.dataset.correct = origIdx === q.a ? '1' : '0';
    btn.onclick = () => selectAnswer(btn, origIdx === q.a);
    opts.appendChild(btn);
  });

  startTimer();
}

function startTimer(){
  updateTimerUI(45);
  timerInt = setInterval(()=>{
    timeLeft--;
    updateTimerUI(timeLeft);
    if(timeLeft <= 0){ clearInterval(timerInt); if(!answered) timeOut(); }
  }, 1000);
}

function updateTimerUI(t){
  document.getElementById('qz-timer').textContent = t;
  const pct = (t/45)*100;
  document.getElementById('qz-ring').setAttribute('stroke-dasharray',`${pct} 100`);
  document.getElementById('qz-ring').style.stroke = t>15?'#38bdf8':t>8?'#fbbf24':'#f87171';
}

function selectAnswer(btn, isCorrect){
  if(answered) return;
  answered = true;
  clearInterval(timerInt);
  document.getElementById('qz-audience').classList.add('hidden');

  document.querySelectorAll('.qz-opt').forEach(b=>{
    b.disabled = true;
    if(b.dataset.correct==='1') b.classList.add('correct');
  });

  const fb = document.getElementById('qz-feedback');
  if(isCorrect){
    btn.classList.add('correct');
    const pts = Math.ceil((timeLeft/45)*4);
    score += pts; correct++;
    fb.textContent = `✅ Chính xác! +${pts} điểm`;
    fb.className = 'qz-feedback correct';
    updateMission('quiz5', 1);
  } else {
    btn.classList.add('wrong');
    wrong++;
    fb.textContent = `❌ Sai rồi! Đáp án đúng được tô xanh`;
    fb.className = 'qz-feedback wrong';
  }

  setTimeout(()=>{ current++; if(current>=questions.length) endQuiz(); else loadQ(); }, 1800);
}

function timeOut(){
  answered = true;
  document.querySelectorAll('.qz-opt').forEach(b=>{
    b.disabled = true;
    if(b.dataset.correct==='1') b.classList.add('correct');
  });
  wrong++;
  const fb = document.getElementById('qz-feedback');
  fb.textContent = '⏰ Hết giờ! Đáp án đúng được tô xanh';
  fb.className = 'qz-feedback timeout';
  setTimeout(()=>{ current++; if(current>=questions.length) endQuiz(); else loadQ(); }, 1800);
}

async function endQuiz(){
  clearInterval(timerInt);
  const pct = correct/questions.length;
  let emoji='😅', title='Cần cố gắng hơn!';
  if(pct===1){ emoji='🏆'; title='Hoàn hảo! Xuất sắc!'; }
  else if(pct>=0.8){ emoji='🌟'; title='Rất giỏi!'; }
  else if(pct>=0.6){ emoji='👍'; title='Khá ổn đó!'; }
  else if(pct>=0.4){ emoji='😊'; title='Được rồi, tiếp tục luyện!'; }

  document.getElementById('res-emoji').textContent = emoji;
  document.getElementById('res-title').textContent = title;
  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent = wrong;
  document.getElementById('res-pts').textContent = score;

  showScreen('result');

  if(auth.currentUser && score > 0){
    await addPoints('Quiz', 'Hoàn thành quiz', score);
    await updateMission('play3', 1);
    if(correct > 0) await updateMission('win1', 1);
  }
}
