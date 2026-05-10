// Office Runner v2 — Improved endless runner with difficulty scaling
(function () {
  'use strict';

  // ── Difficulty table ────────────────────────────────────────────────────────
  // displayScore = Math.floor(rawScore / 10)
  const LEVELS = [
    { min: 0,   speed: 5,    interval: 105, flying: false, double: false, label: 'Bürobeginner'  },
    { min: 100, speed: 6.5,  interval: 88,  flying: true,  double: false, label: 'Überstunden'   },
    { min: 200, speed: 8,    interval: 72,  flying: true,  double: true,  label: 'Krisenmodus'   },
    { min: 300, speed: 10,   interval: 58,  flying: true,  double: true,  label: 'Panik-Modus'   },
    { min: 400, speed: 12.5, interval: 46,  flying: true,  double: true,  label: 'Shutdown'      },
  ];

  function getLevel(displayScore) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (displayScore >= LEVELS[i].min) return { ...LEVELS[i], idx: i };
    }
    return { ...LEVELS[0], idx: 0 };
  }

  // ── OfficeRunner ─────────────────────────────────────────────────────────────
  class OfficeRunner {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.W = this.canvas.width;
      this.H = this.canvas.height;
      this.groundY = this.H - 52;
      this.debug = false;

      this.state = 'idle';
      this.rawScore = 0;
      this.hiScore = +localStorage.getItem('officeRunnerHi') || 0;
      this.tick = 0;
      this.spawnTimer = 0;
      this.shakeFrames = 0;
      this.levelUpTimer = 0;
      this.levelUpText = '';
      this.lastLevel = 0;
      this.speedLines = [];

      this.player = new Player(this);
      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.bgWindows = Array.from({ length: 8 }, (_, i) => ({ x: i * 160, speed: 0.6 }));
      this.bgDesks   = Array.from({ length: 5 }, (_, i) => ({ x: i * 220 + 40, speed: 1.8 }));
      this.papers    = Array.from({ length: 14 }, () => ({
        x: Math.random() * 900, y: Math.random() * (this.groundY - 30) + 10,
        vx: -(Math.random() * 0.7 + 0.3), vy: (Math.random() - 0.5) * 0.25,
        rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.04,
        w: Math.random() * 14 + 7, h: Math.random() * 10 + 5, a: Math.random() * 0.18 + 0.04,
      }));

      this._onKey    = this._onKey.bind(this);
      this._onKeyUp  = this._onKeyUp.bind(this);
      this._onPtr    = this._onPtr.bind(this);
      this._loop     = this._loop.bind(this);
      document.addEventListener('keydown', this._onKey);
      document.addEventListener('keyup',   this._onKeyUp);
      this.canvas.addEventListener('pointerdown', this._onPtr);

      this.rafId = requestAnimationFrame(this._loop);
    }

    get displayScore() { return Math.floor(this.rawScore / 10); }
    get currentLevel() { return getLevel(this.displayScore); }

    // ── Game control ────────────────────────────────────────────────────────────
    start() {
      this.state = 'running';
      this.rawScore = 0;
      this.tick = 0;
      this.spawnTimer = 0;
      this.shakeFrames = 0;
      this.levelUpTimer = 0;
      this.lastLevel = 0;
      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.speedLines = [];
      this.player.reset();
    }

    _onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); this._jump(); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); this.player.slideStart(); }
      if (e.code === 'KeyD' && this.state === 'running') this.debug = !this.debug;
    }
    _onKeyUp(e) { if (e.code === 'ArrowDown' || e.code === 'KeyS') this.player.slideEnd(); }
    _onPtr(e) { e.preventDefault(); this._jump(); }

    _jump() {
      if (this.state === 'idle' || this.state === 'dead') this.start();
      else if (this.state === 'running') this.player.jump();
    }

    // ── Main loop ────────────────────────────────────────────────────────────────
    _loop() {
      this.rafId = requestAnimationFrame(this._loop);
      this._update();
      this._draw();
    }

    _update() {
      this._updateBg();
      if (this.state !== 'running') return;

      this.tick++;
      this.rawScore++;

      const lvl = this.currentLevel;
      const ds = this.displayScore;

      // Smooth speed interpolation within level
      const nextLvl = LEVELS[lvl.idx + 1];
      const progress = nextLvl ? (ds - lvl.min) / (nextLvl.min - lvl.min) : 1;
      const targetSpeed = lvl.speed + (nextLvl ? (nextLvl.speed - lvl.speed) * progress : 0);
      this.speed = targetSpeed;
      this.spawnInterval = lvl.interval;

      // Level-up detection
      if (lvl.idx > this.lastLevel) {
        this.lastLevel = lvl.idx;
        this.levelUpTimer = 90;
        this.levelUpText = `LEVEL UP — ${lvl.label}!`;
        this._levelUpBurst();
      }
      if (this.levelUpTimer > 0) this.levelUpTimer--;

      // Update player
      this.player.update();

      // Obstacle awareness
      const nearest = [...this.obstacles].sort((a, b) => a.x - b.x).find(o => o.x + o.w > this.player.x - 20);
      this.player.setAwareness(nearest);

      // Speed lines at high speed
      if (this.speed > 8) {
        if (Math.random() < (this.speed - 8) * 0.15) {
          this.speedLines.push({ x: this.W * 0.6 + Math.random() * this.W * 0.4, y: Math.random() * this.groundY, len: Math.random() * 60 + 20, life: 10, max: 10 });
        }
      }
      this.speedLines = this.speedLines.filter(s => { s.x -= this.speed * 2.5; s.life--; return s.life > 0 && s.x > -100; });

      // Spawn
      this.spawnTimer++;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this._spawn(lvl, ds);
        if (Math.random() < 0.38) this.coins.push(new Coin(this));
      }

      // Update obstacles
      this.obstacles = this.obstacles.filter(o => {
        o.update();
        if (this._checkHit(this.player, o)) { this._die(); return false; }
        return o.x + o.w > -30;
      });

      // Update coins
      this.coins = this.coins.filter(c => {
        c.update();
        if (this._coinHit(this.player, c)) {
          this.rawScore += 300;
          this._burst(c.x + c.w / 2, c.y + c.h / 2, '#00d4ff', 10);
          return false;
        }
        return c.x + c.w > -30;
      });

      this.particles = this.particles.filter(p => { p.update(); return p.life > 0; });
    }

    _updateBg() {
      const spd = this.state === 'running' ? (this.speed || 5) : 5;
      const r = spd / 5;
      this.bgWindows.forEach(w => { w.x -= w.speed * r; if (w.x < -160) w.x += 8 * 160; });
      this.bgDesks.forEach(d => { d.x -= d.speed * r; if (d.x < -220) d.x += 5 * 220; });
      this.papers.forEach(p => { p.x += p.vx * r; p.y += p.vy; p.rot += p.rv; if (p.x < -20) p.x = this.W + 20; });
    }

    _spawn(lvl, ds) {
      const groundTypes  = ['pen', 'books', 'chair', 'monitor', 'printer'];
      const flyingTypes  = ['flypen', 'papers', 'mug'];

      const canFly    = lvl.flying;
      const canDouble = lvl.double;

      // Pick obstacle type
      let type;
      if (canFly && Math.random() < 0.32) {
        type = flyingTypes[Math.floor(Math.random() * flyingTypes.length)];
      } else {
        type = groundTypes[Math.floor(Math.random() * groundTypes.length)];
      }

      // Random height variation for obstacles after score 400
      const heightVariant = ds >= 400 ? Math.floor(Math.random() * 3) : 0;

      this.obstacles.push(new Obstacle(this, type, heightVariant));

      // Double obstacles after score 200
      if (canDouble && Math.random() < 0.28) {
        const gap = 60 + Math.random() * 40;
        const type2 = canFly && Math.random() < 0.4
          ? flyingTypes[Math.floor(Math.random() * flyingTypes.length)]
          : groundTypes[Math.floor(Math.random() * groundTypes.length)];
        const o2 = new Obstacle(this, type2, 0);
        o2.x += gap;
        this.obstacles.push(o2);
      }
    }

    // ── Collision detection with per-entity hitboxes ──────────────────────────
    _checkHit(player, obs) {
      const pH = player.hitboxes();
      const oH = obs.hitboxes();
      for (const a of pH) {
        for (const b of oH) {
          if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return true;
        }
      }
      return false;
    }

    _coinHit(player, coin) {
      const px = player.x + 4, py = player.y + 4, pw = player.w - 8, ph = player.h - 8;
      return px < coin.x + coin.w && px + pw > coin.x && py < coin.y + coin.h && py + ph > coin.y;
    }

    _die() {
      this.state = 'dead';
      if (this.rawScore > this.hiScore) { this.hiScore = this.rawScore; localStorage.setItem('officeRunnerHi', this.hiScore); }
      this._burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ef4444', 28);
      this.shakeFrames = 10;
    }

    _burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i / n) + Math.random() * 0.5;
        const sp = Math.random() * 5 + 2;
        this.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 48, max: 48, r: Math.random()*4+2, color,
          update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.2; this.vx*=0.93; this.life--; } });
      }
    }

    _levelUpBurst() {
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * 2 * i / 16);
        this.particles.push({ x: this.W / 2, y: 30, vx: Math.cos(a)*4, vy: Math.sin(a)*4, life: 55, max: 55, r: 3, color: '#3b82f6',
          update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.05; this.life--; } });
      }
    }

    // ── Drawing ───────────────────────────────────────────────────────────────
    _draw() {
      const ctx = this.ctx, W = this.W, H = this.H;

      // Screen shake
      ctx.save();
      if (this.shakeFrames > 0) {
        const s = this.shakeFrames * 1.5;
        ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s*0.5);
        this.shakeFrames--;
      }

      // Sky
      const sky = ctx.createLinearGradient(0,0,0,this.groundY);
      sky.addColorStop(0,'#050c1c'); sky.addColorStop(1,'#0a1730');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,this.groundY);

      // Speed lines
      if (this.speedLines.length) {
        ctx.save();
        this.speedLines.forEach(sl => {
          ctx.globalAlpha = (sl.life/sl.max)*0.25;
          ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.lineTo(sl.x + sl.len, sl.y); ctx.stroke();
        });
        ctx.restore();
      }

      // Far windows
      this.bgWindows.forEach(w => this._drawWindow(ctx, w.x));
      // Papers
      this.papers.forEach(p => {
        ctx.save(); ctx.globalAlpha = p.a;
        ctx.translate(p.x+p.w/2, p.y+p.h/2); ctx.rotate(p.rot);
        ctx.fillStyle='#b8cfe8'; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      // Near desks
      this.bgDesks.forEach(d => this._drawDesk(ctx, d.x));

      // Ground
      const grd = ctx.createLinearGradient(0,this.groundY,0,H);
      grd.addColorStop(0,'#0e1e3c'); grd.addColorStop(1,'#050c1c');
      ctx.fillStyle = grd; ctx.fillRect(0,this.groundY,W,H-this.groundY);
      ctx.save(); ctx.shadowColor='#2563eb'; ctx.shadowBlur=14;
      ctx.fillStyle='#3b82f6'; ctx.fillRect(0,this.groundY,W,2);
      ctx.restore();

      // Particles
      this.particles.forEach(p => {
        ctx.save(); ctx.globalAlpha=p.life/p.max; ctx.shadowColor=p.color; ctx.shadowBlur=8;
        ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      this.coins.forEach(c => c.draw(ctx));
      this.obstacles.forEach(o => o.draw(ctx));
      this.player.draw(ctx);

      // Debug hitboxes
      if (this.debug) {
        ctx.save(); ctx.lineWidth=1;
        this.player.hitboxes().forEach(b => { ctx.strokeStyle='#22c55e'; ctx.strokeRect(b.x,b.y,b.w,b.h); });
        this.obstacles.forEach(o => o.hitboxes().forEach(b => { ctx.strokeStyle='#ef4444'; ctx.strokeRect(b.x,b.y,b.w,b.h); }));
        ctx.restore();
      }

      this._drawUI(ctx);
      ctx.restore();
    }

    _drawWindow(ctx, x) {
      ctx.save(); ctx.globalAlpha=0.2;
      ctx.fillStyle='#1a3460'; ctx.fillRect(x,18,90,108);
      [[x+5,23,34,46],[x+51,23,34,46],[x+5,75,34,47],[x+51,75,34,47]].forEach(([px,py,pw,ph]) => {
        ctx.fillStyle='#0e2450'; ctx.fillRect(px,py,pw,ph);
        ctx.fillStyle='rgba(37,99,235,0.12)'; ctx.fillRect(px,py,pw,ph);
      });
      ctx.restore();
    }

    _drawDesk(ctx, x) {
      ctx.save(); ctx.globalAlpha=0.45;
      const dy = this.groundY-38;
      ctx.fillStyle='#0f2040'; ctx.fillRect(x,dy,110,5); ctx.fillRect(x+5,dy+5,100,33);
      ctx.fillStyle='#0a1830'; ctx.fillRect(x+32,dy-38,52,36);
      ctx.fillStyle='#060e22'; ctx.fillRect(x+36,dy-34,44,28);
      ctx.fillStyle='rgba(37,99,235,0.22)'; ctx.fillRect(x+36,dy-34,44,28);
      ctx.fillStyle='#0f2040'; ctx.fillRect(x+54,dy-2,10,7);
      ctx.fillStyle='#1a3060'; ctx.fillRect(x+86,dy-16,13,14);
      ctx.fillStyle='#7c3aed'; ctx.fillRect(x+86,dy-17,13,4);
      ctx.restore();
    }

    _drawUI(ctx) {
      const W = this.W, ds = this.displayScore;
      const lvl = this.currentLevel;

      // Score
      ctx.save();
      ctx.font='bold 13px monospace'; ctx.textAlign='right';
      ctx.fillStyle='#334155'; ctx.fillText('HI '+String(Math.floor(this.hiScore/10)).padStart(5,'0'), W-70, 22);
      ctx.fillStyle='#e2e8f0'; ctx.fillText(String(ds).padStart(5,'0'), W-14, 22);
      // Level
      ctx.textAlign='left'; ctx.fillStyle='rgba(59,130,246,0.7)'; ctx.font='11px monospace';
      ctx.fillText(`LV${this.lastLevel+1} · ${lvl.label}`, 10, 20);
      ctx.restore();

      if (this.state==='idle') {
        this._txt(ctx,'🏃 LEERTASTE oder Tippen zum Starten','13px monospace','#3b82f6',W/2,this.H/2+4);
        this._txt(ctx,'↓ Pfeiltaste = Slide','11px monospace','#475569',W/2,this.H/2+22);
      }

      if (this.state==='dead') {
        ctx.save();
        ctx.fillStyle='rgba(5,12,28,0.85)';
        this._rrect(ctx,W/2-135,this.H/2-50,270,90,10); ctx.fill();
        ctx.strokeStyle='rgba(59,130,246,0.4)'; ctx.lineWidth=1;
        this._rrect(ctx,W/2-135,this.H/2-50,270,90,10); ctx.stroke();
        ctx.restore();
        this._txt(ctx,'GAME OVER','bold 20px monospace','#ef4444',W/2,this.H/2-20);
        this._txt(ctx,'Punkte: '+ds,'bold 13px monospace','#e2e8f0',W/2,this.H/2+2);
        this._txt(ctx,'↵ Nochmal spielen','12px monospace','#3b82f6',W/2,this.H/2+22);
        this._txt(ctx,'[D] Debug','10px monospace','#334155',W/2,this.H/2+38);
      }

      // Level-up flash
      if (this.levelUpTimer>0) {
        const a = Math.min(1, this.levelUpTimer/20);
        ctx.save(); ctx.globalAlpha=a;
        ctx.font='bold 17px monospace'; ctx.textAlign='center'; ctx.fillStyle='#60a5fa';
        ctx.shadowColor='#3b82f6'; ctx.shadowBlur=18;
        ctx.fillText(this.levelUpText, W/2, 44);
        ctx.restore();
      }
    }

    _txt(ctx,text,font,color,x,y){ctx.save();ctx.font=font;ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,x,y);ctx.restore();}
    _rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      document.removeEventListener('keydown', this._onKey);
      document.removeEventListener('keyup',   this._onKeyUp);
      if (this.canvas) this.canvas.removeEventListener('pointerdown', this._onPtr);
    }
  }

  // ── Player ─────────────────────────────────────────────────────────────────
  class Player {
    constructor(game) {
      this.game = game;
      this.w = 30; this.h = 54;
      this.reset();
      this.frame = 0; this.ft = 0;
      this.lookAngle = 0;         // current head tilt (degrees)
      this.targetLookAngle = 0;
      this.focused = false;
      this.landTimer = 0;         // squash on landing
      this.anticipate = 0;        // crouch frames before jump
      this.slideTimer = 0;
    }

    reset() { this.x=80; this.y=this.game.groundY-this.h; this.vy=0; this.jumping=false; this.sliding=false; }

    hitboxes() {
      if (this.sliding) {
        return [{ x:this.x+2, y:this.game.groundY-22, w:this.w-4, h:20 }];
      }
      return [
        { x:this.x+5,  y:this.y,       w:this.w-10, h:20 },   // head
        { x:this.x+3,  y:this.y+18,    w:this.w-6,  h:24 },   // body
        { x:this.x+4,  y:this.y+40,    w:this.w-8,  h:14 },   // legs/feet
      ];
    }

    jump() {
      if (this.sliding) { this.slideEnd(); return; }
      if (!this.jumping) {
        this.anticipate = 3;  // brief crouch
        setTimeout(() => { this.vy = -13.5; this.jumping = true; }, 30);
      }
    }
    slideStart() { if (!this.jumping) { this.sliding=true; this.slideTimer=36; } }
    slideEnd()   { this.sliding=false; this.slideTimer=0; }

    setAwareness(nearest) {
      if (!nearest) { this.targetLookAngle=0; this.focused=false; return; }
      const dist = nearest.x - (this.x + this.w);
      if (dist > 180) { this.targetLookAngle=0; this.focused=false; return; }
      const t = 1 - dist/180;
      this.focused = dist < 110;
      if (nearest.isFlying) {
        this.targetLookAngle = -14 * t;   // look up
      } else {
        this.targetLookAngle = 8 * t;     // look forward/down
      }
    }

    update() {
      // Slide timer
      if (this.sliding) { if (--this.slideTimer <= 0) this.slideEnd(); }
      if (this.anticipate > 0) this.anticipate--;

      this.lookAngle += (this.targetLookAngle - this.lookAngle) * 0.14;
      if (this.landTimer > 0) this.landTimer--;

      this.vy += 0.65;
      this.y += this.vy;
      const floor = this.game.groundY - this.h;
      if (this.y >= floor) {
        if (this.vy > 3) this.landTimer = 5; // landing squash
        this.y = floor; this.vy = 0; this.jumping = false;
      }

      if (!this.jumping && !this.sliding) {
        if (++this.ft > 7) { this.frame = (this.frame+1)%4; this.ft=0; }
      }
    }

    draw(ctx) {
      const { x, w, landTimer, anticipate, sliding, jumping, frame, focused } = this;
      const gY = this.game.groundY;

      // Squash on landing or anticipation
      const squash = landTimer > 0 ? 1 + landTimer*0.04 : anticipate > 0 ? 1.08 : 1;
      const stretch = landing => sliding ? 1 : 1/squash;
      const baseH = this.h;
      const dh = baseH * squash;
      const y = sliding ? gY - 26 : this.y - (dh - baseH);

      ctx.save();

      // Shadow
      ctx.globalAlpha=0.22; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(x+w/2,gY+3,w/2+2,5,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;

      if (sliding) {
        // Slide pose — very flat
        ctx.save();
        ctx.translate(x+w/2, gY-14);
        // Body horizontal
        ctx.fillStyle='#1a2638'; ctx.fillRect(-22,-8,44,16);
        // Head forward
        ctx.fillStyle='#f5c5a0'; ctx.beginPath(); ctx.ellipse(24,-4,11,10,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1a2638'; ctx.beginPath(); ctx.ellipse(24,-10,11,6,0,Math.PI,0); ctx.fill();
        ctx.fillStyle='#0f172a'; ctx.fillRect(18,-6,5,3); ctx.fillRect(26,-6,5,3);
        // Shoes
        ctx.fillStyle='#0a0f1a'; ctx.fillRect(-26,-6,12,8);
        ctx.restore();
        ctx.restore(); return;
      }

      // Legs
      const lp = jumping ? 0 : Math.sin(frame*Math.PI/2);
      const l1=lp*9, l2=-lp*9;
      ctx.fillStyle='#1a2638';
      ctx.fillRect(x+5, y+dh-22+l1, 9, 22*squash);
      ctx.fillStyle='#0a0f1a';
      ctx.fillRect(x+3, y+dh-3+l1, 13, 5);
      ctx.fillStyle='#1a2638';
      ctx.fillRect(x+16, y+dh-22+l2, 9, 22*squash);
      ctx.fillStyle='#0a0f1a';
      ctx.fillRect(x+14, y+dh-3+l2, 13, 5);

      // Body
      ctx.fillStyle='#1a2638';
      ctx.fillRect(x+2, y+16, w-4, dh-38);
      ctx.fillStyle='#f1f5f9'; ctx.fillRect(x+10,y+16,10,20);
      ctx.fillStyle='#2563eb'; ctx.fillRect(x+13,y+17,5,18);
      ctx.fillStyle='#3b82f6'; ctx.fillRect(x+14,y+17,2,8);
      // Lapels
      ctx.fillStyle='#0f1a2e';
      ctx.beginPath(); ctx.moveTo(x+2,y+16); ctx.lineTo(x+10,y+22); ctx.lineTo(x+10,y+16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x+w-2,y+16); ctx.lineTo(x+w-10,y+22); ctx.lineTo(x+w-10,y+16); ctx.fill();

      // Arms
      const swing = jumping ? -18 : lp*14;
      ctx.save(); ctx.translate(x+1,y+20); ctx.rotate((-22+swing)*Math.PI/180);
      ctx.fillStyle='#1a2638'; ctx.fillRect(-4,0,8,18); ctx.fillStyle='#f1f5f9'; ctx.fillRect(-4,14,8,5); ctx.restore();
      ctx.save(); ctx.translate(x+w-1,y+20); ctx.rotate((22-swing)*Math.PI/180);
      ctx.fillStyle='#1a2638'; ctx.fillRect(-4,0,8,18); ctx.fillStyle='#f1f5f9'; ctx.fillRect(-4,14,8,5); ctx.restore();

      // Head with awareness tilt
      ctx.save();
      ctx.translate(x+w/2, y+9);
      ctx.rotate(this.lookAngle * Math.PI/180);
      // Head
      ctx.fillStyle='#f5c5a0';
      ctx.beginPath(); ctx.ellipse(0,0,12,13,0,0,Math.PI*2); ctx.fill();
      // Hair
      ctx.fillStyle='#1a2638';
      ctx.beginPath(); ctx.ellipse(0,-8,12,8,0,Math.PI,0); ctx.fill();
      // Eyes — stressed or focused
      ctx.fillStyle='#0f172a';
      if (focused) {
        // Squinting — focused eyes
        ctx.fillRect(-9,-1,6,3); ctx.fillRect(3,-1,6,3);
        // Worried eyebrows
        ctx.strokeStyle='#0f172a'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(-9,-4); ctx.lineTo(-3,-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9,-4); ctx.lineTo(3,-6); ctx.stroke();
      } else {
        ctx.fillRect(-9,-1,6,4); ctx.fillRect(3,-1,6,4);
      }
      // Mouth
      ctx.strokeStyle='#0f172a'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(0,7, focused?4:3, 0, Math.PI); ctx.stroke();
      ctx.restore();

      // Sweat when jumping/focused
      if (jumping || focused) {
        ctx.save(); ctx.shadowColor='#93c5fd'; ctx.shadowBlur=5;
        ctx.fillStyle='#93c5fd';
        ctx.beginPath(); ctx.arc(x+w+3, y+3, 3, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ── Obstacle ───────────────────────────────────────────────────────────────
  class Obstacle {
    constructor(game, type, heightVariant=0) {
      this.game = game; this.type = type;
      this.wobble = 0; this.isFlying = false;

      const G = game.groundY;
      const sizes = {
        pen:     [46,12], books:  [26,44], chair:  [38,46],
        monitor: [42,40], printer:[50,34], flypen: [48,10],
        papers:  [34,28], mug:    [20,24],
      };
      [this.w, this.h] = sizes[type] || [30,40];
      this.x = game.W + 20;

      if (type==='flypen') {
        this.isFlying=true;
        const heights = [G-80, G-60, G-45]; // 3 possible heights
        this.y = heights[heightVariant % heights.length];
      } else if (type==='papers') {
        this.isFlying=true;
        const heights = [G-90, G-65, G-50];
        this.y = heights[heightVariant % heights.length];
      } else if (type==='mug') {
        this.isFlying=true;
        const heights = [G-70, G-55, G-42];
        this.y = heights[heightVariant % heights.length];
      } else {
        this.y = G - this.h;
      }
    }

    hitboxes() {
      const {x,y,w,h,type} = this;
      switch(type) {
        case 'pen':     return [{x:x+2, y:y+1,  w:w-4,  h:h-2}];
        case 'books':   return [{x:x+2, y:y+4,  w:w-4,  h:h-4}];
        case 'chair':   return [{x:x+4,y:y+18,w:w-8,h:8},{x:x+4,y:y+2,w:8,h:18},{x:x+4,y:y+26,w:5,h:h-26},{x:x+w-9,y:y+26,w:5,h:h-26}];
        case 'monitor': return [{x:x+2, y:y+2,  w:w-4,  h:h-12},{x:x+8,y:y+h-10,w:w-16,h:10}];
        case 'printer': return [{x:x+2, y:y+2,  w:w-4,  h:h-4}];
        case 'flypen':  return [{x:x+2, y:y+1,  w:w-4,  h:h-2}];
        case 'papers':  return [{x:x+4, y:y+4,  w:w-8,  h:h-8}];
        case 'mug':     return [{x:x+3, y:y+3,  w:w-6,  h:h-6}];
        default:        return [{x:x+3, y:y+3,  w:w-6,  h:h-6}];
      }
    }

    update() { this.x -= this.game.speed; this.wobble += 0.1; }

    draw(ctx) {
      ctx.save(); ctx.shadowColor='#1d4ed8'; ctx.shadowBlur=10;
      this['_d_'+this.type]?.(ctx) ?? this._d_pen(ctx);
      ctx.restore();
    }

    _d_pen(ctx) {
      const {x,y,w,h}=this;
      ctx.fillStyle='#2563eb'; ctx.fillRect(x,y,w-10,h);
      ctx.fillStyle='#93c5fd'; ctx.fillRect(x,y,10,h);
      ctx.fillStyle='#1d4ed8';
      ctx.beginPath(); ctx.moveTo(x+w-10,y); ctx.lineTo(x+w,y+h/2); ctx.lineTo(x+w-10,y+h); ctx.fill();
      ctx.fillStyle='#0f172a'; ctx.fillRect(x+w-12,y+h-2,14,3);
    }
    _d_books(ctx) {
      const {x,y,w}=this;
      ['#1d4ed8','#2563eb','#3b82f6'].forEach((c,i) => {
        ctx.fillStyle=c; ctx.fillRect(x+i*2,y+i*13,w-i*4,13);
        ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+i*2,y+i*13,4,13);
      });
    }
    _d_chair(ctx) {
      const {x,y,w,h}=this;
      ctx.fillStyle='#1e3a5f';
      ctx.fillRect(x+5,y+18,w-10,8); ctx.fillRect(x+5,y,10,20);
      ctx.fillRect(x+5,y+26,6,h-26); ctx.fillRect(x+w-11,y+26,6,h-26);
      ctx.fillStyle='#0f172a';
      ctx.beginPath(); ctx.arc(x+8,y+h,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+w-9,y+h,5,0,Math.PI*2); ctx.fill();
    }
    _d_monitor(ctx) {
      const {x,y,w,h}=this;
      ctx.fillStyle='#0d2040'; ctx.fillRect(x,y,w,h-8);
      ctx.fillStyle='#060d1a'; ctx.fillRect(x+4,y+4,w-8,h-16);
      ctx.fillStyle='rgba(37,99,235,0.5)'; ctx.fillRect(x+4,y+4,w-8,h-16);
      ctx.fillStyle='#1e3a5f'; ctx.fillRect(x+w/2-5,y+h-8,10,8); ctx.fillRect(x+6,y+h,w-12,4);
    }
    _d_printer(ctx) {
      const {x,y,w,h}=this;
      ctx.fillStyle='#1a3050'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#0d1e38'; ctx.fillRect(x+4,y+4,w-8,10);
      ctx.fillStyle='#f8fafc'; ctx.fillRect(x+6,y+h-6,w-12,5);
      ctx.fillStyle='#fef9c3';
      ctx.save(); ctx.translate(x+14,y-8); ctx.rotate(Math.sin(this.wobble)*0.08);
      ctx.fillRect(0,0,14,18); ctx.fillStyle='#fbbf24'; ctx.fillRect(0,0,14,3); ctx.restore();
    }
    _d_flypen(ctx) {
      const {x,y,w,h}=this;
      // Neon flying pen
      ctx.save(); ctx.shadowColor='#60a5fa'; ctx.shadowBlur=14;
      ctx.fillStyle='#3b82f6'; ctx.fillRect(x,y,w-8,h);
      ctx.fillStyle='#bfdbfe'; ctx.fillRect(x,y,8,h);
      ctx.fillStyle='#1d4ed8';
      ctx.beginPath(); ctx.moveTo(x+w-8,y); ctx.lineTo(x+w,y+h/2); ctx.lineTo(x+w-8,y+h); ctx.fill();
      // Neon trail
      for(let i=1;i<=4;i++){ctx.globalAlpha=0.08*i; ctx.fillStyle='#3b82f6'; ctx.fillRect(x+i*8,y,w-8,h);}
      ctx.restore();
    }
    _d_papers(ctx) {
      const {x,y,w,h}=this;
      ctx.save(); ctx.shadowColor='#93c5fd'; ctx.shadowBlur=8;
      [0,8,16].forEach(off=>{
        ctx.save(); ctx.translate(x+w/2+off,y+h/2);
        ctx.rotate(Math.sin(this.wobble+off)*0.3);
        ctx.fillStyle='#e2e8f0'; ctx.globalAlpha=0.9-off*0.08;
        ctx.fillRect(-w/2+2,-h/2+2,w-4,h-4);
        ctx.fillStyle='#94a3b8'; ctx.fillRect(-w/2+4,-h/2+4,w/2,2); ctx.fillRect(-w/2+4,-h/2+8,w/3,2);
        ctx.restore();
      });
      ctx.restore();
    }
    _d_mug(ctx) {
      const {x,y,w,h}=this;
      ctx.save(); ctx.shadowColor='#a78bfa'; ctx.shadowBlur=10;
      ctx.fillStyle='#1e3a5f'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#7c3aed'; ctx.fillRect(x,y,w,5);
      // Coffee
      ctx.fillStyle='#4a2c0a'; ctx.fillRect(x+2,y+5,w-4,6);
      // Handle
      ctx.strokeStyle='#1e3a5f'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x+w+4,y+h/2,6,Math.PI*0.4,Math.PI*1.6); ctx.stroke();
      // Steam
      ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(x+6,y-4); ctx.quadraticCurveTo(x+4,y-10,x+6,y-16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+12,y-6); ctx.quadraticCurveTo(x+10,y-12,x+12,y-18); ctx.stroke();
      ctx.restore();
    }
  }

  // ── Coin (AI Cube) ──────────────────────────────────────────────────────────
  class Coin {
    constructor(game) {
      this.game=game; this.w=18; this.h=18;
      this.x=game.W+20;
      this.y=game.groundY-58-Math.random()*50;
      this.t=Math.random()*Math.PI*2;
    }
    update() { this.x-=this.game.speed; this.t+=0.08; }
    draw(ctx) {
      const g=Math.sin(this.t)*0.3+0.7;
      ctx.save(); ctx.shadowColor='#00d4ff'; ctx.shadowBlur=14*g; ctx.globalAlpha=g;
      ctx.fillStyle='#00d4ff'; ctx.fillRect(this.x,this.y,this.w,this.h);
      ctx.fillStyle='rgba(255,255,255,0.32)'; ctx.fillRect(this.x,this.y,this.w,5); ctx.fillRect(this.x,this.y,5,this.h);
      ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(this.x+this.w-5,this.y,5,this.h);
      ctx.fillStyle='#003344'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
      ctx.fillText('AI',this.x+this.w/2,this.y+12);
      ctx.restore();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  window.OfficeRunner = OfficeRunner;
  window.initOfficeRunner = function(canvasId) {
    const key = '_officeRunner_'+canvasId;
    if (window[key]) { window[key].destroy(); }
    window[key] = new OfficeRunner(canvasId);
    if (canvasId === 'game-canvas') window._officeRunnerInstance = window[key];
    return window[key];
  };
  window.destroyOfficeRunner = function() {
    if (window._officeRunnerInstance) { window._officeRunnerInstance.destroy(); window._officeRunnerInstance=null; }
  };
})();
