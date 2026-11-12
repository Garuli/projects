'use strict';
/**
 * Customizable avatars: a soft gradient ball with a hand-drawn face and a hair doodle.
 * An avatar is stored as a short code, "av:P.E.M.H" (palette, eyes, mouth, hair), for example "av:3.0.2.4".
 * This file works in Node (to validate and randomise) and in the browser (to draw), like split.js.
 * Everything is drawn with CSS gradients and a tiny inline SVG, so there are no image files.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Avatar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // [base, blob 1, blob 2, blob 3]
  var PALETTES = [
    ['#FF7A59', '#FF4E6A', '#FFC15A', '#B6E36B'], // sunset
    ['#FF8F8F', '#FF5E62', '#FFD1C9', '#FFE9A8'], // coral
    ['#8E8CFF', '#6C6CF5', '#79E0C9', '#C8B8FF'], // violet
    ['#9FDDF7', '#5DA9FF', '#E6F6FF', '#6FE0D0'], // sky
    ['#B79CFF', '#7C9BFF', '#58D6E0', '#E0C8FF'], // lilac
    ['#FF9F43', '#FF5F52', '#FFD76A', '#FF8FB1'], // orange
    ['#FFE066', '#B7A4FF', '#FFC8A2', '#FFF3B0'], // lemon
    ['#7BE0A6', '#2EC4A0', '#9BD6FF', '#D7F7B2'], // mint
    ['#FF8AD8', '#E65CFF', '#FFC4F0', '#FFA1B5'], // pink
    ['#7FD6D1', '#42B7C8', '#B8F0E8', '#9EC5FF'], // teal
    ['#FFB38A', '#FF8A8A', '#FFE0B8', '#D9A7FF'], // peach
    ['#6FA8FF', '#4F6BFF', '#9EE3FF', '#C0A7FF']  // blue
  ];
  var INK = '#1D1B2E';

  function dot(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '" stroke="none"/>'; }
  function line(d, fill) { return '<path d="' + d + '"' + (fill ? ' fill="' + fill + '"' : '') + '/>'; }

  var EYES = [
    function () { return dot(38, 52, 2.8) + dot(62, 52, 2.8); },                                        // dots
    function () { return dot(33, 52, 3.6) + dot(67, 52, 3.6); },                                        // wide set
    function () { return dot(38, 52, 2.8) + line('M56 53 q6 -7 12 0'); },                               // wink
    function () { return line('M31 54 q7 -9 14 0') + line('M55 54 q7 -9 14 0'); },                      // happy
    function () { return line('M32 52 h12') + line('M56 52 h12'); },                                    // sleepy
    function () { return '<ellipse cx="38" cy="51" rx="2.6" ry="4.6" fill="' + INK + '" stroke="none"/><ellipse cx="62" cy="51" rx="2.6" ry="4.6" fill="' + INK + '" stroke="none"/>'; } // tall
  ];
  var MOUTHS = [
    function () { return line('M40 66 q10 9 20 0'); },                                                  // smile
    function () { return line('M37 63 h26 a13 12 0 0 1 -26 0z', INK); },                                // big grin
    function () { return line('M40 64 q10 8 20 0') + line('M46 68 v4 a4 4 0 0 0 8 0 v-4', '#FF7A8A'); },// tongue
    function () { return line('M41 68 q11 6 20 -5'); },                                                 // smirk
    function () { return '<ellipse cx="50" cy="68" rx="4.4" ry="5.4"/>'; },                             // oh
    function () { return line('M43 68 h14'); }                                                          // flat
  ];
  var HAIR = [
    function () { return ''; },                                                                         // none
    function () { return line('M28 22 q8 -16 19 -6 q5 -12 17 -3 q9 -2 10 8'); },                        // wave
    function () { return line('M27 24 l6 -13 l7 11 l9 -15 l7 15 l8 -11 l4 11'); },                      // spikes
    function () { return line('M24 28 q26 -30 52 -4'); },                                               // swoop
    function () { return line('M28 20 a6 6 0 0 1 12 -3 a6 6 0 0 1 12 -3 a6 6 0 0 1 12 3 a6 6 0 0 1 9 7'); }, // curls
    function () { return line('M42 15 q2 -11 9 -3') + line('M54 14 q7 -9 12 3'); },                     // tufts
    function () { return line('M24 30 q26 -24 52 0') + line('M36 24 l-3 8') + line('M50 19 v11') + line('M64 24 l3 8'); } // bangs
  ];
  var COUNTS = { palette: PALETTES.length, eyes: EYES.length, mouth: MOUTHS.length, hair: HAIR.length };

  var RE = /^av:(\d{1,2})\.(\d)\.(\d)\.(\d)$/;
  function parse(code) {
    var m = RE.exec(String(code || ''));
    if (!m) return null;
    var a = { p: +m[1], e: +m[2], m: +m[3], h: +m[4] };
    if (a.p >= COUNTS.palette || a.e >= COUNTS.eyes || a.m >= COUNTS.mouth || a.h >= COUNTS.hair) return null;
    return a;
  }
  function isCode(code) { return parse(code) !== null; }
  function build(a) { return 'av:' + a.p + '.' + a.e + '.' + a.m + '.' + a.h; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function random() { return build({ p: rnd(COUNTS.palette), e: rnd(COUNTS.eyes), m: rnd(COUNTS.mouth), h: rnd(COUNTS.hair) }); }

  function background(p) {
    var c = PALETTES[p];
    return 'radial-gradient(circle at 16% 20%,' + c[1] + ' 0,transparent 58%),' +
      'radial-gradient(circle at 86% 30%,' + c[2] + ' 0,transparent 56%),' +
      'radial-gradient(circle at 48% 98%,' + c[3] + ' 0,transparent 62%),' + c[0];
  }
  function face(a) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">' +
      HAIR[a.h]() + EYES[a.e]() + MOUTHS[a.m]() + '</svg>';
  }
  /** HTML for one avatar. Returns '' if the code is not valid, so callers can fall back to initials. */
  function render(code, size, extra) {
    var a = typeof code === 'string' ? parse(code) : code;
    if (!a) return '';
    var s = size || 44;
    return '<span class="av face' + (extra ? ' ' + extra : '') + '" style="width:' + s + 'px;height:' + s + 'px;background:' + background(a.p) + '">' + face(a) + '</span>';
  }

  return { PALETTES: PALETTES, COUNTS: COUNTS, parse: parse, isCode: isCode, build: build, random: random, render: render };
});
