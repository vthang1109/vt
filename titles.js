// titles.js — Danh mục TẤT CẢ danh hiệu trong game
// Dùng chung cho: profile.js (hiển thị/chọn), shop.js (mua), bag.js (túi đồ)
//
// type : 'auto' -> tự động có khi đủ điều kiện
//        'shop' -> mua bằng điểm
// tier : 'A' | 'S' | 'S+' | 'SS' | 'SK' | 'SSS'
// cls  : tên class CSS badge

// ── CẤU HÌNH CẤP ĐỘ ────────────────────────────────────────
export const TIER_META = {
  'A':   { cls: 'tier-a',   name: 'Cấp A · Xanh Lá',    price: 3000,   icon: '🟢', color: '#34d399' },
  'S':   { cls: 'tier-s',   name: 'Cấp S · Tím',         price: 10000,  icon: '🟣', color: '#a78bfa' },
  'S+':  { cls: 'tier-sp',  name: 'Cấp S+ · Đỏ',         price: 30000,  icon: '🔴', color: '#f87171' },
  'SS':  { cls: 'tier-ss',  name: 'Cấp SS · Vàng',       price: 80000,  icon: '🟡', color: '#fbbf24' },
  'SK':  { cls: 'tier-sk',  name: 'Cấp SK · Sự Kiện',    price: 300000, icon: '🎪', color: '#f472b6' },
  'SSS': { cls: 'tier-sss', name: 'Cấp SSS · Guardian',  price: 500000, icon: '👑', color: '#f1f5f9' },
};

// ── DANH HIỆU TỰ ĐỘNG ───────────────────────────────────────
const AUTO_TITLES = [
  {
    id: 'dai_phu_hao',
    label: 'Đại Phú Hào',
    cls: 'tier-ss',
    type: 'auto',
    condition: (s) => s.points >= 100000,
    desc: 'Đạt 100.000 điểm trở lên'
  },
  {
    id: 'dai_gia',
    label: 'Đại Gia',
    cls: 'tier-ss',
    type: 'auto',
    condition: (s) => s.points >= 50000 && s.points < 100000,
    desc: 'Đạt 50.000 điểm trở lên'
  },
  {
    id: 'nguoi_choi_moi',
    label: 'Người Chơi Mới',
    cls: 'tier-a',
    type: 'auto',
    condition: (s) => s.points >= 1000,
    desc: 'Đạt 1.000 điểm trở lên'
  },
  {
    id: 'vua_ngoai_giao',
    label: 'Vua Ngoại Giao',
    cls: 'tier-s',
    type: 'auto',
    condition: (s) => s.friends >= 50,
    desc: 'Có 50 bạn bè trở lên'
  },
  {
    id: 'than_thien',
    label: 'Thân Thiện',
    cls: 'tier-a',
    type: 'auto',
    condition: (s) => s.friends >= 10 && s.friends < 50,
    desc: 'Có 10 bạn bè trở lên'
  },
];

