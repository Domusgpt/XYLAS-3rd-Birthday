/* ============================================================================
 *  invite.js — the invitation card, the RSVP, and the calendar file
 *  ---------------------------------------------------------------------------
 *  Everything above this file is spectacle. This file is the actual job: tell
 *  people when and where the party is, and get a reply back to Mom.
 *
 *  So it is built to different standards than the rest of the page:
 *   - Real semantic HTML. Selectable, zoomable, screen-reader friendly.
 *   - Never text over the shader. The card is a near-opaque light surface.
 *   - 16px minimum on inputs, because below that iOS Safari zooms on focus and
 *     wrecks the layout.
 *   - The RSVP has two delivery paths and always has a working fallback.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var C = XY.CONFIG;

  /* Placeholders read like "Date here". Detect them so we can style them as
     deliberately unfilled rather than looking like a bug. */
  function isPlaceholder(v) {
    return !v || /\bhere\b/i.test(String(v));
  }

  function fieldRow(label, value, extraClass) {
    if (!value) return '';
    var ph = isPlaceholder(value) ? ' is-placeholder' : '';
    return '<div class="row' + (extraClass ? ' ' + extraClass : '') + ph + '">' +
             '<dt>' + XY.esc(label) + '</dt>' +
             '<dd>' + value + '</dd>' +
           '</div>';
  }

  function renderInvite(el) {
    var p = C.PARTY, child = C.CHILD;
    var when = XY.esc(p.dateDisplay) +
      (p.timeDisplay ? '<span class="dot">·</span>' + XY.esc(p.timeDisplay) : '');
    var where = XY.esc(p.venue) +
      (p.address ? '<span class="sub">' + XY.esc(p.address) + '</span>' : '');

    el.innerHTML =
      '<div class="card-deco" aria-hidden="true"></div>' +
      '<p class="eyebrow">You are invited to</p>' +
      '<h1 class="title">' + XY.esc(child.name) + '’s <em>' + child.age + 'rd</em> Birthday</h1>' +
      '<p class="lede">A butterfly-pirate-robot-dinosaur party, somewhere past the Lemon Sea.</p>' +
      '<dl class="details">' +
        fieldRow('When', when, 'row-when') +
        fieldRow('Where', where, 'row-where') +
        fieldRow('Bring', XY.esc(p.bring)) +
        fieldRow('Note', XY.esc(p.notes)) +
        fieldRow('RSVP', XY.esc(p.rsvpByDisplay)) +
      '</dl>' +
      '<div class="card-actions">' +
        '<button type="button" class="btn btn-primary" data-act="rsvp">RSVP to the party</button>' +
        '<button type="button" class="btn btn-ghost" data-act="copy">Copy address</button>' +
        '<button type="button" class="btn btn-ghost" data-act="ics" hidden>Add to calendar</button>' +
      '</div>' +
      '<p class="status" role="status" aria-live="polite"></p>';

    /* the calendar button only exists once there is a real date to add */
    if (p.startISO) el.querySelector('[data-act="ics"]').hidden = false;
    return el;
  }

  /* ======================================================================
   *  RSVP form
   * ==================================================================== */
  function renderForm(el) {
    var to = C.RSVP.toName || 'us';
    el.innerHTML =
      '<h2 class="rsvp-title">Are you coming?</h2>' +
      '<p class="rsvp-sub">Replies go straight to ' + XY.esc(to) + '.</p>' +
      '<form novalidate autocomplete="on">' +
        '<div class="field">' +
          '<label for="rsvp-name">Your name</label>' +
          '<input id="rsvp-name" name="name" type="text" maxlength="60" required ' +
            'autocomplete="name" aria-describedby="err-name">' +
          '<span class="err" id="err-name"></span>' +
        '</div>' +
        '<div class="field-pair">' +
          '<div class="field">' +
            '<label for="rsvp-kids">Kids</label>' +
            '<input id="rsvp-kids" name="kids" type="number" inputmode="numeric" ' +
              'min="0" max="20" step="1" value="1" aria-describedby="err-kids">' +
            '<span class="err" id="err-kids"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rsvp-adults">Grown-ups</label>' +
            '<input id="rsvp-adults" name="adults" type="number" inputmode="numeric" ' +
              'min="0" max="20" step="1" value="1" aria-describedby="err-adults">' +
            '<span class="err" id="err-adults"></span>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="rsvp-note">Anything we should know? <span class="opt">(optional)</span></label>' +
          '<textarea id="rsvp-note" name="note" rows="3" maxlength="500" ' +
            'placeholder="Allergies, nap times, a joke…"></textarea>' +
        '</div>' +
        /* honeypot: real people never fill this in */
        '<div class="hp" aria-hidden="true">' +
          '<label for="rsvp-website">Website</label>' +
          '<input id="rsvp-website" name="website" type="text" tabindex="-1" autocomplete="off">' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-big">Send our RSVP</button>' +
        '<p class="rsvp-status" role="status" aria-live="polite"></p>' +
      '</form>' +
      (C.RSVP.phone ? '<p class="rsvp-alt">Or just text us: <a href="tel:' +
        XY.esc(C.RSVP.phone.replace(/[^\d+]/g, '')) + '">' + XY.esc(C.RSVP.phone) + '</a></p>' : '');
    return el;
  }

  function validate(form) {
    var errs = {};
    var name = form.name.value.trim();
    if (!name) errs.name = 'We need a name so we know who is coming.';
    else if (name.length > 60) errs.name = 'That name is a bit too long.';

    ['kids', 'adults'].forEach(function (k) {
      var raw = form[k].value.trim();
      if (raw === '') return;                    // blank is fine, treated as 0
      var n = Number(raw);
      if (!isFinite(n) || n < 0 || n > 20 || Math.floor(n) !== n) {
        errs[k] = 'Please use a whole number from 0 to 20.';
      }
    });
    return errs;
  }

  function showErrors(form, errs) {
    ['name', 'kids', 'adults'].forEach(function (k) {
      var input = form[k];
      var out = form.querySelector('#err-' + k);
      if (!input || !out) return;
      if (errs[k]) {
        out.textContent = errs[k];
        input.setAttribute('aria-invalid', 'true');
        input.closest('.field').classList.add('has-error');
      } else {
        out.textContent = '';
        input.removeAttribute('aria-invalid');
        input.closest('.field').classList.remove('has-error');
      }
    });
  }

  function composeBody(data) {
    var p = C.PARTY;
    return [
      data.name + ' is coming to ' + C.CHILD.name + "'s birthday!",
      '',
      'Kids:      ' + data.kids,
      'Grown-ups: ' + data.adults,
      data.note ? ('Note:      ' + data.note) : '',
      '',
      '--',
      'Party: ' + p.dateDisplay + ' · ' + p.timeDisplay,
      'At:    ' + p.venue + (p.address ? ', ' + p.address : ''),
    ].filter(function (l) { return l !== ''; }).join('\n');
  }

  function mailtoURL(data) {
    return 'mailto:' + encodeURIComponent(C.RSVP.to) +
      '?subject=' + encodeURIComponent(C.RSVP.subject) +
      '&body=' + encodeURIComponent(composeBody(data));
  }

  /* ======================================================================
   *  .ics — built by hand, no library. CRLF line endings are required by the
   *  spec and some clients genuinely reject files without them.
   * ==================================================================== */
  function icsStamp(iso) {
    /* 'YYYY-MM-DDTHH:MM' -> 'YYYYMMDDTHHMMSS', deliberately floating local
       time with no Z, which is what you want for a party. */
    return String(iso).replace(/[-:]/g, '').replace(/(T\d{4})$/, '$100');
  }

  function fold(line) {
    /* iCalendar lines must be folded at 75 octets. */
    var out = [], s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s);
    return out.join('\r\n');
  }

  function buildICS() {
    var p = C.PARTY;
    if (!p.startISO) return null;
    var esc = function (s) {
      return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    };
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Xyla Birthday//EN',
      'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + XY.hashSeed(C.THEME.seed + p.startISO) + '@xyla-birthday',
      'DTSTAMP:' + icsStamp(p.startISO),
      'DTSTART:' + icsStamp(p.startISO),
      p.endISO ? 'DTEND:' + icsStamp(p.endISO) : '',
      fold('SUMMARY:' + esc(C.CHILD.name + "'s " + C.CHILD.age + 'rd Birthday')),
      fold('LOCATION:' + esc([p.venue, p.address].filter(Boolean).join(', '))),
      fold('DESCRIPTION:' + esc([p.bring, p.notes].filter(function (x) {
        return x && !isPlaceholder(x);
      }).join(' · '))),
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean);
    return lines.join('\r\n');
  }

  function downloadICS() {
    var text = buildICS();
    if (!text) return false;
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (C.CHILD.name || 'party').toLowerCase() + '-birthday.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return true;
  }

  /* ======================================================================
   *  Submission
   * ==================================================================== */
  function submit(form, onSuccess, onFallback) {
    var data = {
      name: form.name.value.trim(),
      kids: form.kids.value.trim() || '0',
      adults: form.adults.value.trim() || '0',
      note: form.note.value.trim(),
    };
    if (form.website && form.website.value) return;    // honeypot tripped

    /* The single-file build is sandboxed and cannot reach outside hosts, so a
       POST endpoint would fail silently in exactly the place this page is most
       likely to be shared from. Force mailto there. */
    var mode = C.RSVP.mode;
    if (window.XY_STANDALONE || !C.RSVP.endpoint) mode = 'mailto';

    if (mode === 'post') {
      var fd = new FormData();
      Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
      fd.append('_subject', C.RSVP.subject);
      return fetch(C.RSVP.endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: fd })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status ' + r.status);
          onSuccess(data);
        })
        .catch(function () {
          /* never lose an RSVP to a flaky third party */
          window.location.href = mailtoURL(data);
          onFallback(data);
        });
    }

    window.location.href = mailtoURL(data);
    /* mailto: can silently do nothing on some devices, so this reports
       optimistically and always offers the address as a fallback. */
    onFallback(data);
    return Promise.resolve();
  }

  XY.Invite = {
    renderInvite: renderInvite,
    renderForm: renderForm,
    validate: validate,
    showErrors: showErrors,
    submit: submit,
    mailtoURL: mailtoURL,
    composeBody: composeBody,
    buildICS: buildICS,
    downloadICS: downloadICS,
    isPlaceholder: isPlaceholder,
  };

})(window.XY = window.XY || {});
