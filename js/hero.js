/* ============================================================================
 *  hero.js — Captain Xyla
 *  ---------------------------------------------------------------------------
 *  The birthday girl, as a cartoon.
 *
 *  Drawn from three cues in a photograph her dad shared: a huge mane of
 *  windswept curls, enormous round sunglasses, and a lemon-print dress. She is
 *  deliberately stylised in exactly the same visual language as the rest of the
 *  cast — big head, huge eyes, round everything — and is NOT a likeness. The
 *  photograph is a style reference only; it is never displayed, never stored in
 *  this repository, and never uploaded anywhere.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var path = XY.path;

  var SKIN = '#F4C6A0', SKIN_SHADE = '#E0A87C';
  var HAIR = '#A9714B', HAIR_LIGHT = '#C79462', HAIR_DARK = '#8A5836';
  var DRESS = '#FFFDF6', DRESS_SHADE = '#EDE7FB';
  var INK = '#2A1B4A';

  var SLOTS = [
    'glow', 'hairBack', 'legL', 'legR', 'dress', 'dressHem',
    'lemons', 'leaves', 'armL', 'armR',
    'head', 'hairFront', 'curls',
    'earL', 'earR', 'cheekL', 'cheekR', 'mouth',
    'shadeStrap', 'shadeL', 'shadeR', 'shadeGlint',
    'hat', 'hatTrim', 'hatBadge',
  ];

  /* The lemon-print pattern: scattered lemons and little teal leaves, laid out
     from a seeded PRNG so the dress looks hand-printed rather than tiled. */
  function printPattern(rand, cx, topY, botY, halfTop, halfBot) {
    var lemons = [], leaves = [], i, t, w, x, y;
    var N = 11;
    for (i = 0; i < N; i++) {
      /* Stratified, not uniform: each lemon gets its own horizontal band and
         its own side of the centre line. Pure random clumps into a bouquet. */
      t = (i + rand.range(0.15, 0.85)) / N;
      y = topY + (botY - topY) * t;
      w = XY.lerp(halfTop, halfBot, t) * 0.74;
      x = cx + (i % 2 ? 1 : -1) * rand.range(w * 0.18, w);
      var r = rand.range(3.4, 4.8);
      lemons.push(path.blob(x, y, r * 1.2, r * 0.82, {
        points: 14, wobble: 0, rotate: rand.range(-0.6, 0.6),
        shape: function (a) { return 1 + 0.22 * Math.pow(Math.abs(Math.cos(a)), 6); }
      }));
      if (rand.chance(0.6)) {
        leaves.push(path.limb(x + r * 1.2, y - r * 0.4, rand.range(5, 7),
                              rand.range(-1.1, -0.3), 1.9, 1.8, { taper: 0.25, steps: 7 }));
      }
    }
    return { lemons: lemons.join(' '), leaves: leaves.join(' ') };
  }

  function spec(opts) {
    opts = opts || {};
    var rand = XY.rng(opts.seed || 'captain-xyla');
    var withHat = opts.hat !== false;
    var s = {};
    SLOTS.forEach(function (k) {
      s[k] = { d: path.blob(100, 120, 0.8, 0.8, { points: 14, wobble: 0 }), fill: 'none', opacity: 0 };
    });

    var headCX = 100, headCY = 72, hRX = 42, hRY = 40;
    var shoulderY = 126, hemY = 177, halfTop = 23, halfBot = 47;

    s.glow = { d: path.blob(100, 100, 86, 84, { points: 14, wobble: 0.03, rand: rand }),
               fill: '#FFD84D', opacity: 0.15 };

    /* ---- HAIR, back mass — big, round and windswept ------------------- */
    s.hairBack = {
      d: path.blob(headCX + 2, headCY + 2, hRX * 1.38, hRY * 1.3, {
        points: 14, wobble: 0.07, rand: rand,
        shape: function (a) { return 1 + 0.1 * Math.sin(a * 3); }
      }),
      fill: HAIR, stroke: INK, opacity: 1
    };

    /* ---- LEGS ---------------------------------------------------------- */
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var lx = headCX + dir * 15, ang = Math.PI / 2 - dir * 0.1;
      var len = 24;
      var fx = lx + Math.cos(ang) * len, fy = hemY - 4 + Math.sin(ang) * len;
      s['leg' + side] = {
        d: path.limb(lx, hemY - 4, len, ang, 7.5, dir * 2, { taper: 1, steps: 7 }) +
           ' ' + path.blob(fx + dir * 3, fy + 1, 11, 7.5, { points: 14, wobble: 0.04, rand: rand }),
        fill: SKIN, stroke: INK, opacity: 1
      };
    });

    /* ---- DRESS — an A-line, the shape of the swimsuit skirt ------------ */
    s.dress = {
      d: path.closedSpline([
        [headCX - halfTop, shoulderY], [headCX, shoulderY - 5], [headCX + halfTop, shoulderY],
        [headCX + halfTop * 1.25, shoulderY + 20],
        [headCX + halfBot, hemY - 6], [headCX + halfBot * 0.6, hemY + 3],
        [headCX, hemY + 6], [headCX - halfBot * 0.6, hemY + 3],
        [headCX - halfBot, hemY - 6],
        [headCX - halfTop * 1.25, shoulderY + 20],
      ], 0.8),
      fill: DRESS, stroke: INK, opacity: 1
    };
    /* the ruffle at the hem */
    s.dressHem = {
      d: path.closedSpline(
        path.scallop(headCX - halfBot, hemY - 4, headCX + halfBot, hemY - 4, 5, 5, false)
          .concat([[headCX + halfBot * 0.6, hemY + 4], [headCX, hemY + 7],
                   [headCX - halfBot * 0.6, hemY + 4]]), 0.7),
      fill: DRESS_SHADE, stroke: INK, opacity: 1
    };

    var print = printPattern(rand, headCX, shoulderY + 6, hemY - 2, halfTop, halfBot);
    s.lemons = { d: print.lemons, fill: '#FFD84D', stroke: '#F0A500', opacity: 1 };
    s.leaves = { d: print.leaves, fill: '#0E7C7B', opacity: 0.9 };

    /* ---- ARMS ---------------------------------------------------------- */
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var sx = headCX + dir * halfTop * 0.9, ay = shoulderY + 6;
      var ang = dir > 0 ? 0.75 : Math.PI - 0.75, len = 30;
      var hx = sx + Math.cos(ang) * len, hy = ay + Math.sin(ang) * len;
      s['arm' + side] = {
        d: path.limb(sx, ay, len, ang, 6.5, dir * -6, { taper: 0.85, steps: 7 }) +
           ' ' + path.blob(hx, hy, 8.5, 8.5, { points: 14, wobble: 0.05, rand: rand }),
        fill: SKIN, stroke: INK, opacity: 1
      };
    });

    /* ---- HEAD ---------------------------------------------------------- */
    s.head = {
      d: path.blob(headCX, headCY, hRX, hRY, {
        points: 14, wobble: 0.02, rand: rand,
        shape: function (a) { return 1 + 0.07 * Math.sin(a); }
      }),
      fill: SKIN, stroke: INK, opacity: 1
    };

    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      s['ear' + side] = {
        d: path.blob(headCX + dir * hRX * 0.97, headCY + 4, 7, 9, { points: 14, wobble: 0 }),
        fill: SKIN, stroke: INK, opacity: 1
      };
    });

    /* ---- HAIR, front — a soft fringe over the brow -------------------- */
    s.hairFront = {
      d: path.closedSpline([
        [headCX - hRX * 1.02, headCY - 4],
        [headCX - hRX * 0.8, headCY - hRY * 0.86],
        [headCX - hRX * 0.2, headCY - hRY * 1.12],
        [headCX + hRX * 0.45, headCY - hRY * 1.05],
        [headCX + hRX * 0.95, headCY - hRY * 0.6],
        [headCX + hRX * 1.04, headCY + 2],
        [headCX + hRX * 0.62, headCY - hRY * 0.3],
        [headCX + hRX * 0.1, headCY - hRY * 0.44],
        [headCX - hRX * 0.42, headCY - hRY * 0.26],
        [headCX - hRX * 0.72, headCY - hRY * 0.36],
      ], 0.85),
      fill: HAIR_LIGHT, stroke: INK, opacity: 1
    };

    /* ---- CURLS — the signature. A ring of overlapping blobs of varying
            size, which is what makes hair read as curly rather than as a
            helmet. Seeded, so her hair is the same every single load. ---- */
    var curls = [];
    for (var i = 0; i < 24; i++) {
      var a = (i / 24) * XY.TAU + rand.range(-0.08, 0.08);
      /* bias the mass outward and downward — windswept, not symmetrical */
      var rr = hRX * (1.34 + 0.16 * Math.sin(a * 2) + 0.1 * Math.sin(a + 1.3));
      var cx2 = headCX + 3 + Math.cos(a) * rr;
      var cy2 = headCY + 4 + Math.sin(a) * rr * 0.92;
      var cr = rand.range(9, 14);
      /* Curls pile up on top and down the sides and STOP around the jaw.
         Carried all the way round the chin they read as a lion's mane. */
      if (Math.sin(a) > 0.52) continue;
      /* Keep the whole face clear. Hair that creeps over the cheeks and mouth
         reads as a bush, not as a haircut — so any curl whose disc would
         intrude on the front of the face is simply dropped. */
      var faceDX = (cx2 - headCX) / (hRX + cr * 0.55);
      var faceDY = (cy2 - (headCY + 6)) / (hRY + cr * 0.5);
      if (faceDX * faceDX + faceDY * faceDY < 1 && cy2 > headCY - hRY * 0.55) continue;
      curls.push(path.blob(cx2, cy2, cr, cr * rand.range(0.85, 1.1),
                           { points: 14, wobble: 0.16, rand: rand }));
    }
    s.curls = { d: curls.join(' '), fill: HAIR, stroke: INK, opacity: 1 };

    /* ---- FACE ---------------------------------------------------------- */
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      s['cheek' + side] = {
        d: path.blob(headCX + dir * 27, headCY + 17, 8, 5.5, { points: 14, wobble: 0.04, rand: rand }),
        fill: '#FF8FB1', opacity: 0.55
      };
    });

    /* a big open happy smile */
    var a1 = [], b1 = [], j, t2;
    for (j = 0; j <= 8; j++) { t2 = j / 8; a1.push([headCX - 13 + 26 * t2, headCY + 20 + Math.sin(t2 * Math.PI) * 9]); }
    for (j = 8; j >= 0; j--) { t2 = j / 8; b1.push([headCX - 13 + 26 * t2, headCY + 20 + Math.sin(t2 * Math.PI) * 2.5]); }
    s.mouth = { d: path.closedSpline(a1.concat(b1), 0.8), fill: INK, opacity: 1 };

    /* ---- THE SUNGLASSES — oversized, round, and the whole personality -- */
    var gy = headCY - 2, gdx = 17, gr = 15;
    s.shadeStrap = {
      d: path.roundRect(headCX, gy - 1, gdx * 1.05, 4.5, 1) + ' ' +
         path.roundRect(headCX - gdx - gr * 1.15, gy - 3, 12, 4, 1) + ' ' +
         path.roundRect(headCX + gdx + gr * 1.15, gy - 3, 12, 4, 1),
      fill: '#3A3358', opacity: 1
    };
    var lens = function (x) {
      return path.blob(x, gy, gr * 1.22, gr * 1.1, {
        points: 14, wobble: 0,
        shape: function (a) { return 1 + 0.08 * Math.cos(a * 2); }
      });
    };
    s.shadeL = { d: lens(headCX - gdx), fill: '#2A2340', stroke: INK, opacity: 0.95 };
    s.shadeR = { d: lens(headCX + gdx), fill: '#2A2340', stroke: INK, opacity: 0.95 };
    /* two little highlights so the lenses look like glass, not holes */
    s.shadeGlint = {
      d: path.blob(headCX - gdx - 6, gy - 6, 5.5, 3.4, { points: 14, wobble: 0, rotate: -0.5 }) + ' ' +
         path.blob(headCX + gdx - 6, gy - 6, 5.5, 3.4, { points: 14, wobble: 0, rotate: -0.5 }),
      fill: '#FFFFFF', opacity: 0.5
    };

    /* ---- CAPTAIN'S HAT ------------------------------------------------- */
    if (withHat) {
      var hy = headCY - hRY * 1.42, hw = hRX * 1.5;
      s.hat = {
        d: path.closedSpline([
          [headCX - hw, hy - 8], [headCX - hw * 0.72, hy + 3], [headCX - hw * 0.38, hy - 11],
          [headCX, hy - 24], [headCX + hw * 0.38, hy - 11], [headCX + hw * 0.72, hy + 3],
          [headCX + hw, hy - 8], [headCX + hw * 0.9, hy + 10], [headCX + hw * 0.45, hy + 16],
          [headCX, hy + 18], [headCX - hw * 0.45, hy + 16], [headCX - hw * 0.9, hy + 10],
        ], 0.62),
        fill: '#2A1B4A', stroke: '#0B1730', opacity: 1
      };
      s.hatTrim = {
        d: path.closedSpline([
          [headCX - hw * 0.96, hy - 6], [headCX - hw * 0.7, hy + 4], [headCX - hw * 0.37, hy - 9],
          [headCX, hy - 21], [headCX + hw * 0.37, hy - 9], [headCX + hw * 0.7, hy + 4],
          [headCX + hw * 0.96, hy - 6], [headCX + hw * 0.86, hy + 8], [headCX + hw * 0.44, hy + 14],
          [headCX, hy + 16], [headCX - hw * 0.44, hy + 14], [headCX - hw * 0.86, hy + 8],
        ], 0.62) + ' ' + path.closedSpline([
          [headCX - hw * 0.82, hy - 3], [headCX - hw * 0.6, hy + 4], [headCX - hw * 0.32, hy - 6],
          [headCX, hy - 16], [headCX + hw * 0.32, hy - 6], [headCX + hw * 0.6, hy + 4],
          [headCX + hw * 0.82, hy - 3], [headCX + hw * 0.74, hy + 6], [headCX + hw * 0.38, hy + 11],
          [headCX, hy + 13], [headCX - hw * 0.38, hy + 11], [headCX - hw * 0.74, hy + 6],
        ].reverse(), 0.62),
        fill: '#FFD84D', opacity: 0.95
      };
      s.hatBadge = {
        d: path.blob(headCX, hy - 3, 9, 6.6, {
          points: 14, wobble: 0,
          shape: function (a) { return 1 + 0.22 * Math.pow(Math.abs(Math.cos(a)), 6); }
        }),
        fill: '#FFD84D', stroke: '#F0A500', opacity: 1
      };
    }

    return s;
  }

  function render(opts) {
    var sp = spec(opts);
    var svg = XY.svgEl('svg', {
      viewBox: '-30 -40 260 250', class: 'creature hero',
      'aria-hidden': 'true', focusable: 'false', overflow: 'visible'
    });
    var root = XY.svgEl('g', { class: 'c-root' });
    var body = XY.svgEl('g', { class: 'c-body' });
    var nodes = {};
    SLOTS.forEach(function (slot) {
      var a = sp[slot];
      var p = XY.svgEl('path', { d: a.d, fill: a.fill || 'none', opacity: a.opacity, 'data-slot': slot });
      if (a.stroke) {
        p.setAttribute('stroke', a.stroke);
        p.setAttribute('stroke-width', 3);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('paint-order', 'stroke');
      }
      nodes[slot] = p;
      body.appendChild(p);
    });
    root.appendChild(body);
    svg.appendChild(root);
    return { svg: svg, root: root, body: body, nodes: nodes, spec: sp, name: 'Captain Xyla' };
  }

  /* Ambient life — she breathes, her curls bounce, her hat tips. */
  function animate(h) {
    var rand = XY.rng('xyla-anim');
    gsap.to(h.body, {
      scaleY: 1.04, scaleX: 0.98, duration: 1.7, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: '100px 180px'
    });
    gsap.to(h.nodes.curls, {
      rotation: 1.6, scaleX: 1.02, duration: 2.3, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: '100px 90px'
    });
    gsap.to([h.nodes.hat, h.nodes.hatTrim, h.nodes.hatBadge], {
      rotation: -2.5, duration: 2.9, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: '100px 40px'
    });
    gsap.to(h.nodes.shadeGlint, {
      opacity: 0.85, duration: 2.1, repeat: -1, yoyo: true, ease: 'sine.inOut'
    });
  }

  /* ==========================================================================
   *  PHOTO MODE — the real Xyla, flying
   *  --------------------------------------------------------------------------
   *  The photograph is cut out (background removed by a segmentation model run
   *  locally — see tools/process-photos.mjs) and then the generated art is
   *  drawn *around* her: butterfly wings sprouting from behind her shoulders,
   *  the same pirate tricorn the drawn crew wears, and a soft glow.
   *
   *  She is already photographed with her arms out, which is why the wings
   *  land: she was halfway to flying before anyone drew anything.
   * ======================================================================== */

  /* Measured off the cutout (572x760). If the photo is ever re-cropped these
     are the numbers to revisit. */
  var PH = {
    w: 572, h: 760,
    headCX: 319, headCY: 190, headW: 220,
    backCX: 290, backCY: 400,     // where the wings sprout
  };

  /* --------------------------------------------------------------------------
   *  A real butterfly wing outline.
   *
   *  The generic `limb` ribbon used for the drawn crew makes a wedge with a
   *  blunt end — at this size that reads as a slab of cheese, not a wing. A
   *  wing needs a long convex leading edge, a rounded tip, and a shorter,
   *  slightly concave trailing edge. These are unit coordinates (x along the
   *  wing, y across it) scaled, rotated and mirrored per side.
   * ------------------------------------------------------------------------*/
  var FOREWING = [
    [0.00, 0.00], [0.20, -0.26], [0.46, -0.44], [0.71, -0.53],
    [0.92, -0.48], [1.04, -0.28], [1.03, -0.04], [0.88, 0.16],
    [0.66, 0.27], [0.44, 0.26], [0.25, 0.18], [0.09, 0.08],
  ];
  var HINDWING = [
    [0.00, 0.00], [0.22, -0.16], [0.48, -0.22], [0.72, -0.16],
    [0.88, 0.02], [0.90, 0.24], [0.78, 0.42], [0.58, 0.50],
    [0.38, 0.46], [0.22, 0.34], [0.10, 0.20], [0.03, 0.09],
  ];

  /* Rotate the unit wing in its own local space first, THEN mirror the whole
     rotated shape for the left side. Folding `dir` into the rotation itself
     (the obvious-looking shortcut) shears the wing into a blade. */
  function wingLocal(unit, len, spread, angle) {
    var ca = Math.cos(angle), sa = Math.sin(angle);
    return unit.map(function (p) {
      var lx = p[0] * len, ly = p[1] * len * spread;
      return [lx * ca - ly * sa, lx * sa + ly * ca];
    });
  }

  function wingPath(unit, cx, cy, len, spread, angle, dir) {
    var pts = wingLocal(unit, len, spread, angle).map(function (p) {
      return [cx + p[0] * dir, cy + p[1]];
    });
    return path.closedSpline(pts, 0.95);
  }

  function photoSpec(rand) {
    var s = {}, spots = [];
    /* sprout from the shoulder blades, above the elbows */
    var wingAnchorY = PH.backCY - 24;

    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var ax = PH.backCX + dir * 26;
      var upAng = -0.78;                       // mirrored by `dir` inside wingPath
      var upLen = 400;
      /* wings are long and narrow; a spread near 1 rounds them into balloons */
      var spread = 0.58;

      s['wingFront' + side] = {
        d: wingPath(FOREWING, ax, wingAnchorY, upLen, spread, upAng, dir),
        fill: '#FFD84D', stroke: INK, opacity: 0.96
      };
      s['wingBack' + side] = {
        d: wingPath(HINDWING, ax, wingAnchorY + 70, 250, 0.62, 0.34, dir),
        fill: '#FF8FB1', stroke: INK, opacity: 0.96
      };

      /* markings, echoing the butterfly printed on her shirt */
      var marks = [];
      [[0.42, -0.16, 30], [0.63, -0.24, 23], [0.80, -0.20, 16]].forEach(function (m) {
        /* same local-rotate-then-mirror rule as the wing outline itself */
        var q = wingLocal([[m[0], m[1]]], upLen, spread, upAng)[0];
        marks.push(path.blob(ax + q[0] * dir, wingAnchorY + q[1], m[2], m[2] * 0.92,
                             { points: 14, wobble: 0.07, rand: rand }));
      });
      s['wingSpot' + side] = { d: marks.join(' '), fill: '#FFF8EE', opacity: 0.75 };
    });

    /* a warm halo so she sits in the sky rather than on top of it */
    s.glow = {
      d: path.blob(PH.headCX, 340, 330, 340, { points: 14, wobble: 0.04, rand: rand }),
      fill: '#FFD84D', opacity: 0.1
    };

    /* sparkles around her */
    for (var k = 0; k < 7; k++) {
      var a = rand.range(0, XY.TAU), r = rand.range(280, 430);
      spots.push(path.star(PH.headCX + Math.cos(a) * r, 330 + Math.sin(a) * r * 0.85,
                           rand.range(9, 17), rand.range(3, 6), 4, rand.range(0, 1)));
    }
    s.sparkles = { d: spots.join(' '), fill: '#FFF8EE', opacity: 0.85 };

    return s;
  }

  function renderPhoto(opts) {
    opts = opts || {};
    var rand = XY.rng('xyla-photo');
    var sp = photoSpec(rand);
    var withHat = opts.hat !== false;

    var svg = XY.svgEl('svg', {
      viewBox: '-150 -80 880 920', class: 'creature hero hero-photo',
      'aria-hidden': 'true', focusable: 'false', overflow: 'visible'
    });
    var root = XY.svgEl('g', { class: 'c-root' });
    var body = XY.svgEl('g', { class: 'c-body' });
    var nodes = {};

    var add = function (slot, a) {
      var p = XY.svgEl('path', { d: a.d, fill: a.fill || 'none', opacity: a.opacity, 'data-slot': slot });
      if (a.stroke) {
        p.setAttribute('stroke', a.stroke);
        p.setAttribute('stroke-width', 5);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('paint-order', 'stroke');
      }
      nodes[slot] = p;
      body.appendChild(p);
      return p;
    };

    add('glow', sp.glow);
    ['L', 'R'].forEach(function (d) { add('wingBack' + d, sp['wingBack' + d]); });
    ['L', 'R'].forEach(function (d) { add('wingFront' + d, sp['wingFront' + d]); });
    ['L', 'R'].forEach(function (d) { add('wingSpot' + d, sp['wingSpot' + d]); });

    /* the photograph itself */
    var img = XY.svgEl('image', {
      x: 0, y: 0, width: PH.w, height: PH.h,
      preserveAspectRatio: 'xMidYMid meet',
      'data-slot': 'photo',
    });
    img.setAttribute('href', opts.src);
    /* older WebKit still wants the xlink form */
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', opts.src);
    nodes.photo = img;
    body.appendChild(img);

    /* the same tricorn the drawn crew wears, scaled onto her head */
    if (withHat && XY.Creature && XY.Creature.shapes) {
      var S = XY.Creature.shapes;
      var hatG = XY.svgEl('g', { class: 'hero-hat' });
      var hw = PH.headW * 0.52;
      var hx = PH.headCX + 4, hy = PH.headCY - PH.headW * 0.66;
      var mk = function (d, fill, stroke, op) {
        var p = XY.svgEl('path', { d: d, fill: fill, opacity: op === undefined ? 1 : op });
        if (stroke) {
          p.setAttribute('stroke', stroke);
          p.setAttribute('stroke-width', 5);
          p.setAttribute('stroke-linejoin', 'round');
          p.setAttribute('paint-order', 'stroke');
        }
        hatG.appendChild(p);
        return p;
      };
      /* the hat shapes are authored around a 200-unit creature; scale to fit */
      var k = hw / 60;
      var inner = XY.svgEl('g', {
        transform: 'translate(' + hx + ',' + hy + ') scale(' + k.toFixed(3) + ') translate(-100,-40)'
      });
      var mkI = function (d, fill, stroke, op) {
        var p = XY.svgEl('path', { d: d, fill: fill, opacity: op === undefined ? 1 : op });
        if (stroke) {
          p.setAttribute('stroke', stroke);
          p.setAttribute('stroke-width', 3);
          p.setAttribute('stroke-linejoin', 'round');
          p.setAttribute('paint-order', 'stroke');
        }
        inner.appendChild(p);
        return p;
      };
      mkI(S.plumePath(100 + 34, 40 - 6, 34), '#FF8FB1', INK);
      mkI(S.tricornPath(100, 40, 58), '#2A1B4A', '#0B1730');
      mkI(S.tricornTrim(100, 40, 58), '#FFD84D', null, 0.95);
      mkI(S.crossbones(100, 36, 15), '#FFF8EE');
      mkI(S.lemonPath(100, 36, 8.5), '#FFD84D', '#F0A500');
      hatG.appendChild(inner);
      nodes.hat = hatG;
      body.appendChild(hatG);
    }

    add('sparkles', sp.sparkles);

    root.appendChild(body);
    svg.appendChild(root);
    return {
      svg: svg, root: root, body: body, nodes: nodes, spec: sp,
      name: 'Captain Xyla', isPhoto: true,
    };
  }

  function animatePhoto(h) {
    var rand = XY.rng('xyla-photo-anim');
    /* she bobs as if hovering */
    gsap.to(h.body, {
      y: -14, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
    /* wings beat — slow and dreamy, not insect-fast */
    gsap.to([h.nodes.wingFrontL, h.nodes.wingBackL, h.nodes.wingSpotL], {
      scaleX: 0.82, rotation: 5, duration: 1.5, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: PH.backCX + 'px ' + PH.backCY + 'px',
    });
    gsap.to([h.nodes.wingFrontR, h.nodes.wingBackR, h.nodes.wingSpotR], {
      scaleX: 0.82, rotation: -5, duration: 1.5, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: PH.backCX + 'px ' + PH.backCY + 'px',
    });
    if (h.nodes.hat) {
      gsap.to(h.nodes.hat, {
        rotation: -3, duration: 3.1, repeat: -1, yoyo: true, ease: 'sine.inOut',
        transformOrigin: PH.headCX + 'px ' + PH.headCY + 'px',
      });
    }
    gsap.to(h.nodes.sparkles, {
      opacity: 0.35, scale: 1.06, duration: 2.2, repeat: -1, yoyo: true,
      ease: 'sine.inOut', transformOrigin: '50% 50%',
    });
  }

  XY.Hero = {
    spec: spec, render: render, animate: animate, SLOTS: SLOTS,
    renderPhoto: renderPhoto, animatePhoto: animatePhoto, PH: PH,
  };

})(window.XY = window.XY || {});
