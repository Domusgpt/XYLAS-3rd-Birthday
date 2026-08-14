#!/usr/bin/env node
/* ============================================================================
 *  process-photos.mjs — turn snapshots into page-ready cutouts
 *  ---------------------------------------------------------------------------
 *  Takes the raw phone photos in the repo root and produces the two assets the
 *  invitation uses:
 *
 *      assets/xyla-hero.webp       her, cut out, for the reveal (wings drawn
 *                                  around her at runtime)
 *      assets/xyla-medallion.webp  a square portrait for the invitation card
 *
 *  HOW IT WORKS, and why it is built this way:
 *
 *  The background is removed by a real segmentation model (BRIA RMBG-1.4)
 *  running through Transformers.js — but it runs **entirely on this machine**,
 *  inside headless Chromium, served over localhost. The photographs are never
 *  uploaded anywhere. That matters: these are pictures of somebody's small
 *  child. Only the model weights come off the network, and only once.
 *
 *  Chromium does the image decoding, cropping, scaling and WebP encoding via
 *  <canvas>, which is why this needs no ImageMagick, no Python and no native
 *  image library — none of which are guaranteed to exist.
 *
 *  This is a one-time authoring tool. The outputs are committed, so nobody
 *  needs to run it again unless the photos change.
 *
 *  Usage:
 *      node tools/process-photos.mjs
 *
 *  It will npm-install Transformers.js into a scratch directory and download
 *  ~176MB of model weights on first run. Neither ends up in this repository —
 *  the site itself still has zero runtime dependencies.
 * ==========================================================================*/
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import http from 'node:http';

const ROOT = resolve('.');
const WORK = process.env.XY_WORK || '/tmp/xy-photos';
/* Where the source photographs live. Defaults to the repo root, where the
   first two originals sit — but a source can live anywhere, which is how the
   lemon-swimsuit hero is processed without adding a third full-resolution
   photograph of a small child to a public repository. Only the cutout ships. */
const SRC = process.env.XY_PHOTOS || join(ROOT, 'photos-src');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MODEL = 'briaai/RMBG-1.4';
const PORT = 8791;
const CDP = 9921;

/* Which photo becomes what. Crops were chosen by eye against the cutouts:
   the medallion is cropped tight enough to lose the beach towel she is
   holding, which the segmentation model quite reasonably keeps. */
