/**
 * ============================================================================
 * TEST SUITE: PREFERITI (favorites.test.js)
 * 1. Test aggiunta preferiti: verifica salvataggio messaggio nei preferiti personali
 * 2. Test rimozione preferiti: verifica eliminazione e vincoli di unicità (no duplicati)
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

test('preferiti: non si possono salvare messaggi di canali estranei o privati altrui', async () => {
  let writes = 0;
  const prisma = {
    message: { findUnique: async () => ({ channelId: 'foreign', deletedAt: null }) },
    privateMessage: { findUnique: async () => ({ senderId: 'a', recipientId: 'b', deletedAt: null }) },
    channelMessageFavorite: { upsert: async () => { writes += 1; } },
    privateMessageFavorite: { upsert: async () => { writes += 1; } }
  };
  const controller = withModules({
    'lib/prisma.js': prisma,
    'controllers/messageControllers.js': {
      findAccessibleChannel: async (id) => id === 'mine',
      canContact: async (a, b) => a === 'a' && b === 'b'
    }
  }, 'controllers/favoriteControllers.js');
  const call = async (kind, userId = 'a') => {
    const res = response();
    await controller.changeFavorite({ user: { id: userId }, params: { kind, messageId: 'm' }, method: 'PUT' }, res);
    return res;
  };
  assert.equal((await call('channel')).code, 404);
  assert.equal((await call('private', 'stranger')).code, 404);
  assert.equal(writes, 0);
  prisma.message.findUnique = async () => ({ channelId: 'mine', deletedAt: null });
  assert.equal((await call('channel')).body.favorite, true);
  assert.equal((await call('private')).body.favorite, true);
  assert.equal(writes, 2);
});

test('preferiti: elenco omette le conversazioni non più accessibili', async () => {
  const row = (id, channelId) => ({ createdAt: new Date(), message: {
    id, channelId, content: 'ciao', user: { fullName: 'Autore' },
    channel: { name: 'generale', server: { name: 'Corso' } }
  } });
  const prisma = {
    channelMessageFavorite: { findMany: async () => [row('ok', 'mine'), row('hidden', 'foreign')] },
    privateMessageFavorite: { findMany: async () => [{ createdAt: new Date(), message: {
      id: 'private', senderId: 'a', recipientId: 'blocked', content: 'segreto', sender: { fullName: 'A' }
    } }] }
  };
  const controller = withModules({
    'lib/prisma.js': prisma,
    'controllers/messageControllers.js': {
      findAccessibleChannel: async (id) => id === 'mine' ? { id } : null,
      canContact: async () => false
    }
  }, 'controllers/favoriteControllers.js');
  const res = response();
  await controller.listFavorites({ user: { id: 'a' } }, res);
  assert.deepEqual(res.body.map((item) => item.id), ['ok']);
});
