const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

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

test('dashboard: admin locale vede solo account, server, messaggi e registro del proprio ambito', async () => {
  const queries = {};
  const prisma = {
    user: {
      findMany: async (query) => { queries.users = query; return []; },
      count: async (query) => { queries.userCount = query; return 0; }
    },
    server: { findMany: async (query) => { queries.servers = query; return []; } },
    message: { findMany: async (query) => { queries.messages = query; return []; } },
    adminAuditLog: {
      findMany: async (query) => { queries.audit = query; return []; },
      count: async () => 0
    }
  };
  const controllers = withModules({
    'lib/prisma.js': prisma,
    'lib/authorization.js': { isSuperadmin: () => false }
  }, 'controllers/adminControllers.js');
  const req = { user: { id: 'local', role: 'STUDENT' }, adminScope: { global: false, serverIds: ['a'] },
    query: { page: '2', pageSize: '5', q: 'Mario' } };
  const res = response();
  await controllers.listOverview(req, res);
  assert.equal(res.code, 200);
  assert.equal(queries.users.skip, 5);
  assert.equal(queries.users.take, 5);
  assert.deepEqual(queries.users.where.servers, { some: { serverId: { in: ['a'] } } });
  assert.deepEqual(queries.servers.where, { id: { in: ['a'] } });
  assert.deepEqual(queries.messages.where, { channel: { serverId: { in: ['a'] } } });
  await controllers.listAudit(req, response());
  assert.deepEqual(queries.audit.where, { serverId: { in: ['a'] } });
});

test('dashboard: account ordinario senza server gestito riceve 403', async () => {
  const scope = withModules({
    'lib/prisma.js': { server: { findMany: async () => [] } },
    'lib/authorization.js': { isActive: () => true, canModerateGlobal: () => false }
  }, 'lib/adminScope.js');
  const res = response();
  await scope.requireAdminScope({ user: { id: 'ordinary' } }, res, () => { throw new Error('Accesso concesso'); });
  assert.equal(res.code, 403);
});

test('moderazione: admin locale non elimina messaggi di un altro server', async () => {
  let deletions = 0;
  const controllers = withModules({
    'lib/prisma.js': {
      message: {
        findUnique: async () => ({ id: 'msg', channelId: 'c', channel: { serverId: 'b' } }),
        delete: async () => { deletions += 1; }
      }
    },
    'lib/authorization.js': {
      canModerateServer: async (_user, id) => id === 'a',
      canModerateGlobal: () => false,
      isSuperadmin: () => false
    }
  }, 'controllers/adminControllers.js');
  const res = response();
  await controllers.deleteMessage({ user: { id: 'local' }, params: { id: 'msg' }, app: {} }, res);
  assert.equal(res.code, 403);
  assert.equal(deletions, 0);
});

test('gestione server: ambito locale, moderazione globale e divieto di eliminazione fuori proprietà', async () => {
  let updates = 0;
  let deletions = 0;
  const controllers = withModules({
    'lib/prisma.js': {
      server: {
        findUnique: async () => ({ id: 'a', ownerId: 'owner' }),
        update: async () => { updates += 1; return { id: 'a', name: 'Nuovo' }; },
        delete: async () => { deletions += 1; }
      },
      serverMember: { deleteMany: async () => {} },
      $transaction: async (operations) => Promise.all(operations)
    },
    'lib/authorization.js': {
      canModerateServer: async (user, id) => user.role === 'PLATFORM_ADMIN' || (user.id === 'local' && id === 'a'),
      canModerateGlobal: (user) => user.role === 'PLATFORM_ADMIN',
      isSuperadmin: () => false
    }
  }, 'controllers/adminControllers.js');
  const request = (user, id) => ({ user, params: { id }, body: { name: 'Nuovo', description: '' } });
  const local = { id: 'local', role: 'STUDENT' };
  const platform = { id: 'platform', role: 'PLATFORM_ADMIN' };
  const allowed = response();
  await controllers.updateServer(request(local, 'a'), allowed);
  assert.equal(allowed.code, 200);
  const foreign = response();
  await controllers.updateServer(request(local, 'b'), foreign);
  assert.equal(foreign.code, 403);
  const global = response();
  await controllers.updateServer(request(platform, 'b'), global);
  assert.equal(global.code, 200);
  assert.equal(updates, 2);
  const forbiddenDelete = response();
  await controllers.deleteServer(request(local, 'a'), forbiddenDelete);
  assert.equal(forbiddenDelete.code, 403);
  assert.equal(deletions, 0);
});

