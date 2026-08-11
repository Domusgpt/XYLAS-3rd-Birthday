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
