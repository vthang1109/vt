// ===== CARDS PARTY - 2000+ LÁ BÀI UỐNG/LÀM =====

// ====== 1. UỐNG CƠ BẢN (200 lá) ======
const DRINK_BASIC = [];
const drinkActions = [
    "Uống 1 ly", "Uống 1 ngụm", "Uống nửa ly", "Uống 1 hơi",
    "Uống bằng tay trái", "Uống bằng tay phải", "Uống không dùng tay",
    "Uống và nhắm mắt", "Uống và nhìn lên trần", "Uống và nhắm 1 mắt"
];
const drinkExtras = [
    "và nói tên mình", "và vỗ tay 3 cái", "và cười to", "và thở dài",
    "và kể 1 màu sắc", "và kể 1 con vật", "và kể 1 loài hoa",
    "và kể 1 loại quả", "và kể 1 món ăn", "và kể 1 bài hát",
    "và kể 1 bộ phim", "và kể 1 đất nước", "và kể 1 thành phố",
    "và kể 1 nghề nghiệp", "và kể 1 thương hiệu", "và kể 1 con số",
    "và chỉ tay lên trời", "và chỉ tay xuống đất", "và chỉ vào mũi mình",
    "và chỉ vào tai mình", "và chỉ vào người bên cạnh", "và vẫy tay chào",
    "và giơ ngón cái", "và giơ ngón út", "và giơ nắm đấm",
    "và thè lưỡi", "và chu môi", "và nháy mắt trái", "và nháy mắt phải",
    "và nói 'Tuyệt vời'", "và nói 'Tôi khỏe'", "và nói 'Cảm ơn'",
    "và nói 'Xin lỗi'", "và nói 'Tạm biệt'", "và nói 'Chào mừng'",
    "và hát 1 câu", "và huýt sáo", "và đếm 1-2-3",
    "và đứng lên ngồi xuống", "và quay 1 vòng", "và nhảy 1 cái",
    "và lắc đầu", "và gật đầu", "và nghiêng đầu", "và cúi đầu",
    "và thổi 1 nụ hôn gió", "và làm tim bằng tay"
];

drinkActions.forEach(action => {
    drinkExtras.forEach(extra => {
        DRINK_BASIC.push({ text: `${action} ${extra}`, type: "drink" });
        if (DRINK_BASIC.length >= 200) return;
    });
});

// ====== 2. CHỈ ĐỊNH NGƯỜI KHÁC (300 lá) ======
const CHOOSE_CARDS = [];
const targetDescs = [
    "Người bên trái", "Người bên phải", "Người đối diện", "Người kế bên",
    "Người mặc áo đen", "Người mặc áo trắng", "Người mặc áo đỏ", "Người mặc áo xanh",
    "Người mặc áo vàng", "Người mặc áo hồng", "Người mặc áo sọc", "Người mặc áo trơn",
    "Người đeo kính", "Người không đeo kính", "Người đeo đồng hồ", "Người không đeo đồng hồ",
    "Người tóc dài nhất", "Người tóc ngắn nhất", "Người tóc xoăn", "Người tóc thẳng",
    "Người cao nhất", "Người thấp nhất", "Người nặng nhất", "Người nhẹ nhất",
    "Người già nhất", "Người trẻ nhất", "Người sinh tháng 1-6", "Người sinh tháng 7-12",
    "Người đến sớm nhất", "Người đến muộn nhất", "Người ở xa nhất", "Người ở gần nhất",
    "Người dùng iPhone", "Người dùng Samsung", "Người dùng Android", "Người pin dưới 20%",
    "Người có hình nền đẹp nhất", "Người nhiều ứng dụng nhất", "Người ít ảnh nhất",
    "Người có ảnh mèo", "Người có ảnh chó", "Người độc thân", "Người có người yêu",
    "Người đã kết hôn", "Người có con", "Người là sinh viên", "Người đi làm",
    "Người biết nấu ăn", "Người không biết nấu ăn", "Người hút thuốc", "Người không hút thuốc"
];
const chooseActions = [
    "uống 1 ly", "uống 2 ngụm", "uống nửa ly", "kể 1 sự thật",
    "hát 1 câu", "nhảy 10 giây", "kể chuyện cười", "nói 1 bí mật",
    "làm 5 cái chống đẩy", "tự sướng 1 kiểu"
];

