'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

async function start(extra) {
  const ctx = createApp(Object.assign({ rateLimit: false, jwtSecret: 'x'.repeat(40), pepper: 'pepper' }, extra));
  const server = await new Promise(r => { const s = ctx.app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let json = null; try { json = await res.json(); } catch (e) { /* none */ }
    return { status: res.status, body: json };
  };
  const signup = async (name, phone) => {
    const r = await call('POST', '/api/auth/register', { name, email: name.toLowerCase() + '@t.com', password: 'secret1', phone });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { token: r.body.token, user: r.body.user };
  };
  return { ...ctx, server, call, signup, close: () => server.close() };
}

test('registration and login validate input and never reveal which part was wrong', async t => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call('POST', '/api/auth/register', { name: '', email: 'a@b.co', password: 'secret1' })).status, 400);
  assert.equal((await s.call('POST', '/api/auth/register', { name: 'A', email: 'nope', password: 'secret1' })).status, 400);
  assert.equal((await s.call('POST', '/api/auth/register', { name: 'A', email: 'a@b.co', password: '123' })).status, 400);
  await s.signup('Ann');
  assert.equal((await s.call('POST', '/api/auth/register', { name: 'Ann', email: 'ann@t.com', password: 'secret1' })).status, 400); // duplicate
  const wrongPw = await s.call('POST', '/api/auth/login', { email: 'ann@t.com', password: 'bad' });
  const noUser = await s.call('POST', '/api/auth/login', { email: 'zzz@t.com', password: 'bad' });
  assert.equal(wrongPw.status, 401);
  assert.equal(wrongPw.body.error, noUser.body.error);
  assert.equal((await s.call('POST', '/api/auth/login', { email: 'ann@t.com', password: 'secret1' })).status, 200);
});

test('the API needs a login and rejects bad tokens', async t => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.call('GET', '/api/bills')).status, 401);
  assert.equal((await s.call('GET', '/api/bills', undefined, 'garbage')).status, 401);
  assert.equal((await s.call('GET', '/api/nothing')).status, 404);
});

test('friends can be added with a share code, and not with a wrong or own code', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann'), bob = await s.signup('Bob');
  assert.match(ann.user.shareCode, /^SP-[A-Z0-9]{4}$/);
  assert.equal((await s.call('POST', '/api/friends/add', { code: 'SP-ZZZZ' }, ann.token)).status, 404);
  assert.equal((await s.call('POST', '/api/friends/add', { code: ann.user.shareCode }, ann.token)).status, 400);
  const add = await s.call('POST', '/api/friends/add', { code: bob.user.shareCode.toLowerCase() }, ann.token);
  assert.equal(add.status, 200); assert.equal(add.body.name, 'Bob');
  assert.equal((await s.call('GET', '/api/friends', undefined, ann.token)).body.length, 1);
  assert.equal((await s.call('GET', '/api/friends', undefined, bob.token)).body.length, 1); // it works both ways
  assert.equal((await s.call('DELETE', '/api/friends/' + bob.user.id, undefined, ann.token)).status, 200);
  assert.equal((await s.call('GET', '/api/friends', undefined, bob.token)).body.length, 0);
});

test('contact matching finds registered people from phone numbers in different formats, and nobody else', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann', '+355 69 111 2222');
  const bob = await s.signup('Bob', '069 333 4444');
  await s.signup('Cy', '+355 68 555 6666');
  const m = await s.call('POST', '/api/friends/match', { numbers: ['0691112222', '+355 69 333 4444', '+355 60 000 0000', 'abc'] }, bob.token);
  assert.equal(m.status, 200);
  assert.deepEqual(m.body.map(u => u.name), ['Ann']);              // Bob's own number is not returned, Cy was not asked for
  assert.equal(m.body[0].isFriend, false);
  assert.equal(m.body[0].email, undefined);                        // never leaks email or phone
  assert.equal(ann.user.hasPhone, true);
});

