#!/usr/bin/env node
/* ============================================================================
 *  measure-cutout.mjs — derive the hero's geometry instead of guessing it
 *  ---------------------------------------------------------------------------
 *  `PH` in js/hero.js is a block of constants describing where the head, the
 *  shoulders and the wing roots are in the cutout. Hand-measuring them is how a
 *  hat ends up subtly floating above a head, and every one of them is wrong the
 *  moment the photograph changes.
 *
 *  So this reads them off the image. It loads the cutout into a canvas, walks
 *  the alpha channel, and reports:
 *
 *    - the tight opaque bounding box
 *    - a per-row width profile, from which the neck pinch and the shoulder
 *      flare fall out, which is what separates "head" from "body"
 *    - HOW WIDE THE SUBJECT IS WHERE IT MEETS THE TOP EDGE — the crop line.
 *      This photo has her head cut off by the frame, and the tricorn has to be
 *      wider than that cut or the flat edge shows past the brim.
 *
 *  It also writes a preview PNG with the derived guides drawn on, because a
 *  number being plausible and the guide landing on her actual head are two
 *  different claims and only one of them can be checked by looking.
 *
 *  Usage: node tools/measure-cutout.mjs [assets/xyla-hero.webp]
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import http from 'node:http';

const ROOT = resolve('.');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8793;
const CDP = 9923;
const file = process.argv[2] || 'assets/xyla-hero.webp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE = `<!doctype html><html><body><script>
(async () => {
  const img = await createImageBitmap(await (await fetch('/img')).blob());
  const W = img.width, H = img.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const a = ctx.getImageData(0, 0, W, H).data;
  const A = 40;                                   // alpha threshold for "solid"

  /* per-row extents */
  const rows = [];
  for (let y = 0; y < H; y++) {
    let lo = -1, hi = -1, n = 0;
    for (let x = 0; x < W; x++) {
      if (a[(y * W + x) * 4 + 3] > A) { if (lo < 0) lo = x; hi = x; n++; }
    }
    rows.push({ y, lo, hi, w: lo < 0 ? 0 : hi - lo + 1, n });
  }
  const solid = rows.filter(r => r.w > 0);
  const bbox = {
    x0: Math.min(...solid.map(r => r.lo)), x1: Math.max(...solid.map(r => r.hi)),
    y0: solid[0].y, y1: solid[solid.length - 1].y,
  };

  /* the crop line: how wide she is at the very top of the image */
  const top = rows[0];
  const touchesTop = top.w > 0;

  /* Head band, found by locating the NECK.
     The neck is simply the narrowest row in the upper part of the figure:
     head above it, shoulders below. Looking instead for the width to "jump"
     at the shoulder — the obvious approach, and the one tried first — fails
     completely on a subject turned at an angle, because the outline then
     widens gradually into an outstretched arm and never steps out. On this
     photo that mis-read put the head band over the entire body. */
  let shoulderY = 0, neckW = Infinity;
  const scanFrom = Math.round(H * 0.08), scanTo = Math.round(H * 0.42);
  for (let y = scanFrom; y < scanTo; y++) {
    if (rows[y].w > 0 && rows[y].w < neckW) { neckW = rows[y].w; shoulderY = y; }
  }
  const headRows = rows.slice(0, shoulderY).filter(r => r.w > 0);
  const headW = Math.max(...headRows.map(r => r.w));
  const headWidestY = headRows.find(r => r.w === headW).y;
  /* Centre on the crop line when the head is cut off, because that is the
     line the hat has to cover; otherwise centre on the widest head row. */
  const headCX = top.w > 0
    ? Math.round((top.lo + top.hi) / 2)
    : Math.round((headRows.find(r => r.w === headW).lo + headRows.find(r => r.w === headW).hi) / 2);

  /* widest point overall — the shoulders/arms */
  const widest = solid.reduce((b, r) => (r.w > b.w ? r : b), solid[0]);

  /* draw guides so the numbers can be checked by eye */
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FF2D6F';
  ctx.strokeRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
  ctx.strokeStyle = '#00C2FF';                     // head band
  ctx.strokeRect(headCX - headW / 2, 0, headW, shoulderY);
  ctx.strokeStyle = '#FFD400';                     // the crop line
  ctx.beginPath(); ctx.moveTo(top.lo, 2); ctx.lineTo(top.hi, 2); ctx.stroke();
  ctx.fillStyle = '#00FF88';                       // head centre
  ctx.fillRect(headCX - 4, headWidestY - 4, 8, 8);

  /* a coarse profile, so the shape can be read rather than inferred */
  const profile = [];
  for (let i = 0; i <= 20; i++) {
    const y = Math.min(H - 1, Math.round((i / 20) * (H - 1)));
    profile.push({ y, lo: rows[y].lo, hi: rows[y].hi, w: rows[y].w });
  }

  const png = cv.toDataURL('image/png');
  await fetch('/out', { method: 'POST', body: JSON.stringify({
    W, H, bbox, touchesTop,
    topLo: top.lo, topHi: top.hi, topW: top.w,
    shoulderY, headW, headWidestY, headCX,
    widestY: widest.y, widestW: widest.w, profile,
    png,
  })});
  document.title = 'done';
})().catch(async (e) => {
  await fetch('/out', { method: 'POST', body: JSON.stringify({ error: e.message }) });
  document.title = 'done';
});
</script></body></html>`;

let result = null;
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let b = ''; req.on('data', (c) => (b += c));
    req.on('end', () => { result = JSON.parse(b); res.writeHead(200); res.end('ok'); });
    return;
  }
  if (req.url.startsWith('/img')) {
    res.writeHead(200, { 'Content-Type': 'image/webp' });
    return res.end(readFileSync(join(ROOT, file)));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(PAGE);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
  `--remote-debugging-port=${CDP}`, '--user-data-dir=/tmp/xy-measure',
  `http://127.0.0.1:${PORT}/`], { stdio: 'ignore' });

