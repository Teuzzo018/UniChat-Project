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

const db = {
  server: { findUnique: async ({ where }) => ['a', 'b'].includes(where.id) ? { id: where.id, ownerId: where.id === 'b' ? 'owner' : 'someone' } : null },
  serverMember: { findUnique: async ({ where }) => {
    const { userId, serverId } = where.userId_serverId;
    if (userId === 'local' && serverId === 'a') return { id: 'm1', isAdmin: true };
    if (userId === 'local' && serverId === 'b') return { id: 'm2', isAdmin: false };
    if (userId === 'owner' && serverId === 'b') return { id: 'm3', isAdmin: false };
    return null;
  } }
};

test('matrice: utente, admin locale, admin globale e superadmin', async () => {
  const authz = withModules({ 'lib/prisma.js': db }, 'lib/authorization.js');
  const ordinary = { id: 'user', role: 'STUDENT' };
  const local = { id: 'local', role: 'STUDENT' };
  const owner = { id: 'owner', role: 'STUDENT' };
  const global = { id: 'global', role: 'PLATFORM_ADMIN' };
  const legacy = { id: 'legacy', role: 'ADMIN' };
  const root = { id: 'root', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN' };
  assert.equal(authz.isSuperadmin({ id: 'other', email: 'other@example.com', role: 'SUPERADMIN' }), false);
  assert.equal(await authz.canManageServer(ordinary, 'a', db), false);
  assert.equal(await authz.canManageServer(local, 'a', db), true);
  assert.equal(await authz.canManageServer(local, 'b', db), false);
  assert.equal(await authz.canManageServer(owner, 'b', db), true);
  assert.equal(await authz.canManageServer(global, 'a', db), false);
  assert.equal(await authz.canModerateServer(global, 'a', db), true);
  assert.equal(await authz.canModerateServer(global, 'b', db), true);
  assert.equal(authz.canModerateGlobal(legacy), true);
  assert.equal(authz.isSuperadmin(global), false);
  assert.equal(await authz.canManageServer(root, 'b', db), true);
  assert.equal(await authz.canManageServer({ ...root, suspendedAt: new Date() }, 'b', db), false);
});

test('HTTP: ruolo globale e ambito server sono verificati dal backend', async () => {
  const authz = withModules({ 'lib/prisma.js': db }, 'lib/authorization.js');
  const result = async (middleware, user, id) => {
    let code = 200;
    await middleware({ user, params: { id } }, { status(value) { code = value; return this; }, json() {} }, () => {});
    return code;
  };
  assert.equal(await result(authz.requireServerManager(), { id: 'local', role: 'STUDENT' }, 'a'), 200);
  assert.equal(await result(authz.requireServerManager(), { id: 'local', role: 'STUDENT' }, 'b'), 403);
  assert.equal(await result(authz.requireServerManager(), { id: 'global', role: 'PLATFORM_ADMIN' }, 'a'), 403);
  assert.equal(await result(authz.requireSuperadmin, { id: 'global', role: 'PLATFORM_ADMIN' }), 403);
  assert.equal(await result(authz.requireSuperadmin, { id: 'root', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN' }), 200);
});

test('Socket.IO: privilegio locale non si estende a un altro server', async () => {
  const authz = withModules({ 'lib/prisma.js': db }, 'lib/authorization.js');
  const authorizeSocket = withModules({
    'lib/authorization.js': authz,
    'sockets/shared.js': { getAuthenticatedSocketUser: async (socket) => socket.user }
  }, 'sockets/authorize.js');
  const socket = { user: { id: 'local', role: 'STUDENT' } };
  assert.equal((await authorizeSocket(socket, 'serverManagement', 'a'))?.id, 'local');
  assert.equal(await authorizeSocket(socket, 'serverManagement', 'b'), null);
  assert.equal(await authorizeSocket(socket, 'roles'), null);
  socket.user.suspendedAt = new Date();
  assert.equal(await authorizeSocket(socket, 'serverManagement', 'a'), null);
});

test('ultimo superadmin è protetto e gli Admin possono sospendere utenti ordinari', async () => {
  const authz = withModules({ 'lib/prisma.js': db }, 'lib/authorization.js');
  const roles = withModules({ 'lib/prisma.js': db, 'lib/authorization.js': authz }, 'lib/roleManagement.js');
  assert.equal(await roles.isLastActiveSuperadmin({ role: 'SUPERADMIN' }, { user: { count: async () => 1 } }), true);
  assert.equal(await roles.isLastActiveSuperadmin({ role: 'SUPERADMIN' }, { user: { count: async () => 2 } }), false);
  assert.equal(await roles.isLastSuperadmin({ role: 'SUPERADMIN', suspendedAt: new Date() }, { user: { count: async () => 1 } }), true);
  const platform = { id: 'platform', role: 'PLATFORM_ADMIN' };
  assert.equal(await roles.canAffectUser(platform, { id: 'owner', role: 'STUDENT' }), true);
  assert.equal(await roles.canAffectUser(platform, { id: 'local', role: 'STUDENT' }), true);
  assert.equal(await roles.canAffectUser(platform, { id: 'ordinary', role: 'STUDENT' }), true);
  assert.equal(await roles.canAffectUser(platform, { id: 'peer', role: 'PLATFORM_ADMIN' }), false);
});

test('gestione ruoli: autoassegnazione e modifiche al proprietario negate', async () => {
  let updates = 0;
  const tx = {
    user: {
      findUnique: async ({ where }) => where.id === 'actor'
        ? { id: 'actor', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN', suspendedAt: null }
        : { id: 'target', role: 'SUPERADMIN', suspendedAt: null },
      count: async () => 1,
      update: async () => { updates += 1; }
    },
    session: { deleteMany: async () => {} }
  };
  const controllers = withModules({
    'lib/prisma.js': { $transaction: async (callback) => callback(tx) },
    'lib/roleManagement.js': {
      lockRoles: async () => {},
      isLastSuperadmin: async () => true,
      isLastActiveSuperadmin: async () => true,
      canAffectUser: async () => false
    },
    'utils/disconnectUserSockets.js': async () => {}
  }, 'controllers/roleControllers.js');
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
  const self = response();
  await controllers.changeRole({ user: { id: 'actor' }, params: { id: 'actor' }, body: { role: 'SUPERADMIN' } }, self);
  assert.equal(self.code, 400);
  const last = response();
  await controllers.changeRole({ user: { id: 'actor' }, params: { id: 'target' }, body: { role: 'PLATFORM_ADMIN' } }, last);
  assert.equal(last.code, 403);
  assert.equal(updates, 0);
});

test('RBAC: Admin assegna solo studente/professore; Teo nomina gli Admin', async () => {
  let actor = { id: 'actor', email: 'admin@example.com', role: 'PLATFORM_ADMIN', suspendedAt: null };
  let targetRole = 'STUDENT';
  const tx = {
    user: {
      findUnique: async ({ where }) => where.id === 'actor' ? actor :
        { id: 'target', role: targetRole, suspendedAt: null },
      update: async ({ data }) => { targetRole = data.role; return { id: 'target', role: targetRole }; }
    },
    session: { deleteMany: async () => {} }
  };
  const controllers = withModules({
    'lib/prisma.js': { $transaction: async (callback) => callback(tx) },
    'lib/roleManagement.js': { lockRoles: async () => {}, isLastSuperadmin: async () => false },
    'utils/disconnectUserSockets.js': async () => {}
  }, 'controllers/roleControllers.js');
  const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const change = async (role) => {
    const res = response();
    await controllers.changeRole({ user: { id: 'actor' }, params: { id: 'target' }, body: { role }, app: {} }, res);
    return res;
  };
  assert.equal((await change('PROFESSOR')).code, 200);
  assert.equal((await change('PLATFORM_ADMIN')).code, 403);
  actor = { id: 'actor', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN', suspendedAt: null };
  assert.equal((await change('PLATFORM_ADMIN')).code, 200);
  actor = { id: 'actor', email: 'admin@example.com', role: 'PLATFORM_ADMIN', suspendedAt: null };
  assert.equal((await change('STUDENT')).code, 403);
});

test('nomina locale: membro di altro server e autoassegnazione negati', async () => {
  let updates = 0;
  const tx = {
    server: { findUnique: async () => ({ id: 'a', ownerId: 'owner' }) },
    serverMember: {
      findUnique: async ({ where }) => where.userId_serverId.userId === 'member' ? { id: 'membership' } : null,
      update: async () => { updates += 1; return { userId: 'member', serverId: 'a', isAdmin: true }; }
    },
    user: { findUnique: async ({ where }) => where.id === 'actor'
      ? { id: 'actor', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN', suspendedAt: null } : { id: where.id, suspendedAt: null } }
  };
  let disconnected = 0;
  const controllers = withModules({
    'lib/prisma.js': { $transaction: async (callback) => callback(tx) },
    'lib/roleManagement.js': { lockRoles: async () => {} },
    'utils/disconnectUserSockets.js': async () => { disconnected += 1; }
  }, 'controllers/roleControllers.js');
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
  const self = response();
  await controllers.setServerAdmin({ user: { id: 'actor' }, params: { serverId: 'a', userId: 'actor' }, method: 'PUT' }, self);
  assert.equal(self.code, 400);
  const foreign = response();
  await controllers.setServerAdmin({ user: { id: 'actor' }, params: { serverId: 'a', userId: 'foreign' }, method: 'PUT' }, foreign);
  assert.equal(foreign.code, 404);
  const member = response();
  await controllers.setServerAdmin({ user: { id: 'actor' }, params: { serverId: 'a', userId: 'member' }, method: 'PUT' }, member);
  assert.equal(member.code, 200);
  assert.equal(updates, 1);
  assert.equal(disconnected, 1);
});

test('revoca globale e sospensione invalidano sessioni e socket aperti', async () => {
  let sessionDeletes = 0;
  let disconnections = 0;
  let role = 'PLATFORM_ADMIN';
  const tx = {
    user: {
      findUnique: async ({ where }) => where.id === 'root'
        ? { id: 'root', email: 'teo.sisto.04@gmail.com', role: 'SUPERADMIN', suspendedAt: null }
        : { id: 'target', role, suspendedAt: null },
      update: async ({ data }) => {
        role = data.role || role;
        return { id: 'target', role, suspendedAt: data.suspendedAt || null };
      }
    },
    session: { deleteMany: async () => { sessionDeletes += 1; } }
  };
  const controllers = withModules({
    'lib/prisma.js': { $transaction: async (callback) => callback(tx) },
    'lib/roleManagement.js': {
      lockRoles: async () => {},
      isLastSuperadmin: async () => false,
      isLastActiveSuperadmin: async () => false,
      canAffectUser: async () => true
    },
    'utils/disconnectUserSockets.js': async () => { disconnections += 1; }
  }, 'controllers/roleControllers.js');
  const response = () => ({ status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } });
  const revoke = response();
  await controllers.changeRole({ user: { id: 'root' }, params: { id: 'target' }, body: { role: 'STUDENT' }, app: {} }, revoke);
  assert.equal(revoke.code, 200);
  const suspend = response();
  await controllers.setSuspension({ user: { id: 'root', role: 'SUPERADMIN' }, params: { id: 'target' }, method: 'POST', app: {} }, suspend);
  assert.equal(suspend.code, 200);
  assert.equal(sessionDeletes, 2);
  assert.equal(disconnections, 2);
});

test('sessione esistente: sospensione blocca HTTP e Socket.IO', async () => {
  const suspended = { id: 'target', role: 'STUDENT', suspendedAt: new Date() };
  const prisma = { session: { findUnique: async () => ({ id: 'session', expiresAt: new Date(Date.now() + 60000), user: suspended }) } };
  const auth = withModules({
    'lib/prisma.js': prisma,
    'utils/sessionTokens.js': { hashSessionToken: () => 'hash' }
  }, 'middleware/authMiddleware.js');
  const response = { code: 200, status(code) { this.code = code; return this; }, json() { return this; } };
  await auth({ headers: { authorization: `Bearer ${'a'.repeat(64)}` } }, response, () => { throw new Error('Sospensione ignorata'); });
  assert.equal(response.code, 403);
  const shared = withModules({
    'lib/prisma.js': prisma,
    'utils/sessionTokens.js': { hashSessionToken: () => 'hash' }
  }, 'sockets/shared.js');
  assert.equal(await shared.getUserFromToken('a'.repeat(64)), null);
});

test('bootstrap: Teo ottiene automaticamente SUPERADMIN, gli altri STUDENT', async () => {
  let locks = 0;
  const bootstrap = withModules({
    'lib/roleManagement.js': { lockRoles: async () => { locks += 1; } }
  }, 'lib/bootstrap.js');
  const tx = {};
  assert.equal(await bootstrap.registrationRole(tx, 'other@example.com'), 'STUDENT');
  assert.equal(await bootstrap.registrationRole(tx, 'TEO.SISTO.04@GMAIL.COM'), 'SUPERADMIN');
  assert.equal(locks, 1);
});
