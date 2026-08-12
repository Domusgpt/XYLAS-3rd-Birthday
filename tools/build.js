#!/usr/bin/env node
/* ============================================================================
 *  build.js — inline everything into one shareable file
 *  ---------------------------------------------------------------------------
 *  Produces dist/xyla-invite.html: a single self-contained page with no
 *  external requests at all. That file can be emailed, dropped on any host, or
 *  published as a sandboxed artifact, and it will work offline forever.
 *
 *  Zero dependencies, on purpose. This repo should still build in ten years.
 * ==========================================================================*/
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const srcFile = path.join(root, 'index.html');
const outFile = path.join(root, 'dist', 'xyla-invite.html');

let html = fs.readFileSync(srcFile, 'utf8');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/* A literal </script> inside inlined JS would close the wrapping tag early. */
const safeJS = (js) => js
  .replace(/<\/script/gi, '<\\/script')
  .replace(/^\s*\/\/# sourceMappingURL=.*$/gm, '');

let inlined = 0;

/* stylesheets */
html = html.replace(/[ \t]*<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>\s*/gi,
  (m, href) => {
    inlined++;
    return `<style>\n${read(href)}\n</style>\n`;
  });

/* scripts — order is the module system here, so it must be preserved exactly */
html = html.replace(/[ \t]*<script[^>]+src=["']([^"']+)["'][^>]*>\s*<\/script>\s*/gi,
  (m, src) => {
    inlined++;
    return `<script>\n${safeJS(read(src))}\n</script>\n`;
  });

/* ---------------------------------------------------------------------------
 *  Inline the photo assets as data URIs.
 *
 *  These are referenced as plain strings inside config.js ("assets/xyla-hero.webp"),
 *  so once the scripts are inlined the paths are just text in the bundle and a
 *  straight substitution reaches every use — the SVG <image>, the <img> on the
 *  card, and anything added later. Without this the single-file build ships
 *  with two broken photos, which is exactly the version most likely to be
 *  shared around.
 * ------------------------------------------------------------------------ */
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
let inlinedBytes = 0;
if (fs.existsSync(path.join(root, 'assets'))) {
  for (const name of fs.readdirSync(path.join(root, 'assets'))) {
    const ext = path.extname(name).toLowerCase();
    if (!MIME[ext]) continue;
    const rel = 'assets/' + name;
    if (!html.includes(rel)) continue;
    const buf = fs.readFileSync(path.join(root, 'assets', name));
    const uri = `data:${MIME[ext]};base64,${buf.toString('base64')}`;
    html = html.split(rel).join(uri);
    inlinedBytes += buf.length;
    console.log(`  inlined ${rel} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

/* ---------------------------------------------------------------------------
 *  Bake the real party details into the parts of the page that JavaScript
 *  never gets to touch.
 *
 *  The <noscript> card and the Open Graph tags are static HTML by definition:
 *  a visitor with JS off, a link-preview bot, and a search crawler all see the
 *  markup exactly as shipped. They were hardcoded with "Date here" and
 *  mom@example.com, which meant the one audience that cannot be fixed at
 *  runtime was the one being shown placeholder text.
 *
 *  config.js is the single source of truth, so it is read here rather than
 *  duplicated. It is a plain assignment to a global, so a tiny sandbox is
 *  enough to evaluate it — no parser, no dependency.
 * ------------------------------------------------------------------------ */
const CONFIG = (() => {
  const sandbox = { window: {} };
  new Function('window', read('config.js')).call(sandbox, sandbox.window);
  return sandbox.window.XY ? sandbox.window.XY.CONFIG : null;
})();

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
/* Anything still reading "… here" is an unfilled placeholder — say so plainly
   rather than printing the placeholder as if it were the venue. */
const filled = (v) => (v && !/\bhere\b/i.test(String(v))) ? String(v) : null;

const between = (open, close, replacement) => {
  const re = new RegExp(`<!--${open}-->[\\s\\S]*?<!--${close}-->`);
  if (!re.test(html)) { console.log(`  ! ${open} marker missing — skipped`); return; }
  html = html.replace(re, `<!--${open}-->\n${replacement}\n<!--${close}-->`);
};

if (CONFIG) {
  const p = CONFIG.PARTY, child = CONFIG.CHILD, rsvp = CONFIG.RSVP;
  const when = [filled(p.dateDisplay), filled(p.timeDisplay)].filter(Boolean).join(' · ');
  const where = [filled(p.venue), filled(p.address)].filter(Boolean).join(', ');
  const rows = [
    ['When', esc(when) || 'To be confirmed'],
    ['Where', esc(where) || 'To be confirmed'],
    filled(p.bring) ? ['Bring', esc(p.bring)] : null,
    filled(p.rsvpByDisplay) ? ['RSVP by', esc(p.rsvpByDisplay)] : null,
    ['RSVP', `<a href="mailto:${esc(rsvp.to)}">${esc(rsvp.to)}</a>`],
  ].filter(Boolean);
  between('NOSCRIPT-DETAILS', '/NOSCRIPT-DETAILS',
    '<dl>\n' + rows.map(([k, v]) => `      <dt>${k}</dt><dd>${v}</dd>`).join('\n') + '\n    </dl>');

  const title = `${esc(child.name)} is turning ${esc(String(child.age))} — you’re invited`;
  const desc = [when, 'A butterfly-pirate-robot-dinosaur pool party.']
    .filter(Boolean).join(' · ');
  between('SHARE-META', '/SHARE-META', [
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
  ].join('\n'));
  html = html.replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(desc)}">`);
  console.log(`  baked details into <noscript> and share tags`);
} else {
  console.log('  ! could not read config.js — static details left as-is');
}

/* Tell the page it is sandboxed. rsvp.js reads this and forces the RSVP to
   mailto, because a sandboxed page cannot reach a form-POST endpoint and the
   submission would fail silently. */
html = html.replace('<head>', '<head>\n<script>window.XY_STANDALONE=true;</script>');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);

/* ---------------------------------------------------------------------------
 *  A second output for hosts that supply their own <!doctype>/<head>/<body>
 *  wrapper and only accept page content. Same inlined payload, just without
 *  the outer document.
 * ------------------------------------------------------------------------ */
const pick = (re) => (html.match(re) || [])[1] || '';
const title = pick(/<title>([\s\S]*?)<\/title>/i);
const styles = (html.match(/<style>[\s\S]*?<\/style>/gi) || []).join('\n');
const bodyInner = pick(/<body[^>]*>([\s\S]*)<\/body>/i);

const fragment = [
  `<title>${title}</title>`,
  '<script>window.XY_STANDALONE=true;</script>',
  styles,
  bodyInner.trim(),
].join('\n');

fs.writeFileSync(path.join(root, 'dist', 'xyla-invite.fragment.html'), fragment);

/* ---- assert the output really is self-contained ---- */
const problems = [];
const externals = html.match(/(?:src|href)\s*=\s*["'](?!#|data:|mailto:|tel:)([a-z]+:)?\/\/[^"']+/gi);
if (externals) problems.push('external references remain: ' + externals.slice(0, 5).join(', '));
if (/<link[^>]+stylesheet/i.test(html)) problems.push('an un-inlined stylesheet remains');
if (/<script[^>]+src=/i.test(html)) problems.push('an un-inlined script remains');
if (/feGaussianBlur/.test(html)) problems.push('an SVG blur filter slipped in (mobile jank)');

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`inlined ${inlined} files -> dist/xyla-invite.html  (${kb} KB)`);
if (problems.length) {
  console.error('FAILED self-containment check:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('self-contained: no external requests.');
