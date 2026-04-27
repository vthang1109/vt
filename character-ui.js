// character-ui.js
import {
  OUTFIT_CATALOG, SLOT_META,
  state, findInSlot,
  saveEquipped, renderChibiTo, gachaItem
} from './character.js';

let activeSystem = 'real';
let activeSlot = 'head';
let pending = {
  real: { ...state.equipped.real },
  fims: { ...state.equipped.fims },
};

window._charUIUpdate = () => {
  pending.real = { ...state.equipped.real };
  pending.fims = { ...state.equipped.fims };
  activeSystem = state.system;
  refreshPreview();
  renderItems();
  renderTabs();
  renderSystemSwitch();
};

function refreshPreview() {
  const previewDiv = document.getElementById('modalCharPreview');
  if (!previewDiv) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderChibiTo(previewDiv, activeSystem, pending[activeSystem]);
    });
  });
}

function renderSystemSwitch() {
  const switchDiv = document.getElementById('modalSystemSwitch');
  if (!switchDiv) return;
  switchDiv.innerHTML = Object.entries(OUTFIT_CATALOG).map(([key, sys]) =>
    `<button style="flex:1;padding:10px;border-radius:10px;border:2px solid ${activeSystem===key?'#38bdf8':'rgba(56,189,248,0.2)'};background:${activeSystem===key?'rgba(56,189,248,0.15)':'rgba(15,23,42,0.7)'};color:${activeSystem===key?'#38bdf8':'#94a3b8'};font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;" data-system="${key}">${sys.icon} ${sys.label}</button>`
  ).join('');
  switchDiv.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      activeSystem = b.dataset.system;
      activeSlot = 'head';
      refreshPreview();
      renderItems();
      renderTabs();
      renderSystemSwitch();
    });
  });
}

function renderTabs() {
  const tabsDiv = document.getElementById('modalWardrobeTabs');
  if (!tabsDiv) return;
  tabsDiv.innerHTML = Object.entries(SLOT_META).map(([k, v]) =>
    `<button style="flex:1;min-width:50px;padding:8px 6px;border-radius:10px;border:1px solid rgba(56,189,248,0.15);background:transparent;color:#94a3b8;font-size:11px;font-weight:800;cursor:pointer;text-align:center;transition:all 0.2s;font-family:'Nunito',sans-serif;${activeSlot===k?'background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.4);color:#38bdf8;':''}" data-slot="${k}">${v.icon} ${v.label}</button>`
  ).join('');
  tabsDiv.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      activeSlot = b.dataset.slot;
      renderTabs();
      renderItems();
    });
  });
}

function renderItems() {
  const itemsDiv = document.getElementById('modalWardrobeItems');
  if (!itemsDiv) return;

  const owned = state.ownedItems[activeSystem]?.[activeSlot] || [];
  const allItems = OUTFIT_CATALOG[activeSystem]?.slots[activeSlot] || [];
  const availableItems = allItems.filter(item => owned.includes(item.id));

  if (availableItems.length === 0) {
    itemsDiv.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#4a7a9b;padding:20px;font-weight:600;font-size:13px;">Chưa sở hữu vật phẩm nào</div>';
    return;
  }

  itemsDiv.innerHTML = availableItems.map(item => {
    const equip = pending[activeSystem][activeSlot] === item.id;
    const imgPath = `assets/character/${activeSystem}/${activeSlot}/${item.id}.png`;
    return `
      <div style="aspect-ratio:1;background:rgba(15,23,42,0.7);border:2px solid ${equip?'#38bdf8':'rgba(56,189,248,0.15)'};border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;position:relative;padding:6px;${equip?'box-shadow:0 0 12px rgba(56,189,248,0.3);':''}" data-id="${item.id}">
        <img src="${imgPath}" style="width:48px;height:48px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span style="font-size:30px;display:none;">👕</span>
        <span style="font-size:10px;color:#94a3b8;text-align:center;font-weight:700;line-height:1.2;">${item.name}</span>
        ${equip ? '<span style="position:absolute;bottom:4px;right:4px;font-size:12px;color:#38bdf8;">✓</span>' : ''}
      </div>`;
  }).join('');

  itemsDiv.querySelectorAll('div[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      pending[activeSystem][activeSlot] = id;
      refreshPreview();
      renderItems();
    });
  });
}

// ── Modal ──────────────────────────────────────────────────
export function openOutfitModal() {
  activeSystem = state.system;
  pending.real = { ...state.equipped.real };
  pending.fims = { ...state.equipped.fims };

  const overlay = document.getElementById('outfitModalOverlay');
  if (!overlay) return;
  overlay.classList.add('open');

  document.getElementById('modalSaveBtn').onclick = async () => {
    try {
      state.system = activeSystem;
      await saveEquipped(activeSystem, pending[activeSystem]);
      overlay.classList.remove('open');
    } catch (e) { alert(e.message); }
  };

  setTimeout(() => {
    refreshPreview();
    renderSystemSwitch();
    renderTabs();
    renderItems();
  }, 100);
}

export function closeOutfitModal() {
  document.getElementById('outfitModalOverlay')?.classList.remove('open');
}