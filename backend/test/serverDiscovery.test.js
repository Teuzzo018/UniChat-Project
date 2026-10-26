/**
 * ============================================================================
 * TEST SUITE: SCOPERTA SERVER (serverDiscovery.test.js)
 * 1. Test visibilità server: verifica isolamento per università e flag di scoperta
 * 2. Test inviti: verifica scadenza temporale e limite massimo di utilizzi
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const src = (name) => path.join(__dirname, '../src', name);
const withModules = (stubs, entry) => {
  const saved = new Map();
  for (const [name, exports] of Object.entries(stubs)) {
    const filename = src(name);
    saved.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  const target = src(entry);
  const previous = require.cache[target];
  delete require.cache[target];
  try { return require(target); }
  finally {
    if (previous) require.cache[target] = previous;
    else delete require.cache[target];
    for (const [filename, old] of saved) {
      if (old) require.cache[filename] = old;
      else delete require.cache[filename];
    }
  }
};
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('ricerca: filtri nel database, proiezioni minime, limiti e nessun conteggio privato', async () => {
  const queries = [];
  const db = {
    server: { findMany: async (query) => {
      queries.push({ model: 'server', query });
      return query.where.isDiscoverable ? [{ id: 'public', name: 'Pubblico' }]
        : [{ id: 'mine', name: 'Privato', description: null }];
    } },
    channel: { findMany: async (query) => {
      queries.push({ model: 'channel', query });
      return [{ id: 'own-channel', name: 'generale', serverId: 'mine', server: { id: 'mine', name: 'Privato' } }];
    } },
    user: { findMany: async (query) => {
      queries.push({ model: 'user', query });
      return [{ id: 'friend', username: 'friend', fullName: 'Amico' }];
    } }
  };
  const { searchGlobal } = withModules({ 'lib/prisma.js': db }, 'controllers/searchControllers.js');
  const run = async (scope, q = 'te', extras = {}) => {
    const res = response();
    await searchGlobal({ user: { id: 'me', universityId: 'uni' }, query: { scope, q, ...extras } }, res);
    return res;
  };
  assert.deepEqual((await run('explore')).body.items.map((row) => row.id), ['public']);
  assert.deepEqual((await run('member')).body.items.map((row) => row.id), ['mine']);
  assert.deepEqual((await run('channels')).body.items.map((row) => row.id), ['own-channel']);
  await run('users');
  await run('friends');
  assert.equal(queries[0].query.where.isDiscoverable, true);
  assert.deepEqual(queries[0].query.where.members, { none: { userId: 'me' } });
  assert.deepEqual(queries[1].query.where.members, { some: { userId: 'me' } });
  assert.deepEqual(queries[2].query.where.server.members, { some: { userId: 'me' } });
  assert.ok(queries[4].query.where.AND[0].OR);
  assert.equal(queries.every(({ query }) => !JSON.stringify(query.select).includes('_count') &&
    !JSON.stringify(query.select).includes('inviteCode') && !JSON.stringify(query.select).includes('email') &&
    !JSON.stringify(query.select).includes('messages')), true);
  assert.equal((await run('users', 'a')).body.items.length, 0);
  assert.equal((await run('explore', 'test', { page: '51' })).code, 400);
  assert.equal((await run('explore', 'test', { limit: '21' })).code, 400);
  const page = await run('explore', 'test', { page: '2', limit: '5' });
  assert.equal(page.body.page, 2);
  assert.equal(queries.at(-1).query.skip, 5);
  assert.equal(queries.at(-1).query.take, 6);
  await run('explore', '%_');
  assert.equal(queries.at(-1).query.where.OR[0].name.contains, '\\%\\_');
});

test('inviti: link, scadenza, revoca, limite atomico e appartenenza già esistente', async () => {
  const { parseInviteCode, redeemInvite } = require(src('utils/serverInvites.js'));
  const code = 'a'.repeat(32);
  assert.equal(parseInviteCode(`https://chat.example/?invite=${code}`), code);
  assert.equal(parseInviteCode('https://chat.example/?invite=not-a-code'), null);
  const server = { id: 'server', inviteCode: code, inviteExpiresAt: null,
    inviteMaxUses: 1, inviteUses: 0, inviteRevokedAt: null };
  const requests = new Map();
  const members = new Set();
  const tx = {
    server: {
      findUnique: async ({ where }) => where.inviteCode === server.inviteCode ? { ...server } : null,
      updateMany: async ({ where }) => {
        if (server.inviteCode !== where.inviteCode || server.inviteRevokedAt ||
            server.inviteExpiresAt && server.inviteExpiresAt <= new Date() ||
            server.inviteUses >= server.inviteMaxUses) return { count: 0 };
        server.inviteUses += 1;
        return { count: 1 };
      }
    },
    serverMember: { findUnique: async ({ where }) => members.has(where.userId_serverId.userId) ? { id: 'member' } : null },
    serverJoinRequest: {
      findUnique: async ({ where }) => requests.get(where.userId_serverId.userId) || null,
      create: async ({ data }) => { requests.set(data.userId, { id: data.userId, status: 'PENDING' }); },
      updateMany: async ({ where }) => {
        const row = requests.get(where.id);
        if (row?.status !== where.status) return { count: 0 };
        row.status = 'PENDING';
        return { count: 1 };
      }
    }
  };
  await redeemInvite(tx, code, 'first');
  assert.equal(server.inviteUses, 1);
  assert.equal((await redeemInvite(tx, code, 'first')).alreadyPending, true);
  assert.equal(server.inviteUses, 1);
  await assert.rejects(redeemInvite(tx, code, 'second'), { statusCode: 404 });
  members.add('first');
  assert.equal((await redeemInvite(tx, code, 'first')).alreadyMember, true);
  server.inviteMaxUses = null;
  server.inviteRevokedAt = new Date();
  await assert.rejects(redeemInvite(tx, code, 'second'), { statusCode: 404 });
  members.delete('first');
  await assert.rejects(redeemInvite(tx, code, 'first'), { statusCode: 404 });
  server.inviteRevokedAt = null;
  server.inviteExpiresAt = new Date(Date.now() - 1000);
  await assert.rejects(redeemInvite(tx, code, 'second'), { statusCode: 404 });
  server.inviteExpiresAt = null;
  server.inviteMaxUses = 1;
  server.inviteUses = 0;
  const race = await Promise.allSettled([
    redeemInvite(tx, code, 'second'), redeemInvite(tx, code, 'third')
  ]);
  assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(server.inviteUses, 1);
});

test('solo gestori possono leggere, rigenerare e revocare inviti o rendere il server scopribile', async () => {
  let manager = false;
  let writes = 0;
  let availableWhere;
  const db = { server: {
    findUnique: async ({ where }) => where.inviteCode ? null : { inviteCode: 'a'.repeat(32),
      inviteExpiresAt: null, inviteMaxUses: null, inviteUses: 0, inviteRevokedAt: null },
    findFirst: async () => null,
    findMany: async ({ where }) => { availableWhere = where; return []; },
    update: async ({ data }) => { writes += 1; return { ...data, inviteUses: 0, id: 'server' }; }
  } };
  const controller = withModules({
    'lib/prisma.js': db,
    'lib/authorization.js': { canManageServer: async () => manager, isSuperadmin: () => false }
  }, 'controllers/serverControllers.js');
  const req = (body = {}) => ({ user: { id: 'person' }, params: { id: 'server' }, body });
  for (const action of ['getServerInvite', 'rotateServerInvite', 'revokeServerInvite', 'setDiscoverability']) {
    const res = response();
    await controller[action](req({ isDiscoverable: true }), res);
    assert.equal(res.code, 403);
  }
  assert.equal(writes, 0);
  let res = response();
  await controller.listAvailableServers({ user: { id: 'person', universityId: 'uni' } }, res);
  assert.equal(availableWhere.isDiscoverable, true);
  res = response();
  await controller.joinServer({ user: { id: 'person', universityId: 'uni' }, params: { id: 'hidden' } }, res);
  assert.equal(res.code, 404);
  manager = true;
  res = response();
  await controller.rotateServerInvite(req({ maxUses: 2, expiresAt: new Date(Date.now() + 60000).toISOString() }), res);
  assert.equal(res.code, 201);
  assert.match(res.body.inviteCode, /^[a-f0-9]{32}$/);
  res = response();
  await controller.revokeServerInvite(req(), res);
  assert.equal(res.code, 200);
  res = response();
  await controller.setDiscoverability(req({ isDiscoverable: true }), res);
  assert.equal(res.body.isDiscoverable, true);
  assert.equal(writes, 3);
});
