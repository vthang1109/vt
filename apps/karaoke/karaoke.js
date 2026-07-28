// ===== KARAOKE APP — Tra lời bài hát =====
// Uses free API: lyrics.ovh (public, no key needed)

const SONG_DB = [
  { name: 'Em Của Ngày Hôm Qua', artist: 'Sơn Tùng M-TP' },
  { name: 'Nơi Này Có Anh', artist: 'Sơn Tùng M-TP' },
  { name: 'Lạc Trôi', artist: 'Sơn Tùng M-TP' },
  { name: 'Chạy Ngay Đi', artist: 'Sơn Tùng M-TP' },
  { name: 'Có Chắc Yêu Là Đây', artist: 'Sơn Tùng M-TP' },
  { name: 'Hãy Trao Cho Anh', artist: 'Sơn Tùng M-TP ft. Snoop Dogg' },
  { name: 'Muộn Rồi Mà Sao Còn', artist: 'Sơn Tùng M-TP' },
  { name: 'Đừng Làm Trái Tim Anh Đau', artist: 'Sơn Tùng M-TP' },
  { name: 'Ánh Nắng Của Anh', artist: 'Đức Phúc' },
  { name: 'Em Gái Mưa', artist: 'Hương Tràm' },
  { name: 'Người Lạ Ơi', artist: 'Karik x Orange' },
  { name: 'Sóng Gió', artist: 'Jack x K-ICM' },
  { name: 'Bạc Phận', artist: 'Jack x K-ICM' },
  { name: 'Hoa Hải Đường', artist: 'Jack' },
  { name: 'Đom Đóm', artist: 'Jack' },
  { name: 'Vùng Lá Me Bay', artist: 'Miu Lê' },
  { name: 'Mang Tiền Về Cho Mẹ', artist: 'Đen Vâu ft. Nguyên Thảo' },
  { name: 'Đi Đu Đưa Đi', artist: 'Bích Phương' },
  { name: 'Nụ Cười 18 20', artist: 'Anh Quân Idol' },
  { name: 'Cơn Mưa Ngang Qua', artist: 'Sơn Tùng M-TP' },
  { name: 'Tình Yêu Màu Nắng', artist: 'Đoàn Thúy Trang' },
  { name: 'Đế Vương', artist: 'Đình Dũng' },
  { name: 'Yêu Là Cưới', artist: 'Phát Hồ ft. Tia Hải Châu' },
  { name: 'Chúng Ta Của Tương Lai', artist: 'Sơn Tùng M-TP' },
  { name: 'Dù Có Xa Nhau', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Sau Tất Cả', artist: 'Erik' },
  { name: 'Là Bạn Không Thể Yêu', artist: 'Lou Hoàng' },
  { name: 'Bống Bống Bang Bang', artist: '365 Band' },
  { name: 'See Tình', artist: 'Hoàng Thùy Linh' },
  { name: 'Ghé Qua', artist: 'Dick x Tofu' },
  { name: 'Phía Sau Một Cô Gái', artist: 'Soobin Hoàng Sơn' },
  { name: 'Duyên Mình Lỡ', artist: 'Dương Hồng Loan' },
  { name: 'Hết Thương Cạn Nhớ', artist: 'Đình Dũng' },
  { name: 'Cảm Ơn Vì Đã Từng Thương', artist: 'Trần Vi Mỹ' },
  { name: 'Sầu Tình', artist: 'Quang Lê' },
  { name: 'Thằng Điên', artist: 'JustaTee ft. Phương Ly' },
  { name: 'Cô Gái M52', artist: 'Huy R' },
  { name: 'Cầu Hôn', artist: 'Vũ Cát Tường' },
  { name: 'Từng Là Của Nhau', artist: 'Bảo Anh' },
  { name: 'Em Không Sai', artist: 'Phát Hồ' },
  { name: 'Thích Em Hơi Nhiều', artist: 'Wren Evans' },
  { name: 'Cho Em Gần Anh Thêm Chút Nữa', artist: 'Hương Giang' },
  { name: 'Kém Duyên', artist: 'Hồng Thanh' },
  { name: 'Cà Phê', artist: 'MIN x Erik' },
  { name: 'Trót Yêu', artist: 'Trung Đức' },
  { name: 'Xin Lỗi', artist: 'Hồ Ngọc Hà' },
  { name: 'Đường Tôi Chở Em Về', artist: 'Lãnh Hàng' },
  { name: 'Quan Thoại', artist: 'Khói' },
  { name: '24h', artist: 'LyLy' },
  { name: 'Anh Nhớ Em', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Chưa Bao Giờ', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Có Em Đời Đẹp Sao', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Vợ Người Ta', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Khi Người Lớn Cô Đơn', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Bên Trên Tầng Lầu', artist: 'Tăng Duy Tân' },
  { name: 'Lỡ Say Bye Là Bye', artist: 'Lemon x Ding' },
  { name: 'Răng Khôn', artist: 'Vũ' },
  { name: 'Có Ai Thương Em Như Anh', artist: 'Tòn' },
  { name: 'Đi Về Nhà', artist: 'Đen ft. JustaTee' },
  { name: 'Một Bước Yêu Vạn Dặm Đau', artist: 'Mr. Siro' },
  { name: 'Dạ Vũ', artist: 'Tăng Duy Tân' },
  { name: 'Vào Hạ', artist: 'Tăng Duy Tân' },
  { name: 'Lửa Gần Rơm Lâu Ngày Cũng Cháy', artist: 'Du Uyên' },
  { name: 'Độ Tộc 2', artist: 'Độ Mixi ft. Bình Gold' },
  { name: 'Mưa Tháng 6', artist: 'Đức Phúc x GREY-D' },
  { name: 'Anh Đã Quên Chưa', artist: 'Phát Hồ' },
  { name: 'Hoa Cỏ Mùa Xuân', artist: 'Noo Phước Thịnh' },
  { name: 'Có Đâu Ai Ngờ', artist: 'Cầm' },
  { name: 'Sai Người Sai Thời Điểm', artist: 'Thanh Hưng' },
  { name: 'Không Cảm Xúc', artist: 'Huy Vạc' },
  { name: 'Anh Sẽ Đến Cùng Cơn Mưa', artist: 'Hồ Ngọc Hà' },
  { name: 'Ngày Chưa Giông Bão', artist: 'Huy R' },
  { name: 'Từng Là', artist: 'Vũ.' },
  { name: 'Yêu Đương Khó Quá Thì Chạy Về Với Anh', artist: 'HuyR' },
  { name: 'Chạy Về Khóc Với Anh', artist: 'Erik' },
  { name: 'Em Là Kẻ Đáng Thương', artist: 'Phát Hồ' },
  { name: 'Sài Gòn Đau Lòng Quá', artist: 'Hứa Kim Tuyền x Hoàng Duyên' },
  { name: 'Vì Anh Đâu Có Biết', artist: 'Madihu ft. Vũ.' },
  { name: 'Chuyện Rằng', artist: 'Thịnh Suy' },
  { name: 'Xem Như Em Chẳng May', artist: 'Thành Vinh' },
  { name: 'Không Thể Cùng Nhau Suốt Kiếp', artist: 'Hòa Minzy' },
  { name: 'Tình Là', artist: 'Văn Mai Hương' },
  { name: 'Gặp Nhưng Không Ở Lại', artist: 'Hiền Hồ' },
  { name: 'Ngõ Chạm', artist: 'Đen ft. Lynk' },
  { name: 'Đêm Nằm Mơ Phố', artist: 'Đen ft. Lynk' },
  { name: 'Mặt Trời Của Em', artist: 'Phương Ly ft. JustaTee' },
  { name: 'Tớ Thích Cậu', artist: 'Cầm' },
  { name: 'Ái Nộ', artist: 'Masew x H2K' },
  { name: 'Tuyết Rơi Mùa Hè', artist: 'Khởi My' },
  { name: 'Cô Đơn Trên Sofa', artist: 'Hồ Ngọc Hà' },
  { name: 'Nắng Ấm Xa Dần', artist: 'Sơn Tùng M-TP' },
  { name: 'Chúng Ta Không Thuộc Về Nhau', artist: 'Sơn Tùng M-TP' },
  { name: 'Bình Yên Những Phút Giây', artist: 'Sơn Tùng M-TP' },
  { name: 'Mất Hết Cảm Giác', artist: 'Dunghoang' },
  { name: 'Người Đã Từng', artist: 'Dunghoang' },
  { name: 'Thói Quen', artist: 'Hoàng Dũng' },
  { name: 'Lối Nhỏ', artist: 'Đen' },
  { name: 'Đưa Nhau Đi Trốn', artist: 'Đen x Lynk' },
  { name: 'Trốn Tìm', artist: 'Đen' },
  { name: 'Hai Triệu Năm', artist: 'Đen' },
  { name: 'Ho Hơi', artist: 'Hậu Hoàng' },
  { name: 'Chúng Ta Sau Này', artist: 'Hậu Hoàng' },
  { name: 'Thương Em', artist: 'Vũ.' },
  { name: 'Passenger Side', artist: 'Wren Evans' },
  { name: 'Nhạc Nhẹ Nông Thôn', artist: 'Wren Evans' },
  { name: 'Dù Ai Đi Ngược Về Xuôi', artist: 'Phan Mạnh Quỳnh' },
  { name: 'Hành Tinh Song Song', artist: 'Tăng Duy Tân' },
];

class KaraokeApp {
  constructor() {
    this.currentSong = null;
    this._dark = false;
    this._bigFont = false;
    this._songs = SONG_DB;
    this.renderSuggestions(this._songs);
  }

  async search() {
    const q = document.getElementById('kr-search-input').value.trim().toLowerCase();
    const results = q
      ? this._songs.filter(s => s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
      : this._songs;
    document.getElementById('kr-suggestions').innerHTML = '';
    this.renderSuggestions(results);
    document.getElementById('kr-msg').textContent = `Tìm thấy ${results.length} bài`;

    // Try to fetch from API
    if (results.length > 0 && q) {
      try {
        const encodedArtist = encodeURIComponent(results[0].artist);
        const encodedName = encodeURIComponent(results[0].name);
        const res = await fetch(`https://api.lyrics.ovh/v1/${encodedArtist}/${encodedName}`);
        const data = await res.json();
        if (data.lyrics) {
          // Lưu lyrics vào song object tạm
          results[0]._fetchedLyrics = data.lyrics;
        }
      } catch {}
    }
  }

  renderSuggestions(songs) {
    const container = document.getElementById('kr-suggestions');
    if (songs.length === 0) {
      container.innerHTML = '<div class="kr-empty"><div class="kr-empty-icon">🎤</div>Không tìm thấy bài hát</div>';
      return;
    }
    container.innerHTML = songs.map((s, i) =>
      `<div class="kr-song-card" onclick="Karaoke.showLyrics(${i})">
        <div class="kr-song-icon">🎵</div>
        <div class="kr-song-info">
          <div class="kr-song-name">${s.name}</div>
          <div class="kr-song-artist-sm">${s.artist}</div>
        </div>
        <span class="kr-song-action">Lời →</span>
      </div>`
    ).join('');
    this._currentResults = songs;
  }

  async showLyrics(idx) {
    const song = this._currentResults[idx];
    this.currentSong = song;
    document.getElementById('kr-song-title').textContent = song.name;
    document.getElementById('kr-song-artist').textContent = song.artist;
    document.getElementById('kr-content').style.display = 'none';
    document.getElementById('kr-lyrics-section').style.display = 'block';
    document.getElementById('kr-msg').textContent = song.name;

    const lyricsEl = document.getElementById('kr-lyrics');

    // Thử lấy lyrics từ API
    if (song._fetchedLyrics) {
      lyricsEl.textContent = song._fetchedLyrics;
      return;
    }

    try {
      const encodedArtist = encodeURIComponent(song.artist);
      const encodedName = encodeURIComponent(song.name);
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodedArtist}/${encodedName}`);
      const data = await res.json();
      if (data.lyrics) {
        lyricsEl.textContent = data.lyrics;
      } else {
        lyricsEl.textContent = `— ${song.name} —\n— ${song.artist} —\n\nKhông tìm thấy lời bài hát.\nHãy thử tìm trên Google 🎤`;
      }
    } catch {
      lyricsEl.textContent = `— ${song.name} —\n— ${song.artist} —\n\nKhông thể tải lời bài hát.\nVui lòng kiểm tra kết nối mạng.`;
    }
  }

  backToList() {
    document.getElementById('kr-content').style.display = 'block';
    document.getElementById('kr-lyrics-section').style.display = 'none';
    document.getElementById('kr-msg').textContent = 'Tìm bài hát';
  }

  scrollToTop() {
    document.getElementById('kr-lyrics-scroll').scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleDarkness() {
    this._dark = !this._dark;
    document.getElementById('kr-lyrics').classList.toggle('dark', this._dark);
  }

  toggleFontSize() {
    this._bigFont = !this._bigFont;
    document.getElementById('kr-lyrics').classList.toggle('big', this._bigFont);
  }
}

const Karaoke = new KaraokeApp();
