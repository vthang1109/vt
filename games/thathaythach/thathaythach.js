// thathaythach.js — Game Thật Hay Thách (offline, không Firebase)
// ========== DỮ LIỆU CÂU HỎI & THỬ THÁCH ==========
const TRUTH_QUESTIONS = [
  // --- CÂU HỎI THẬT ---
  "Bạn đã từng nói dối ai đó trong nhóm chưa?",
  "Bạn đã từng thầm thích ai trong nhóm chưa?",
  "Bạn sợ nhất điều gì?",
  "Bạn đã từng lấy trộm đồ của ai chưa?",
  "Bạn có bí mật gì mà chưa từng kể với ai không?",
  "Bạn đã từng khóc vì một bộ phim chưa?",
  "Bạn thấy ai trong nhóm dễ thương nhất?",
  "Bạn đã từng cứu ai đó thoát chết chưa?",
  "Bạn có từng ghét một người trong nhóm chưa?",
  "Bạn đã từng thất bại trong việc gì khiến bạn thay đổi hoàn toàn?",
  "Bạn đã từng nói xấu ai trong nhóm chưa?",
  "Bạn có từng trốn học hoặc trốn làm chưa?",
  "Bạn đã từng nhắn tin cho người yêu cũ khi đang say chưa?",
  "Bạn có từng đổ lỗi cho người khác dù biết đó là lỗi của mình chưa?",
  "Bạn đã từng xem trộm điện thoại của người yêu/bạn bè chưa?",
  "Bạn có từng ghen tị với thành công của bạn thân chưa?",
  "Bạn đã từng giả vờ ốm để trốn việc gì đó chưa?",
  "Bạn có từng tiêu tiền của bố mẹ vào việc không nên chưa?",
  "Bạn đã từng lén khóc trong phòng tắm chưa?",
  "Bạn có từng mơ thấy một người trong nhóm và cảm thấy ngại ngùng không?",
  "Nếu như bạn có thể đổi một điều về bản thân, đó sẽ là gì?",
  "Nếu như bạn có thể sống ở bất kỳ đâu trên thế giới, bạn sẽ chọn đâu?",
  "Nếu như bạn có thể gặp một người nổi tiếng, bạn sẽ gặp ai?",
  "Nếu như bạn có thể quay lại quá khứ, bạn sẽ sửa điều gì?",
  "Nếu như bạn có thể có một siêu năng lực, bạn muốn có gì?",
  "Nếu như bạn trúng số 100 tỷ, điều đầu tiên bạn làm là gì?",
  "Nếu như bạn có thể đổi nghề, bạn sẽ làm gì?",
  "Nếu như bạn là người khác giới trong một ngày, bạn sẽ làm gì?",
  "Nếu như bạn phải chọn một người trong nhóm để ở cùng đảo hoang, bạn chọn ai?",
  "Nếu như bạn có thể xóa một kỷ niệm, bạn sẽ xóa gì?",
  "Bạn đã từng ăn đồ của người khác mà không xin phép chưa?",
  "Bạn có từng thấy ai trong nhóm mà không thích ngay từ lần đầu gặp chưa?",
  "Bạn đã từng mơ thấy mình bay chưa?",
  "Bạn có từng sợ một con vật nhỏ như gián, chuột không?",
  "Bạn đã từng hát trong phòng tắm chưa?",
  "Bạn có từng nói chuyện một mình chưa?",
  "Bạn đã từng thử học một ngôn ngữ mới và bỏ cuộc chưa?",
  "Bạn có từng giấu tài năng gì không?",
  "Bạn đã từng khóc trước mặt người khác chưa?",
  "Bạn có từng thấy xấu hổ vì một điều nhỏ nhặt không?"
];

