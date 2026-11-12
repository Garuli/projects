/* Split It screens: sign in, home, friends, bills, profile. */
(function () {
  'use strict';
  var App = window.App, S = App.S, esc = App.esc, icon = App.icon, money = App.money;
  var pendingLink = null;   // /join/CODE or /add/CODE opened before logging in

  function tabbar(active) {
    var t = function (id, label, ic, href) {
      return '<a href="#' + href + '" class="' + (active === id ? 'on' : '') + '" aria-label="' + label + '">' + icon(ic, 24) + '<span>' + label + '</span></a>';
    };
    return '<nav class="tabbar">' + t('home', 'Home', 'home', '/') + t('friends', 'Friends', 'users', '/friends') +
      '<button class="fab" data-action="new-bill" aria-label="New bill">' + icon('scan', 26) + '</button>' +
      t('bills', 'Bills', 'list', '/bills') + t('profile', 'Profile', 'user', '/profile') + '</nav>';
  }
  function sidebar(active) {
    var n = function (id, label, ic, href) { return '<a href="#' + href + '" class="' + (active === id ? 'on' : '') + '">' + icon(ic, 22) + '<span>' + label + '</span></a>'; };
    var u = S.user;
    return '<aside class="side"><div class="brand"><span class="logo">' + icon('receipt', 22) + '</span> Split It</div>' +
      '<button class="btn dark wide" data-action="new-bill">' + icon('plus', 20) + ' New bill</button>' +
      '<nav>' + n('home', 'Home', 'home', '/') + n('friends', 'Friends', 'users', '/friends') + n('bills', 'Bills', 'list', '/bills') + n('profile', 'Profile', 'user', '/profile') + '</nav>' +
      '<a class="side-user" href="#/profile">' + App.avatar(u.name, u.color, 40) + '<span><b>' + esc(u.name) + '</b><small>' + esc(u.shareCode) + '</small></span></a></aside>';
  }
  App.shell = function (active, inner) {
    App.$('#root').innerHTML = '<div class="app">' + sidebar(active) + '<main class="main"><div class="page">' + inner + '</div></main>' + tabbar(active) + '</div>';
  };

  // ---------- sign in ----------
  App.screens.auth = function (tab) {
    tab = tab || 'login';
    var banner = pendingLink ? '<div class="note">' + (pendingLink.type === 'join' ? 'Sign in to join the bill.' : 'Sign in to add your friend.') + '</div>' : '';
    App.$('#root').innerHTML =
      '<div class="auth"><div class="auth-card"><div class="auth-ill">' + icon('receipt', 40) + '</div><div class="brand center">Split It</div>' +
      '<h1>' + (tab === 'login' ? 'Welcome back' : 'Create your account') + '</h1><p class="muted">Split any bill in seconds. Scan the receipt, pick your friends, done.</p>' + banner +
      '<div class="seg"><button class="' + (tab === 'login' ? 'on' : '') + '" data-action="auth-tab" data-tab="login">Sign in</button><button class="' + (tab === 'register' ? 'on' : '') + '" data-action="auth-tab" data-tab="register">Sign up</button></div>' +
      '<form data-form="' + tab + '" novalidate>' +
      (tab === 'register' ? '<div class="reg-av"><span id="reg-av">' + App.avatar('', App.regAvatar(), 64) + '</span><div><b>Your avatar</b><div class="btn-row tight"><button type="button" class="btn ghost small" data-action="reg-av-shuffle">Shuffle</button><button type="button" class="btn ghost small" data-action="reg-av-edit">Customise</button></div></div></div>' : '') +
      (tab === 'register' ? '<label class="fld"><span>Your name</span><input id="f-name" autocomplete="name" maxlength="40" placeholder="Alex"></label>' : '') +
      '<label class="fld"><span>Email</span><input id="f-email" type="email" autocomplete="username" placeholder="alex@example.com"></label>' +
      '<label class="fld"><span>Password</span><input id="f-pass" type="password" autocomplete="' + (tab === 'login' ? 'current-password' : 'new-password') + '" placeholder="6 or more characters"></label>' +
      (tab === 'register' ? '<label class="fld"><span>Phone (optional, so friends can find you)</span><input id="f-phone" type="tel" autocomplete="tel" placeholder="+355 69 123 4567"></label>' : '') +
      '<div class="err" id="auth-err" role="alert"></div><button class="btn dark wide" type="submit">' + (tab === 'login' ? 'Sign in' : 'Create account') + '</button></form>' +
      (tab === 'login' ? '<div class="demo">Try the demo: <b>alex@example.com</b> / <b>alex123</b> <button type="button" data-action="fill-demo">Fill in</button></div>' : '') +
      '</div></div>';
  };
  var regAv = null;
  App.regAvatar = function () { if (!regAv) regAv = window.Avatar.random(); return regAv; };
  App.setRegAvatar = function (code) { regAv = code; var el = document.getElementById('reg-av'); if (el) el.innerHTML = App.avatar('', code, 64); };
  App.setPending = function (p) { pendingLink = p; };
  App.takePending = function () { var p = pendingLink; pendingLink = null; return p; };

  // ---------- home ----------
  function billCard(b) {
    var pct = b.payerCount ? Math.round(100 * b.paidCount / b.payerCount) : 0;
    var status = b.status === 'settled' ? '<span class="pill ok">Settled</span>'
      : b.isOwner ? '<span class="pill warn">' + (b.owedToMeCents ? money(b.owedToMeCents, b.currency) + ' to collect' : 'Open') + '</span>'
      : (b.iPaid ? '<span class="pill ok">You paid</span>' : '<span class="pill due">You owe ' + money(b.myShareCents, b.currency) + '</span>');
    return '<a class="bill" href="#/bill/' + b.id + '"><div class="bill-top"><div class="stack">' +
      b.people.map(function (p) { return App.avatar(p.name, p.color, 34, 'ring'); }).join('') + '</div>' + status + '</div>' +
      '<b class="bill-title">' + esc(b.title) + '</b><div class="muted small">' + money(b.totalCents, b.currency) + ' · ' + b.peopleCount + ' people' + (b.dueDate ? ' · due ' + esc(App.dateLabel(b.dueDate)) : '') + '</div>' +
      (b.payerCount ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</a>';
  }
  App.billCard = billCard;

  App.screens.home = function () {
    var sum = S.summary, open = S.bills.filter(function (b) { return b.status === 'open'; });
    var friends = S.friends.map(function (f) {
      return '<button class="friend" data-action="bill-with" data-id="' + f.id + '">' + App.avatar(f.name, f.color, 56) + '<b>' + esc(f.name.split(' ')[0]) + '</b><span class="add">' + icon('plus', 14) + '</span></button>';
    }).join('');
    App.shell('home',
      '<header class="top"><div><small class="muted">Hi ' + esc(S.user.name.split(' ')[0]) + '</small><h1>Your bills</h1></div><a href="#/profile" aria-label="Profile">' + App.avatar(S.user.name, S.user.color, 44) + '</a></header>' +
      '<section class="hero"><div class="hero-in"><small>Owed to you</small><div class="hero-amt">' + money(sum.owedToYouCents) + '</div>' +
      '<div class="hero-sub"><span>You owe <b>' + money(sum.youOweCents) + '</b></span><span>' + sum.openBills + ' open</span></div>' +
      '<div class="hero-row"><div class="stack">' + S.friends.slice(0, 4).map(function (f) { return App.avatar(f.name, f.color, 34, 'ring'); }).join('') + (S.friends.length > 4 ? '<span class="more">+' + (S.friends.length - 4) + '</span>' : '') + '</div>' +
      '<button class="btn dark" data-action="new-bill">Split now</button></div></div></section>' +
      '<section><div class="sec-head"><h2>Friends</h2><a href="#/friends" class="link">See all</a></div><div class="hscroll">' +
      '<button class="friend" data-action="goto" data-to="/friends"><span class="av plain" style="width:56px;height:56px">' + icon('plus', 22) + '</span><b>Add</b><span class="add" style="visibility:hidden">+</span></button>' + friends + '</div></section>' +
      '<section><div class="sec-head"><h2>Who is sharing the bill</h2><a href="#/bills" class="link">See all</a></div>' +
      (open.length ? '<div class="bill-grid">' + open.slice(0, 6).map(billCard).join('') + '</div>' :
        '<div class="empty">' + icon('receipt', 34) + '<b>No open bills</b><span class="muted">Tap the scan button to split your first one.</span></div>') + '</section>' +
      '<section class="join"><div class="sec-head"><h2>Got a bill code?</h2></div><form class="inline" data-form="join"><input id="join-code" maxlength="8" autocapitalize="characters" placeholder="e.g. K7M2QX"><button class="btn dark" type="submit">Join</button></form></section>');
  };

  // ---------- bills ----------
  App.screens.bills = function (tab) {
    tab = tab || 'open';
    var list = S.bills.filter(function (b) { return b.status === tab; });
    App.shell('bills',
      '<header class="top"><div><h1>Bills</h1></div></header><div class="seg"><button class="' + (tab === 'open' ? 'on' : '') + '" data-action="bills-tab" data-tab="open">Open</button><button class="' + (tab === 'settled' ? 'on' : '') + '" data-action="bills-tab" data-tab="settled">Settled</button></div>' +
      (list.length ? '<div class="bill-grid">' + list.map(billCard).join('') + '</div>' : '<div class="empty">' + icon('list', 34) + '<b>Nothing here yet</b></div>'));
  };

  // ---------- friends ----------
  function addLink(code) { return location.origin + '/#/add/' + code; }
  App.screens.friends = function () {
    var contactsOk = !!(navigator.contacts && navigator.contacts.select && window.isSecureContext);
    var list = S.friends.map(function (f) {
      return '<div class="row">' + App.avatar(f.name, f.color, 46) + '<div class="grow"><b>' + esc(f.name) + '</b><div class="muted small">' + esc(f.shareCode) + '</div></div>' +
        '<button class="icon-btn" data-action="bill-with" data-id="' + f.id + '" aria-label="Split a bill with ' + esc(f.name) + '">' + icon('receipt', 20) + '</button>' +
        '<button class="icon-btn" data-action="remove-friend" data-id="' + f.id + '" aria-label="Remove ' + esc(f.name) + '">' + icon('trash', 18) + '</button></div>';
    }).join('');
    App.shell('friends',
      '<header class="top"><div><h1>Friends</h1></div></header>' +
      '<div class="two"><section class="card code-card"><small class="muted">Your friend code</small><div class="code">' + esc(S.user.shareCode) + '</div>' +
      '<div class="qr-wrap">' + App.qrSvg(addLink(S.user.shareCode), 150) + '</div><p class="muted small">Friends type this code or scan the QR to add you. Works on every phone.</p>' +
      '<div class="btn-row"><button class="btn ghost" data-action="copy-code">' + icon('copy', 18) + ' Copy</button><button class="btn dark" data-action="share-code">' + icon('share', 18) + ' Share</button></div></section>' +
      '<section class="card"><h2>Add a friend</h2><form class="inline" data-form="add-friend"><input id="friend-code" maxlength="10" autocapitalize="characters" placeholder="SP-XXXX"><button class="btn dark" type="submit">Add</button></form>' +
      '<div class="divider"><span>or</span></div><button class="btn ghost wide" data-action="find-contacts"' + (contactsOk ? '' : ' data-unsupported="1"') + '>' + icon('book', 20) + ' Find friends from my contacts</button>' +
      '<p class="muted small">' + (contactsOk ? 'You pick the contacts to check. Numbers are compared privately and are not kept.' : 'Your browser does not let websites read contacts (iPhones never do). Use friend codes instead.') + '</p></section></div>' +
      '<section><div class="sec-head"><h2>Your friends (' + S.friends.length + ')</h2></div>' + (list ? '<div class="card list">' + list + '</div>' : '<div class="empty">' + icon('users', 34) + '<b>No friends yet</b><span class="muted">Share your code or enter theirs above.</span></div>') + '</section>');
  };

  App.findContacts = function () {
    if (!(navigator.contacts && navigator.contacts.select && window.isSecureContext)) {
      App.sheet('<h2>Contacts are not available here</h2><p class="muted">Websites can only read contacts on some Android phones, and only over a secure (https) connection. On iPhone, share your friend code instead.</p><button class="btn dark wide" data-action="close-sheet-btn">OK</button>');
      return;
    }
    navigator.contacts.select(['name', 'tel'], { multiple: true }).then(function (picked) {
      var nums = [];
      picked.forEach(function (c) { (c.tel || []).forEach(function (t) { nums.push(t); }); });
      if (!nums.length) { App.toast('No phone numbers in that selection.'); return; }
      return App.api('/api/friends/match', { method: 'POST', body: { numbers: nums } }).then(function (found) {
        if (!found.length) { App.sheet('<h2>No one found</h2><p class="muted">None of those contacts have joined Split It yet. Share your friend code with them.</p><button class="btn dark wide" data-action="close-sheet-btn">OK</button>'); return; }
        App.sheet('<h2>Friends on Split It</h2><p class="muted small">Only people who added their number are shown.</p><div class="list">' + found.map(function (f) {
          return '<div class="row">' + App.avatar(f.name, f.color, 44) + '<div class="grow"><b>' + esc(f.name) + '</b></div>' +
            (f.isFriend ? '<span class="pill ok">Added</span>' : '<button class="btn dark sm" data-action="add-by-code" data-code="' + esc(f.shareCode) + '">Add</button>') + '</div>';
        }).join('') + '</div>');
      });
    }).catch(function (e) { if (e && e.name !== 'AbortError' && e.message) App.toast(e.message, 'error'); });
  };

  // ---------- profile ----------
  App.screens.profile = function () {
    var u = S.user;
    App.shell('profile',
      '<header class="top"><div><h1>Profile</h1></div></header>' +
      '<section class="card center-card"><button class="av-edit" data-action="edit-avatar" aria-label="Change your avatar">' + App.avatar(u.name, u.color, 96) + '<span class="pen">' + icon('edit', 16) + '</span></button><h2>' + esc(u.name) + '</h2><div class="muted">' + esc(u.email) + '</div><div class="code small-code">' + esc(u.shareCode) + '</div></section>' +
      '<section class="card"><h2>Your details</h2><form data-form="profile" novalidate>' +
      '<label class="fld"><span>Name</span><input id="p-name" maxlength="40" value="' + esc(u.name) + '"></label>' +
      '<label class="fld"><span>Phone (lets friends find you from their contacts)</span><input id="p-phone" type="tel" placeholder="' + (u.hasPhone ? 'A number is saved. Type a new one to change it.' : '+355 69 123 4567') + '"></label>' +
      '<div class="check-row"><label><input type="checkbox" id="p-clear-phone"> Remove my number</label></div>' +
      '<div class="err" id="p-err" role="alert"></div><button class="btn dark" type="submit">Save</button></form></section>' +
      '<section class="card"><h2>Privacy</h2><ul class="ticks"><li>Your phone number is stored only as a scrambled code, never in plain text.</li><li>Receipt photos are read on your phone and are not uploaded.</li><li>People only see your name and friend code.</li></ul>' +
      '<button class="btn danger wide" data-action="logout">' + icon('logout', 20) + ' Log out</button></section>');
  };

  // ---------- link targets ----------
  App.joinBill = function (code) {
    return App.api('/api/bills/join', { method: 'POST', body: { code: code } }).then(function (b) {
      App.toast('You joined "' + b.title + '"');
      return App.refreshData().then(function () { App.go('/bill/' + b.id); });
    });
  };
  App.addFriendByCode = function (code) {
    return App.api('/api/friends/add', { method: 'POST', body: { code: code } }).then(function (f) {
      App.toast(f.name + ' is now your friend.');
      return App.refreshData().then(function () { return f; });
    });
  };
  App.addLink = addLink;
})();
