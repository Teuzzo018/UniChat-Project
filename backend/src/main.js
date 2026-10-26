/**
 * ============================================================================
 * PUNTO D'INGRESSO PRINCIPALE DEL BACKEND (main.js)
 * 1. Inizializzazione server: creazione istanza HTTP con Express e Socket.IO
 * 2. Sanitizzazione chiamate: chiusura automatica chiamate rimaste appese al riavvio
 * 3. Pulizia allegati orfani: avvio job periodico di bonifica file non referenziati
 * 4. Avvio listener HTTP: apertura della porta configurata e gestione shutdown
 * ============================================================================
 */
const http = require('http');
const { Server } = require('socket.io');

const createApp = require('./app');
const env = require('./config/env');
const prisma = require('./lib/prisma');
const registerSocketHandlers = require('./sockets');
const createShutdown = require('./serverShutdown');
const { cleanupOrphanAttachments } = require('./utils/privateAttachments');

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.set('io', io);
registerSocketHandlers(io);

const closeServer = createShutdown({ server, io, prisma });

process.on('SIGINT', () => closeServer('SIGINT'));
process.on('SIGTERM', () => closeServer('SIGTERM'));

const listen = async () => {
  // Il signaling usa un solo processo Socket.IO. Dopo un riavvio nessuna chiamata precedente può essere viva.
  try {
    await prisma.privateCall.updateMany({
      where: { status: { in: ['RINGING', 'ACCEPTED'] } },
      data: { status: 'ENDED', endedAt: new Date() }
    });
  } catch (error) { console.error('Recupero chiamate dopo riavvio non riuscito:', error.code || error.name); }
  server.listen(env.port, () => {
    console.log(`Server Express & Socket.io in esecuzione sulla porta ${env.port}`);
  });
};
listen();

const cleanupTimer = setInterval(() => {
  cleanupOrphanAttachments().catch((error) => console.error('Pulizia upload orfani non riuscita:', error.code || error.name));
}, 60 * 60 * 1000);
cleanupTimer.unref();
cleanupOrphanAttachments().catch((error) => console.error('Pulizia upload orfani non riuscita:', error.code || error.name));
