const prisma = require('../lib/prisma');

const listUniversities = async (req, res) => {
  const universities = await prisma.university.findMany({
    orderBy: { name: 'asc' }
  });

  return res.status(200).json(universities);
};

const createUniversity = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim().toLowerCase() : '';

    if (name.length < 2 || name.length > 100 ||
        !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      return res.status(400).json({
        error: 'Inserisci un nome e un dominio universitario validi (es. uniroma.it)'
      });
    }

    const newUniversity = await prisma.university.create({
      data: { name, domain }
    });

    return res.status(201).json(newUniversity);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Nome o dominio già esistenti' });
    }

    return res.status(500).json({ error: 'Errore durante la creazione' });
  }
};

const deleteUniversity = async (req, res) => {
  try {
    const { id } = req.params;

    const university = await prisma.university.findUnique({
      where: { id },
      select: { _count: { select: { users: true, servers: true } } }
    });
    if (!university) return res.status(404).json({ error: 'Università non trovata' });
    if (university._count.users || university._count.servers) {
      return res.status(409).json({ error: 'Elimina prima gli utenti e i server collegati a questa università' });
    }

    await prisma.university.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Università eliminata con successo' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Università non trovata' });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'Elimina prima gli utenti e i server collegati a questa università' });
    }

    return res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
};

module.exports = {
  createUniversity,
  deleteUniversity,
  listUniversities
};
