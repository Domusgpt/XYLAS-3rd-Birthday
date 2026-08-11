/* ============================================================================
 *  parallax.js — the depth engine
 *  ---------------------------------------------------------------------------
 *  Seven layers, each with a depth factor. Pointer, device tilt and the story's
 *  own camera all push a single target; every layer follows it at its own rate.
 *
 *  Two details that matter:
 *   - Damping is frame-rate independent. A plain lerp(a, b, 0.1) per frame moves
 *     twice as fast on a 120Hz phone as on a 60Hz laptop; the exponential form
 *     here behaves identically on both.
 *   - Exactly one transform write per layer per frame, from a single ticker.
 *     No layout properties are ever touched.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  function Parallax(opts) {
    opts = opts || {};
    this.layers = [];
    this.px = 0; this.py = 0;          // damped current
    this.tx = 0; this.ty = 0;          // target from pointer/tilt
    this.camX = 0; this.camY = 0;      // pushed by the story timeline
    this.amp = opts.amp || 44;
    this.k = 6.0;
    this.tiltWeight = 0.6;
    this.enabled = true;
  }

  Parallax.prototype.add = function (el, depth) {
    if (!el) return;
    el.style.willChange = 'transform';
    this.layers.push({ el: el, depth: depth, x: 0, y: 0 });
  };

  Parallax.prototype.bind = function (root) {
    var self = this;

    var onMove = function (e) {
      var t = e.touches ? e.touches[0] : e;
      if (!t) return;
      self.tx = XY.clamp((t.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      self.ty = XY.clamp((t.clientY / window.innerHeight - 0.5) * 2, -1, 1);
    };
    root.addEventListener('pointermove', onMove, { passive: true });

    this._onTilt = function (e) {
      if (e.gamma === null || e.beta === null) return;
      var gx = XY.clamp(e.gamma / 25, -1, 1);
      var gy = XY.clamp((e.beta - 45) / 25, -1, 1);
      self.tx = XY.clamp(self.tx * 0.35 + gx * self.tiltWeight, -1, 1);
      self.ty = XY.clamp(self.ty * 0.35 + gy * self.tiltWeight, -1, 1);
    };
  };

  /* iOS requires this to be called from inside a user gesture. */
  Parallax.prototype.enableTilt = function () {
    var self = this;
    if (!window.DeviceOrientationEvent) return Promise.resolve(false);
    var attach = function () {
      window.addEventListener('deviceorientation', self._onTilt, { passive: true });
      return true;
    };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      return DeviceOrientationEvent.requestPermission()
        .then(function (r) { return r === 'granted' ? attach() : false; })
        .catch(function () { return false; });
    }
    return Promise.resolve(attach());
  };

  Parallax.prototype.update = function (dt) {
    if (!this.enabled) return;
    this.px = XY.damp(this.px, this.tx, this.k, dt);
    this.py = XY.damp(this.py, this.ty, this.k, dt);
    var A = this.amp;
    for (var i = 0; i < this.layers.length; i++) {
      var L = this.layers[i];
      var x = this.px * A * L.depth + this.camX * L.depth;
      var y = this.py * A * 0.55 * L.depth + this.camY * L.depth;
      /* skip the write when nothing meaningfully moved */
      if (Math.abs(x - L.x) > 0.05 || Math.abs(y - L.y) > 0.05) {
        L.x = x; L.y = y;
        L.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      }
    }
  };

  XY.Parallax = Parallax;

})(window.XY = window.XY || {});
