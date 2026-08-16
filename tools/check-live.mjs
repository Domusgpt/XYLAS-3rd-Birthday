#!/usr/bin/env node
/* ============================================================================
 *  check-live.mjs — is the link a guest would tap actually the invitation?
 *  ---------------------------------------------------------------------------
 *  Written the day the old Google link died: the project's billing went
 *  delinquent, the bucket started returning a 403 XML error to everyone who had
 *  the URL, and the way we found out was a screenshot from somebody's WhatsApp.
 *  That is the failure this exists to catch first.
 *
 *  So it deliberately does NOT just check for a 200. The dead bucket answered
 *  every request perfectly promptly — with an error page. "The host replied"
 *  and "the host served the invitation" are different claims, and only the
 *  second one matters to a guest, so this asserts the party is actually in the
 *  bytes that came back.
 *
 *  Checks, any of which failing exits non-zero:
 *    - HTTP 200, content-type text/html
 *    - over 400 KB, because every error page is small and the real page is ~480
 *    - the date, the address, the parking note and the RSVP address are present
 *    - NO external src/href in the served body. The whole page is one
 *      self-contained file; if a future edit reintroduces a CDN or a webfont,
 *      the invitation acquires a dependency that can go down on its own, and
 *      that should be caught here rather than by a guest on bad hotel wifi.
 *
 *  Usage:  node tools/check-live.mjs [--url https://…]
 * ==========================================================================*/
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const url = argOf('--url', 'https://xylas3rd-birthday.static.hf.space/index.html');

/* The strings a guest needs in order for the page to be worth anything. If one
   of these goes missing the page is technically up and practically broken. */
const MUST_CONTAIN = [
  'Friday, August 28th',
  '1044 West Bay Ave',
  'Barnegat, NJ 08005',
  'Parking on 8th St',
  'Maryhennedy1@gmail.com',
];

let res, body;
try {
  res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  body = await res.text();
} catch (e) {
  console.error(`FAIL — could not reach ${url}\n  ${e.message}`);
  process.exit(1);
}

const type = res.headers.get('content-type') || '';
const kb = (body.length / 1024).toFixed(0);
const external = [...body.matchAll(/(?:src|href)="(https?:\/\/[^"]*)"/g)].map((m) => m[1]);

const checks = [
  [`HTTP 200 (got ${res.status})`, res.status === 200],
  [`serves text/html (got ${type.split(';')[0] || 'nothing'})`, /text\/html/.test(type)],
  [`is the full page, not an error (${kb} KB)`, body.length > 400_000],
  ...MUST_CONTAIN.map((s) => [`says "${s}"`, body.includes(s)]),
  [`no external requests${external.length ? ' — found ' + external[0] : ''}`, external.length === 0],
];

console.log(`\n${url}\n`);
let ok = true;
for (const [label, pass] of checks) {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}`);
  if (!pass) ok = false;
}

if (ok) {
  console.log('\nPASS — the invitation is live and complete\n');
} else {
  console.log(`\nFAIL — guests tapping this link are NOT getting the invitation.
Re-publish with:  node deploy/hf-publish.mjs\n`);
}
process.exit(ok ? 0 : 1);
