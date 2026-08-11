/* ============================================================================
 *  audio.js — a music box, generated
 *  ---------------------------------------------------------------------------
 *  No audio files. Every note is synthesised: a triangle plus a sine an octave
 *  up, through a fast decay envelope and a lowpass, into a gentle delay. That
 *  combination is the classic music-box/celesta timbre.
 *
 *  The tune is an ORIGINAL 8-bar loop in C major pentatonic. Pentatonic is a
 *  deliberate choice: every note a child triggers by poking a creature is
 *  guaranteed to be consonant with whatever the bed is playing, so the page can
 *  never make an ugly sound. It is deliberately not "Happy Birthday To You",
 *  which is somebody else's song.
 *
 *  Audio starts OFF and the context is only created inside a real user gesture,
 *  which is both polite and required by mobile browsers.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  /* C major pentatonic across two octaves; index 0 = C4 */
  var SCALE = [261.63, 293.66, 329.63, 392.00, 440.00,
               523.25, 587.33, 659.25, 783.99, 880.00];

  /* An original melody, written as scale degrees. -1 is a rest.
     8 bars of 8 eighth-notes. Lilting, simple, a bit pleased with itself. */
  var MELODY = [
    5, -1, 4, 5, 7, -1, 5, -1,
    4, -1, 3, 4, 5, -1, 3, -1,
    2, 3, 4, -1, 5, 4, 3, -1,
    0, 2, 4, 5, 4, -1, 2, -1,
    5, -1, 7, 8, 9, -1, 8, -1,
    7, -1, 5, 7, 8, -1, 5, -1,
    4, 5, 7, -1, 8, 7, 5, -1,
    4, 2, 4, 5, 3, -1, 0, -1,
  ];
  /* A slow bass pulse underneath, one note per bar. */
  var BASS = [0, 3, 1, 4, 0, 3, 2, 0];

  function Audio(opts) {
    opts = opts || {};
    this.ctx = null;
    this.on = false;
    this.ready = false;
    this.bpm = 108;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.bands = [0, 0, 0];
    this.onNote = opts.onNote || null;
  }

  /* Must be called from a user gesture. */
  Audio.prototype.init = function () {
    if (this.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }

    var ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;              // silent until unmuted
    this.master.connect(ctx.destination);

    /* a soft shelf so nothing is harsh on phone speakers */
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 4200;
    this.tone.connect(this.master);

    /* a short feedback delay gives the music box its room */
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.28;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.26;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.34;
    this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.tone);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.master.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    this.ready = true;
    return true;
  };

  Audio.prototype.voice = function (freq, time, dur, gain, bright) {
    var ctx = this.ctx;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    var o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(freq, time);

    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * 2, time);
    var g2 = ctx.createGain();
    g2.gain.value = (bright === undefined ? 0.35 : bright);
    o2.connect(g2); g2.connect(g);

    o1.connect(g);
    g.connect(this.tone);
    g.connect(this.delay);

    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.05); o2.stop(time + dur + 0.05);
  };

  Audio.prototype.shaker = function (time, gain) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * 0.05);
    if (!this._noise) {
      this._noise = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = this._noise.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ctx.createBufferSource();
    src.buffer = this._noise;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    var g = ctx.createGain();
    g.gain.value = gain;
    src.connect(hp); hp.connect(g); g.connect(this.tone);
    src.start(time);
  };

  /* Classic lookahead scheduler. Never schedule audio from rAF. */
  Audio.prototype.start = function () {
    if (!this.ready || this.timer) return;
    var self = this;
    var spb = 60 / this.bpm / 2;     // an eighth note
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(function () {
      if (!self.ctx) return;
      while (self.nextTime < self.ctx.currentTime + 0.12) {
        var i = self.step % MELODY.length;
        var deg = MELODY[i];
        if (deg >= 0) {
          self.voice(SCALE[deg], self.nextTime, 1.15, 0.16);
          if (self.onNote) self.onNote(deg);
        }
        if (i % 8 === 0) {
          self.voice(SCALE[BASS[(i / 8) % BASS.length]] / 2, self.nextTime, 1.6, 0.11, 0.12);
        }
        if (i % 4 === 2) self.shaker(self.nextTime, 0.045);
        self.nextTime += spb;
        self.step++;
      }
    }, 25);
  };

  Audio.prototype.stop = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  };

  Audio.prototype.setOn = function (on) {
    if (!this.ready) return;
    this.on = on;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    gsap.to(this.master.gain, { value: on ? 0.5 : 0, duration: 0.5, ease: 'sine.inOut' });
    if (on) this.start();
  };

  /* A single friendly blip — used when a kid taps a creature. Always a note
     from the scale, so it can never clash with the music. */
  Audio.prototype.blip = function (degree) {
    if (!this.ready || !this.on) return;
    var t = this.ctx.currentTime + 0.01;
    this.voice(SCALE[degree % SCALE.length], t, 0.8, 0.22, 0.5);
  };

  /* Three smoothed bands for the visualizer. */
  Audio.prototype.sample = function (dt) {
    if (!this.ready || !this.on) {
      this.bands[0] = XY.damp(this.bands[0], 0, 3, dt);
      this.bands[1] = XY.damp(this.bands[1], 0, 3, dt);
      this.bands[2] = XY.damp(this.bands[2], 0, 3, dt);
      return this.bands;
    }
    this.analyser.getByteFrequencyData(this.freq);
    var n = this.freq.length, i, sum;
    var edges = [[0, n * 0.12], [n * 0.12, n * 0.45], [n * 0.45, n]];
    for (var b = 0; b < 3; b++) {
      sum = 0;
      var lo = Math.floor(edges[b][0]), hi = Math.floor(edges[b][1]);
      for (i = lo; i < hi; i++) sum += this.freq[i];
      var v = (sum / Math.max(1, hi - lo)) / 255;
      this.bands[b] = XY.damp(this.bands[b], v, 6, dt);
    }
    return this.bands;
  };

  XY.Audio = Audio;
  XY.SCALE_LEN = SCALE.length;

})(window.XY = window.XY || {});
