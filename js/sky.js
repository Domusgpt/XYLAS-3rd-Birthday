/* ============================================================================
 *  sky.js — the candy-sky visualizer
 *  ---------------------------------------------------------------------------
 *  One fullscreen WebGL triangle running a soft, high-value fragment shader:
 *  a vertical pastel gradient, domain-warped cotton-cloud bands, a portal bloom
 *  that opens as the story advances, a twinkling star field, and a wide gentle
 *  rainbow arc.
 *
 *  Two hard rules, both non-negotiable for a page a small child will look at:
 *    - Nothing in here oscillates in brightness faster than ~1Hz. No strobing,
 *      ever. (Photosensitivity.)
 *    - If WebGL is missing or the device is weak, a CSS gradient takes over and
 *      the page carries on. The invitation must never depend on a GPU.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform float uProgress;',   // 0..1 story progress
    'uniform float uPortal;',     // 0..1 how open the portal is
    'uniform vec3  uPalA;',       // top
    'uniform vec3  uPalB;',       // middle
    'uniform vec3  uPalC;',       // bottom
    'uniform vec2  uPointer;',
    'uniform vec3  uAudio;',      // bass, mid, high — all gentle
    'uniform float uOctaves;',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',

    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
    '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
    '}',

    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++){',
    '    if (float(i) >= uOctaves) break;',
    '    v += a * noise(p);',
    '    p *= 2.02; a *= 0.5;',
    '  }',
    '  return v;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes.xy) / min(uRes.x, uRes.y);',
    '  float t = uTime * 0.045;',

    /* base vertical gradient, three stops */
    '  vec3 col = mix(uPalC, uPalB, smoothstep(0.0, 0.55, uv.y));',
    '  col = mix(col, uPalA, smoothstep(0.45, 1.0, uv.y));',

    /* domain-warped cloud bands — soft, wide, slow */
    '  vec2 q = vec2(fbm(p * 1.6 + vec2(t, 0.0)), fbm(p * 1.6 + vec2(5.2, -t)));',
    '  float warp = 0.55 + 0.25 * uAudio.x;',
    '  float clouds = fbm(p * 2.1 + q * warp + vec2(0.0, t * 0.6));',
    '  col = mix(col, mix(col, vec3(1.0), 0.55), smoothstep(0.42, 0.95, clouds) * 0.5);',

    /* a soft candy band that drifts with the pointer, so the sky feels alive
       under a finger without anything jumping */
    '  float band = smoothstep(0.35, 0.0, abs(p.y - 0.06 * sin(p.x * 2.0 + t * 3.0) - uPointer.y * 0.06));',
    '  col += band * 0.05 * vec3(1.0, 0.85, 0.95);',

    /* portal bloom — opens at the reveal */
    '  float d = length(p - vec2(uPointer.x * 0.05, 0.02));',
    '  float ring = smoothstep(0.62 * uPortal + 0.02, 0.0, d);',
    '  col = mix(col, vec3(1.0, 0.97, 0.88), ring * 0.55 * uPortal);',
    '  float halo = smoothstep(0.9 * uPortal, 0.25 * uPortal, d) - smoothstep(0.55 * uPortal, 0.1, d);',
    '  col += max(halo, 0.0) * 0.18 * vec3(1.0, 0.8, 0.95) * uPortal;',

    /* a wide, very gentle rainbow arc. Hue drifts slowly; it never strobes. */
    '  float arc = smoothstep(0.03, 0.0, abs(length(p - vec2(0.0, -0.75)) - 0.85));',
    '  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + p.x * 0.6 + t * 0.4));',
    '  col = mix(col, rainbow, arc * 0.22 * smoothstep(0.15, 0.6, uProgress));',

    /* twinkling stars — only in the darker upper half, only when the story
       has climbed into space */
    '  vec2 gid = floor(gl_FragCoord.xy / 9.0);',
    '  float star = hash(gid);',
    '  float tw = 0.5 + 0.5 * sin(uTime * 1.1 + star * 40.0);',
    '  float starMask = step(0.9965, star) * smoothstep(0.35, 0.95, uv.y);',
    '  col += starMask * tw * (0.55 + 0.35 * uAudio.z) * vec3(1.0, 0.98, 0.9);',

    /* vignette + dither (kills banding on phone panels) */
    '  col *= 1.0 - 0.22 * pow(length(p * vec2(0.75, 1.0)), 2.2);',
    '  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.006;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function hexToVec(hex) {
    var m = String(hex).replace('#', '');
    var n = parseInt(m, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function Sky(canvas, quality) {
    this.canvas = canvas;
    this.ok = false;
    this.progress = 0;
    this.portal = 0;
    this.pointer = [0, 0];
    this.audio = [0, 0, 0];
    this.pal = [hexToVec('#FFE9A8'), hexToVec('#FFD1DC'), hexToVec('#7EC8E3')];
    this.palTarget = this.pal.map(function (c) { return c.slice(); });
    this.scale = quality === 'low' ? 0.5 : quality === 'med' ? 0.75 : 1;
    this.octaves = quality === 'low' ? 2.0 : quality === 'med' ? 3.0 : 5.0;

    if (XY.params.nogl === '1') return;
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false,
                                        powerPreference: 'low-power' })
        || canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('link:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    /* one oversized triangle covers the screen with no seam */
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl; this.prog = prog;
    this.u = {};
    ['uRes', 'uTime', 'uProgress', 'uPortal', 'uPalA', 'uPalB', 'uPalC',
     'uPointer', 'uAudio', 'uOctaves'].forEach(function (n) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }, this);
    gl.uniform1f(this.u.uOctaves, this.octaves);
    this.ok = true;
    this.resize();
  }

  Sky.prototype.resize = function () {
    if (!this.ok) return;
    var dpr = Math.min(window.devicePixelRatio || 1, this.scale >= 1 ? 2 : 1.5) * this.scale;
    var w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  };

  /* Change the sky for an act. The colours ease rather than cut. */
  Sky.prototype.setPalette = function (arr) {
    this.palTarget = arr.map(hexToVec);
  };

  Sky.prototype.render = function (time, dt) {
    if (!this.ok) return;
    var gl = this.gl;
    /* ease the palette so act changes feel like weather, not like a cut */
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        this.pal[i][j] = XY.damp(this.pal[i][j], this.palTarget[i][j], 2.2, dt);
      }
    }
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uProgress, this.progress);
    gl.uniform1f(this.u.uPortal, this.portal);
    gl.uniform3fv(this.u.uPalA, this.pal[0]);
    gl.uniform3fv(this.u.uPalB, this.pal[1]);
    gl.uniform3fv(this.u.uPalC, this.pal[2]);
    gl.uniform2f(this.u.uPointer, this.pointer[0], this.pointer[1]);
    gl.uniform3f(this.u.uAudio, this.audio[0], this.audio[1], this.audio[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  XY.Sky = Sky;
  XY.skyFallbackCSS = function (pal) {
    return 'linear-gradient(180deg, ' + pal[0] + ' 0%, ' + pal[1] + ' 55%, ' + pal[2] + ' 100%)';
  };

})(window.XY = window.XY || {});
