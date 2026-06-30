// ============================================================
// ===== ROOM CHAT - Module chat nổi dùng chung cho mọi phòng game =====
// Cách dùng: import { initRoomChat } from './room-chat.js';
// initRoomChat({ db, roomId: ROOM_ID, uid: _user.uid, getName: () => tenNguoiChoi });
// ============================================================
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let _chatUnsub = null;
let _initialized = false;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectStyles() {
  if (document.getElementById('rc-style')) return;
  const style = document.createElement('style');
  style.id = 'rc-style';
  style.textContent = `
#rc-fab{position:fixed;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;cursor:grab;z-index:9999;user-select:none;touch-action:none;transition:transform .15s}
#rc-fab:active{cursor:grabbing;transform:scale(.94)}
#rc-fab .rc-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 0 0 2px #1e1b2e}
#rc-panel{position:fixed;width:min(320px,86vw);height:min(420px,62vh);background:#1a1730;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;z-index:9998;font-family:inherit}
#rc-panel.open{display:flex}
#rc-head{padding:10px 14px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:space-between;font-weight:700;color:#fff;font-size:14px;border-bottom:1px solid rgba(255,255,255,.06)}
#rc-close{cursor:pointer;color:#94a3b8;font-size:18px;line-height:1;padding:2px 6px}
#rc-msgs{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.rc-msg{max-width:80%;font-size:13px;line-height:1.35;word-break:break-word}
.rc-msg .rc-name{font-size:11px;color:#a78bfa;margin-bottom:1px;font-weight:600}
.rc-msg .rc-bubble{background:rgba(255,255,255,.07);color:#e5e7eb;padding:6px 10px;border-radius:10px;display:inline-block}
.rc-msg.me{align-self:flex-end;text-align:right}
.rc-msg.me .rc-bubble{background:#6366f1;color:#fff}
.rc-msg.sys{align-self:center;color:#64748b;font-size:11px;font-style:italic}
#rc-inputrow{display:flex;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.06)}
#rc-input{flex:1;background:rgba(255,255,255,.06);border:none;border-radius:10px;padding:9px 12px;color:#fff;font-size:13px;outline:none}
#rc-input::placeholder{color:#64748b}
#rc-send{background:#6366f1;border:none;color:#fff;border-radius:10px;width:38px;font-size:16px;cursor:pointer}
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
  if (_initialized) return;
  _initialized = true;
  injectStyles();

  const fab = document.createElement('div');
  fab.id = 'rc-fab';
  fab.innerHTML = '💬<span class="rc-badge" id="rc-badge" style="display:none">0</span>';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'rc-panel';
  panel.innerHTML = `
    <div id="rc-head">💬 Chat phòng <span id="rc-close">✕</span></div>
    <div id="rc-msgs"></div>
    <div id="rc-inputrow">
      <input id="rc-input" maxlength="200" placeholder="Nhắn gì đó..." />
      <button id="rc-send">➤</button>
    </div>`;
  document.body.appendChild(panel);

  let savedPos = null;
  try { savedPos = JSON.parse(localStorage.getItem('rc-fab-pos') || 'null'); } catch {}
  let posX = savedPos?.x ?? (window.innerWidth - 72);
  let posY = savedPos?.y ?? (window.innerHeight - 160);
  ({ x: posX, y: posY } = clampToViewport(posX, posY, 56, 56));
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
    let px = posX + 56 + 10;
    let py = posY - ph + 56;
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
    const clamped = clampToViewport(origX + dx, origY + dy, 56, 56);
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
    const clamped = clampToViewport(posX, posY, 56, 56);
    posX = clamped.x; posY = clamped.y;
    fab.style.left = posX + 'px';
    fab.style.top = posY + 'px';
    if (isOpen) positionPanel();
  });

  // ===== Firestore realtime =====
  const msgsEl = document.getElementById('rc-msgs');
  function scrollBottom() {
    requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; });
  }

  function renderMsg(m) {
    const div = document.createElement('div');
    if (m.sys) {
      div.className = 'rc-msg sys';
      div.textContent = m.text;
    } else {
      div.className = 'rc-msg' + (m.uid === uid ? ' me' : '');
      div.innerHTML = `<div class="rc-name">${esc(m.name)}</div><div class="rc-bubble">${esc(m.text)}</div>`;
    }
    msgsEl.appendChild(div);
  }

  const chatCol = collection(db, 'rooms', roomId, 'chat');
  const q = query(chatCol, orderBy('createdAt', 'desc'), limit(50));
  let firstLoad = true;
  if (_chatUnsub) _chatUnsub();
  _chatUnsub = onSnapshot(q, (snap) => {
    if (firstLoad) {
      msgsEl.innerHTML = '';
      const all = snap.docs.slice().reverse();
      all.forEach(d => renderMsg(d.data()));
      firstLoad = false;
      scrollBottom();
      return;
    }
    const added = snap.docChanges().filter(c => c.type === 'added').map(c => c.doc);
    added.forEach(d => {
      const m = d.data();
      renderMsg(m);
      if (m.uid !== uid) {
        unread++;
        setBadge();
      }
    });
    scrollBottom();
  });

  async function sendMsg() {
    const input = document.getElementById('rc-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await addDoc(chatCol, {
        uid,
        name: getName ? getName() : 'Người chơi',
        text: text.slice(0, 200),
        createdAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  }
  document.getElementById('rc-send').onclick = sendMsg;
  document.getElementById('rc-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMsg();
  });
}

export function destroyRoomChat() {
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  document.getElementById('rc-fab')?.remove();
  document.getElementById('rc-panel')?.remove();
  document.getElementById('rc-style')?.remove();
  _initialized = false;
}