targetDescs.forEach(target => {
    chooseActions.forEach(action => {
        CHOOSE_CARDS.push({ text: `${target} ${action}`, type: "choose" });
        if (CHOOSE_CARDS.length >= 300) return;
    });
});

// ====== 3. TẤT CẢ CÙNG LÀM (200 lá) ======
const ALL_CARDS = [];
const allGroups = [
    "Tất cả", "Tất cả nam", "Tất cả nữ", "Tất cả người độc thân",
    "Tất cả người có người yêu", "Tất cả người đi làm", "Tất cả sinh viên",
    "Tất cả người sinh tháng chẵn", "Tất cả người sinh tháng lẻ",
    "Tất cả người mặc quần dài", "Tất cả người mặc quần ngắn",
    "Tất cả người đi giày", "Tất cả người đi dép", "Tất cả người để tóc mái"
];
const allActions = [
    "cùng uống 1 ly", "cùng uống 1 ngụm", "cùng vỗ tay", "cùng hát 1 câu",
    "cùng đứng lên", "cùng quay 1 vòng", "cùng nhảy 1 cái", "cùng hét lên",
    "cùng nói 'Yeah!'", "cùng im lặng 5 giây", "cùng cười 3 giây",
    "cùng làm mặt xấu", "cùng giơ tay lên", "cùng lắc đầu"
];

allGroups.forEach(group => {
    allActions.forEach(action => {
        ALL_CARDS.push({ text: `${group} ${action}`, type: "all" });
    });
});

// ====== 4. SỰ THẬT (300 lá) ======
const TRUTH_CARDS = [];
const truthQuestions = [
    "Kể 1 lần bạn nói dối", "Kể 1 giấc mơ kỳ lạ", "Kể 1 món ăn bạn ghét",
    "Kể 1 bài hát bạn thích", "Kể 1 bộ phim bạn xem gần đây",
    "Kể 1 nơi bạn muốn đến", "Kể 1 điều bạn sợ nhất", "Kể 1 kỷ niệm đáng nhớ",
    "Kể 1 người bạn ngưỡng mộ", "Kể 1 điều bạn muốn thay đổi",
    "Kể 1 lần bạn khóc", "Kể 1 lần bạn cười không kiểm soát",
    "Kể 1 lần bạn bị phạt", "Kể 1 lần bạn được khen", "Kể 1 lần bạn thất bại",
    "Kể 1 lần bạn thành công", "Kể 1 lần bạn bị lừa", "Kể 1 lần bạn lừa người khác",
    "Kể 1 lần bạn quên sinh nhật", "Kể 1 lần bạn nhớ nhầm tên",
    "Kể 1 bí mật thời thơ ấu", "Kể 1 kỷ niệm với người yêu cũ",
    "Kể 1 lần bạn xấu hổ nhất", "Kể 1 lần bạn tự hào nhất",
    "Kể 1 sở thích kỳ lạ", "Kể 1 thói quen xấu", "Kể 1 tài lẻ của bạn",
    "Kể 1 ước mơ thời thơ ấu", "Kể 1 lần bạn nói yêu", "Kể 1 lần bạn bị từ chối"
].concat([
    "Bạn thích ai trong phòng nhất?", "Bạn sợ ai trong phòng nhất?",
    "Bạn muốn đổi chỗ với ai?", "Bạn muốn đi du lịch với ai trong phòng?",
    "Bạn nghĩ ai đẹp nhất?", "Bạn nghĩ ai hài hước nhất?",
    "Bạn nghĩ ai thông minh nhất?", "Bạn nghĩ ai lười nhất?",
    "Bạn nghĩ ai giàu nhất?", "Bạn nghĩ ai tốt bụng nhất?",
    "Mẫu người yêu lý tưởng của bạn?", "Lần yêu đầu tiên của bạn?",
    "Bạn có bao nhiêu người yêu cũ?", "Bạn đã từng hôn ai chưa?",
    "Bạn thích con trai hay con gái?", "Bạn có bí mật gì chưa kể?",
    "Điều gì khiến bạn mất ngủ?", "Điều gì khiến bạn vui nhất?",
    "Điều gì khiến bạn buồn nhất?", "Bạn sợ mất đi điều gì nhất?"
]);

