# Captain Xyla and the Lemon Sea

An animated storybook invitation to Xyla's 3rd birthday party.

Butterfly-pirates, robo-dinos and dino-butterflies sail the Lemon Sea, morph into
each other mid-flight, get abducted by a fleet of flying saucers, and finally
deliver the party details. Every creature, saucer, wave and cloud is **generated
in code** — there is not a single image file in this repository.

---

## The only thing you need to edit

Open **`config.js`**. Everything is in there, at the top, in plain language:

```js
PARTY: {
  dateDisplay: 'Date here',        // 'Saturday, September 13th'
  timeDisplay: 'Time here',        // '11:00am – 2:00pm'
  venue:       'Place here',
  address:     'Address here',
  ...
},
RSVP: {
  to: 'mom@example.com',           // ← where replies go
}
```

Anything you leave as `"... here"` shows up on the card as a deliberate-looking
blank rather than something broken, so you can share a draft today.

### Making the RSVP work

Two modes, set by `RSVP.mode` in `config.js`:

| Mode | What happens | Setup |
|---|---|---|
| `'mailto'` *(default)* | The guest taps RSVP, their mail app opens pre-filled, they press send. | None. Works everywhere, offline, forever. |
| `'post'` | The RSVP is sent silently in the background; the guest never leaves the page. | Free [Formspree](https://formspree.io) or [FormSubmit](https://formsubmit.co) account — paste the URL into `RSVP.endpoint`. |

`'post'` automatically falls back to `mailto` if the send ever fails, so an RSVP
can't be lost to a third-party outage. The single-file build always uses
`mailto`, because that file is meant to run sandboxed where it can't reach an
outside server.

### Add-to-calendar

Fill in `PARTY.startISO` (e.g. `'2026-09-13T11:00'`) and an "Add to calendar"
button appears by itself. Leave it `null` and the button stays hidden.

### Changing the cast

`THEME.seed` is the seed for every creature on the page. Change the string,
reload, and you get an entirely different crew. Find one you love and keep it —
the same seed always produces the same creatures.

You can also try seeds without editing anything: `index.html?seed=whatever`.

---

## Publishing it

```bash
./deploy/gcs-deploy.sh your-bucket-name
```

That builds, creates the bucket if needed, sets `index.html` as the site root,
makes it public, and uploads with sensible cache headers. Re-run it any time you
change the details. You need `gcloud` installed and logged in.

There is also a **single self-contained file** at `dist/xyla-invite.html`
(~240 KB) with the fonts, styles, scripts and GSAP all inlined and zero external
requests. Email it, drop it on any host, or open it straight off a USB stick — it
works offline and forever. Rebuild it with `node tools/build.js`.

---

## Working on it

```bash
node tools/build.js      # rebuild dist/xyla-invite.html
node tools/verify.mjs    # screenshot every act on phone + desktop, fail on any console error
```

`verify.mjs` drives the local Chromium over the DevTools Protocol with **no npm
dependencies at all** — this repo has no `package.json` and never needs one. It
also asserts there is no horizontal overflow at 390px, which is the bug class
that actually ruins invitations on phones.

Handy URL switches while developing:

| Switch | Effect |
|---|---|
| `?seek=38` | Jump to that second of the story and freeze. How the screenshots are made. |
| `?auto=1` | Skip the opening tap-to-begin gate. |
| `?seed=foo` | Reroll the cast. |
| `?q=low` | Force the low quality tier. |
| `?nogl=1` | Force the no-WebGL fallback sky. |
| `?calm=1` | Force the reduced-motion path. |
| `lab.html` | Contact sheet of generated creatures. |
| `morphlab.html` | Morph intermediates, frozen at 0 / 25 / 50 / 75 / 100%. |

### How it is put together

```
config.js         every party variable
js/core.js        seeded PRNG + the path kit everything is drawn with
js/creature.js    the generative cast, and the morph engine
js/hero.js        Captain Xyla
js/ufo.js         saucers and tractor beams
js/sky.js         the WebGL candy sky
js/story.js       the stage and the 47-second master timeline
js/invite.js      the card, the RSVP, the .ics file
js/main.js        boot and wiring — the single rAF loop
```

Two ideas carry the whole thing:

1. **Fixed slot roster.** Every creature has every body part, always, in the same
   order — a creature with no tail still has a `tail` slot, collapsed to a dot.
   That is why any creature can morph into any other with no special cases.
2. **Staging on the timeline, life off it.** The master timeline holds only
   entrances and reveals. Breathing, blinking, wing flaps and beacon pulses run
   on their own infinite loops. That keeps the timeline seekable *and* keeps the
   world alive after the story ends.

### House rules

- **No image files, ever.** Everything is generated from numbers.
- **No SVG blur filters.** Glow is stacked translucent shapes. Blur filters are
  the single worst source of jank on phones.
- **Nothing flickers faster than ~3Hz.** A page this bright will be looked at by
  small children; photosensitivity is not negotiable.
- **Original art only.** Every shape is parametric. No traced silhouettes and no
  reference to any existing character, from any franchise.
- **16px minimum on form inputs**, or iOS Safari zooms on focus and wrecks the
  layout.

### Accessibility

`prefers-reduced-motion` takes a completely different path: no autoplay, no
ambient loops, and the invitation is on screen immediately. The **☾ calm button**
does the same thing on demand. The animated stage is `aria-hidden` throughout, so
a screen reader gets a clean document — heading, details list, form. There is a
skip link, full keyboard access, and the **Details & RSVP** button is on screen
from the first second, so nobody has to sit through a 47-second film to find out
when the party is.

---

### About Captain Xyla

The hero character is a stylised cartoon built from three cues in a photo her dad
shared — a mane of curls, enormous round sunglasses, and a lemon-print dress. It
is deliberately not a likeness, and the photo itself is not in this repository
and was never uploaded anywhere. The whole colour palette comes from that
swimsuit: lemon yellow, teal leaves, blush pink, and a near-white lilac.

### Credits

Animation by [GSAP](https://gsap.com) 3.13, vendored into `vendor/gsap/` under
its standard no-charge licence. Everything else is original and generated.
