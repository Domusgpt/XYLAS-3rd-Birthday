/* ============================================================================
 *  core.js — seeded randomness, math, and the path kit
 *  ---------------------------------------------------------------------------
 *  Every shape in this project is generated from numbers. Nothing is traced,
 *  nothing is loaded from a file, nothing is copied from anyone's artwork.
 *  Two properties matter above all else:
 *
 *   1. Randomness is SEEDED — "the cute one" stays the cute one on every
 *      reload, on every phone, forever.
 *   2. Shapes are built from smooth closed splines with a canonical starting
 *      landmark, so any part can morph into any other part cleanly.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  /* ======================================================================
   *  Seeded PRNG (mulberry32) — tiny, fast, deterministic
   * ==================================================================== */
  function rng(seed) {
    var a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
    var f = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (lo, hi) { return lo + f() * (hi - lo); };
    f.int = function (lo, hi) { return Math.floor(f.range(lo, hi + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.chance = function (p) { return f() < p; };
    f.sign = function () { return f() < 0.5 ? -1 : 1; };
    /* Pick n distinct items, original order preserved. */
    f.sample = function (arr, n) {
      var pool = arr.slice(), out = [];
      while (out.length < n && pool.length) {
        out.push(pool.splice(Math.floor(f() * pool.length), 1)[0]);
      }
      return out;
    };
    /* Weighted pick: weights is {key: weight}. */
    f.weighted = function (weights) {
      var keys = Object.keys(weights), total = 0, i;
      for (i = 0; i < keys.length; i++) total += weights[keys[i]];
      var r = f() * total;
      for (i = 0; i < keys.length; i++) {
        r -= weights[keys[i]];
        if (r <= 0) return keys[i];
      }
      return keys[keys.length - 1];
    };
    return f;
  }

  /* Turn any string into a stable 32-bit seed (FNV-1a). */
  function hashSeed(str) {
    var h = 2166136261, i;
    str = String(str);
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ======================================================================
   *  Math helpers
   * ==================================================================== */
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  /* Frame-rate independent damping. A plain lerp(a,b,0.1) per frame behaves
     differently at 60fps and 120fps; this does not. */
  var damp = function (cur, target, k, dt) {
    return lerp(cur, target, 1 - Math.exp(-k * dt));
  };
  var n1 = function (v) { return Math.round(v * 10) / 10; };
  var TAU = Math.PI * 2;

  /* ======================================================================
   *  Path kit
   * ==================================================================== */

  /* Catmull-Rom through points, emitted as cubic beziers. Closed.
     tension 0.9 is very slightly tight, which reads as "drawn" rather than
     "ballooned" — a small thing that matters a lot for cuteness. */
  function closedSpline(pts, tension) {
    var n = pts.length;
    if (n < 3) return '';
    tension = tension === undefined ? 0.9 : tension;
    var k = tension / 6;
    var d = ['M' + n1(pts[0][0]) + ',' + n1(pts[0][1])];
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i],
          p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d.push('C' + n1(p1[0] + (p2[0] - p0[0]) * k) + ',' + n1(p1[1] + (p2[1] - p0[1]) * k) +
             ' ' + n1(p2[0] - (p3[0] - p1[0]) * k) + ',' + n1(p2[1] - (p3[1] - p1[1]) * k) +
             ' ' + n1(p2[0]) + ',' + n1(p2[1]));
    }
    return d.join('') + 'Z';
  }

  /* Open spline — for mouths, brows, whiskers, rigging lines. */
  function openSpline(pts, tension) {
    var n = pts.length;
    if (n < 2) return '';
    tension = tension === undefined ? 0.9 : tension;
    var k = tension / 6;
    var d = ['M' + n1(pts[0][0]) + ',' + n1(pts[0][1])];
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i],
          p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      d.push('C' + n1(p1[0] + (p2[0] - p0[0]) * k) + ',' + n1(p1[1] + (p2[1] - p0[1]) * k) +
             ' ' + n1(p2[0] - (p3[0] - p1[0]) * k) + ',' + n1(p2[1] - (p3[1] - p1[1]) * k) +
             ' ' + n1(p2[0]) + ',' + n1(p2[1]));
    }
    return d.join('');
  }

  var BLOB_POINTS = 14;

  /* ---- RADIAL family -------------------------------------------------------
   * Bodies, heads, bellies, eyes, domes, hats, bolts.
   * A wobbled ellipse: organic and soft instead of machine-perfect, which is
   * most of what separates "cute" from "geometric".
   * `shape(angle, i)` returns a radius multiplier — that is how squash,
   * pear-shapes and superellipses get expressed.                            */
  function blob(cx, cy, rx, ry, opts) {
    opts = opts || {};
    var points = opts.points || BLOB_POINTS;
    var wobble = opts.wobble === undefined ? 0.05 : opts.wobble;
    var rand = opts.rand, shape = opts.shape, rot = opts.rotate || 0;
    var pts = [];
    for (var i = 0; i < points; i++) {
      var a = (i / points) * TAU + rot;
      var m = 1 + (rand ? (rand() - 0.5) * 2 * wobble : 0);
      if (shape) m *= shape(a, i);
      pts.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]);
    }
    return closedSpline(pts, opts.tension);
  }

  /* An egg — heavier at the bottom. The classic cute-body silhouette. */
  function egg(cx, cy, rx, ry, opts) {
    opts = opts || {};
    var bias = opts.bias === undefined ? 0.17 : opts.bias;
    return blob(cx, cy, rx, ry, Object.assign({}, opts, {
      shape: function (a) { return 1 + bias * Math.sin(a); } // +y is down in SVG
    }));
  }

  /* A pear — narrow shoulders, wide hips. Reads as a toddler body. */
  function pear(cx, cy, rx, ry, opts) {
    opts = opts || {};
    return blob(cx, cy, rx, ry, Object.assign({}, opts, {
      shape: function (a) {
        var s = Math.sin(a);
        return 1 + 0.26 * s - 0.1 * Math.cos(a * 2) * (s < 0 ? 1 : 0);
      }
    }));
  }

  /* ---- RIBBON family -------------------------------------------------------
   * Wings, tails, horns, arms, legs, antennae, frills, beams.
   * A centerline with a width profile. Points are laid out along one side and
   * back down the other, so index 0 is always "base-left" and the midpoint is
   * always "tip" — which is exactly why a butterfly wing can become a dino
   * tail without anyone hand-matching a single point.
   *
   *   center(t) -> [x, y]      t in 0..1
   *   width(t)  -> half-width  t in 0..1
   * ------------------------------------------------------------------------*/
  function ribbon(center, width, opts) {
    opts = opts || {};
    var steps = opts.steps || 9;             // per side
    var L = [], R = [];
    for (var i = 0; i < steps; i++) {
      var t = i / (steps - 1);
      var c = center(t);
      var e = 0.002;
      var c2 = center(Math.min(1, t + e)), c0 = center(Math.max(0, t - e));
      var dx = c2[0] - c0[0], dy = c2[1] - c0[1];
      var len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var w = width(t);
      L.push([c[0] + nx * w, c[1] + ny * w]);
      R.push([c[0] - nx * w, c[1] - ny * w]);
    }
    return closedSpline(L.concat(R.reverse()), opts.tension);
  }

  /* Convenience: a ribbon along a quadratic bend, the shape used for most
     wings, tails and limbs. `curve` bows the centerline sideways. */
  function limb(x, y, len, angle, halfWidth, curve, opts) {
    opts = opts || {};
    var ca = Math.cos(angle), sa = Math.sin(angle);
    var taper = opts.taper === undefined ? 0.15 : opts.taper; // width at the tip
    var bulge = opts.bulge === undefined ? 0.0 : opts.bulge;  // fatten the middle
    return ribbon(
      function (t) {
        var px = t * len;
        var py = Math.sin(t * Math.PI) * curve;
        return [x + px * ca - py * sa, y + px * sa + py * ca];
      },
      function (t) {
        var w = lerp(1, taper, t * t);
        return halfWidth * (w + bulge * Math.sin(t * Math.PI));
      },
      opts
    );
  }

  /* A rounded rectangle as a spline — panels, plates, banners, books. */
  function roundRect(cx, cy, w, h, r) {
    var hw = w / 2, hh = h / 2;
    var k = Math.min(hw, hh) * (r === undefined ? 0.4 : r);
    return closedSpline([
      [cx - hw + k, cy - hh], [cx, cy - hh], [cx + hw - k, cy - hh],
      [cx + hw, cy - hh + k], [cx + hw, cy], [cx + hw, cy + hh - k],
      [cx + hw - k, cy + hh], [cx, cy + hh], [cx - hw + k, cy + hh],
      [cx - hw, cy + hh - k], [cx - hw, cy], [cx - hw, cy - hh + k]
    ], 0.55);
  }

  /* A star / burst — sparkles, the party planet, the confetti shape. */
  function star(cx, cy, outer, inner, spikes, rot) {
    spikes = spikes || 5;
    rot = rot === undefined ? -Math.PI / 2 : rot;
    var pts = [];
    for (var i = 0; i < spikes * 2; i++) {
      var r = i % 2 ? inner : outer;
      var a = rot + (i / (spikes * 2)) * TAU;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return closedSpline(pts, 0.35);
  }

  /* A scalloped arc — cloud tops, frills, wing edges, cake frosting. */
  function scallop(x1, y1, x2, y2, bumps, depth, flip) {
    var pts = [], dx = x2 - x1, dy = y2 - y1;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var n = bumps * 2;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var off = (i % 2 ? depth : 0) * (flip ? -1 : 1);
      pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
    }
    return pts;
  }

  /* ======================================================================
   *  Colour
   * ==================================================================== */
  function shade(hex, amt) {
    var m = String(hex).replace('#', '');
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    var num = parseInt(m, 16);
    var cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
    var r = cl(((num >> 16) & 255) + amt * 255);
    var g = cl(((num >> 8) & 255) + amt * 255);
    var b = cl((num & 255) + amt * 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function mixHex(a, b, t) {
    var pa = parseInt(String(a).replace('#', ''), 16), pb = parseInt(String(b).replace('#', ''), 16);
    var r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ======================================================================
   *  Tiny DOM helpers
   * ==================================================================== */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    return el;
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* URL params — used for ?seed=, ?auto=1, ?seek=, ?q=low, ?nogl=1, ?lab=1 */
  var params = (function () {
    var out = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
      if (location.hash.length > 1) {
        new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { out[k] = v; });
      }
    } catch (e) { /* file:// edge cases */ }
    return out;
  })();

  XY.rng = rng;
  XY.hashSeed = hashSeed;
  XY.clamp = clamp;
  XY.lerp = lerp;
  XY.damp = damp;
  XY.TAU = TAU;
  XY.path = {
    closedSpline: closedSpline, openSpline: openSpline, blob: blob, egg: egg,
    pear: pear, ribbon: ribbon, limb: limb, roundRect: roundRect, star: star,
    scallop: scallop, BLOB_POINTS: BLOB_POINTS
  };
  XY.shade = shade;
  XY.mixHex = mixHex;
  XY.esc = esc;
  XY.svgEl = svgEl;
  XY.el = el;
  XY.params = params;

})(window.XY = window.XY || {});