for (let i = 0; i < 300; i++) {
    const q = truthQuestions[i % truthQuestions.length];
    TRUTH_CARDS.push({ text: `${q} hoặc uống 1 ly`, type: "truth_or_drink" });
}

// ====== 5. THỬ THÁCH NHẸ (300 lá) ======
const DARE_CARDS = [];
const dareActions = [
    "Hát 1 bài", "Nhảy 30 giây", "Bắt chước 1 con vật",
    "Nói 1 câu bằng tiếng Anh", "Nói 1 câu bằng tiếng Trung",
    "Kể 1 câu chuyện cười", "Đọc rap 1 đoạn", "Kêu 1 tiếng động vật",
    "Làm 10 cái chống đẩy", "Gập bụng 10 cái", "Nhảy dây tại chỗ 20 cái",
    "Đứng 1 chân 15 giây", "Nhắm mắt đếm đến 30", "Vẽ 1 con vật trong 30 giây",
    "Tự sướng 1 kiểu hài", "Chụp ảnh cùng người bên cạnh",
    "Gọi điện cho 1 người bất kỳ", "Nhắn tin 'Anh yêu em' cho 1 người",
    "Đăng status 'Tôi đẹp nhất'", "Thả tim 5 người trong danh bạ"
];

for (let i = 0; i < 300; i++) {
    const d = dareActions[i % dareActions.length];
    DARE_CARDS.push({ text: `${d} hoặc uống 1 ly`, type: "dare_or_drink" });
}

// ====== 6. LÁ ĐẶC BIỆT (200 lá) ======
const SPECIAL_CARDS = [];
const specialTypes = [
    { text:"LÁ MA: Miễn uống 1 lần sau", type:"save_card", count:30 },
    { text:"LÁ ĐỔI: Đổi lá này cho người khác", type:"swap_card", count:30 },
    { text:"LÁ NHÂN ĐÔI: Người tiếp theo uống gấp đôi", type:"double_next", count:20 },
    { text:"LÁ QUAY LẠI: Người vừa bắt bạn uống phải uống thay", type:"reverse", count:20 },
    { text:"LÁ TỰ DO: Không phải uống", type:"free_pass", count:30 },
    { text:"LÁ CHỌN 2: Chọn 2 người cùng uống", type:"choose_two", count:20 },
    { text:"LÁ OẲN TÙ TÌ: Thua uống 1 ly", type:"rock_paper", count:15 },
    { text:"LÁ ĐOÁN SỐ 1-10: Sai uống 1 ly", type:"guess_number", count:10 },
    { text:"LÁ NÍN THỞ: Ai nín ít nhất uống", type:"hold_breath", count:10 },
    { text:"LÁ NHÌN CHĂM CHĂM: Ai cười trước uống", type:"staring", count:15 }
];

specialTypes.forEach(s => {
    for (let i = 0; i < s.count; i++) {
        SPECIAL_CARDS.push({ text: s.text, type: s.type });
    }
});

