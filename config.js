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
    venue: '1044 West Bay Ave',          // street line, shown large
    address: 'Barnegat, NJ 08005',       // town line, shown smaller beneath
    bring: 'Swimsuit, towel, and your best pirate face',
    notes: 'Parking on 8th St',          // e.g. 'There will be cake'
    rsvpByDisplay: 'ASAP, please!',      // e.g. 'RSVP by August 21st'

    /* For the "Add to calendar" button. Leave both null and the button
       politely hides itself until you know the real date.
       Format: 'YYYY-MM-DDTHH:MM'  (local time, no timezone, no Z)          */
    startISO: '2026-08-28T15:00',
    /* Only used by the .ics. Late-August sunset in Barnegat is about 7:40pm,
       and the card promises "'til the sun goes down" — an 18:00 end put a
       party in everyone's calendar that finished two hours early. */
    endISO: '2026-08-28T19:30',
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
    to: 'Maryhennedy1@gmail.com',
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

  /* ---- Behaviour --------------------------------------------------------
   * audioButton   : show the music on/off button in the controls
   * musicAutoplay : start the music box as soon as the invitation is opened.
   *                 It can only ever start on that first tap — browsers will
   *                 not let a page make sound before you touch it — so this
   *                 rides the "Open the invitation" button. Set false and the
   *                 music waits for the ♪ button instead.
   * autoplay      : play the story automatically once opened
   * tiltEnabled   : let the phone's tilt drive the parallax (asks on iOS)   */
  FLAGS: {
    audioButton: true,
    musicAutoplay: true,
    autoplay: true,
    tiltEnabled: true,
    forceQuality: null,
  },
};
