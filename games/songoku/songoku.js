/* ===============================================
   ⚡ DRAGON BALL Z 2D FIGHTER — songoku.js
   =============================================== */

// ─── roundRect polyfill for older browsers ───
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = Math.min(typeof radii === 'number' ? radii : (radii ? radii[0] || 0 : 0), w/2, h/2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

const Game = (() => {
  'use strict';

  // ─── CONSTANTS ───
  const GROUND_Y_RATIO = 0.78;  // % of canvas height
  const GRAVITY = 0.7;
  const FRICTION = 0.85;
  const STAGE_W_RATIO = 2.4;    // stage width relative to canvas

  // ─── CHARACTER DEFINITIONS ───
  const CHARACTERS = [
    {
      id:'goku', name:'Songoku', emoji:'🦁', color:'#f97316', aura:'#22d3ee',
      hp:1200, speed:5.2, atk:35, def:30,
      skills:[
        {name:'Cước', dmg:35, ki:8, cd:40, range:50, type:'melee', icon:'🦶', desc:'Đá tung đối thủ'},
        {name:'Kamehameha', dmg:55, ki:20, cd:80, range:300, type:'ranged', icon:'🔵', desc:'Sóng khí hủy diệt'},
        {name:'Siêu Saiyan 3', dmg:90, ki:40, cd:180, range:120, type:'ult', icon:'⭐', desc:'Bùng nổ sức mạnh tối thượng'},
      ]
    },
    {
      id:'vegeta', name:'Vegeta', emoji:'👑', color:'#7c3aed', aura:'#a855f7',
      hp:1100, speed:5.5, atk:40, def:25,
      skills:[
        {name:'Đấm', dmg:40, ki:8, cd:35, range:45, type:'melee', icon:'👊', desc:'Cú đấm uy lực'},
        {name:'Galick Gun', dmg:60, ki:22, cd:85, range:280, type:'ranged', icon:'🟣', desc:'Pháo sáng tím'},
        {name:'Big Bang Attack', dmg:95, ki:45, cd:200, range:130, type:'ult', icon:'💫', desc:'Vụ nổ Big Bang'},
      ]
    },
    {
      id:'gohan', name:'Gohan', emoji:'🦊', color:'#34d399', aura:'#10b981',
      hp:1300, speed:4.8, atk:30, def:40,
      skills:[
        {name:'Chém', dmg:30, ki:6, cd:30, range:50, type:'melee', icon:'🗡️', desc:'Đòn chém nhanh'},
        {name:'Masenko', dmg:50, ki:18, cd:75, range:270, type:'ranged', icon:'🟢', desc:'Sóng năng lượng xanh'},
        {name:'Tiềm Năng', dmg:85, ki:38, cd:190, range:110, type:'ult', icon:'🌟', desc:'Giải phóng tiềm năng'},
      ]
    },
    {
      id:'frieza', name:'Frieza', emoji:'👽', color:'#ec4899', aura:'#f43f5e',
      hp:1000, speed:6.0, atk:45, def:20,
      skills:[
        {name:'Móng vuốt', dmg:38, ki:7, cd:32, range:48, type:'melee', icon:'🔪', desc:'Cào xé đối thủ'},
        {name:'Death Beam', dmg:65, ki:24, cd:90, range:320, type:'ranged', icon:'🔴', desc:'Tia tử thần'},
        {name:'Hủy Diệt', dmg:100, ki:50, cd:220, range:140, type:'ult', icon:'💀', desc:'Chùm hủy diệt tử thần'},
      ]
    },
    {
      id:'trunks', name:'Trunks', emoji:'⚡', color:'#06b6d4', aura:'#22d3ee',
      hp:1150, speed:5.5, atk:38, def:28,
      skills:[
        {name:'Chém kiếm', dmg:36, ki:7, cd:33, range:52, type:'melee', icon:'⚔️', desc:'Nhát kiếm chớp nhoáng'},
        {name:'Burning Attack', dmg:58, ki:20, cd:82, range:290, type:'ranged', icon:'🟡', desc:'Đòn tấn công cháy bỏng'},
        {name:'Thanh Gươm', dmg:92, ki:42, cd:195, range:125, type:'ult', icon:'🗡️', desc:'Chém xuyên không gian'},
      ]
    },
    {
      id:'cell', name:'Cell', emoji:'🦎', color:'#22c55e', aura:'#16a34a',
      hp:1400, speed:4.5, atk:32, def:35,
      skills:[
        {name:'Đuôi', dmg:33, ki:6, cd:30, range:55, type:'melee', icon:'🔄', desc:'Quật đuôi'},
        {name:'Kamehameha', dmg:52, ki:19, cd:78, range:260, type:'ranged', icon:'🟠', desc:'Sóng khí bản sao'},
        {name:'Tự Hủy', dmg:88, ki:44, cd:210, range:150, type:'ult', icon:'💥', desc:'Vụ nổ hủy diệt toàn bộ'},
      ]
    }
  ];

  // ─── STATE ───
  let cfg = {
    mode:'',           // '1v1' | '2p' | 'train'
    p1Char:null,
    p2Char:null,
    joystickType:'fixed',  // 'fixed' | 'float'
    vibration:true,
    sfx:true,
  };

  // Canvas
  let cv, ctx, W, H, GROUND_Y, STAGE_W, STAGE_LEFT;
  let fighters = [];
  let particles = [];
  let hitsparks = [];
  let projectiles = [];
  let stageEffects = [];

  // Key states
  const keys = { left:false, right:false, up:false, down:false };
  const p1keys = { left:false, right:false, up:false, down:false, basic:false, skill1:false, skill2:false, skill3:false };
  const p2keys = { left:false, right:false, up:false, down:false, basic:false, skill1:false, skill2:false, skill3:false };

  // Joystick
  let jsActive = false, jsTouched = false;
  let jsCenterX = 0, jsCenterY = 0;
  let jsDX = 0, jsDY = 0;
  let jsEl, jsKnob, jsZone;

  // Game state
  let gameRunning = false;
  let gameFrame = 0;
  let countdownVal = 0;
  let countdownActive = false;
  let matchOver = false;
  let animFrameId = null;
  let bgParticles = [];

  // Screen effects
  let screenShake = 0;       // shake intensity (decays)
  let screenFlash = 0;       // flash overlay alpha
  let screenFlashColor = '#fff';

  // ─── DOM REFS ───
  let modeScreen, charScreen, battleScreen, resultOverlay, resultText, resultSub;
  let csGrid, csSub, csFightBtn, csP1Ind;
  let countdownOverlay, countdownText;
  let settingsPanel, settingsBtn, jsTypeTog, vibTog, sfxTog;
  let joystickZone, actionBtns;

  // ─── INIT ───
  function init() {
    modeScreen = document.getElementById('modeScreen');
    charScreen = document.getElementById('charSelectScreen');
    battleScreen = document.getElementById('battleScreen');
    resultOverlay = document.getElementById('result-overlay');
    resultText = document.getElementById('result-text');
    resultSub = document.getElementById('result-sub');
    csGrid = document.getElementById('csGrid');
    csSub = document.getElementById('csSub');
    csFightBtn = document.getElementById('csFightBtn');
    csP1Ind = document.getElementById('csPlayerIndicator');
    countdownOverlay = document.getElementById('countdown-overlay');
    countdownText = document.getElementById('countdown-text');
    settingsPanel = document.getElementById('settings-panel');
    settingsBtn = document.getElementById('settings-btn');
    jsTypeTog = document.getElementById('jsTypeToggle');
    vibTog = document.getElementById('vibToggle');
    sfxTog = document.getElementById('sfxToggle');
    joystickZone = document.getElementById('joystick-zone');
    actionBtns = document.getElementById('action-btns');
    jsEl = document.getElementById('joystick-zone');
    jsKnob = document.getElementById('joystick-knob');

    cv = document.getElementById('battleCanvas');
    ctx = cv.getContext('2d');

    // Background particles
    initBGParticles();

    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Joystick
    setupJoystick();

    // Character grid
    renderCharGrid();

    // Start bg anim
    animBgLoop();
  }

  // ─── BACKGROUND PARTICLES ───
  function initBGParticles() {
    bgParticles = [];
    for (let i=0; i<40; i++) {
      bgParticles.push({
        x:Math.random()*window.innerWidth,
        y:Math.random()*window.innerHeight,
        vx:(Math.random()-0.5)*0.3,
        vy:(Math.random()-0.5)*0.3,
        r:Math.random()*2+0.5,
        a:Math.random()*0.3+0.1
      });
    }
  }

  function animBgLoop() {
    const bgCv = document.getElementById('bg-canvas');
    if (!bgCv) return;
    const bgCtx = bgCv.getContext('2d');
    bgCv.width = window.innerWidth;
    bgCv.height = window.innerHeight;
    bgCtx.fillStyle = '#020617';
    bgCtx.fillRect(0,0,bgCv.width,bgCv.height);
    bgParticles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = bgCv.width;
      if (p.x > bgCv.width) p.x = 0;
      if (p.y < 0) p.y = bgCv.height;
      if (p.y > bgCv.height) p.y = 0;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      bgCtx.fillStyle = `rgba(34,211,238,${p.a})`;
      bgCtx.fill();
    });
    requestAnimationFrame(animBgLoop);
  }

  // ─── MODE SELECT ───
  function selectMode(mode) {
    cfg.mode = mode;
    cfg.p1Char = null;
    cfg.p2Char = null;
    modeScreen.classList.remove('active');
    charScreen.classList.add('active');
    updateCharSelect();
  }

  function backToMode() {
    charScreen.classList.remove('active');
    modeScreen.classList.add('active');
  }

  // ─── CHARACTER SELECT ───
  function renderCharGrid() {
    csGrid.innerHTML = CHARACTERS.map(c => `
      <div class="cs-card" data-id="${c.id}" onclick="Game.selectChar('${c.id}')">
        <div class="cs-avatar" style="background:${c.color}22;border-color:${c.color}44">${c.emoji}</div>
        <div class="cs-name">${c.name}</div>
        <div class="cs-stats">
          <span>❤️${c.hp}</span>
          <span>⚡${c.speed.toFixed(1)}</span>
          <span>🗡️${c.atk}</span>
          <span>🛡️${c.def}</span>
        </div>
      </div>
    `).join('');
  }

  let selectStep = 1; // 1 = P1, 2 = P2 (only in 2p)
  function updateCharSelect() {
    selectStep = 1;
    if (cfg.mode === '2p') {
      csP1Ind.innerHTML = '<span class="cs-pi-p1" style="opacity:1">P1 ●</span> <span class="cs-pi-p2" style="opacity:0.4">P2 ○</span>';
      csSub.textContent = 'Chọn nhân vật cho Người Chơi 1';
    } else {
      csP1Ind.innerHTML = '<span class="cs-pi-p1" style="opacity:1">P1 ●</span> <span class="cs-pi-p2" style="opacity:0.4">CPU ○</span>';
      csSub.textContent = 'Chọn nhân vật của bạn';
    }
    // Clear selections
    document.querySelectorAll('.cs-card').forEach(el => {
      el.classList.remove('p1-selected','p2-selected');
    });
    csFightBtn.disabled = true;
  }

  function selectChar(id) {
    const char = CHARACTERS.find(c => c.id === id);
    if (!char) return;

    if (selectStep === 1) {
      cfg.p1Char = char;
      document.querySelectorAll('.cs-card').forEach(el => {
        el.classList.remove('p1-selected');
        if (el.dataset.id === id) el.classList.add('p1-selected');
      });
      if (cfg.mode === '2p') {
        selectStep = 2;
        csP1Ind.innerHTML = '<span class="cs-pi-p1" style="opacity:0.4">P1 ●</span> <span class="cs-pi-p2" style="opacity:1">P2 ○</span>';
        csSub.textContent = 'Chọn nhân vật cho Người Chơi 2';
      } else if (cfg.mode === '1v1') {
        // Random CPU character (not same as player)
        const others = CHARACTERS.filter(c => c.id !== id);
        cfg.p2Char = others[Math.floor(Math.random() * others.length)];
        // Show CPU selection
        document.querySelectorAll('.cs-card').forEach(el => {
          if (el.dataset.id === cfg.p2Char.id) el.classList.add('p2-selected');
        });
        csFightBtn.disabled = false;
      } else {
        // Training - pick training dummy
        cfg.p2Char = CHARACTERS.find(c => c.id === 'cell');
        cfg.p2Char.isDummy = true;
        document.querySelectorAll('.cs-card').forEach(el => {
          if (el.dataset.id === 'cell') el.classList.add('p2-selected');
        });
        csFightBtn.disabled = false;
      }
    } else if (selectStep === 2 && cfg.mode === '2p') {
      if (char.id === cfg.p1Char.id) return; // Can't same char in 2p
      cfg.p2Char = char;
      document.querySelectorAll('.cs-card').forEach(el => {
        el.classList.remove('p2-selected');
        if (el.dataset.id === id) el.classList.add('p2-selected');
      });
      csFightBtn.disabled = false;
    }
  }

  // ─── START BATTLE ───
  function startBattle() {
    if (!cfg.p1Char || !cfg.p2Char) return;
    charScreen.classList.remove('active');

    // Setup canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create fighters
    fighters = [];
    const p1 = createFighter(cfg.p1Char, 1);
    const p2 = createFighter(cfg.p2Char, 2);
    fighters.push(p1, p2);

    // Reset
    particles = [];
    hitsparks = [];
    projectiles = [];
    matchOver = false;
    gameFrame = 0;

    // Show battle screen & controls
    battleScreen.classList.add('active');
    joystickZone.classList.add('active');
    actionBtns.classList.add('active');
    settingsBtn.classList.add('active');

    // Start countdown
    startCountdown();
  }

  function resizeCanvas() {
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    W = cv.width;
    H = cv.height;
    GROUND_Y = H * GROUND_Y_RATIO;
    STAGE_W = W * STAGE_W_RATIO;
    STAGE_LEFT = (W - STAGE_W) / 2;
    if (STAGE_LEFT < 0) STAGE_LEFT = 0;
  }

  // ─── FIGHTER FACTORY ───
  function createFighter(charData, player) {
    const isP1 = player === 1;
    const startX = isP1 ? W*0.25 : W*0.75;
    return {
      char: charData,
      player,
      x: startX,
      y: GROUND_Y - 60,
      vx: 0,
      vy: 0,
      w: 36,
      h: 64,
      facing: isP1 ? 1 : -1,
      onGround: true,
      hp: charData.hp,
      maxHp: charData.hp,
      ki: 50,
      maxKi: 100,
      speed: charData.speed,
      atk: charData.atk,
      def: charData.def,
      // State
      state:'idle', // idle, walk, jump, attack, hit, block, skill
      stateTimer:0,
      animFrame:0,
      invincible:0,
      comboCount:0,
      comboTimer:0,
      // Skills cooldown
      skillCD:[0,0,0],
      // Visual
      flash:0,
      auraPulse:0,
      // Expression popup (emoji above head)
      expression:'',
      expressionTimer:0,
      // AI
      aiTimer:0,
      aiAction:'',
      isDummy: charData.isDummy || false,
    };
  }

  // ─── COUNTDOWN ───
  function startCountdown() {
    countdownVal = 3;
    countdownActive = true;
    countdownOverlay.classList.add('active');
    countdownText.textContent = '3';
    gameRunning = false;
    runCountdown();
  }

  function runCountdown() {
    if (!countdownActive) return;
    if (countdownVal > 0) {
      countdownText.textContent = countdownVal;
      // Animate
      countdownText.style.animation = 'none';
      requestAnimationFrame(() => {
        countdownText.style.animation = 'cdPulse 0.5s ease-out';
      });
      countdownVal--;
      setTimeout(runCountdown, 800);
    } else {
      countdownText.textContent = 'GO!';
      countdownText.style.animation = 'cdPulse 0.4s ease-out';
      setTimeout(() => {
        countdownOverlay.classList.remove('active');
        gameRunning = true;
        countdownActive = false;
        gameLoop();
      }, 500);
    }
  }

  // ─── GAME LOOP ───
  function gameLoop() {
    if (!gameRunning && matchOver) return;
    if (gameRunning) update();
    draw();
    if (gameRunning || matchOver) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ─── UPDATE ───
  function update() {
    gameFrame++;

    const p1 = fighters[0];
    const p2 = fighters[1];

    // Handle input
    handleInput(p1);
    if (cfg.mode === '1v1') {
      handleAI(p2, p1);
    } else if (cfg.mode === '2p') {
      handleInput2P(p2);
    } else {
      // Training - dummy stands still, sometimes attacks back
      if (gameFrame % 180 === 0 && Math.random() > 0.4) {
        performAction(p2, 'skill1', p1);
      }
    }

    // Update fighters
    fighters.forEach(f => updateFighter(f, fighters));

    // Check hit collisions
    checkHits(p1, p2);

    // Update projectiles
    updateProjectiles();

    // Update particles
    updateParticles();
    updateHitSparks();

    // Decay screen effects
    if (screenShake > 0) screenShake *= 0.88;
    if (screenShake < 0.5) screenShake = 0;
    if (screenFlash > 0) screenFlash -= 0.03;
    if (screenFlash < 0) screenFlash = 0;

    // Update fighter expressions
    fighters.forEach(f => {
      if (f.expressionTimer > 0) {
        f.expressionTimer--;
        if (f.expressionTimer <= 0) f.expression = '';
      }
    });

    // Check death
    if (!matchOver) {
      if (p1.hp <= 0 || p2.hp <= 0) {
        endMatch();
      }
    }

    // Ki regen
    p1.ki = Math.min(p1.maxKi, p1.ki + 0.08);
    p2.ki = Math.min(p2.maxKi, p2.ki + 0.08);
  }

  // ─── HANDLE INPUT P1 ───
  function handleInput(f) {
    if (!f || f.hp <= 0) return;

    // Movement from joystick or keyboard
    let moveX = 0;
    if (p1keys.left || keys.left) moveX = -1;
    else if (p1keys.right || keys.right) moveX = 1;

    // Joystick analog
    if (jsActive) {
      const dist = Math.sqrt(jsDX*jsDX + jsDY*jsDY);
      if (dist > 0.2) {
        moveX = jsDX / (jsZone.offsetWidth/2);
        moveX = Math.max(-1, Math.min(1, moveX));
      }
    }

    if (moveX !== 0) {
      f.vx += moveX * f.speed * 0.3;
      f.facing = moveX > 0 ? 1 : -1;
    }

    // Jump
    if (f.onGround && (p1keys.up || keys.up || jsDY < -0.3)) {
      f.vy = -12;
      f.onGround = false;
      spawnParticles(f.x, f.y + f.h, 8, '#94a3b8');
    }

    // Actions
    if (p1keys.basic) {
      p1keys.basic = false;
      performAction(f, 'basic', fighters[1]);
    }
    if (p1keys.skill1) {
      p1keys.skill1 = false;
      performAction(f, 'skill1', fighters[1]);
    }
    if (p1keys.skill2) {
      p1keys.skill2 = false;
      performAction(f, 'skill2', fighters[1]);
    }
    if (p1keys.skill3) {
      p1keys.skill3 = false;
      performAction(f, 'skill3', fighters[1]);
    }
  }

  // ─── HANDLE INPUT P2 (Keyboard only) ───
  function handleInput2P(f) {
    if (!f || f.hp <= 0) return;
    let moveX = 0;
    if (p2keys.left) moveX = -1;
    else if (p2keys.right) moveX = 1;

    if (moveX !== 0) {
      f.vx += moveX * f.speed * 0.3;
      f.facing = moveX > 0 ? 1 : -1;
    }
    if (f.onGround && p2keys.up) {
      f.vy = -12;
      f.onGround = false;
    }
    if (p2keys.basic) { p2keys.basic = false; performAction(f, 'basic', fighters[0]); }
    if (p2keys.skill1) { p2keys.skill1 = false; performAction(f, 'skill1', fighters[0]); }
    if (p2keys.skill2) { p2keys.skill2 = false; performAction(f, 'skill2', fighters[0]); }
    if (p2keys.skill3) { p2keys.skill3 = false; performAction(f, 'skill3', fighters[0]); }
  }

  // ─── KEYBOARD ───
  function onKeyDown(e) {
    const k = e.key;
    // P1
    if (k === 'a' || k === 'A') p1keys.left = true;
    if (k === 'd' || k === 'D') p1keys.right = true;
    if (k === 'w' || k === 'W') { p1keys.up = true; e.preventDefault(); }
    if (k === 's' || k === 'S') p1keys.down = true;
    if (k === 'j' || k === 'J') { p1keys.basic = true; e.preventDefault(); }
    if (k === 'k' || k === 'K') { p1keys.skill1 = true; e.preventDefault(); }
    if (k === 'l' || k === 'L') { p1keys.skill2 = true; e.preventDefault(); }
    if (k === 'u' || k === 'U') { p1keys.skill3 = true; e.preventDefault(); }
    // P2
    if (k === 'ArrowLeft') p2keys.left = true;
    if (k === 'ArrowRight') p2keys.right = true;
    if (k === 'ArrowUp') { p2keys.up = true; e.preventDefault(); }
    if (k === 'ArrowDown') p2keys.down = true;
    if (k === '1') { p2keys.basic = true; e.preventDefault(); }
    if (k === '2') { p2keys.skill1 = true; e.preventDefault(); }
    if (k === '3') { p2keys.skill2 = true; e.preventDefault(); }
    if (k === '4') { p2keys.skill3 = true; e.preventDefault(); }
  }

  function onKeyUp(e) {
    const k = e.key;
    if (k === 'a' || k === 'A') p1keys.left = false;
    if (k === 'd' || k === 'D') p1keys.right = false;
    if (k === 'w' || k === 'W') p1keys.up = false;
    if (k === 's' || k === 'S') p1keys.down = false;
    if (k === 'ArrowLeft') p2keys.left = false;
    if (k === 'ArrowRight') p2keys.right = false;
    if (k === 'ArrowUp') p2keys.up = false;
    if (k === 'ArrowDown') p2keys.down = false;
  }

  // ─── ACTION BUTTONS ───
  function pressAction(action) {
    if (!gameRunning) return;
    if (p1keys[action] !== undefined) {
      p1keys[action] = true;
      // Haptic feedback
      if (cfg.vibration && navigator.vibrate) navigator.vibrate(15);
    }
  }
  function releaseAction(action) {
    // handled per-action on press
  }

  // ─── JOYSTICK ───
  function setupJoystick() {
    jsZone = document.getElementById('joystick-zone');

    jsZone.addEventListener('pointerdown', e => {
      e.preventDefault();
      jsTouched = true;
      const rect = jsZone.getBoundingClientRect();
      if (cfg.joystickType === 'float') {
        jsCenterX = e.clientX - rect.left;
        jsCenterY = e.clientY - rect.top;
        jsKnob.style.left = jsCenterX + 'px';
        jsKnob.style.top = jsCenterY + 'px';
        jsKnob.style.transform = 'translate(-50%,-50%)';
      }
      updateJoystick(e);
      jsZone.setPointerCapture(e.pointerId);
    });

    jsZone.addEventListener('pointermove', e => {
      if (!jsTouched) return;
      e.preventDefault();
      updateJoystick(e);
    });

    jsZone.addEventListener('pointerup', e => {
      e.preventDefault();
      jsTouched = false;
      jsActive = false;
      jsDX = 0; jsDY = 0;
      if (cfg.joystickType === 'float') {
        jsKnob.style.left = '50%';
        jsKnob.style.top = '50%';
        jsKnob.style.transform = 'translate(-50%,-50%)';
      } else {
        jsKnob.style.transform = 'translate(-50%,-50%)';
        jsKnob.style.left = '50%';
        jsKnob.style.top = '50%';
      }
    });

    jsZone.addEventListener('pointercancel', e => {
      jsTouched = false;
      jsActive = false;
      jsDX = 0; jsDY = 0;
      jsKnob.style.transform = 'translate(-50%,-50%)';
      jsKnob.style.left = '50%';
      jsKnob.style.top = '50%';
    });
  }

  function updateJoystick(e) {
    const rect = jsZone.getBoundingClientRect();
    const baseCenterX = cfg.joystickType === 'float' ? rect.left + jsCenterX : rect.left + rect.width/2;
    const baseCenterY = cfg.joystickType === 'float' ? rect.top + jsCenterY : rect.top + rect.height/2;
    const maxDist = rect.width / 2 - 16;

    let dx = e.clientX - baseCenterX;
    let dy = e.clientY - baseCenterY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    jsDX = dx / maxDist;
    jsDY = dy / maxDist;
    jsActive = dist > 10;

    jsKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    if (cfg.joystickType === 'float') {
      // Keep knob relative to floating center
      const kx = jsCenterX + dx;
      const ky = jsCenterY + dy;
      jsKnob.style.left = kx + 'px';
      jsKnob.style.top = ky + 'px';
      jsKnob.style.transform = 'translate(-50%,-50%)';
    }
  }

  // ─── SETTINGS ───
  function toggleSettings() {
    settingsPanel.classList.toggle('open');
  }

  function setJoystickType(type) {
    cfg.joystickType = type;
    jsTypeTog.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === type);
    });
    // Reset knob
    jsKnob.style.transform = 'translate(-50%,-50%)';
    jsKnob.style.left = '50%';
    jsKnob.style.top = '50%';
  }

  function setVibration(val) {
    cfg.vibration = val === 'on';
    vibTog.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === val);
    });
  }

  function setSFX(val) {
    cfg.sfx = val === 'on';
    sfxTog.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === val);
    });
  }

  // ─── PERFORM ACTION ───
  function performAction(fighter, action, target) {
    if (!fighter || fighter.hp <= 0 || fighter.invincible > 0) return;
    if (fighter.state === 'hit' || fighter.state === 'skill') return;

    const isSkill = action.startsWith('skill');
    if (isSkill) {
      const idx = parseInt(action.replace('skill','')) - 1;
      if (idx < 0 || idx >= fighter.char.skills.length) return;
      const skill = fighter.char.skills[idx];
      if (fighter.skillCD[idx] > 0) return;
      if (fighter.ki < skill.ki) return;

      // Consume ki
      fighter.ki -= skill.ki;
      fighter.skillCD[idx] = skill.cd;
      fighter.state = 'skill';
      fighter.stateTimer = 15;

      // Visual
      spawnParticles(fighter.x + fighter.w/2, fighter.y + fighter.h/2, 10, fighter.char.aura);
      if (cfg.sfx) playHitSound();

      // Screen shake & flash on skill use
      fighter.expression = idx === 2 ? '💢' : '❗';
      fighter.expressionTimer = 25;
      if (idx === 2) {
        // Ultimate - big screen effects
        screenShake = Math.max(screenShake, 12);
        screenFlash = 1;
        screenFlashColor = fighter.char.aura;
        if (cfg.vibration && navigator.vibrate) navigator.vibrate([30,60,40,60]);
      } else {
        screenShake = Math.max(screenShake, idx === 0 ? 4 : 6);
        screenFlash = 0.4;
        screenFlashColor = fighter.char.aura;
      }

      // Execute skill
      if (skill.type === 'ranged') {
        // Fire projectile
        const dir = fighter.facing;
        projectiles.push({
          x: fighter.x + (dir > 0 ? fighter.w : 0),
          y: fighter.y + fighter.h/2 - 8,
          w: 20, h: 12,
          vx: dir * 8,
          vy: 0,
          dmg: skill.dmg,
          color: fighter.char.aura,
          owner: fighter.player,
          life: 120,
          trail: [],
        });
      } else if (skill.type === 'ult') {
        // Ultimate - big AoE
        const dir = fighter.facing;
        const range = skill.range;
        const cx = fighter.x + fighter.w/2 + dir * range/2;
        spawnParticles(cx, fighter.y + fighter.h/2, 30, '#fbbf24');
        spawnParticles(cx, fighter.y + fighter.h/2, 20, '#ef4444');
        // Check if target in range
        if (target && Math.abs(target.x - fighter.x) < range + 60) {
          const dmg = skill.dmg - target.def * 0.3;
          target.hp -= Math.max(5, dmg);
          target.vy = -8;
          target.vx = dir * 12;
          target.invincible = 15;
          target.state = 'hit';
          target.stateTimer = 12;
          spawnHitspark(target.x + target.w/2, target.y + target.h/2, 15, '#fff');
          // Hit effects
          screenShake = Math.max(screenShake, 10);
          screenFlash = 0.7;
          screenFlashColor = '#fff';
          target.expression = '💥';
          target.expressionTimer = 20;
          if (cfg.vibration && navigator.vibrate) navigator.vibrate([30,50,30]);
        }
      } else {
        // Melee skill
        const dir = fighter.facing;
        if (target && Math.abs(target.x - fighter.x) < skill.range + 30 && Math.abs(target.y - fighter.y) < 70) {
          const dmg = skill.dmg - target.def * 0.3;
          target.hp -= Math.max(5, dmg);
          target.vy = -6;
          target.vx = dir * 8;
          target.invincible = 12;
          target.state = 'hit';
          target.stateTimer = 10;
          spawnHitspark(target.x + target.w/2, target.y + target.h/2, 10, fighter.char.aura);
          // Hit effects
          screenShake = Math.max(screenShake, 5);
          target.expression = '💢';
          target.expressionTimer = 18;
          if (cfg.vibration && navigator.vibrate) navigator.vibrate(20);
        }
      }
    } else if (action === 'basic') {
      // Basic attack
      if (fighter.state === 'attack' || fighter.state === 'hit') return;
      fighter.state = 'attack';
      fighter.stateTimer = 10;

      const dir = fighter.facing;
      const range = 48;
      if (target && Math.abs(target.x - fighter.x) < range + 20 && Math.abs(target.y - fighter.y) < 60) {
        const dmg = fighter.atk - target.def * 0.2;
        target.hp -= Math.max(3, dmg);
        target.vy = -4;
        target.vx = dir * 6;
        target.invincible = 8;
        target.state = 'hit';
        target.stateTimer = 8;
        spawnHitspark(target.x + target.w/2, target.y + target.h/2, 6, '#fbbf24');
        // Hit effects
        screenShake = Math.max(screenShake, 3);
        target.expression = fighter.comboCount > 3 ? '💫' : '💥';
        target.expressionTimer = 15;
        fighter.comboCount++;
        fighter.comboTimer = 30;
        if (cfg.vibration && navigator.vibrate) navigator.vibrate(10);
        if (cfg.sfx) playHitSound();
      }
    }
  }

  // ─── UPDATE FIGHTER ───
  function updateFighter(f, all) {
    if (!f || f.hp <= 0) {
      f.state = 'dead';
      return;
    }

    // Apply physics
    f.vx *= FRICTION;
    f.vy += GRAVITY;
    f.x += f.vx;
    f.y += f.vy;

    // Ground collision
    if (f.y + f.h >= GROUND_Y) {
      f.y = GROUND_Y - f.h;
      f.vy = 0;
      f.onGround = true;
    } else {
      f.onGround = false;
    }

    // Clamp to visible canvas area (prevent fighters from being pushed off-screen)
    const MARGIN = 10;
    if (f.x < MARGIN) f.x = MARGIN;
    if (f.x + f.w > W - MARGIN) f.x = W - MARGIN - f.w;

    // Timers
    if (f.invincible > 0) f.invincible--;
    if (f.stateTimer > 0) f.stateTimer--;
    if (f.comboTimer > 0) f.comboTimer--; else f.comboCount = 0;
    if (f.flash > 0) f.flash--;
    f.auraPulse += 0.05;

    // State transitions
    if (f.stateTimer <= 0) {
      if (f.state === 'attack' || f.state === 'hit' || f.state === 'skill') {
        f.state = f.onGround ? 'idle' : 'jump';
      }
    }

    // Skill cooldowns
    for (let i=0; i<3; i++) {
      if (f.skillCD[i] > 0) f.skillCD[i]--;
    }

    // Face opponent
    const other = all.find(o => o.player !== f.player);
    if (other) {
      f.facing = other.x > f.x ? 1 : -1;
    }
  }

  // ─── HIT DETECTION ───
  function checkHits(p1, p2) {
    // Check if p1 is attacking p2
    if (p1.state === 'attack' && p1.stateTimer > 5) {
      // handled in performAction
    }
  }

  // ─── PROJECTILES ───
  function updateProjectiles() {
    for (let i=projectiles.length-1; i>=0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Trail
      p.trail.push({ x:p.x, y:p.y, life:10 });
      if (p.trail.length > 8) p.trail.shift();

      // Boundaries
      if (p.x < -50 || p.x > W+50 || p.y < -50 || p.y > H+50 || p.life <= 0) {
        projectiles.splice(i,1);
        continue;
      }
      p.life--;

      // Check hit
      const target = fighters.find(f => f.player !== p.owner);
      if (target && target.hp > 0 && rectCollide(p, target)) {
        const dmg = p.dmg - target.def * 0.2;
        target.hp -= Math.max(3, dmg);
        target.vy = -6;
        target.vx = (p.vx > 0 ? 1 : -1) * 8;
        target.invincible = 10;
        target.state = 'hit';
        target.stateTimer = 8;
        spawnHitspark(p.x, p.y, 12, p.color);
        // Hit effects for projectile
        screenShake = Math.max(screenShake, 6);
        target.expression = '💥';
        target.expressionTimer = 18;
        if (cfg.vibration && navigator.vibrate) navigator.vibrate(20);
        projectiles.splice(i,1);
      }
    }
  }

  // ─── PARTICLES ───
  function spawnParticles(x, y, n, color) {
    for (let i=0; i<n; i++) {
      particles.push({
        x, y,
        vx: (Math.random()-0.5) * 8,
        vy: (Math.random()-0.5) * 8 - 3,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        r: 2 + Math.random() * 4,
        color,
        a: 1,
      });
    }
  }

  function updateParticles() {
    for (let i=particles.length-1; i>=0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      p.a = p.life / p.maxLife;
      if (p.life <= 0) {
        particles.splice(i,1);
      }
    }
  }

  function spawnHitspark(x, y, n, color) {
    for (let i=0; i<n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      hitsparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 8 + Math.random() * 6,
        maxLife: 14,
        r: 2 + Math.random() * 5,
        color: ['#fff','#fbbf24','#f97316','#ef4444'][Math.floor(Math.random()*4)],
      });
    }
  }

  function updateHitSparks() {
    for (let i=hitsparks.length-1; i>=0; i--) {
      const s = hitsparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15;
      s.life--;
      if (s.life <= 0) hitsparks.splice(i,1);
    }
  }

  // ─── AI ───
  function handleAI(ai, target) {
    if (!ai || ai.hp <= 0 || ai.isDummy) return;
    ai.aiTimer--;

    if (ai.aiTimer <= 0) {
      const dist = Math.abs(ai.x - target.x);
      const action = Math.random();

      if (dist > 200) {
        // Move toward
        ai.aiAction = 'approach';
        ai.aiTimer = 20 + Math.random() * 30;
      } else if (dist > 100) {
        if (action < 0.4) {
          ai.aiAction = 'approach';
          ai.aiTimer = 15 + Math.random() * 20;
        } else if (action < 0.7 && ai.ki >= 18) {
          ai.aiAction = 'ranged';
          ai.aiTimer = 5;
        } else {
          ai.aiAction = 'approach';
          ai.aiTimer = 10 + Math.random() * 15;
        }
      } else {
        // Close range
        if (action < 0.35) {
          ai.aiAction = 'basic';
          ai.aiTimer = 5;
        } else if (action < 0.55 && ai.ki >= 8) {
          ai.aiAction = 'skill1';
          ai.aiTimer = 5;
        } else if (action < 0.7 && ai.ki >= 20) {
          ai.aiAction = 'skill2';
          ai.aiTimer = 5;
        } else if (action < 0.8 && ai.ki >= 40) {
          ai.aiAction = 'skill3';
          ai.aiTimer = 5;
        } else if (ai.hp < ai.maxHp * 0.3 && Math.random() > 0.6) {
          ai.aiAction = 'retreat';
          ai.aiTimer = 15 + Math.random() * 20;
        } else {
          ai.aiAction = 'basic';
          ai.aiTimer = 8 + Math.random() * 10;
        }
      }
    }

    // Execute AI action
    const dist = Math.abs(ai.x - target.x);
    switch (ai.aiAction) {
      case 'approach':
        if (ai.x < target.x) ai.vx += ai.speed * 0.25;
        else ai.vx -= ai.speed * 0.25;
        ai.facing = ai.x < target.x ? 1 : -1;
        break;
      case 'retreat':
        if (ai.x < target.x) { ai.vx -= ai.speed * 0.2; ai.facing = -1; }
        else { ai.vx += ai.speed * 0.2; ai.facing = 1; }
        break;
      case 'basic':
        if (dist < 70) performAction(ai, 'basic', target);
        else { ai.aiAction = 'approach'; }
        break;
      case 'skill1':
        if (dist < 80) performAction(ai, 'skill1', target);
        else { ai.aiAction = 'approach'; }
        break;
      case 'ranged':
        performAction(ai, 'skill2', target);
        break;
      case 'skill3':
        if (dist < 150) performAction(ai, 'skill3', target);
        else { ai.aiAction = 'approach'; }
        break;
    }

    // Random jump
    if (ai.onGround && Math.random() < 0.01) {
      ai.vy = -12;
      ai.onGround = false;
    }
  }

  // ─── END MATCH ───
  function endMatch() {
    matchOver = true;
    gameRunning = false;

    const p1 = fighters[0];
    const p2 = fighters[1];

    let result = '';
    let sub = '';

    if (p1.hp <= 0 && p2.hp <= 0) {
      result = 'HÒA!';
      resultText.className = 'draw';
      sub = 'Cả hai đều gục ngã!';
    } else if (p2.hp <= 0) {
      if (cfg.mode === '1v1') {
        result = 'CHIẾN THẮNG!';
        resultText.className = 'win';
        sub = `${p1.char.emoji} ${p1.char.name} đã đánh bại ${p2.char.name}!`;
        // Add points
        addGamePoints(100);
      } else if (cfg.mode === '2p') {
        result = 'P1 THẮNG!';
        resultText.className = 'win';
        sub = `${p1.char.emoji} ${p1.char.name} chiến thắng!`;
      } else {
        result = 'LUYỆN TẬP HOÀN TẤT!';
        resultText.className = 'win';
        sub = 'Tiếp tục luyện tập nào!';
      }
    } else {
      if (cfg.mode === '1v1') {
        result = 'THUA CUỘC!';
        resultText.className = 'lose';
        sub = `${p2.char.emoji} ${p2.char.name} đã mạnh hơn! Hãy luyện tập thêm!`;
      } else if (cfg.mode === '2p') {
        result = 'P2 THẮNG!';
        resultText.className = 'lose';
        sub = `${p2.char.emoji} ${p2.char.name} chiến thắng!`;
      } else {
        result = 'LUYỆN TẬP HOÀN TẤT!';
        resultText.className = 'win';
        sub = 'Tốt lắm!';
      }
    }

    resultText.textContent = result;
    resultSub.textContent = sub;
    resultOverlay.classList.add('active');
  }

  async function addGamePoints(pts) {
    try {
      const { addPoints } = await import('../../points.js');
      await addPoints('Đại Chiến Songoku', 'Chiến thắng', pts);
    } catch(e) {}
  }

  // ─── REMATCH / BACK ───
  function rematch() {
    resultOverlay.classList.remove('active');
    // Reset
    const p1 = fighters[0];
    const p2 = fighters[1];
    p1.hp = p1.maxHp;
    p1.ki = 50;
    p1.x = W*0.25;
    p1.y = GROUND_Y - 60;
    p1.vx = 0; p1.vy = 0;
    p1.state = 'idle';
    p1.stateTimer = 0;
    p1.invincible = 0;
    p1.skillCD = [0,0,0];
    p2.hp = p2.maxHp;
    p2.ki = 50;
    p2.x = W*0.75;
    p2.y = GROUND_Y - 60;
    p2.vx = 0; p2.vy = 0;
    p2.state = 'idle';
    p2.stateTimer = 0;
    p2.invincible = 0;
    p2.skillCD = [0,0,0];
    // Reset screen effects
    p1.expression = ''; p1.expressionTimer = 0;
    p2.expression = ''; p2.expressionTimer = 0;
    screenShake = 0;
    screenFlash = 0;

    particles = [];
    hitsparks = [];
    projectiles = [];
    matchOver = false;
    gameFrame = 0;
    startCountdown();
  }

  function toModeSelect() {
    // Clean up
    if (animFrameId) cancelAnimationFrame(animFrameId);
    battleScreen.classList.remove('active');
    joystickZone.classList.remove('active');
    actionBtns.classList.remove('active');
    settingsBtn.classList.remove('active');
    settingsPanel.classList.remove('open');
    resultOverlay.classList.remove('active');
    gameRunning = false;
    matchOver = false;
    window.removeEventListener('resize', resizeCanvas);
    modeScreen.classList.add('active');
  }

  // ─── DRAW ───
  function draw() {
    ctx.save();

    // Screen shake
    if (screenShake > 0.5) {
      const sx = (Math.random() - 0.5) * screenShake * 2;
      const sy = (Math.random() - 0.5) * screenShake * 2;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(-10, -10, W + 20, H + 20);

    // Background
    drawBackground();

    // Stage
    drawStage();

    // Projectiles
    drawProjectiles();

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Hit sparks
    hitsparks.forEach(s => {
      const a = s.life / s.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Fighters
    fighters.forEach(f => drawFighter(f));

    // HUD
    drawHUD();

    // Skill buttons cooldown
    updateButtonCD();

    // Screen flash overlay
    if (screenFlash > 0.01) {
      ctx.fillStyle = screenFlashColor + Math.floor(screenFlash * 80).toString(16).padStart(2,'0');
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }

    ctx.restore();
  }

  function drawBackground() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i=0; i<50; i++) {
      const sx = (i * 137.5 + 50) % W;
      const sy = (i * 97.3 + 20) % (H * 0.6);
      const sr = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawStage() {
    // Ground
    const gGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    gGrad.addColorStop(0, '#1a3a1a');
    gGrad.addColorStop(0.1, '#2d5a2d');
    gGrad.addColorStop(0.5, '#1a3a1a');
    gGrad.addColorStop(1, '#0a1a0a');
    ctx.fillStyle = gGrad;
    ctx.fillRect(STAGE_LEFT, GROUND_Y, STAGE_W, H - GROUND_Y);

    // Ground line
    ctx.strokeStyle = 'rgba(34,211,238,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(STAGE_LEFT, GROUND_Y);
    ctx.lineTo(STAGE_LEFT + STAGE_W, GROUND_Y);
    ctx.stroke();

    // Stage edges
    ctx.fillStyle = 'rgba(239,68,68,0.15)';
    ctx.fillRect(STAGE_LEFT-4, GROUND_Y, 4, H-GROUND_Y);
    ctx.fillRect(STAGE_LEFT+STAGE_W, GROUND_Y, 4, H-GROUND_Y);

    // Floor pattern
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let x=STAGE_LEFT; x<STAGE_LEFT+STAGE_W; x+=40) {
      ctx.fillRect(x, GROUND_Y+2, 1, 12);
    }
  }

  function drawFighter(f) {
    if (!f || f.hp <= 0) return;

    ctx.save();
    const cx = f.x + f.w/2;
    const cy = f.y + f.h/2;

    // Aura
    if (f.ki > 30) {
      const pulse = 0.6 + 0.4 * Math.sin(f.auraPulse * 3);
      const auraSize = 8 + (f.ki / f.maxKi) * 12;
      const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.w/2 + auraSize);
      auraGrad.addColorStop(0, f.char.aura + '33');
      auraGrad.addColorStop(0.5, f.char.aura + '15');
      auraGrad.addColorStop(1, f.char.aura + '00');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, f.w/2 + auraSize * pulse, 0, Math.PI*2);
      ctx.fill();
    }

    // Flash on hit
    if (f.invincible > 0 && Math.floor(f.invincible / 3) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Body
    const bodyColor = f.state === 'hit' ? '#ef4444' : f.char.color;
    const bodyGrad = ctx.createLinearGradient(f.x, f.y, f.x, f.y + f.h);
    bodyGrad.addColorStop(0, bodyColor);
    bodyGrad.addColorStop(0.5, bodyColor + 'dd');
    bodyGrad.addColorStop(1, bodyColor + '88');
    ctx.fillStyle = bodyGrad;

    // Body shape
    const bw = f.w, bh = f.h;
    ctx.beginPath();
    ctx.roundRect(f.x, f.y, bw, bh, 6);
    ctx.fill();

    // Belt
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(f.x, f.y + bh*0.45, bw, 4);

    // Head
    const headY = f.y - 14;
    const headR = 12;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI*2);
    ctx.fill();

    // Hair (color)
    ctx.fillStyle = f.char.id === 'goku' ? '#f97316' :
                    f.char.id === 'vegeta' ? '#1e293b' :
                    f.char.id === 'gohan' ? '#1e293b' :
                    f.char.id === 'frieza' ? '#ec4899' :
                    f.char.id === 'trunks' ? '#06b6d4' :
                    '#22c55e';
    // Hair spikes
    for (let i=-3; i<=3; i++) {
      ctx.beginPath();
      const hr = 6 + Math.abs(i)*1.5;
      ctx.moveTo(cx + i*4 - 4, headY - headR);
      ctx.lineTo(cx + i*4, headY - headR - hr);
      ctx.lineTo(cx + i*4 + 4, headY - headR);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    const eyeX = f.facing === 1 ? cx + 3 : cx - 5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(eyeX + (f.facing===1 ? -1 : 0), headY - 3, 4, 4);
    ctx.fillRect(eyeX + (f.facing===1 ? 5 : 0), headY - 3, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(eyeX + (f.facing===1 ? 1 : 2), headY - 2, 2, 2);
    ctx.fillRect(eyeX + (f.facing===1 ? 7 : 2), headY - 2, 2, 2);

    // Mouth
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 3, headY + 4, 6, 2);

    // Attack effect
    if (f.state === 'attack' && f.stateTimer > 5) {
      const dir = f.facing;
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.beginPath();
      ctx.ellipse(
        f.x + (dir > 0 ? f.w + 15 : -15),
        f.y + f.h/2,
        20, 10, 0, 0, Math.PI*2
      );
      ctx.fill();
      // Motion lines
      ctx.strokeStyle = 'rgba(251,191,36,0.3)';
      ctx.lineWidth = 2;
      for (let i=0; i<3; i++) {
        const ly = f.y + f.h/3 + i*10;
        ctx.beginPath();
        ctx.moveTo(f.x + (dir>0 ? f.w : 0), ly);
        ctx.lineTo(f.x + (dir>0 ? f.w + 20 : -20), ly);
        ctx.stroke();
      }
    }

    // Skill effect
    if (f.state === 'skill') {
      const pulse = Math.sin(f.stateTimer * 0.5) * 0.3 + 0.7;
      ctx.fillStyle = f.char.aura + Math.floor(80 * pulse).toString(16).padStart(2,'0');
      ctx.beginPath();
      ctx.arc(cx, cy, f.w * pulse * 0.8, 0, Math.PI*2);
      ctx.fill();
    }

    // ── FLOATING HP BAR (above head) ──
    const barW = 40;
    const barH = 5;
    const barX = cx - barW/2;
    const barY = headY - headR - 18; // above hair spikes with padding

    // Dark background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 2);
    ctx.fill();

    // HP fill
    const hpPct = Math.max(0, f.hp / f.maxHp);
    const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpPct, barH, 1.5);
    ctx.fill();

    // HP shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpPct, barH/2, 1.5);
    ctx.fill();

    // Name label above bar
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 7px Nunito,sans-serif';
    const prevAlign = ctx.textAlign;
    const prevBaseline = ctx.textBaseline;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(f.char.name, cx, barY - 3);
    ctx.textAlign = prevAlign;
    ctx.textBaseline = prevBaseline;

    // Ki bar (small, below HP bar)
    const kiBarW = 30;
    const kiBarH = 3;
    const kiBarX = cx - kiBarW/2;
    const kiBarY = barY + barH + 3;
    const kiPct = f.ki / f.maxKi;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(kiBarX - 1, kiBarY - 1, kiBarW + 2, kiBarH + 2, 1.5);
    ctx.fill();
    ctx.fillStyle = f.player === 1 ? '#22d3ee' : '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(kiBarX, kiBarY, kiBarW * kiPct, kiBarH, 1);
    ctx.fill();

    // ── EXPRESSION EMOJI (above everything) ──
    if (f.expression && f.expressionTimer > 0) {
      const exprY = barY - 15 - (f.expressionTimer < 10 ? (10 - f.expressionTimer) * 2 : 0); // float up
      const exprScale = f.expressionTimer > 20 ? 1.3 : 1; // pop in
      ctx.font = `${Math.round(18 * exprScale)}px sans-serif`;
      const prevAlign = ctx.textAlign;
      const prevBaseline = ctx.textBaseline;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, f.expressionTimer / 8);
      ctx.fillText(f.expression, cx, exprY);
      ctx.globalAlpha = 1;
      ctx.textAlign = prevAlign;
      ctx.textBaseline = prevBaseline;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawProjectiles() {
    projectiles.forEach(p => {
      // Trail
      p.trail.forEach((t, idx) => {
        const a = (idx / p.trail.length) * 0.4;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3 + (idx/p.trail.length)*3, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Projectile body
      const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w);
      pGrad.addColorStop(0, '#fff');
      pGrad.addColorStop(0.3, p.color);
      pGrad.addColorStop(1, p.color + '00');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(p.x + p.w/2, p.y + p.h/2, p.w/2, 0, Math.PI*2);
      ctx.fill();
    });
  }

  function drawHUD() {
    const p1 = fighters[0];
    const p2 = fighters[1];
    if (!p1 || !p2) return;

    const barW = Math.min(W * 0.35, 250);
    const barH = 18;
    const barY = 16;
    const kiH = 8;
    const margin = 20;

    // P1 HP (left side)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(margin-2, barY-2, barW+4, barH+kiH+8, 6);
    ctx.fill();

    // HP back
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(margin, barY, barW, barH, 4);
    ctx.fill();

    // HP fill
    const hp1Pct = Math.max(0, p1.hp / p1.maxHp);
    const hpColor1 = hp1Pct > 0.5 ? '#22c55e' : hp1Pct > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillStyle = hpColor1;
    ctx.beginPath();
    ctx.roundRect(margin, barY, barW * hp1Pct, barH, 4);
    ctx.fill();

    // HP shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(margin, barY, barW * hp1Pct, barH/2, 4);
    ctx.fill();

    // P1 Name & HP
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Nunito,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p1.char.emoji} ${p1.char.name}`, margin, barY - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px Nunito,sans-serif';
    ctx.fillText(`${Math.ceil(p1.hp)}/${p1.maxHp}`, margin + 4, barY + barH - 4);

    // P1 KI
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(margin, barY + barH + 4, barW, kiH, 3);
    ctx.fill();
    const ki1Pct = p1.ki / p1.maxKi;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.roundRect(margin, barY + barH + 4, barW * ki1Pct, kiH, 3);
    ctx.fill();

    // P2 HP (right side)
    const p2X = W - margin - barW;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(p2X-2, barY-2, barW+4, barH+kiH+8, 6);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(p2X, barY, barW, barH, 4);
    ctx.fill();

    const hp2Pct = Math.max(0, p2.hp / p2.maxHp);
    const hpColor2 = hp2Pct > 0.5 ? '#22c55e' : hp2Pct > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillStyle = hpColor2;
    ctx.beginPath();
    ctx.roundRect(p2X + barW * (1 - hp2Pct), barY, barW * hp2Pct, barH, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(p2X + barW * (1 - hp2Pct), barY, barW * hp2Pct, barH/2, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Nunito,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${p2.char.name} ${p2.char.emoji}`, W - margin, barY - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px Nunito,sans-serif';
    ctx.fillText(`${Math.ceil(p2.hp)}/${p2.maxHp}`, W - margin - 4, barY + barH - 4);

    // P2 KI
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(p2X, barY + barH + 4, barW, kiH, 3);
    ctx.fill();
    const ki2Pct = p2.ki / p2.maxKi;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.roundRect(p2X + barW * (1 - ki2Pct), barY + barH + 4, barW * ki2Pct, kiH, 3);
    ctx.fill();

    // Center timer / mode
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(W/2 - 50, 10, 100, 24, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px Orbitron,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.mode === '1v1' ? 'VS CPU' : cfg.mode === '2p' ? '1V1' : 'TRAIN', W/2, 26);

    // Combo counter
    if (p1.comboCount > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px Bangers,cursive';
      ctx.textAlign = 'left';
      ctx.fillText(`${p1.comboCount}x COMBO!`, margin, barY + barH + kiH + 28);
    }
    if (p2.comboCount > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px Bangers,cursive';
      ctx.textAlign = 'right';
      ctx.fillText(`${p2.comboCount}x COMBO!`, W - margin, barY + barH + kiH + 28);
    }
  }

  function updateButtonCD() {
    const p1 = fighters[0];
    if (!p1) return;
    const btns = document.querySelectorAll('.action-btn');
    btns.forEach((btn, idx) => {
      // First btn is basic (no CD), then skill1, skill2, skill3
      if (idx === 0) return; // basic attack
      const skillIdx = idx - 1;
      const cd = p1.skillCD[skillIdx];
      const skill = p1.char.skills[skillIdx];
      if (cd > 0) {
        btn.classList.add('cooldown');
        let cdEl = btn.querySelector('.cd-overlay');
        if (!cdEl) {
          cdEl = document.createElement('span');
          cdEl.className = 'cd-overlay';
          btn.appendChild(cdEl);
        }
        cdEl.textContent = Math.ceil(cd / 60);
      } else {
        btn.classList.remove('cooldown');
        const cdEl = btn.querySelector('.cd-overlay');
        if (cdEl) cdEl.remove();
      }
      // Ki check
      if (skill && p1.ki < skill.ki) {
        btn.style.opacity = '0.4';
      } else {
        btn.style.opacity = '';
      }
    });
  }

  // ─── UTILITY ───
  function rectCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function playHitSound() {
    // Simple beep using AudioContext if available
    try {
      if (!window._audioCtx) window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = window._audioCtx.createOscillator();
      const gain = window._audioCtx.createGain();
      osc.connect(gain);
      gain.connect(window._audioCtx.destination);
      osc.frequency.setValueAtTime(400 + Math.random()*200, window._audioCtx.currentTime);
      osc.type = 'square';
      gain.gain.setValueAtTime(0.08, window._audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, window._audioCtx.currentTime + 0.08);
      osc.start(window._audioCtx.currentTime);
      osc.stop(window._audioCtx.currentTime + 0.08);
    } catch(e) {}
  }

  // ─── PUBLIC API ───
  return {
    init,
    selectMode,
    backToMode,
    selectChar,
    startBattle,
    pressAction,
    releaseAction,
    toggleSettings,
    setJoystickType,
    setVibration,
    setSFX,
    rematch,
    toModeSelect,
  };
})();

// ─── BOOT ───
document.addEventListener('DOMContentLoaded', () => Game.init());

// Rời game
setTimeout(function(){if(window.TopNav&&typeof window.TopNav.setLeaveAction==="function"){window.TopNav.setLeaveAction(function(){window.location.href="../../games.html"})}},100);