test('bill: create, split by item, tip, join by code, and who can see it', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann'), bob = await s.signup('Bob'), cy = await s.signup('Cy');
  await s.call('POST', '/api/friends/add', { code: bob.user.shareCode }, ann.token);
  const body = {
    title: 'Lunch', currency: 'ALL', mode: 'items', tipCents: 100,
    members: [{ key: 'a', userId: ann.user.id }, { key: 'b', userId: bob.user.id }, { key: 'g', name: 'Guest Gina' }],
    items: [{ key: '1', name: 'Pasta', priceCents: 1000, qty: 1 }, { key: '2', name: 'Pizza', priceCents: 2000, qty: 1 }, { key: '3', name: 'Water', priceCents: 300, qty: 1 }],
    assignments: [{ item: '1', member: 'a' }, { item: '2', member: 'b' }, { item: '3', member: 'a' }, { item: '3', member: 'b' }, { item: '3', member: 'g' }]
  };
  const c = await s.call('POST', '/api/bills', body, ann.token);
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const bill = c.body;
  assert.equal(bill.totalCents, 3400);
  assert.equal(bill.members.reduce((x, m) => x + m.totalCents, 0), 3400);
  assert.equal(bill.members.length, 3);
  assert.match(bill.code, /^[A-Z0-9]{6}$/);

  // Bob is on the bill, Cy is not
  assert.equal((await s.call('GET', '/api/bills/' + bill.id, undefined, bob.token)).status, 200);
  assert.equal((await s.call('GET', '/api/bills/' + bill.id, undefined, cy.token)).status, 404);
  // Cy joins with the code
  const j = await s.call('POST', '/api/bills/join', { code: bill.code.toLowerCase() }, cy.token);
  assert.equal(j.status, 200); assert.equal(j.body.members.length, 4);
  assert.equal((await s.call('POST', '/api/bills/join', { code: bill.code }, cy.token)).body.members.length, 4); // no duplicate
  assert.equal((await s.call('POST', '/api/bills/join', { code: 'NOPE00' }, cy.token)).status, 404);
  // only the owner can change it
  assert.equal((await s.call('PUT', '/api/bills/' + bill.id, body, bob.token)).status, 403);
  assert.equal((await s.call('DELETE', '/api/bills/' + bill.id, undefined, bob.token)).status, 403);
});

test('bill: you can only add your friends, and bad numbers are refused', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann'), bob = await s.signup('Bob');
  const base = { title: 'X', items: [{ name: 'a', priceCents: 100, qty: 1 }] };
  const stranger = await s.call('POST', '/api/bills', { ...base, members: [{ userId: bob.user.id }] }, ann.token);
  assert.equal(stranger.status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, title: '' }, ann.token)).status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, items: [{ name: 'a', priceCents: -5, qty: 1 }] }, ann.token)).status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, items: [{ name: 'a', priceCents: 12.5, qty: 1 }] }, ann.token)).status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, items: [{ name: 'a', priceCents: 100, qty: 0 }] }, ann.token)).status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, mode: 'weird' }, ann.token)).status, 400);
  assert.equal((await s.call('POST', '/api/bills', { ...base, currency: 'dollars' }, ann.token)).status, 400);
});

