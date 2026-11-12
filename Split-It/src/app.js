'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openDb } = require('./db');
const { createBillsService, publicUser } = require('./bills');
const { randomCode, HttpError, bad, normalizePhone } = require('./util');
const Avatar = require('./avatar');

const NM = path.join(__dirname, '..', 'node_modules');

/** Very small in-memory rate limiter: `max` requests per `windowMs` for each IP and bucket name. */
function limiter(name, max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const key = name + ':' + req.ip, now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) return next(new HttpError(429, 'Too many tries. Please wait a little and try again.'));
    recent.push(now); hits.set(key, recent);
    next();
  };
}

function createApp(options) {
  const config = Object.assign({
    dbFile: ':memory:',
    jwtSecret: process.env.SPLITIT_JWT_SECRET || '',
    pepper: process.env.SPLITIT_PEPPER || '',
    defaultCc: process.env.SPLITIT_DEFAULT_CC || '355',
    aiKey: process.env.ANTHROPIC_API_KEY || '',
    aiModel: process.env.SPLITIT_AI_MODEL || 'claude-sonnet-5-5',
    rateLimit: true,
    fetch: globalThis.fetch
  }, options || {});
  // Without configured secrets we make random ones: fine for a demo, but logins end when the server restarts.
  if (!config.jwtSecret) config.jwtSecret = crypto.randomBytes(32).toString('hex');
  if (!config.pepper) config.pepper = crypto.randomBytes(32).toString('hex');
  if (config.jwtSecret.length < 32) throw new Error('SPLITIT_JWT_SECRET must be at least 32 characters.');

  const db = config.db || openDb(config.dbFile);
  const bills = createBillsService(db);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  const q = {
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    byCode: db.prepare('SELECT * FROM users WHERE share_code = ?'),
    codeTaken: db.prepare('SELECT 1 FROM users WHERE share_code = ?'),
    insUser: db.prepare('INSERT INTO users (name,email,password_hash,phone_hash,share_code,color) VALUES (?,?,?,?,?,?)'),
    setProfile: db.prepare('UPDATE users SET name=?, phone_hash=?, color=? WHERE id=?'),
    friends: db.prepare('SELECT u.* FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.name'),
    isFriend: db.prepare('SELECT 1 FROM friends WHERE user_id=? AND friend_id=?'),
    addFriend: db.prepare('INSERT OR IGNORE INTO friends (user_id,friend_id) VALUES (?,?)'),
    delFriend: db.prepare('DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)'),
    byPhone: db.prepare('SELECT * FROM users WHERE phone_hash = ?')
  };

  const phoneHash = raw => {
    const n = normalizePhone(raw, config.defaultCc);
    return n ? crypto.createHmac('sha256', config.pepper).update(n).digest('hex') : null;
  };
  const newShareCode = () => {
    for (let i = 0; i < 20; i++) { const c = 'SP-' + randomCode(4); if (!q.codeTaken.get(c)) return c; }
    throw new HttpError(500, 'Could not create a share code. Try again.');
  };
  const meDto = u => ({ id: u.id, name: u.name, email: u.email, shareCode: u.share_code, color: u.color, avatar: u.color, hasPhone: !!u.phone_hash });
  const sign = u => jwt.sign({ sub: String(u.id) }, config.jwtSecret, { expiresIn: '7d' });

  function registerUser({ name, email, password, phone, avatar }) {
    name = String(name || '').trim().slice(0, 40);
    email = String(email || '').trim().toLowerCase().slice(0, 120);
    password = String(password || '');
    if (!name) throw bad('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Please enter a valid email.');
    if (password.length < 6 || password.length > 100) throw bad('Password needs 6 to 100 characters.');
    if (q.byEmail.get(email)) throw bad('That email is already registered.');
    let ph = null;
    if (phone) { ph = phoneHash(phone); if (!ph) throw bad('That phone number does not look right.'); }
    // The users.color column holds the avatar code ("av:3.1.2.4"). Older rows may hold a plain colour and show initials.
    const color = Avatar.isCode(avatar) ? avatar : Avatar.random();
    const info = q.insUser.run(name, email, bcrypt.hashSync(password, 10), ph, newShareCode(), color);
    return q.byId.get(Number(info.lastInsertRowid));
  }

  // ---- middleware ----
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(self), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' data: blob:; media-src 'self' blob:; frame-ancestors 'none'"
    });
    next();
  });
  app.use('/api/receipt/ai', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '100kb' }));

  const rl = config.rateLimit ? limiter : () => (req, res, next) => next();
  const authLimit = rl('auth', 25, 10 * 60 * 1000);
  const matchLimit = rl('match', 20, 60 * 60 * 1000);
  const aiLimit = rl('ai', 20, 60 * 60 * 1000);

  const auth = (req, res, next) => {
    const h = req.get('Authorization') || '';
    if (!h.startsWith('Bearer ')) return next(new HttpError(401, 'Please log in.'));
    try {
      const p = jwt.verify(h.slice(7), config.jwtSecret);
      const u = q.byId.get(Number(p.sub));
      if (!u) throw new Error('gone');
      req.user = u; next();
    } catch (e) { next(new HttpError(401, 'Your session ended. Please log in again.')); }
  };
  const wrap = fn => (req, res, next) => { try { const r = fn(req, res); if (r !== undefined) res.json(r); } catch (e) { next(e); } };
  const intParam = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Not found.'); return n; };

  // ---- public ----
  app.get('/api/config', (req, res) => res.json({ aiScan: !!config.aiKey }));

  app.post('/api/auth/register', authLimit, wrap(req => {
    const u = registerUser(req.body || {});
    return { token: sign(u), user: meDto(u) };
  }));
  app.post('/api/auth/login', authLimit, wrap(req => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const u = q.byEmail.get(email);
    // same message for "no such email" and "wrong password"
    if (!u || !bcrypt.compareSync(String((req.body && req.body.password) || ''), u.password_hash)) throw new HttpError(401, 'Wrong email or password.');
    return { token: sign(u), user: meDto(u) };
  }));

  // ---- me ----
  app.get('/api/me', auth, wrap(req => meDto(req.user)));
  app.patch('/api/me', auth, wrap(req => {
    const b = req.body || {};
    const name = b.name == null ? req.user.name : String(b.name).trim().slice(0, 40);
    if (!name) throw bad('Name cannot be empty.');
    let ph = req.user.phone_hash;
    if (b.phone !== undefined) {
      if (b.phone === '' || b.phone === null) ph = null;
      else { ph = phoneHash(b.phone); if (!ph) throw bad('That phone number does not look right.'); }
    }
    let color = req.user.color;
    if (b.avatar !== undefined) {
      if (!Avatar.isCode(b.avatar)) throw bad('That avatar is not valid.');
      color = b.avatar;
    }
    q.setProfile.run(name, ph, color, req.user.id);
    return meDto(q.byId.get(req.user.id));
  }));

  // ---- friends ----
  app.get('/api/friends', auth, wrap(req => q.friends.all(req.user.id).map(publicUser)));
  app.post('/api/friends/add', auth, wrap(req => {
    const code = String((req.body && req.body.code) || '').trim().toUpperCase().replace(/\s+/g, '');
    const normalized = code.startsWith('SP-') ? code : (code.length === 4 ? 'SP-' + code : code.replace(/^SP/, 'SP-'));
    const f = q.byCode.get(normalized);
    if (!f) throw new HttpError(404, 'No one has that code. Check it with your friend.');
    if (f.id === req.user.id) throw bad('That is your own code.');
    db.transaction(() => { q.addFriend.run(req.user.id, f.id); q.addFriend.run(f.id, req.user.id); })();
    return publicUser(f);
  }));
  app.delete('/api/friends/:id', auth, wrap(req => {
    const id = intParam(req.params.id);
    q.delFriend.run(req.user.id, id, id, req.user.id);
    return { ok: true };
  }));
  // Contact matching: the phone sends numbers from the address book, we compare them privately and keep nothing.
  app.post('/api/friends/match', auth, matchLimit, wrap(req => {
    const nums = Array.isArray(req.body && req.body.numbers) ? req.body.numbers.slice(0, 2000) : [];
    const seen = new Set(), out = [];
    for (const raw of nums) {
      const h = phoneHash(raw);
      if (!h || seen.has(h)) continue;
      seen.add(h);
      for (const u of q.byPhone.all(h)) {
        if (u.id === req.user.id) continue;
        out.push(Object.assign(publicUser(u), { isFriend: !!q.isFriend.get(req.user.id, u.id) }));
      }
    }
    return out;
  }));

  // ---- bills ----
  app.get('/api/summary', auth, wrap(req => bills.summary(req.user.id)));
  app.get('/api/bills', auth, wrap(req => bills.list(req.user.id)));
  app.post('/api/bills', auth, wrap((req, res) => { res.status(201); return bills.create(req.user.id, req.body); }));
  app.post('/api/bills/join', auth, wrap(req => bills.join(req.user.id, req.body && req.body.code)));
  app.get('/api/bills/:id', auth, wrap(req => bills.get(intParam(req.params.id), req.user.id)));
  app.put('/api/bills/:id', auth, wrap(req => bills.update(intParam(req.params.id), req.user.id, req.body)));
  app.delete('/api/bills/:id', auth, wrap(req => { bills.remove(intParam(req.params.id), req.user.id); return { ok: true }; }));
  app.post('/api/bills/:id/members/:mid/paid', auth, wrap(req =>
    bills.setPaid(intParam(req.params.id), intParam(req.params.mid), req.user.id, !(req.body && req.body.paid === false))));

  // ---- optional AI receipt reading (only if ANTHROPIC_API_KEY is set) ----
  app.post('/api/receipt/ai', auth, aiLimit, async (req, res, next) => {
    try {
      if (!config.aiKey) throw new HttpError(501, 'AI scanning is not switched on. The built-in scanner is used instead.');
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body && req.body.image) || ''));
      if (!m) throw bad('Send the photo as a JPEG, PNG or WebP data URL.');
      const r = await config.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': config.aiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: config.aiModel, max_tokens: 1500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
            { type: 'text', text: 'Read this receipt. Reply with JSON only, no other text, shaped exactly like {"merchant":string,"currency":string|null,"items":[{"name":string,"price":number,"qty":number}],"tax":number,"tip":number}. "price" is the price of ONE unit as printed. Leave out the total, subtotal and payment lines. Use 0 for tax or tip if absent.' }
          ] }]
        })
      });
      if (!r.ok) throw new HttpError(502, 'The scanning service could not read that photo (' + r.status + ').');
      const data = await r.json();
      const text = (data.content || []).map(c => c.text || '').join('');
      const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      const cents = v => Math.max(0, Math.round((Number(v) || 0) * 100));
      res.json({
        merchant: String(j.merchant || '').slice(0, 80), currency: j.currency ? String(j.currency).slice(0, 3).toUpperCase() : null,
        items: (Array.isArray(j.items) ? j.items : []).slice(0, 100).map(i => ({
          name: String(i.name || 'Item').slice(0, 80), priceCents: cents(i.price), qty: Math.min(99, Math.max(1, parseInt(i.qty, 10) || 1))
        })),
        taxCents: cents(j.tax), tipCents: cents(j.tip)
      });
    } catch (e) { next(e instanceof SyntaxError ? new HttpError(502, 'The scanner returned something unreadable. Try again or use the built-in scan.') : e); }
  });

  // ---- front end and the OCR engine (served from node_modules, so no internet needed) ----
  app.get('/shared/avatar.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'avatar.js')));
  app.get('/shared/split.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'split.js')));
  app.use('/vendor/tesseract', express.static(path.join(NM, 'tesseract.js', 'dist')));
  app.use('/vendor/tesseract-core', express.static(path.join(NM, 'tesseract.js-core')));
  app.use('/vendor/lang', express.static(path.join(NM, '@tesseract.js-data', 'eng', '4.0.0_best_int')));
  app.use('/vendor/qr', express.static(path.join(NM, 'qrcode-generator', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') err = bad('That request could not be read.');
    if (err.type === 'entity.too.large') err = new HttpError(413, 'That is too large.');
    const status = err.status || 500;
    if (!err.status) console.error(err);
    res.status(status).json({ error: status >= 500 && !err.status ? 'Something went wrong.' : err.message });
  });

  return { app, db, config, registerUser };
}

module.exports = { createApp };
