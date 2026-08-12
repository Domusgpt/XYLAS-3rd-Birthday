#!/usr/bin/env node
/* ============================================================================
 *  probe-rsvp.mjs — does an RSVP actually reach the right inbox?
 *  ---------------------------------------------------------------------------
 *  This is the single most important function on the page and the least
 *  exercised: every other check looks at the story. Here we open the card, fill
 *  the form in, submit it, and inspect the mailto: the page composes — the
 *  recipient, the subject, and whether the body carries enough for the reply to
 *  stand on its own.
 *
 *  It also checks validation rejects an empty name, because an RSVP that
 *  silently sends with nobody's name on it is worse than one that refuses.
 *
 *  Usage: node tools/probe-rsvp.mjs [--target dist/xyla-invite.html]
 * ==========================================================================*/
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const root = resolve('.');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argOf('--target', 'dist/xyla-invite.html');
const port = 9700 + (process.pid % 150);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=/tmp/xy-rsvp-' + process.pid,
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
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
  await send('Page.navigate', { url: `file://${root}/${target}?auto=1&seek=43` });
  await sleep(1700);

  /* ---- 1. an empty name must be refused ---- */
  const refused = await evalJS(`(function(){
    XY.debug.openSheet('rsvp');
    var f = document.querySelector('#rsvp-panel form');
    f.name.value = '';
    var errs = XY.Invite.validate(f);
    return !!errs.name;
  })()`);

  /* ---- 2. a real submission ---- */
  const out = await evalJS(`(function(){
    var f = document.querySelector('#rsvp-panel form');
    f.name.value = 'Grandma Jean';
    f.kids.value = '2';
    f.adults.value = '1';
    f.note.value = 'Bringing a cake';
    var url = XY.Invite.mailtoURL({
      name: f.name.value, kids: f.kids.value,
      adults: f.adults.value, note: f.note.value,
    });
    var q = url.slice(url.indexOf('?') + 1);
    var p = new URLSearchParams(q);
    return JSON.stringify({
      to: decodeURIComponent(url.slice('mailto:'.length, url.indexOf('?'))),
      subject: p.get('subject'),
      body: p.get('body'),
    });
  })()`);
  const m = JSON.parse(out);

  const has = (s) => m.body.includes(s);
  const checks = [
    ['refuses a blank name', refused],
    ['recipient is Maryhennedy1@gmail.com', m.to === 'Maryhennedy1@gmail.com'],
    ['subject names the party', /Xyla/.test(m.subject || '')],
    ['body names the guest', has('Grandma Jean')],
    ['body carries the head count', has('Kids:') && has('2')],
    ['body carries their note', has('Bringing a cake')],
    ['body repeats the date', has('Friday, August 28th')],
    ['body repeats the address', has('1044 West Bay Ave')],
    ['no console errors', errors.length === 0],
  ];

  console.log('\nRSVP, driven end to end\n');
  console.log('  to:      ' + m.to);
  console.log('  subject: ' + m.subject);
  console.log('  body:\n    ' + m.body.split('\n').join('\n    ') + '\n');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}`);
    if (!pass) ok = false;
  }
  if (errors.length) console.log('\n  ' + errors.join('\n  '));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — RSVP composes a complete message to the right address\n`);
  chrome.kill();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
