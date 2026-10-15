const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');

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
const response = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; }
});

const fixture = () => {
  const channels = new Map([
    ['a', { id: 'a', type: 'TEXT', serverId: 'server-a' }],
    ['b', { id: 'b', type: 'TEXT', serverId: 'server-b' }]
  ]);
  const messages = new Map([
    ['m-a', { id: 'm-a', channelId: 'a', userId: 'author', content: 'testo', attachmentUrl: '/uploads/not-present-file.txt', attachmentName: 'file.txt', attachmentMimeType: 'text/plain', attachmentSize: 4, deletedAt: null }],
    ['m-b', { id: 'm-b', channelId: 'b', userId: 'author', content: 'altro', attachmentUrl: null, deletedAt: null }]
  ]);
  const privateMessages = new Map([
    ['dm', { id: 'dm', senderId: 'author', recipientId: 'peer', content: 'privato', attachmentUrl: null, deletedAt: null }]
  ]);
  let channelWrites = 0;
  let privateWrites = 0;
  let friendsActive = true;
  const db = {
    friendship: { findFirst: async ({ where }) => friendsActive && where.OR.some((pair) =>
      [pair.requesterId, pair.addresseeId].includes('author') && [pair.requesterId, pair.addresseeId].includes('peer'))
      ? { id: 'friendship' } : null },
    blockedUser: { findFirst: async () => null },
    channel: { findUnique: async ({ where }) => channels.get(where.id) || null },
    user: {
      findUnique: async ({ where }) => ['author', 'peer', 'stranger'].includes(where.id)
        ? { id: where.id } : null,
      count: async () => 0
    },
    message: {
      findUnique: async ({ where, select }) => {
        const item = messages.get(where.id);
        return item ? { ...item, ...(select?.channel ? { channel: { serverId: channels.get(item.channelId).serverId } } : {}) } : null;
      },
      findMany: async ({ where }) => [...messages.values()].filter((item) => item.channelId === where.channelId),
      updateMany: async ({ where, data }) => {
        const item = messages.get(where.id);
        if (!item || item.channelId !== where.channelId || item.deletedAt) return { count: 0 };
        Object.assign(item, data);
        channelWrites += 1;
        return { count: 1 };
      },
      count: async () => 0
    },
    privateMessage: {
      findUnique: async ({ where }) => privateMessages.get(where.id) || null,
      findMany: async () => [...privateMessages.values()],
      updateMany: async ({ where, data }) => {
        const item = privateMessages.get(where.id);
        if (!item || item.senderId !== where.senderId || item.deletedAt) return { count: 0 };
        Object.assign(item, data);
        privateWrites += 1;
        return { count: 1 };
      },
      count: async () => 0
    }
  };
  const deletion = withModules({
    'lib/prisma.js': db,
    'utils/uploadParser.js': { uploadRoot: os.tmpdir() }
  }, 'utils/messageDeletion.js');
  const controller = withModules({
    'lib/prisma.js': db,
    'controllers/serverControllers.js': { ensureServerMember: async (serverId, userId) =>
      userId === 'author' && serverId === 'server-a' || userId === 'peer' && serverId === 'server-a'
        || userId === 'global' && serverId === 'server-b' ? { id: 'membership' } : null },
    'lib/authorization.js': { canModerateServer: async (user, serverId) =>
      user.id === 'global' || user.id === 'local' && serverId === 'server-a' },
    'utils/messageDeletion.js': deletion
  }, 'controllers/messageControllers.js');
  const clients = { author: [], peer: [] };
  const events = [];
  const io = { to(room) { return { emit(name, payload) {
    events.push({ room, name, payload });
    if (room === 'channel:a') {
      clients.author.push(payload);
      clients.peer.push(payload);
    }
    if (room === 'user:author') clients.author.push(payload);
    if (room === 'user:peer') clients.peer.push(payload);
  } }; } };
  const app = { get: () => io };
  return { controller, messages, privateMessages, clients, events, app,
    setFriendsActive: (value) => { friendsActive = value; },
    writes: () => ({ channelWrites, privateWrites }) };
};

test('DM: dopo la rimozione amicizia cronologia e nuovo invio sono negati', async () => {
  const f = fixture();
  const req = { user: { id: 'author' }, params: { userId: 'peer' }, app: f.app,
    body: { content: 'ciao' } };
  const allowed = response();
  await f.controller.listPrivateMessages(req, allowed);
  assert.equal(allowed.code, 200);
  assert.equal(allowed.body.length, 1);
  f.setFriendsActive(false);
  const history = response();
  await f.controller.listPrivateMessages(req, history);
  assert.equal(history.code, 404);
  const send = response();
  await f.controller.createPrivateMessage(req, send);
  assert.equal(send.code, 403);
  f.setFriendsActive(true);
  const restored = response();
  await f.controller.listPrivateMessages(req, restored);
  assert.equal(restored.body.length, 1);
});