// ── DANH HIỆU SHOP ───────────────────────────────────────────
// SK có thêm field: cls riêng theo theme màu, icon theme
const SHOP_TITLE_DEFS = [

  // ===== CẤP A — XANH LÁ =====
  { id: 'tan_binh',          label: 'Tân Binh',           tier: 'A' },
  { id: 'hoc_viec',          label: 'Học Việc',           tier: 'A' },
  { id: 'nguoi_moi',         label: 'Người Mới',          tier: 'A' },
  { id: 'hat_giong',         label: 'Hạt Giống',          tier: 'A' },
  { id: 'lu_khach',          label: 'Lữ Khách',           tier: 'A' },
  { id: 'nguoi_mo_mong',     label: 'Người Mơ Mộng',      tier: 'A' },
  { id: 'nguoi_quan_sat',    label: 'Người Quan Sát',     tier: 'A' },
  { id: 'ke_dao_choi',       label: 'Kẻ Dạo Chơi',        tier: 'A' },
  { id: 'mam_non',           label: 'Mầm Non',            tier: 'A' },
  { id: 'nguoi_tap_su',      label: 'Người Tập Sự',       tier: 'A' },

  // ===== CẤP S — TÍM =====
  { id: 'cao_thu',           label: 'Cao Thủ',            tier: 'S' },
  { id: 'bac_thay',          label: 'Bậc Thầy',           tier: 'S' },
  { id: 'sat_thu_bong_dem',  label: 'Sát Thủ Bóng Đêm',   tier: 'S' },
  { id: 'phap_su_toi_thuong',label: 'Pháp Sư Tối Thượng', tier: 'S' },
  { id: 'quan_su',           label: 'Quân Sư',            tier: 'S' },
  { id: 'dai_hiep',          label: 'Đại Hiệp',           tier: 'S' },
  { id: 'than_toc',          label: 'Thần Tốc',           tier: 'S' },
  { id: 'vo_anh',            label: 'Vô Ảnh',             tier: 'S' },
  { id: 'bi_an',             label: 'Bí Ẩn',              tier: 'S' },
  { id: 'chien_than_tim',    label: 'Chiến Thần Tím',     tier: 'S' },

  // ===== CẤP S+ — ĐỎ =====
  { id: 'ba_vuong',          label: 'Bá Vương',           tier: 'S+' },
  { id: 'chien_than',        label: 'Chiến Thần',         tier: 'S+' },
  { id: 'hoa_long',          label: 'Hỏa Long',           tier: 'S+' },
  { id: 'sat_than',          label: 'Sát Thần',           tier: 'S+' },
  { id: 'vua_chien_truong',  label: 'Vua Chiến Trường',   tier: 'S+' },
  { id: 'ac_long',           label: 'Ác Long',            tier: 'S+' },
  { id: 'than_chien_tranh',  label: 'Thần Chiến Tranh',   tier: 'S+' },
  { id: 'huyet_chien',       label: 'Huyết Chiến',        tier: 'S+' },
  { id: 'vuong_gia',         label: 'Vương Giả',          tier: 'S+' },
  { id: 'ke_huy_diet',       label: 'Kẻ Hủy Diệt',        tier: 'S+' },

  // ===== CẤP SS — VÀNG =====
  { id: 'vua_kim_tien',      label: 'Vua Kim Tiền',       tier: 'SS' },
  { id: 'hoang_de',          label: 'Hoàng Đế',           tier: 'SS' },
  { id: 'thien_kim',         label: 'Thiên Kim',          tier: 'SS' },
  { id: 'de_vuong',          label: 'Đế Vương',           tier: 'SS' },
  { id: 'bac_ton_quy',       label: 'Bậc Tôn Quý',        tier: 'SS' },
  { id: 'van_tai',           label: 'Vạn Tài',            tier: 'SS' },
  { id: 'trum_cuoi',         label: 'Trùm Cuối',          tier: 'SS' },
  { id: 'than_tai',          label: 'Thần Tài',           tier: 'SS' },
  { id: 'phu_ho',            label: 'Phú Hộ',             tier: 'SS' },
  { id: 'doc_co_cau_bai',    label: 'Độc Cô Cầu Bại',     tier: 'SS' },

  // ===== CẤP SK — SỰ KIỆN (mỗi cái có theme màu riêng) =====
  // 🌸 Hồng — trái tim / lãng mạn
  { id: 'sk_tinh_yeu',       label: '💕 Tình Yêu',         tier: 'SK', cls: 'tier-sk-pink',   desc: 'Sự kiện Valentine · Tình yêu ngọt ngào' },
  { id: 'sk_cong_chua',      label: '🌸 Công Chúa',        tier: 'SK', cls: 'tier-sk-pink',   desc: 'Sự kiện mùa xuân · Nhan sắc nghiêng thành' },
  { id: 'sk_mong_mo',        label: '🫧 Mộng Mơ',          tier: 'SK', cls: 'tier-sk-pink',   desc: 'Sự kiện hoa anh đào · Nhẹ nhàng như gió' },

  // 🔥 Đỏ lửa — mãnh liệt
  { id: 'sk_lua_than',       label: '🔥 Lửa Thần',         tier: 'SK', cls: 'tier-sk-fire',   desc: 'Sự kiện Hỏa Diệm Sơn · Thiêu đốt tất cả' },
  { id: 'sk_ac_quy_do',      label: '😈 Ác Quỷ Đỏ',        tier: 'SK', cls: 'tier-sk-fire',   desc: 'Sự kiện Halloween · Đến từ địa ngục' },
  { id: 'sk_phuong_hoang',   label: '🦅 Phượng Hoàng',     tier: 'SK', cls: 'tier-sk-fire',   desc: 'Sự kiện tái sinh · Bất diệt từ tro tàn' },

  // 🌊 Xanh ngọc — băng / biển
  { id: 'sk_bang_than',      label: '❄️ Băng Thần',         tier: 'SK', cls: 'tier-sk-cyan',   desc: 'Sự kiện mùa đông · Lạnh như băng giá' },
  { id: 'sk_hai_vuong',      label: '🌊 Hải Vương',         tier: 'SK', cls: 'tier-sk-cyan',   desc: 'Sự kiện đại dương · Chúa tể biển cả' },
  { id: 'sk_tuyet_nu',       label: '🌨️ Tuyết Nữ',          tier: 'SK', cls: 'tier-sk-cyan',   desc: 'Sự kiện Noel · Tinh khiết như tuyết trắng' },

  // 🌙 Tím đêm — huyền bí
  { id: 'sk_ma_vuong',       label: '🌙 Ma Vương',          tier: 'SK', cls: 'tier-sk-dark',   desc: 'Sự kiện bóng tối · Kẻ cai trị đêm đen' },
  { id: 'sk_phap_su_bong',   label: '🔮 Pháp Sư Bóng Tối', tier: 'SK', cls: 'tier-sk-dark',   desc: 'Sự kiện phù thủy · Bí ẩn khôn lường' },
  { id: 'sk_nguyet_than',    label: '🌑 Nguyệt Thần',       tier: 'SK', cls: 'tier-sk-dark',   desc: 'Sự kiện trăng máu · Thần của màn đêm' },

  // ⭐ Vàng ánh sao — lễ hội
  { id: 'sk_sao_bang',       label: '⭐ Sao Băng',          tier: 'SK', cls: 'tier-sk-star',   desc: 'Sự kiện thiên văn · Vụt sáng rực rỡ' },
  { id: 'sk_hoang_kim',      label: '✨ Hoàng Kim',         tier: 'SK', cls: 'tier-sk-star',   desc: 'Sự kiện năm mới · Ánh vàng rực sáng' },
  { id: 'sk_than_may_man',   label: '🍀 Thần May Mắn',      tier: 'SK', cls: 'tier-sk-star',   desc: 'Sự kiện St.Patrick · Vận may luôn đến' },

  // 🌿 Xanh lá ngọc — thiên nhiên
  { id: 'sk_rung_than',      label: '🌿 Rừng Thần',         tier: 'SK', cls: 'tier-sk-nature', desc: 'Sự kiện mùa hè · Linh hồn của đại ngàn' },
  { id: 'sk_tien_nu_xanh',   label: '🧚 Tiên Nữ Xanh',      tier: 'SK', cls: 'tier-sk-nature', desc: 'Sự kiện mùa xuân · Nàng tiên rừng xanh' },

  // 🎰 Đen-Trắng-Vàng chéo — cờ bạc / casino
  { id: 'sk_than_bai',        label: '🃏 Thần Bài',          tier: 'SK', cls: 'tier-sk-casino', desc: 'Sự kiện Casino · Bậc thầy thao túng bài' },
  { id: 'sk_vuong_bai',       label: '🂡 Vương Bài',          tier: 'SK', cls: 'tier-sk-casino', desc: 'Sự kiện Casino · Lá bài định mệnh' },
  { id: 'sk_ac_quy_bai',      label: '🎴 Ác Quỷ Bài',        tier: 'SK', cls: 'tier-sk-casino', desc: 'Sự kiện Casino · Kẻ không bao giờ thua' },
  { id: 'sk_joker',           label: '🃏 Joker',              tier: 'SK', cls: 'tier-sk-casino', desc: 'Sự kiện Casino · Lá bài huyền thoại' },
  { id: 'sk_chieu_bai',       label: '♠️ Chiếu Bài',          tier: 'SK', cls: 'tier-sk-casino', desc: 'Sự kiện Casino · Một chiếu định giang hồ' },

  // ===== CẤP SSS — GUARDIAN (gradient đặc biệt) =====
  { id: 'sss_guardian',      label: '👑 Guardian',          tier: 'SSS' },
  { id: 'sss_than_linh',     label: '⚡ Thần Linh',         tier: 'SSS' },
  { id: 'sss_vo_thuong',     label: '🌌 Vô Thượng',         tier: 'SSS' },
  { id: 'sss_thien_dia',     label: '🌠 Thiên Địa',         tier: 'SSS' },
  { id: 'sss_khai_thien',    label: '🔱 Khai Thiên',        tier: 'SSS' },
  { id: 'sss_diet_the',      label: '💫 Diệt Thế',          tier: 'SSS' },
  { id: 'sss_nguyen_thu',    label: '🪐 Nguyên Thủy',       tier: 'SSS' },
  { id: 'sss_bat_diet',      label: '♾️ Bất Diệt',           tier: 'SSS' },
  { id: 'sss_tuyet_dinh',    label: '🏔️ Tuyệt Đỉnh',        tier: 'SSS' },
  { id: 'sss_vinh_hang',     label: '🌀 Vĩnh Hằng',         tier: 'SSS' },
];

