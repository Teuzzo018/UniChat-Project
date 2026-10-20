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

test('amicizie: duplicati, richieste incrociate, rifiuto, annullamento e rimozione', async () => {
  const users = new Map(['alice', 'bob', 'carol'].map((id) => [id, { id, username: id, fullName: id, suspendedAt: null }]));
  const rows = new Map();
  let blocked = false;
  let simulateUniqueRace = false;
  let next = 0;
  const find = ({ where }) => [...rows.values()].find((row) => row.id === where.id) || null;
  const db = {
    user: {
      findUnique: async ({ where }) => users.get(where.id) || null,
      findFirst: async ({ where }) => [...users.values()].find((user) =>
        user.username?.toLowerCase() === where.username.equals.toLowerCase()) || null
    },
    blockedUser: { findFirst: async () => blocked ? { id: 'block' } : null },
    friendship: {
      upsert: async ({ where, create }) => {
        const key = `${where.requesterId_addresseeId.requesterId}:${where.requesterId_addresseeId.addresseeId}`;
        if (rows.has(key) && simulateUniqueRace) throw Object.assign(new Error('Unique conflict'), { code: 'P2002' });
        if (!rows.has(key)) rows.set(key, { id: `f${++next}`, ...create, createdAt: new Date() });
        const row = rows.get(key);
        return { ...row, requester: users.get(row.requesterId), addressee: users.get(row.addresseeId) };
      },
      findUnique: async (query) => {
        const pair = query.where.requesterId_addresseeId;
        const row = pair ? rows.get(`${pair.requesterId}:${pair.addresseeId}`) : find(query);
        return row && { ...row, requester: users.get(row.requesterId), addressee: users.get(row.addresseeId) };
      },
      updateMany: async ({ where, data }) => {
        const row = find({ where });
        if (!row || row.status !== where.status || row.requestedById === where.requestedById?.not) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        const targets = [...rows.entries()].filter(([, row]) =>
          (typeof where.id === 'string' ? row.id === where.id : where.id?.in?.includes(row.id)) &&
          (!where.status || row.status === where.status) &&
          (!where.requestedById || row.requestedById === where.requestedById ||
            where.requestedById.not && row.requestedById !== where.requestedById.not));
        targets.forEach(([key]) => rows.delete(key));
        return { count: targets.length };
      },
      findMany: async ({ where }) => [...rows.values()].filter((row) =>
        (!where.status || row.status === where.status) &&
        where.OR?.some((pair) => pair.requesterId === row.requesterId && pair.addresseeId === row.addresseeId))
    }
  };
  const controller = withModules({
    'lib/prisma.js': db,
    'sockets/presence.js': { isOnline: async () => false }
  }, 'controllers/friendControllers.js');
  const req = (id, extra = {}) => ({ user: users.get(id), body: {}, params: {}, app: { get: () => null }, ...extra });
  let result = response();
  await controller.addFriend(req('alice', { body: { username: 'alice' } }), result);
  assert.equal(result.code, 400);
  await controller.addFriend(req('alice', { body: { username: 'bob' } }), response());
  await controller.addFriend(req('alice', { body: { username: 'bob' } }), response());
  assert.equal(rows.size, 1);
  await controller.addFriend(req('bob', { body: { username: 'alice' } }), response());
  assert.equal([...rows.values()][0].status, 'ACCEPTED');
  const acceptedId = [...rows.values()][0].id;
  result = response();
  await controller.declineFriendRequest(req('bob', { params: { id: acceptedId } }), result);
  assert.equal(result.code, 404);
  await controller.removeFriend(req('alice', { params: { userId: 'bob' } }), response());
  assert.equal(rows.size, 0);
  simulateUniqueRace = true;
  await Promise.all([
    controller.addFriend(req('alice', { body: { username: 'bob' } }), response()),
    controller.addFriend(req('bob', { body: { username: 'alice' } }), response())
  ]);
  assert.equal(rows.size, 1);
  assert.equal([...rows.values()][0].status, 'ACCEPTED');
  simulateUniqueRace = false;
  await controller.removeFriend(req('bob', { params: { userId: 'alice' } }), response());
  await controller.addFriend(req('alice', { body: { username: 'carol' } }), response());
  let pendingId = [...rows.values()][0].id;
  await controller.cancelFriendRequest(req('alice', { params: { id: pendingId } }), response());
  assert.equal(rows.size, 0);
  await controller.addFriend(req('alice', { body: { username: 'carol' } }), response());
  pendingId = [...rows.values()][0].id;
  await controller.declineFriendRequest(req('carol', { params: { id: pendingId } }), response());
  assert.equal(rows.size, 0);
  users.get('carol').suspendedAt = new Date();
  result = response();
  await controller.addFriend(req('alice', { body: { username: 'carol' } }), result);
  assert.equal(result.code, 403);
  users.get('carol').suspendedAt = null;
  await controller.addFriend(req('alice', { body: { username: 'carol' } }), response());
  pendingId = [...rows.values()][0].id;
  result = response();
  await controller.acceptFriendRequest(req('alice', { params: { id: pendingId } }), result);
  assert.equal(result.code, 404);
  await controller.acceptFriendRequest(req('carol', { params: { id: pendingId } }), response());
  assert.equal([...rows.values()][0].status, 'ACCEPTED');
  blocked = true;
  result = response();
  await controller.addFriend(req('alice', { body: { username: 'carol' } }), result);
  assert.equal(result.code, 403);
});

