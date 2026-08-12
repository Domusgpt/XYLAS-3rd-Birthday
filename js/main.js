/* ============================================================================
 *  main.js — boot and wiring
 *  ---------------------------------------------------------------------------
 *  One rAF for the whole application. Everything — the shader, parallax,
 *  confetti, the audio analyser — rides a single gsap.ticker callback. There is
 *  no other animation loop anywhere in this project.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var C = XY.CONFIG;
  var P = XY.params;

  /* ======================================================================
   *  Quality tier
   * ==================================================================== */
  function detectQuality() {
    if (P.q) return P.q;
    if (C.FLAGS.forceQuality) return C.FLAGS.forceQuality;
    var score = 0;
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
    score += mem >= 8 ? 2 : mem >= 4 ? 1 : 0;
    if (window.matchMedia('(pointer: coarse)').matches) score -= 1;
    if (Math.min(window.innerWidth, window.innerHeight) < 420) score -= 1;
    return score >= 3 ? 'high' : score >= 1 ? 'med' : 'low';
  }

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ======================================================================
   *  Boot
   * ==================================================================== */
  function boot() {
    gsap.registerPlugin(MorphSVGPlugin);

    /* Under the headless screenshot harness the virtual clock jumps in huge
       steps, which trips GSAP's lag smoothing and leaves delayed tweens
       half-finished in the captured frame. Real visitors keep lag smoothing —
       it is what stops a backgrounded tab from lurching on return. */
    if (P.auto === '1' || P.seek !== undefined) gsap.ticker.lagSmoothing(0);

    var quality = detectQuality();
    var reduced = prefersReduced || P.calm === '1';

    var R = {
      stage:  document.getElementById('stage'),
      sky:    document.getElementById('sky-canvas'),
      stars:  document.getElementById('l-stars'),
      far:    document.getElementById('l-far'),
      mid:    document.getElementById('l-mid'),
      fleet:  document.getElementById('l-fleet'),
      cast:   document.getElementById('l-cast'),
      fore:   document.getElementById('fore-canvas'),
      title:  document.getElementById('storytitle'),
      three:  document.getElementById('bigthree'),
      sheet:  document.getElementById('sheet'),
      card:   document.getElementById('invite-card'),
      rsvp:   document.getElementById('rsvp-panel'),
      gate:   document.getElementById('gate'),
      controls: document.getElementById('controls'),
      chapters: document.getElementById('chapters'),
      scrub:  document.getElementById('scrubber'),
      narration: document.getElementById('narration'),
    };

    /* ---- the invitation itself, rendered first so it always exists ---- */
    XY.Invite.renderInvite(R.card);
    XY.Invite.renderForm(R.rsvp);

    /* ---- say what this is, immediately ----
       Both of these read CONFIG.PARTY, so the date on the cover and the date
       on the card cannot drift apart. Someone who opens the link and never
       presses play still learns whose birthday it is and when. */
    XY.Invite.renderCoverFacts(
      document.getElementById('cover-facts'),
      document.getElementById('brand-when'),
      document.getElementById('gate-when'));

    /* ---- sky ---- */
    var sky = new XY.Sky(R.sky, quality);
    if (!sky.ok) {
      R.sky.style.display = 'none';
      document.getElementById('l-sky').style.background =
        XY.skyFallbackCSS(XY.ACT_SKY.cover);
    }

    /* ---- confetti ---- */
    var confetti = new XY.Confetti(R.fore, reduced ? 0 : quality === 'low' ? 0 : quality === 'med' ? 80 : 160);

    /* ---- parallax ---- */
    var parallax = new XY.Parallax({ amp: window.innerWidth < 620 ? 26 : 44 });
    parallax.bind(R.stage);
    parallax.add(R.stars, 0.06);
    parallax.add(R.far, 0.14);
    parallax.add(R.mid, 0.3);
    parallax.add(R.fleet, 0.5);
    parallax.add(R.cast, 0.74);
    parallax.add(document.getElementById('l-fore'), 0.95);

    /* One place anything in the piece can knock the camera. Suppressed
       wholesale in calm mode, so a reduced-motion visitor never gets hit. */
    XY.shake = function (amp, dur) {
      if (reduced) return;
      parallax.shake(amp, dur);
    };

    /* ---- audio ---- */
    var audio = new XY.Audio();

    /* ---- the stage and story ---- */
    var stage = new XY.Story.Stage(R, { quality: quality }).build();
    stage.reduced = reduced;
    stage.onMorph = function (c) {
      if (reduced) return;
      var r = c.host.getBoundingClientRect();
      confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 14, { power: 0.8 });
    };
    stage.onCheer = function () {
      if (reduced) return;
      confetti.burst(window.innerWidth / 2, window.innerHeight * 0.45, 70, { power: 1.5 });
    };
    stage.onInvite = function () { openSheet('card'); };

    var master = stage.timeline();
    XY.master = master;

    /* ======================================================================
     *  The sheet (invitation card + RSVP)
     * ==================================================================== */
    var lastFocus = null;
    function openSheet(which) {
      lastFocus = document.activeElement;
      R.sheet.classList.add('is-open');
      R.sheet.setAttribute('aria-hidden', 'false');
      gsap.fromTo(R.sheet, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(R.sheet.querySelectorAll('.card'),
        { y: 34, scale: 0.94, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.4)', stagger: 0.08 });
      if (!reduced) {
        gsap.fromTo(R.card.querySelectorAll('.details .row'),
          { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, delay: 0.2 });
      }
      R.rsvp.hidden = which !== 'rsvp';
      var focusTarget = which === 'rsvp'
        ? R.rsvp.querySelector('#rsvp-name')
        : R.card.querySelector('.btn-primary');
      if (focusTarget) setTimeout(function () { focusTarget.focus(); }, 120);
    }

    function closeSheet() {
      R.sheet.classList.remove('is-open');
      R.sheet.setAttribute('aria-hidden', 'true');
      if (lastFocus) lastFocus.focus();
    }

    document.getElementById('open-details').addEventListener('click', function () { openSheet('card'); });
    document.getElementById('sheet-close').addEventListener('click', closeSheet);
    R.sheet.addEventListener('click', function (e) { if (e.target === R.sheet) closeSheet(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && R.sheet.classList.contains('is-open')) closeSheet();
    });

    /* card actions */
    R.card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var status = R.card.querySelector('.status');
      if (b.dataset.act === 'rsvp') {
        R.rsvp.hidden = false;
        R.rsvp.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        R.rsvp.querySelector('#rsvp-name').focus();
      } else if (b.dataset.act === 'copy') {
        var addr = [C.PARTY.venue, C.PARTY.address].filter(Boolean).join(', ');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(addr).then(function () {
            status.textContent = 'Address copied.';
          }, function () { status.textContent = addr; });
        } else { status.textContent = addr; }
      } else if (b.dataset.act === 'ics') {
        XY.Invite.downloadICS();
        status.textContent = 'Calendar file downloaded.';
      }
    });

    /* ---- RSVP submit ---- */
    var form = R.rsvp.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errs = XY.Invite.validate(form);
      XY.Invite.showErrors(form, errs);
      if (Object.keys(errs).length) {
        form.querySelector('[aria-invalid="true"]').focus();
        return;
      }
      var out = form.querySelector('.rsvp-status');
      out.textContent = 'Sending…';
      var data = {
        name: form.name.value.trim(),
        kids: form.kids.value.trim() || '0',
        adults: form.adults.value.trim() || '0',
        note: form.note.value.trim(),
      };
      XY.Invite.submit(form,
        function () { celebrate(data, false); },
        function () { celebrate(data, true); });
    });

    function celebrate(data, viaMail) {
      if (!reduced) {
        confetti.burst(window.innerWidth / 2, window.innerHeight * 0.6, 120, { power: 1.7 });
        stage.cast.forEach(function (c, i) {
          gsap.delayedCall(i * 0.06, function () { XY.Creature.react(c); });
        });
      }
      var mail = XY.Invite.mailtoURL(data);
      R.rsvp.innerHTML =
        '<div class="thanks">' +
          '<h2>See you there, ' + XY.esc(data.name.split(/\s+/)[0]) + '!</h2>' +
          (viaMail
            ? '<p>Your email app should be opening with the RSVP ready to send. ' +
              'Please press send — it is not on its way until you do.</p>' +
              '<p class="mailto-fallback">Nothing happened? Email ' +
              '<a href="' + mail + '">' + XY.esc(C.RSVP.to) + '</a> and we will sort it out.</p>'
            : '<p>Your RSVP is on its way to ' + XY.esc(C.RSVP.toName) + '. Thank you!</p>') +
        '</div>';
      if (C.PARTY.startISO) {
        var b = XY.el('button', { class: 'btn btn-ghost' }, 'Add to calendar');
        b.addEventListener('click', function () { XY.Invite.downloadICS(); });
        R.rsvp.querySelector('.thanks').appendChild(b);
      }
    }

    /* ======================================================================
     *  Controls
     * ==================================================================== */
    var dots = [];
    XY.Story.ACTS.forEach(function (a, i) {
      var d = XY.el('button', {
        class: 'chapter-dot', type: 'button',
        'aria-label': 'Chapter ' + (i + 1) + ': ' + a.label,
      });
      d.addEventListener('click', function () {
        if (reduced) { master.progress(a.at / XY.Story.END); return; }
        master.tweenTo(a.key, { duration: 0.7, ease: 'power2.inOut' });
      });
      R.chapters.appendChild(d);
      dots.push(d);
    });

    var scrubbing = false;
    R.scrub.addEventListener('pointerdown', function () { scrubbing = true; master.pause(); });
    R.scrub.addEventListener('input', function () {
      master.progress(+R.scrub.value / 1000);
    });
    var endScrub = function () {
      if (!scrubbing) return;
      scrubbing = false;
      if (!reduced && master.progress() < 0.999) master.play();
    };
    R.scrub.addEventListener('pointerup', endScrub);
    R.scrub.addEventListener('pointercancel', endScrub);

    var playBtn = document.getElementById('btn-play');
    playBtn.addEventListener('click', function () {
      if (master.paused() || master.progress() >= 0.999) {
        if (master.progress() >= 0.999) master.restart();
        else master.play();
      } else master.pause();
      syncPlay();
    });
    function syncPlay() {
      var playing = !master.paused() && master.progress() < 0.999;
      playBtn.textContent = playing ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', playing ? 'Pause the story' : 'Play the story');
    }

    var muteBtn = document.getElementById('btn-mute');
    if (!C.FLAGS.audioButton) muteBtn.hidden = true;
    /* The button has to be able to show a state it did not itself cause —
       the music now starts on its own at the gate — so the label lives in one
       function that both paths call. */
    function syncMute() {
      muteBtn.setAttribute('aria-pressed', String(audio.on));
      muteBtn.textContent = audio.on ? '♪' : '♪̸';
      muteBtn.setAttribute('aria-label', audio.on ? 'Turn music off' : 'Turn music on');
    }
    muteBtn.addEventListener('click', function () {
      if (!audio.ready && !audio.init()) return;
      audio.setOn(!audio.on);
      syncMute();
    });

    var calmBtn = document.getElementById('btn-calm');
    calmBtn.addEventListener('click', function () {
      reduced = !reduced;
      calmBtn.setAttribute('aria-pressed', String(reduced));
      if (reduced) {
        master.pause(); master.progress(1); confetti.clear();
        /* calm means calm — the music goes too, not just the motion */
        if (audio.on) { audio.setOn(false); syncMute(); }
      } else master.restart();
      syncPlay();
    });

    /* ---- tap a creature ---- */
    R.cast.addEventListener('click', function (e) {
      var host = e.target.closest('.actor');
      if (!host) return;
      var c = stage.cast.filter(function (x) { return x.host === host; })[0];
      if (!c) return;
      XY.Creature.react(c);
      audio.blip(c.note);
      XY.shake(4, 0.18);
      if (!reduced) {
        var r = host.getBoundingClientRect();
        confetti.burst(r.left + r.width / 2, r.top + r.height * 0.3, 10, { power: 0.7 });
      }
    });

    /* ---- tap a UFO: abduct the nearest crew member and bring back a
            different one. The best toy on the page, and the clearest possible
            demonstration of the morph engine. ---- */
    R.fleet.addEventListener('click', function (e) {
      var host = e.target.closest('.actor');
      if (!host) return;
      var u = stage.fleet.filter(function (x) { return x.host === host; })[0];
      if (!u || u.busy) return;
      abduct(u);
    });

    var abductN = 0;
    function abduct(u) {
      u.busy = true;
      var ur = u.host.getBoundingClientRect();
      var ux = ur.left + ur.width / 2;
      /* nearest crew member horizontally */
      var best = null, bestD = Infinity;
      stage.cast.forEach(function (c) {
        var r = c.host.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - ux);
        if (d < bestD) { bestD = d; best = c; }
      });
      if (!best) { u.busy = false; return; }

      /* what this saucer's beam should track for the duration of the grab */
      var prevTarget = u.target;
      u.target = best;

      var tl = gsap.timeline({
        onComplete: function () { u.busy = false; u.target = prevTarget; },
      });
      tl.add(XY.Ufo.beamOn(u, 0.4));
      tl.call(function () { XY.shake(8, 0.4); }, null, 0.1);
      tl.to(best.host, { y: -window.innerHeight * 0.28, rotation: 360, scale: 0.55,
                         duration: 1.1, ease: 'power1.inOut' }, 0.25);
      tl.call(function () {
        var ng = XY.Creature.genome(best.genome.seed + ':a' + (++abductN));
        XY.Creature.morphTo(best, ng);
      }, null, 1.15);
      tl.to(best.host, { y: 0, rotation: 0, scale: 1, duration: 1.0, ease: 'bounce.out' }, 1.7);
      tl.add(XY.Ufo.beamOff(u, 0.35), 2.5);
      tl.call(function () {
        if (reduced) return;
        var r = best.host.getBoundingClientRect();
        confetti.burst(r.left + r.width / 2, r.top + r.height / 2, 22, { power: 1 });
      }, null, 2.6);
    }

    /* ======================================================================
     *  The single ticker
     * ==================================================================== */
    var dofOK = quality === 'high' && !reduced;
    var dofOn = false;
    var aimPairs = [];              // reused every frame, never reallocated
    var last = performance.now() / 1000;
    gsap.ticker.add(function () {
      var now = performance.now() / 1000;
      var dt = Math.min(0.05, now - last);
      last = now;

      /* The camera. The story tweens stage.cam on the master timeline; the
         rig just reads it here, so a camera move is as scrubbable as any
         other tween. Calm mode holds the camera wide and still. */
      if (reduced) {
        parallax.zoom = 1; parallax.fx = 0; parallax.fy = 0;
      } else {
        parallax.zoom = stage.cam.zoom;
        parallax.fx = stage.cam.fx;
        parallax.fy = stage.cam.fy;
      }
      parallax.update(dt);

      /* Depth of field, toggled by class rather than tweened — see style.css.
         Only the top quality tier pays for it, and only while the camera is
         actually pushed in on the cast. */
      if (dofOK) {
        var wantDof = parallax.zoom > 1.22;
        if (wantDof !== dofOn) {
          dofOn = wantDof;
          R.far.classList.toggle('is-defocused', wantDof);
          R.mid.classList.toggle('is-defocused', wantDof);
        }
      }

      /* Aim every lit tractor beam at whatever it is currently catching.
         Only lit beams are measured, so this costs nothing outside Act 4 and
         an abduction. Nothing else can keep a beam attached: the saucers and
         the crew are in different layers, which pan AND scale by different
         amounts, so no fixed geometry stays true. */
      aimPairs.length = 0;
      for (var fi = 0; fi < stage.fleet.length; fi++) {
        var U = stage.fleet[fi];
        if (!U.target) continue;
        if (gsap.getProperty(U.beamFx, 'opacity') > 0.01) {
          aimPairs.push({ u: U, el: U.target.host });
        }
      }
      if (aimPairs.length) XY.Ufo.aimAll(aimPairs);

      var bands = audio.sample(dt);
      if (sky.ok) {
        sky.progress = master.progress();
        sky.portal = XY.clamp((master.progress() - 0.62) / 0.2, 0, 1);
        sky.pointer[0] = parallax.px;
        sky.pointer[1] = -parallax.py;
        sky.audio = bands;
        sky.setPalette(stage.skyForAct());
        sky.render(now, dt);
      }
      confetti.update(dt);

      /* chapter + scrubber sync, cheap enough to do every frame */
      var prog = master.progress();
      if (!scrubbing) R.scrub.value = String(Math.round(prog * 1000));
      var ai = XY.clamp(Math.round(stage.actIndex.v), 0, dots.length - 1);
      if (ai !== lastAct) {
        lastAct = ai;
        dots.forEach(function (d, i) { d.setAttribute('aria-current', String(i === ai)); });
      }
    });
    var lastAct = -1;

    /* ---- resize ---- */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        sky.resize();
        confetti.resize();
        parallax.amp = window.innerWidth < 620 ? 26 : 44;
      }, 150);
    });

    /* ---- background tabs cost nothing ---- */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { gsap.ticker.sleep(); audio.stop(); }
      else { gsap.ticker.wake(); if (audio.on) audio.start(); }
    });

    /* ======================================================================
     *  Reduced motion: same content, no show
     * ==================================================================== */
    if (reduced) {
      R.gate.hidden = true;
      master.progress(1).pause();
      openSheet('card');
      document.getElementById('btn-calm').setAttribute('aria-pressed', 'true');
    }

    /* ======================================================================
     *  The gate. One tap unlocks audio and device tilt, which browsers only
     *  permit from inside a real gesture.
     * ==================================================================== */
    function begin() {
      R.gate.hidden = true;
      if (C.FLAGS.tiltEnabled) parallax.enableTilt();

      /* Music starts here, not on the ♪ button.
       *
       * This tap is the only guaranteed user gesture the page ever gets, and
       * a WebAudio context created outside one is born suspended on every
       * mobile browser — so "autoplay from the start" has to mean "from the
       * moment they open it". `init()` returns false where WebAudio is
       * missing, in which case the music simply never starts and the button
       * still says so. Calm mode never gets sound. */
      if (!reduced && C.FLAGS.musicAutoplay !== false && audio.init()) {
        audio.setOn(true);
        syncMute();
      }

      if (!reduced && C.FLAGS.autoplay !== false) master.play();
      syncPlay();
    }
    document.getElementById('btn-open').addEventListener('click', begin);

    /* ---- verification / debug hooks ---- */
    if (P.auto === '1' || P.seek !== undefined) {
      R.gate.hidden = true;
      if (P.seek !== undefined) {
        master.pause(parseFloat(P.seek) || 0);
        if (parseFloat(P.seek) >= 38.6) openSheet('card');
      } else if (!reduced) master.play();
      syncPlay();
    }

    XY.debug = {
      master: master, stage: stage, sky: sky, confetti: confetti, audio: audio,
      seek: function (t) { master.pause(t); },
      seekLabel: function (k) { master.pause(master.labels[k] || 0); },
      openSheet: openSheet,
      quality: quality,
    };
    document.documentElement.setAttribute('data-ready', '1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window.XY = window.XY || {});
