/* ============================================================================
 *  creature.js — the generative cast
 *  ---------------------------------------------------------------------------
 *  Butterfly-pirates. Robo-dinos. Dino-butterflies with jetpacks. Every one of
 *  them is built from numbers at runtime, from an original parametric design.
 *
 *  ARCHITECTURE — two ideas carry the whole system:
 *
 *  1. FIXED SLOT ROSTER. Every creature has every slot, always, in the same
 *     order. A creature with no tail still has a `tail` slot — collapsed to a
 *     dot at its anchor with opacity 0. That means any creature can morph into
 *     any other creature with no "what does this part become?" logic at all.
 *
 *  2. GENOME -> PURE SPEC -> DOM. `spec(genome)` returns plain data: a map of
 *     slot -> {d, fill, opacity, ...}. Rendering builds DOM from a spec, and
 *     morphing simply tweens from one spec to another. Because a spec is pure
 *     data, the morph target can be computed without touching the page.
 *
 *  Cuteness is not an accident here, it is a set of rules: head larger than
 *  body, eyes huge and set low on the face (like a baby's), limbs short,
 *  everything round, cheeks always rosy, and a soft ink outline rather than
 *  black. Those constants live in GEO below.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var path = XY.path, lerp = XY.lerp, TAU = XY.TAU;

  /* ---- The cute-making constants (viewBox is 0 0 200 200) --------------- */
  var GEO = {
    groundY: 184,
    bodyCX: 100, bodyCY: 134, bodyRX: 33, bodyRY: 29,
    headCX: 100, headCY: 78,  headRX: 42, headRY: 39,
    eyeCY: 84, eyeDX: 17.5, eyeR: 12.5,   // low + wide + huge = baby face
    cheekCY: 100, cheekDX: 30, cheekR: 8,
    mouthCY: 103,
  };

  var KITS = ['butterfly', 'pirate', 'robot', 'dino'];

  /* The slot roster, back to front. Order here IS z-order.
     Note both wing pairs sit behind the body: "front/back" means forewing and
     hindwing, as on a real butterfly — not foreground and background. */
  var SLOTS = [
    'glow',
    'wingBackL', 'wingBackR',
    'wingFrontL', 'wingFrontR',
    'wingSpotL', 'wingSpotR',
    'tail',
    'legL', 'legR',
    'body', 'belly',
    'armL', 'armR',
    'chestPlate',
    'head', 'snout',
    'crest',
    'hornL', 'hornR',
    'earL', 'earR',
    'eyeWhiteL', 'eyeWhiteR', 'pupilL', 'pupilR', 'glintL', 'glintR',
    'patch', 'shades',
    'cheekL', 'cheekR',
    'mouth',
    'hatPlume', 'hat', 'hatTrim', 'hatEmblem', 'hatBadge',
    'antennaL', 'antennaR', 'antennaBallL', 'antennaBallR',
    'accessory',
  ];

  /* A collapsed placeholder: a tiny dot at an anchor. Morphs grow out of it. */
  function dot(x, y) { return path.blob(x, y, 0.8, 0.8, { points: 14, wobble: 0 }); }

  /* ======================================================================
   *  GENOME — a creature's DNA. Seeded, so it is reproducible forever.
   * ==================================================================== */
  function genome(seed, opts) {
    opts = opts || {};
    var rand = XY.rng(seed);
    var kits = opts.kits || rand.sample(KITS, rand.chance(0.22) ? 3 : 2);
    var has = {};
    KITS.forEach(function (k) { has[k] = kits.indexOf(k) >= 0; });

    var skin = XY.skinFor(rand);
    // Robots lean metallic-but-candy; dinos lean saturated.
    if (has.robot && rand.chance(0.5)) skin.main = XY.mixHex(skin.main, '#DDE9F5', 0.35);

    return {
      seed: seed,
      kits: kits, has: has,
      skin: skin,
      // Proportions — kept inside cute bounds. No creature is ever gangly.
      chub: rand.range(0.9, 1.16),
      headScale: rand.range(0.95, 1.12),
      eyeScale: rand.range(0.92, 1.14),
      squint: rand.range(0, 0.18),
      limbLen: rand.range(0.85, 1.15),
      // Kit specifics
      wingSpan: rand.range(0.9, 1.3),
      wingTilt: rand.range(-0.32, -0.05),
      wingPattern: rand.pick(['dots', 'lemon', 'stripes', 'hearts']),
      tailCurl: rand.range(-26, 26),
      tailLen: rand.range(0.85, 1.25),
      spikeCount: rand.int(3, 6),
      hornStyle: rand.pick(['horn', 'frill', 'none']),
      hatStyle: has.pirate ? rand.pick(['tricorn', 'bandana', 'tricorn']) : 'none',
      plumeLen: rand.range(26, 40),
      plumeColor: rand.pick(['#FF8FB1', '#FFD84D', '#9BE8C8', '#FFF8EE', '#FF9F6B']),
      bandanaColor: rand.pick(['#FF8FB1', '#E8618A', '#7EC8E3', '#FFD84D', '#C9A7F5']),
      eyePatch: has.pirate && rand.chance(0.55),
      shades: rand.chance(has.pirate ? 0.3 : 0.16),
      antenna: has.robot || has.butterfly,
      antennaCount: has.butterfly || rand.chance(0.35) ? 2 : 1,
      chestPlate: has.robot,
      ledHue: rand.int(0, 359),
      belly: rand.chance(0.75),
      bellyStripes: has.pirate && rand.chance(0.5),
      accessory: rand.chance(0.5)
        ? rand.pick(has.pirate ? ['cutlass', 'flag', 'lolly'] : ['lolly', 'balloon', 'flag'])
        : 'none',
      mouthStyle: rand.pick(['smile', 'smile', 'smile', 'smile', 'oh']),
      earStyle: has.robot ? 'bolt' : rand.pick(['round', 'none', 'round']),
      name: makeName(rand, kits),
      rand: rand,
    };
  }

  /* ---- Original, generated names. No borrowed characters, ever. --------- */
  var NAME_A = ['Spark', 'Bloop', 'Zizzle', 'Munch', 'Twirl', 'Pip', 'Waffle', 'Bonk',
                'Glim', 'Squish', 'Doodle', 'Nib', 'Clank', 'Fizzy', 'Wibble', 'Toot'];
  var NAME_B = ['wing', 'snout', 'bottom', 'stomp', 'whisker', 'sprocket', 'noodle',
                'tumble', 'pants', 'biscuit', 'bolt', 'flap', 'wobble', 'boop'];
  function makeName(rand, kits) {
    var base = rand.pick(NAME_A) + rand.pick(NAME_B);
    var t = '';
    if (kits.indexOf('pirate') >= 0 && rand.chance(0.7)) t = rand.pick(['Captain', 'Admiral', 'First Mate']) + ' ';
    else if (rand.chance(0.35)) t = rand.pick(['Professor', 'Sir', 'Queen', 'Little', 'Chief', 'Doctor']) + ' ';
    if (kits.indexOf('dino') >= 0 && rand.chance(0.35)) base = base.replace(/.$/, '') + 'osaurus';
    if (kits.indexOf('robot') >= 0 && rand.chance(0.3)) base = 'Robo-' + base;
    return t + base;
  }

  /* ======================================================================
   *  SPEC — genome to pure drawing data.
   * ==================================================================== */
  function spec(g) {
    var s = {};
    var skin = g.skin;
    var chub = g.chub;
    var bRX = GEO.bodyRX * chub, bRY = GEO.bodyRY * chub;
    var hRX = GEO.headRX * g.headScale, hRY = GEO.headRY * g.headScale;
    var rand = XY.rng(g.seed + 7);   // separate stream so wobble is stable

    /* every slot starts hidden and collapsed at a sensible anchor */
    SLOTS.forEach(function (k) { s[k] = { d: dot(100, 120), fill: 'none', opacity: 0 }; });

    /* ---- soft glow (stacked translucent shapes, never an SVG blur filter,
            which is the single worst offender for jank on phones) --------- */
    s.glow = { d: path.blob(100, 110, 78, 76, { points: 14, wobble: 0.03, rand: rand }),
               fill: skin.accent, opacity: 0.13 };

    /* ---- BODY ---------------------------------------------------------- */
    s.body = {
      d: path.pear(GEO.bodyCX, GEO.bodyCY, bRX, bRY, { rand: rand, wobble: 0.035 }),
      fill: skin.main, stroke: skin.ink, opacity: 1
    };

    if (g.belly) {
      s.belly = {
        d: path.egg(GEO.bodyCX, GEO.bodyCY + 5, bRX * 0.62, bRY * 0.6, { rand: rand, wobble: 0.04 }),
        fill: XY.mixHex(skin.main, '#FFFFFF', 0.55), opacity: 1
      };
    }

    /* ---- LEGS — short and stubby, always, with a chunky foot on the end
            so they actually read at thumbnail size ---------------------- */
    var legY = GEO.bodyCY + bRY * 0.62;
    var legLen = 26 * g.limbLen;
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var lx = GEO.bodyCX + dir * bRX * 0.52, ang = Math.PI / 2 - dir * 0.2;
      var fx = lx + Math.cos(ang) * legLen, fy = legY + Math.sin(ang) * legLen;
      s['leg' + side] = {
        d: path.limb(lx, legY, legLen, ang, 8, dir * 3, { taper: 1.1, steps: 7 }) +
           ' ' + path.blob(fx + dir * 3, fy + 1, 12, 8, { points: 14, wobble: 0.04, rand: rand }),
        fill: g.has.robot ? skin.shadow : skin.main, stroke: skin.ink, opacity: 1
      };
    });

    /* ---- ARMS — with little mitten hands ------------------------------- */
    var armY = GEO.bodyCY - bRY * 0.3;
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var sx = GEO.bodyCX + dir * bRX * 0.86, aLen = 28 * g.limbLen;
      var aAng = dir > 0 ? 0.62 : Math.PI - 0.62;
      var hx = sx + Math.cos(aAng) * aLen, hy = armY + Math.sin(aAng) * aLen;
      s['arm' + side] = {
        d: path.limb(sx, armY, aLen, aAng, 7, dir * -7, { taper: 0.9, steps: 7 }) +
           ' ' + path.blob(hx, hy, 9, 9, { points: 14, wobble: 0.05, rand: rand }),
        fill: g.has.robot ? skin.shadow : skin.main, stroke: skin.ink, opacity: 1
      };
    });

    /* ---- ROBOT chest plate + LED --------------------------------------- */
    if (g.chestPlate) {
      s.chestPlate = {
        d: path.roundRect(GEO.bodyCX, GEO.bodyCY + 2, bRX * 1.05, bRY * 0.95, 0.55),
        fill: XY.mixHex(skin.shadow, '#FFFFFF', 0.3), stroke: skin.ink, opacity: 1
      };
    }

    /* ---- DINO tail ------------------------------------------------------
       Anchored low on the hip and curling UP, so it clears the body and the
       arm instead of hiding behind them. Painted in the accent colour for
       the same reason — a tail the same colour as the body is not a tail. */
    if (g.has.dino) {
      /* Anchored INSIDE the hip and kept low, so it grows out of the body
         instead of floating beside it like a crescent moon. */
      s.tail = {
        d: path.limb(GEO.bodyCX - bRX * 0.3, GEO.bodyCY + bRY * 0.62, 54 * g.tailLen,
                     Math.PI - 0.28, 16, 14 + g.tailCurl * 0.25,
                     { taper: 0.13, steps: 10 }),
        fill: skin.accent, stroke: skin.ink, opacity: 1
      };
    } else if (g.has.butterfly) {
      /* a little curl of a tail so the slot is never wasted */
      s.tail = {
        d: path.limb(GEO.bodyCX - bRX * 0.5, GEO.bodyCY + bRY * 0.55, 30, Math.PI - 0.1, 6, 14,
                     { taper: 0.12, steps: 8 }),
        fill: skin.shadow, stroke: skin.ink, opacity: 0.95
      };
    }

    /* ---- BUTTERFLY wings ----------------------------------------------- */
    if (g.has.butterfly) {
      var span = g.wingSpan;
      ['L', 'R'].forEach(function (side) {
        var dir = side === 'L' ? -1 : 1;
        var ax = GEO.bodyCX + dir * 6, ay = GEO.bodyCY - 8;
        /* A wing is NARROW where it meets the body and BROAD at the tip, so
           taper runs above 1. (Getting this backwards makes a fluffy collar.)
           In SVG +y is down, so "up and out" needs a negative angle. */
        var upAng = dir > 0 ? -0.72 + g.wingTilt : Math.PI + 0.72 - g.wingTilt;
        var upLen = 72 * span;
        s['wingFront' + side] = {
          d: path.limb(ax, ay, upLen, upAng, 12 * span, dir * 15,
                       { taper: 2.05, bulge: 0.55, steps: 11 }),
          fill: skin.accent, stroke: skin.ink, opacity: 0.97
        };
        /* hindwing: shorter and rounder, sweeping down and out */
        var dnAng = dir > 0 ? 0.62 : Math.PI - 0.62;
        s['wingBack' + side] = {
          d: path.limb(ax, ay + 14, 52 * span, dnAng, 11 * span, dir * -11,
                       { taper: 1.95, bulge: 0.5, steps: 11 }),
          fill: XY.mixHex(skin.accent, '#FFFFFF', 0.34), stroke: skin.ink, opacity: 0.97
        };
        /* Wing markings — cheap to draw, and they do a huge amount of the
           work of making a shape read as "butterfly" rather than "leaf". */
        var spots = [], t, px, py, rr;
        for (var si = 0; si < 3; si++) {
          t = 0.45 + si * 0.2;
          px = ax + Math.cos(upAng) * upLen * t - Math.sin(upAng) * (dir * 15) * Math.sin(t * Math.PI);
          py = ay + Math.sin(upAng) * upLen * t + Math.cos(upAng) * (dir * 15) * Math.sin(t * Math.PI);
          rr = (7 - si * 1.4) * span;
          if (g.wingPattern === 'lemon') {
            spots.push(path.blob(px, py, rr * 1.25, rr * 0.8, { points: 14, wobble: 0, rotate: upAng }));
          } else if (g.wingPattern === 'hearts') {
            spots.push(path.star(px, py, rr * 1.1, rr * 0.55, 5, -Math.PI / 2));
          } else {
            spots.push(path.blob(px, py, rr, rr, { points: 14, wobble: 0.06, rand: rand }));
          }
        }
        s['wingSpot' + side] = {
          d: spots.join(' '),
          fill: g.wingPattern === 'lemon' ? '#FFD84D' : XY.mixHex(skin.shadow, '#FFFFFF', 0.15),
          opacity: 0.85
        };
      });
    } else if (g.has.robot) {
      /* jetpack fins instead of wings — still the wing slots, so a butterfly
         can morph its wings straight into a jetpack. */
      ['L', 'R'].forEach(function (side) {
        var dir = side === 'L' ? -1 : 1;
        s['wingBack' + side] = {
          d: path.limb(GEO.bodyCX + dir * 16, GEO.bodyCY - 4, 30, dir > 0 ? 0.9 : Math.PI - 0.9,
                       13, dir * 6, { taper: 0.5, steps: 9 }),
          fill: skin.shadow, stroke: skin.ink, opacity: 1
        };
      });
    }

    /* ---- HEAD ---------------------------------------------------------- */
    s.head = {
      d: g.has.robot && !g.has.butterfly
        ? path.roundRect(GEO.headCX, GEO.headCY, hRX * 1.85, hRY * 1.8, 0.5)
        : path.blob(GEO.headCX, GEO.headCY, hRX, hRY, { rand: rand, wobble: 0.03,
            shape: function (a) { return 1 + 0.06 * Math.sin(a); } }),
      fill: skin.main, stroke: skin.ink, opacity: 1
    };

    /* dino snout */
    if (g.has.dino) {
      s.snout = {
        d: path.blob(GEO.headCX, GEO.headCY + 16, hRX * 0.52, hRY * 0.36,
                     { rand: rand, wobble: 0.03 }),
        fill: XY.mixHex(skin.main, '#FFFFFF', 0.3), stroke: skin.ink, opacity: 1
      };
    }

    /* ---- CREST: dino spikes / butterfly antennae base / robot ridge ----- */
    if (g.has.dino) {
      var n = g.spikeCount, sp = [];
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var ang = -Math.PI / 2 + lerp(-0.75, 0.75, t);
        var cx = GEO.headCX + Math.cos(ang) * hRX * 0.9;
        var cy = GEO.headCY + Math.sin(ang) * hRY * 0.9;
        sp.push(path.limb(cx, cy, 15 + Math.sin(t * Math.PI) * 9, ang, 6.5, 0,
                          { taper: 0.05, steps: 6 }));
      }
      s.crest = { d: sp.join(' '), fill: skin.accent, stroke: skin.ink, opacity: 1 };
    }

    /* ---- HORNS / FRILL ------------------------------------------------- */
    if (g.hornStyle === 'horn') {
      ['L', 'R'].forEach(function (side) {
        var dir = side === 'L' ? -1 : 1;
        s['horn' + side] = {
          d: path.limb(GEO.headCX + dir * hRX * 0.55, GEO.headCY - hRY * 0.78, 20,
                       -Math.PI / 2 + dir * 0.5, 6, dir * 4, { taper: 0.08, steps: 7 }),
          fill: XY.mixHex(skin.accent, '#FFFFFF', 0.2), stroke: skin.ink, opacity: 1
        };
      });
    }

    /* ---- EARS / BOLTS -------------------------------------------------- */
    if (g.earStyle !== 'none') {
      ['L', 'R'].forEach(function (side) {
        var dir = side === 'L' ? -1 : 1;
        var ex = GEO.headCX + dir * hRX * 0.98, ey = GEO.headCY - 4;
        s['ear' + side] = g.earStyle === 'bolt'
          ? { d: path.star(ex, ey, 9, 6.5, 6, 0), fill: skin.shadow, stroke: skin.ink, opacity: 1 }
          : { d: path.blob(ex, ey, 11, 13, { rand: rand, wobble: 0.05 }),
              fill: skin.main, stroke: skin.ink, opacity: 1 };
      });
    }

    /* ---- EYES — the single most important part ------------------------- */
    var eR = GEO.eyeR * g.eyeScale;
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      var ex = GEO.headCX + dir * GEO.eyeDX, ey = GEO.eyeCY;
      s['eyeWhite' + side] = {
        d: path.blob(ex, ey, eR, eR * (1 - g.squint), { points: 14, wobble: 0 }),
        fill: '#FFFFFF', stroke: skin.ink, opacity: 1
      };
      /* pupils look slightly inward and down — reads as friendly, not blank */
      s['pupil' + side] = {
        d: path.blob(ex - dir * 1.2, ey + 2.2, eR * 0.52, eR * 0.56, { points: 14, wobble: 0 }),
        fill: '#2A1B4A', opacity: 1
      };
      s['glint' + side] = {
        d: path.blob(ex - dir * 3.2 + 1, ey - 3.6, eR * 0.24, eR * 0.24, { points: 14, wobble: 0 }),
        fill: '#FFFFFF', opacity: 0.95
      };
    });

    /* pirate eyepatch */
    if (g.eyePatch) {
      s.patch = {
        d: path.blob(GEO.headCX - GEO.eyeDX, GEO.eyeCY - 1, eR * 1.35, eR * 1.2,
                     { points: 14, wobble: 0.02, rand: rand }),
        fill: '#2A1B4A', opacity: 1
      };
    }

    /* oversized sunglasses — Xyla's actual signature look */
    if (g.shades) {
      s.shades = { d: shadesPath(GEO.headCX, GEO.eyeCY, GEO.eyeDX, eR), fill: '#2A2340', opacity: 0.92 };
    }

    /* ---- CHEEKS — never optional. Rosy cheeks do enormous work. -------- */
    ['L', 'R'].forEach(function (side) {
      var dir = side === 'L' ? -1 : 1;
      s['cheek' + side] = {
        d: path.blob(GEO.headCX + dir * GEO.cheekDX, GEO.cheekCY, GEO.cheekR, GEO.cheekR * 0.72,
                     { points: 14, wobble: 0.04, rand: rand }),
        fill: '#FF8FB1', opacity: 0.5
      };
    });

    /* ---- MOUTH --------------------------------------------------------- */
    s.mouth = { d: mouthPath(g.mouthStyle, GEO.headCX, GEO.mouthCY), fill: '#2A1B4A', opacity: 1 };

    /* ---- HAT ------------------------------------------------------------
       A pirate hat has to read as PIRATE at thumbnail size, so it is built in
       four layers: a feather plume behind, the tricorn itself, a gold trim
       along the brim, and a badge. The badge is crossed bones with a lemon
       instead of a skull — unmistakably pirate, entirely un-scary for a
       three-year-old, and on-theme for the Lemon Sea.                      */
    var hatY = GEO.headCY - hRY * 0.92;
    if (g.hatStyle === 'tricorn') {
      var hw = hRX * 1.42;
      s.hatPlume = {
        d: plumePath(GEO.headCX + hw * 0.42, hatY - 6, g.plumeLen),
        fill: g.plumeColor, stroke: skin.ink, opacity: 1
      };
      s.hat = { d: tricornPath(GEO.headCX, hatY, hw), fill: '#2A1B4A', stroke: '#0B1730', opacity: 1 };
      s.hatTrim = { d: tricornTrim(GEO.headCX, hatY, hw), fill: '#FFD84D', opacity: 0.95 };
      s.hatEmblem = { d: crossbones(GEO.headCX, hatY - 4, 15), fill: '#FFF8EE', opacity: 1 };
      s.hatBadge = { d: lemonPath(GEO.headCX, hatY - 4, 8.5), fill: '#FFD84D', stroke: '#F0A500', opacity: 1 };
    } else if (g.hatStyle === 'bandana') {
      s.hat = { d: bandanaPath(GEO.headCX, GEO.headCY - hRY * 0.74, hRX * 1.12),
                fill: g.bandanaColor, stroke: skin.ink, opacity: 1 };
      s.hatTrim = { d: bandanaSpots(GEO.headCX, GEO.headCY - hRY * 0.78, hRX * 1.0),
                    fill: '#FFF8EE', opacity: 0.9 };
      s.hatEmblem = { d: crossbones(GEO.headCX, GEO.headCY - hRY * 0.82, 11), fill: '#FFF8EE', opacity: 1 };
      s.hatBadge = { d: lemonPath(GEO.headCX, GEO.headCY - hRY * 0.82, 6), fill: '#FFD84D', stroke: '#F0A500', opacity: 1 };
    }

    /* ---- ANTENNAE -------------------------------------------------------
       Robots get a stubby aerial with a lamp; butterflies get long curled
       feelers with a bobble on the end. Same two slots either way, so one
       can morph straight into the other.                                   */
    if (g.antenna) {
      var bug = g.has.butterfly && !g.has.robot;
      var aLen2 = bug ? 34 : 26;
      var aThick = bug ? 1.9 : 2.8;
      var sides = g.antennaCount === 2 ? ['L', 'R'] : ['L'];
      sides.forEach(function (side) {
        var dir = g.antennaCount === 2 ? (side === 'L' ? -1 : 1) : 0;
        var ax = GEO.headCX + dir * hRX * 0.42;
        var ay = GEO.headCY - hRY * 0.88;
        var ang = -Math.PI / 2 + dir * (bug ? 0.52 : 0.28);
        s['antenna' + side] = {
          d: path.limb(ax, ay, aLen2, ang, aThick, dir * (bug ? 9 : 3),
                       { taper: 0.55, steps: 8 }),
          fill: bug ? skin.ink : skin.shadow, stroke: skin.ink, opacity: 1
        };
        /* the bobble sits at the curled tip, not the straight-line tip */
        var tipX = ax + Math.cos(ang) * aLen2 - Math.sin(ang) * 0;
        var tipY = ay + Math.sin(ang) * aLen2;
        s['antennaBall' + side] = {
          d: path.blob(tipX, tipY, bug ? 5.5 : 6.5, bug ? 5.5 : 6.5, { points: 14, wobble: 0 }),
          fill: bug ? skin.accent : '#FFD84D', stroke: skin.ink, opacity: 1
        };
      });
    }

    /* ---- ACCESSORY ----------------------------------------------------- */
    if (g.accessory !== 'none') {
      s.accessory = accessoryPath(g.accessory, skin);
    }

    return s;
  }

  /* ---- sub-shapes ------------------------------------------------------ */
  function shadesPath(cx, cy, dx, r) {
    // Two big rounded lenses joined by a bridge — deliberately oversized.
    var lens = function (x) {
      return path.blob(x, cy, r * 1.5, r * 1.25, { points: 14, wobble: 0,
        shape: function (a) { return 1 + 0.1 * Math.cos(a * 2); } });
    };
    var bridge = path.roundRect(cx, cy - 2, dx * 0.9, 4.5, 1);
    var armL = path.roundRect(cx - dx - r * 1.5, cy - 4, 10, 4, 1);
    var armR = path.roundRect(cx + dx + r * 1.5, cy - 4, 10, 4, 1);
    return [lens(cx - dx), lens(cx + dx), bridge, armL, armR].join(' ');
  }

  function mouthPath(style, cx, cy) {
    if (style === 'oh') return path.blob(cx, cy + 2, 7, 8, { points: 14, wobble: 0 });
    if (style === 'grin') {
      var pts = path.scallop(cx - 13, cy, cx + 13, cy, 3, 4, false);
      return path.closedSpline(pts.concat([[cx + 13, cy - 5], [cx, cy - 6], [cx - 13, cy - 5]]), 0.6);
    }
    // default smile: a filled crescent
    var a = [], b = [], i, t;
    for (i = 0; i <= 8; i++) {
      t = i / 8;
      a.push([cx - 12 + 24 * t, cy + Math.sin(t * Math.PI) * 8.5]);
    }
    for (i = 8; i >= 0; i--) {
      t = i / 8;
      b.push([cx - 12 + 24 * t, cy + Math.sin(t * Math.PI) * 3.2]);
    }
    return path.closedSpline(a.concat(b), 0.8);
  }

  /* A proper tricorn: wide sweeping brim, three sharply upturned corners,
     and a tall crown. The exaggerated corner peaks are what make it read as
     a pirate hat and not a fedora. */
  function tricornPath(cx, cy, w) {
    var pts = [
      [cx - w, cy - 10],                          // left peak, turned up
      [cx - w * 0.72, cy + 2],
      [cx - w * 0.38, cy - 12],
      [cx, cy - 26],                              // centre peak, tallest
      [cx + w * 0.38, cy - 12],
      [cx + w * 0.72, cy + 2],
      [cx + w, cy - 10],                          // right peak
      [cx + w * 0.9, cy + 9],
      [cx + w * 0.45, cy + 15],
      [cx, cy + 17],
      [cx - w * 0.45, cy + 15],
      [cx - w * 0.9, cy + 9],
    ];
    var crown = path.blob(cx, cy - 7, w * 0.5, 16, { points: 14, wobble: 0 });
    return path.closedSpline(pts, 0.62) + ' ' + crown;
  }

  /* Gold trim hugging the brim edge. */
  function tricornTrim(cx, cy, w) {
    var outer = [
      [cx - w * 0.97, cy - 8], [cx - w * 0.7, cy + 3.5], [cx - w * 0.37, cy - 10],
      [cx, cy - 23], [cx + w * 0.37, cy - 10], [cx + w * 0.7, cy + 3.5],
      [cx + w * 0.97, cy - 8], [cx + w * 0.87, cy + 7], [cx + w * 0.44, cy + 13],
      [cx, cy + 15], [cx - w * 0.44, cy + 13], [cx - w * 0.87, cy + 7],
    ];
    var inner = outer.map(function (p) {
      return [cx + (p[0] - cx) * 0.86, cy + 4 + (p[1] - cy - 4) * 0.84];
    });
    /* two concentric rings, wound oppositely, gives a hollow band with the
       browser's default even-odd-ish nonzero fill doing the work */
    return path.closedSpline(outer, 0.62) + ' ' + path.closedSpline(inner.reverse(), 0.62);
  }

  /* Crossed bones — the pirate signal, minus anything frightening. */
  function crossbones(cx, cy, r) {
    var bone = function (ang) {
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var shaft = path.limb(cx - ca * r, cy - sa * r, r * 2, ang, 2.6, 0, { taper: 1, steps: 6 });
      var knobs = '';
      [-1, 1].forEach(function (e) {
        var ex = cx + ca * r * e, ey = cy + sa * r * e;
        knobs += ' ' + path.blob(ex - sa * 3, ey + ca * 3, 3.4, 3.4, { points: 14, wobble: 0 });
        knobs += ' ' + path.blob(ex + sa * 3, ey - ca * 3, 3.4, 3.4, { points: 14, wobble: 0 });
      });
      return shaft + knobs;
    };
    return bone(0.72) + ' ' + bone(-0.72);
  }

  /* A lemon, sitting where a skull would go. On-theme and friendly. */
  function lemonPath(cx, cy, r) {
    return path.blob(cx, cy, r * 1.18, r * 0.86, {
      points: 14, wobble: 0,
      shape: function (a) { return 1 + 0.2 * Math.pow(Math.abs(Math.cos(a)), 6); }
    });
  }

  /* A feather plume tucked behind the brim. */
  function plumePath(x, y, len) {
    return path.limb(x, y, len, -1.15, 5.5, 16, { taper: 0.25, bulge: 0.5, steps: 10 });
  }

  function bandanaPath(cx, cy, w) {
    var body = path.closedSpline([
      [cx - w, cy + 3], [cx - w * 0.55, cy - 10], [cx, cy - 14], [cx + w * 0.55, cy - 10],
      [cx + w, cy + 3], [cx + w * 0.55, cy + 9], [cx, cy + 11], [cx - w * 0.55, cy + 9],
    ], 0.7);
    /* two trailing tails on the side, like a knotted headscarf */
    var knot = path.limb(cx + w * 0.88, cy + 4, 24, 0.55, 6, 7, { taper: 0.35, steps: 8 });
    var knot2 = path.limb(cx + w * 0.88, cy + 4, 18, 1.05, 4.5, 5, { taper: 0.3, steps: 8 });
    return body + ' ' + knot + ' ' + knot2;
  }

  function bandanaSpots(cx, cy, w) {
    var out = [];
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      out.push(path.blob(cx - w * 0.75 + w * 1.5 * t, cy + Math.sin(t * Math.PI) * -3 + 6,
                         2.6, 2.6, { points: 14, wobble: 0 }));
    }
    return out.join(' ');
  }

  function accessoryPath(kind, skin) {
    if (kind === 'cutlass') {
      var blade = path.limb(150, 150, 46, -1.15, 5, 9, { taper: 0.1, steps: 9 });
      var hilt = path.roundRect(150, 152, 16, 5, 1);
      return { d: blade + ' ' + hilt, fill: '#DCE6F2', stroke: '#2A1B4A', opacity: 1 };
    }
    if (kind === 'lolly') {
      var stick = path.roundRect(150, 146, 4, 34, 1);
      var candy = path.blob(150, 124, 14, 14, { points: 14, wobble: 0 });
      return { d: candy + ' ' + stick, fill: '#FF8FB1', stroke: '#2A1B4A', opacity: 1 };
    }
    if (kind === 'balloon') {
      var str = path.limb(152, 150, 40, -1.5, 1.4, 6, { taper: 1, steps: 7 });
      var ball = path.blob(156, 100, 17, 20, { points: 14, wobble: 0.03 });
      return { d: ball + ' ' + str, fill: skin.accent, stroke: '#2A1B4A', opacity: 1 };
    }
    // flag
    var pole = path.roundRect(150, 132, 3.5, 56, 1);
    var cloth = path.closedSpline([
      [152, 106], [172, 110], [186, 104], [186, 122], [170, 128], [152, 124],
    ], 0.8);
    return { d: pole + ' ' + cloth, fill: '#FFD84D', stroke: '#2A1B4A', opacity: 1 };
  }

  /* ======================================================================
   *  RENDER — spec to DOM
   * ==================================================================== */
  function render(g, opts) {
    opts = opts || {};
    var sp = spec(g);
    /* The drawing lives in a 0..200 box, but wings, tails and flags reach
       outside it — so the viewBox is padded to give them room to breathe. */
    var svg = XY.svgEl('svg', {
      viewBox: '-28 -18 256 232', class: 'creature',
      'aria-hidden': 'true', focusable: 'false', overflow: 'visible'
    });
    var root = XY.svgEl('g', { class: 'c-root' });
    /* two nested groups so flight (outer, composited) and squash (inner)
       never fight over the same transform attribute */
    var flap = XY.svgEl('g', { class: 'c-body' });
    var nodes = {};

    SLOTS.forEach(function (slot) {
      var a = sp[slot];
      var p = XY.svgEl('path', {
        d: a.d,
        fill: a.fill || 'none',
        opacity: a.opacity,
        'data-slot': slot,
      });
      if (a.stroke) {
        p.setAttribute('stroke', a.stroke);
        p.setAttribute('stroke-width', 3);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('paint-order', 'stroke');
      }
      nodes[slot] = p;
      // wings live in their own groups so they can flap around a hinge
      flap.appendChild(p);
    });

    root.appendChild(flap);
    svg.appendChild(root);

    var c = {
      genome: g, spec: sp, svg: svg, root: root, body: flap, nodes: nodes,
      name: g.name,
    };
    return c;
  }

  /* ======================================================================
   *  MORPH — the centrepiece.
   *  Every slot has a counterpart by construction, so this is a total
   *  transformation with no special cases: shape, colour and opacity all
   *  travel at once, hidden under a squash-and-stretch beat that reads as
   *  cartoon anticipation rather than as a swap.
   * ==================================================================== */
  function morphTo(c, newGenome, opts) {
    opts = opts || {};
    var dur = opts.duration || 0.9;
    var target = spec(newGenome);

    /* NEVER build this paused.
     *
     * It used to be `gsap.timeline({ paused: !!opts.paused })` so that callers
     * could add it to the master timeline — but a paused child does not
     * advance when its parent plays. GSAP zeroes a paused animation's time
     * scale, and the parent honours that, so every scripted morph in the story
     * sat frozen on frame zero. The crew never changed once. The tap-to-abduct
     * morph worked, which is exactly why it went unnoticed: that path is the
     * one caller that did not pass `paused`.
     *
     * Unpaused is also correct for the add-to-master case: `master.add(tl)`
     * reparents the timeline off the root in the same synchronous pass it is
     * built in, so it cannot play early. Callers must add it synchronously,
     * which every caller does.
     */
    var tl = gsap.timeline();

    /* anticipation: squash down, then spring out */
    tl.to(c.body, { scaleY: 0.7, scaleX: 1.24, duration: 0.18, ease: 'power2.in',
                    transformOrigin: '100px 184px' }, 0);

    SLOTS.forEach(function (slot) {
      var node = c.nodes[slot];
      var to = target[slot];
      var from = c.spec[slot];
      /* MorphSVGPlugin handles differing point counts and winding for us,
         which is why the parts can be genuinely different shapes. */
      if (to.d !== from.d) {
        tl.to(node, {
          morphSVG: { shape: to.d, shapeIndex: 'auto' },
          duration: dur, ease: 'power2.inOut'
        }, 0.1);
      }
      tl.to(node, {
        attr: { fill: to.fill || 'none', stroke: to.stroke || null },
        opacity: to.opacity,
        duration: dur * 0.7, ease: 'power1.inOut'
      }, 0.14);
    });

    tl.to(c.body, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, 0.18);

    c.genome = newGenome;
    c.spec = target;
    c.name = newGenome.name;
    return tl;
  }

  /* ======================================================================
   *  AMBIENT LIFE — never added to the master timeline.
   *  These loop forever so the world stays alive after the story ends, and so
   *  the master timeline remains cleanly seekable.
   * ==================================================================== */
  function animate(c, rand) {
    rand = rand || XY.rng(c.genome.seed + 3);
    var g = c.genome;
    var tls = [];

    /* breathing */
    tls.push(gsap.to(c.body, {
      scaleY: 1.045, scaleX: 0.975, duration: rand.range(1.3, 2.1),
      repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '100px 184px'
    }));

    /* blinking — random, sparse, never in sync across the cast */
    var blink = function () {
      gsap.timeline({ onComplete: function () { gsap.delayedCall(rand.range(1.8, 6), blink); } })
        .to([c.nodes.eyeWhiteL, c.nodes.eyeWhiteR, c.nodes.pupilL, c.nodes.pupilR,
             c.nodes.glintL, c.nodes.glintR], {
          scaleY: 0.08, duration: 0.09, ease: 'power2.in', transformOrigin: '50% 50%'
        })
        .to([c.nodes.eyeWhiteL, c.nodes.eyeWhiteR, c.nodes.pupilL, c.nodes.pupilR,
             c.nodes.glintL, c.nodes.glintR], {
          scaleY: 1, duration: 0.12, ease: 'power2.out'
        });
    };
    gsap.delayedCall(rand.range(0.5, 4), blink);

    /* wing flap / fin shimmer */
    var wings = [c.nodes.wingBackL, c.nodes.wingBackR, c.nodes.wingFrontL, c.nodes.wingFrontR];
    if (g.has.butterfly) {
      tls.push(gsap.to([c.nodes.wingBackL, c.nodes.wingFrontL], {
        scaleX: 0.62, rotation: 7, duration: rand.range(0.28, 0.45), repeat: -1, yoyo: true,
        ease: 'sine.inOut', transformOrigin: '100px 128px'
      }));
      tls.push(gsap.to([c.nodes.wingBackR, c.nodes.wingFrontR], {
        scaleX: 0.62, rotation: -7, duration: rand.range(0.28, 0.45), repeat: -1, yoyo: true,
        ease: 'sine.inOut', transformOrigin: '100px 128px'
      }));
    } else {
      tls.push(gsap.to(wings, {
        rotation: 4, duration: rand.range(1.4, 2.4), repeat: -1, yoyo: true,
        ease: 'sine.inOut', transformOrigin: '100px 130px'
      }));
    }

    /* tail wag */
    if (c.nodes.tail) {
      tls.push(gsap.to(c.nodes.tail, {
        rotation: rand.range(5, 11), duration: rand.range(0.9, 1.6), repeat: -1, yoyo: true,
        ease: 'sine.inOut', transformOrigin: '100px 140px'
      }));
    }

    /* antenna bob + LED pulse (slow — nothing on this page flickers faster
       than 3Hz, for photosensitivity safety) */
    ['L', 'R'].forEach(function (side) {
      var ball = c.nodes['antennaBall' + side];
      if (ball && +ball.getAttribute('opacity') > 0) {
        tls.push(gsap.to(ball, { scale: 1.25, opacity: 0.75, duration: rand.range(0.9, 1.4),
          repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%' }));
      }
    });

    c.ambient = tls;
    return tls;
  }

  /* A quick happy reaction — used when a kid taps a creature. */
  function react(c) {
    var tl = gsap.timeline();
    tl.to(c.body, { scaleY: 0.78, scaleX: 1.2, duration: 0.12, ease: 'power2.in',
                    transformOrigin: '100px 184px' })
      .to(c.body, { scaleY: 1.14, scaleX: 0.9, duration: 0.18, ease: 'power2.out' })
      .to(c.body, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    tl.to(c.root, { rotation: XY.rng(Date.now() & 1023).sign() * 8, duration: 0.16,
                    yoyo: true, repeat: 1, ease: 'sine.inOut',
                    transformOrigin: '100px 184px' }, 0);
    return tl;
  }

  /* --------------------------------------------------------------------------
   *  Two creatures playing with each other.
   *
   *  Everything else on this stage is a solo performance — each creature
   *  breathes and blinks in its own little bubble, which is why a row of them
   *  reads as a row of them rather than as a crew. This is the fix: neighbours
   *  are paired up and given a game to play, on a loop, forever.
   *
   *  Rules it has to obey, both inherited from the file header:
   *   - It is an INFINITE timeline, so it must never be added to master. It
   *     animates `.c-root`/`.c-body` only, never the `.actor` host, because the
   *     host's x/y belong to the story and a tug of war over them would make
   *     scrubbing jump.
   *   - Seeded from the pair, so a given pair always plays the same game.
   * ------------------------------------------------------------------------*/
  var GAMES = ['bump', 'copy', 'spin', 'peek'];

  function play(a, b, seed) {
    if (!a || !b) return null;
    var rand = XY.rng((seed || '') + ':play:' + a.genome.seed + b.genome.seed);
    var game = rand.pick(GAMES);
    var gap = rand.range(2.6, 5.0);        // pause between rounds
    var dir = a.homeX > b.homeX ? -1 : 1;  // which way they lean to meet
    var tl = gsap.timeline({ repeat: -1, repeatDelay: gap, delay: rand.range(0, 3) });
    var O = '100px 184px';

    if (game === 'bump') {
      /* lean in, tap shoulders, rock back */
      tl.to(a.root, { x: 16 * dir, rotation: 7 * dir, duration: 0.5, ease: 'power2.in', transformOrigin: O }, 0)
        .to(b.root, { x: -16 * dir, rotation: -7 * dir, duration: 0.5, ease: 'power2.in', transformOrigin: O }, 0)
        .to([a.body, b.body], { scaleX: 1.12, scaleY: 0.9, duration: 0.1, transformOrigin: O }, 0.5)
        .to(a.root, { x: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.6)
        .to(b.root, { x: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.6)
        .to([a.body, b.body], { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.5)' }, 0.6);

    } else if (game === 'copy') {
      /* one hops, the other copies a beat later — the oldest gag there is */
      tl.to(a.root, { y: -34, duration: 0.32, ease: 'power2.out' }, 0)
        .to(a.root, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.32)
        .to(b.root, { y: -34, duration: 0.32, ease: 'power2.out' }, 0.55)
        .to(b.root, { y: 0, duration: 0.6, ease: 'bounce.out' }, 0.87);

    } else if (game === 'spin') {
      /* they swap places, orbiting past each other */
      var d = Math.abs(a.homeX - b.homeX) * 2.2;
      tl.to(a.root, { x: d * dir, y: -18, rotation: 360, duration: 1.2, ease: 'power2.inOut', transformOrigin: O }, 0)
        .to(b.root, { x: -d * dir, y: 18, rotation: -360, duration: 1.2, ease: 'power2.inOut', transformOrigin: O }, 0)
        .to(a.root, { x: 0, y: 0, rotation: 0, duration: 1.2, ease: 'power2.inOut' }, 1.5)
        .to(b.root, { x: 0, y: 0, rotation: 0, duration: 1.2, ease: 'power2.inOut' }, 1.5);

    } else {
      /* peek: one ducks behind, pops back up, and the other startles */
      tl.to(a.body, { scaleY: 0.55, y: 40, duration: 0.35, ease: 'power2.in', transformOrigin: O }, 0)
        .to(a.body, { scaleY: 1, y: 0, duration: 0.7, ease: 'back.out(2.4)' }, 0.75)
        .to(b.root, { rotation: -9 * dir, duration: 0.14, ease: 'power2.out', transformOrigin: O }, 0.8)
        .to(b.body, { scaleY: 1.16, scaleX: 0.88, duration: 0.14, transformOrigin: O }, 0.8)
        .to(b.root, { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 0.96)
        .to(b.body, { scaleY: 1, scaleX: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 0.96);
    }

    a.playTl = b.playTl = tl;
    return tl;
  }

  XY.Creature = {
    SLOTS: SLOTS, KITS: KITS, GEO: GEO,
    genome: genome, spec: spec, render: render,
    morphTo: morphTo, animate: animate, react: react, play: play,
    /* Exposed so the photo hero can wear the same generated pirate hat the
       drawn crew wears — one hat design, used in both places. */
    shapes: {
      tricornPath: tricornPath, tricornTrim: tricornTrim,
      crossbones: crossbones, lemonPath: lemonPath, plumePath: plumePath,
      mouthPath: mouthPath, bandanaPath: bandanaPath,
    },
  };

})(window.XY = window.XY || {});
