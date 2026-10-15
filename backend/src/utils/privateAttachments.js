const fs = require('node:fs/promises');
const path = require('node:path');
const prisma = require('../lib/prisma');
const env = require('../config/env');

const privateUploadRoot = path.join(__dirname, '../../private_uploads');
const privateUrlPrefix = '/private-uploads/';
const internalName = (name) => typeof name === 'string' && /^[a-f0-9]{32}$/.test(name);

const fileBytes = async () => {
  await fs.mkdir(privateUploadRoot, { recursive: true });
  const entries = await fs.readdir(privateUploadRoot, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !internalName(entry.name)) continue;
    total += (await fs.stat(path.join(privateUploadRoot, entry.name))).size;
  }
  return total;
};

const enforceStorageLimit = async () => {
  if (env.maxAttachmentStorageBytes === 0) {
    const error = new Error('Spazio allegati esaurito');
    error.statusCode = 507;
    throw error;
  }
  if (await fileBytes() > env.maxAttachmentStorageBytes) {
    const error = new Error('Spazio allegati esaurito');
    error.statusCode = 507;
    throw error;
  }
};

const cleanupOrphanAttachments = async ({ olderThanMs = 60 * 60 * 1000, root = privateUploadRoot } = {}) => {
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !internalName(entry.name)) continue;
    const filename = entry.name;
    const file = path.join(root, filename);
    try {
      if (Date.now() - (await fs.stat(file)).mtimeMs < olderThanMs) continue;
      const url = `${privateUrlPrefix}${filename}`;
      const [channelUses, privateUses] = await Promise.all([
        prisma.message.count({ where: { attachmentUrl: url } }),
        prisma.privateMessage.count({ where: { attachmentUrl: url } })
      ]);
      if (channelUses + privateUses === 0) {
        await fs.unlink(file);
        removed += 1;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return removed;
};

module.exports = { privateUploadRoot, privateUrlPrefix, internalName, fileBytes, enforceStorageLimit, cleanupOrphanAttachments };
