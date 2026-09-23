const prisma = require('../lib/prisma');

const listUniversities = async (req, res) => {
  const universities = await prisma.university.findMany({
    orderBy: { name: 'asc' }
  });

  return res.status(200).json(universities);
};

const createUniversity = async (req, res) => {
  try {
    const { name, domain } = req.body;

    if (!name || !domain) {
      return res.status(400).json({
        error: 'Nome e dominio sono obbligatori'
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

    await prisma.university.delete({
      where: { id }
    });

    return res.status(200).json({ message: 'Università eliminata con successo' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Università non trovata' });
    }

    return res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
};

module.exports = {
  createUniversity,
  deleteUniversity,
  listUniversities
};
