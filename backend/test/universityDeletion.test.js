/**
 * ============================================================================
 * TEST SUITE: GESTIONE UNIVERSITÀ (universityDeletion.test.js)
 * 1. Test atenei: verifica creazione, consultazione ed eliminazione atenei universitari
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const controllerPath = path.join(__dirname, '../src/controllers/universityControllers.js');
const prismaPath = path.join(__dirname, '../src/lib/prisma.js');

const controllerWithDb = (db) => {
  const oldPrisma = require.cache[prismaPath];
  const oldController = require.cache[controllerPath];
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
  delete require.cache[controllerPath];
  try { return require(controllerPath).deleteUniversity; }
  finally {
    if (oldPrisma) require.cache[prismaPath] = oldPrisma;
    else delete require.cache[prismaPath];
    if (oldController) require.cache[controllerPath] = oldController;
    else delete require.cache[controllerPath];
  }
};

const response = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; }
});

test('università: eliminazione consentita solo se non ha utenti o server', async () => {
  let deleted = 0;
  let university = { _count: { users: 0, servers: 0 } };
  const deleteUniversity = controllerWithDb({ university: {
    findUnique: async () => university,
    delete: async () => { deleted += 1; }
  } });
  const run = async () => {
    const res = response();
    await deleteUniversity({ params: { id: 'uni' } }, res);
    return res;
  };

  assert.equal((await run()).code, 200);
  assert.equal(deleted, 1);
  university = { _count: { users: 1, servers: 0 } };
  assert.equal((await run()).code, 409);
  university = { _count: { users: 0, servers: 1 } };
  assert.equal((await run()).code, 409);
  assert.equal(deleted, 1);
  university = null;
  assert.equal((await run()).code, 404);
});

test('università: un riferimento aggiunto durante la cancellazione restituisce 409', async () => {
  const deleteUniversity = controllerWithDb({ university: {
    findUnique: async () => ({ _count: { users: 0, servers: 0 } }),
    delete: async () => { throw { code: 'P2003' }; }
  } });
  const res = response();
  await deleteUniversity({ params: { id: 'uni' } }, res);
  assert.equal(res.code, 409);
});