test('presenza: una scheda chiusa non spegne le altre e nessun evento raggiunge estranei', async () => {
  const sockets = [];
  const sent = [];
  const db = {
    user: { findUnique: async () => ({ suspendedAt: null }) },
    friendship: { findMany: async ({ where }) => where.OR[0].requesterId === 'eve' ? [] :
      [{ requesterId: 'alice', addresseeId: 'bob' }] },
    blockedUser: { findMany: async () => [] }
  };
  const shared = { getUserRoom: (id) => `user:${id}`, getUserFromToken: async (token) =>
    ['alice', 'bob', 'eve'].includes(token) ? { id: token } : null };
  const presence = withModules({ 'lib/prisma.js': db, 'sockets/shared.js': shared }, 'sockets/presence.js');
  const register = withModules({
    'sockets/shared.js': shared,
    'sockets/presence.js': presence,
    'sockets/chatHandlers.js': () => {}, 'sockets/voiceHandlers.js': () => {},
    'sockets/callHandlers.js': () => {}, 'sockets/gameHandlers.js': () => {}
  }, 'sockets/index.js');
  let connect;
  const io = {
    on: (_name, handler) => { connect = handler; },
    in: (room) => ({ fetchSockets: async () => sockets.filter((socket) => socket.connected && socket.rooms.has(room)) }),
    to: (room) => ({ emit: (name, payload) => sent.push({ room, name, payload }) })
  };
  register(io);
  const open = (id) => {
    const handlers = new Map();
    const socket = {
      id: `${id}-${sockets.length}`, data: {}, connected: true, rooms: new Set(),
      on: (event, handler) => handlers.set(event, handler), use: () => {},
      join(room) { this.rooms.add(room); }, leave(room) { this.rooms.delete(room); },
      emit(name, payload) { sent.push({ room: this.id, name, payload }); },
      disconnect() { this.connected = false; this.rooms.clear(); }
    };
    sockets.push(socket);
    connect(socket);
    return { socket, handlers };
  };
  const authenticate = async (connection, id) => connection.handlers.get('authenticate')({ token: id }, () => {});
  const close = async (connection) => {
    connection.socket.connected = false;
    connection.socket.rooms.clear();
    await connection.handlers.get('disconnect')();
  };
  const alice1 = open('alice');
  const alice2 = open('alice');
  const bob = open('bob');
  const eve = open('eve');
  await authenticate(alice1, 'alice');
  await authenticate(alice2, 'alice');
  await authenticate(bob, 'bob');
  await authenticate(eve, 'eve');
  assert.ok(sent.find((event) => event.room === bob.socket.id && event.name === 'presence_snapshot'), JSON.stringify(sent));
  assert.deepEqual(sent.find((event) => event.room === bob.socket.id && event.name === 'presence_snapshot').payload,
    [{ userId: 'alice', online: true }]);
  assert.deepEqual(sent.find((event) => event.room === eve.socket.id && event.name === 'presence_snapshot').payload, []);
  const before = sent.length;
  await close(alice1);
  assert.equal(sent.length, before);
  await close(alice2);
  assert.deepEqual(sent.at(-1), { room: 'user:bob', name: 'presence_changed', payload: { userId: 'alice', online: false } });
  assert.equal(sent.some((event) => event.room === 'user:eve' && event.name === 'presence_changed'), false);
});
