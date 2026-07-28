// titles.js — Danh hiệu VTWorld
// type: 'auto' = tự động có khi đủ điều kiện (thành tựu chính)
//       'shop' = mua bằng điểm
// tier: 'A' | 'S' | 'SS' | 'SSS'

// ── CẤU HÌNH CẤP ĐỘ ────────────────────────────────────
export const TIER_META = {
  'A':   { cls: 'tier-a',   name: 'A · Xanh Lá',   price: 5000,   icon: '🟢', color: '#34d399' },
  'S':   { cls: 'tier-s',   name: 'S · Đỏ',         price: 50000,  icon: '🔴', color: '#f87171' },
  'SS':  { cls: 'tier-ss',  name: 'SS · Vàng',     price: 200000, icon: '🟡', color: '#fbbf24' },
  'SSS': { cls: 'tier-sss', name: 'SSS · Guardian',  price: 500000, icon: '👑', color: '#f1f5f9' },
  'EVENT':  { cls: 'tier-event',   name: 'Event',  price: 0, icon: '🎪', color: '#a78bfa' },
};

// ── GAME CATEGORY MAPPING ───────────────────────────────
export const GAME_CATEGORIES = {
  'caro':'chess','chess':'chess','xiangqi':'chess',
  'tienlen':'card','poker':'card','xidach':'card','baicao':'card','catte':'card',
  'sudoku':'smart','quiz':'smart','guess':'smart','timso':'smart',
  'slot':'casino','baucua':'casino','taixiu':'casino',
};