const JOBS = [
  /* The hero. Replaced at grandma's request: the previous photo's shirt was
     stained, and this one has her in the lemon-print swimsuit — which is the
     Lemon Sea the whole story is named after, so the hero finally matches the
     tale. Her head is cropped by the top of the frame; that is deliberate and
     load-bearing, because the tricorn is placed over the cut to hide it. */
  { file: 'xyla-lemon-beach.jpg', out: 'xyla-hero.webp',
    crop: null, maxEdge: 760, quality: 0.86 },
  { file: 'PXL_20260731_205420658.jpg', out: 'xyla-medallion.webp',
    crop: { x: 10, y: 60, w: 420, h: 420 }, maxEdge: 460, quality: 0.88 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('  ', ...a);

/* ---- 1. dependencies, in a scratch dir well away from the repo ---------- */
mkdirSync(WORK, { recursive: true });
if (!existsSync(join(WORK, 'node_modules/@huggingface/transformers'))) {
  log('installing Transformers.js (one time)…');
  execFileSync('npm', ['init', '-y'], { cwd: WORK, stdio: 'ignore' });
  execFileSync('npm', ['install', '@huggingface/transformers@3.3.3', '--no-audit', '--no-fund'],
    { cwd: WORK, stdio: 'inherit' });
}

/* ---- 2. model weights -------------------------------------------------- */
const MDIR = join(WORK, 'models', MODEL);
mkdirSync(join(MDIR, 'onnx'), { recursive: true });
for (const [rel, url] of [
  ['config.json', `https://huggingface.co/${MODEL}/resolve/main/config.json`],
  ['preprocessor_config.json', `https://huggingface.co/${MODEL}/resolve/main/preprocessor_config.json`],
  ['onnx/model.onnx', `https://huggingface.co/${MODEL}/resolve/main/onnx/model.onnx`],
]) {
  const dest = join(MDIR, rel);
  if (existsSync(dest)) continue;
  log('downloading', rel, '…');
  execFileSync('curl', ['-sSL', '-o', dest, url]);
}

/* ---- 3. the page that does the work ------------------------------------ */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>working</title></head>
<body><div id="log"></div><script type="module">
const log = (m) => { document.getElementById('log').textContent = m;
  fetch('/log', { method:'POST', body:m }).catch(()=>{}); };
import { env, AutoModel, AutoProcessor, RawImage } from '/dist/transformers.min.js';
env.allowRemoteModels = false; env.allowLocalModels = true;
env.localModelPath = '/models/';
env.backends.onnx.wasm.wasmPaths = '/dist/';
env.backends.onnx.wasm.numThreads = 4;
const JOBS = ${JSON.stringify(JOBS)};
(async () => {
  log('loading model…');
  const model = await AutoModel.from_pretrained('${MODEL}', { config:{model_type:'custom'}, dtype:'fp32' });
  const processor = await AutoProcessor.from_pretrained('${MODEL}', { config:{
    do_normalize:true, do_pad:false, do_rescale:true, do_resize:true,
    image_mean:[0.5,0.5,0.5], image_std:[1,1,1], resample:2,
    rescale_factor:1/255, size:{width:512,height:512} } });

  for (const job of JOBS) {
    log('segmenting ' + job.out + '…');
    const src = '/photos/' + job.file;
    const image = await RawImage.fromURL(src);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8'))
                               .resize(image.width, image.height);

    const cv = document.createElement('canvas');
    cv.width = image.width; cv.height = image.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(await createImageBitmap(await (await fetch(src)).blob()), 0, 0);
    const id = ctx.getImageData(0,0,cv.width,cv.height);
    for (let i = 0; i < mask.data.length; i++) id.data[4*i+3] = mask.data[i];
    ctx.putImageData(id, 0, 0);

    /* trim to the opaque bounding box so we ship pixels, not empty margins */
    let x0=cv.width, y0=cv.height, x1=0, y1=0;
    for (let y=0; y<cv.height; y++) for (let x=0; x<cv.width; x++)
      if (id.data[(y*cv.width+x)*4+3] > 24) {
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      }
    const trimmed = document.createElement('canvas');
    trimmed.width = x1-x0+1; trimmed.height = y1-y0+1;
    trimmed.getContext('2d').drawImage(cv, x0,y0,trimmed.width,trimmed.height,
                                           0,0,trimmed.width,trimmed.height);

    const c = job.crop || { x:0, y:0, w:trimmed.width, h:trimmed.height };
    const scale = Math.min(1, job.maxEdge / Math.max(c.w, c.h));
    const out = document.createElement('canvas');
    out.width = Math.round(c.w*scale); out.height = Math.round(c.h*scale);
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(trimmed, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);

    const url = out.toDataURL('image/webp', job.quality);
    log(job.out + ' ' + out.width + 'x' + out.height);
    await fetch('/save/' + job.out, { method:'POST', body:url });
  }
  await fetch('/done', { method:'POST', body:'ok' });
  document.title = 'done';
})().catch(async (e) => {
  log('ERROR ' + e.message);
  await fetch('/done', { method:'POST', body:'ERROR ' + e.message });
  document.title = 'error';
});
</script></body></html>`;

writeFileSync(join(WORK, 'page.html'), PAGE);

/* ---- 4. serve it on localhost ------------------------------------------ */
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.wasm':'application/wasm', '.jpg':'image/jpeg' };
let finished = null;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST') {
    let b = ''; req.on('data', (c) => b += c); req.on('end', () => {
      if (u.startsWith('/save/')) {
        mkdirSync(join(ROOT, 'assets'), { recursive: true });
        const buf = Buffer.from(b.split(',')[1] || '', 'base64');
        writeFileSync(join(ROOT, 'assets', u.slice(6)), buf);
        log('wrote assets/' + u.slice(6), (buf.length/1024|0) + 'KB');
      } else if (u === '/done') finished = b;
      else if (u === '/log') log('[page]', b);
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let p;
  if (u.startsWith('/photos/')) {
    /* look in the external source dir first, then the repo root */
    p = join(SRC, u.slice(8));
    if (!existsSync(p)) p = join(ROOT, u.slice(8));
  }
  else if (u.startsWith('/dist/')) p = join(WORK, 'node_modules/@huggingface/transformers/dist', u.slice(6));
  else if (u.startsWith('/models/')) p = join(WORK, 'models', u.slice(8));
  else p = join(WORK, 'page.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---- 5. drive headless Chromium over CDP ------------------------------- */
const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu',
  '--no-proxy-server', '--enable-features=SharedArrayBuffer',
  `--remote-debugging-port=${CDP}`, '--user-data-dir=' + join(WORK, 'profile'),
  'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json()).webSocketDebuggerUrl; }
  catch { await sleep(250); }
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
};
const raw = (method, params = {}, sessionId) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  return new Promise((r) => pend.set(i, r));
};
const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => raw(m, p, sessionId);
await s('Page.enable');
await s('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });

for (let i = 0; i < 300 && finished === null; i++) await sleep(1000);
chrome.kill(); server.close();

if (finished === null) { console.error('timed out'); process.exit(2); }
if (String(finished).startsWith('ERROR')) { console.error(finished); process.exit(1); }
console.log('done — rebuild with: node tools/build.js');
process.exit(0);
