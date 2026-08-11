/* ============================================================================
 *  ufo.js — the flying saucer fleet
 *  ---------------------------------------------------------------------------
 *  Generated saucers with glassy domes, lit portholes, seeded liveries and
 *  tractor beams that can pick a creature up, change it, and set it back down.
 *
 *  The abduct-and-return cycle is the best toy on the page: a kid taps a UFO,
 *  it beams a creature up, and a different creature comes back down. It is also
 *  the clearest possible demonstration of the morph engine.
 *
 *  Glow is stacked translucent shapes, never an SVG blur filter — blur filters
 *  are the single worst source of jank on phones.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var path = XY.path;
  var uid = 0;

  var HULLS = [
    ['#C9A7F5', '#8E6BD1'], ['#9BE8C8', '#4FC79B'], ['#FFD84D', '#F0A500'],
    ['#FF8FB1', '#E8618A'], ['#A8D8FF', '#6FAEE8'], ['#FFB4A1', '#FF8B6B'],
  ];

  function genome(seed) {
    var rand = XY.rng(seed);
    var hull = rand.pick(HULLS);
    return {
      seed: seed, rand: rand,
      hull: hull[0], hullShade: hull[1],
      dome: rand.pick(['#BDE7F5', '#FFE9A8', '#F7C6E0', '#D9F5E8']),
      portholes: rand.int(5, 8),
      portColor: rand.pick(['#FFD84D', '#FF8FB1', '#9BE8C8', '#FFFFFF']),
      width: rand.range(0.85, 1.2),
      livery: rand.pick(['dots', 'stripe', 'scallop', 'plain']),
      beaconColor: rand.pick(['#FF8FB1', '#FFD84D', '#9BE8C8']),
    };
  }

  /* The drawing box is 0..200 wide, saucer centred at (100, 70). */
  function build(g) {
    var rand = XY.rng(g.seed + 11);
    var w = 78 * g.width;
    var parts = [];

    /* soft glow beneath — three stacked translucent ellipses */
    parts.push({ slot: 'glow', d: path.blob(100, 78, w * 1.25, 26, { points: 14, wobble: 0.03, rand: rand }),
                 fill: g.hull, opacity: 0.14 });

    /* under-hull */
    parts.push({ slot: 'hull', d: path.blob(100, 80, w * 0.82, 20, {
                   points: 14, wobble: 0.02, rand: rand,
                   shape: function (a) { return 1 + 0.18 * Math.sin(a); } }),
                 fill: g.hullShade, stroke: '#2A1B4A', opacity: 1 });

    /* main rim — the wide saucer disc */
    parts.push({ slot: 'rim', d: path.blob(100, 70, w, 17, { points: 14, wobble: 0.015, rand: rand }),
                 fill: g.hull, stroke: '#2A1B4A', opacity: 1 });

    /* glassy dome */
    parts.push({ slot: 'dome', d: path.blob(100, 52, w * 0.44, 26, {
                   points: 14, wobble: 0.02, rand: rand,
                   shape: function (a) { return 1 - 0.28 * Math.max(0, Math.sin(a)); } }),
                 fill: g.dome, stroke: '#2A1B4A', opacity: 1 });

    /* a highlight streak on the dome so it reads as glass, not plastic */
    parts.push({ slot: 'domeGlint', d: path.blob(100 - w * 0.16, 44, w * 0.11, 8,
                   { points: 14, wobble: 0, rotate: -0.5 }),
                 fill: '#FFFFFF', opacity: 0.55 });

    /* livery */
    if (g.livery === 'stripe') {
      parts.push({ slot: 'livery', d: path.roundRect(100, 70, w * 1.7, 5, 1),
                   fill: '#FFF8EE', opacity: 0.75 });
    } else if (g.livery === 'scallop') {
      parts.push({ slot: 'livery',
                   d: path.closedSpline(path.scallop(100 - w, 74, 100 + w, 74, 6, 4, false)
                        .concat([[100 + w, 68], [100, 66], [100 - w, 68]]), 0.7),
                   fill: '#FFF8EE', opacity: 0.6 });
    } else if (g.livery === 'dots') {
      var dots = [];
      for (var i = 0; i < 7; i++) {
        dots.push(path.blob(100 - w * 0.8 + (w * 1.6) * (i / 6), 62, 3.4, 3.4, { points: 14, wobble: 0 }));
      }
      parts.push({ slot: 'livery', d: dots.join(' '), fill: '#FFF8EE', opacity: 0.7 });
    }

    /* portholes, each its own node so they can light in sequence */
    var ports = [];
    for (var p = 0; p < g.portholes; p++) {
      var t = (p + 0.5) / g.portholes;
      var px = 100 + (t - 0.5) * 2 * w * 0.86;
      var py = 76 + Math.sin(t * Math.PI) * 3;
      ports.push({ slot: 'port' + p, d: path.blob(px, py, 5.2, 5.2, { points: 14, wobble: 0 }),
                   fill: g.portColor, stroke: '#2A1B4A', opacity: 1, port: true });
    }
    parts = parts.concat(ports);

    /* beacon on top */
    parts.push({ slot: 'beaconStalk', d: path.roundRect(100, 26, 3, 10, 1),
                 fill: '#2A1B4A', opacity: 1 });
    parts.push({ slot: 'beacon', d: path.blob(100, 21, 7, 7, { points: 14, wobble: 0 }),
                 fill: g.beaconColor, stroke: '#2A1B4A', opacity: 1 });

    return { parts: parts, w: w, portCount: g.portholes };
  }

  function render(g) {
    var built = build(g);
    var id = 'ufo' + (uid++);
    var svg = XY.svgEl('svg', {
      viewBox: '-20 0 240 320', class: 'ufo',
      'aria-hidden': 'true', focusable: 'false', overflow: 'visible'
    });

    /* gradient for the tractor beam — a def, not a filter */
    var defs = XY.svgEl('defs');
    var grad = XY.svgEl('linearGradient', { id: id + '-beam', x1: '0', y1: '0', x2: '0', y2: '1' });
    [['0%', 0.62], ['55%', 0.3], ['100%', 0]].forEach(function (s) {
      grad.appendChild(XY.svgEl('stop', { offset: s[0], 'stop-color': g.portColor, 'stop-opacity': s[1] }));
    });
    defs.appendChild(grad);
    var clip = XY.svgEl('clipPath', { id: id + '-clip' });
    var beamShape = path.closedSpline([
      [100 - built.w * 0.28, 84], [100 + built.w * 0.28, 84],
      [100 + built.w * 0.95, 300], [100 - built.w * 0.95, 300],
    ], 0.25);
    clip.appendChild(XY.svgEl('path', { d: beamShape }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var root = XY.svgEl('g', { class: 'u-root' });

    /* ---- the beam, behind the saucer ---- */
    var beamG = XY.svgEl('g', { class: 'u-beam', opacity: 0 });
    beamG.appendChild(XY.svgEl('path', { d: beamShape, fill: 'url(#' + id + '-beam)' }));
    var chevG = XY.svgEl('g', { 'clip-path': 'url(#' + id + '-clip)' });
    var chevrons = [];
    for (var c = 0; c < 4; c++) {
      var cy = 100 + c * 52;
      var ch = XY.svgEl('path', {
        d: path.closedSpline([
          [100 - built.w * 0.5, cy], [100, cy + 12], [100 + built.w * 0.5, cy],
          [100, cy + 3],
        ], 0.5),
        fill: '#FFFFFF', opacity: 0.4
      });
      chevG.appendChild(ch);
      chevrons.push(ch);
    }
    beamG.appendChild(chevG);
    /* a pool of light where the beam lands */
    var pool = XY.svgEl('path', {
      d: path.blob(100, 296, built.w * 0.95, 14, { points: 14, wobble: 0 }),
      fill: g.portColor, opacity: 0.3
    });
    beamG.appendChild(pool);
    root.appendChild(beamG);

    /* ---- the saucer itself ---- */
    var hullG = XY.svgEl('g', { class: 'u-hull' });
    var nodes = {}, ports = [];
    built.parts.forEach(function (a) {
      var p = XY.svgEl('path', { d: a.d, fill: a.fill, opacity: a.opacity, 'data-slot': a.slot });
      if (a.stroke) {
        p.setAttribute('stroke', a.stroke);
        p.setAttribute('stroke-width', 3);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('paint-order', 'stroke');
      }
      nodes[a.slot] = p;
      if (a.port) ports.push(p);
      hullG.appendChild(p);
    });
    root.appendChild(hullG);
    svg.appendChild(root);

    return {
      genome: g, svg: svg, root: root, hull: hullG, beam: beamG,
      nodes: nodes, ports: ports, chevrons: chevrons, width: built.w,
    };
  }

  /* Ambient life: a slow tilt and a lazy bob, on deliberately non-matching
     periods so the fleet never falls into lockstep and looks mechanical. */
  function animate(u) {
    var rand = XY.rng(u.genome.seed + 5);
    gsap.to(u.hull, { rotation: rand.range(3.5, 6), duration: rand.range(2.4, 3.4),
      repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '100px 70px' });
    gsap.to(u.root, { y: rand.range(5, 9), duration: rand.range(1.7, 2.5),
      repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to(u.nodes.beacon, { scale: 1.3, opacity: 0.7, duration: rand.range(1.0, 1.5),
      repeat: -1, yoyo: true, ease: 'sine.inOut', transformOrigin: '50% 50%' });
    /* portholes light in sequence, slowly — a chase, not a flash */
    gsap.to(u.ports, { opacity: 0.45, duration: 0.9, repeat: -1, yoyo: true,
      ease: 'sine.inOut', stagger: { each: 0.16, repeat: -1, yoyo: true } });
    /* chevrons drift down the beam forever; the beam group's opacity gates it */
    gsap.fromTo(u.chevrons, { y: -46 }, { y: 46, duration: 1.6, repeat: -1,
      ease: 'none', stagger: 0.4 });
  }

  function beamOn(u, dur) {
    return gsap.timeline()
      .set(u.beam, { transformOrigin: '100px 84px' })
      .fromTo(u.beam, { opacity: 0, scaleY: 0.05, scaleX: 0.5 },
        { opacity: 1, scaleY: 1, scaleX: 1, duration: dur || 0.45, ease: 'back.out(1.6)' });
  }

  function beamOff(u, dur) {
    return gsap.to(u.beam, { opacity: 0, scaleY: 0.05, duration: dur || 0.35,
      ease: 'power2.in', transformOrigin: '100px 84px' });
  }

  XY.Ufo = { genome: genome, render: render, animate: animate, beamOn: beamOn, beamOff: beamOff };

})(window.XY = window.XY || {});
