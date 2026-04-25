import { addPoints, getPoints } from './points.js';

class ForgottenWarrior {
  constructor() {
    this.cv = document.getElementById('gameCanvas');
    this.ctx = this.cv.getContext('2d');
    this.cv.width = 512; this.cv.height = 288;
    this.S = 16; // tile size

    this.state = 'start'; // start / playing / shop / win / dead
    this.level = 1;
    this.maxLevel = 7;
    this.gold = 0;
    this.totalGold = 0;
    this.totalEarned = 0;

    // Player
    this.p = {
      x:32, y:200, w:14, h:22, vx:0, vy:0,
      speed:2.2, jumpForce:-7.5, onGround:false, facing:1,
      hp:100, maxHp:100, mp:50, maxMp:50,
      invincible:0, attackTimer:0, attackCooldown:0,
      magicCooldown:0,
      weapon: 'fist', // fist / sword
      spell: null, // null / fire / ice / bolt
    };

    this.enemies = [];
    this.coins = [];
    this.platforms = [];
    this.projectiles = [];
    this.particles = [];
    this.dialogs = [];
    this.npcs = [];
    this.ladders = [];
    this.hazards = [];
    this.exitZone = null;
    this.shopZone = null;
    this.cam = { x:0, y:0 };
    this.levelW = 1280;
    this.keys = { left:false, right:false, jump:false, attack:false, magic:false };

    this.init();
  }

