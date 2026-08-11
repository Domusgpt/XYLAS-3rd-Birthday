#!/usr/bin/env node
/* ============================================================================
 *  verify.mjs — screenshot every act, on a real phone viewport, and fail on
 *  any console error.
 *  ---------------------------------------------------------------------------
 *  Drives the preinstalled Chromium over the DevTools Protocol using Node's
 *  built-in WebSocket. Zero npm dependencies, on purpose.
 *
 *  Why CDP rather than just --screenshot: headless Chrome refuses to make its
 *  window narrower than 500px, so a --window-size=390 run silently renders a
 *  500px layout and crops it — which would hide exactly the mobile overflow
 *  bugs this is meant to catch. Emulation.setDeviceMetricsOverride sets a true
 *  390px layout viewport.
 *
 *  Usage:  node tools/verify.mjs [--target dist/xyla-invite.html]
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const root = resolve('.');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const target = argOf('--target', 'index.html');
const outDir = resolve(root, 'tools/shots');
const port = 9333 + (process.pid % 200);
mkdirSync(outDir, { recursive: true });

const SEEKS = (argOf('--seeks', '0.5,8,11,16,18,24,29,32,36,38,43') || '').split(',');
const DEVICES = {
  phone:   { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
};
const only = argOf('--device', null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=/tmp/xy-verify-' + process.pid,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('Chrome never came up on the debug port');
}

async function main() {
  const wsUrl = await connect();
  ws = new WebSocket(wsUrl);
  await new Promise((r) => { ws.onopen = r; });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      return;
    }
    /* uncaught exceptions and console.error both count as failures */
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      consoleErrors.push(`${current}: EXCEPTION ${d.exception?.description || d.text}`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(`${current}: console.error ${m.params.args.map((a) => a.value).join(' ')}`);
    }
  };

  /* a page target to drive */
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const rawSend = send;
  send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => pending.set(id, { res, rej }));
  };

  await send('Page.enable');
  await send('Runtime.enable');

  let current = '';
  globalThis.__setCurrent = (v) => { current = v; };

  for (const [name, metrics] of Object.entries(DEVICES)) {
    if (only && only !== name) continue;
    await send('Emulation.setDeviceMetricsOverride', { ...metrics, screenWidth: metrics.width, screenHeight: metrics.height });
    if (metrics.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    for (const t of SEEKS) {
      current = `${name}@t=${t}`;
      /* seek goes in the QUERY, not the hash: two URLs differing only by
         fragment are a same-document navigation, so the page would never
         reload and every later screenshot would reuse the first frame. */
      const url = `file://${root}/${target}?auto=1&seek=${t}`;
      await send('Page.navigate', { url });
      await sleep(1400);
      /* confirm the app actually booted rather than screenshotting a blank */
      const ready = await send('Runtime.evaluate', {
        expression: 'document.documentElement.getAttribute("data-ready")',
        returnByValue: true,
      });
      if (ready.result.value !== '1') consoleErrors.push(`${current}: app never signalled ready`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${outDir}/${name}-t${t}.png`, Buffer.from(shot.data, 'base64'));
      process.stdout.write(`  ok ${current}\n`);
    }
  }

  /* ---- a layout assertion that a screenshot cannot make for itself ---- */
  await send('Emulation.setDeviceMetricsOverride', { ...DEVICES.phone, screenWidth: 390, screenHeight: 844 });
  await send('Page.navigate', { url: `file://${root}/${target}?auto=1&seek=43` });
  await sleep(1400);
  const overflow = await send('Runtime.evaluate', {
    expression: `(function(){
      var docW = document.documentElement.scrollWidth;
      var vw = innerWidth;
      var card = document.querySelector('#invite-card');
      var r = card ? card.getBoundingClientRect() : null;
      return JSON.stringify({ vw: vw, docW: docW,
        cardRight: r ? Math.round(r.right) : null,
        cardLeft: r ? Math.round(r.left) : null });
    })()`,
    returnByValue: true,
  });
  /* ---- did the photos actually load? ----
     A broken <image> inside SVG renders as nothing at all, with no console
     error — so without this check a build that lost its assets would sail
     through every other test and ship looking merely "empty". */
  const assets = await send('Runtime.evaluate', {
    expression: `(async function(){
      const probe = (src) => new Promise((res) => {
        if (!src) return res('missing-src');
        const i = new Image();
        i.onload = () => res(i.naturalWidth > 0 ? 'ok' : 'zero-width');
        i.onerror = () => res('load-error');
        i.src = src;
      });
      const svgImg = document.querySelector('[data-slot="photo"]');
      const cardImg = document.querySelector('.medallion img');
      return JSON.stringify({
        hero: svgImg ? await probe(svgImg.getAttribute('href')) : 'no-element',
        medallion: cardImg ? await probe(cardImg.getAttribute('src')) : 'no-element',
      });
    })()`,
    awaitPromise: true, returnByValue: true,
  });
  const a = JSON.parse(assets.result.value);
  console.log('  photos:', assets.result.value);
  if (a.hero !== 'ok') consoleErrors.push(`hero photo did not load: ${a.hero}`);
  if (a.medallion !== 'ok') consoleErrors.push(`medallion photo did not load: ${a.medallion}`);

  const o = JSON.parse(overflow.result.value);
  console.log('  layout@390:', overflow.result.value);
  if (o.docW > o.vw + 1) consoleErrors.push(`horizontal overflow: document ${o.docW}px in a ${o.vw}px viewport`);
  if (o.cardRight > o.vw + 1 || o.cardLeft < -1) consoleErrors.push(`invitation card overflows the phone viewport`);

  chrome.kill();
  if (consoleErrors.length) {
    console.error('\nFAILURES:');
    consoleErrors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('\nclean: no console errors, no overflow.');
  process.exit(0);
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