test('paying: people mark their own share, the owner can mark anyone, and the bill settles when everyone has paid', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann'), bob = await s.signup('Bob'), cy = await s.signup('Cy');
  for (const f of [bob, cy]) await s.call('POST', '/api/friends/add', { code: f.user.shareCode }, ann.token);
  const c = await s.call('POST', '/api/bills', { title: 'Taxi', mode: 'equal', items: [{ name: 'Ride', priceCents: 3000, qty: 1 }],
    members: [{ userId: ann.user.id }, { userId: bob.user.id }, { userId: cy.user.id }] }, ann.token);
  const bill = c.body, mem = id => bill.members.find(m => m.userId === id).id;
  assert.deepEqual(bill.members.map(m => m.totalCents), [1000, 1000, 1000]);

  const sum1 = (await s.call('GET', '/api/summary', undefined, ann.token)).body;
  assert.equal(sum1.owedToYouCents, 2000);
  assert.equal((await s.call('GET', '/api/summary', undefined, bob.token)).body.youOweCents, 1000);

  assert.equal((await s.call('POST', `/api/bills/${bill.id}/members/${mem(cy.user.id)}/paid`, {}, bob.token)).status, 403); // not Bob's share
  assert.equal((await s.call('POST', `/api/bills/${bill.id}/members/${mem(bob.user.id)}/paid`, {}, bob.token)).status, 200);
  assert.equal((await s.call('GET', '/api/summary', undefined, ann.token)).body.owedToYouCents, 1000);
  const last = await s.call('POST', `/api/bills/${bill.id}/members/${mem(cy.user.id)}/paid`, {}, ann.token);
  assert.equal(last.body.status, 'settled');
  assert.equal((await s.call('POST', `/api/bills/${bill.id}/members/${mem(cy.user.id)}/paid`, { paid: false }, ann.token)).body.status, 'open');
});

test('editing a bill keeps who has already paid', async t => {
  const s = await start(); t.after(s.close);
  const ann = await s.signup('Ann'), bob = await s.signup('Bob');
  await s.call('POST', '/api/friends/add', { code: bob.user.shareCode }, ann.token);
  const b = (await s.call('POST', '/api/bills', { title: 'T', mode: 'equal', items: [{ name: 'a', priceCents: 1000, qty: 1 }],
    members: [{ userId: ann.user.id }, { userId: bob.user.id }] }, ann.token)).body;
  const bobM = b.members.find(m => m.userId === bob.user.id);
  await s.call('POST', `/api/bills/${b.id}/members/${bobM.id}/paid`, {}, bob.token);
  const upd = await s.call('PUT', '/api/bills/' + b.id, { title: 'T2', mode: 'equal', items: [{ name: 'a', priceCents: 2000, qty: 1 }],
    members: b.members.map(m => ({ id: m.id, userId: m.userId, name: m.name })) }, ann.token);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.title, 'T2');
  assert.equal(upd.body.members.find(m => m.userId === bob.user.id).paid, true);
  assert.equal(upd.body.members.find(m => m.userId === bob.user.id).totalCents, 1000);
});

test('AI scan is off without a key, and returns clean data when switched on', async t => {
  const off = await start(); t.after(off.close);
  const u = await off.signup('Ann');
  assert.equal((await off.call('GET', '/api/config')).body.aiScan, false);
  assert.equal((await off.call('POST', '/api/receipt/ai', { image: 'data:image/png;base64,AAAA' }, u.token)).status, 501);

  const fake = async (url, opts) => {
    assert.match(url, /anthropic\.com/); assert.equal(opts.headers['x-api-key'], 'k');
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Here: {"merchant":"Cafe","currency":"all","items":[{"name":"Latte","price":2.5,"qty":2}],"tax":0.5,"tip":0}' }] }) };
  };
  const on = await start({ aiKey: 'k', fetch: fake }); t.after(on.close);
  const u2 = await on.signup('Bob');
  assert.equal((await on.call('GET', '/api/config')).body.aiScan, true);
  assert.equal((await on.call('POST', '/api/receipt/ai', { image: 'not an image' }, u2.token)).status, 400);
  const r = await on.call('POST', '/api/receipt/ai', { image: 'data:image/png;base64,AAAA' }, u2.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.items, [{ name: 'Latte', priceCents: 250, qty: 2 }]);
  assert.equal(r.body.taxCents, 50);
  assert.equal(r.body.currency, 'ALL');
});

test('login is rate limited', async t => {
  const s = await start({ rateLimit: true }); t.after(s.close);
  let last;
  for (let i = 0; i < 30; i++) last = await s.call('POST', '/api/auth/login', { email: 'x@y.co', password: 'nope' });
  assert.equal(last.status, 429);
});
