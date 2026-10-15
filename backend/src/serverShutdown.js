const createShutdown = ({ server, io, prisma, timeoutMs = 10000, exit = process.exit }) => {
  let stopping;

  return (signal) => {
    if (stopping) return stopping;
    console.log(`Ricevuto ${signal}. Chiusura del server in corso...`);

    stopping = (async () => {
      let timer;
      try {
        await Promise.race([
          (async () => {
            await new Promise((resolve, reject) => {
              io.close((error) => error ? reject(error) : resolve());
            });
            if (server.listening) {
              await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
            }
            await prisma.$disconnect();
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Timeout arresto server')), timeoutMs);
            timer.unref?.();
          })
        ]);
        exit(0);
      } catch (error) {
        console.error('Arresto server non riuscito:', error);
        io.disconnectSockets?.(true);
        server.closeAllConnections?.();
        let disconnectTimer;
        try {
          await Promise.race([
            prisma.$disconnect().catch((disconnectError) => console.error('Disconnessione Prisma non riuscita:', disconnectError)),
            new Promise((resolve) => { disconnectTimer = setTimeout(resolve, 1000); })
          ]);
        } finally { clearTimeout(disconnectTimer); }
        exit(1);
      } finally {
        clearTimeout(timer);
      }
    })();
    return stopping;
  };
};

module.exports = createShutdown;
