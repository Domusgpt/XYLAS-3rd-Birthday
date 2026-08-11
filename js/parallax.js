/* ============================================================================
 *  parallax.js — the multi-plane camera
 *  ---------------------------------------------------------------------------
 *  Seven layers, each with a depth factor. Pointer, device tilt, the story's
 *  camera moves and the shake impulses all push a single target; every layer
 *  follows it at its own rate.
 *
 *  This is a multi-plane rig, not a flat slide. Three things ride on `depth`:
 *
 *    - PAN.   Near layers slide further than far ones. (The original job.)
 *    - ZOOM.  Near layers *grow* more than far ones when the camera pushes in.
 *             That difference is the entire reason a push-in reads as depth
 *             rather than as everything scaling together like a photograph.
 *    - FOCUS. Centring on a subject moves near layers further than far ones,
 *             so the parallax stays consistent while the camera travels.
 *
 *  Four details that matter:
 *   - Damping is frame-rate independent. A plain lerp(a, b, 0.1) per frame moves
 *     twice as fast on a 120Hz phone as on a 60Hz laptop; the exponential form
 *     here behaves identically on both.
 *   - Exactly one transform write per layer per frame, from a single ticker.
 *     No layout properties are ever touched.
 *   - Zoom never goes below 1. `.layer` only bleeds 14% past the viewport, so
 *     pulling back further than the frame would slide a layer edge into shot.
 *   - The story writes `zoom`/`fx`/`fy` from a tweened proxy on the master
 *     timeline, so every camera move scrubs exactly like the rest of the piece.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  /* Must match `.layer { inset: -8% }` in style.css. If that ever changes,
     change it here too — this is what keeps a pan from exposing an edge. */
  var BLEED = 0.08;

  function Parallax(opts) {
    opts = opts || {};
    this.layers = [];
    this.px = 0; this.py = 0;          // damped current
    this.tx = 0; this.ty = 0;          // target from pointer/tilt
    this.camX = 0; this.camY = 0;      // shake offset, written by update()
    this.amp = opts.amp || 44;
    this.k = 6.0;
    this.tiltWeight = 0.6;
    this.enabled = true;

    /* ---- camera, driven by the story ---- */
    this.zoom = 1;                     // >= 1 always; see header
    this.fx = 0; this.fy = 0;          // focus offset in px, at depth 1

    /* ---- shake ---- */
    this.sAmp = 0;                     // current impulse amplitude, px
    this.sT = 0;                       // seconds elapsed inside this impulse
    this.sDecay = 6;                   // higher = snappier
  }

  /* A decaying two-frequency rumble. One sine buzzes; two sines at
     deliberately non-harmonic rates read as a real impact settling out.
     Calling it again while a shake is running takes the louder of the two
     rather than adding, so a burst of events cannot stack into nausea. */
  Parallax.prototype.shake = function (amp, dur) {
    if (!this.enabled) return;
    this.sAmp = Math.max(this.sAmp, amp || 8);
    this.sDecay = 1 / Math.max(0.08, dur || 0.4) * 2.4;
    this.sT = 0;
  };

  Parallax.prototype.add = function (el, depth) {
    if (!el) return;
    el.style.willChange = 'transform';
    this.layers.push({ el: el, depth: depth, x: 0, y: 0, s: 1 });
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

    /* shake: two out-of-phase sines, exponentially decaying */
    if (this.sAmp > 0.02) {
      this.sT += dt;
      this.sAmp *= Math.exp(-this.sDecay * dt);
      var s = this.sAmp;
      this.camX = Math.sin(this.sT * 138) * s;
      this.camY = Math.sin(this.sT * 107 + 1.7) * s * 0.8;
    } else if (this.sAmp !== 0) {
      this.sAmp = 0; this.camX = 0; this.camY = 0;
    }

    var A = this.amp;
    var Z = this.zoom;
    var vw = window.innerWidth, vh = window.innerHeight;
    for (var i = 0; i < this.layers.length; i++) {
      var L = this.layers[i];
      /* Depth-weighted zoom. The back layer barely changes size, the cast
         layer takes almost the full push — which is what sells the depth. */
      var sc = 1 + (Z - 1) * (0.30 + L.depth);
      var x = this.px * A * L.depth + this.camX * L.depth - this.fx * L.depth * sc;
      var y = this.py * A * 0.55 * L.depth + this.camY * L.depth - this.fy * L.depth * sc;

      /* How far this layer can travel before its own edge enters the frame.
         The layer is BLEED wider than the viewport and then scaled, so the
         overhang grows with the zoom — which is exactly right: the further
         the camera pushes in, the further it is allowed to pan. Clamping here
         rather than at the call site means no camera move anywhere in the
         story can ever expose an edge, however it was authored. */
      var ox = (sc * (1 + 2 * BLEED) - 1) / 2 * vw;
      var oy = (sc * (1 + 2 * BLEED) - 1) / 2 * vh;
      if (x >  ox) x =  ox; else if (x < -ox) x = -ox;
      if (y >  oy) y =  oy; else if (y < -oy) y = -oy;

      /* skip the write when nothing meaningfully moved */
      if (Math.abs(x - L.x) > 0.05 || Math.abs(y - L.y) > 0.05 ||
          Math.abs(sc - L.s) > 0.0008) {
        L.x = x; L.y = y; L.s = sc;
        L.el.style.transform =
          'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
      }
    }
  };

  XY.Parallax = Parallax;

})(window.XY = window.XY || {});