// ── DANH HIỆU TỰ ĐỘNG (thành tựu chính) ─────────────────
const AUTO_TITLES = [
  // ===== ĐIỂM SỐ =====
  {
    id: 'nguoi_choi_moi',
    label: 'Người Chơi Mới',
    cls: 'tier-a',
    type: 'auto',
    target: 1000,
    statKey: 'points',
    condition: (s) => s.points >= 1000,
    desc: 'Đạt 1.000 điểm'
  },
  {
    id: 'dai_gia',
    label: 'Đại Gia',
    cls: 'tier-ss',
    type: 'auto',
    target: 50000,
    statKey: 'points',
    condition: (s) => s.points >= 50000,
    desc: 'Đạt 50.000 điểm'
  },
  {
    id: 'dai_phu_hao',
    label: 'Đại Phú Hào',
    cls: 'tier-ss',
    type: 'auto',
    target: 100000,
    statKey: 'points',
    condition: (s) => s.points >= 100000,
    desc: 'Đạt 100.000 điểm'
  },
  {
    id: 'sieu_dai_gia',
    label: 'Siêu Đại Gia',
    cls: 'tier-ss',
    type: 'auto',
    target: 500000,
    statKey: 'points',
    condition: (s) => s.points >= 500000,
    desc: 'Đạt 500.000 điểm'
  },
  {
    id: 'trieu_phu',
    label: 'Triệu Phú',
    cls: 'tier-ss',
    type: 'auto',
    target: 1000000,
    statKey: 'points',
    condition: (s) => s.points >= 1000000,
    desc: 'Đạt 1.000.000 điểm'
  },

  // ===== BẠN BÈ =====
  {
    id: 'than_thien',
    label: 'Thân Thiện',
    cls: 'tier-a',
    type: 'auto',
    target: 10,
    statKey: 'friends',
    condition: (s) => s.friends >= 10,
    desc: 'Có 10 bạn bè'
  },
  {
    id: 'vua_ngoai_giao',
    label: 'Vua Ngoại Giao',
    cls: 'tier-s',
    type: 'auto',
    target: 50,
    statKey: 'friends',
    condition: (s) => s.friends >= 50,
    desc: 'Có 50 bạn bè'
  },

  // ===== THÚ CƯNG =====
  {
    id: 'first_pet',
    label: 'Người Bạn Nhỏ',
    cls: 'tier-a',
    type: 'auto',
    target: 1,
    statKey: 'petsOwned',
    condition: (s) => s.petsOwned >= 1,
    desc: 'Sở hữu thú cưng đầu tiên'
  },
  {
    id: 'pet_10',
    label: 'Nhà Sưu Tập',
    cls: 'tier-s',
    type: 'auto',
    target: 10,
    statKey: 'petsOwned',
    condition: (s) => s.petsOwned >= 10,
    desc: 'Sở hữu 10 thú cưng'
  },

  // ===== STREAK =====
  {
    id: 'streak_7',
    label: 'Siêng Năng',
    cls: 'tier-s',
    type: 'auto',
    target: 7,
    statKey: 'streakCurrent',
    condition: (s) => s.streakCurrent >= 7,
    desc: 'Điểm danh 7 ngày liên tiếp'
  },
  {
    id: 'streak_30',
    label: 'Trung Thành',
    cls: 'tier-ss',
    type: 'auto',
    target: 30,
    statKey: 'streakCurrent',
    condition: (s) => s.streakCurrent >= 30,
    desc: 'Điểm danh 30 ngày liên tiếp'
  },

  // ===== DANH HIỆU =====
  {
    id: 'title_5',
    label: 'Sưu Tập Danh Hiệu',
    cls: 'tier-s',
    type: 'auto',
    target: 5,
    statKey: 'titlesOwned',
    condition: (s) => s.titlesOwned >= 5,
    desc: 'Sở hữu 5 danh hiệu'
  },

  // ===== HỒ SƠ =====
  {
    id: 'ca_tinh',
    label: 'Cá Tính',
    cls: 'tier-a',
    type: 'auto',
    condition: (s) => s.hasNickname && s.hasAvatar,
    desc: 'Đặt tên + tải avatar',
    boolean: true,
  },

  // ===== GAME CHUNG =====
  {
    id: 'game_thu',
    label: 'Game Thủ',
    cls: 'tier-a',
    type: 'auto',
    target: 10,
    statKey: 'gamesPlayed',
    condition: (s) => s.gamesPlayed >= 10,
    desc: 'Chơi 10 ván game'
  },
  {
    id: 'nghien_game',
    label: 'Nghiện Game',
    cls: 'tier-s',
    type: 'auto',
    target: 100,
    statKey: 'gamesPlayed',
    condition: (s) => s.gamesPlayed >= 100,
    desc: 'Chơi 100 ván game'
  },
  {
    id: 'da_dang',
    label: 'Đa Dạng',
    cls: 'tier-s',
    type: 'auto',
    target: 5,
    statKey: 'uniqueGamesPlayed',
    condition: (s) => s.uniqueGamesPlayed >= 5,
    desc: 'Chơi 5 loại game khác nhau'
  },

  // ===== CỜ (caro, chess, xiangqi) =====
  {
    id: 'ky_thu_co',
    label: 'Kỳ Thủ',
    cls: 'tier-s',
    type: 'auto',
    target: 5,
    statKey: 'chessGamesPlayed',
    condition: (s) => s.chessGamesPlayed >= 5,
    desc: 'Chơi 5 ván cờ'
  },
  {
    id: 'cao_thu_co',
    label: 'Cao Thủ Cờ',
    cls: 'tier-ss',
    type: 'auto',
    target: 20,
    statKey: 'chessGamesPlayed',
    condition: (s) => s.chessGamesPlayed >= 20,
    desc: 'Chơi 20 ván cờ'
  },

  // ===== BÀI (tienlen, poker, xidach, baicao, catte) =====
  {
    id: 'tay_choi_bai',
    label: 'Tay Chơi Bài',
    cls: 'tier-s',
    type: 'auto',
    target: 5,
    statKey: 'cardGamesPlayed',
    condition: (s) => s.cardGamesPlayed >= 5,
    desc: 'Chơi 5 ván bài'
  },
  {
    id: 'vuong_bai',
    label: 'Vương Bài',
    cls: 'tier-ss',
    type: 'auto',
    target: 20,
    statKey: 'cardGamesPlayed',
    condition: (s) => s.cardGamesPlayed >= 20,
    desc: 'Chơi 20 ván bài'
  },

  // ===== XÌ DÁCH (thành tích đặc biệt) =====
  {
    id: 'vua_xidach',
    label: 'Vua Xì Dách',
    cls: 'tier-ss',
    type: 'auto',
    target: 100,
    statKey: 'xidachWins',
    condition: (s) => s.xidachWins >= 100,
    desc: 'Thắng 100 ván Xì Dách'
  },
  {
    id: 'huy_diet_xidach',
    label: 'Hủy Diệt Xì Dách',
    cls: 'tier-sss',
    type: 'auto',
    target: 100,
    statKey: 'xidachSpecials',
    condition: (s) => s.xidachSpecials >= 100,
    desc: 'Đạt 100 ván Xì Dách, Xì Bàn, Ngũ Linh'
  },

  // ===== TRÍ TUỆ (sudoku, quiz, guess, timso) =====
  {
    id: 'hoc_sinh_gioi',
    label: 'Học Sinh Giỏi',
    cls: 'tier-a',
    type: 'auto',
    target: 3,
    statKey: 'smartGamesPlayed',
    condition: (s) => s.smartGamesPlayed >= 3,
    desc: 'Chơi 3 game trí tuệ'
  },
  {
    id: 'tien_si',
    label: 'Tiến Sĩ',
    cls: 'tier-s',
    type: 'auto',
    target: 15,
    statKey: 'smartGamesPlayed',
    condition: (s) => s.smartGamesPlayed >= 15,
    desc: 'Chơi 15 game trí tuệ'
  },

  // ===== CASINO (slot, baucua, taixiu) =====
  {
    id: 'casino_tap_su',
    label: 'Tập Sự Casino',
    cls: 'tier-a',
    type: 'auto',
    target: 3,
    statKey: 'casinoGamesPlayed',
    condition: (s) => (s.casinoGamesPlayed || 0) >= 3,
    desc: 'Chơi 3 ván casino'
  },
  {
    id: 'casino_lao_lang',
    label: 'Lão Làng Casino',
    cls: 'tier-s',
    type: 'auto',
    target: 20,
    statKey: 'casinoGamesPlayed',
    condition: (s) => (s.casinoGamesPlayed || 0) >= 20,
    desc: 'Chơi 20 ván casino'
  },
  {
    id: 'casino_cao_thu',
    label: 'Cao Thủ Casino',
    cls: 'tier-ss',
    type: 'auto',
    target: 80,
    statKey: 'casinoGamesPlayed',
    condition: (s) => (s.casinoGamesPlayed || 0) >= 80,
    desc: 'Chơi 80 ván casino'
  },
  {
    id: 'casino_huy_diet',
    label: 'Hủy Diệt Casino',
    cls: 'tier-sss',
    type: 'auto',
    target: 300,
    statKey: 'casinoGamesPlayed',
    condition: (s) => (s.casinoGamesPlayed || 0) >= 300,
    desc: 'Chơi 300 ván casino'
  },

  // ===== SLOT (tính theo số ván thắng) =====
  {
    id: 'slot_nghiep_du',
    label: 'Slot Nghiệp Dư',
    cls: 'tier-a',
    type: 'auto',
    target: 3,
    statKey: 'slotWins',
    condition: (s) => (s.slotWins || 0) >= 3,
    desc: 'Thắng 3 ván Slot'
  },
  {
    id: 'slot_cao_thu',
    label: 'Slot Cao Thủ',
    cls: 'tier-s',
    type: 'auto',
    target: 20,
    statKey: 'slotWins',
    condition: (s) => (s.slotWins || 0) >= 20,
    desc: 'Thắng 20 ván Slot'
  },

  // ===== BẦU CUA (tính theo số ván thắng) =====
  {
    id: 'baucua_nghiep_du',
    label: 'Bầu Cua Nghiệp Dư',
    cls: 'tier-a',
    type: 'auto',
    target: 3,
    statKey: 'baucuaWins',
    condition: (s) => (s.baucuaWins || 0) >= 3,
    desc: 'Thắng 3 ván Bầu Cua'
  },
  {
    id: 'baucua_cao_thu',
    label: 'Bầu Cua Cao Thủ',
    cls: 'tier-s',
    type: 'auto',
    target: 20,
    statKey: 'baucuaWins',
    condition: (s) => (s.baucuaWins || 0) >= 20,
    desc: 'Thắng 20 ván Bầu Cua'
  },

  // ===== TÀI XỈU (tính theo số ván thắng) =====
  {
    id: 'taixiu_nghiep_du',
    label: 'Tài Xỉu Nghiệp Dư',
    cls: 'tier-a',
    type: 'auto',
    target: 3,
    statKey: 'taixiuWins',
    condition: (s) => (s.taixiuWins || 0) >= 3,
    desc: 'Thắng 3 ván Tài Xỉu'
  },
  {
    id: 'taixiu_cao_thu',
    label: 'Tài Xỉu Cao Thủ',
    cls: 'tier-s',
    type: 'auto',
    target: 20,
    statKey: 'taixiuWins',
    condition: (s) => (s.taixiuWins || 0) >= 20,
    desc: 'Thắng 20 ván Tài Xỉu'
  },

  // ===== HUYỀN THOẠI CASINO =====
  {
    id: 'than_bai',
    label: 'Thần Bài 🃏',
    cls: 'tier-event-gold',
    type: 'auto',
    target: 1000,
    statKey: 'casinoWins',
    condition: (s) => (s.casinoWins || 0) >= 1000,
    desc: 'Thắng 1.000 ván casino (Slot + Bầu Cua + Tài Xỉu + Xì Dách)'
  },
  {
    id: 'than_co_bac',
    label: 'Thần Cờ Bạc 🎰',
    cls: 'tier-event-gold-red',
    type: 'auto',
    target: 10000,
    statKey: 'totalWins',
    condition: (s) => (s.totalWins || 0) >= 10000,
    desc: 'Thắng 10.000 ván tổng cộng (mọi game)'
  },
];

