// Office Runner — Endless runner game shown during PDF analysis
(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const GRAVITY = 0.65;
  const JUMP_FORCE = -13.5;
  const BASE_SPEED = 5;
  const MAX_SPEED = 15;
  const GROUND_H = 52;

  // ─── OfficeRunner ─────────────────────────────────────────────────────────
  class OfficeRunner {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.W = this.canvas.width;
      this.H = this.canvas.height;
      this.groundY = this.H - GROUND_H;

      this.state = 'idle'; // idle | running | dead
      this.score = 0;
      this.hiScore = +localStorage.getItem('officeRunnerHi') || 0;
      this.speed = BASE_SPEED;
      this.tick = 0;
      this.spawnTimer = 0;
      this.spawnInterval = 100;

      this.player = new Player(this);
      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.bgWindows = this._initWindows();
      this.bgDesks = this._initDesks();
      this.floatingPapers = this._initPapers();

      this._onKey = this._onKey.bind(this);
      this._onPointer = this._onPointer.bind(this);
      this._loop = this._loop.bind(this);
      document.addEventListener('keydown', this._onKey);
      this.canvas.addEventListener('pointerdown', this._onPointer);

      this.rafId = requestAnimationFrame(this._loop);
    }

    // ── Background init ──────────────────────────────────────────────────────
    _initWindows() {
      return Array.from({ length: 8 }, (_, i) => ({ x: i * 160, speed: 0.6 }));
    }
    _initDesks() {
      return Array.from({ length: 5 }, (_, i) => ({ x: i * 220 + 40, speed: 1.8 }));
    }
    _initPapers() {
      return Array.from({ length: 12 }, (_, i) => ({
        x: Math.random() * 800, y: Math.random() * (this.groundY - 40) + 10,
        vx: -(Math.random() * 0.8 + 0.3), vy: Math.random() * 0.4 - 0.2,
        rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.04,
        w: Math.random() * 12 + 8, h: Math.random() * 10 + 6, alpha: Math.random() * 0.18 + 0.06,
      }));
    }

    // ── Game control ─────────────────────────────────────────────────────────
    start() {
      this.state = 'running';
      this.score = 0;
      this.speed = BASE_SPEED;
      this.tick = 0;
      this.spawnTimer = 0;
      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.player.reset();
    }

    _onKey(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); this._action(); }
    }
    _onPointer(e) { e.preventDefault(); this._action(); }
    _action() {
      if (this.state === 'idle' || this.state === 'dead') this.start();
      else if (this.state === 'running') this.player.jump();
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    _loop() {
      this.rafId = requestAnimationFrame(this._loop);
      this._update();
      this._draw();
    }

    _update() {
      this._updateBg();
      if (this.state !== 'running') return;

      this.tick++;
      this.score++;
      this.speed = Math.min(BASE_SPEED + this.tick / 400, MAX_SPEED);
      this.spawnInterval = Math.max(48, 100 - this.tick / 80);

      this.player.update();

      // Spawn
      this.spawnTimer++;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        const types = ['pen', 'books', 'chair', 'monitor', 'printer', 'cable'];
        this.obstacles.push(new Obstacle(this, types[Math.floor(Math.random() * types.length)]));
        if (Math.random() < 0.45) this.coins.push(new Coin(this));
      }

      // Update obstacles
      this.obstacles = this.obstacles.filter(o => {
        o.update();
        if (this._hit(this.player, o)) { this._die(); return false; }
        return o.x + o.w > -20;
      });

      // Update coins
      this.coins = this.coins.filter(c => {
        c.update();
        if (this._hit(this.player, c)) {
          this.score += 50;
          this._burst(c.x + c.w / 2, c.y + c.h / 2, '#00d4ff', 10);
          return false;
        }
        return c.x + c.w > -20;
      });

      this.particles = this.particles.filter(p => { p.update(); return p.life > 0; });
    }

    _updateBg() {
      const spd = this.state === 'running' ? this.speed : BASE_SPEED;
      this.bgWindows.forEach(w => { w.x -= w.speed * (spd / BASE_SPEED); if (w.x < -160) w.x += 8 * 160; });
      this.bgDesks.forEach(d => { d.x -= d.speed * (spd / BASE_SPEED); if (d.x < -220) d.x += 5 * 220; });
      this.floatingPapers.forEach(p => {
        p.x += p.vx * (spd / BASE_SPEED);
        p.y += p.vy;
        p.rot += p.rotV;
        if (p.x < -20) p.x = this.W + 20;
      });
    }

    _hit(a, b) {
      const m = 7;
      return a.x + m < b.x + b.w - m && a.x + a.w - m > b.x + m &&
             a.y + m < b.y + b.h - m && a.y + a.h - m > b.y + m;
    }

    _die() {
      this.state = 'dead';
      if (this.score > this.hiScore) { this.hiScore = this.score; localStorage.setItem('officeRunnerHi', this.hiScore); }
      this._burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ef4444', 24);
    }

    _burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const sp = Math.random() * 5 + 2;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 45, max: 45, r: Math.random() * 4 + 2, color,
          update() { this.x += this.vx; this.y += this.vy; this.vy += 0.18; this.vx *= 0.94; this.life--; } });
      }
    }

    // ── Drawing ───────────────────────────────────────────────────────────────
    _draw() {
      const ctx = this.ctx, W = this.W, H = this.H;

      // Sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
      g.addColorStop(0, '#060d1f');
      g.addColorStop(1, '#0b1a38');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, this.groundY);

      // Far windows
      this.bgWindows.forEach(w => this._drawWindow(ctx, w.x));

      // Floating papers
      this.floatingPapers.forEach(p => {
        ctx.save(); ctx.globalAlpha = p.alpha;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        ctx.fillStyle = '#c8d8f0';
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      // Near desks
      this.bgDesks.forEach(d => this._drawDesk(ctx, d.x));

      // Ground
      const gg = ctx.createLinearGradient(0, this.groundY, 0, H);
      gg.addColorStop(0, '#0f2040');
      gg.addColorStop(1, '#060d1f');
      ctx.fillStyle = gg;
      ctx.fillRect(0, this.groundY, W, GROUND_H);

      // Neon ground line
      ctx.save();
      ctx.shadowColor = '#2563eb'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, this.groundY, W, 2);
      ctx.restore();

      // Particles
      this.particles.forEach(p => {
        ctx.save(); ctx.globalAlpha = p.life / p.max;
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Game objects
      this.coins.forEach(c => c.draw(ctx));
      this.obstacles.forEach(o => o.draw(ctx));
      this.player.draw(ctx);

      // UI
      this._drawUI(ctx);
    }

    _drawWindow(ctx, x) {
      ctx.save(); ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#1a3460';
      ctx.fillRect(x, 15, 90, 110);
      const panes = [[x+5,20,35,48],[x+50,20,35,48],[x+5,74,35,47],[x+50,74,35,47]];
      panes.forEach(([px,py,pw,ph]) => {
        ctx.fillStyle = '#102a55';
        ctx.fillRect(px, py, pw, ph);
        // Window glow tint
        ctx.fillStyle = 'rgba(37,99,235,0.15)';
        ctx.fillRect(px, py, pw, ph);
      });
      ctx.restore();
    }

    _drawDesk(ctx, x) {
      ctx.save(); ctx.globalAlpha = 0.5;
      const deskY = this.groundY - 38;
      // Desktop
      ctx.fillStyle = '#112240';
      ctx.fillRect(x, deskY, 110, 5);
      ctx.fillRect(x + 5, deskY + 5, 100, 33);
      // Monitor
      ctx.fillStyle = '#0d1e38';
      ctx.fillRect(x + 32, deskY - 38, 52, 36);
      ctx.fillStyle = '#060f22';
      ctx.fillRect(x + 36, deskY - 34, 44, 28);
      ctx.fillStyle = 'rgba(37,99,235,0.25)';
      ctx.fillRect(x + 36, deskY - 34, 44, 28);
      // Stand
      ctx.fillStyle = '#112240';
      ctx.fillRect(x + 55, deskY - 2, 8, 7);
      // Coffee mug
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(x + 88, deskY - 16, 12, 14);
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(x + 88, deskY - 17, 12, 4);
      ctx.restore();
    }

    _drawUI(ctx) {
      const W = this.W;
      ctx.save();
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#475569';
      ctx.fillText('HI ' + String(Math.floor(this.hiScore / 10)).padStart(5, '0'), W - 68, 22);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(String(Math.floor(this.score / 10)).padStart(5, '0'), W - 14, 22);
      ctx.restore();

      if (this.state === 'idle') {
        this._txt(ctx, '🏃 LEERTASTE oder Tippen zum Starten', '13px monospace', '#3b82f6', W / 2, this.H / 2 + 4);
      }

      if (this.state === 'dead') {
        ctx.save();
        ctx.fillStyle = 'rgba(6,13,31,0.82)';
        this._roundRect(ctx, W / 2 - 130, this.H / 2 - 44, 260, 84, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 1;
        this._roundRect(ctx, W / 2 - 130, this.H / 2 - 44, 260, 84, 10);
        ctx.stroke();
        ctx.restore();
        this._txt(ctx, 'GAME OVER', 'bold 20px monospace', '#ef4444', W / 2, this.H / 2 - 16);
        this._txt(ctx, 'Punkte: ' + Math.floor(this.score / 10), 'bold 13px monospace', '#e2e8f0', W / 2, this.H / 2 + 6);
        this._txt(ctx, '↵ Nochmal spielen', '12px monospace', '#3b82f6', W / 2, this.H / 2 + 26);
      }
    }

    _txt(ctx, text, font, color, x, y) {
      ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
      ctx.fillText(text, x, y); ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      document.removeEventListener('keydown', this._onKey);
      if (this.canvas) this.canvas.removeEventListener('pointerdown', this._onPointer);
    }
  }

  // ─── Player ────────────────────────────────────────────────────────────────
  class Player {
    constructor(game) {
      this.game = game;
      this.w = 30; this.h = 54;
      this.reset();
      this.frame = 0; this.ft = 0;
    }
    reset() {
      this.x = 80;
      this.y = this.game.groundY - this.h;
      this.vy = 0; this.jumping = false;
    }
    jump() {
      if (!this.jumping) { this.vy = JUMP_FORCE; this.jumping = true; }
    }
    update() {
      this.vy += GRAVITY;
      this.y += this.vy;
      const floor = this.game.groundY - this.h;
      if (this.y >= floor) { this.y = floor; this.vy = 0; this.jumping = false; }
      if (!this.jumping) { if (++this.ft > 7) { this.frame = (this.frame + 1) % 4; this.ft = 0; } }
    }
    draw(ctx) {
      const { x, y, w, h, frame, jumping } = this;
      ctx.save();

      // Ground shadow
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x + w / 2, this.game.groundY + 3, w / 2 + 2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // Leg animation
      const lp = jumping ? 0 : Math.sin(frame * Math.PI / 2);
      const l1 = lp * 9, l2 = -lp * 9;
      // Leg 1
      ctx.fillStyle = '#1a2638';
      ctx.fillRect(x + 5, y + h - 20 + l1, 9, 20);
      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(x + 3, y + h - 2 + l1, 13, 5);
      // Leg 2
      ctx.fillStyle = '#1a2638';
      ctx.fillRect(x + 16, y + h - 20 + l2, 9, 20);
      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(x + 14, y + h - 2 + l2, 13, 5);

      // Body / suit
      ctx.fillStyle = '#1a2638';
      ctx.fillRect(x + 2, y + 16, w - 4, h - 36);

      // White shirt
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x + 10, y + 16, 10, 20);
      // Tie (neon blue!)
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 13, y + 17, 5, 18);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + 14, y + 17, 2, 8);

      // Left lapel
      ctx.fillStyle = '#0f1a2e';
      ctx.beginPath(); ctx.moveTo(x+2,y+16); ctx.lineTo(x+10,y+22); ctx.lineTo(x+10,y+16); ctx.fill();
      // Right lapel
      ctx.beginPath(); ctx.moveTo(x+w-2,y+16); ctx.lineTo(x+w-10,y+22); ctx.lineTo(x+w-10,y+16); ctx.fill();

      // Arms
      const swing = jumping ? -18 : lp * 14;
      // Left arm
      ctx.save(); ctx.translate(x + 1, y + 20); ctx.rotate((-22 + swing) * Math.PI / 180);
      ctx.fillStyle = '#1a2638'; ctx.fillRect(-4, 0, 8, 18);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(-4, 14, 8, 5); ctx.restore();
      // Right arm
      ctx.save(); ctx.translate(x + w - 1, y + 20); ctx.rotate((22 - swing) * Math.PI / 180);
      ctx.fillStyle = '#1a2638'; ctx.fillRect(-4, 0, 8, 18);
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(-4, 14, 8, 5); ctx.restore();

      // Head
      ctx.fillStyle = '#f5c5a0';
      ctx.beginPath(); ctx.ellipse(x + w/2, y + 9, 12, 13, 0, 0, Math.PI * 2); ctx.fill();

      // Hair
      ctx.fillStyle = '#1a2638';
      ctx.beginPath(); ctx.ellipse(x + w/2, y + 1, 12, 8, 0, Math.PI, 0); ctx.fill();

      // Stressed eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + w/2 - 9, y + 8, 6, 4);
      ctx.fillRect(x + w/2 + 3, y + 8, 6, 4);
      // Worried mouth
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + w/2, y + 17, 3, 0, Math.PI); ctx.stroke();

      // Sweat when jumping
      if (jumping) {
        ctx.save(); ctx.shadowColor = '#93c5fd'; ctx.shadowBlur = 4;
        ctx.fillStyle = '#93c5fd';
        ctx.beginPath(); ctx.arc(x + w + 2, y + 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ─── Obstacle ──────────────────────────────────────────────────────────────
  class Obstacle {
    constructor(game, type) {
      this.game = game; this.type = type;
      const sizes = { pen:[46,14], books:[26,44], chair:[38,46], monitor:[42,40], printer:[50,34], cable:[18,56] };
      [this.w, this.h] = sizes[type] || [30, 40];
      this.x = game.W + 20;
      this.y = game.groundY - this.h;
      this.wobble = 0;
    }
    update() { this.x -= this.game.speed; this.wobble += 0.12; }
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = '#1d4ed8'; ctx.shadowBlur = 10;
      this['_draw_' + this.type](ctx);
      ctx.restore();
    }
    _draw_pen(ctx) {
      const { x, y, w, h } = this;
      ctx.fillStyle = '#2563eb'; ctx.fillRect(x, y, w - 10, h);
      ctx.fillStyle = '#93c5fd'; ctx.fillRect(x, y, 10, h);
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath(); ctx.moveTo(x+w-10,y); ctx.lineTo(x+w,y+h/2); ctx.lineTo(x+w-10,y+h); ctx.fill();
      // Clip at bottom
      ctx.fillStyle = '#0f172a'; ctx.fillRect(x+w-12,y+h-3,14,4);
    }
    _draw_books(ctx) {
      const { x, y, w } = this;
      const cols = ['#1d4ed8','#2563eb','#3b82f6'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        ctx.fillRect(x + i * 2, y + i * 13, w - i * 4, 13);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + i * 2, y + i * 13, 4, 13);
      }
    }
    _draw_chair(ctx) {
      const { x, y, w, h } = this;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(x + 5, y + 18, w - 10, 8); // seat
      ctx.fillRect(x + 5, y, 10, 20);           // back
      ctx.fillRect(x + 5, y + 26, 6, h - 26);  // left leg
      ctx.fillRect(x + w - 11, y + 26, 6, h - 26); // right leg
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(x+8, y+h, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+w-9, y+h, 5, 0, Math.PI*2); ctx.fill();
    }
    _draw_monitor(ctx) {
      const { x, y, w, h } = this;
      ctx.fillStyle = '#0d2040';
      ctx.fillRect(x, y, w, h - 8);
      ctx.fillStyle = '#060d1a';
      ctx.fillRect(x + 4, y + 4, w - 8, h - 16);
      ctx.fillStyle = 'rgba(37,99,235,0.5)';
      ctx.fillRect(x + 4, y + 4, w - 8, h - 16);
      // Stand
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(x + w/2 - 5, y + h - 8, 10, 8);
      ctx.fillRect(x + 6, y + h, w - 12, 4);
    }
    _draw_printer(ctx) {
      const { x, y, w, h } = this;
      ctx.fillStyle = '#1a3050'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#0d1e38'; ctx.fillRect(x+4, y+4, w-8, 10);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(x+6, y+h-6, w-12, 5);
      // Jammed paper sticking out
      ctx.fillStyle = '#fef9c3';
      ctx.save(); ctx.translate(x+14, y-8);
      ctx.rotate(Math.sin(this.wobble) * 0.08);
      ctx.fillRect(0, 0, 14, 18);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, 0, 14, 3);
      ctx.restore();
    }
    _draw_cable(ctx) {
      const { x, y, w } = this;
      // Hanging cable from top
      ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + w/2, 0);
      for (let i = 0; i < 5; i++) {
        const sx = x + w/2 + Math.sin(i * 1.2 + this.wobble) * 8;
        ctx.lineTo(sx, i * (this.game.groundY / 5));
      }
      ctx.stroke();
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath(); ctx.arc(x + w/2, this.game.groundY - 4, 5, 0, Math.PI*2); ctx.fill();
    }
  }

  // ─── Coin (AI Cube) ────────────────────────────────────────────────────────
  class Coin {
    constructor(game) {
      this.game = game;
      this.w = 18; this.h = 18;
      this.x = game.W + 20;
      this.y = game.groundY - 55 - Math.random() * 50;
      this.t = Math.random() * Math.PI * 2;
    }
    update() { this.x -= this.game.speed; this.t += 0.08; }
    draw(ctx) {
      const g = Math.sin(this.t) * 0.35 + 0.65;
      ctx.save();
      ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 14 * g;
      ctx.globalAlpha = g;
      ctx.fillStyle = '#00d4ff';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(this.x, this.y, this.w, 5);
      ctx.fillRect(this.x, this.y, 5, this.h);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(this.x + this.w - 5, this.y, 5, this.h);
      // "AI" text on cube
      ctx.globalAlpha = g * 0.8;
      ctx.fillStyle = '#003344';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AI', this.x + this.w / 2, this.y + 12);
      ctx.restore();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.OfficeRunner = OfficeRunner;
  window.initOfficeRunner = function (canvasId) {
    if (window._officeRunnerInstance) { window._officeRunnerInstance.destroy(); }
    window._officeRunnerInstance = new OfficeRunner(canvasId);
    return window._officeRunnerInstance;
  };
  window.destroyOfficeRunner = function () {
    if (window._officeRunnerInstance) { window._officeRunnerInstance.destroy(); window._officeRunnerInstance = null; }
  };
})();