test('autore: tombstone persistente e aggiornamento di due client, ripetizione idempotente', async () => {
  const f = fixture();
  const req = { user: { id: 'author' }, params: { channelId: 'a', messageId: 'm-a' }, app: f.app };
  const first = response();
  await f.controller.deleteChannelMessage(req, first);
  assert.equal(first.code, 200);
  assert.equal(first.body.alreadyDeleted, false);
  assert.equal(f.messages.get('m-a').content, '');
  assert.equal(f.messages.get('m-a').attachmentUrl, null);
  assert.equal(f.messages.get('m-a').attachmentName, null);
  assert.ok(f.messages.get('m-a').deletedAt);
  assert.equal(f.clients.author.length, 1);
  assert.equal(f.clients.peer.length, 1);
  assert.equal(f.events[0].name, 'message_deleted');
  const history = response();
  await f.controller.listMessages({ user: req.user, params: { channelId: 'a' } }, history);
  assert.equal(history.body[0].deletedAt != null, true);
  const repeat = response();
  await f.controller.deleteChannelMessage(req, repeat);
  assert.equal(repeat.code, 200);
  assert.equal(repeat.body.alreadyDeleted, true);
  assert.equal(f.writes().channelWrites, 1);
  assert.equal(f.events.length, 1);
});

test('canali: ID di altra conversazione e assenza di appartenenza non danno accesso', async () => {
  const f = fixture();
  const stranger = response();
  await f.controller.deleteChannelMessage({
    user: { id: 'stranger' }, params: { channelId: 'a', messageId: 'm-a' }, app: f.app
  }, stranger);
  assert.equal(stranger.code, 404);
  const foreign = response();
  await f.controller.deleteChannelMessage({
    user: { id: 'author' }, params: { channelId: 'a', messageId: 'm-b' }, app: f.app
  }, foreign);
  assert.equal(foreign.code, 404);
  const otherMember = response();
  await f.controller.deleteChannelMessage({
    user: { id: 'peer' }, params: { channelId: 'a', messageId: 'm-a' }, app: f.app
  }, otherMember);
  assert.equal(otherMember.code, 403);
  const forbidden = response();
  await f.controller.deleteServerMessage({
    user: { id: 'peer' }, params: { id: 'server-b', messageId: 'm-b' }, app: f.app
  }, forbidden);
  assert.equal(forbidden.code, 403);
  const global = response();
  await f.controller.deleteServerMessage({
    user: { id: 'global' }, params: { id: 'server-b', messageId: 'm-b' }, app: f.app
  }, global);
  assert.equal(global.code, 200);
  assert.equal(f.messages.get('m-b').content, '');
  const local = response();
  await f.controller.deleteServerMessage({
    user: { id: 'local' }, params: { id: 'server-a', messageId: 'm-a' }, app: f.app
  }, local);
  assert.equal(local.code, 200);
  assert.ok(f.messages.get('m-a').deletedAt);
});

test('privati: solo l’autore nella coppia corretta; evento a entrambi i partecipanti', async () => {
  const f = fixture();
  const recipient = response();
  await f.controller.deletePrivateMessage({
    user: { id: 'peer' }, params: { userId: 'author', messageId: 'dm' }, app: f.app
  }, recipient);
  assert.equal(recipient.code, 403);
  const third = response();
  await f.controller.deletePrivateMessage({
    user: { id: 'stranger' }, params: { userId: 'author', messageId: 'dm' }, app: f.app
  }, third);
  assert.equal(third.code, 404);
  const wrongPair = response();
  await f.controller.deletePrivateMessage({
    user: { id: 'author' }, params: { userId: 'stranger', messageId: 'dm' }, app: f.app
  }, wrongPair);
  assert.equal(wrongPair.code, 404);
  const first = response();
  await f.controller.deletePrivateMessage({
    user: { id: 'author' }, params: { userId: 'peer', messageId: 'dm' }, app: f.app
  }, first);
  assert.equal(first.code, 200);
  assert.equal(f.privateMessages.get('dm').content, '');
  assert.equal(f.clients.author.length, 1);
  assert.equal(f.clients.peer.length, 1);
  assert.equal(f.events.every((event) => event.name === 'private_message_deleted'), true);
  const repeat = response();
  await f.controller.deletePrivateMessage({
    user: { id: 'author' }, params: { userId: 'peer', messageId: 'dm' }, app: f.app
  }, repeat);
  assert.equal(repeat.body.alreadyDeleted, true);
  assert.equal(f.writes().privateWrites, 1);
  assert.equal(f.events.length, 2);
});

test('allegato condiviso resta finché referenziato, poi viene rimosso', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unichat-delete-'));
  const filename = 'shared-file.txt';
  const file = path.join(dir, filename);
  await fs.writeFile(file, 'example');
  let references = 1;
  let avatarReferences = 0;
  const deletion = withModules({
    'lib/prisma.js': {
      message: { count: async () => references },
      privateMessage: { count: async () => 0 },
      user: { count: async () => avatarReferences }
    },
    'utils/uploadParser.js': { uploadRoot: dir }
  }, 'utils/messageDeletion.js');
  try {
    await deletion.cleanupAttachment(`/uploads/${filename}`);
    assert.equal(await fs.readFile(file, 'utf8'), 'example');
    references = 0;
    avatarReferences = 1;
    await deletion.cleanupAttachment(`/uploads/${filename}`);
    assert.equal(await fs.readFile(file, 'utf8'), 'example');
    avatarReferences = 0;
    await deletion.cleanupAttachment(`/uploads/${filename}`);
    await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
