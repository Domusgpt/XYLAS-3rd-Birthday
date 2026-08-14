/* ============================================================================
 *  story.js — the stage and the master timeline
 *  ---------------------------------------------------------------------------
 *  Seven acts, one seekable GSAP timeline.
 *
 *  ONE ARCHITECTURAL RULE, and everything depends on it:
 *
 *    The master timeline contains ONLY staging — entrances, positions, reveals,
 *    camera moves, palette changes. Every looping motion (breathing, wing flap,
 *    blinking, hover bob, beacon pulse) lives in its own infinite timeline
 *    created when the actor spawns, and is NEVER added to master.
 *
 *  Why: an infinite child would make master.progress() meaningless, breaking
 *  both scrubbing and the #seek= screenshot harness. It also means the world
 *  stays alive after the story ends, instead of freezing on the last frame.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var path = XY.path;

  /* Each act carries the line of story that goes with it. A storybook without
     any words is just a slideshow. */
  var ACTS = [
    { key: 'cover',  at: 0,    sky: 'cover',  label: 'Once upon a time',
      line: '' },
    { key: 'sea',    at: 6,    sky: 'sea',    label: 'The Lemon Sea',
      line: 'Captain Xyla set sail across the Lemon Sea…' },
    { key: 'morph',  at: 13.5, sky: 'morph',  label: 'The Changing',
      line: '…and one by one, her crew began to change.' },
    { key: 'clouds', at: 21,   sky: 'clouds', label: 'Cloud Kingdom',
      line: 'Up and up they climbed, past the clouds.' },
    { key: 'fleet',  at: 27,   sky: 'fleet',  label: 'The Fleet',
      line: 'Then the saucers came down to fetch them.' },
    { key: 'planet', at: 34.5, sky: 'planet', label: 'Party Planet',
      line: 'And there it was. The party at the top of the sky.' },
    { key: 'invite', at: 41,   sky: 'invite', label: 'You’re Invited',
      line: 'Xyla is turning three. Come and find her.' },
  ];
  var END = 47;

  /* ======================================================================
   *  Scenery — generated, like everything else
   * ==================================================================== */
  function sceneSVG(cls, viewBox) {
    var svg = XY.svgEl('svg', {
      class: cls, viewBox: viewBox || '0 0 1000 600',
      preserveAspectRatio: 'xMidYMid slice',
      'aria-hidden': 'true', focusable: 'false'
    });
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    return svg;
  }

  function cloudBand(rand, y, count, scale, fill, op) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var cx = rand.range(-60, 1060);
      var cy = y + rand.range(-26, 26);
      var w = rand.range(70, 150) * scale;
      var puffs = [];
      for (var p = 0; p < 5; p++) {
        var t = p / 4;
        puffs.push(path.blob(cx - w / 2 + w * t, cy - Math.sin(t * Math.PI) * w * 0.2,
          w * rand.range(0.2, 0.32), w * rand.range(0.17, 0.26),
          { points: 14, wobble: 0.09, rand: rand }));
      }
      out.push(XY.svgEl('path', { d: puffs.join(' '), fill: fill, opacity: op }));
    }
    return out;
  }

  /* A field of stars and sparkles for the layer furthest back. Static SVG
     rather than a canvas: it never redraws, it parallaxes for free with its
     layer, and it costs one paint. */
  function buildStars(el, rand) {
    var svg = sceneSVG('scene-stars');
    var dots = [], sparks = [];
    for (var i = 0; i < 90; i++) {
      var x = rand.range(-40, 1040), y = rand.range(-30, 480);
      var r = rand.range(1.1, 2.9);
      dots.push(path.blob(x, y, r, r, { points: 14, wobble: 0 }));
    }
    for (var j = 0; j < 14; j++) {
      sparks.push(path.star(rand.range(0, 1000), rand.range(0, 420),
                            rand.range(5, 11), rand.range(1.6, 3.4), 4, rand.range(0, 1)));
    }
    svg.appendChild(XY.svgEl('path', { d: dots.join(' '), fill: '#FFFFFF', opacity: 0.55 }));
    var sp = XY.svgEl('path', { d: sparks.join(' '), fill: '#FFF8EE', opacity: 0.8 });
    svg.appendChild(sp);
    el.appendChild(svg);
    /* a slow, gentle twinkle — well under the 3Hz photosensitivity ceiling */
    gsap.to(sp, { opacity: 0.3, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    return svg;
  }

  function buildFar(el, rand) {
    var svg = sceneSVG('scene-far');
    cloudBand(rand, 150, 5, 1.5, '#FFFFFF', 0.5).forEach(function (n) { svg.appendChild(n); });
    cloudBand(rand, 300, 4, 1.1, '#FFFFFF', 0.35).forEach(function (n) { svg.appendChild(n); });
    el.appendChild(svg);
    return svg;
  }

  /* --------------------------------------------------------------------------
   *  Where the water sits, in the mid scene's own coordinates.
   *
   *  That scene is a 1000x600 box drawn with `slice`, so on a tall phone it is
   *  scaled up ~1.4x to cover the height and then cropped hard horizontally.
   *  With the waves hardcoded at y=470-556 that put the entire Lemon Sea into
   *  the bottom fifth of a phone screen — underneath the narration plate and
   *  the controls, i.e. invisible on the device most people will open this on.
   *
   *  So the waterline is computed from the viewport instead of assumed: it is
   *  placed at ~70% of the screen height whatever the aspect ratio, which is
   *  clear of the narration and still low enough to read as a horizon.
   * ------------------------------------------------------------------------*/
  function midMetrics() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var scale = Math.max(vw / 1000, vh / 600);   // `slice` covers, so max
    var visW = vw / scale;                       // how much of the 1000 shows
    return {
      scale: scale,
      visW: visW,
      xMin: 500 - visW / 2,
      xMax: 500 + visW / 2,
      waterline: XY.clamp(0.70 * vh / scale, 300, 470),
    };
  }

  function buildMid(el, rand, M) {
    var svg = sceneSVG('scene-mid');
    var w = M.waterline;
    /* the Lemon Sea: three bands of scalloped waves */
    var seas = [
      { y: w,      fill: '#A8D8FF', op: 0.85, bumps: 13, d: 16 },
      { y: w + 42, fill: '#7EC8E3', op: 0.9,  bumps: 10, d: 20 },
      { y: w + 86, fill: '#4EA3C6', op: 0.95, bumps: 8,  d: 22 },
    ];
    var waves = [];
    seas.forEach(function (s) {
      var pts = path.scallop(-80, s.y, 1080, s.y, s.bumps, s.d, false);
      pts = pts.concat([[1080, 900], [-80, 900]]);
      var node = XY.svgEl('path', { d: path.closedSpline(pts, 0.8), fill: s.fill, opacity: s.op });
      svg.appendChild(node);
      waves.push(node);
    });
    el.appendChild(svg);
    return { svg: svg, waves: waves };
  }

  function buildShip(rand) {
    /* a little pirate ship with a lemon-slice sail */
    var g = XY.svgEl('g', { class: 'ship' });
    var add = function (d, fill, stroke, op) {
      var p = XY.svgEl('path', { d: d, fill: fill, opacity: op === undefined ? 1 : op });
      if (stroke) {
        p.setAttribute('stroke', stroke);
        p.setAttribute('stroke-width', 4);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('paint-order', 'stroke');
      }
      g.appendChild(p);
      return p;
    };
    add(path.roundRect(100, 8, 5, 120, 1), '#8A5836', '#2A1B4A');       // mast
    /* the sail: a half-lemon */
    add(path.closedSpline([
      [104, -46], [150, -30], [170, 6], [150, 40], [104, 52],
    ], 0.75), '#FFD84D', '#2A1B4A');
    add(path.closedSpline([
      [106, -32], [138, -20], [152, 6], [138, 30], [106, 40],
    ], 0.75), '#FFE9A8', null, 0.9);
    /* hull */
    add(path.closedSpline([
      [30, 66], [170, 66], [150, 104], [50, 104],
    ], 0.55), '#A9714B', '#2A1B4A');
    add(path.roundRect(100, 70, 150, 10, 1), '#C79462', null, 0.9);
    /* a tiny flag */
    add(path.closedSpline([[104, -50], [136, -44], [134, -30], [104, -36]], 0.7),
        '#FF8FB1', '#2A1B4A');
    return g;
  }

  /* ======================================================================
   *  Stage
   * ==================================================================== */
  function Stage(refs, opts) {
    this.refs = refs;
    this.opts = opts || {};
    this.quality = opts.quality || 'high';
    this.rand = XY.rng(XY.CONFIG.THEME.seed + ':stage');
    this.cast = [];
    this.fleet = [];
    this.hero = null;
    this.actIndex = { v: 0 };
    /* The camera. Tweened on master like any other property, and read by the
       ticker in main.js — so every push, pull and re-frame scrubs exactly. */
    this.cam = { zoom: 1, fx: 0, fy: 0 };
  }

  /* Where the camera has to sit to put a point at (xPc, yPc) of the viewport
     in the middle of the frame. Same arithmetic Act 5's gather uses, kept in
     one place. Positive fx moves the world left, i.e. the camera right. */
  function focusOffset(xPc, yPc) {
    return {
      fx: (xPc - 50) / 100 * window.innerWidth,
      fy: (yPc - 50) / 100 * window.innerHeight,
    };
  }

  Stage.prototype.build = function () {
    var self = this, rand = this.rand, R = this.refs;
    var counts = {
      high: { cast: XY.CONFIG.THEME.castSize, fleet: XY.CONFIG.THEME.fleetSize },
      med:  { cast: Math.min(7, XY.CONFIG.THEME.castSize), fleet: 4 },
      low:  { cast: 5, fleet: 3 },
    }[this.quality];

    if (R.stars) buildStars(R.stars, rand);
    buildFar(R.far, rand);
    var M = this.midM = midMetrics();
    this.mid = buildMid(R.mid, rand, M);

    /* The ship, sized and placed from the same metrics as the water.
       Its own art spans x 30..170 and y -50..104, so those constants are what
       turn "about a quarter of the screen tall, sitting in the waves" into a
       scale and an offset. Hardcoding 1.1 made it half a phone screen wide
       with its hull below the fold. */
    this.ship = buildShip(rand);
    var sScale = XY.clamp(0.26 * window.innerHeight / (154 * M.scale), 0.7, 1.4);
    var sY = M.waterline + 26 - 104 * sScale;
    this.shipScale = sScale;
    this.shipHome = M.xMin + 0.45 * M.visW - 110 * sScale;
    this.ship.setAttribute('transform',
      'translate(' + this.shipHome.toFixed(1) + ', ' + sY.toFixed(1) + ') scale(' + sScale.toFixed(3) + ')');
    this.mid.svg.appendChild(this.ship);

    /* ---- the crew ---- */
    var seedBase = XY.CONFIG.THEME.seed;
    for (var i = 0; i < counts.cast; i++) {
      var g = XY.Creature.genome(seedBase + ':' + i);
      var c = XY.Creature.render(g);
      var host = XY.el('div', { class: 'actor is-tappable' });
      host.appendChild(c.svg);
      /* spread the crew across the stage, arcing gently upward at the edges */
      var t = (i + 0.5) / counts.cast;
      var x = 6 + t * 82;
      /* The crew sits in the upper-middle band. It used to start at 52% and
         arc down, which pushed the outer members into the narration and the
         controls once the camera started zooming. */
      var y = 42 + Math.sin(t * Math.PI) * 11 + rand.range(-4, 4);
      host.style.left = x.toFixed(2) + '%';
      host.style.top = y.toFixed(2) + '%';
      host.style.zIndex = String(10 + Math.round(y));
      /* start hidden — the story brings them in */
      gsap.set(host, { autoAlpha: 0, y: 60, scale: 0.7 });
      R.cast.appendChild(host);
      c.host = host;
      c.homeX = x; c.homeY = y;
      c.note = i % XY.SCALE_LEN;
      XY.Creature.animate(c);
      this.cast.push(c);
    }

    /* ---- pair the crew up so they play with each other ----
       Neighbours, because two creatures at opposite ends of the stage leaning
       towards each other reads as a glitch rather than a game. An odd one out
       is left to its own devices, which is fine — it just breathes. */
    for (var q = 0; q + 1 < this.cast.length; q += 2) {
      XY.Creature.play(this.cast[q], this.cast[q + 1], seedBase);
    }

    /* ---- the fleet ---- */
    for (var f = 0; f < counts.fleet; f++) {
      var ug = XY.Ufo.genome(seedBase + ':ufo:' + f);
      var u = XY.Ufo.render(ug);
      var uhost = XY.el('div', { class: 'actor actor-ufo is-tappable' });
      uhost.appendChild(u.svg);
      var ut = (f + 0.5) / counts.fleet;
      u.homeX = 8 + ut * 78;
      u.homeY = 10 + Math.sin(ut * Math.PI + 0.6) * 9;
      uhost.style.left = u.homeX.toFixed(2) + '%';
      uhost.style.top = u.homeY.toFixed(2) + '%';
      gsap.set(uhost, { autoAlpha: 0, y: -180, scale: 0.8 });
      R.fleet.appendChild(uhost);
      u.host = uhost;
      XY.Ufo.animate(u);
      this.fleet.push(u);
    }

    /* ---- Captain Xyla ----
       The real photograph when one is configured, the drawn cartoon otherwise.
       Keeping the cartoon path alive means a missing or broken asset degrades
       to something charming instead of to an empty hole. */
    var photoSrc = (XY.CONFIG.PHOTOS || {}).hero;
    var h = photoSrc
      ? XY.Hero.renderPhoto({ src: photoSrc, hat: true })
      : XY.Hero.render({ hat: true });
    var hhost = XY.el('div', { class: 'actor actor-hero' + (photoSrc ? ' is-photo' : '') });
    hhost.appendChild(h.svg);
    hhost.style.left = '50%';
    /* High enough that at her new size — and under the Act 5 push-in — her
       feet stay above the narration plate instead of running off the bottom. */
    /* 27%, not 33%: the hero viewBox grew upward to contain the tricorn now
       that it sits above her cropped head, and a taller box pushes the photo
       down within it. This puts her back where she was on screen. */
    hhost.style.top = '27%';
    hhost.style.zIndex = '90';
    gsap.set(hhost, { xPercent: -50, autoAlpha: 0, scale: 0.4 });
    gsap.set(R.three, { xPercent: -50, autoAlpha: 0 });
    R.cast.appendChild(hhost);
    h.host = hhost;
    (h.isPhoto ? XY.Hero.animatePhoto : XY.Hero.animate)(h);
    this.hero = h;

    return this;
  };

  /* ======================================================================
   *  The master timeline
   * ==================================================================== */
  Stage.prototype.timeline = function () {
    var self = this;
    var R = this.refs;
    var tl = gsap.timeline({ paused: true });
    var vh = window.innerHeight, vw = window.innerWidth;

    ACTS.forEach(function (a) { tl.addLabel(a.key, a.at); });

    /* The sky palette is driven by a tweened numeric proxy rather than by
       callbacks, so scrubbing backwards works exactly as well as forwards. */
    tl.to(this.actIndex, { v: ACTS.length - 1, duration: END, ease: 'none' }, 0);

    /* ---------------- THE CAMERA ----------------
       Every move is a tween on `this.cam`, which the ticker reads. Nothing
       here is a callback, so the camera is in the right place at every point
       of a scrub, in both directions — the same reason the morphs and the
       narration are tweens rather than calls.

       `focusOffset` centres a point given as a percentage of the viewport.
       Actors are positioned as a percentage of their layer (which bleeds 8%
       past the viewport), so `actorCentre` converts one to the other and adds
       half the actor's own box to aim at its middle rather than its corner. */
    var cam = this.cam;
    function actorCentre(host, homeX, homeY) {
      var xPc = -8 + homeX * 1.16 + (host.offsetWidth  / vw) * 50;
      var yPc = -8 + homeY * 1.16 + (host.offsetHeight / vh) * 50;
      return focusOffset(xPc, yPc);
    }
    /* Push the camera to `zoom`, centred on `f` ({fx, fy}), arriving at `at`. */
    function camTo(zoom, f, at, dur, ease) {
      tl.to(cam, {
        zoom: zoom, fx: f.fx, fy: f.fy,
        duration: dur, ease: ease || 'power2.inOut',
      }, at);
    }
    var CENTRE = { fx: 0, fy: 0 };

    /* Act 0 — wide and still. Nothing to look at yet but the title. */
    tl.set(cam, { zoom: 1, fx: 0, fy: 0 }, 0);
    /* Act 1 — a slow drift right with the ship as it crosses. */
    camTo(1.16, focusOffset(58, 62), 6.2, 4.5, 'sine.inOut');
    /* Act 2 — the close-ups the centrepiece never had. The camera steps from
       creature to creature as each one changes, then eases back out. */
    this.cast.forEach(function (c, i) {
      if (i > 4) return;                       // the first five, then release
      camTo(1.5, actorCentre(c.host, c.homeX, c.homeY), 13.8 + i * 1.0, 0.9);
    });
    /* Act 3 — pull all the way back for the climb. The release. */
    camTo(1.0, CENTRE, 20.6, 2.6, 'power2.out');
    /* Act 4 — rise to the fleet, then tilt back down as the beams reach. */
    camTo(1.28, focusOffset(50, 30), 27.0, 2.4);
    camTo(1.14, focusOffset(50, 52), 31.0, 2.2);
    /* Act 5 — the big push onto Xyla, and hold her huge. */
    /* A gentler push than the other acts get. She is already enormous in CSS
       terms, and anything past ~1.15 here scales the "3rd BIRTHDAY" clean off
       the top of the frame — layers zoom about the middle, so content near the
       edge travels furthest. */
    camTo(1.15, focusOffset(50, 44), 34.6, 1.8, 'power3.out');
    /* Act 6 — ease back so the invitation has room to land. */
    camTo(1.08, CENTRE, 40.6, 1.8, 'power2.inOut');

    /* ---------------- ACT 0 — the cover ---------------- */
    var title = R.title;
    tl.fromTo(title.querySelectorAll('.kicker'),
      { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.3);
    tl.fromTo(title.querySelectorAll('.title-word'),
      { autoAlpha: 0, y: 70, scale: 0.5, rotate: -8 },
      { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 1.1,
        ease: 'back.out(1.7)', stagger: 0.13 }, 0.5);
    tl.fromTo(title.querySelectorAll('.sub'),
      { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.4);
    /* the facts land almost immediately after the title — this is the beat
       that turns a nice animation into an invitation */
    tl.fromTo(title.querySelectorAll('.cover-facts'),
      { autoAlpha: 0, y: 22, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.5)' }, 1.9);

    /* ---------------- ACT 1 — the Lemon Sea ---------------- */
    tl.to(title, { autoAlpha: 0, y: -50, scale: 0.9, duration: 1.0, ease: 'power2.in' }, 5.4);
    /* the ship sails in and rocks */
    /* Sail in from off the visible left edge to the ship's home position.
       These are absolute viewBox coordinates, not the raw -520 -> 340 that
       used to be here: on a phone `slice` crops the box to roughly x 361..638,
       so the old numbers sailed the ship past the window entirely and it was
       still off-screen when the narration announced it. */
    tl.fromTo(this.ship,
      { x: this.midM.xMin - 240 - 110 * this.shipScale, rotation: -3 },
      { x: this.shipHome, duration: 3.4, ease: 'power1.inOut' }, 5.6);
    /* a real rock on the swell, rather than sliding across like a decal */
    tl.to(this.ship, { rotation: 3.5, duration: 1.35, repeat: 3, yoyo: true,
                       ease: 'sine.inOut', transformOrigin: '100px 90px' }, 5.8);
    /* the crew lifts off the rigging, one after another */
    this.cast.forEach(function (c, i) {
      /* dip before the rise — anticipation is what makes an entrance land */
      tl.to(c.host, { y: 74, duration: 0.16, ease: 'power2.in' }, 7.06 + i * 0.24);
      tl.to(c.host, {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.95, ease: 'back.out(2.2)'
      }, 7.22 + i * 0.24);
    });

    /* ---------------- ACT 2 — the Changing ----------------
       The centrepiece: each crew member morphs into a different hybrid.

       These morph timelines are built now and ADDED to master, rather than
       being created at runtime inside a tl.call(). GSAP suppresses callbacks
       when a timeline is seeked, so the callback version meant the single most
       important moment in the piece was invisible to anyone who dragged the
       scrubber — and invisible to the screenshot harness too. As real tweens
       they scrub both directions like everything else. */
    this.cast.forEach(function (c, i) {
      var at = 14 + i * 0.5;
      var ng = XY.Creature.genome(c.genome.seed + ':m', {});
      tl.add(XY.Creature.morphTo(c, ng), at);
      /* the confetti puff and the camera knock stay callbacks — they are
         impulses, and firing them while scrubbing backwards would be nonsense */
      tl.call(function () {
        self.onMorph && self.onMorph(c);
        XY.shake && XY.shake(6, 0.25);
      }, null, at + 0.2);
      /* a little hop on the beat, which is staging, so it lives on master */
      tl.to(c.host, { y: -26, duration: 0.3, ease: 'power2.out' }, at);
      tl.to(c.host, { y: 0, duration: 0.7, ease: 'bounce.out' }, at + 0.3);

      /* A SECOND wave, on a different rhythm and running the other way down
         the line. One pass read as a single scripted event; two passes read as
         something spreading through the crew, which is the actual story. */
      var at2 = 17.6 + (self.cast.length - 1 - i) * 0.34;
      var ng2 = XY.Creature.genome(c.genome.seed + ':m2', {});
      tl.add(XY.Creature.morphTo(c, ng2, { duration: 0.7 }), at2);
      tl.to(c.host, { y: -18, duration: 0.24, ease: 'power2.out' }, at2);
      tl.to(c.host, { y: 0, duration: 0.6, ease: 'bounce.out' }, at2 + 0.24);
    });

    /* ---------------- ACT 3 — the climb ----------------
       Everything here moves by transform only. Animating `top`/`left` would
       force layout on every frame of a five-second tween. */
    tl.to(this.mid.svg, { y: 300, duration: 5, ease: 'power1.inOut' }, 21);
    tl.to(R.far, { y: 160, duration: 5, ease: 'power1.inOut' }, 21);
    /* the sea and the ship drop out of the world as the crew climbs */
    tl.to(R.mid, { autoAlpha: 0, duration: 2.5, ease: 'power1.in' }, 24);
    this.cast.forEach(function (c, i) {
      tl.to(c.host, { y: -vh * 0.08, duration: 3, ease: 'sine.inOut' }, 21.5 + i * 0.1);
    });

    /* ---------------- ACT 4 — the fleet arrives ----------------
       Each saucer is paired with a crew member and beams THAT ONE, so the
       beams have something to land on. `u.target` is what the aiming pass in
       main.js reads every frame while a beam is lit. */
    this.fleet.forEach(function (u, i) {
      u.target = self.cast[i % self.cast.length] || null;
      tl.to(u.host, {
        autoAlpha: 1, y: 0, scale: 1, duration: 1.5, ease: 'power2.out'
      }, 27 + i * 0.35);
      /* slide over the crew member it is coming for */
      if (u.target) {
        tl.to(u.host, {
          x: (u.target.homeX - u.homeX) / 100 * vw * 0.9,
          duration: 2.0, ease: 'power2.inOut',
        }, 28.2 + i * 0.2);
      }
      tl.add(XY.Ufo.beamOn(u, 0.5), 30 + i * 0.3);
      tl.call(function () { XY.shake && XY.shake(7, 0.35); }, null, 30 + i * 0.3);
      tl.add(XY.Ufo.beamOff(u, 0.4), 33.4 + i * 0.2);
    });
    /* Creatures get caught in the beams and drift upward, and CHANGE while
       they are up there — the morph happens where the eye already is. These
       use absolute values around the climb offset rather than relative ones,
       so that scrubbing backwards lands on exactly the same numbers as
       playing forwards; relative tweens resolve their start value on first
       render and drift when a timeline is seeked. */
    var climbY = -vh * 0.08;
    this.cast.forEach(function (c, i) {
      var lift = 30.4 + i * 0.16;
      tl.to(c.host, { y: climbY - 130, rotation: 14, duration: 1.4, ease: 'sine.inOut' }, lift);
      /* the change, mid-beam */
      var bg = XY.Creature.genome(c.genome.seed + ':beam', {});
      tl.add(XY.Creature.morphTo(c, bg, { duration: 0.7 }), lift + 0.75);
      tl.to(c.host, { y: climbY, rotation: 0, duration: 1.1, ease: 'bounce.out' }, 33 + i * 0.14);
      tl.call(function () { XY.shake && XY.shake(5, 0.22); }, null, 33.9 + i * 0.14);
    });

    /* ---------------- ACT 5 — Captain Xyla ----------------
       She overshoots past full size and settles back, which reads as landing
       with weight rather than simply appearing. */
    tl.fromTo(this.hero.host,
      { autoAlpha: 0, scale: 0.4, y: 90 },
      { autoAlpha: 1, scale: 1.06, y: 0, duration: 1.4, ease: 'back.out(1.6)' }, 34.8);
    tl.to(this.hero.host, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.55)' }, 36.0);
    /* the biggest hit in the piece — her feet touching down */
    tl.call(function () { XY.shake && XY.shake(16, 0.7); }, null, 35.9);
    /* The saucers have done their job — they lift away and dim, which clears
       the top of the frame for the "3rd BIRTHDAY" and reads as them leaving
       rather than simply being drawn over. */
    this.fleet.forEach(function (u, i) {
      tl.to(u.host, { y: -vh * 0.16, autoAlpha: 0.42, duration: 1.6,
                      ease: 'power2.inOut' }, 35.0 + i * 0.12);
    });
    tl.fromTo(R.three,
      { autoAlpha: 0, scale: 0.2, rotate: -25 },
      { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.2, ease: 'back.out(2)' }, 36.2);
    tl.call(function () {
      self.onCheer && self.onCheer();
      XY.shake && XY.shake(11, 0.5);
    }, null, 36.4);
    /* The crew gathers around her — again by transform. Target positions are
       resolved to pixels once, here, from each actor's own home percentage. */
    this.cast.forEach(function (c, i) {
      /* They gather around her in pairs, alternating sides and stepping out.
         Kept high and tight: the camera is pushed in here, so anything below
         about 60% is outside the frame by the time it arrives. */
      var side = i % 2 ? 1 : -1;
      var spread = 17 + Math.floor(i / 2) * 9;
      var targetXpc = 50 + side * spread;
      var targetYpc = 46 + (i % 3) * 5;
      tl.to(c.host, {
        x: (targetXpc - c.homeX) / 100 * vw,
        y: (targetYpc - c.homeY) / 100 * vh,
        scale: 0.7,
        duration: 1.6, ease: 'power2.inOut'
      }, 35.6 + i * 0.08);
    });

    /* ---------------- NARRATION ----------------
       One line per act, set as a tween rather than a callback so that
       scrubbing lands on the right sentence. */
    if (R.narration) {
      /* One span per act, all stacked and individually faded. Swapping the
         text of a single element would need either TextPlugin or a callback,
         and callbacks do not fire while scrubbing — this way every line is a
         plain tween and lands correctly in both directions. */
      ACTS.forEach(function (a, i) {
        if (!a.line) return;
        var span = XY.el('span', { class: 'narration-line' });
        span.textContent = a.line;
        R.narration.appendChild(span);
        gsap.set(span, { autoAlpha: 0 });
        var next = ACTS[i + 1];
        var out = next ? Math.min(next.at - 0.5, a.at + 5.5) : END - 0.6;
        tl.fromTo(span, { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, a.at + 0.4);
        tl.to(span, { autoAlpha: 0, y: -10, duration: 0.5, ease: 'power2.in' }, out);
      });
    }

    /* ---------------- ACT 6 — the invitation ---------------- */
    /* She shrinks only a little — she is still the biggest thing on screen
       when the invitation lands. The `3` moves further to make the room. */
    tl.to(this.hero.host, { y: -30, scale: 0.92, duration: 1.2, ease: 'power2.inOut' }, 40.4);
    tl.to(R.three, { y: -90, scale: 0.7, duration: 1.2, ease: 'power2.inOut' }, 40.4);
    /* the card comes up on the celebration, not after it has died down */
    tl.call(function () { self.onInvite && self.onInvite(); }, null, 38.6);
    tl.to({}, { duration: 1 }, END - 1);   // let it breathe at the end

    this.master = tl;
    return tl;
  };

  Stage.prototype.skyForAct = function () {
    var i = XY.clamp(Math.round(this.actIndex.v), 0, ACTS.length - 1);
    return XY.ACT_SKY[ACTS[i].sky];
  };

  XY.Story = { Stage: Stage, ACTS: ACTS, END: END };

})(window.XY = window.XY || {});