  async init() {
    await this.refreshPts();
    this.bindInput();
    document.getElementById('btnFullscreen').onclick = () => {
      const w = document.getElementById('game-wrapper');
      (w.requestFullscreen || w.webkitRequestFullscreen).call(w);
    };
    document.getElementById('btnStart').onclick = () => this.startGame();
    document.getElementById('btnCloseShop').onclick = () => this.closeShop();
    document.getElementById('btnCloseDialog').onclick = () => this.closeDialog();
    this.bindTouch();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  resize() {
    const maxW = window.innerWidth;
    const maxH = window.innerHeight - 120;
    const scale = Math.min(maxW / this.cv.width, maxH / this.cv.height);
    this.cv.style.width = (this.cv.width * scale) + 'px';
    this.cv.style.height = (this.cv.height * scale) + 'px';
  }

  async refreshPts() {
    const pts = await getPoints();
    document.getElementById('nav-pts').textContent = '⭐ ' + (pts || 0).toLocaleString('vi-VN');
  }

  bindInput() {
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') { this.keys.jump = true; e.preventDefault(); }
      if (e.key === 'j') this.keys.attack = true;
      if (e.key === 'k') this.keys.magic = true;
    });
    window.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') this.keys.jump = false;
      if (e.key === 'j') this.keys.attack = false;
      if (e.key === 'k') this.keys.magic = false;
    });
  }

  bindTouch() {
    const map = { btnLeft:'left', btnRight:'right', btnJump:'jump', btnAttack:'attack', btnMagic:'magic' };
    Object.entries(map).forEach(([id,key]) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.keys[key] = true; });
      b.addEventListener('pointerup', () => { this.keys[key] = false; });
      b.addEventListener('pointerleave', () => { this.keys[key] = false; });
    });
  }

  startGame() {
    document.getElementById('startScreen').style.display = 'none';
    this.state = 'playing';
    this.level = 1;
    this.p.hp = 100; this.p.mp = 50;
    this.p.weapon = 'fist'; this.p.spell = null;
    this.gold = 0; this.totalGold = 0; this.totalEarned = 0;
    this.loadLevel();
  }

  aabb(a,b) { return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

  spawnCoins(xs) { xs.forEach(x => this.coins.push({ x, y:200, w:10, h:10, collected:false, special:null })); }

  applySpecial(s) {
    if (s === 'sword') this.p.weapon = 'sword';
    else this.p.spell = s;
  }

  updateHUD() {
    document.getElementById('hpFill').style.width = (this.p.hp/this.p.maxHp*100)+'%';
    document.getElementById('mpFill').style.width = (this.p.mp/this.p.maxMp*100)+'%';
    document.getElementById('hpText').textContent = this.p.hp;
    document.getElementById('mpText').textContent = this.p.mp;
    document.getElementById('goldDisplay').textContent = this.gold;
  }
  // ────── LEVEL DATA ──────
loadLevel() {
  const p = this.p;
  p.x = 32; p.y = 200; p.vx = 0; p.vy = 0; p.invincible = 40;
  p.attackTimer = 0; p.attackCooldown = 0; p.magicCooldown = 0;
  this.enemies = []; this.coins = []; this.platforms = [];
  this.projectiles = []; this.particles = [];
  this.npcs = []; this.ladders = []; this.hazards = [];
  this.exitZone = null; this.shopZone = null;
  this.dialogs = [];

  const L = this.level;
  this.levelW = 900 + L * 200;

  // Ground
  this.platforms.push({ x:0, y:this.cv.height-16, w:this.levelW, h:16 });

  if (L === 1) {
    this.platforms.push({ x:200, y:190, w:96, h:10 }, { x:380, y:160, w:112, h:10 });
    this.platforms.push({ x:560, y:180, w:80, h:10 }, { x:720, y:140, w:110, h:10 });
    this.enemies.push(
      { x:280, y:168, w:14, h:20, vx:1, hp:30, alive:true, patrol:[200,380], type:'soldier' },
      { x:480, y:138, w:14, h:20, vx:-1.3, hp:25, alive:true, patrol:[380,540], type:'soldier' },
      { x:650, y:158, w:14, h:20, vx:1.2, hp:35, alive:true, patrol:[560,780], type:'soldier' },
    );
    this.spawnCoins([220,250,400,430,590,620,750,780]);
    this.hazards.push({ x:300, y:240, w:30, h:16 });
    this.npcs.push({ x:100, y:190, w:14, h:20, text:'Hoàng tử! Công chúa bị bắt sang hướng Đông! Hãy tìm kiếm vũ khí trên đường đi!' });
    this.exitZone = { x:this.levelW-40, y:210, w:30, h:40 };
    this.coins.push({ x:500, y:148, w:12, h:12, collected:false, special:'sword' });
  } else if (L === 2) {
    this.platforms.push({ x:150, y:200, w:70, h:10 }, { x:300, y:170, w:90, h:10 });
    this.platforms.push({ x:480, y:150, w:100, h:10 }, { x:660, y:190, w:90, h:10 });
    this.platforms.push({ x:850, y:130, w:110, h:10 });
    this.enemies.push(
      { x:250, y:178, w:14, h:20, vx:1.5, hp:40, alive:true, patrol:[150,350], type:'skeleton' },
      { x:550, y:128, w:14, h:20, vx:-1.6, hp:45, alive:true, patrol:[480,640], type:'skeleton' },
      { x:750, y:168, w:14, h:20, vx:1.4, hp:50, alive:true, patrol:[660,860], type:'wizard' },
    );
    this.spawnCoins([180,210,330,360,510,540,690,720,880,910]);
    this.hazards.push({ x:400, y:240, w:25, h:16 }, { x:700, y:240, w:25, h:16 });
    this.exitZone = { x:this.levelW-40, y:210, w:30, h:40 };
    this.coins.push({ x:620, y:138, w:12, h:12, collected:false, special:'fire' });
  } else if (L === 3) {
    this.platforms.push({ x:120, y:195, w:80, h:10 }, { x:280, y:170, w:70, h:10 });
    this.platforms.push({ x:430, y:155, w:90, h:10 }, { x:600, y:190, w:80, h:10 });
    this.platforms.push({ x:780, y:140, w:100, h:10 }, { x:950, y:170, w:100, h:10 });
    this.enemies.push(
      { x:220, y:148, w:14, h:20, vx:1.6, hp:55, alive:true, patrol:[120,350], type:'wizard' },
      { x:500, y:133, w:14, h:20, vx:-1.7, hp:60, alive:true, patrol:[430,580], type:'skeleton' },
      { x:850, y:118, w:14, h:20, vx:1.5, hp:65, alive:true, patrol:[780,950], type:'soldier' },
      { x:1000, y:148, w:14, h:20, vx:-1.8, hp:70, alive:true, patrol:[920,1080], type:'wizard' },
    );
    this.spawnCoins([150,180,310,340,460,490,630,660,810,840,980,1010]);
    this.hazards.push({ x:350, y:240, w:25, h:16 }, { x:650, y:240, w:25, h:16 }, { x:900, y:240, w:25, h:16 });
    this.exitZone = { x:this.levelW-40, y:210, w:30, h:40 };
    this.coins.push({ x:700, y:128, w:12, h:12, collected:false, special:'ice' });
  } else if (L === 4) {
    this.platforms.push({ x:180, y:200, w:80, h:10 }, { x:340, y:160, w:90, h:10 });
    this.platforms.push({ x:510, y:180, w:90, h:10 }, { x:700, y:130, w:100, h:10 });
    this.platforms.push({ x:900, y:160, w:90, h:10 }, { x:1050, y:190, w:100, h:10 });
    this.enemies.push(
      { x:300, y:138, w:14, h:20, vx:1.8, hp:70, alive:true, patrol:[180,400], type:'skeleton' },
      { x:580, y:158, w:14, h:20, vx:-1.8, hp:75, alive:true, patrol:[510,660], type:'wizard' },
      { x:780, y:108, w:14, h:20, vx:1.7, hp:80, alive:true, patrol:[700,880], type:'soldier' },
      { x:1100, y:168, w:20, h:30, vx:0, hp:150, alive:true, patrol:[1050,1150], type:'boss' },
    );
    this.spawnCoins([210,240,370,400,540,570,730,760,930,960,1080,1110]);
    this.hazards.push({ x:450, y:238, w:30, h:18 });
    this.exitZone = { x:this.levelW-40, y:210, w:30, h:40 };
    this.coins.push({ x:650, y:118, w:12, h:12, collected:false, special:'bolt' });
  } else {
    // Levels 5-7: hard
    this.platforms.push({ x:160, y:195, w:80, h:10 }, { x:320, y:160, w:90, h:10 });
    this.platforms.push({ x:500, y:175, w:80, h:10 }, { x:680, y:135, w:100, h:10 });
    this.platforms.push({ x:880, y:165, w:90, h:10 }, { x:1050, y:120, w:120, h:10 });
    for (let i=0; i<3+L; i++) {
      const ex = 200 + i*200 + Math.random()*100;
      const ey = 160 + (i%3)*30;
      this.enemies.push({ x:ex, y:ey, w:14, h:20, vx:(i%2?1.8:-1.8), hp:60+L*15, alive:true, patrol:[ex-60,ex+60], type:['soldier','skeleton','wizard'][i%3] });
    }
    this.spawnCoins([200,230,350,380,530,560,710,740,910,940,1080,1110]);
    this.hazards.push({ x:400, y:238, w:25, h:18 }, { x:800, y:238, w:25, h:18 });
    this.exitZone = { x:this.levelW-40, y:210, w:30, h:40 };
  }

  // Shop zone before exit for levels 2+
  if (L >= 2) {
    this.shopZone = { x:this.exitZone.x - 120, y:220, w:30, h:30 };
  }

  this.updateHUD();
}

// ────── MAIN LOOP ──────
loop() {
  if (this.state === 'playing') this.update();
  this.draw();
  requestAnimationFrame(() => this.loop());
}

update() {
  const p = this.p;
  // Movement
  if (this.keys.left) p.vx = -p.speed;
  else if (this.keys.right) p.vx = p.speed;
  else p.vx = 0;
  if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;

  // Jump
  if (this.keys.jump && p.onGround) { p.vy = p.jumpForce; p.onGround = false; }

  // Attack
  if (this.keys.attack && p.attackCooldown <= 0 && p.attackTimer <= 0) {
    p.attackTimer = 12; p.attackCooldown = 20;
  }

  // Magic
  if (this.keys.magic && p.magicCooldown <= 0 && p.spell && p.mp >= 10) {
    p.mp -= 10;
    p.magicCooldown = 35;
    this.castSpell();
  }

  // Gravity
  p.vy += 0.55;
  if (p.vy > 11) p.vy = 11;

  // Apply velocity
  p.x += p.vx;
  p.y += p.vy;
  p.onGround = false;

  // Platform collision
  for (let pl of this.platforms) {
    if (this.aabb(p, pl)) {
      if (p.vy > 0 && p.y + p.h - p.vy <= pl.y + 2) { p.y = pl.y - p.h; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0 && p.y - p.vy + p.h >= pl.y + pl.h) { p.y = pl.y + pl.h; p.vy = 0; }
    }
  }
  // Ground
  if (p.y + p.h > this.cv.height) { p.y = this.cv.height - p.h; p.vy = 0; p.onGround = true; }

  // Bounds
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > this.levelW) p.x = this.levelW - p.w;
  if (p.y < 0) { p.y = 0; p.vy = 0; }

  // Fall death
  if (p.y > this.cv.height + 40) { this.die(); return; }

  // Timers
  if (p.invincible > 0) p.invincible--;
  if (p.attackTimer > 0) p.attackTimer--;
  if (p.attackCooldown > 0) p.attackCooldown--;
  if (p.magicCooldown > 0) p.magicCooldown--;

  // Attack hit enemies
  if (p.attackTimer > 0) {
    const atkBox = { x:p.x+(p.facing===1?p.w:0)-((p.facing===1?0:18)), y:p.y+2, w:18, h:p.h-4 };
    for (let e of this.enemies) {
      if (!e.alive) continue;
      if (this.aabb(atkBox, e)) {
        e.hp -= (p.weapon==='sword'?25:10);
        this.spawnParticles(e.x+e.w/2, e.y+e.h/2, 4, '#facc15');
        if (e.hp <= 0) { e.alive = false; this.gold += 15; this.totalEarned += 15; this.spawnParticles(e.x+e.w/2, e.y+e.h/2, 8, '#ef4444'); }
        p.attackTimer = 0;
        break;
      }
    }
  }

  // Enemy update
  for (let e of this.enemies) {
    if (!e.alive) continue;
    e.x += e.vx;
    if (e.x <= e.patrol[0] || e.x + e.w >= e.patrol[1]) e.vx = -e.vx;
    // Collide with player
    if (p.invincible <= 0 && this.aabb(p, e)) {
      p.hp -= 12;
      p.invincible = 25;
      p.vx = (p.x < e.x) ? -4 : 4;
      p.vy = -5;
      p.onGround = false;
      if (p.hp <= 0) { p.hp = 0; this.die(); return; }
    }
  }

  // Projectiles
  for (let i=this.projectiles.length-1; i>=0; i--) {
    const pr = this.projectiles[i];
    pr.x += pr.vx; pr.y += pr.vy;
    if (pr.x < this.cam.x-20 || pr.x > this.cam.x+this.cv.width+20 || pr.y < -20 || pr.y > this.cv.height+20) { this.projectiles.splice(i,1); continue; }
    let hit = false;
    for (let e of this.enemies) {
      if (!e.alive) continue;
      if (this.aabb(pr, e)) { e.hp -= pr.dmg; this.spawnParticles(e.x+e.w/2, e.y+e.h/2, 4, pr.color); if (e.hp <= 0) { e.alive = false; this.gold += 15; this.totalEarned += 15; } hit = true; break; }
    }
    if (hit) this.projectiles.splice(i,1);
  }

  // Hazards
  for (let h of this.hazards) {
    if (p.invincible <= 0 && this.aabb(p, h)) { p.hp -= 20; p.invincible = 30; if (p.hp <= 0) { this.die(); return; } }
  }

  // Coins
  for (let c of this.coins) {
    if (c.collected) continue;
    if (this.aabb(p, c)) {
      c.collected = true;
      if (c.special) { this.applySpecial(c.special); }
      else { this.gold += 10; this.totalEarned += 10; }
    }
  }

  // Shop zone
  if (this.shopZone && this.aabb(p, this.shopZone) && this.keys.jump) {
    this.openShop();
  }

  // Exit zone
  if (this.exitZone && this.aabb(p, this.exitZone)) {
    this.levelComplete();
  }

  // NPCs
  for (let n of this.npcs) {
    if (Math.abs(p.x - n.x) < 60 && Math.abs(p.y - n.y) < 40 && this.keys.jump) {
      this.showDialog(n.text);
      this.keys.jump = false;
    }
  }

  // Camera
  this.cam.x = p.x - this.cv.width/2;
  this.cam.x = Math.max(0, Math.min(this.cam.x, this.levelW - this.cv.width));
  this.cam.y = 0;

  this.updateHUD();
}

