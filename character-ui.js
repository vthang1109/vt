// character-ui.js
import {
  OUTFIT_CATALOG, SLOT_META, ITEM_TIERS,
  state, findInSlot, getTierById,
  saveEquipped, buyItem, gachaRoll, renderChibiTo
} from './character.js';

let activeTab = 'head';
let pending = { ...state.equipped };

// ── Đăng ký callback để character.js báo khi state thay đổi ──
window._charUIUpdate = () => {
  pending = { ...state.equipped };
  const previewDiv = document.getElementById('wardrobePreview');
  if (previewDiv) {
    renderChibiTo(previewDiv, pending);
  }
  const itemsDiv = document.getElementById('wardrobeItems');
  if (itemsDiv) renderItems();
};

export function initWardrobeUI(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="wardrobe-preview" id="wardrobePreview" style="height:250px;">
      <div class="preview-placeholder">
        <span>👤</span>
        Đang tải nhân vật...
      </div>
    </div>
    <div class="wardrobe-tabs" id="wardrobeTabs"></div>
    <div class="wardrobe-items" id="wardrobeItems" style="max-height:350px;overflow-y:auto;"></div>
    <button id="wardrobeSave" style="margin-top:12px;width:100%;padding:12px;background:#22c55e;border:none;color:#fff;font-weight:900;border-radius:10px;font-family:'Orbitron';cursor:pointer;">💾 LƯU & QUAY LẠI</button>
  `;

  const previewDiv = document.getElementById('wardrobePreview');
  const tabsDiv = document.getElementById('wardrobeTabs');
  const itemsDiv = document.getElementById('wardrobeItems');
  document.getElementById('wardrobeSave').addEventListener('click', async () => {
    try {
      await saveEquipped(pending);
      history.back();
    } catch(e) { alert(e.message); }
  });

  function refreshPreview() {
    const placeholder = previewDiv.querySelector('.preview-placeholder');
    if (placeholder) placeholder.remove();
    renderChibiTo(previewDiv, pending);
  }

  function renderTabs() {
    tabsDiv.innerHTML = Object.entries(SLOT_META).map(([k,v]) =>
      `<button class="wardrobe-tab ${activeTab===k?'active':''}" data-tab="${k}">${v.icon} ${v.label}</button>`
    ).join('');
    tabsDiv.querySelectorAll('.wardrobe-tab').forEach(b => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        renderTabs();
        renderItems();
      });
    });
  }

  function renderItems() {
    const items = OUTFIT_CATALOG[activeTab] || [];
    itemsDiv.innerHTML = items.map(item => {
      const owned = state.owned.includes(item.id);
      const equip = pending[activeTab] === item.id;
      const locked = !owned && item.source !== 'free';
      const tier = Object.values(ITEM_TIERS).find(t => t.id === item.tier) || ITEM_TIERS.NUB;
      const imgPath = `assets/character/${activeTab}/${item.id}.png`;

      return `
        <div class="wardrobe-item ${equip?'equipped':''} ${locked?'locked':''}"
             data-id="${item.id}"
             style="border-color: ${owned ? tier.color : 'rgba(255,255,255,0.1)'};">
          <span class="item-tier-badge" style="background:${tier.color};color:#000;position:absolute;top:4px;left:4px;font-size:9px;font-weight:900;padding:1px 5px;border-radius:4px;">${tier.short}</span>
          ${!owned && item.source==='shop' ? `<span class="item-source shop">${item.price}⭐</span>` : ''}
          ${!owned && item.source==='gacha' ? `<span class="item-source gacha">🎲</span>` : ''}
          <div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <img src="${imgPath}" style="max-width:100%;max-height:100%;object-fit:contain;${locked?'filter:grayscale(1);opacity:.5':''}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <span style="font-size:28px;display:none;">👕</span>
          </div>
          <span class="item-name" style="color:${owned ? tier.color : '#4a7a9b'};">${item.name}</span>
        </div>`;
    }).join('');

    itemsDiv.querySelectorAll('.wardrobe-item').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const item = findInSlot(activeTab, id);
        if (!item) return;
        if (state.owned.includes(id)) {
          pending[activeTab] = id;
          refreshPreview();
          renderItems();
          return;
        }
        if (item.source === 'shop') {
          if (!confirm(`Mua "${item.name}" giá ${item.price}⭐?`)) return;
          try {
            await buyItem(item);
            state.owned.push(id);
            pending[activeTab] = id;
            refreshPreview();
            renderItems();
          } catch(e) { alert(e.message); }
        } else {
          alert('Chỉ có từ Gacha!');
        }
      });
    });
  }

  // Initial render
  refreshPreview();
  renderTabs();
  renderItems();
}