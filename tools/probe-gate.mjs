#!/usr/bin/env node
/* ============================================================================
 *  probe-gate.mjs — does tapping "Open the invitation" actually start things?
 *  ---------------------------------------------------------------------------
 *  The screenshot harness runs with ?auto=1, which hides the gate and starts
 *  the story directly — so it never exercises the one code path every real
 *  visitor takes. This drives the gate the way a person does: load the page
 *  cold, click the button, then check that the music is on, the audio context
 *  is actually running (not suspended, which is how autoplay silently fails),
 *  the master gain has ramped up, and the story is playing.
 *
 *  Usage: node tools/probe-gate.mjs [--target index.html]
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const root = resolve('.');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argOf('--target', 'index.html');
const port = 9600 + (process.pid % 150);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* No --mute-audio here: muting is a rendering concern, but it also makes it
   harder to trust what the context reports. Autoplay policy is relaxed so the
   headless run behaves like a browser that has been interacted with. */
const chrome = spawn(CHROME, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=/tmp/xy-gate-' + process.pid,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

let ws, msgId = 0, sessionId = null;
const pending = new Map();
const errors = [];
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
const evalJS = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

async function main() {
  ws = new WebSocket(await connect());
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
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

  await send('Page.navigate', { url: `file://${root}/${target}` });
  await sleep(1600);

  const before = await evalJS(`JSON.stringify({
    ready: document.documentElement.getAttribute('data-ready'),
    gateVisible: !document.getElementById('gate').hidden,
    gateWhen: (document.getElementById('gate-when')||{}).textContent || '',
    ctx: XY.debug ? !!XY.debug.audio.ctx : null,
    on: XY.debug ? XY.debug.audio.on : null,
  })`);

  /* a real click, dispatched as a trusted-looking user gesture */
  await evalJS(`document.getElementById('btn-open').click(); true`);
  await sleep(1500);

  const after = await evalJS(`JSON.stringify({
    gateHidden: document.getElementById('gate').hidden,
    on: XY.debug.audio.on,
    ctxState: XY.debug.audio.ctx ? XY.debug.audio.ctx.state : 'no-context',
    gain: XY.debug.audio.master ? +XY.debug.audio.master.gain.value.toFixed(3) : null,
    scheduler: !!XY.debug.audio.timer,
    storyPlaying: !XY.debug.master.paused(),
    storyProgress: +XY.debug.master.progress().toFixed(4),
    muteBtn: document.getElementById('btn-mute').getAttribute('aria-pressed'),
    muteLabel: document.getElementById('btn-mute').getAttribute('aria-label'),
  })`);

  const b = JSON.parse(before), a = JSON.parse(after);
  console.log('\nbefore the tap');
  console.log(`  app ready ............. ${b.ready === '1' ? 'yes' : 'NO'}`);
  console.log(`  gate showing .......... ${b.gateVisible ? 'yes' : 'NO'}`);
  console.log(`  gate shows the date ... ${b.gateWhen ? JSON.stringify(b.gateWhen) : 'NO — empty'}`);
  console.log(`  audio context ......... ${b.ctx ? 'created (should not be yet)' : 'not yet, correct'}`);
  console.log('\nafter the tap');
  console.log(`  gate dismissed ........ ${a.gateHidden ? 'yes' : 'NO'}`);
  console.log(`  music on .............. ${a.on ? 'yes' : 'NO'}`);
  console.log(`  audio context state ... ${a.ctxState}${a.ctxState === 'running' ? '' : '  <-- suspended means silence'}`);
  console.log(`  master gain ........... ${a.gain}`);
  console.log(`  note scheduler running  ${a.scheduler ? 'yes' : 'NO'}`);
  console.log(`  story playing ......... ${a.storyPlaying ? 'yes' : 'NO'} (progress ${a.storyProgress})`);
  console.log(`  ♪ button state ........ aria-pressed=${a.muteBtn}, "${a.muteLabel}"`);
  if (errors.length) console.log('\nconsole errors:\n  ' + errors.join('\n  '));

  const ok = a.gateHidden && a.on && a.ctxState === 'running' && a.gain > 0 &&
             a.scheduler && a.storyPlaying && b.gateWhen && !errors.length;
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — music and story start from the gate tap\n`);
  chrome.kill();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