castSpell() {
  const p = this.p;
  const cfg = { fire:{color:'#f97316',dmg:35,speed:5,vy:0}, ice:{color:'#38bdf8',dmg:25,speed:4,vy:0}, bolt:{color:'#facc15',dmg:40,speed:6,vy:0} };
  const c = cfg[p.spell] || cfg.fire;
  this.projectiles.push({ x:p.x+p.w/2, y:p.y+4, w:10, h:6, vx:p.facing*c.speed, vy:c.vy, color:c.color, dmg:c.dmg });
  this.spawnParticles(p.x+p.w/2, p.y+4, 3, c.color);
}

die() {
  this.state = 'dead';
  this.showDialog('Bạn đã ngã xuống... Nhấn OK để thử lại từ đầu.');
  document.querySelector('#dialogModal .modal-btn').onclick = () => { this.closeDialog(); this.resetGame(); };
}

resetGame() { this.state='start'; document.getElementById('startScreen').style.display='flex'; this.gold=0; this.totalEarned=0; }

async levelComplete() {
  this.state = 'shop';
  this.totalGold += this.gold;
  const reward = this.totalEarned;
  if (reward > 0) {
    try { await addPoints('Forgotten Warrior', `Màn ${this.level}`, reward); await this.refreshPts(); } catch(e){}
    if (window.VTQuests) { window.VTQuests.trackPlay('warrior'); window.VTQuests.trackEarn(reward); }
  }
  if (this.level >= this.maxLevel) {
    this.state = 'win';
    const bigReward = this.totalGold + 500;
    try { await addPoints('Forgotten Warrior', 'Giải cứu công chúa!', bigReward); await this.refreshPts(); } catch(e){}
    this.showDialog('🏰 Bạn đã giải cứu được công chúa! Cảm ơn anh hùng! +' + bigReward.toLocaleString('vi-VN') + ' điểm');
    return;
  }
  this.openShop();
}

