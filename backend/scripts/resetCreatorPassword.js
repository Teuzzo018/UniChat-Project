const bcrypt = require('bcryptjs');

const env = require('../src/config/env');

const creatorEmail = 'teo.sisto.04@gmail.com';
const creatorUsername = 'teosisto04';

async function main() {
  const password = process.env.CREATOR_PASSWORD;
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('CREATOR_PASSWORD deve contenere da 12 a 128 caratteri');
  }

  const passwordHash = await bcrypt.hash(password, env.saltRounds);
  const prisma = require('../src/lib/prisma');

  try {
    await prisma.$transaction(async (tx) => {
      const creator = await tx.user.upsert({
        where: { email: creatorEmail },
        create: {
          email: creatorEmail,
          username: creatorUsername,
          fullName: 'Teo Sisto',
          passwordHash,
          role: 'SUPERADMIN'
        },
        update: {
          passwordHash,
          role: 'SUPERADMIN',
          suspendedAt: null
        },
        select: { id: true }
      });

      await tx.session.deleteMany({ where: { userId: creator.id } });
    });

    console.log('Password del Creator aggiornata. Le sessioni precedenti sono state revocate.');
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Impossibile aggiornare il Creator:', error.message);
    process.exitCode = 1;
  });
