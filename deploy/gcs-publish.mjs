#!/usr/bin/env node
/* ============================================================================
 *  gcs-publish.mjs — put the invitation on a real, shareable URL
 *  ---------------------------------------------------------------------------
 *  Publishes dist/xyla-invite.html to a Google Cloud Storage bucket as
 *  index.html, and makes the bucket publicly readable so a link can simply be
 *  sent to someone.
 *
 *  Zero dependencies, on purpose — `gcloud` and `gsutil` are not installed in
 *  this container, and npm packages age badly. This talks to the JSON API
 *  directly and mints its own OAuth token from a service-account key, which is
 *  about sixty lines of Node's built-in crypto.
 *
 *  THE KEY FILE IS NEVER READ FROM INSIDE THE REPO and must never be committed.
 *  Pass its path explicitly:
 *
 *    node deploy/gcs-publish.mjs --key /path/to/sa.json --bucket my-bucket
 *
 *  Optional: --file (default dist/xyla-invite.html), --location (default US).
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const keyPath = argOf('--key', process.env.GOOGLE_APPLICATION_CREDENTIALS);
const file = resolve(argOf('--file', 'dist/xyla-invite.html'));
const location = argOf('--location', 'US');
if (!keyPath) { console.error('need --key /path/to/service-account.json'); process.exit(1); }

const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
const bucket = argOf('--bucket', `${sa.project_id}-xyla-invite`);

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ---- mint an access token from the service-account key ---- */
async function token(scope) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email, scope, aud: sa.token_uri, iat: now, exp: now + 3600,
  };
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claim));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).end()
    .sign(sa.private_key);
  const assertion = `${head}.${body}.${b64url(sig)}`;

  const r = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token exchange failed: ' + JSON.stringify(j));
  return j.access_token;
}

const api = async (t, url, init = {}) => {
  const r = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${t}`, ...(init.headers || {}) },
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* upload replies can be empty */ }
  return { status: r.status, ok: r.ok, json, text };
};

async function main() {
  const t = await token('https://www.googleapis.com/auth/devstorage.full_control');
  console.log(`authenticated as ${sa.client_email}`);

  /* ---- bucket ---- */
  let made = await api(t,
    `https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(sa.project_id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: bucket,
        location,
        iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
        website: { mainPageSuffix: 'index.html', notFoundPage: 'index.html' },
      }),
    });
  if (made.status === 409) console.log(`bucket ${bucket} already exists — reusing`);
  else if (!made.ok) throw new Error(`create bucket: ${made.status} ${made.text}`);
  else console.log(`created bucket ${bucket}`);

  /* ---- public read ---- */
  const iam = await api(t, `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`);
  if (!iam.ok) throw new Error(`read iam: ${iam.status} ${iam.text}`);
  const bindings = iam.json.bindings || [];
  const viewer = bindings.find((b) => b.role === 'roles/storage.objectViewer');
  if (viewer) { if (!viewer.members.includes('allUsers')) viewer.members.push('allUsers'); }
  else bindings.push({ role: 'roles/storage.objectViewer', members: ['allUsers'] });
  const put = await api(t, `https://storage.googleapis.com/storage/v1/b/${bucket}/iam`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...iam.json, bindings }),
  });
  if (!put.ok) throw new Error(`set iam: ${put.status} ${put.text}`);
  console.log('bucket is publicly readable');

  /* ---- the file ----
     Short cache so a re-publish is actually seen. The page is one
     self-contained file, so there is nothing else to invalidate. */
  const html = readFileSync(file);
  const boundary = 'xyla' + Date.now();
  const meta = JSON.stringify({
    name: 'index.html',
    contentType: 'text/html; charset=utf-8',
    cacheControl: 'public, max-age=60',
  });
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: text/html; charset=utf-8\r\n\r\n`),
    html,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const up = await api(t,
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart`, {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body: payload,
    });
  if (!up.ok) throw new Error(`upload: ${up.status} ${up.text}`);
  console.log(`uploaded ${(html.length / 1024).toFixed(0)} KB`);

  console.log(`\n  https://storage.googleapis.com/${bucket}/index.html\n`);
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1); });