// ── DANH HIỆU EVENT (màu sắc riêng, admin tặng) ────────
export const EVENT_TITLES = [
  // === Visible (hiện trong Shop) ===
  { id: 'event_cong_chua',  label: '🌸 Công Chúa',       cls: 'tier-event-pink',  type: 'event', desc: 'Sự kiện · Dành cho người đặc biệt' },
  { id: 'event_hiep_si',    label: '⚔️ Hiệp Sĩ',         cls: 'tier-event-fire',  type: 'event', desc: 'Sự kiện · Dành cho người đặc biệt' },
  { id: 'event_phu_thuy',   label: '🔮 Phù Thủy',        cls: 'tier-event-dark',  type: 'event', desc: 'Sự kiện · Dành cho người đặc biệt' },
  { id: 'event_thien_than', label: '👼 Thiên Thần',       cls: 'tier-event-cyan',  type: 'event', desc: 'Sự kiện · Dành cho người đặc biệt' },
  { id: 'event_ve_si',      label: '🛡️ Vệ Sĩ',           cls: 'tier-event-nature', type: 'event', desc: 'Sự kiện · Dành cho người đặc biệt' },

  // === Hidden (chỉ admin thấy trong Chat) ===
  { id: 'event_hoang_tu',   label: '👑 Hoàng Tử',         cls: 'tier-event-dark',   type: 'event', desc: 'Ẩn · Bí mật', hidden: true },
  { id: 'event_ma_ca_rong', label: '🐉 Ma Cà Rồng',       cls: 'tier-event-fire',   type: 'event', desc: 'Ẩn · Huyền thoại', hidden: true },
  { id: 'event_tien_tri',   label: '🔮 Tiên Tri',         cls: 'tier-event-pink',   type: 'event', desc: 'Ẩn · Giác quan thứ 6', hidden: true },
  { id: 'event_thien_tai',  label: '🌪️ Thiên Tai',        cls: 'tier-event-cyan',   type: 'event', desc: 'Ẩn · Sức mạnh hủy diệt', hidden: true },
  { id: 'event_phap_su',    label: '🧙 Pháp Sư',          cls: 'tier-event-nature', type: 'event', desc: 'Ẩn · Phép thuật cổ đại', hidden: true },
];

