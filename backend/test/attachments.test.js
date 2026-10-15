const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { detectAttachment } = require('../src/utils/attachmentTypes');

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

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const form = (files) => {
  const body = new FormData();
  for (const file of files) body.append('file', new Blob([file.bytes], { type: file.mime }), file.name);
  body.append('content', 'test');
  return body;
};

test('contenuto: MIME ed estensione falsi non aggirano la verifica; testo eseguibile non è anteprima', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unichat-sniff-'));
  try {
    const file = path.join(dir, 'sample');
    await fs.writeFile(file, png);
    assert.equal(await detectAttachment(file, 'image.png'), 'image/png');
    assert.equal(await detectAttachment(file, 'image.jpg'), null);
    await fs.writeFile(file, '<script>alert(1)</script>');
    assert.equal(await detectAttachment(file, 'image.png'), null);
    assert.equal(await detectAttachment(file, 'readme.txt'), 'text/plain');
    await fs.writeFile(file, Buffer.from([0, 1, 2]));
    assert.equal(await detectAttachment(file, 'readme.txt'), null);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('upload: validi, limiti, accesso negato prima della scrittura e pulizia dei falliti', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unichat-upload-'));
  let cap = 100;
  const uploadEnv = { maxAttachmentBytes: 64, maxAttachmentFilesPerMessage: 1 };
  const { parseMessageUpload } = withModules({
    'config/env.js': uploadEnv,
    'utils/privateAttachments.js': {
      privateUploadRoot: dir,
      privateUrlPrefix: '/private-uploads/',
      enforceStorageLimit: async () => {
        const entries = await fs.readdir(dir);
        let total = 0;
        for (const name of entries) total += (await fs.stat(path.join(dir, name))).size;
        if (total > cap) { const error = new Error('Spazio esaurito'); error.statusCode = 507; throw error; }
      }
    }
  }, 'utils/messageUpload.js');
  const app = express();
  app.post('/messages', (req, res, next) => req.get('x-user') === 'member' ? next() : res.status(403).end(),
    parseMessageUpload, (req, res) => {
      if (req.get('x-fail')) return res.status(400).json({ error: 'Invio non riuscito' });
      req.uploadCommitted = true;
      return res.json(req.upload.file);
    });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/messages`;
  const post = (files, headers = {}) => fetch(url, { method: 'POST', body: form(files), headers: { 'x-user': 'member', ...headers } });
  try {
    let response = await fetch(url, { method: 'POST', body: form([{ name: 'image.png', mime: 'image/png', bytes: png }]) });
    assert.equal(response.status, 403);
    assert.deepEqual(await fs.readdir(dir), []);

    response = await post([{ name: 'image.png', mime: 'text/html', bytes: png }]);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.match(saved.url, /^\/private-uploads\/[a-f0-9]{32}$/);
    assert.equal(saved.mimeType, 'image/png');
    assert.deepEqual(await fs.readFile(path.join(dir, saved.url.split('/').pop())), png);

    response = await post([{ name: 'image.png', mime: 'image/png', bytes: Buffer.from('<script>') }]);
    assert.equal(response.status, 415);
    response = await post([{ name: 'big.txt', mime: 'text/plain', bytes: Buffer.alloc(65, 65) }]);
    assert.equal(response.status, 413);
    response = await post([
      { name: 'one.png', mime: 'image/png', bytes: png },
      { name: 'two.png', mime: 'image/png', bytes: png }
    ]);
    assert.equal(response.status, 400);
    cap = 10;
    response = await post([{ name: 'image.png', mime: 'image/png', bytes: png }]);
    assert.equal(response.status, 507);
    cap = 100;
    response = await post([{ name: 'image.png', mime: 'image/png', bytes: png }], { 'x-fail': 'yes' });
    assert.equal(response.status, 400);
    uploadEnv.maxAttachmentFilesPerMessage = 0;
    response = await post([]);
    assert.equal(response.status, 200);
    response = await post([{ name: 'image.png', mime: 'image/png', bytes: png }]);
    assert.equal(response.status, 400);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(await fs.readdir(dir), [saved.url.split('/').pop()]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download: autorizzazione verificata a ogni richiesta e file non esposto direttamente', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unichat-download-'));
  const name = 'a'.repeat(32);
  await fs.writeFile(path.join(dir, name), png);
  let checks = 0;
  const router = withModules({
    'middleware/authMiddleware.js': (req, res, next) => {
      if (!req.get('x-user')) return res.status(401).end();
      req.user = { id: req.get('x-user') };
      return next();
    },
    'utils/uploadParser.js': { uploadRoot: dir },
    'utils/privateAttachments.js': { privateUploadRoot: dir, internalName: (value) => /^[a-f0-9]{32}$/.test(value) },
    'utils/attachmentAccess.js': async (_url, userId) => {
      checks += 1;
      return userId === 'member' ? { attachmentName: 'image.png' } : null;
    }
  }, 'routes/uploadRoutes.js');
  const app = express();
  app.use('/api/uploads', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/uploads/private-uploads/${name}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { 'x-user': 'stranger' } })).status, 404);
    const allowed = await fetch(url, { headers: { 'x-user': 'member' } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');
    assert.match(allowed.headers.get('content-disposition'), /^attachment;/);
    assert.deepEqual(Buffer.from(await allowed.arrayBuffer()), png);
    assert.equal(checks, 2);
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/private-uploads/${name}`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('pulizia orfani: elimina solo file vecchi senza riferimenti', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unichat-orphans-'));
  const orphan = 'b'.repeat(32);
  const used = 'c'.repeat(32);
  const recent = 'd'.repeat(32);
  for (const name of [orphan, used, recent]) await fs.writeFile(path.join(dir, name), png);
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await fs.utimes(path.join(dir, orphan), old, old);
  await fs.utimes(path.join(dir, used), old, old);
  const storage = withModules({
    'lib/prisma.js': {
      message: { count: async ({ where }) => Number(where.attachmentUrl.endsWith(used)) },
      privateMessage: { count: async () => 0 }
    },
    'config/env.js': { maxAttachmentStorageBytes: 100 }
  }, 'utils/privateAttachments.js');
  try {
    assert.equal(await storage.cleanupOrphanAttachments({ root: dir }), 1);
    await assert.rejects(fs.stat(path.join(dir, orphan)), { code: 'ENOENT' });
    assert.ok(await fs.stat(path.join(dir, used)));
    assert.ok(await fs.stat(path.join(dir, recent)));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