// ====== 7. HÀNH ĐỘNG VUI (250 lá) ======
const FUN_CARDS = [];
const funActions = [
    "Đổi chỗ với người bên trái", "Đổi chỗ với người bên phải",
    "Ngồi lên đùi người bên cạnh 1 lượt", "Xoa đầu người bên cạnh",
    "Bắt tay tất cả mọi người", "Nói 1 điều tốt về người bên trái",
    "Nói 1 điều tốt về người bên phải", "Kể tên 3 loại trái cây trong 5 giây",
    "Kể tên 5 con vật trong 10 giây", "Đếm ngược từ 10 về 1",
    "Nói tên mình ngược", "Đọc bảng chữ cái", "Hát 1 bài thiếu nhi",
    "Kể 1 câu tục ngữ", "Nói 1 câu ca dao", "Đọc 1 bài thơ",
    "Kể 1 câu đố", "Giải 1 câu đố đơn giản", "Kể 1 sự thật khoa học",
    "Kể 1 sự thật lịch sử", "Kể 1 mẹo vặt", "Kể 1 công thức nấu ăn",
    "Nói 1 câu chửi yêu", "Nói 1 lời yêu thương", "Nói 1 lời xin lỗi",
    "Nói 1 lời cảm ơn", "Nói 1 lời chúc", "Nói 1 lời động viên",
    "Nói 1 câu nói nổi tiếng", "Bắt chước giọng 1 người nổi tiếng"
];

for (let i = 0; i < 250; i++) {
    FUN_CARDS.push({ text: funActions[i % funActions.length], type: "fun" });
}

// ====== 8. LÁ ĐẶT LUẬT (150 lá) ======
const RULE_CARDS = [];
const rules = [
    "Ai nói 'uống' phải uống 1 ly", "Ai chỉ tay phải uống 1 ly",
    "Ai nói tên người khác phải uống", "Ai cười phải uống",
    "Ai dùng điện thoại phải uống", "Ai nói 'không' phải uống",
    "Ai gãi đầu phải uống", "Ai khoanh tay phải uống",
    "Ai ngáp phải uống", "Ai hắt hơi phải uống",
    "Ai nói 'cái gì' phải uống", "Ai hỏi lại phải uống",
    "Ai ngồi sai tư thế phải uống", "Ai rời khỏi chỗ phải uống",
    "Ai đến muộn phải uống thêm 2 ly"
];

for (let i = 0; i < 150; i++) {
    RULE_CARDS.push({ text: `ĐẶT LUẬT: ${rules[i % rules.length]}`, type: "rule" });
}

// ====== 9. LÁ PHẠT NHẸ (150 lá) ======
const PENALTY_CARDS = [];
const penalties = [
    "Uống 1 ly và kể 1 sự thật", "Uống 1 ly và làm 1 thử thách",
    "Uống 2 ngụm và nói 'Tôi sai rồi'", "Uống 1 ly và xin lỗi mọi người",
    "Uống 1 ly và khen người bên cạnh", "Uống 1 ly và tự vả nhẹ vào má",
    "Uống 1 ly và nói 1 điều hối hận", "Uống 1 ly và hứa 1 điều",
    "Uống 1 ly và tặng 1 món đồ cho người khác", "Uống 1 ly và kể 1 lần xấu hổ"
];

for (let i = 0; i < 150; i++) {
    PENALTY_CARDS.push({ text: penalties[i % penalties.length], type: "penalty" });
}

// ====== GHÉP TẤT CẢ ======
export const PARTY_CARDS = [
    ...DRINK_BASIC,
    ...CHOOSE_CARDS,
    ...ALL_CARDS,
    ...TRUTH_CARDS,
    ...DARE_CARDS,
    ...SPECIAL_CARDS,
    ...FUN_CARDS,
    ...RULE_CARDS,
    ...PENALTY_CARDS
];

// ====== HÀM TIỆN ÍCH ======
export function getRandomCard() {
    return PARTY_CARDS[Math.floor(Math.random() * PARTY_CARDS.length)];
}

export function getRandomCards(count = 5) {
    const shuffled = [...PARTY_CARDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

export function getCardByType(type) {
    const filtered = PARTY_CARDS.filter(c => c.type === type);
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getCardsByTypes(types, count = 5) {
    const filtered = PARTY_CARDS.filter(c => types.includes(c.type));
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

console.log(`✅ Đã tạo ${PARTY_CARDS.length} lá bài party!`);

export default PARTY_CARDS;