test('canali: rinomina ed eliminazione richiedono gestione del server corretto', async () => {
  const changed = [];
  const events = [];
  const prisma = {
    channel: {
      findUnique: async ({ where }) => ({ id: where.id, serverId: where.id === 'foreign' ? 'other' : 'server' }),
      update: async ({ data, select }) => { changed.push(data.name); return { id: 'channel', serverId: 'server', name: data.name, type: 'TEXT' }; },
      delete: async ({ where }) => { changed.push(`deleted:${where.id}`); }
    },
    serverMember: { findMany: async () => [{ userId: 'owner' }, { userId: 'friend' }] }
  };
  const io = { to: (rooms) => ({ emit: (event, payload) => events.push({ rooms, event, payload }) }) };
  const controllers = withModules({
    'lib/prisma.js': prisma,
    'lib/authorization.js': {
      canModerateServer: async (user, id) => user.id === 'owner' && id === 'server',
      canModerateGlobal: () => false,
      isSuperadmin: () => false
    }
  }, 'controllers/adminControllers.js');
  const request = (userId, channelId = 'channel', name = 'Nuovo Canale') => ({
    user: { id: userId }, params: { serverId: 'server', channelId }, body: { name },
    app: { get: () => io }
  });
  assert.equal((await controllers.updateChannel(request('owner', 'channel', ' '), response())).code, 400);
  const foreign = response();
  await controllers.updateChannel(request('owner', 'foreign'), foreign);
  assert.equal(foreign.code, 404);
  const forbidden = response();
  await controllers.updateChannel(request('stranger'), forbidden);
  assert.equal(forbidden.code, 403);
  assert.deepEqual(changed, []);
  const renamed = response();
  await controllers.updateChannel(request('owner'), renamed);
  assert.equal(renamed.code, 200);
  assert.equal(renamed.body.name, 'nuovo-canale');
  assert.equal(events[0].event, 'channel_updated');
  assert.deepEqual(events[0].rooms, ['user:owner', 'user:friend']);
  const deniedDelete = response();
  await controllers.deleteChannel(request('stranger'), deniedDelete);
  assert.equal(deniedDelete.code, 403);
  const deleted = response();
  await controllers.deleteChannel(request('owner'), deleted);
  assert.equal(deleted.code, 200);
  assert.deepEqual(changed, ['nuovo-canale', 'deleted:channel']);
});

test('registro: salva autore, azione, risorsa, esito e data senza body o contenuti', async () => {
  const written = [];
  const audit = withModules({
    'lib/prisma.js': { adminAuditLog: { create: async (input) => { written.push(input.data); } } }
  }, 'middleware/adminAudit.js');
  const req = { user: { id: 'actor' }, params: { serverId: 'a', channelId: 'c' },
    body: { secret: 'not-audit-me', content: 'private' } };
  const res = new EventEmitter();
  res.statusCode = 403;
  audit('CHANNEL_DELETE', 'CHANNEL', 'channelId', 'serverId')(req, res, () => {});
  res.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written.length, 1);
  assert.deepEqual(written[0], {
    actorId: 'actor', action: 'CHANNEL_DELETE', resourceType: 'CHANNEL',
    resourceId: 'c', serverId: 'a', outcome: 'DENIED'
  });
  assert.equal(JSON.stringify(written[0]).includes('private'), false);
  res.statusCode = 200;
  const success = new EventEmitter();
  success.statusCode = 200;
  audit('CHANNEL_DELETE', 'CHANNEL', 'channelId', 'serverId')(req, success, () => {});
  success.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written[1].outcome, 'SUCCESS');
});
