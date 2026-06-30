// ============================================================
// ===== ROOM CHAT - Module chat nổi dùng chung cho mọi phòng game =====
// Giao diện kiểu Messenger/Facebook (xanh dương)
// Cách dùng:
//   import { initRoomChat, getMyNickname } from './room-chat.js';
//   const myName = await getMyNickname(db, _user.uid, _user.email);
//   initRoomChat({ db, roomId: ROOM_ID, uid: _user.uid, getName: () => myName });
// ============================================================
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let _chatUnsub = null;
let _initialized = false;
let _nicknameCache = {}; // cache theo uid để tránh getDoc lặp lại nhiều lần

// Lấy nickname thật từ collection 'users' (KHÔNG dùng _user.displayName vì
// Firebase Auth thường không có displayName -> hay rơi vào fallback "Bạn").
// Dùng chung cho mọi game: const myName = await getMyNickname(db, _user.uid, _user.email);
export async function getMyNickname(db, uid, fallbackEmail) {
  if (_nicknameCache[uid]) return _nicknameCache[uid];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const name = (snap.exists() && snap.data().nickname) || fallbackEmail?.split('@')[0] || 'Người chơi';
    _nicknameCache[uid] = name;
    return name;
  } catch (e) {
    console.error('[room-chat] getMyNickname error:', e);
    return fallbackEmail?.split('@')[0] || 'Người chơi';
  }
}

// Các giá trị này luôn được CẬP NHẬT MỚI mỗi lần initRoomChat được gọi,
// để tránh lỗi "ai nhắn cũng hiện là bạn" do uid cũ bị giữ lại trong closure
// (ví dụ trường hợp gọi initRoomChat trước khi Firebase Auth trả về uid thật).
let _state = { db: null, roomId: null, uid: null, getName: null };

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isMe(msgUid) {
  // Chỉ coi là "mình" khi cả hai uid đều tồn tại và trùng nhau.
  // Ép cả hai về String để tránh lệch kiểu dữ liệu (number vs string, v.v).
  // Tránh trường hợp undefined === undefined => true khiến mọi người đều hiện là "bạn".
  if (!msgUid || !_state.uid) return false;
  const result = String(msgUid) === String(_state.uid);
  if (window.__RC_DEBUG) {
    console.log('[room-chat] isMe check:', { msgUid, myUid: _state.uid, result });
  }
  return result;
}