// ── DANH HIỆU SHOP (mua bằng điểm) ──────────────────────
const SHOP_TITLE_DEFS = [
  { id: 'tan_binh',       label: 'Tân Binh',       tier: 'A' },
  { id: 'lu_khach',       label: 'Lữ Khách',       tier: 'A' },
  { id: 'ke_dao_choi',    label: 'Kẻ Dạo Chơi',    tier: 'A' },
  { id: 'cao_thu',        label: 'Cao Thủ',        tier: 'S' },
  { id: 'bac_thay',       label: 'Bậc Thầy',       tier: 'S' },
  { id: 'dai_hiep',       label: 'Đại Hiệp',       tier: 'S' },
  { id: 'than_toc',       label: 'Thần Tốc',       tier: 'S' },
  { id: 'ba_vuong',       label: 'Bá Vương',       tier: 'SS' },
  { id: 'chien_than',     label: 'Chiến Thần',    tier: 'SS' },
  { id: 'sat_than',       label: 'Sát Thần',      tier: 'SS' },
  { id: 'hoang_de',       label: 'Hoàng Đế',      tier: 'SSS' },
  { id: 'de_vuong',       label: 'Đế Vương',      tier: 'SSS' },
  { id: 'doc_co_cau_bai', label: 'Độc Cô Cầu Bại', tier: 'SSS' },
  { id: 'than_tai',       label: 'Thần Tài',      tier: 'SSS' },
];

