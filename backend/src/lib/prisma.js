/**
 * ============================================================================
 * CLIENT PRISMA ORM (prisma.js)
 * 1. Istanza singleton: connessione centralizzata verso il database PostgreSQL
 * ============================================================================
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