function avatarColor(name) {
  const colors = ['#0084ff', '#00c2a8', '#ff7a59', '#7c5cff', '#ff5c8d', '#23c16b', '#ffae00'];
  let hash = 0;
  const s = String(name || '?');
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function injectStyles() {
  if (document.getElementById('rc-style')) return;
  const style = document.createElement('style');
  style.id = 'rc-style';
  style.textContent = `
#rc-fab{position:fixed;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#1cc8ff,#0066ff 70%);box-shadow:0 0 18px rgba(0,170,255,.65),0 4px 16px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;cursor:grab;z-index:9999;user-select:none;touch-action:none;transition:transform .15s;border:1px solid rgba(120,220,255,.5)}
#rc-fab:active{cursor:grabbing;transform:scale(.94)}
#rc-fab .rc-badge{position:absolute;top:-4px;right:-4px;background:#ff2d6b;color:#fff;font-size:11px;font-weight:700;min-width:19px;height:19px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 0 0 2px #0a0e1a,0 0 8px rgba(255,45,107,.7)}
#rc-panel{position:fixed;width:min(330px,86vw);height:min(460px,64vh);background:#0b0f1c;border:1px solid rgba(0,170,255,.25);border-radius:18px;box-shadow:0 0 30px rgba(0,140,255,.18),0 14px 40px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden;z-index:9998;font-family:inherit}
#rc-panel.open{display:flex}
#rc-head{padding:12px 14px;background:linear-gradient(135deg,#0a1a3a,#001233);display:flex;align-items:center;justify-content:space-between;font-weight:700;color:#7fe3ff;font-size:15px;flex-shrink:0;border-bottom:1px solid rgba(0,170,255,.3);text-shadow:0 0 8px rgba(0,200,255,.6)}
#rc-head .rc-head-title{display:flex;align-items:center;gap:8px}
#rc-head .rc-head-dot{width:8px;height:8px;border-radius:50%;background:#3cff8a;box-shadow:0 0 8px rgba(60,255,138,.9),0 0 0 2px rgba(255,255,255,.15)}
#rc-close{cursor:pointer;color:#7fe3ff;font-size:18px;line-height:1;padding:2px 8px;opacity:.85;border-radius:50%}
#rc-close:hover{opacity:1;background:rgba(0,170,255,.15)}
#rc-msgs{flex:1;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:10px;background:radial-gradient(ellipse at top,#0e1426 0%,#070a14 100%)}
#rc-msgs::-webkit-scrollbar{width:6px}
#rc-msgs::-webkit-scrollbar-thumb{background:rgba(0,170,255,.35);border-radius:3px}
.rc-row{display:flex;align-items:flex-end;gap:6px;max-width:82%}
.rc-row.me{align-self:flex-end;flex-direction:row-reverse}
.rc-row.other{align-self:flex-start}
.rc-avatar{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;box-shadow:0 0 6px rgba(0,170,255,.5)}
.rc-bubble-wrap{display:flex;flex-direction:column;min-width:0}
.rc-name{font-size:11px;color:#5ec9f0;margin-bottom:2px;font-weight:600;padding:0 4px}
.rc-row.me .rc-name{display:none}
.rc-bubble{padding:8px 12px;border-radius:18px;font-size:13.5px;line-height:1.4;word-break:break-word;display:inline-block;max-width:100%}
.rc-row.other .rc-bubble{background:#162236;color:#dce8f5;border:1px solid rgba(0,170,255,.18);border-bottom-left-radius:4px}
.rc-row.me .rc-bubble{background:linear-gradient(135deg,#00aeff,#0050d8);color:#fff;border-bottom-right-radius:4px;box-shadow:0 0 14px rgba(0,160,255,.45)}
.rc-msg.sys{align-self:center;color:#6c7a93;font-size:11.5px;font-style:italic;background:rgba(255,255,255,.04);padding:4px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.06)}
#rc-inputrow{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(0,170,255,.2);background:#0a0e1a;flex-shrink:0}
#rc-input{flex:1;background:#131b2e;border:1px solid rgba(0,170,255,.2);border-radius:20px;padding:10px 14px;color:#e6f4ff;font-size:13.5px;outline:none}
#rc-input:focus{border-color:rgba(0,170,255,.55)}
#rc-input::placeholder{color:#5a6786}
#rc-send{background:radial-gradient(circle at 30% 30%,#1cc8ff,#0050d8 70%);border:none;color:#fff;border-radius:50%;width:38px;height:38px;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(0,170,255,.55)}
#rc-send:active{transform:scale(.93)}
`;
  document.head.appendChild(style);
}

function clampToViewport(x, y, w, h) {
  const maxX = window.innerWidth - w - 8;
  const maxY = window.innerHeight - h - 8;
  return { x: Math.min(Math.max(8, x), Math.max(8, maxX)), y: Math.min(Math.max(8, y), Math.max(8, maxY)) };
}

export function initRoomChat({ db, roomId, uid, getName }) {
  // Luôn cập nhật state mới nhất (sửa lỗi "ai nhắn cũng hiện bạn" do uid cũ trong closure)
  _state.db = db;
  _state.roomId = roomId;
  _state.uid = uid;
  _state.getName = getName;

  if (_initialized) {
    // Đã khởi tạo UI rồi (vd. điều hướng SPA sang phòng khác) -> chỉ cần
    // huỷ subscription cũ và mở subscription mới với roomId/uid mới.
    subscribeChat();
    return;
  }
  _initialized = true;
  injectStyles();

  const fab = document.createElement('div');
  fab.id = 'rc-fab';
  fab.innerHTML = '💬<span class="rc-badge" id="rc-badge" style="display:none">0</span>';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'rc-panel';
  panel.innerHTML = `
    <div id="rc-head">
      <div class="rc-head-title"><span class="rc-head-dot"></span>Chat phòng</div>
      <span id="rc-close">✕</span>
    </div>
    <div id="rc-msgs"></div>
    <div id="rc-inputrow">
      <input id="rc-input" maxlength="200" placeholder="Nhắn gì đó..." />
      <button id="rc-send">➤</button>
    </div>`;
  document.body.appendChild(panel);

  let savedPos = null;
  try { savedPos = JSON.parse(localStorage.getItem('rc-fab-pos') || 'null'); } catch {}
  let posX = savedPos?.x ?? (window.innerWidth - 74);
  let posY = savedPos?.y ?? (window.innerHeight - 162);
  ({ x: posX, y: posY } = clampToViewport(posX, posY, 58, 58));
  fab.style.left = posX + 'px';
  fab.style.top = posY + 'px';

  let unread = 0;
  let isOpen = false;
  const badge = document.getElementById('rc-badge');

  function setBadge() {
    if (unread > 0 && !isOpen) {
      badge.style.display = 'flex';
      badge.textContent = unread > 9 ? '9+' : String(unread);
    } else {
      badge.style.display = 'none';
    }
  }

  function positionPanel() {
    const pw = panel.offsetWidth || 300;
    const ph = panel.offsetHeight || 400;
    let px = posX + 58 + 10;
    let py = posY - ph + 58;
    if (px + pw > window.innerWidth - 8) px = posX - pw - 10;
    if (px < 8) px = 8;
    const clamped = clampToViewport(px, py, pw, ph);
    panel.style.left = clamped.x + 'px';
    panel.style.top = clamped.y + 'px';
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    positionPanel();
    unread = 0;
    setBadge();
    setTimeout(() => document.getElementById('rc-input')?.focus(), 50);
    scrollBottom();
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
  }

  document.getElementById('rc-close').onclick = closePanel;

  // ===== Kéo thả nút tròn (tap = mở/đóng chat, kéo = di chuyển) =====
  let dragging = false, moved = false, startX = 0, startY = 0, origX = 0, origY = 0;

  fab.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    origX = posX; origY = posY;
    fab.setPointerCapture(e.pointerId);
  });
  fab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const clamped = clampToViewport(origX + dx, origY + dy, 58, 58);
    posX = clamped.x; posY = clamped.y;
    fab.style.left = posX + 'px';
    fab.style.top = posY + 'px';
    if (isOpen) positionPanel();
  });
  fab.addEventListener('pointerup', (e) => {
    dragging = false;
    fab.releasePointerCapture(e.pointerId);
    if (moved) {
      try { localStorage.setItem('rc-fab-pos', JSON.stringify({ x: posX, y: posY })); } catch {}
    } else {
      isOpen ? closePanel() : openPanel();
    }
  });

  window.addEventListener('resize', () => {
    const clamped = clampToViewport(posX, posY, 58, 58);
    posX = clamped.x; posY = clamped.y;
    fab.style.left = posX + 'px';
    fab.style.top = posY + 'px';
    if (isOpen) positionPanel();
  });

  async function sendMsg() {
    const input = document.getElementById('rc-input');
    const text = input.value.trim();
    if (!text || !_state.db) return;
    input.value = '';
    try {
      const chatCol = collection(_state.db, 'rooms', _state.roomId, 'chat');
      await addDoc(chatCol, {
        senderUid: _state.uid,
        senderName: _state.getName ? _state.getName() : 'Người chơi',
        text: text.slice(0, 200),
        createdAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  }
  document.getElementById('rc-send').onclick = sendMsg;
  document.getElementById('rc-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMsg();
  });

  // expose internal helpers used by subscribeChat()
  window.__rc_unread_inc = () => { unread++; setBadge(); };
  window.__rc_scroll = scrollBottom;

  function scrollBottom() {
    const msgsEl = document.getElementById('rc-msgs');
    requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; });
  }

  subscribeChat();
}