export const SHOP_TITLES = SHOP_TITLE_DEFS.map(t => {
  const meta = TIER_META[t.tier];
  return {
    ...t,
    type: 'shop',
    cls: t.cls || meta.cls,
    color: meta.color,
    price: meta.price,
    desc: `Danh hiệu ${meta.name}`,
  };
});

export const TITLES = [...AUTO_TITLES, ...SHOP_TITLES, ...EVENT_TITLES];

// ── HÀM HỖ TRỢ ──────────────────────────────────────────
export function getTitleById(id) {
  return TITLES.find(t => t.id === id) || null;
}

export function getShopTitlesByTier(tier) {
  return SHOP_TITLES.filter(t => t.tier === tier);
}

export function getAutoTitlesByTier(tier) {
  const prefix = `tier-${tier.toLowerCase()}`;
  return AUTO_TITLES.filter(t => t.cls === prefix || t.cls.startsWith(prefix + '-'));
}

export function getAutoOwnedTitles(stats) {
  return AUTO_TITLES.filter(t => t.condition(stats));
}

export function getOwnedTitles(stats, ownedShopIds = []) {
  const auto = getAutoOwnedTitles(stats);
  const shop = SHOP_TITLES.filter(t => ownedShopIds.includes(t.id));
  return [...auto, ...shop];
}

export function getDefaultTitle(stats, ownedShopIds = []) {
  const owned = getOwnedTitles(stats, ownedShopIds);
  return owned[0] || null;
}

// ── BXH RANK ─────────────────────────────────────────────
export const TIER_ORDER = { 'A': 1, 'S': 2, 'SS': 3, 'SSS': 4 };

export function getTierFromTitle(title) {
  if (!title) return null;
  if (title.tier) return title.tier;
  if (title.cls) {
    const m = title.cls.match(/^tier-(sss|ss|s|a)$/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function computeHighestTierOrder(ownedTitleIds, stats) {
  let maxOrder = 0;
  if (ownedTitleIds?.length) {
    for (const id of ownedTitleIds) {
      const title = getTitleById(id);
      const tier = getTierFromTitle(title);
      const order = tier ? (TIER_ORDER[tier] || 0) : 0;
      if (order > maxOrder) maxOrder = order;
    }
  }
  if (stats) {
    for (const t of getAutoOwnedTitles(stats)) {
      const tier = getTierFromTitle(t);
      const order = tier ? (TIER_ORDER[tier] || 0) : 0;
      if (order > maxOrder) maxOrder = order;
    }
  }
  return maxOrder;
}

// ── TIẾN TRÌNH CHO AUTO TITLE ──────────────────────────
export function getTitleProgress(title, stats) {
  if (!title || !stats || title.boolean || !title.target || !title.statKey) return null;
  const current = Math.min(stats[title.statKey] || 0, title.target);
  return { current, target: title.target };
}

export function getHighestTitleInfo(ownedTitleIds, stats) {
  let best = null, bestOrder = 0;
  const check = (title) => {
    if (!title) return;
    const tier = getTierFromTitle(title);
    const order = tier ? (TIER_ORDER[tier] || 0) : 0;
    if (order > bestOrder) { bestOrder = order; best = { label: title.label, cls: title.cls, tier, order }; }
  };
  if (ownedTitleIds?.length) { for (const id of ownedTitleIds) check(getTitleById(id)); }
  if (stats) { for (const t of getAutoOwnedTitles(stats)) check(t); }
  return best;
}