const SK_THEME_COLOR = {
  'tier-sk-pink':   '#f472b6',
  'tier-sk-fire':   '#fb923c',
  'tier-sk-cyan':   '#22d3ee',
  'tier-sk-dark':   '#8b5cf6',
  'tier-sk-star':   '#facc15',
  'tier-sk-nature': '#4ade80',
  'tier-sk-casino': '#f5c518',
};

export const SHOP_TITLES = SHOP_TITLE_DEFS.map(t => {
  const meta = TIER_META[t.tier];
  const cls  = t.cls || meta.cls;
  const color = SK_THEME_COLOR[cls] || meta.color;
  return {
    ...t,
    type: 'shop',
    cls,
    color,
    price: meta.price,
    desc: t.desc || `Danh hiệu ${meta.name}`,
  };
});

export const TITLES = [...AUTO_TITLES, ...SHOP_TITLES];

// ── HÀM HỖ TRỢ ─────────────────────────────────────────────

export function getTitleById(id) {
  return TITLES.find(t => t.id === id) || null;
}

export function getShopTitlesByTier(tier) {
  return SHOP_TITLES.filter(t => t.tier === tier);
}

export function getAutoOwnedTitles(stats) {
  return TITLES.filter(t => t.type === 'auto' && t.condition(stats));
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

// ── BXH RANK ──────────────────────────────────────────────
// Thứ tự cấp độ dùng để so sánh trong leaderboard rank
export const TIER_ORDER = {
  'A':   1,
  'S':   2,
  'S+':  3,
  'SS':  4,
  'SK':  5,
  'SSS': 6,
};

/**
 * Lấy cấp (tier) từ một title object.
 * Shop titles có field `tier`; auto titles dùng `cls` để suy ra.
 */
export function getTierFromTitle(title) {
  if (!title) return null;
  if (title.tier) return title.tier; // shop titles
  // Auto titles: cls như 'tier-ss', 'tier-a', 'tier-s'
  if (title.cls) {
    const m = title.cls.match(/^tier-(sss|ss|s\+|s|a|sk)$/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Tính highestTierOrder cao nhất từ danh sách title IDs đang sở hữu.
 * @param {string[]} ownedTitleIds - Mảng ID title (shop + auto)
 * @param {{points?:number,friends?:number}} [stats] - Thống kê để tính auto titles (nếu cần)
 * @returns {number} 0 nếu không có title nào
 */
export function computeHighestTierOrder(ownedTitleIds, stats) {
  let maxOrder = 0;
  if (ownedTitleIds && ownedTitleIds.length) {
    for (const id of ownedTitleIds) {
      const title = getTitleById(id);
      const tier = getTierFromTitle(title);
      const order = tier ? (TIER_ORDER[tier] || 0) : 0;
      if (order > maxOrder) maxOrder = order;
    }
  }
  // Nếu có stats, tính luôn auto titles
  if (stats) {
    const autoTitles = getAutoOwnedTitles(stats);
    for (const t of autoTitles) {
      const tier = getTierFromTitle(t);
      const order = tier ? (TIER_ORDER[tier] || 0) : 0;
      if (order > maxOrder) maxOrder = order;
    }
  }
  return maxOrder;
}

/**
 * Lấy thông tin title cao nhất (dùng cho hiển thị BXH Rank).
 * @returns {{label:string, cls:string, tier:string}|null}
 */
export function getHighestTitleInfo(ownedTitleIds, stats) {
  let best = null;
  let bestOrder = 0;

  const check = (title) => {
    if (!title) return;
    const tier = getTierFromTitle(title);
    const order = tier ? (TIER_ORDER[tier] || 0) : 0;
    if (order > bestOrder) {
      bestOrder = order;
      best = { label: title.label, cls: title.cls, tier, order };
    }
  };

  if (ownedTitleIds && ownedTitleIds.length) {
    for (const id of ownedTitleIds) {
      check(getTitleById(id));
    }
  }
  if (stats) {
    for (const t of getAutoOwnedTitles(stats)) check(t);
  }
  return best;
}
