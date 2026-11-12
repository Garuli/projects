/* Split It core: state, API calls, formatting, small UI helpers. Everything hangs off window.App. */
(function () {
  'use strict';
  var TOKEN_KEY = 'splitit_token';
  var App = window.App = {
    S: { token: null, user: null, friends: [], bills: [], summary: { owedToYouCents: 0, youOweCents: 0, openBills: 0 }, config: { aiScan: false }, draft: null },
    screens: {}
  };
  var S = App.S;

  App.$ = function (s, r) { return (r || document).querySelector(s); };
  App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  App.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var esc = App.esc;

  // ---------- icons ----------
  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .8 3.5 2.6 3.5 5.7"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3zM20 14v6h-6"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    logout: '<path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'
  };
  App.icon = function (n, size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  };

  // ---------- formatting ----------
  App.money = function (cents, cur) {
    cur = cur || 'ALL';
    var whole = Math.abs(cents) % 100 === 0;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, currencyDisplay: cur === 'ALL' ? 'code' : 'symbol', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100).replace(/ /g, ' ');
    } catch (e) { return (cents / 100).toFixed(2) + ' ' + cur; }
  };
  /** cents <-> text typed into a price field */
  App.centsToInput = function (c) { return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2); };
  App.inputToCents = function (t) { var v = window.Receipt.parseMoney(String(t || '')); return v == null ? 0 : v; };
  App.initials = function (n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '?'; };
  App.avatar = function (name, color, size, extra) {
    var s = size || 44;
    if (window.Avatar) { var face = window.Avatar.render(color, s, extra); if (face) return face; }
    return '<span class="av' + (extra ? ' ' + extra : '') + '" style="width:' + s + 'px;height:' + s + 'px;background:' + esc(color || '#D9DCE3') + ';font-size:' + Math.round(s * 0.36) + 'px">' + esc(App.initials(name)) + '</span>';
  };
  App.dateLabel = function (iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : String(iso).replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ---------- api ----------
  App.api = function (path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
      .catch(function () { throw new Error('Cannot reach the server. Check your connection.'); })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) {
          if (!res.ok) {
            if (res.status === 401 && path.indexOf('/api/auth/') !== 0) App.logout(true);
            throw new Error((json && json.error) || 'Something went wrong (' + res.status + ').');
          }
          return json;
        });
      });
  };

  // ---------- ui helpers ----------
  App.toast = function (msg, type) {
    var t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = msg;
    App.$('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  };
  App.sheet = function (html, opts) {
    var root = App.$('#sheet-root');
    root.innerHTML = '<div class="sheet-bg" data-action="close-sheet"><div class="sheet' + (opts && opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div></div>';
  };
  App.closeSheet = function () { App.$('#sheet-root').innerHTML = ''; };
  App.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      App.sheet('<h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p><div class="btn-row"><button class="btn ghost" data-c="0">Cancel</button><button class="btn ' + (danger ? 'danger' : 'dark') + '" data-c="1">' + esc(okLabel || 'OK') + '</button></div>');
      var root = App.$('#sheet-root');
      root.addEventListener('click', function h(e) {
        var b = e.target.closest('[data-c]');
        if (!b && !e.target.classList.contains('sheet-bg')) return;
        root.removeEventListener('click', h);
        App.closeSheet(); resolve(!!b && b.dataset.c === '1');
      });
    });
  };
  App.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    else { btn.disabled = false; btn.innerHTML = label || btn.dataset.l || 'Done'; }
  };
  App.copy = function (text) {
    var done = function () { App.toast('Copied'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { App.toast('Could not copy', 'error'); });
    else {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { App.toast('Could not copy', 'error'); }
      ta.remove();
    }
  };
  App.share = function (title, text, url) {
    if (navigator.share) return navigator.share({ title: title, text: text, url: url }).catch(function () {});
    App.copy(text + ' ' + url);
    return Promise.resolve();
  };
  App.qrSvg = function (text, px) {
    var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), cell = 4, out = '', i, j;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (qr.isDark(i, j)) out += '<rect x="' + (j * cell) + '" y="' + (i * cell) + '" width="' + cell + '" height="' + cell + '"/>';
    var size = n * cell;
    return '<svg class="qr" width="' + (px || 180) + '" height="' + (px || 180) + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + size + '" height="' + size + '" fill="#fff"/><g fill="#1D1B2E">' + out + '</g></svg>';
  };
  App.go = function (hash) { if (location.hash === '#' + hash) App.route(); else location.hash = hash; };

  // ---------- session ----------
  App.saveToken = function (t) { S.token = t; try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* private mode */ } };
  App.loadToken = function () { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
  App.logout = function (expired) {
    S.token = null; S.user = null; S.friends = []; S.bills = []; S.draft = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    App.closeSheet();
    history.replaceState(null, '', location.pathname);
    App.route();
    if (expired === true) App.toast('Please log in again.', 'error');
  };
  App.refreshData = function () {
    return Promise.all([App.api('/api/friends'), App.api('/api/bills'), App.api('/api/summary')]).then(function (r) {
      S.friends = r[0]; S.bills = r[1]; S.summary = r[2];
    });
  };
})();
