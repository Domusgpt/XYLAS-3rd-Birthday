/* ============================================================================
 *  ✦  THE ONLY FILE YOU NEED TO EDIT  ✦
 *
 *  Change the lines below and the whole invitation updates itself.
 *  Every placeholder reads like "Date here" on purpose — you can share a draft
 *  right now and it will still look deliberate, not broken.
 * ==========================================================================*/
window.XY = window.XY || {};

window.XY.CONFIG = {

  /* ---- The birthday girl ----------------------------------------------- */
  CHILD: {
    name: 'Xyla',
    age: 3,
    title: 'Captain of the Lemon Sea',   // shown under the storybook title
  },

  /* ---- The party -------------------------------------------------------- */
  PARTY: {
    dateDisplay: 'Friday, August 28th',
    timeDisplay: '3:00pm ’til the sun goes down',
    venue: 'Place here',                 // e.g. 'The Big Backyard'
    address: 'Address here',             // e.g. '12 Lemon Grove Ln, Somewhere'
    bring: 'Swimsuit, towel, and your best pirate face',
    notes: 'Notes here',                 // e.g. 'There will be cake'
    rsvpByDisplay: 'RSVP by date here',  // e.g. 'RSVP by August 21st'

    /* For the "Add to calendar" button. Leave both null and the button
       politely hides itself until you know the real date.
       Format: 'YYYY-MM-DDTHH:MM'  (local time, no timezone, no Z)          */
    startISO: '2026-08-28T15:00',
    endISO: '2026-08-28T18:00',          // a guess, only used by the .ics file
  },

  /* ---- Photos -----------------------------------------------------------
   * Real photos of Xyla, background removed. Set either to '' and the page
   * falls back to the drawn cartoon version of her — nothing breaks.
   * Regenerate them with:  node tools/process-photos.mjs                    */
  PHOTOS: {
    hero: 'assets/xyla-hero.webp',           // she flies, with drawn wings
    medallion: 'assets/xyla-medallion.webp', // the portrait on the card
  },

  /* ---- RSVP: how replies reach Mom -------------------------------------- */
  RSVP: {
    /* REQUIRED — where RSVPs go. */
    to: 'mom@example.com',
    toName: 'Mom',
    subject: "RSVP: Xyla's 3rd Birthday",

    /* 'mailto'  → opens the guest's mail app pre-filled. Works instantly,
     *             no account, nothing that can break before the party.
     * 'post'    → sends silently in the background; guest never leaves.
     *             Requires `endpoint` below.                                */
    mode: 'mailto',

    /* Only used when mode is 'post'. Free options, pick one:
     *   Formspree   https://formspree.io/f/xxxxxxxx
     *   FormSubmit  https://formsubmit.co/ajax/mom@example.com
     * If the send ever fails it falls back to mailto automatically.
     * NOTE: the single-file build always uses mailto, because the page is
     * sandboxed there and cannot reach outside servers.                     */
    endpoint: '',

    /* Optional "or just text us" line. Set to '' to hide. */
    phone: '',
  },

  /* ---- Look and feel ----------------------------------------------------
   * seed      : change this string to reroll the whole cast of creatures.
   *             Find a cast you love, then keep the seed forever.
   * castSize  : how many creatures live on the stage (auto-reduced on phones)
   * fleetSize : how many UFOs
   * audioOn   : music ALWAYS starts off; this only decides if the button shows
   * quality   : null = detect automatically. Or force 'low' | 'med' | 'high'  */
  THEME: {
    seed: 'xyla-3',
    castSize: 9,
    fleetSize: 5,
  },

  FLAGS: {
    audioButton: true,
    tiltEnabled: true,
    secretPartyMode: true,
    forceQuality: null,
  },
};
