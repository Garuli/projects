/* Split It: routing, click and form handling, start-up. */
(function () {
  'use strict';
  var App = window.App, S = App.S, $ = App.$, icon = App.icon;

  // ---------- routing ----------
  App.route = function () {
    window.scrollTo(0, 0);
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var page = parts[0] || '', arg = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (!S.token || !S.user) {
      if (page === 'join' || page === 'add') App.setPending({ type: page, code: arg });
      App.screens.auth('login');
      return;
    }
    if (page === 'join') { App.joinBill(arg).catch(function (e) { App.toast(e.message, 'error'); App.go('/'); }); return; }
    if (page === 'add') { App.addFriendByCode(arg).then(function () { App.go('/friends'); }).catch(function (e) { App.toast(e.message, 'error'); App.go('/friends'); }); return; }
    if (page === 'friends') return App.screens.friends();
    if (page === 'bills') return App.screens.bills();
    if (page === 'profile') return App.screens.profile();
    if (page === 'new') return App.screens.editor();
    if (page === 'edit') { App.editBill(Number(arg)).catch(function (e) { App.toast(e.message, 'error'); App.go('/bills'); }); return; }
    if (page === 'bill') return App.screens.bill(Number(arg));
    return App.screens.home();
  };
  window.addEventListener('hashchange', App.route);

  function afterLogin(r) {
    App.saveToken(r.token); S.user = r.user;
    return App.refreshData().then(function () {
      var p = App.takePending();
      if (p && p.type === 'join') return App.joinBill(p.code).catch(function (e) { App.toast(e.message, 'error'); App.go('/'); });
      if (p && p.type === 'add') return App.addFriendByCode(p.code).then(function () { App.go('/friends'); }).catch(function (e) { App.toast(e.message, 'error'); App.go('/'); });
      if (location.hash && !/^#\/(join|add)/.test(location.hash) && location.hash !== '#/') return App.route();
      App.go('/');
    });
  }

  // ---------- new-bill sheet ----------
  function newBillSheet() {
    App.sheet('<h2>Split a new bill</h2><div class="opts">' +
      '<button class="opt" data-action="scan-camera"><span class="opt-ic y">' + icon('scan', 24) + '</span><span><b>Scan a receipt</b><small>Use the camera and we read the items</small></span></button>' +
      '<button class="opt" data-action="scan-gallery"><span class="opt-ic b">' + icon('image', 24) + '</span><span><b>Choose a photo</b><small>Pick a receipt picture from your phone</small></span></button>' +
      '<button class="opt" data-action="manual"><span class="opt-ic g">' + icon('edit', 24) + '</span><span><b>Add items by hand</b><small>Type the items and prices yourself</small></span></button>' +
      '<button class="opt" data-action="join-sheet"><span class="opt-ic p">' + icon('qr', 24) + '</span><span><b>Join with a code</b><small>A friend already made the bill</small></span></button></div>');
  }

  // ---------- clicks ----------
  var editorActions = ['add-item', 'del-item', 'qty', 'mode', 'assign', 'assign-all', 'toggle-friend', 'remove-guest', 'tip', 'editor-back', 'save-bill', 'scan-into'];
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.dataset.action;
    if (el.tagName === 'A') e.preventDefault();
    if (a === 'close-sheet') { if (e.target === el) App.closeSheet(); return; }
    if (editorActions.indexOf(a) >= 0) return App.editorAction(a, el);
    switch (a) {
      case 'close-sheet-btn': App.closeSheet(); break;
      case 'av-pick': App.avpPick(el.dataset.part, el.dataset.v); break;
      case 'av-shuffle': App.avpShuffle(); break;
      case 'av-save': App.avpSave(); break;
      case 'reg-av-shuffle': App.setRegAvatar(window.Avatar.random()); break;
      case 'reg-av-edit': App.avatarPicker(App.regAvatar(), function (code) { App.setRegAvatar(code); App.closeSheet(); }); break;
      case 'edit-avatar': App.avatarPicker(S.user.color, function (code) {
        App.api('/api/me', { method: 'PATCH', body: { avatar: code } })
          .then(function (u) { S.user = u; App.closeSheet(); return App.refreshData(); })
          .then(function () { App.toast('Avatar saved.'); App.route(); })
          .catch(function (er) { App.toast(er.message, 'error'); });
      }); break;
      case 'auth-tab': App.screens.auth(el.dataset.tab); break;
      case 'fill-demo': $('#f-email').value = 'alex@example.com'; $('#f-pass').value = 'alex123'; break;
      case 'new-bill': newBillSheet(); break;
      case 'scan-camera': App.closeSheet(); App.scan.start(); break;
      case 'scan-gallery': App.closeSheet(); App.scan.gallery(); break;
      case 'manual': App.closeSheet(); App.startDraft(null); break;
      case 'join-sheet': App.sheet('<h2>Join a bill</h2><form class="inline" data-form="join"><input id="join-code" maxlength="8" autocapitalize="characters" placeholder="e.g. K7M2QX"><button class="btn dark" type="submit">Join</button></form>'); break;
      case 'bill-with': App.startDraft(null, false, { friendId: el.dataset.id }); break;
      case 'goto': App.go(el.dataset.to); break;
      case 'bills-tab': App.screens.bills(el.dataset.tab); break;
      case 'copy-code': App.copy(S.user.shareCode); break;
      case 'share-code': App.share('Add me on Split It', 'Add me on Split It with my friend code ' + S.user.shareCode + '.', App.addLink(S.user.shareCode)); break;
      case 'remove-friend':
        App.confirm('Remove friend?', 'They will no longer show up when you split a bill. Old bills stay as they are.', 'Remove', true).then(function (ok) {
          if (ok) App.api('/api/friends/' + el.dataset.id, { method: 'DELETE' }).then(App.refreshData).then(App.route).catch(function (er) { App.toast(er.message, 'error'); });
        }); break;
      case 'find-contacts': App.findContacts(); break;
      case 'add-by-code': App.addFriendByCode(el.dataset.code).then(function () { App.closeSheet(); App.route(); }).catch(function (er) { App.toast(er.message, 'error'); }); break;
      case 'cam-close': App.scan.close(); break;
      case 'cam-shoot': App.scan.shoot(); break;
      case 'cam-gallery': App.scan.gallery(); break;
      case 'cam-torch': App.scan.torch(); break;
      case 'logout':
        App.confirm('Log out?', 'You will need to sign in again.', 'Log out').then(function (ok) { if (ok) App.logout(); }); break;
      case 'pay': App.setPaid(el.dataset.id, el.dataset.member, true).catch(function (er) { App.toast(er.message, 'error'); }); break;
      case 'unpay': App.setPaid(el.dataset.id, el.dataset.member, false).catch(function (er) { App.toast(er.message, 'error'); }); break;
      case 'remind': App.remind(el.dataset.id, el.dataset.member); break;
      case 'share-bill': App.shareBill(el.dataset.title, el.dataset.code); break;
      case 'copy-text': App.copy(el.dataset.text); break;
      case 'edit-bill': App.go('/edit/' + el.dataset.id); break;
      case 'delete-bill':
        App.confirm('Delete this bill?', 'It disappears for everyone on it. This cannot be undone.', 'Delete', true).then(function (ok) {
          if (ok) App.api('/api/bills/' + el.dataset.id, { method: 'DELETE' }).then(App.refreshData).then(function () { App.toast('Bill deleted.'); App.go('/bills'); }).catch(function (er) { App.toast(er.message, 'error'); });
        }); break;
    }
  });

  document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.field) App.editorInput(e.target); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { App.closeSheet(); App.scan.close(); } });

  // ---------- forms ----------
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form'); if (!f) return;
    e.preventDefault();
    var kind = f.dataset.form, btn = f.querySelector('button[type=submit]'), err = $('#auth-err');
    var fail = function (er) { App.busy(btn, false); if (err) err.textContent = er.message; else App.toast(er.message, 'error'); };
    if (kind === 'login' || kind === 'register') {
      var body = { email: $('#f-email').value.trim(), password: $('#f-pass').value };
      if (!body.email || !body.password) { err.textContent = 'Enter your email and password.'; return; }
      if (kind === 'register') { body.name = $('#f-name').value.trim(); body.phone = $('#f-phone').value.trim() || undefined; body.avatar = App.regAvatar(); }
      App.busy(btn, true);
      App.api('/api/auth/' + kind, { method: 'POST', body: body }).then(afterLogin).catch(fail);
    } else if (kind === 'join') {
      var code = $('#join-code').value.trim(); if (!code) return;
      App.busy(btn, true); App.closeSheet();
      App.joinBill(code).catch(function (er) { App.busy(btn, false); App.toast(er.message, 'error'); });
    } else if (kind === 'add-friend') {
      var c = $('#friend-code').value.trim(); if (!c) return;
      App.busy(btn, true);
      App.addFriendByCode(c).then(App.route).catch(function (er) { App.busy(btn, false); App.toast(er.message, 'error'); });
    } else if (kind === 'guest') {
      var g = $('#guest-name').value; App.addGuest(g);
    } else if (kind === 'profile') {
      var pe = $('#p-err'); pe.textContent = '';
      var upd = { name: $('#p-name').value.trim() }, phone = $('#p-phone').value.trim();
      if ($('#p-clear-phone').checked) upd.phone = ''; else if (phone) upd.phone = phone;
      App.busy(btn, true);
      App.api('/api/me', { method: 'PATCH', body: upd }).then(function (u) { S.user = u; App.toast('Saved.'); App.route(); }).catch(function (er) { App.busy(btn, false, 'Save'); pe.textContent = er.message; });
    }
  });

  // ---------- start ----------
  function boot() {
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) { S.config = c; }).catch(function () {}).then(function () {
      var t = App.loadToken();
      if (!t) return App.route();
      S.token = t;
      return App.api('/api/me').then(function (u) { S.user = u; return App.refreshData(); }).then(App.route).catch(function () { App.logout(); });
    });
  }
  boot();
})();
