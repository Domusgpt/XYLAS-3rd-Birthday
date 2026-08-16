#!/usr/bin/env node
/* ============================================================================
 *  hf-publish.mjs — put the invitation on its permanent link
 *  ---------------------------------------------------------------------------
 *  Publishes dist/xyla-invite.html to a Hugging Face **static Space**, which
 *  serves it at
 *
 *      https://<owner>-<name>.static.hf.space
 *
 *  A static Space is just a git repo that HF serves as files. There is no
 *  build, no container, nothing that sleeps or cold-starts, and — the reason
 *  the page is here at all — no billing relationship that can take the link
 *  down. The invitation is a single self-contained HTML file, which is exactly
 *  the shape this host is for.
 *
 *  Zero dependencies, on purpose: the HTTP API creates the repo, and `git`
 *  pushes the file. Nothing to install and nothing to age.
 *
 *  THE TOKEN IS NEVER READ FROM INSIDE THE REPO. It comes from $HF_TOKEN, or
 *  from --token, and needs `repo.write` on the owner account.
 *
 *    HF_TOKEN=hf_... node deploy/hf-publish.mjs --owner gen-rl-millz --name xyla-birthday
 *
 *  Optional: --file (default dist/xyla-invite.html), --message.
 *
 *  Publishing the SAME page twice is a no-op that exits 0 rather than an error,
 *  because re-running a publish after a build that changed nothing is a normal
 *  thing to do and should not look like a failure.
 * ==========================================================================*/
import { readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const token = argOf('--token', process.env.HF_TOKEN);
const owner = argOf('--owner', 'gen-rl-millz');
const name = argOf('--name', 'xyla-birthday');
const file = resolve(argOf('--file', 'dist/xyla-invite.html'));
const message = argOf('--message', 'Update the invitation');
if (!token) { console.error('need $HF_TOKEN (or --token) with repo.write'); process.exit(1); }

const repo = `${owner}/${name}`;
const liveURL = `https://${owner}-${name}.static.hf.space`;
const api = (p, init) => fetch(`https://huggingface.co${p}`, {
  ...init,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers || {}) },
});

/* The README's YAML frontmatter is not documentation — it is the Space's
   configuration, and `sdk: static` is what makes HF serve the files directly
   instead of trying to run something. Rewritten on every publish so the repo
   cannot drift into a state where the page stops being served. */
const README = `---
title: Xyla's 3rd Birthday
emoji: 🍋
colorFrom: yellow
colorTo: pink
sdk: static
app_file: index.html
pinned: false
---

An animated storybook birthday invitation.

Everything is in \`index.html\` — one self-contained file, no external requests.
`;

/* ---- 1. make sure the Space exists ---- */
const who = await api('/api/whoami-v2').then((r) => r.json());
if (!who.name) { console.error('token rejected by Hugging Face'); process.exit(1); }
console.log(`authenticated as ${who.name}`);

const create = await api('/api/repos/create', {
  method: 'POST',
  body: JSON.stringify({ type: 'space', name, sdk: 'static', private: false }),
});
if (create.ok) {
  console.log(`created space ${repo}`);
} else {
  const t = await create.text();
  /* 409 means it is already there, which is the normal case on a re-publish. */
  if (create.status === 409) console.log(`space ${repo} already exists`);
  else { console.error(`create failed (${create.status}): ${t}`); process.exit(1); }
}

/* ---- 2. push the page ---- */
const dir = mkdtempSync(join(tmpdir(), 'hf-publish-'));
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
try {
  execFileSync('git', ['clone', '--quiet',
    `https://oauth2:${token}@huggingface.co/spaces/${repo}`, dir], { stdio: 'ignore' });

  copyFileSync(file, join(dir, 'index.html'));
  writeFileSync(join(dir, 'README.md'), README);

  git('add', '-A');
  if (!git('status', '--porcelain').trim()) {
    console.log('nothing changed — the live page already matches this build');
  } else {
    git('-c', 'user.email=publish@localhost', '-c', 'user.name=publish', 'commit', '-q', '-m', message);
    git('push', '-q', 'origin', 'HEAD:main');
    console.log(`pushed ${(readFileSync(file).length / 1024).toFixed(0)} KB to ${repo}`);
  }
} finally {
  /* The clone URL carries the token in .git/config, so this directory is a
     credential on disk. Remove it whether or not the push worked. */
  rmSync(dir, { recursive: true, force: true });
}

/* ---- 3. prove the URL serves the page, not just that the push returned ok ---- */
const local = readFileSync(file, 'utf8');
let served = null;
for (let i = 0; i < 10; i++) {
  const r = await fetch(`${liveURL}/index.html`, { cache: 'no-store' });
  if (r.ok) {
    const body = await r.text();
    if (body.length > 100_000) { served = body; break; }
  }
  await new Promise((s) => setTimeout(s, 6000));
}
if (!served) { console.error(`published, but ${liveURL} is not serving the page yet`); process.exit(1); }

/* HF injects one <script> tag with the Space's variables into every page it
   serves, so the served bytes are never identical to the local ones. Strip
   exactly that and compare the rest — a size check alone would pass on a
   stale upload. */
const strip = (s) => s.replace(/<script>window\.huggingface=.*?<\/script>/s, '');
const same = strip(served) === strip(local);
console.log(`served ${(served.length / 1024).toFixed(0)} KB — ${same ? 'identical to the local build' : 'DIFFERS FROM THE LOCAL BUILD'}`);
if (!same) process.exit(1);

console.log(`\n  ${liveURL}\n`);