for (let i = 0; i < 120 && !result; i++) await sleep(250);
chrome.kill();
server.close();

if (!result) { console.error('no result'); process.exit(1); }
if (result.error) { console.error('page error: ' + result.error); process.exit(1); }

const r = result;
writeFileSync(join(ROOT, 'tools/shots/cutout-guides.png'),
  Buffer.from(r.png.split(',')[1], 'base64'));

const pct = (n, d) => ((n / d) * 100).toFixed(1) + '%';
console.log(`\n${file} — ${r.W}x${r.H}\n`);
console.log(`  opaque bbox        x ${r.bbox.x0}..${r.bbox.x1}   y ${r.bbox.y0}..${r.bbox.y1}`);
console.log(`  touches top edge   ${r.touchesTop ? 'YES — the head is cropped' : 'no'}`);
if (r.touchesTop) {
  console.log(`  crop line          x ${r.topLo}..${r.topHi}  = ${r.topW}px wide (${pct(r.topW, r.W)} of image)`);
}
console.log(`  neck / head base   y ${r.shoulderY}  (narrowest row above the shoulders)`);
console.log(`  head width         ${r.headW}px, widest at y=${r.headWidestY}`);
console.log(`  head centre x      ${r.headCX}`);
console.log(`  widest overall     ${r.widestW}px at y=${r.widestY}`);
console.log('\n  width profile (y, left..right, width):');
for (const q of r.profile) {
  const bar = '#'.repeat(Math.round((q.w / r.W) * 40));
  console.log(`    y=${String(q.y).padStart(4)}  ${String(q.lo).padStart(4)}..${String(q.hi).padStart(4)}  ${String(q.w).padStart(4)}  ${bar}`);
}
console.log(`\n  suggested PH:`);
console.log(`    w: ${r.W}, h: ${r.H},`);
console.log(`    headCX: ${r.headCX}, headCY: ${Math.round(r.shoulderY * 0.5)}, headW: ${r.headW},`);
console.log(`    cropLo: ${r.topLo}, cropHi: ${r.topHi}, cropW: ${r.topW},`);
console.log(`    neckY: ${r.shoulderY},`);
console.log(`\n  the hat brim must exceed ${r.topW}px to cover the cut`);
console.log(`  guides drawn -> tools/shots/cutout-guides.png\n`);
