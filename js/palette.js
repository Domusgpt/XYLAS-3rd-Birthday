/* ============================================================================
 *  palette.js — "Lemonade Voyage"
 *  ---------------------------------------------------------------------------
 *  The colours come from a real photograph of Xyla at the beach: a lemon-print
 *  swimsuit (yellow, teal leaves, blush flowers, near-white lilac ground),
 *  pale sand, and bright sea sky. That is why the page feels like *her* and
 *  not like a generic party template.
 * ==========================================================================*/
(function (XY) {
  'use strict';

  var P = {
    lemon:     '#FFD84D',
    lemonDeep: '#F0A500',
    leaf:      '#0E7C7B',
    leafLight: '#28A8A0',
    blossom:   '#FF8FB1',
    blossomDeep:'#E8618A',
    lilac:     '#EDE7FB',
    sky:       '#7EC8E3',
    skyDeep:   '#4EA3C6',
    sand:      '#F6E3C5',
    deepsea:   '#14284B',
    ink:       '#2A1B4A',
    cream:     '#FFF8EE',
    grape:     '#8E6BD1',
    mint:      '#9BE8C8',
    coral:     '#FF9F6B',
  };

  /* Skins that always look good together and always look sweet. Each entry is
     [main, shadow, accent] and every one of them sits happily beside the
     lemon/teal/blush core above. */
  var SKINS = [
    ['#FFD84D', '#F0A500', '#FF8FB1'],   // lemon
    ['#FF8FB1', '#E8618A', '#FFD84D'],   // blossom
    ['#9BE8C8', '#4FC79B', '#FF8FB1'],   // mint
    ['#7EC8E3', '#4EA3C6', '#FFD84D'],   // sky
    ['#C9A7F5', '#8E6BD1', '#9BE8C8'],   // grape
    ['#FFB4A1', '#FF8B6B', '#7EC8E3'],   // coral
    ['#28A8A0', '#0E7C7B', '#FFD84D'],   // teal
    ['#FFE9A8', '#F5C24B', '#C9A7F5'],   // buttermilk
    ['#F7C6E0', '#E294C4', '#9BE8C8'],   // cotton candy
    ['#A8D8FF', '#6FAEE8', '#FFD84D'],   // periwinkle
  ];

  /* Sky gradients per act: [top, middle, bottom]. The shader lerps between
     these, so the world visibly travels from dawn beach to deep space and
     back into a party sunrise. */
  var ACT_SKY = {
    cover:   ['#FFE9A8', '#FFD1DC', '#7EC8E3'],
    sea:     ['#BDE7F5', '#7EC8E3', '#F6E3C5'],
    morph:   ['#FFD1DC', '#C9A7F5', '#7EC8E3'],
    clouds:  ['#EDE7FB', '#A8D8FF', '#FFE9A8'],
    fleet:   ['#5B4B9E', '#8E6BD1', '#FF8FB1'],
    planet:  ['#241B52', '#5B4B9E', '#FF8FB1'],
    invite:  ['#FFE9A8', '#FFD1DC', '#9BE8C8'],
    rsvp:    ['#FFD1DC', '#FFE9A8', '#7EC8E3'],
  };

  /* Pick a creature colourway from a seeded rng. */
  function skinFor(rand) {
    var s = rand.pick(SKINS);
    return { main: s[0], shadow: s[1], accent: s[2], ink: P.ink };
  }

  XY.P = P;
  XY.SKINS = SKINS;
  XY.ACT_SKY = ACT_SKY;
  XY.skinFor = skinFor;

})(window.XY = window.XY || {});
