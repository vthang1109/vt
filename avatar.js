// avatar.js — Dùng chung để render avatar người dùng
// avatarUrl: base64 lưu trong Firestore users/{uid}.avatarUrl
// Fallback: chữ cái đầu nickname

/**
 * Render avatar vào element.
 * el: DOM element (div hoặc img wrapper)
 * user: { nickname, avatarUrl }
 * size: css string (mặc định '38px')
 */
export function renderAvatar(el, user, size = '38px') {
  if (!el) return;
  const letter = (user?.nickname || user?.email || '?').charAt(0).toUpperCase();
  if (user?.avatarUrl) {
    el.style.backgroundImage  = `url(${user.avatarUrl})`;
    el.style.backgroundSize   = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = letter;
  }
  el.style.width        = size;
  el.style.height       = size;
  el.style.borderRadius = '50%';
  el.style.display      = 'flex';
  el.style.alignItems   = 'center';
  el.style.justifyContent = 'center';
  el.style.fontWeight   = '900';
  el.style.fontSize     = `calc(${size} * 0.4)`;
  el.style.color        = '#fff';
  el.style.flexShrink   = '0';
  if (!user?.avatarUrl) {
    el.style.background = 'linear-gradient(135deg,#0ea5e9,#38bdf8)';
  }
}

/**
 * Trả về HTML string cho avatar (dùng trong innerHTML)
 * user: { nickname, avatarUrl }
 * size: px number
 * extraStyle: css string thêm
 */
export function avatarHtml(user, size = 38, extraStyle = '') {
  const letter = (user?.nickname || user?.email || '?').charAt(0).toUpperCase();
  if (user?.avatarUrl) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:url(${user.avatarUrl}) center/cover;flex-shrink:0;${extraStyle}"></div>`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#38bdf8);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.floor(size*0.4)}px;color:#fff;flex-shrink:0;${extraStyle}">${letter}</div>`;
}
