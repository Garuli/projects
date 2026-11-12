'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Avatar = require('../src/avatar');
const { createApp } = require('../src/app');

test('avatar codes: valid ones parse, invalid ones are refused', () => {
  assert.deepEqual(Avatar.parse('av:3.1.2.4'), { p: 3, e: 1, m: 2, h: 4 });
  for (const bad of ['', null, undefined, 'av:12.0.0.0', 'av:0.6.0.0', 'av:0.0.6.0', 'av:0.0.0.7', 'av:1.2.3', '#FF0000', 'av:1.1.1.1<script>', 'av:-1.0.0.0']) {
    assert.equal(Avatar.isCode(bad), false, String(bad));
  }
});

test('random avatars are always valid and round-trip through build and parse', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const code = Avatar.random();
    assert.ok(Avatar.isCode(code), code);
    assert.equal(Avatar.build(Avatar.parse(code)), code);
    seen.add(code);
  }
  assert.ok(seen.size > 100, 'should be varied');
});

test('every option draws, and invalid codes draw nothing so initials can take over', () => {
  const c = Avatar.COUNTS;
  assert.equal(c.palette * c.eyes * c.mouth * c.hair, 3024);
  for (let p = 0; p < c.palette; p++) for (let e = 0; e < c.eyes; e++) {
    assert.match(Avatar.render({ p, e, m: 0, h: 0 }, 40), /^<span class="av face".*<svg.*<\/svg><\/span>$/);
  }
  for (let m = 0; m < c.mouth; m++) for (let h = 0; h < c.hair; h++) assert.ok(Avatar.render({ p: 0, e: 0, m, h }, 40).includes('<svg'));
  assert.equal(Avatar.render('nope', 40), '');
  assert.ok(Avatar.render('av:1.1.1.1', 50, 'ring').includes('av face ring'));
});

test('API: new users get an avatar, can choose one, and bad ones are rejected', async t => {
  const { app } = createApp({ rateLimit: false, jwtSecret: 'x'.repeat(40), pepper: 'p' });
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); }); t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const a = await call('POST', '/api/auth/register', { name: 'Ann', email: 'ann@t.com', password: 'secret1' });
  assert.ok(Avatar.isCode(a.body.user.avatar), 'random default');
  const b = await call('POST', '/api/auth/register', { name: 'Ben', email: 'ben@t.com', password: 'secret1', avatar: 'av:5.3.2.6' });
  assert.equal(b.body.user.avatar, 'av:5.3.2.6');
  const c = await call('POST', '/api/auth/register', { name: 'Cy', email: 'cy@t.com', password: 'secret1', avatar: '<b>x</b>' });
  assert.ok(Avatar.isCode(c.body.user.avatar), 'bad choice falls back to a random one');

  assert.equal((await call('PATCH', '/api/me', { avatar: 'av:9.0.1.2' }, a.body.token)).body.avatar, 'av:9.0.1.2');
  assert.equal((await call('GET', '/api/me', undefined, a.body.token)).body.avatar, 'av:9.0.1.2');
  assert.equal((await call('PATCH', '/api/me', { avatar: 'av:99.0.0.0' }, a.body.token)).status, 400);
  assert.equal((await call('PATCH', '/api/me', { name: 'Ann B' }, a.body.token)).body.avatar, 'av:9.0.1.2', 'renaming keeps the avatar');

  // friends see the chosen avatar
  const code = (await call('GET', '/api/me', undefined, b.body.token)).body.shareCode;
  await call('POST', '/api/friends/add', { code }, a.body.token);
  const friends = (await call('GET', '/api/friends', undefined, a.body.token)).body;
  assert.equal(friends[0].color, 'av:5.3.2.6');
});