function renderMsg(m) {
  const msgsEl = document.getElementById('rc-msgs');
  if (m.sys) {
    const div = document.createElement('div');
    div.className = 'rc-msg sys';
    div.style.alignSelf = 'center';
    div.textContent = m.text;
    msgsEl.appendChild(div);
    return;
  }
  const senderUid = m.senderUid ?? m.uid;
  const senderName = m.senderName ?? m.name;
  const me = isMe(senderUid);
  const row = document.createElement('div');
  row.className = 'rc-row ' + (me ? 'me' : 'other');

  const initial = esc(String(senderName || '?').trim().charAt(0).toUpperCase() || '?');
  const avatarHtml = me ? '' : `<div class="rc-avatar" style="background:${avatarColor(senderName)}">${initial}</div>`;

  row.innerHTML = `
    ${avatarHtml}
    <div class="rc-bubble-wrap">
      <div class="rc-name">${esc(senderName)}</div>
      <div class="rc-bubble">${esc(m.text)}</div>
    </div>`;
  msgsEl.appendChild(row);
}

function subscribeChat() {
  const msgsEl = document.getElementById('rc-msgs');
  if (!msgsEl || !_state.db || !_state.roomId) return;

  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  msgsEl.innerHTML = '';

  const chatCol = collection(_state.db, 'rooms', _state.roomId, 'chat');
  const q = query(chatCol, orderBy('createdAt', 'desc'), limit(50));
  let firstLoad = true;

  _chatUnsub = onSnapshot(q, (snap) => {
    if (firstLoad) {
      msgsEl.innerHTML = '';
      const all = snap.docs.slice().reverse();
      all.forEach(d => renderMsg(d.data()));
      firstLoad = false;
      window.__rc_scroll && window.__rc_scroll();
      return;
    }
    const added = snap.docChanges().filter(c => c.type === 'added').map(c => c.doc);
    added.forEach(d => {
      const m = d.data();
      renderMsg(m);
      const m2uid = m.senderUid ?? m.uid;
      if (!isMe(m2uid)) {
        window.__rc_unread_inc && window.__rc_unread_inc();
      }
    });
    window.__rc_scroll && window.__rc_scroll();
  });
}

export function destroyRoomChat() {
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  document.getElementById('rc-fab')?.remove();
  document.getElementById('rc-panel')?.remove();
  document.getElementById('rc-style')?.remove();
  delete window.__rc_unread_inc;
  delete window.__rc_scroll;
  _initialized = false;
  _state = { db: null, roomId: null, uid: null, getName: null };
}