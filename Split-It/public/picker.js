/* Avatar picker: a bottom sheet to build your avatar (colour, eyes, mouth, hair). */
(function () {
  'use strict';
  var App = window.App, A = window.Avatar, P = { a: null, onSave: null };
  var ROWS = [['p', 'Colour', 'palette'], ['e', 'Eyes', 'eyes'], ['m', 'Mouth', 'mouth'], ['h', 'Hair', 'hair']];

  function body() {
    var a = P.a;
    var html = '<div class="avp-top">' + A.render(a, 104) + '<button type="button" class="btn ghost" data-action="av-shuffle">Shuffle</button></div>';
    ROWS.forEach(function (r) {
      html += '<div class="avp-row"><b>' + r[1] + '</b><div class="avp-opts">';
      for (var i = 0; i < A.COUNTS[r[2]]; i++) {
        var t = { p: a.p, e: a.e, m: a.m, h: a.h }; t[r[0]] = i;
        html += '<button type="button" class="avp-opt' + (a[r[0]] === i ? ' sel' : '') + '" data-action="av-pick" data-part="' + r[0] + '" data-v="' + i + '" aria-label="' + r[1] + ' ' + (i + 1) + '">' + A.render(t, 46) + '</button>';
      }
      html += '</div></div>';
    });
    return html;
  }
  function refresh() { var el = document.getElementById('avp'); if (el) el.innerHTML = body(); }

  /** Open the picker. onSave(code) is called with the new avatar code when the person taps Save. */
  App.avatarPicker = function (current, onSave) {
    P.a = A.parse(current) || A.parse(A.random()); P.onSave = onSave;
    App.sheet('<h2>Your avatar</h2><p class="muted">Pick a colour, a face and some hair.</p><div id="avp">' + body() + '</div>' +
      '<div class="btn-row"><button type="button" class="btn ghost" data-action="close-sheet-btn">Cancel</button><button type="button" class="btn dark" data-action="av-save">Save</button></div>');
  };
  App.avpPick = function (part, v) { P.a[part] = +v; refresh(); };
  App.avpShuffle = function () { P.a = A.parse(A.random()); refresh(); };
  App.avpSave = function () { var cb = P.onSave; if (cb) cb(A.build(P.a)); };
})();
