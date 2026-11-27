import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAccounts } from '../lobby/accounts.mjs';
import { standing, tiers, winsToPromote, promotionMatch, selectable } from '../doubles/ranks.js';
import { createMatch, defaults } from '../doubles/simulation.js';

test('standing promotes after ten wins per tier and stops at 국가대표', () => {
  assert.deepEqual(standing([]), { rank: 0, wins: 0 });
  assert.deepEqual(standing([10, 3]), { rank: 1, wins: 3 });
  assert.equal(tiers[standing([10, 10, 10, 10]).rank].name, 'A조');
  assert.deepEqual(standing(tiers.map(() => 12)), { rank: tiers.length - 1, wins: winsToPromote });
});

test('signed-in wins are stored on the account and shown as the tier after the name', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'minton-rank-'));
  const accounts = createAccounts(path.join(dir, 'accounts.sqlite'));
  const server = http.createServer((req, res) => accounts.handle(req, res, new URL(req.url, 'http://localhost')));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); accounts.close(); await rm(dir, { recursive: true, force: true }); });
  const root = 'http://127.0.0.1:' + server.address().port + '/api/account/';
  const post = (action, data, cookie = '') => fetch(root + action, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(data) });

  assert.equal((await post('result', { match: '9-9-9-9', rank: 0, won: true })).status, 401);
  const created = await post('register', { name: '승급러', password: 'test-password-123' });
  const cookie = created.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await created.json()).user.standing, { rank: 0, wins: 0 });

  let user;
  for (let i = 0; i < winsToPromote; i++) user = (await (await post('result', { match: '1-2-3-' + i, rank: 0, won: true }, cookie)).json()).user;
  assert.deepEqual(user.standing, { rank: 1, wins: 0 });
  assert.equal(tiers[user.standing.rank].name, 'D조');

  // Replays of a match, losses, and wins at another tier do not count.
  user = (await (await post('result', { match: '1-2-3-0', rank: 1, won: true }, cookie)).json()).user;
  assert.deepEqual(user.standing, { rank: 1, wins: 0 });
  user = (await (await post('result', { match: '1-2-3-10', rank: 1, won: true }, cookie)).json()).user;
  assert.deepEqual(user.standing, { rank: 1, wins: 1 });
  user = (await (await post('result', { match: '1-2-3-10', rank: 1, won: true }, cookie)).json()).user;
  assert.equal(user.standing.wins, 1);
  user = (await (await post('result', { match: '2-2-2-1', rank: 1, won: false }, cookie)).json()).user;
  assert.equal(user.standing.wins, 1);
  user = (await (await post('result', { match: '2-2-2-2', rank: 5, won: true }, cookie)).json()).user;
  assert.deepEqual(user.standing, { rank: 1, wins: 1 });
  assert.equal((await post('result', { match: 'bad id', rank: 1, won: true }, cookie)).status, 400);

  const me = await (await fetch(root + 'me', { headers: { cookie } })).json();
  assert.deepEqual(me.user.standing, { rank: 1, wins: 1 });
});

test('승급전 appears only one win before promotion, never at the top tier', () => {
  for (let wins = 0; wins < winsToPromote; wins++) assert.equal(promotionMatch({ rank: 2, wins }), wins === winsToPromote - 1);
  assert.equal(promotionMatch({ rank: tiers.length - 1, wins: winsToPromote - 1 }), false);
});

test('ranked play allows own tier and below; AI practice allows every tier', () => {
  const c = { rank: 2, wins: 4 };   // C조
  assert.deepEqual(tiers.map((_, i) => selectable(i, c)), [true, true, true, false, false, false, false, false]);
  assert.ok(tiers.every((_, i) => selectable(i, { rank: 0, wins: 0 }, true)));
});

test('AI practice at a chosen tier keeps feeding without score or rank', () => {
  const game = createMatch({ ...defaults }, () => .1, true);
  game.start(7);
  assert.equal(game.s.rank, null);
  for (let feed = 0; feed < 2; feed++) {
    for (let i = 0; i < 430 && game.s.phase === 'serve'; i++) game.tick(1 / 120);
    assert.equal(game.s.lastShot.id, 2);
    for (let i = 0; i < 1500 && game.s.phase !== 'serve'; i++) game.tick(1 / 120);
    assert.deepEqual(game.s.score, [0, 0]);
  }
});
