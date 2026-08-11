#!/usr/bin/env node
/* ============================================================================
 *  probe-morph.mjs — does the crew ACTUALLY change shape?
 *  ---------------------------------------------------------------------------
 *  A screenshot cannot answer this on its own: the camera moves between the
 *  before and after frames, the creatures are small, and "it looks different"
 *  is not the same as "the path data changed". So this reads the real `d`
 *  attribute of a few slots on creature 0 at a series of times and reports
 *  whether it moved.
 *
 *  Usage: node tools/probe-morph.mjs [--target index.html]
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const root = resolve('.');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argOf('--target', 'index.html');
const port = 9800 + (process.pid % 150);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=/tmp/xy-probe-' + process.pid,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

let ws, msgId = 0, sessionId = null;
const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('Chrome never came up');
}

/* the slots most likely to differ between two genomes */
const SLOTS = ['body', 'head', 'wingFrontL', 'tail', 'hat', 'accessory'];
const TIMES = [13.0, 14.6, 15.6, 16.6, 17.6, 19.0, 20.5, 31.5, 33.0];

const EXPR = `(function(){
  var host = document.querySelectorAll('#l-cast .actor.is-tappable')[0];
  if (!host) return 'NO CAST';
  var out = {};
  ${JSON.stringify(SLOTS)}.forEach(function (s) {
    var n = host.querySelector('[data-slot="' + s + '"]');
    var d = n ? (n.getAttribute('d') || '') : '';
    /* a short stable digest — full path data is far too long to eyeball */
    var h = 0;
    for (var i = 0; i < d.length; i++) { h = (h * 31 + d.charCodeAt(i)) | 0; }
    out[s] = (h >>> 0).toString(36) + '/' + d.length +
             '/op' + (n ? (n.getAttribute('opacity') || '1') : '-');
  });
  return JSON.stringify(out);
})()`;

async function main() {
  ws = new WebSocket(await connect());
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });

  const rows = [];
  for (const t of TIMES) {
    await send('Page.navigate', { url: `file://${root}/${target}?auto=1&seek=${t}` });
    await sleep(1300);
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
    rows.push([t, r.result.value]);
  }

  console.log('creature 0 — path digests over time\n');
  let prev = null;
  for (const [t, raw] of rows) {
    if (typeof raw !== 'string' || raw[0] !== '{') { console.log(`t=${t}  ${raw}`); continue; }
    const cur = JSON.parse(raw);
    const changed = prev ? SLOTS.filter((s) => cur[s] !== prev[s]) : [];
    console.log(
      `t=${String(t).padEnd(5)} body=${cur.body.padEnd(16)} head=${cur.head.padEnd(16)}` +
      (prev ? `  changed: ${changed.length ? changed.join(',') : '— NOTHING —'}` : '  (baseline)')
    );
    prev = cur;
  }
  chrome.kill();
  process.exit(0);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
