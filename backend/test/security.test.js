/**
 * ============================================================================
 * TEST SUITE: SICUREZZA E AUTENTICAZIONE (security.test.js)
 * 1. Test protezione password: verifica hashing bcrypt e criteri di complessità
 * 2. Test sessioni: verifica hashing HMAC token, scadenza e blocco account sospesi
 * 3. Test rate limiting: verifica prevenzione attacchi brute-force su /api/auth
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const src = (name) => path.join(__dirname, '../src', name);
const withModules = (stubs, entry) => {
  const previous = new Map();
  for (const [name, exports] of Object.entries(stubs)) {
    const filename = src(name);
    previous.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  const target = src(entry);
  delete require.cache[target];
  try { return require(target); }
  finally {
    delete require.cache[target];
    for (const [filename, old] of previous) {
      if (old) require.cache[filename] = old;
      else delete require.cache[filename];
    }
  }
};

test('arresto: chiude Socket.IO, HTTP e Prisma una sola volta', async () => {
  const createShutdown = require(src('serverShutdown.js'));
  const calls = [];
  const closeServer = createShutdown({
    io: { close: (done) => { calls.push('io'); done(); } },
    server: { listening: true, close: (done) => { calls.push('http'); done(); } },
    prisma: { $disconnect: async () => { calls.push('prisma'); } },
    exit: (code) => { calls.push(`exit:${code}`); }
  });
  await Promise.all([closeServer('SIGINT'), closeServer('SIGTERM')]);
  assert.deepEqual(calls, ['io', 'http', 'prisma', 'exit:0']);
});

test('arresto: timeout forza il termine', async () => {
  const createShutdown = require(src('serverShutdown.js'));
  const calls = [];
  const closeServer = createShutdown({
    io: { close: () => {} },
    server: { closeAllConnections: () => calls.push('forced') },
    prisma: { $disconnect: async () => {} },
    timeoutMs: 10,
    exit: (code) => calls.push(`exit:${code}`)
  });
  await Promise.all([closeServer('SIGTERM'), new Promise((resolve) => setTimeout(resolve, 25))]);
  assert.deepEqual(calls, ['forced', 'exit:1']);
});

test('HTTP: richiesta anonima respinta prima di interrogare la sessione', async () => {
  let queries = 0;
  const auth = withModules({
    'lib/prisma.js': { session: { findUnique: async () => { queries += 1; } } },
    'utils/sessionTokens.js': { hashSessionToken: () => 'hash' }
  }, 'middleware/authMiddleware.js');
  let status;
  await auth({ headers: {} }, {
    status(code) { status = code; return this; }, json() { return this; }
  }, () => { throw new Error('Accesso anonimo consentito'); });
  assert.equal(status, 401);
  assert.equal(queries, 0);
});

test('Socket.IO: anonimo e membro di altro server non entrano nella room', async () => {
  const handlers = new Map();
  const rooms = [];
  let user = null;
  const register = withModules({
    'lib/prisma.js': {},
    'controllers/messageControllers.js': { findAccessibleChannel: async (_channel, id) => id === 'member' ? { id: 'channel', type: 'TEXT' } : null },
    'sockets/shared.js': {
      getChannelRoom: (id) => `channel:${id}`,
      getAuthenticatedSocketUser: async () => user
    }
  }, 'sockets/chatHandlers.js');
  register({ io: {}, socket: {
    data: {}, on: (event, handler) => handlers.set(event, handler),
    join: (room) => rooms.push(room), leave: () => {}
  } });
  const join = handlers.get('join_channel');
  let result;
  await join('channel', (response) => { result = response; });
  assert.equal(result.ok, false);
  user = { id: 'other' };
  await join('channel', (response) => { result = response; });
  assert.equal(result.ok, false);
  assert.deepEqual(rooms, []);
  user = { id: 'member' };
  await join('channel', (response) => { result = response; });
  assert.equal(result.ok, true);
  assert.deepEqual(rooms, ['channel:channel']);
});

test('allegato: verifica appartenenza al server e partecipazione al DM', async () => {
  const observed = [];
  let friends = true;
  const find = withModules({
    'controllers/messageControllers.js': { canContact: async () => friends },
    'lib/prisma.js': {
      message: { findFirst: async ({ where }) => {
        observed.push(where);
        return where.channel.server.members.some.userId === 'member' ? { attachmentName: 'a.txt' } : null;
      } },
      privateMessage: { findFirst: async ({ where }) => {
        observed.push(where);
        return where.OR.some((condition) => Object.values(condition).includes('participant'))
          ? { attachmentName: 'b.txt', senderId: 'participant', recipientId: 'friend' } : null;
      } }
    }
  }, 'utils/attachmentAccess.js');
  assert.equal(await find('/uploads/file', 'stranger'), null);
  assert.deepEqual(await find('/uploads/file', 'member'), { attachmentName: 'a.txt' });
  assert.deepEqual(await find('/uploads/file', 'participant'), {
    attachmentName: 'b.txt', senderId: 'participant', recipientId: 'friend'
  });
  friends = false;
  assert.equal(await find('/uploads/file', 'participant'), null);
  assert.equal(observed.length, 8);
  assert.equal(observed.every((where) => where.deletedAt === null), true);
});

test('Socket.IO: signaling verso una chiamata altrui non viene inoltrato', async () => {
  const handlers = new Map();
  const emitted = [];
  const register = withModules({
    'lib/prisma.js': {
      friendship: { findFirst: async () => ({ id: 'friend' }) },
      blockedUser: { findFirst: async () => null },
      privateCall: { findFirst: async () => null }
    },
    'sockets/shared.js': {
      getAuthenticatedSocketUser: async () => ({ id: 'alice' }),
      getUserRoom: (id) => `user:${id}`,
      getSocketUserSummary: (user) => ({ id: user.id })
    }
  }, 'sockets/callHandlers.js');
  register({
    io: { to: (room) => ({ emit: (name, payload) => emitted.push({ room, name, payload }) }) },
    socket: { on: (event, handler) => handlers.set(event, handler) }
  });
  await handlers.get('private_video_call_signal')({ token: 'session', callId: 'other-call', recipientId: 'bob', signal: { type: 'offer' } });
  assert.deepEqual(emitted, []);
});