showDialog(text) {
  document.getElementById('dialogText').textContent = text;
  document.getElementById('dialogModal').style.display = 'flex';
}
closeDialog() { document.getElementById('dialogModal').style.display = 'none'; }
  openShop() {
    document.getElementById('shopModal').style.display = 'flex';
    document.getElementById('shopGold').textContent = this.gold;
    const items = [
      { name:'🗡️ Kiếm', cost:50, action:()=>{ if(this.gold>=50){ this.gold-=50; this.p.weapon='sword'; this.renderShop(); } } },
      { name:'🔥 Phép Lửa', cost:80, action:()=>{ if(this.gold>=80){ this.gold-=80; this.p.spell='fire'; this.renderShop(); } } },
      { name:'❄️ Phép Băng', cost:100, action:()=>{ if(this.gold>=100){ this.gold-=100; this.p.spell='ice'; this.renderShop(); } } },
      { name:'⚡ Phép Sét', cost:150, action:()=>{ if(this.gold>=150){ this.gold-=150; this.p.spell='bolt'; this.renderShop(); } } },
      { name:'❤️ Hồi máu (+30HP)', cost:40, action:()=>{ if(this.gold>=40){ this.gold-=40; this.p.hp=Math.min(this.p.maxHp,this.p.hp+30); this.renderShop(); } } },
      { name:'💧 Hồi mana (+20MP)', cost:30, action:()=>{ if(this.gold>=30){ this.gold-=30; this.p.mp=Math.min(this.p.maxMp,this.p.mp+20); this.renderShop(); } } },
    ];
    this.renderShop = () => {
      const div = document.getElementById('shopItems');
      div.innerHTML = items.map(i => {
        const owned = (i.name.includes('Kiếm') && this.p.weapon==='sword') || (i.name.includes('Lửa') && this.p.spell==='fire') || (i.name.includes('Băng') && this.p.spell==='ice') || (i.name.includes('Sét') && this.p.spell==='bolt');
        return `<div class="shop-item"><span>${i.name} - ${i.cost}💰</span><button ${this.gold < i.cost || owned ? 'disabled':''}>${owned?'Đã có':'Mua'}</button></div>`;
      }).join('');
      document.getElementById('shopGold').textContent = this.gold;
      [...div.querySelectorAll('button')].forEach((b,i) => { if (!b.disabled) b.onclick = items[i].action; });
    };
    this.renderShop();
  }

  closeShop() {
    document.getElementById('shopModal').style.display = 'none';
    if (this.state === 'shop') {
      this.level++;
      this.gold = 0; this.totalEarned = 0;
      this.loadLevel();
      this.state = 'playing';
    }
  }

  spawnParticles(x,y,n,color) { for(let i=0;i<n;i++) this.particles.push({ x,y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3-2,life:15,color }); }

  // ────── DRAW ──────
  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0,0,this.cv.width,this.cv.height);

    if (this.state === 'start' || this.state === 'win' || this.state === 'dead') {
      return;
    }

    ctx.save();
    ctx.translate(-this.cam.x, -this.cam.y);

    // Background
    for (let x=0; x<this.levelW; x+=64) {
      ctx.fillStyle = '#0d1f3c';
      ctx.fillRect(x, 0, 64, this.cv.height);
    }

    // Platforms
    ctx.fillStyle = '#4a6741';
    for (let pl of this.platforms) {
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#5c7d4f';
      ctx.fillRect(pl.x, pl.y, pl.w, 3);
      ctx.fillStyle = '#4a6741';
    }

    // Hazards
    for (let h of this.hazards) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(h.x+2, h.y+2, h.w-4, h.h-4);
    }

    // Exit zone
    if (this.exitZone) {
      ctx.fillStyle = 'rgba(34,197,94,0.3)';
      ctx.fillRect(this.exitZone.x, this.exitZone.y, this.exitZone.w, this.exitZone.h);
    }
    // Shop zone
    if (this.shopZone) {
      ctx.fillStyle = 'rgba(250,204,21,0.4)';
      ctx.fillRect(this.shopZone.x, this.shopZone.y, this.shopZone.w, this.shopZone.h);
      ctx.fillStyle = '#facc15';
      ctx.font = '8px Press Start 2P';
      ctx.fillText('🛒', this.shopZone.x-10, this.shopZone.y-4);
    }

    // Coins
    for (let c of this.coins) {
      if (c.collected) continue;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(c.x+c.w/2, c.y+c.h/2, c.w/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(c.x+c.w/2, c.y+c.h/2, c.w/3, 0, Math.PI*2); ctx.fill();
      if (c.special) { ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText('⭐', c.x-4, c.y-4); }
    }

    // NPCs
    for (let n of this.npcs) {
      ctx.fillStyle = '#34d399';
      ctx.fillRect(n.x, n.y, n.w, n.h);
      ctx.fillStyle = '#fff'; ctx.font = '6px Press Start 2P';
      ctx.fillText('!', n.x-6, n.y-4);
    }

    // Enemies
    for (let e of this.enemies) {
      if (!e.alive) continue;
      const colors = { soldier:'#ef4444', skeleton:'#94a3b8', wizard:'#a78bfa', boss:'#dc2626' };
      ctx.fillStyle = colors[e.type] || '#ef4444';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x+3, e.y+4, 3, 3);
      ctx.fillRect(e.x+8, e.y+4, 3, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x+4, e.y+5, 2, 2);
      ctx.fillRect(e.x+9, e.y+5, 2, 2);
      // HP bar
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x, e.y-4, e.w, 2);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(e.x, e.y-4, e.w*(e.hp/(60+this.level*15)), 2);
    }

    // Projectiles
    for (let pr of this.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    }

    // Particles
    for (let i=this.particles.length-1; i>=0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.life--;
      if (pt.life <= 0) { this.particles.splice(i,1); continue; }
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3, 3);
    }

    // Player
    const p = this.p;
    if (p.invincible > 0 && Math.floor(p.invincible/3)%2===0) ctx.globalAlpha = 0.5;

    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Head
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(p.x+2, p.y-8, 10, 10);
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x+(p.facing===1?7:3), p.y-6, 3, 3);
    // Weapon
    if (p.weapon === 'sword') {
      ctx.fillStyle = '#c0c0c0';
      if (p.attackTimer > 0) {
        if (p.facing===1) { ctx.fillRect(p.x+p.w, p.y+6, 16, 3); ctx.fillRect(p.x+p.w+13, p.y+4, 3, 8); }
        else { ctx.fillRect(p.x-16, p.y+6, 16, 3); ctx.fillRect(p.x-16, p.y+4, 3, 8); }
      } else {
        if (p.facing===1) ctx.fillRect(p.x+6, p.y-12, 3, 14);
        else ctx.fillRect(p.x+5, p.y-12, 3, 14);
      }
    } else if (p.attackTimer > 0) {
      ctx.fillStyle = '#fbbf24';
      if (p.facing===1) ctx.fillRect(p.x+p.w, p.y+8, 8, 4);
      else ctx.fillRect(p.x-8, p.y+8, 8, 4);
    }

    ctx.globalAlpha = 1;

    // Spell indicator
    if (p.spell) {
      const icons = { fire:'🔥', ice:'❄️', bolt:'⚡' };
      ctx.font = '8px sans-serif';
      ctx.fillText(icons[p.spell], p.x, p.y-12);
    }

    ctx.restore();

    // End screen flash
    if (this.state === 'win') {
      ctx.fillStyle = 'rgba(34,197,94,0.2)';
      ctx.fillRect(0,0,this.cv.width,this.cv.height);
    }
  }
}

new ForgottenWarrior();