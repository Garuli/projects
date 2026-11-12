/* NeoBank front end: plain JavaScript, no framework, no build step.
   Talks to the Spring Boot REST API with a JWT. Hash routing (#/dashboard ...). */
(function () {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TOKEN_KEY = 'neobank_token';
  const CREDIT_MAX = { STUDENT: 2000, BUSINESS: 100000, PREMIUM: 500000 };
  const CREDIT_TYPES = ['STUDENT', 'BUSINESS', 'PREMIUM'];
  const TYPE_INFO = {
    SAVINGS:  { name: 'Savings',  note: 'Earns 3.5% interest. Up to $10,000 per transfer, no overdraft.' },
    CURRENT:  { name: 'Current',  note: 'Everyday account. Up to $25,000 per transfer, $500 overdraft, 1% interest.' },
    CHECKING: { name: 'Checking', note: '$250 overdraft, 0.5% interest.' },
    STUDENT:  { name: 'Student',  note: 'Credit card with a limit up to $2,000 and 4.5% interest.' },
    BUSINESS: { name: 'Business', note: 'Up to $100,000 per transfer, no overdraft, 2% interest.' },
    PREMIUM:  { name: 'Premium',  note: 'Credit card with a limit up to $500,000 and 4.5% interest.' }
  };
  const RATES = { SAVINGS: '3.5%', CURRENT: '1.0%', CHECKING: '0.5%', STUDENT: '4.5%', BUSINESS: '2.0%', PREMIUM: '4.5%' };
  const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'cards', label: 'Cards', icon: 'card' },
    { id: 'send', label: 'Send', icon: 'send' },
    { id: 'activity', label: 'Activity', icon: 'activity' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'contacts', label: 'Contacts', icon: 'users' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ];
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
    activity: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .8 3.5 2.6 3.5 5.7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    logout: '<path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.3 7.7A17 17 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.2-1"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    arrowUp: '<path d="M7 17 17 7M8 7h9v9"/>',
    arrowDown: '<path d="M17 7 7 17M16 17H7V8"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    trend: '<path d="M3 17 9 11l4 4 8-8M15 7h6v6"/>'
  };
  function icon(n, size) {
    const s = size || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = n => fmt.format(Number(n) || 0);
  const compact = n => {
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  };
  const dayKey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const dayLabel = k => {
    const t = new Date(); const y = new Date(Date.now() - 864e5);
    if (k === dayKey(t)) return 'Today';
    if (k === dayKey(y)) return 'Yesterday';
    const [Y, M, D] = k.split('-').map(Number);
    return new Date(Y, M - 1, D).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };
  const timeLabel = d => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  const typeName = t => (TYPE_INFO[t] && TYPE_INFO[t].name) || t;

  // ---------------------------------------------------------------- state
  const S = {
    token: null, userId: null, user: null,
    accounts: [], txs: [], contacts: [],
    page: 'dashboard',
    reveal: {},
    act: { filter: 'ALL', account: 'ALL', q: '' },
    range: 30,
    sendMode: 'contacts', sendTo: '', sendFrom: ''
  };

  // ---------------------------------------------------------------- api
  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    let res;
    try {
      res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) { throw new Error('Cannot reach the server. Is it running?'); }
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok || (json && json.success === false)) {
      if (res.status === 401 && !path.startsWith('/api/auth/')) { logout(true); }
      let msg = (json && (json.message || json.error)) || ('Request failed (' + res.status + ')');
      if (json && json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
        const first = Object.values(json.data)[0];
        if (typeof first === 'string') msg = first;
      }
      if (res.status === 403) msg = (json && json.message) || 'You are not allowed to do that.';
      throw new Error(msg);
    }
    return json ? json.data : null;
  }

  // ---------------------------------------------------------------- ui bits
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3600);
  }
  function openModal(html) {
    closeModal();
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    o.addEventListener('click', e => { if (e.target === o) closeModal(); });
    $('#modal-root').appendChild(o);
    const f = $('input,select,button.btn-primary', o); if (f && window.innerWidth > 860) f.focus();
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }
  function confirmDialog(title, text, okLabel, danger) {
    return new Promise(resolve => {
      openModal('<h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p><div class="btns"><button class="btn btn-ghost" data-c="0">Cancel</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-c="1">' + esc(okLabel || 'Confirm') + '</button></div>');
      $('#modal-root').addEventListener('click', function h(e) {
        const b = e.target.closest('[data-c]');
        if (!b && !e.target.classList.contains('overlay')) return;
        $('#modal-root').removeEventListener('click', h);
        closeModal(); resolve(!!b && b.dataset.c === '1');
      });
    });
  }
  function setBg(el, url) {
    if (!el) return;
    if (url) { el.style.backgroundImage = 'url("' + String(url).replace(/["\\\n\r]/g, '') + '")'; el.textContent = ''; }
    else { el.style.backgroundImage = ''; el.textContent = initials(S.user && S.user.name); }
  }
  function paintIcons(root) { $$('[data-i]', root).forEach(el => { if (!el.dataset.done) { el.innerHTML = icon(el.dataset.i, 18); el.dataset.done = 1; } }); }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.l = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    else { btn.disabled = false; btn.textContent = label || btn.dataset.l || 'Done'; }
  }

  // ---------------------------------------------------------------- data
  const ownNumbers = () => new Set(S.accounts.map(a => a.accountNumber));
  const isInternal = t => ownNumbers().has(t.counterpartAccountNumber) && !!t.transferRef;
  const sortedTx = () => S.txs.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const totalBalance = () => S.accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  async function loadAll() {
    const id = S.userId;
    const [user, accounts, txs, contacts] = await Promise.all([
      api('/api/users/' + id), api('/api/accounts/user/' + id), api('/api/transactions/user/' + id), api('/api/contacts')
    ]);
    S.user = user; S.accounts = accounts || []; S.txs = txs || []; S.contacts = contacts || [];
    paintUser();
  }
  function paintUser() {
    const u = S.user || {};
    $('#side-name').textContent = u.name || '';
    setBg($('#side-avatar'), u.profilePicture);
    setBg($('#top-avatar'), u.profilePicture);
  }

  // ---------------------------------------------------------------- charts
  function barChart(buckets) {
    const W = 640, H = 240, L = 46, B = 28, T = 10, R = 8;
    const max = Math.max(1, ...buckets.map(b => Math.max(b.inn, b.out)));
    const iw = W - L - R, ih = H - T - B, step = iw / buckets.length, bw = Math.max(3, Math.min(16, step / 2.6));
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const y = T + ih - (ih * i / 4);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,.07)"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + compact(max * i / 4) + '</text>';
    }
    const every = Math.ceil(buckets.length / 8);
    buckets.forEach((b, i) => {
      const cx = L + step * i + step / 2;
      const hi = ih * b.inn / max, ho = ih * b.out / max;
      g += '<rect x="' + (cx - bw - 1) + '" y="' + (T + ih - hi) + '" width="' + bw + '" height="' + Math.max(hi, b.inn ? 2 : 0) + '" rx="3" fill="#2ecc8f"><title>' + esc(b.label) + ' in ' + money(b.inn) + '</title></rect>';
      g += '<rect x="' + (cx + 1) + '" y="' + (T + ih - ho) + '" width="' + bw + '" height="' + Math.max(ho, b.out ? 2 : 0) + '" rx="3" fill="#ff5d6c"><title>' + esc(b.label) + ' out ' + money(b.out) + '</title></rect>';
      if (i % every === 0) g += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(b.label) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Money in and out">' + g + '</svg>';
  }
  function areaChart(points, uid) {
    const W = 640, H = 220, L = 46, B = 28, T = 12, R = 10;
    const vals = points.map(p => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.15; min -= pad; max += pad;
    const iw = W - L - R, ih = H - T - B;
    const X = i => L + (points.length === 1 ? iw / 2 : iw * i / (points.length - 1));
    const Y = v => T + ih - ih * (v - min) / (max - min);
    let g = '';
    for (let i = 0; i <= 3; i++) {
      const v = min + (max - min) * i / 3, y = Y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,.07)"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + compact(v) + '</text>';
    }
    const line = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
    const area = line + ' L' + X(points.length - 1).toFixed(1) + ' ' + (T + ih) + ' L' + X(0).toFixed(1) + ' ' + (T + ih) + ' Z';
    const every = Math.ceil(points.length / 7);
    points.forEach((p, i) => { if (i % every === 0) g += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(p.label) + '</text>'; });
    const last = points[points.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Balance over time"><defs><linearGradient id="ag' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d86ff" stop-opacity=".45"/><stop offset="1" stop-color="#3d86ff" stop-opacity="0"/></linearGradient></defs>' + g +
      '<path d="' + area + '" fill="url(#ag' + uid + ')"/><path d="' + line + '" fill="none" stroke="#3d86ff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="' + X(points.length - 1) + '" cy="' + Y(last.v) + '" r="4.5" fill="#FFBD00" stroke="#020202" stroke-width="2"/></svg>';
  }
  /** Buckets of money in/out for the last `days` days, internal transfers excluded. */
  function buckets(days) {
    const size = days > 31 ? 7 : 1, n = Math.ceil(days / size);
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i * size);
      out.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), from: d.getTime(), to: d.getTime() + size * 864e5, inn: 0, out: 0 });
    }
    S.txs.forEach(t => {
      if (isInternal(t)) return;
      const ts = new Date(t.timestamp).getTime();
      const b = out.find(x => ts >= x.from && ts < x.to);
      if (!b) return;
      if (t.type === 'CREDIT') b.inn += Number(t.amount); else b.out += Number(t.amount);
    });
    return out;
  }
  function balanceSeries(days) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
    const step = days > 31 ? 3 : 1;
    const pts = [];
    for (let i = 0; i < days; i += step) pts.push(new Date(start.getTime() + i * 864e5));
    if (dayKey(pts[pts.length - 1]) !== dayKey(new Date())) pts.push(new Date());
    return pts.map(d => {
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      let v = totalBalance();
      S.txs.forEach(t => { if (new Date(t.timestamp) > end) v -= (t.type === 'CREDIT' ? 1 : -1) * Number(t.amount); });
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), v };
    });
  }
  const sum = (arr, k) => arr.reduce((s, b) => s + b[k], 0);

  // ---------------------------------------------------------------- shared renderers
  function bankCard(a) {
    const shown = S.reveal[a.id];
    const num = shown ? a.accountNumber : '•••• •••• •••• ' + esc(a.maskedNumber || String(a.accountNumber).slice(-4));
    const credit = CREDIT_TYPES.includes(a.type) && Number(a.creditLimit) > 0;
    const shownAmount = credit ? a.availableCredit : a.balance;
    return '<div class="bcard t-' + esc(a.type) + (a.frozen ? ' frozen' : '') + '">' +
      '<div class="top"><span class="brand">NeoBank</span><span class="chip"></span></div>' +
      '<div class="num-line">' + num + '</div>' +
      '<div class="bottom"><div><div class="label">' + esc(typeName(a.type)) + (credit ? ' · credit available' : '') + '</div><div class="bal num">' + money(shownAmount) + '</div></div>' +
      '<div style="text-align:right"><div class="label">Holder</div><div style="font-weight:600;font-size:.85rem">' + esc((a.userName || (S.user && S.user.name) || '').split(' ')[0]) + '</div></div></div>' +
      (a.frozen ? '<div class="frost">Frozen</div>' : '') + '</div>';
  }
  function txRow(t) {
    const self = isInternal(t), inn = t.type === 'CREDIT';
    const cls = self ? 'self' : inn ? 'in' : 'out';
    const ic = self ? 'swap' : inn ? 'arrowDown' : 'arrowUp';
    const who = t.counterpartEmail ? ' · ' + esc(t.counterpartEmail) : t.counterpartAccountNumber ? ' · ' + esc(t.counterpartAccountNumber) : '';
    return '<div class="tx"><div class="ico ' + cls + '">' + icon(ic, 20) + '</div><div class="meta"><b>' + esc(t.description || (inn ? 'Money in' : 'Money out')) + '</b><small>' + esc(typeName(t.accountType)) + who + ' · ' + timeLabel(t.timestamp) + '</small></div>' +
      '<div class="amt num ' + (inn ? 'in' : 'out') + '">' + (inn ? '+' : '−') + money(t.amount) + '</div></div>';
  }
  function emptyBox(msg) { return '<div class="empty">' + esc(msg) + '</div>'; }
  function head(title, sub, right) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  function contactAvatar(c) { return '<span class="avatar">' + esc(initials(c.name)) + '</span>'; }

  // ---------------------------------------------------------------- pages
  const R = {};

  R.dashboard = function () {
    const b = buckets(7), b30 = buckets(30);
    const inn = sum(b30, 'inn'), out = sum(b30, 'out');
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const recent = sortedTx().slice(0, 6);
    const frozen = S.accounts.filter(a => a.frozen).length;
    const quick = S.contacts.slice(0, 8).map(c => '<button data-action="quick-send" data-num="' + esc(c.accountNumber) + '">' + contactAvatar(c) + '<span>' + esc(c.name.split(' ')[0]) + '</span></button>').join('');
    return head(greet + ', ' + ((S.user && S.user.name) || '').split(' ')[0], 'Here is how your money looks today.') +
      '<div class="grid dash"><div class="grid" style="align-content:start">' +
      '<div class="hero"><small>Total balance</small><div class="amount num">' + money(totalBalance()) + '</div>' +
      '<div class="row wrap"><span class="pill">' + icon('arrowDown', 14) + ' ' + money(inn) + ' in</span><span class="pill">' + icon('arrowUp', 14) + ' ' + money(out) + ' out</span><small>last 30 days</small></div>' +
      '<div class="actions"><button class="btn btn-white" data-action="go" data-page="send">' + icon('send', 18) + ' Send money</button><button class="btn btn-ghost" data-action="open-account">' + icon('plus', 18) + ' New account</button></div></div>' +
      '<div class="stats4"><div class="panel stat"><small>Accounts</small><b>' + S.accounts.length + '</b></div><div class="panel stat"><small>Money in</small><b class="in num">' + money(inn) + '</b></div><div class="panel stat"><small>Money out</small><b class="out num">' + money(out) + '</b></div><div class="panel stat"><small>Frozen</small><b>' + frozen + '</b></div></div>' +
      '<div class="panel"><div class="panel-title"><h2>Last 7 days</h2><div class="legend"><span><i style="background:#2ecc8f"></i>In</span><span><i style="background:#ff5d6c"></i>Out</span></div></div>' + barChart(b) + '</div>' +
      '</div><div class="grid" style="align-content:start">' +
      '<div class="panel"><div class="panel-title"><h2>Your cards</h2><div class="row" style="gap:8px"><button class="icon-btn" data-action="scroll-cards" data-dir="-1" aria-label="Previous card">' + icon('chev', 18).replace('<path', '<path transform="scale(-1 1) translate(-24 0)"') + '</button><button class="icon-btn" data-action="scroll-cards" data-dir="1" aria-label="Next card">' + icon('chev', 18) + '</button><a class="link" href="#/cards" style="margin-left:6px">See all</a></div></div>' +
      (S.accounts.length ? '<div class="carousel">' + S.accounts.map(bankCard).join('') + '</div>' : emptyBox('No accounts yet.')) + '</div>' +
      '<div class="panel"><div class="panel-title"><h2>Quick send</h2><a class="link" href="#/contacts">Contacts</a></div><div class="quick"><button data-action="add-contact"><span class="add">' + icon('plus', 20) + '</span><span>Add</span></button>' + quick + '</div></div>' +
      '<div class="panel"><div class="panel-title"><h2>Recent activity</h2><a class="link" href="#/activity">See all</a></div>' + (recent.length ? recent.map(txRow).join('') : emptyBox('No transactions yet.')) + '</div>' +
      '</div></div>';
  };

  R.cards = function () {
    const boxes = S.accounts.map(a => {
      const credit = CREDIT_TYPES.includes(a.type) && Number(a.creditLimit) > 0;
      return '<div class="cardbox">' + bankCard(a) +
        '<div class="panel" style="width:100%;max-width:380px;padding:14px 16px"><div class="kv"><span>Account number</span><span class="num">' + esc(a.accountNumber) + '</span></div>' +
        (credit ? '<div class="kv"><span>Credit limit</span><span class="num">' + money(a.creditLimit) + '</span></div>' : '<div class="kv"><span>Interest</span><span>' + (RATES[a.type] || '–') + ' a year</span></div>') +
        '<div class="kv"><span>Status</span><span>' + (a.frozen ? '<span class="pill cold">Frozen</span>' : '<span class="pill in">Active</span>') + '</span></div></div>' +
        '<div class="actions"><button class="btn btn-ghost btn-sm" data-action="toggle-reveal" data-id="' + a.id + '">' + icon(S.reveal[a.id] ? 'eyeoff' : 'eye', 16) + (S.reveal[a.id] ? ' Hide' : ' Show') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="toggle-freeze" data-id="' + a.id + '">' + icon('snow', 16) + (a.frozen ? ' Unfreeze' : ' Freeze') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="account-history" data-id="' + a.id + '">' + icon('activity', 16) + ' History</button>' +
        '<button class="btn btn-danger btn-sm" data-action="delete-account" data-id="' + a.id + '">' + icon('trash', 16) + ' Close</button></div></div>';
    }).join('');
    return head('Cards', 'Every account has its own card.', '<button class="btn btn-primary" data-action="open-account">' + icon('plus', 18) + ' New account</button>') +
      (boxes ? '<div class="cards-grid">' + boxes + '</div>' : '<div class="panel">' + emptyBox('No accounts yet. Open your first one.') + '</div>');
  };

  R.send = function () {
    const usable = S.accounts.filter(a => !a.frozen);
    if (!S.sendFrom || !usable.some(a => String(a.id) === String(S.sendFrom))) S.sendFrom = usable[0] ? String(usable[0].id) : '';
    const from = usable.map(a => '<option value="' + a.id + '"' + (String(a.id) === String(S.sendFrom) ? ' selected' : '') + '>' + esc(typeName(a.type)) + ' · ' + esc(a.accountNumber) + ' · ' + money(a.balance) + '</option>').join('');
    const modes = [['contacts', 'Contacts'], ['number', 'Account number'], ['mine', 'My accounts']];
    let recipient = '';
    if (S.sendMode === 'contacts') {
      recipient = S.contacts.length
        ? '<select class="input" id="send-to-sel">' + S.contacts.map(c => '<option value="' + esc(c.accountNumber) + '"' + (c.accountNumber === S.sendTo ? ' selected' : '') + '>' + esc(c.name) + ' · ' + esc(c.accountNumber) + '</option>').join('') + '</select>'
        : '<div class="muted" style="padding:6px 2px">No contacts yet. <button class="link" data-action="add-contact">Add one</button> or use an account number.</div>';
    } else if (S.sendMode === 'number') {
      recipient = '<input class="input" id="send-to-num" placeholder="NEO-000003" value="' + esc(S.sendTo) + '" autocomplete="off">';
    } else {
      const mine = S.accounts.filter(a => String(a.id) !== String(S.sendFrom));
      recipient = mine.length ? '<select class="input" id="send-to-sel">' + mine.map(a => '<option value="' + esc(a.accountNumber) + '"' + (a.accountNumber === S.sendTo ? ' selected' : '') + '>' + esc(typeName(a.type)) + ' · ' + esc(a.accountNumber) + '</option>').join('') + '</select>' : '<div class="muted">You only have one account.</div>';
    }
    const rules = ['SAVINGS', 'CURRENT', 'BUSINESS', 'CHECKING'].map(t => '<div class="rule"><b>' + typeName(t) + '</b>' + esc(TYPE_INFO[t].note) + '</div>').join('');
    return head('Send money', 'Move money to a contact, any account number, or between your own accounts.') +
      '<div class="send-layout"><div class="panel"><form id="send-form" data-form="send" novalidate>' +
      '<div class="field"><label for="send-from">From</label><select class="input" id="send-from">' + (from || '<option value="">No available account</option>') + '</select></div>' +
      '<div class="seg" role="tablist">' + modes.map(m => '<button type="button" class="' + (S.sendMode === m[0] ? 'active' : '') + '" data-action="send-mode" data-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
      '<div class="field"><label>To</label>' + recipient + '</div>' +
      '<div class="field"><label for="send-amount">Amount (USD)</label><input class="input amount-input num" id="send-amount" inputmode="decimal" placeholder="0.00" autocomplete="off"></div>' +
      '<div class="chips" style="margin-bottom:14px">' + [10, 50, 100, 500].map(v => '<button type="button" class="chip-btn" data-action="amount-chip" data-v="' + v + '">$' + v + '</button>').join('') + '</div>' +
      '<div class="field"><label for="send-desc">Note (optional)</label><input class="input" id="send-desc" maxlength="80" placeholder="Dinner, rent, gift..."></div>' +
      '<div class="summary" id="send-summary">Enter an amount to see the summary.</div>' +
      '<div class="err" id="send-error" role="alert"></div>' +
      '<button class="btn btn-primary" style="width:100%;height:50px" type="submit" id="send-btn"' + (usable.length ? '' : ' disabled') + '>Send money</button></form></div>' +
      '<div class="panel"><div class="panel-title"><h2>Transfer rules</h2></div><div class="rules">' + rules + '</div></div></div>';
  };

  R.activity = function () {
    const f = S.act;
    const opts = '<option value="ALL">All accounts</option>' + S.accounts.map(a => '<option value="' + a.id + '"' + (String(f.account) === String(a.id) ? ' selected' : '') + '>' + esc(typeName(a.type)) + ' · ' + esc(a.accountNumber) + '</option>').join('');
    return head('Activity', 'Everything that moved through your accounts.') +
      '<div class="panel"><div class="row wrap" style="margin-bottom:10px"><div class="chips grow">' + [['ALL', 'All'], ['IN', 'Money in'], ['OUT', 'Money out']].map(c => '<button class="chip-btn' + (f.filter === c[0] ? ' active' : '') + '" data-action="act-filter" data-f="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
      '<select class="input" id="act-account" style="max-width:260px;height:40px">' + opts + '</select>' +
      '<input class="input" id="act-q" placeholder="Search" style="max-width:200px;height:40px" value="' + esc(f.q) + '"></div><div id="act-list">' + activityList() + '</div></div>';
  };
  function activityList() {
    const f = S.act, q = f.q.trim().toLowerCase();
    const rows = sortedTx().filter(t =>
      (f.filter === 'ALL' || (f.filter === 'IN' ? t.type === 'CREDIT' : t.type === 'DEBIT')) &&
      (f.account === 'ALL' || String(t.accountId) === String(f.account)) &&
      (!q || [t.description, t.counterpartEmail, t.counterpartAccountNumber, t.accountNumber].join(' ').toLowerCase().includes(q)));
    if (!rows.length) return emptyBox('Nothing matches these filters.');
    let html = '', cur = '';
    rows.forEach(t => {
      const k = dayKey(t.timestamp);
      if (k !== cur) { cur = k; html += '<div class="day">' + esc(dayLabel(k)) + '</div>'; }
      html += txRow(t);
    });
    return html;
  }

  R.analytics = function () {
    const b = buckets(S.range), inn = sum(b, 'inn'), out = sum(b, 'out');
    const since = Date.now() - S.range * 864e5;
    const outs = S.txs.filter(t => t.type === 'DEBIT' && !isInternal(t) && new Date(t.timestamp).getTime() >= since);
    const top = outs.slice().sort((a, c) => c.amount - a.amount).slice(0, 5);
    const groups = {};
    outs.forEach(t => { const k = t.description || t.counterpartEmail || 'Other'; groups[k] = (groups[k] || 0) + Number(t.amount); });
    const gl = Object.entries(groups).sort((a, c) => c[1] - a[1]).slice(0, 5), gmax = gl.length ? gl[0][1] : 1;
    const rate = inn > 0 ? Math.round(100 * (inn - out) / inn) : 0;
    return head('Analytics', 'Transfers between your own accounts are left out.',
      '<div class="chips">' + [7, 30, 90].map(d => '<button class="chip-btn' + (S.range === d ? ' active' : '') + '" data-action="range" data-d="' + d + '">' + d + ' days</button>').join('') + '</div>') +
      '<div class="grid">' +
      '<div class="stats4"><div class="panel stat"><small>Money in</small><b class="in num">' + money(inn) + '</b></div><div class="panel stat"><small>Money out</small><b class="out num">' + money(out) + '</b></div><div class="panel stat"><small>Net</small><b class="num">' + (inn - out < 0 ? '−' : '+') + money(Math.abs(inn - out)) + '</b></div><div class="panel stat"><small>Saved</small><b>' + (inn > 0 ? rate + '%' : '–') + '</b></div></div>' +
      '<div class="panel"><div class="panel-title"><h2>Money in and out</h2><div class="legend"><span><i style="background:#2ecc8f"></i>In</span><span><i style="background:#ff5d6c"></i>Out</span></div></div>' + barChart(b) + '</div>' +
      '<div class="two"><div class="panel"><div class="panel-title"><h2>Total balance</h2></div>' + areaChart(balanceSeries(S.range), 'a') + '</div>' +
      '<div class="panel"><div class="panel-title"><h2>Where it went</h2></div>' + (gl.length ? '<div class="bars-h">' + gl.map(g => '<div class="bar-row"><div class="bar-label"><span>' + esc(g[0]) + '</span><b class="num">' + money(g[1]) + '</b></div><div class="track"><div class="fill" style="width:' + Math.max(4, 100 * g[1] / gmax) + '%"></div></div></div>').join('') + '</div>' : emptyBox('No spending in this period.')) + '</div></div>' +
      '<div class="panel"><div class="panel-title"><h2>Biggest payments</h2></div>' + (top.length ? top.map(txRow).join('') : emptyBox('No payments in this period.')) + '</div></div>';
  };

  R.contacts = function () {
    const cards = S.contacts.map(c => '<div class="panel contact"><div class="head">' + contactAvatar(c) + '<div style="min-width:0"><b>' + esc(c.name) + '</b><small class="muted num">' + esc(c.accountNumber) + '</small></div></div><div class="row"><button class="btn btn-primary btn-sm grow" data-action="quick-send" data-num="' + esc(c.accountNumber) + '">' + icon('send', 16) + ' Send</button><button class="icon-btn" data-action="delete-contact" data-id="' + c.id + '" aria-label="Delete ' + esc(c.name) + '">' + icon('trash', 16) + '</button></div></div>').join('');
    return head('Contacts', 'Save people you pay often.', '<button class="btn btn-primary" data-action="add-contact">' + icon('plus', 18) + ' Add contact</button>') +
      (cards ? '<div class="contact-grid">' + cards + '</div>' : '<div class="panel">' + emptyBox('No contacts yet. Add one with their NeoBank account number.') + '</div>');
  };

  R.profile = function () {
    const u = S.user || {};
    return head('Profile', 'Your details and security.') +
      '<div class="grid"><div class="panel"><div class="profile-head"><label class="upload"><div class="avatar lg" id="profile-avatar"></div><span class="cam">' + icon('camera', 15) + '</span><input type="file" id="avatar-file" accept="image/*"></label>' +
      '<div><h2 style="font-size:1.4rem">' + esc(u.name) + '</h2><p class="muted">' + esc(u.email) + '</p><p class="muted">Member since ' + esc(u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '–') + '</p></div></div>' +
      '<div style="margin-top:18px"><div class="kv"><span>Phone</span><span>' + esc(u.phone || '–') + '</span></div><div class="kv"><span>Address</span><span>' + esc(u.address || '–') + '</span></div><div class="kv"><span>Accounts</span><span>' + S.accounts.length + '</span></div></div></div>' +
      '<div class="two"><div class="panel"><div class="panel-title"><h2>Change password</h2></div><form data-form="password" novalidate>' +
      '<div class="field"><label for="pw-cur">Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>' +
      '<div class="field"><label for="pw-new">New password (6+ characters)</label><input class="input" id="pw-new" type="password" autocomplete="new-password"></div>' +
      '<div class="field"><label for="pw-new2">Repeat new password</label><input class="input" id="pw-new2" type="password" autocomplete="new-password"></div>' +
      '<div class="err" id="pw-error" role="alert"></div><button class="btn btn-primary" type="submit">Update password</button></form></div>' +
      '<div class="panel"><div class="panel-title"><h2>Security</h2></div><div class="checklist"><div><i>' + icon('check', 18) + '</i> Passwords are stored with BCrypt</div><div><i>' + icon('check', 18) + '</i> Sessions use signed JWT tokens</div><div><i>' + icon('check', 18) + '</i> You can only see and change your own data</div><div><i>' + icon('check', 18) + '</i> Frozen cards cannot send money</div></div>' +
      '<button class="btn btn-danger" style="margin-top:20px" data-action="logout">' + icon('logout', 18) + ' Log out</button></div></div></div>';
  };

  // ---------------------------------------------------------------- navigation
  function buildNav() {
    $('#side-nav').innerHTML = PAGES.map(p => '<a href="#/' + p.id + '" data-nav="' + p.id + '">' + icon(p.icon, 20) + '<span>' + p.label + '</span></a>').join('');
    const tab = (id, label, ic) => '<a href="#/' + id + '" data-nav="' + id + '">' + icon(ic, 23) + '<span>' + label + '</span></a>';
    $('#tabbar').innerHTML = tab('dashboard', 'Home', 'home') + tab('cards', 'Cards', 'card') +
      '<a class="send-fab" href="#/send" data-nav="send" aria-label="Send"><span class="fab">' + icon('send', 24) + '</span></a>' +
      tab('activity', 'Activity', 'activity') +
      '<button data-action="more-sheet" data-nav="more" aria-label="More">' + icon('more', 23) + '<span>More</span></button>';
  }
  function markNav() {
    const morePages = ['analytics', 'contacts', 'profile'];
    $$('[data-nav]').forEach(el => {
      const id = el.dataset.nav;
      const on = id === S.page || (id === 'more' && morePages.includes(S.page));
      el.classList.toggle('active', on && el.closest('.sidebar') !== null);
      el.classList.toggle('on', on && el.closest('.tabbar') !== null);
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }
  function currentPage() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    return PAGES.some(p => p.id === h) ? h : 'dashboard';
  }
  function render(page) {
    S.page = page || S.page;
    $$('.page').forEach(p => p.classList.toggle('hidden', p.id !== 'page-' + S.page));
    $('#page-' + S.page).innerHTML = R[S.page]();
    if (S.page === 'profile') setBg($('#profile-avatar'), S.user && S.user.profilePicture);
    if (S.page === 'send') updateSummary();
    markNav();
    paintIcons($('#page-' + S.page));
  }
  function go(p) { if (location.hash === '#/' + p) render(p); else location.hash = '#/' + p; }
  window.addEventListener('hashchange', () => { if (S.token && S.user) { closeSheet(); window.scrollTo(0, 0); render(currentPage()); } });
  async function refresh(keepPage) { await loadAll(); render(keepPage ? S.page : currentPage()); }

  function closeSheet() { $('#sheet-root').innerHTML = ''; }
  function moreSheet() {
    const item = (p, l, ic) => '<a class="tx" href="#/' + p + '" style="padding:14px 4px"><div class="ico self">' + icon(ic, 20) + '</div><div class="meta"><b>' + l + '</b></div></a>';
    $('#sheet-root').innerHTML = '<div class="sheet" data-action="close-sheet"><div class="inner"><div class="grab"></div>' + item('analytics', 'Analytics', 'chart') + item('contacts', 'Contacts', 'users') + item('profile', 'Profile', 'user') +
      '<button class="tx" data-action="logout" style="width:100%;padding:14px 4px"><div class="ico out">' + icon('logout', 20) + '</div><div class="meta" style="text-align:left"><b>Log out</b></div></button></div></div>';
  }

  // ---------------------------------------------------------------- auth
  function showAuth() { $('#auth').classList.remove('hidden'); $('#app').classList.add('hidden'); paintIcons($('#auth')); }
  async function enter() {
    $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
    buildNav();
    await loadAll();
    render(currentPage());
    paintIcons(document);
  }
  function parseJwt(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; } }
  function startSession(token, userId) {
    S.token = token; S.userId = userId;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* private mode */ }
  }
  function logout(expired) {
    S.token = null; S.user = null; S.userId = null; S.accounts = []; S.txs = []; S.contacts = []; S.reveal = {};
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    closeModal(); closeSheet();
    history.replaceState(null, '', location.pathname);
    showAuth();
    if (expired === true) toast('Your session ended. Please log in again.', 'error');
  }
  async function boot() {
    let t = null; try { t = localStorage.getItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    const p = t && parseJwt(t);
    if (p && p.exp * 1000 > Date.now() && p.sub) {
      try { startSession(t, Number(p.sub)); await enter(); return; } catch (e) { /* fall through */ }
    }
    logout();
  }
  function authTab(tab) {
    const login = tab === 'login';
    $('#form-login').classList.toggle('hidden', !login);
    $('#form-register').classList.toggle('hidden', login);
    $('#tab-login').classList.toggle('active', login);
    $('#tab-register').classList.toggle('active', !login);
    $('#auth-title').textContent = login ? 'Welcome back' : 'Create your account';
    $('#auth-sub').textContent = login ? 'Log in to see your accounts.' : 'It takes less than a minute.';
  }

  // ---------------------------------------------------------------- actions
  function updateSummary() {
    const el = $('#send-summary'); if (!el) return;
    const amt = parseFloat(($('#send-amount') || {}).value);
    const to = recipientValue();
    const from = S.accounts.find(a => String(a.id) === String(S.sendFrom));
    if (!(amt > 0) || !from) { el.textContent = 'Enter an amount to see the summary.'; return; }
    const c = S.contacts.find(x => x.accountNumber === to);
    el.innerHTML = 'You send <b>' + money(amt) + '</b> to <b>' + esc(c ? c.name : (to || 'the recipient')) + '</b>. ' + esc(typeName(from.type)) + ' balance after: <b>' + money(Number(from.balance) - amt) + '</b>.';
  }
  function recipientValue() {
    const sel = $('#send-to-sel'), num = $('#send-to-num');
    return (S.sendMode === 'number' ? (num && num.value) : (sel && sel.value) || '').trim().toUpperCase();
  }

  async function submitSend(form) {
    const err = $('#send-error'), btn = $('#send-btn');
    err.textContent = '';
    const from = S.accounts.find(a => String(a.id) === String(S.sendFrom));
    const to = recipientValue(), amount = parseFloat($('#send-amount').value);
    if (!from) { err.textContent = 'Choose an account to send from.'; return; }
    if (!to) { err.textContent = 'Choose who you are sending to.'; return; }
    if (!(amount > 0)) { err.textContent = 'Enter an amount greater than zero.'; return; }
    const desc = $('#send-desc').value.trim();
    busy(btn, true);
    try {
      await api('/api/transfer', { method: 'POST', body: { fromAccountNumber: from.accountNumber, toAccountNumber: to, amount: amount, description: desc || undefined } });
      const c = S.contacts.find(x => x.accountNumber === to);
      await loadAll();
      busy(btn, false, 'Send money');
      openModal('<div class="receipt"><div class="tick">' + icon('check', 32) + '</div><h2>Money sent</h2><p class="muted" style="margin-bottom:14px">Your transfer is complete.</p></div>' +
        '<div class="kv"><span>Amount</span><b class="num">' + money(amount) + '</b></div><div class="kv"><span>To</span><span>' + esc(c ? c.name + ' · ' : '') + esc(to) + '</span></div><div class="kv"><span>From</span><span>' + esc(from.accountNumber) + '</span></div>' + (desc ? '<div class="kv"><span>Note</span><span>' + esc(desc) + '</span></div>' : '') +
        '<div class="btns"><button class="btn btn-ghost" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="go" data-page="activity">View activity</button></div>');
      S.sendTo = '';
      render('send');
    } catch (e) { busy(btn, false, 'Send money'); err.textContent = e.message; }
  }

  function openAccountModal() {
    openModal('<h2>Open a new account</h2><p class="muted" style="margin-bottom:16px">Pick a type. You can have as many as you like.</p><form data-form="new-account" novalidate>' +
      '<div class="field"><label for="na-type">Type</label><select class="input" id="na-type">' + Object.keys(TYPE_INFO).map(t => '<option value="' + t + '">' + typeName(t) + '</option>').join('') + '</select></div>' +
      '<div class="muted" id="na-note" style="font-size:.85rem;margin-bottom:14px"></div>' +
      '<div class="field hidden" id="na-limit-wrap"><label for="na-limit" id="na-limit-label">Credit limit</label><input class="input" id="na-limit" inputmode="decimal"></div>' +
      '<div class="field hidden" id="na-dep-wrap"><label for="na-dep">Opening deposit (USD, optional)</label><input class="input" id="na-dep" inputmode="decimal" placeholder="0.00" value=""></div>' +
      '<div class="err" id="na-error" role="alert"></div>' +
      '<div class="btns"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Open account</button></div></form>');
    syncAccountForm();
  }
  function syncAccountForm() {
    const t = $('#na-type'); if (!t) return;
    const v = t.value;
    $('#na-note').textContent = TYPE_INFO[v].note;
    const limit = CREDIT_TYPES.includes(v) && v !== 'BUSINESS';
    $('#na-limit-wrap').classList.toggle('hidden', !limit);
    $('#na-dep-wrap').classList.toggle('hidden', CREDIT_TYPES.includes(v) && v !== 'BUSINESS');
    if (limit) { $('#na-limit-label').textContent = 'Credit limit (100 to ' + money(CREDIT_MAX[v]).replace('.00', '') + ')'; $('#na-limit').value = Math.min(1000, CREDIT_MAX[v]); }
  }
  async function submitNewAccount() {
    const err = $('#na-error'); err.textContent = '';
    const type = $('#na-type').value;
    const body = { userId: S.userId, type: type };
    if (CREDIT_TYPES.includes(type) && type !== 'BUSINESS') {
      const l = parseFloat($('#na-limit').value);
      if (!(l >= 100) || l > CREDIT_MAX[type]) { err.textContent = 'Credit limit must be between 100 and ' + CREDIT_MAX[type] + '.'; return; }
      body.creditLimit = l;
    } else {
      const d = parseFloat($('#na-dep').value || '0');
      if (isNaN(d) || d < 0) { err.textContent = 'Opening deposit cannot be negative.'; return; }
      if (d > 1000000) { err.textContent = 'Opening deposit cannot be more than $1,000,000.'; return; }
      body.initialDeposit = d;
    }
    try {
      await api('/api/accounts', { method: 'POST', body });
      closeModal(); toast(typeName(type) + ' account opened.'); await refresh(true);
    } catch (e) { err.textContent = e.message; }
  }

  function addContactModal(prefill) {
    openModal('<h2>Add contact</h2><p class="muted" style="margin-bottom:16px">Use the NeoBank account number of the person you want to pay.</p><form data-form="contact" novalidate>' +
      '<div class="field"><label for="ct-name">Name</label><input class="input" id="ct-name" maxlength="60" placeholder="Bob Demo"></div>' +
      '<div class="field"><label for="ct-num">Account number</label><input class="input" id="ct-num" maxlength="20" placeholder="NEO-000003" value="' + esc(prefill || '') + '"></div>' +
      '<div class="err" id="ct-error" role="alert"></div><div class="btns"><button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save contact</button></div></form>');
  }
  async function submitContact() {
    const err = $('#ct-error'); err.textContent = '';
    const name = $('#ct-name').value.trim(), num = $('#ct-num').value.trim();
    if (!name || !num) { err.textContent = 'Name and account number are required.'; return; }
    try {
      await api('/api/contacts', { method: 'POST', body: { name: name, accountNumber: num } });
      closeModal(); toast('Contact saved.'); await refresh(true);
    } catch (e) { err.textContent = e.message; }
  }

  async function submitPassword() {
    const err = $('#pw-error'); err.textContent = '';
    const cur = $('#pw-cur').value, nw = $('#pw-new').value, nw2 = $('#pw-new2').value;
    if (!cur || !nw) { err.textContent = 'Fill in all fields.'; return; }
    if (nw.length < 6) { err.textContent = 'New password needs at least 6 characters.'; return; }
    if (nw !== nw2) { err.textContent = 'The new passwords do not match.'; return; }
    try {
      await api('/api/users/me/password', { method: 'POST', body: { currentPassword: cur, newPassword: nw } });
      toast('Password updated.'); render('profile');
    } catch (e) { err.textContent = e.message; }
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
        const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
        c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, s, s);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a usable image.')); };
      img.src = url;
    });
  }

  async function accountHistory(id) {
    const a = S.accounts.find(x => String(x.id) === String(id)); if (!a) return;
    const rows = sortedTx().filter(t => String(t.accountId) === String(id)).slice(0, 8);
    openModal('<h2>' + esc(typeName(a.type)) + ' · ' + esc(a.accountNumber) + '</h2><p class="muted" style="margin-bottom:8px">Latest activity</p>' + (rows.length ? rows.map(txRow).join('') : emptyBox('No transactions yet.')) +
      '<div class="btns"><button class="btn btn-ghost" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="open-activity" data-id="' + a.id + '">Open in Activity</button></div>');
  }

  async function deleteAccount(id) {
    const a = S.accounts.find(x => String(x.id) === String(id)); if (!a) return;
    const ok = await confirmDialog('Close ' + typeName(a.type) + ' account?', 'The balance must be zero. We will process the request within about a minute and the account is removed for good.', 'Request closing', true);
    if (!ok) return;
    try { const r = await api('/api/accounts/' + id + '/deletion-request', { method: 'POST' }); toast((r && r.message) || 'Closing request sent.'); }
    catch (e) { toast(e.message, 'error'); }
  }

  // ---------------------------------------------------------------- events
  const actions = {
    'auth-tab': el => authTab(el.dataset.tab),
    'fill-demo': () => { $('#login-email').value = 'alice@example.com'; $('#login-password').value = 'alice123'; },
    'go': el => { closeModal(); closeSheet(); go(el.dataset.page); },
    'logout': async () => { if (await confirmDialog('Log out?', 'You will need to log in again to see your accounts.', 'Log out')) { logout(); } },
    'close-modal': () => closeModal(),
    'close-sheet': (el, e) => { if (e.target === el) closeSheet(); },
    'more-sheet': () => moreSheet(),
    'open-account': () => openAccountModal(),
    'add-contact': () => addContactModal(),
    'scroll-cards': el => { const c = $('#page-dashboard .carousel'); if (c) c.scrollBy({ left: Number(el.dataset.dir) * 340, behavior: 'smooth' }); },
    'toggle-reveal': el => { S.reveal[el.dataset.id] = !S.reveal[el.dataset.id]; render(); },
    'toggle-freeze': async el => {
      const a = S.accounts.find(x => String(x.id) === String(el.dataset.id)); if (!a) return;
      try { await api('/api/accounts/' + a.id + (a.frozen ? '/unfreeze' : '/freeze'), { method: 'POST' }); toast(a.frozen ? 'Card unfrozen.' : 'Card frozen. It cannot send money now.'); await refresh(true); }
      catch (e) { toast(e.message, 'error'); }
    },
    'account-history': el => accountHistory(el.dataset.id),
    'open-activity': el => { closeModal(); S.act = { filter: 'ALL', account: el.dataset.id, q: '' }; go('activity'); },
    'delete-account': el => deleteAccount(el.dataset.id),
    'quick-send': el => { S.sendMode = 'contacts'; S.sendTo = el.dataset.num; if (!S.contacts.some(c => c.accountNumber === S.sendTo)) S.sendMode = 'number'; go('send'); },
    'send-mode': el => { S.sendMode = el.dataset.mode; S.sendTo = ''; render('send'); },
    'amount-chip': el => { $('#send-amount').value = el.dataset.v; updateSummary(); },
    'act-filter': el => { S.act.filter = el.dataset.f; render(); },
    'range': el => { S.range = Number(el.dataset.d); render(); },
    'delete-contact': async el => {
      const c = S.contacts.find(x => String(x.id) === String(el.dataset.id)); if (!c) return;
      if (!await confirmDialog('Delete ' + c.name + '?', 'They will be removed from your contacts. Past transfers stay in your activity.', 'Delete', true)) return;
      try { await api('/api/contacts/' + c.id, { method: 'DELETE' }); toast('Contact deleted.'); await refresh(true); } catch (e) { toast(e.message, 'error'); }
    }
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSheet(); } });

  document.addEventListener('submit', async e => {
    const form = e.target;
    e.preventDefault();
    if (form.id === 'form-login') {
      const err = $('#login-error'), btn = $('#btn-login'); err.textContent = '';
      const email = $('#login-email').value.trim(), password = $('#login-password').value;
      if (!email || !password) { err.textContent = 'Enter your email and password.'; return; }
      busy(btn, true);
      try { const d = await api('/api/auth/login', { method: 'POST', body: { email, password } }); startSession(d.token, d.userId); await enter(); }
      catch (x) { err.textContent = x.message; }
      busy(btn, false, 'Log in');
    } else if (form.id === 'form-register') {
      const err = $('#register-error'), btn = $('#btn-register'); err.textContent = '';
      const body = { name: $('#reg-name').value.trim(), email: $('#reg-email').value.trim(), password: $('#reg-password').value, phone: $('#reg-phone').value.trim() || undefined };
      if (!body.name || !body.email || body.password.length < 6) { err.textContent = 'Name, email and a 6+ character password are required.'; return; }
      busy(btn, true);
      try { const d = await api('/api/auth/register', { method: 'POST', body }); startSession(d.token, d.userId); await enter(); }
      catch (x) { err.textContent = x.message; }
      busy(btn, false, 'Create account');
    } else {
      const kind = form.dataset.form;
      if (kind === 'send') submitSend(form);
      else if (kind === 'new-account') submitNewAccount();
      else if (kind === 'contact') submitContact();
      else if (kind === 'password') submitPassword();
    }
  });

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'send-amount' || id === 'send-to-num') { if (id === 'send-to-num') S.sendTo = e.target.value; updateSummary(); }
    else if (id === 'act-q') { S.act.q = e.target.value; $('#act-list').innerHTML = activityList(); paintIcons($('#act-list')); }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'send-from') { S.sendFrom = t.value; if (S.sendMode === 'mine') render('send'); else updateSummary(); }
    else if (t.id === 'send-to-sel') { S.sendTo = t.value; updateSummary(); }
    else if (t.id === 'act-account') { S.act.account = t.value; $('#act-list').innerHTML = activityList(); }
    else if (t.id === 'na-type') syncAccountForm();
    else if (t.id === 'avatar-file' && t.files && t.files[0]) {
      try {
        const data = await resizeImage(t.files[0]);
        await api('/api/users/' + S.userId + '/profile-picture', { method: 'PATCH', body: { profilePicture: data } });
        S.user.profilePicture = data; paintUser(); setBg($('#profile-avatar'), data); toast('Photo updated.');
      } catch (x) { toast(x.message, 'error'); }
    }
  });

  // drag a card row with the mouse (touch and trackpads already scroll natively)
  (function () {
    let row = null, startX = 0, startLeft = 0, moved = false;
    document.addEventListener('mousedown', e => {
      const c = e.target.closest('.carousel'); if (!c) return;
      row = c; startX = e.pageX; startLeft = c.scrollLeft; moved = false; c.classList.add('dragging');
    });
    document.addEventListener('mousemove', e => {
      if (!row) return;
      const dx = e.pageX - startX; if (Math.abs(dx) > 3) moved = true;
      row.scrollLeft = startLeft - dx;
    });
    document.addEventListener('mouseup', () => { if (row) { row.classList.remove('dragging'); row = null; } });
    document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.carousel')) e.preventDefault(); });
  })();

  boot();
})();