const DARE_CHALLENGES = [
  // --- THỬ THÁCH ---
  "Hãy hát một bài hát thiếu nhi ngay bây giờ!",
  "Hãy nhảy một điệu nhảy vui nhộn trong 30 giây!",
  "Hãy gọi điện cho một người trong danh bạ và nói 'Con yêu mẹ'!",
  "Hãy nói một câu bằng giọng địa phương khác!",
  "Hãy làm mặt xấu và chụp ảnh selfie!",
  "Hãy đứng lên và xoay 10 vòng tại chỗ!",
  "Hãy bắt chước tiếng con vật mà bạn sợ nhất!",
  "Hãy nói thật nhanh 'Lúa nếp là lúa nếp làng, lúa lên lớp lớp lòng nàng lâng lâng' 5 lần!",
  "Hãy vẽ chân dung một người trong nhóm bằng tay không thuận!",
  "Hãy thực hiện 10 cái chống đẩy ngay bây giờ!",
  "Hãy nhắn tin cho người yêu cũ (nếu có) hoặc bạn thân: 'Tớ vừa mơ thấy cậu'!",
  "Hãy đứng dậy và hét to: 'TÔI LÀ NGƯỜI HẠNH PHÚC NHẤT THẾ GIỚI!'",
  "Hãy úp ngược điện thoại và để vậy trong 5 phút tiếp theo!",
  "Hãy nói chuyện bằng giọng robot trong 3 lượt chơi tiếp!",
  "Hãy lấy một cốc nước và đổ lên đầu (hoặc làm ướt tóc)!",
  "Hãy ăn một thìa tương ớt (hoặc một món cay) ngay bây giờ!",
  "Hãy đăng status 'Tôi vừa thua một ván game và thấy vui vì điều đó' lên mạng xã hội!",
  "Hãy quay video bạn đang nhảy một điệu nhạc sến và gửi vào nhóm!",
  "Hãy đội một cuốn sách lên đầu và đi qua phòng!",
  "Hãy nói lời tỏ tình với cái cây gần nhất!",
  "Hãy đeo tất vào tay và giữ nguyên trong 10 phút!",
  "Hãy kể một câu chuyện cười nhưng không được cười!",
  "Hãy uống một ngụm nước và giữ trong miệng 30 giây không được nuốt!",
  "Hãy gọi cho một người lạ (số bất kỳ) và nói 'Em nhớ anh' rồi cúp máy!",
  "Hãy mặc áo ngược và để vậy đến hết buổi chơi!",
  "Hãy bắt chước dáng đi của một con vật!",
  "Hãy viết tên bạn lên trán bằng bút dạ!",
  "Hãy nói chuyện bằng giọng mũi trong 5 phút!",
  "Hãy đọc rap một đoạn bất kỳ bạn tự nghĩ ra!",
  "Hãy thực hiện tư thế yoga cây chuối!",
  "Hãy chạy tại chỗ và đếm thật to từ 1 đến 20!",
  "Hãy tạo dáng như siêu nhân và nói 'Vì công lý'!",
  "Hãy xin chữ ký của 3 người lạ trong vòng 10 phút!",
  "Hãy ôm một người trong nhóm và nói 'Cảm ơn vì đã ở bên tớ'!",
  "Hãy làm thơ về một người trong nhóm và đọc to lên!",
  "Hãy để người khác vẽ lên mặt bạn bằng bút dạ!",
  "Hãy đi bộ quanh phòng bằng gót chân!",
  "Hãy nói 'Con gà cục tác lá chanh' 5 lần liên tiếp không vấp!",
  "Hãy kể về giấc mơ kỳ lạ nhất của bạn!",
  "Hãy hát một bài hát với giọng opera!"
];

class TruthOrDareGame {
  constructor() {
    this.usedTruths = [];   // Lưu index các câu đã dùng để tránh lặp
    this.usedDares = [];
  }

  // Random một câu hỏi "Thật"
  pickTruth() {
    // Reset nếu đã dùng hết câu hỏi
    if (this.usedTruths.length >= TRUTH_QUESTIONS.length) {
      this.usedTruths = [];
    }
    // Tìm câu chưa dùng
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * TRUTH_QUESTIONS.length);
    } while (this.usedTruths.includes(randomIndex));
    
    this.usedTruths.push(randomIndex);
    const question = TRUTH_QUESTIONS[randomIndex];
    this.displayCard('truth', 'THẬT', question);
    window.showToast('Bạn chọn nói THẬT!', 'info');
  }

  // Random một thử thách
  pickDare() {
    if (this.usedDares.length >= DARE_CHALLENGES.length) {
      this.usedDares = [];
    }
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * DARE_CHALLENGES.length);
    } while (this.usedDares.includes(randomIndex));
    
    this.usedDares.push(randomIndex);
    const challenge = DARE_CHALLENGES[randomIndex];
    this.displayCard('dare', 'THÁCH', challenge);
    window.showToast('Bạn chọn THÁCH thức!', 'warn');
  }

  // Hiển thị thẻ câu hỏi / thử thách
  displayCard(type, label, text) {
    const card = document.getElementById('tt-card');
    const labelEl = document.getElementById('tt-card-label');
    const textEl = document.getElementById('tt-card-text');
    
    // Xóa class cũ
    card.classList.remove('truth', 'dare');
    // Thêm class mới
    card.classList.add(type);
    
    // Cập nhật nội dung
    labelEl.textContent = label;
    textEl.textContent = text;
    
    // Animation lại
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'cardPop 0.5s ease';
  }
}

// Khởi tạo game
window.game = new TruthOrDareGame();