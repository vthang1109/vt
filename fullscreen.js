/**
 * fullscreen.js — VTWorld Fullscreen & Pull-to-refresh Prevention Utility
 * 
 * Usage: Include this script in any game HTML page.
 * It automatically:
 * 1. Prevents pull-to-refresh (overscroll + touchmove prevention)
 * 2. Adds a floating fullscreen toggle button
 * 3. Handles Fullscreen API across browsers
 */

(function() {
  'use strict';

  // ========== 1. CSS: Prevent pull-to-refresh & scroll ==========
  const style = document.createElement('style');
  style.textContent = `
    /* Prevent pull-to-refresh on all game pages */
    html, body {
      overscroll-behavior: none !important;
      -webkit-overflow-scrolling: auto;
      overflow: hidden;
      height: 100%;
      width: 100%;
    }
    /* Game containers must NOT scroll */
    .game-wrap, [class$="-container"], [class*="-container"],
    .ms-container, .pong-container, .bb-play-area,
    .g2048-container, .fs-canvas-wrap {
      overscroll-behavior: none !important;
      touch-action: none;
    }
    /* Fullscreen button styles */
    .vt-fs-btn {
      position: fixed;
      bottom: 70px;
      right: 14px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(56,189,248,0.3);
      background: rgba(4,20,40,0.92);
      color: #7dd3fc;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9998;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.25s;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      line-height: 1;
    }
    .vt-fs-btn:hover {
      border-color: rgba(56,189,248,0.6);
      background: rgba(56,189,248,0.15);
      transform: scale(1.1);
    }
    .vt-fs-btn.fs-active {
      border-color: rgba(52,211,153,0.4);
      color: #34d399;
    }
    /* Fullscreen exit hint overlay */
    .vt-fs-hint {
      position: fixed;
      top: 0; left: 0; right: 0;
      padding: 10px;
      text-align: center;
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      background: rgba(0,0,0,0.3);
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s;
    }
    .vt-fs-hint.show {
      opacity: 1;
    }
    /* When in fullscreen, hide top-nav and bottom-nav */
    .vt-fs-active .vt-top-nav,
    .vt-fs-active .vt-bottom-nav {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // ========== 2. JS: Prevent pull-to-refresh ==========
  let lastTouchY = 0;
  let preventPullRefresh = true;

  // Block pull-to-refresh: prevent default on touchmove when at top
  document.addEventListener('touchmove', function(e) {
    if (!preventPullRefresh) return;
    // Always prevent to block pull-to-refresh
    e.preventDefault();
  }, { passive: false });

  // Also block scroll during touch
  document.addEventListener('touchstart', function(e) {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  // Prevent wheel/trackpad pull-to-refresh
  document.addEventListener('wheel', function(e) {
    if (e.deltaY < 0 && window.scrollY <= 0) {
      e.preventDefault();
    }
  }, { passive: false });

  // ========== 3. Fullscreen Toggle Button ==========
  function createFullscreenButton() {
    const btn = document.createElement('button');
    btn.className = 'vt-fs-btn';
    btn.id = 'vt-fs-btn';
    // SVG icons for fullscreen (expand) and fullscreen-exit (compress)
    const svgEnter = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    const svgExit  = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
    btn.innerHTML = svgEnter;
    btn.title = 'Toàn màn hình';
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.dataset.svgEnter = svgEnter;
    btn.dataset.svgExit = svgExit;
    document.body.appendChild(btn);

    // Update icon based on fullscreen state
    function updateIcon() {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btn.innerHTML = isFS ? btn.dataset.svgExit : btn.dataset.svgEnter;
      btn.classList.toggle('fs-active', isFS);
      btn.title = isFS ? 'Thoát toàn màn hình' : 'Toàn màn hình';
    }

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon);

    // Toggle fullscreen on click
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFullscreen();
    });

    return btn;
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);

    if (isFS) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } else {
      // Enter fullscreen
      try {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      } catch(e) {
        console.warn('Fullscreen not supported:', e);
      }
    }
  }

  // ========== 4. Add hint overlay when entering fullscreen ==========
  function createHintOverlay() {
    const hint = document.createElement('div');
    hint.className = 'vt-fs-hint';
    hint.id = 'vt-fs-hint';
    const hintSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    hint.innerHTML = hintSvg + 'Vuốt xuống từ cạnh trên để thoát toàn màn hình';
    document.body.appendChild(hint);

    // Show hint briefly when entering fullscreen
    document.addEventListener('fullscreenchange', function() {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFS) {
        hint.classList.add('show');
        setTimeout(() => hint.classList.remove('show'), 3000);
        // Add class to body for CSS selectors
        document.body.classList.add('vt-fs-active');
      } else {
        document.body.classList.remove('vt-fs-active');
      }
    });
    document.addEventListener('webkitfullscreenchange', function() {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFS) {
        document.body.classList.add('vt-fs-active');
      } else {
        document.body.classList.remove('vt-fs-active');
      }
    });

    return hint;
  }

  // ========== 5. Keyboard shortcut: F key for fullscreen ==========
  document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') {
      // Only if not typing in an input
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleFullscreen();
      }
    }
    // Escape already exits fullscreen natively
    if (e.key === 'Escape') {
      // Just update icon - browser handles the exit
    }
  });

  // ========== 6. Initialize ==========
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createFullscreenButton();
      createHintOverlay();
    });
  } else {
    createFullscreenButton();
    createHintOverlay();
  }

  // Export for programmatic use
  window.FS = {
    toggle: toggleFullscreen,
    isFullscreen: function() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    enter: function() {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    },
    exit: function() {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    },
    // Allow games to temporarily disable pull-to-refresh prevention if needed
    setPreventPullRefresh: function(val) {
      preventPullRefresh = val;
    }
  };

})();
