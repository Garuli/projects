/* The bill editor (new and edit) and the bill detail screen. */
(function () {
  'use strict';
  var App = window.App, S = App.S, esc = App.esc, icon = App.icon, money = App.money;
  var counter = 0;
  var nextKey = function (p) { counter += 1; return p + counter; };

  // ---------- starting a draft ----------
  App.startDraft = function (parsed, fromScan, opts) {
    var me = S.user;
    var d = {
      id: null, title: (parsed && parsed.merchant) || '', merchant: (parsed && parsed.merchant) || '', currency: 'ALL', mode: 'equal',
      taxCents: (parsed && parsed.taxCents) || 0, tipCents: (parsed && parsed.tipCents) || 0, dueDate: '',
      items: [], members: [{ key: nextKey('m'), userId: me.id, name: me.name, color: me.color, percent: 0 }],
      assignments: {}, mismatchCents: (parsed && parsed.mismatchCents) || 0, includedTax: !!(parsed && parsed.includedTax), fromScan: !!fromScan
    };
    ((parsed && parsed.items) || []).forEach(function (it) { d.items.push({ key: nextKey('i'), name: it.name, priceCents: it.priceCents, qty: it.qty }); });
    if (!d.items.length) d.items.push({ key: nextKey('i'), name: '', priceCents: 0, qty: 1 });
    if (parsed && parsed.currency) d.currency = parsed.currency;
    if (fromScan && parsed && parsed.items && parsed.items.length) d.mode = 'items';
    if (opts && opts.friendId) addFriendToDraft(d, opts.friendId);
    S.draft = d;
    App.go('/new');
  };

  function addFriendToDraft(d, friendId) {
    var f = S.friends.filter(function (x) { return x.id === Number(friendId); })[0];
    if (!f || d.members.some(function (m) { return m.userId === f.id; })) return;
    d.members.push({ key: nextKey('m'), userId: f.id, name: f.name, color: f.color, percent: 0 });
  }

  App.editBill = function (id) {
    return App.api('/api/bills/' + id).then(function (b) {
      var d = { id: b.id, title: b.title, merchant: b.merchant, currency: b.currency, mode: b.mode, taxCents: b.taxCents, tipCents: b.tipCents, dueDate: b.dueDate || '',
        items: [], members: [], assignments: {}, mismatchCents: 0, fromScan: false };
      b.items.forEach(function (it) {
        var k = 'i' + it.id + '_' + nextKey('x'); d.items.push({ key: k, name: it.name, priceCents: it.priceCents, qty: it.qty });
        it.assignees.forEach(function (mid) { d.assignments[k + '|m' + mid] = true; });
      });
      b.members.forEach(function (m) { d.members.push({ key: 'm' + m.id, id: m.id, userId: m.userId, name: m.name, color: m.color, percent: m.percent }); });
      S.draft = d;
      App.go('/new');
    });
  };

  // ---------- maths ----------
  function calc() {
    var d = S.draft;
    return window.Split.computeSplit({
      mode: d.mode, tipCents: d.tipCents, taxCents: d.taxCents,
      items: d.items.map(function (i) { return { id: i.key, priceCents: i.priceCents, qty: i.qty }; }),
      members: d.members.map(function (m) { return { id: m.key, percent: m.percent }; }),
      assignments: Object.keys(d.assignments).map(function (k) { var p = k.split('|'); return { itemId: p[0], memberId: p[1] }; })
    });
  }
  function equalPercents(d) {
    var n = d.members.length, base = Math.floor(10000 / n) / 100;
    d.members.forEach(function (m, i) { m.percent = i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base; });
  }

  // ---------- rendering ----------
  function itemRow(it) {
    var d = S.draft, assign = '';
    if (d.mode === 'items') {
      var all = d.members.every(function (m) { return d.assignments[it.key + '|' + m.key]; });
      assign = '<div class="assign"><button class="chip' + (all ? ' on' : '') + '" data-action="assign-all" data-item="' + it.key + '">Everyone</button>' +
        d.members.map(function (m) {
          return '<button class="chip' + (d.assignments[it.key + '|' + m.key] ? ' on' : '') + '" data-action="assign" data-item="' + it.key + '" data-member="' + m.key + '">' + App.avatar(m.name, m.color, 20) + esc(m.name.split(' ')[0]) + '</button>';
        }).join('') + '</div>';
    }
    return '<div class="item" data-item="' + it.key + '"><div class="item-main">' +
      '<div class="qty"><button data-action="qty" data-item="' + it.key + '" data-d="-1" aria-label="Fewer">' + icon('minus', 16) + '</button><b>' + it.qty + '</b><button data-action="qty" data-item="' + it.key + '" data-d="1" aria-label="More">' + icon('plus', 16) + '</button></div>' +
      '<input class="in-name" data-field="name" data-item="' + it.key + '" maxlength="80" placeholder="Item name" value="' + esc(it.name) + '" aria-label="Item name">' +
      '<input class="in-price" data-field="price" data-item="' + it.key + '" inputmode="decimal" placeholder="0" value="' + (it.priceCents ? App.centsToInput(it.priceCents) : '') + '" aria-label="Price of one">' +
      '<button class="icon-btn" data-action="del-item" data-item="' + it.key + '" aria-label="Remove item">' + icon('trash', 18) + '</button></div>' + assign + '</div>';
  }

  function totalsHtml() {
    var d = S.draft, r = calc(), cur = d.currency;
    var rows = d.members.map(function (m) {
      var s = r.perMember[m.key] || { totalCents: 0 };
      return '<div class="who">' + App.avatar(m.name, m.color, 38) + '<div class="grow"><b>' + esc(m.name) + (m.userId === S.user.id ? ' (you)' : '') + '</b>' +
        (d.mode === 'percent' ? '<div class="pct"><input data-field="percent" data-member="' + m.key + '" inputmode="decimal" value="' + m.percent + '" aria-label="Percent for ' + esc(m.name) + '"> %</div>' : '') +
        '</div><b class="amt">' + money(s.totalCents, cur) + '</b></div>';
    }).join('');
    var warn = '';
    if (d.mode === 'items' && r.unassignedCents > 0) warn = '<div class="note">' + money(r.unassignedCents, cur) + ' is not given to anyone yet. It is shared equally until you pick who had it.</div>';
    if (d.mode === 'percent') {
      var sum = d.members.reduce(function (s, m) { return s + (Number(m.percent) || 0); }, 0);
      if (Math.abs(sum - 100) > 0.01) warn = '<div class="note">Percentages add up to ' + Math.round(sum * 100) / 100 + '%. They are scaled to 100%.</div>';
    }
    return rows + warn + '<div class="sum"><span>Items</span><b>' + money(r.subtotalCents, cur) + '</b></div>' +
      (d.taxCents ? '<div class="sum"><span>Tax</span><b>' + money(d.taxCents, cur) + '</b></div>' : '') +
      (d.tipCents ? '<div class="sum"><span>Tip</span><b>' + money(d.tipCents, cur) + '</b></div>' : '') +
      '<div class="sum total"><span>Total</span><b>' + money(r.totalCents, cur) + '</b></div>';
  }

  function render() {
    var d = S.draft;
    if (!d) { App.go('/'); return; }
    var r = calc();
    var friendsChips = S.friends.map(function (f) {
      var on = d.members.some(function (m) { return m.userId === f.id; });
      return '<button class="chip big' + (on ? ' on' : '') + '" data-action="toggle-friend" data-id="' + f.id + '">' + App.avatar(f.name, f.color, 26) + esc(f.name.split(' ')[0]) + (on ? icon('check', 14) : '') + '</button>';
    }).join('');
    var guests = d.members.filter(function (m) { return m.userId == null; }).map(function (m) {
      return '<button class="chip big on" data-action="remove-guest" data-member="' + m.key + '">' + App.avatar(m.name, '#D9DCE3', 26) + esc(m.name) + icon('close', 14) + '</button>';
    }).join('');
    var warn = '';
    if (d.fromScan && d.mismatchCents) {
      warn = '<div class="note warn">The items add up to ' + money(r.subtotalCents, d.currency) + ' but the receipt total is ' + money(r.subtotalCents + d.taxCents + d.tipCents + d.mismatchCents, d.currency) + '. Check the prices below, the camera can misread digits.</div>';
    } else if (d.fromScan && d.includedTax) warn = '<div class="note">The tax on this receipt is already included in the prices, so it is not added again.</div>';
    var inner =
      '<header class="top"><button class="icon-btn" data-action="editor-back" aria-label="Back">' + icon('back', 22) + '</button><h1>' + (d.id ? 'Edit bill' : 'New bill') + '</h1><span style="width:40px"></span></header>' + warn +
      '<div class="editor"><div class="col-left">' +
      '<section class="card"><label class="fld"><span>What is it for?</span><input data-field="title" maxlength="80" placeholder="Dinner, taxi, groceries…" value="' + esc(d.title) + '"></label>' +
      '<div class="row2"><label class="fld"><span>Currency</span><select data-field="currency">' + ['ALL', 'EUR', 'USD', 'GBP'].map(function (c) { return '<option' + (c === d.currency ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Pay back by</span><input type="date" data-field="due" value="' + esc(d.dueDate) + '"></label></div></section>' +
      '<section class="card"><div class="sec-head"><h2>Items</h2><button class="btn ghost sm" data-action="scan-into">' + icon('scan', 16) + ' Scan receipt</button></div>' +
      '<div id="items">' + d.items.map(itemRow).join('') + '</div>' +
      '<button class="btn ghost wide" data-action="add-item">' + icon('plus', 18) + ' Add item</button>' +
      '<div class="row2 extras"><label class="fld"><span>Tax</span><input data-field="tax" inputmode="decimal" placeholder="0" value="' + (d.taxCents ? App.centsToInput(d.taxCents) : '') + '"></label>' +
      '<label class="fld"><span>Tip</span><input data-field="tip" inputmode="decimal" placeholder="0" value="' + (d.tipCents ? App.centsToInput(d.tipCents) : '') + '"></label></div>' +
      '<div class="chips tipchips"><small class="muted">Quick tip</small>' + [5, 10, 15].map(function (p) { return '<button class="chip" data-action="tip" data-p="' + p + '">' + p + '%</button>'; }).join('') + '<button class="chip" data-action="tip" data-p="0">None</button></div></section>' +
      '</div><div class="col-right">' +
      '<section class="card"><h2>Who is splitting?</h2><div class="chips">' + friendsChips + guests + '</div>' +
      (S.friends.length ? '' : '<p class="muted small">Add friends from the Friends tab, or add someone without the app below.</p>') +
      '<form class="inline" data-form="guest"><input id="guest-name" maxlength="40" placeholder="Add someone by name"><button class="btn ghost" type="submit">Add</button></form></section>' +
      '<section class="card"><h2>How to split</h2><div class="seg three">' +
      [['equal', 'Equally'], ['items', 'By item'], ['percent', 'By %']].map(function (m) { return '<button class="' + (d.mode === m[0] ? 'on' : '') + '" data-action="mode" data-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<p class="muted small">' + ({ equal: 'Everyone pays the same share of the whole bill.', items: 'Tap the names under each item to say who had it. Shared items are split between those people.', percent: 'Give each person a percentage.' }[d.mode]) + '</p>' +
      '<div id="totals">' + totalsHtml() + '</div></section>' +
      '</div></div>' +
      '<div class="actionbar"><div><small class="muted">Total</small><b id="bar-total">' + money(r.totalCents, d.currency) + '</b></div><button class="btn dark" data-action="save-bill">' + (d.id ? 'Save changes' : 'Send request') + '</button></div>';
    App.shell('', inner);
    App.$('.app').classList.add('no-tab');
  }
  App.screens.editor = render;

  function refreshTotals() {
    var t = App.$('#totals'); if (t) t.innerHTML = totalsHtml();
    var bar = App.$('#bar-total'); if (bar) bar.textContent = money(calc().totalCents, S.draft.currency);
  }

  // ---------- editing ----------
  function findItem(key) { return S.draft.items.filter(function (i) { return i.key === key; })[0]; }
  function findMember(key) { return S.draft.members.filter(function (m) { return m.key === key; })[0]; }

  App.editorInput = function (el) {          // typing in a field: update the draft and the totals, not the whole screen
    var d = S.draft, f = el.dataset.field;
    if (!d || !f) return;
    if (f === 'title') d.title = el.value;
    else if (f === 'name') findItem(el.dataset.item).name = el.value;
    else if (f === 'price') { findItem(el.dataset.item).priceCents = App.inputToCents(el.value); refreshTotals(); }
    else if (f === 'tax') { d.taxCents = App.inputToCents(el.value); refreshTotals(); }
    else if (f === 'tip') { d.tipCents = App.inputToCents(el.value); refreshTotals(); }
    else if (f === 'percent') { findMember(el.dataset.member).percent = Math.max(0, Math.min(100, Number(String(el.value).replace(',', '.')) || 0)); var t = calc(); App.$$('#totals .who').forEach(function (w, i) { w.querySelector('.amt').textContent = money(t.perMember[d.members[i].key].totalCents, d.currency); }); }
    else if (f === 'currency') { d.currency = el.value; refreshTotals(); }
    else if (f === 'due') d.dueDate = el.value;
  };

  App.editorAction = function (a, el) {
    var d = S.draft;
    switch (a) {
      case 'add-item': d.items.push({ key: nextKey('i'), name: '', priceCents: 0, qty: 1 }); render(); var ins = App.$$('.in-name'); if (ins.length) ins[ins.length - 1].focus(); break;
      case 'del-item': d.items = d.items.filter(function (i) { return i.key !== el.dataset.item; }); if (!d.items.length) d.items.push({ key: nextKey('i'), name: '', priceCents: 0, qty: 1 }); render(); break;
      case 'qty': var it = findItem(el.dataset.item); it.qty = Math.max(1, Math.min(99, it.qty + Number(el.dataset.d))); render(); break;
      case 'mode':
        d.mode = el.dataset.mode;
        if (d.mode === 'percent' && Math.abs(d.members.reduce(function (s, m) { return s + m.percent; }, 0) - 100) > 0.01) equalPercents(d);
        render(); break;
      case 'assign': var k = el.dataset.item + '|' + el.dataset.member; if (d.assignments[k]) delete d.assignments[k]; else d.assignments[k] = true; render(); break;
      case 'assign-all':
        var every = d.members.every(function (m) { return d.assignments[el.dataset.item + '|' + m.key]; });
        d.members.forEach(function (m) { var kk = el.dataset.item + '|' + m.key; if (every) delete d.assignments[kk]; else d.assignments[kk] = true; });
        render(); break;
      case 'toggle-friend':
        var fid = Number(el.dataset.id), has = d.members.filter(function (m) { return m.userId === fid; })[0];
        if (has) { d.members = d.members.filter(function (m) { return m !== has; }); Object.keys(d.assignments).forEach(function (kk) { if (kk.split('|')[1] === has.key) delete d.assignments[kk]; }); }
        else addFriendToDraft(d, fid);
        if (d.mode === 'percent') equalPercents(d);
        render(); break;
      case 'remove-guest':
        d.members = d.members.filter(function (m) { return m.key !== el.dataset.member; });
        Object.keys(d.assignments).forEach(function (kk) { if (kk.split('|')[1] === el.dataset.member) delete d.assignments[kk]; });
        if (d.mode === 'percent') equalPercents(d);
        render(); break;
      case 'tip': var sub = calc().subtotalCents; d.tipCents = Math.round(sub * Number(el.dataset.p) / 100); render(); break;
      case 'editor-back': S.draft = null; history.length > 1 ? history.back() : App.go('/'); break;
      case 'save-bill': save(el); break;
      case 'scan-into': App.scanForDraft = true; App.scan.start(); break;
    }
  };

  App.addGuest = function (name) {
    name = String(name || '').trim();
    if (!name) return;
    var d = S.draft;
    d.members.push({ key: nextKey('m'), userId: null, name: name.slice(0, 40), color: '#D9DCE3', percent: 0 });
    if (d.mode === 'percent') equalPercents(d);
    render();
  };

  /** Merge a freshly scanned receipt into the draft that is already open. */
  App.mergeScan = function (parsed) {
    var d = S.draft;
    d.items = d.items.filter(function (i) { return i.name || i.priceCents; });
    (parsed.items || []).forEach(function (it) { d.items.push({ key: nextKey('i'), name: it.name, priceCents: it.priceCents, qty: it.qty }); });
    if (!d.items.length) d.items.push({ key: nextKey('i'), name: '', priceCents: 0, qty: 1 });
    if (parsed.taxCents) d.taxCents = parsed.taxCents;
    if (parsed.tipCents) d.tipCents = parsed.tipCents;
    if (!d.title && parsed.merchant) d.title = parsed.merchant;
    d.fromScan = true; d.mismatchCents = parsed.mismatchCents || 0; d.includedTax = !!parsed.includedTax;
    render();
  };

  function save(btn) {
    var d = S.draft;
    var items = d.items.filter(function (i) { return i.name.trim() || i.priceCents; });
    if (!items.length) { App.toast('Add at least one item.', 'error'); return; }
    if (items.some(function (i) { return !i.name.trim(); })) { App.toast('Every item needs a name.', 'error'); return; }
    if (d.members.length < 2) { App.toast('Add at least one more person to split with.', 'error'); return; }
    var body = {
      title: d.title.trim() || d.merchant || 'Bill', merchant: d.merchant, currency: d.currency, mode: d.mode, tipCents: d.tipCents, taxCents: d.taxCents, dueDate: d.dueDate || null,
      items: items.map(function (i) { return { key: i.key, name: i.name.trim(), priceCents: i.priceCents, qty: i.qty }; }),
      members: d.members.map(function (m) { return { key: m.key, id: m.id || undefined, userId: m.userId || undefined, name: m.name, percent: m.percent }; }),
      assignments: Object.keys(d.assignments).map(function (k) { var p = k.split('|'); return { item: p[0], member: p[1] }; })
    };
    App.busy(btn, true);
    App.api(d.id ? '/api/bills/' + d.id : '/api/bills', { method: d.id ? 'PUT' : 'POST', body: body }).then(function (b) {
      S.draft = null;
      return App.refreshData().then(function () { App.toast(d.id ? 'Bill updated.' : 'Request sent. Share the code so everyone can see it.'); App.go('/bill/' + b.id); });
    }).catch(function (e) { App.busy(btn, false, d.id ? 'Save changes' : 'Send request'); App.toast(e.message, 'error'); });
  }

  // ---------- bill detail ----------
  function joinLink(code) { return location.origin + '/#/join/' + code; }

  App.screens.bill = function (id) {
    App.api('/api/bills/' + id).then(function (b) {
      var cur = b.currency, me = S.user, paidN = b.members.filter(function (m) { return !m.isOwner && m.paid; }).length, payers = b.members.filter(function (m) { return !m.isOwner; }).length;
      var rows = b.members.map(function (m) {
        var can = b.isOwner || m.userId === me.id, action = '';
        if (m.isOwner) action = '<span class="pill neutral">Paid the bill</span>';
        else if (m.paid) action = can ? '<button class="pill ok" data-action="unpay" data-id="' + b.id + '" data-member="' + m.id + '">' + icon('check', 14) + ' Paid</button>' : '<span class="pill ok">Paid</span>';
        else action = can ? '<button class="btn dark sm" data-action="pay" data-id="' + b.id + '" data-member="' + m.id + '">Mark paid</button>' : '<span class="pill due">Waiting</span>';
        var remind = (!m.isOwner && !m.paid && b.isOwner) ? '<button class="icon-btn" data-action="remind" data-id="' + b.id + '" data-member="' + m.id + '" aria-label="Remind ' + esc(m.name) + '">' + icon('bell', 18) + '</button>' : '';
        return '<div class="who">' + App.avatar(m.name, m.color, 44) + '<div class="grow"><b>' + esc(m.name) + (m.userId === me.id ? ' (you)' : '') + '</b><div class="muted small">' + money(m.itemsCents, cur) + (m.extrasCents ? ' + ' + money(m.extrasCents, cur) + ' tip & tax' : '') + '</div></div>' +
          '<div class="who-right"><b class="amt">' + money(m.totalCents, cur) + '</b>' + action + '</div>' + remind + '</div>';
      }).join('');
      var items = b.items.map(function (it) {
        var who = b.mode === 'items' ? '<div class="stack">' + it.assignees.map(function (mid) { var m = b.members.filter(function (x) { return x.id === mid; })[0]; return m ? App.avatar(m.name, m.color, 24, 'ring') : ''; }).join('') + '</div>' : '';
        return '<div class="line"><span>' + it.qty + '× ' + esc(it.name) + '</span>' + who + '<b>' + money(it.priceCents * it.qty, cur) + '</b></div>';
      }).join('');
      var due = b.dueDate ? '<span class="pill neutral">' + icon('calendar', 14) + ' Pay by ' + esc(App.dateLabel(b.dueDate)) + '</span>' : '';
      App.shell('bills',
        '<header class="top"><a class="icon-btn" href="#/bills" aria-label="Back">' + icon('back', 22) + '</a><h1>' + esc(b.title) + '</h1><span style="width:40px"></span></header>' +
        '<section class="hero small-hero"><div class="hero-in"><small>' + (b.status === 'settled' ? 'Settled' : 'Bill total') + ' · by ' + esc(b.owner.name.split(' ')[0]) + '</small><div class="hero-amt">' + money(b.totalCents, cur) + '</div>' +
        '<div class="hero-sub"><span>' + paidN + ' of ' + payers + ' paid</span>' + due + '</div>' + (payers ? '<div class="bar light"><i style="width:' + Math.round(100 * paidN / payers) + '%"></i></div>' : '') + '</div></section>' +
        '<div class="two"><section class="card"><h2>Who pays what</h2><div class="list">' + rows + '</div></section>' +
        '<div><section class="card share-card"><h2>Share this bill</h2><div class="code">' + esc(b.code) + '</div><div class="qr-wrap">' + App.qrSvg(joinLink(b.code), 150) + '</div>' +
        '<p class="muted small">Friends type the code on the Home screen, or scan the QR, to see their share.</p>' +
        '<div class="btn-row"><button class="btn ghost" data-action="copy-text" data-text="' + esc(joinLink(b.code)) + '">' + icon('copy', 18) + ' Copy link</button>' +
        '<button class="btn dark" data-action="share-bill" data-title="' + esc(b.title) + '" data-code="' + esc(b.code) + '">' + icon('share', 18) + ' Share</button></div></section>' +
        '<section class="card"><h2>Receipt</h2><div class="lines">' + items + '</div>' +
        (b.tipCents ? '<div class="line"><span>Tip</span><b>' + money(b.tipCents, cur) + '</b></div>' : '') + (b.taxCents ? '<div class="line"><span>Tax</span><b>' + money(b.taxCents, cur) + '</b></div>' : '') +
        '<div class="line total"><span>Total</span><b>' + money(b.totalCents, cur) + '</b></div></section>' +
        (b.isOwner ? '<div class="btn-row"><button class="btn ghost" data-action="edit-bill" data-id="' + b.id + '">' + icon('edit', 18) + ' Edit</button><button class="btn danger" data-action="delete-bill" data-id="' + b.id + '">' + icon('trash', 18) + ' Delete</button></div>' : '') + '</div></div>');
      App.currentBill = b;
    }).catch(function (e) { App.toast(e.message, 'error'); App.go('/bills'); });
  };

  App.setPaid = function (billId, memberId, paid) {
    return App.api('/api/bills/' + billId + '/members/' + memberId + '/paid', { method: 'POST', body: { paid: paid } })
      .then(function () { return App.refreshData(); }).then(function () { App.screens.bill(billId); });
  };
  App.remind = function (billId, memberId) {
    var b = App.currentBill; if (!b || b.id !== Number(billId)) return;
    var m = b.members.filter(function (x) { return x.id === Number(memberId); })[0]; if (!m) return;
    var text = 'Hi ' + m.name.split(' ')[0] + ', a friendly reminder: your share of "' + b.title + '" is ' + money(m.totalCents, b.currency) + (b.dueDate ? ', due ' + App.dateLabel(b.dueDate) : '') + '.';
    return App.share('Reminder: ' + b.title, text, joinLink(b.code));
  };
  App.shareBill = function (title, code) { return App.share(title, 'Join "' + title + '" on Split It to see your share. Code: ' + code, joinLink(code)); };
})();
