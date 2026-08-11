/* ============================================================================
 *  confetti.js — a small pooled particle system on a 2D canvas
 *  ---------------------------------------------------------------------------
 *  Pooled, so a confetti storm never allocates mid-animation. Shapes are drawn
 *  as simple rounded rectangles and circles with a spin, which reads as paper
 *  without costing anything. Disabled entirely on the low quality tier and
 *  under prefers-reduced-motion.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var COLORS = ['#FFD84D', '#FF8FB1', '#9BE8C8', '#7EC8E3', '#C9A7F5', '#FFF8EE', '#FF9F6B'];

  function Confetti(canvas, max) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.max = max || 160;
    this.pool = [];
    this.live = 0;
    this.dpr = 1;
    for (var i = 0; i < this.max; i++) {
      this.pool.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vrot: 0,
                       size: 0, color: '#fff', life: 0, maxLife: 1, round: false });
    }
    this.resize();
  }

  Confetti.prototype.resize = function () {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
  };

  /* Burst n pieces from (x, y) in CSS pixels. */
  Confetti.prototype.burst = function (x, y, n, opts) {
    if (this.max === 0) return;
    opts = opts || {};
    var spread = opts.spread === undefined ? Math.PI * 2 : opts.spread;
    var dir = opts.direction === undefined ? -Math.PI / 2 : opts.direction;
    var power = opts.power || 1;
    for (var i = 0, made = 0; i < this.pool.length && made < n; i++) {
      var p = this.pool[i];
      if (p.on) continue;
      var a = dir + (Math.random() - 0.5) * spread;
      var sp = (2.2 + Math.random() * 4.4) * power;
      p.on = true; made++;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 0.32;
      p.size = 5 + Math.random() * 7;
      p.round = Math.random() < 0.35;
      p.color = opts.color || COLORS[(Math.random() * COLORS.length) | 0];
      p.maxLife = 1.6 + Math.random() * 1.6;
      p.life = p.maxLife;
      this.live++;
    }
  };

  Confetti.prototype.update = function (dt) {
    if (this.live === 0) return;
    var ctx = this.ctx, d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var h = this.canvas.height / d;
    var step = Math.min(dt, 0.05) * 60;   // clamp so a stalled tab doesn't teleport
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; this.live--; continue; }
      p.vy += 0.16 * step;                // gravity
      p.vx *= 0.995;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rot += p.vrot * step;
      if (p.y > h + 40) { p.on = false; this.live--; continue; }
      var alpha = Math.min(1, p.life / (p.maxLife * 0.45));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x * d, p.y * d);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      var s = p.size * d;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        /* squash on the spin axis so it flutters like paper */
        ctx.fillRect(-s * 0.5, -s * 0.28 * Math.abs(Math.cos(p.rot)), s, s * 0.56 * Math.abs(Math.cos(p.rot)) + 1.5);
      }
      ctx.restore();
    }
  };

  Confetti.prototype.clear = function () {
    for (var i = 0; i < this.pool.length; i++) this.pool[i].on = false;
    this.live = 0;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  XY.Confetti = Confetti;
  XY.CONFETTI_COLORS = COLORS;

})(window.XY = window.XY || {});
