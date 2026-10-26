import { setupEventListeners } from './events.js';

// 1. Registrazione del modulo di avvio (Startup)
export const registerStartup = (app) => {
  // 2. Metodo di avvio principale dell'applicazione client
  app.start = () => {
    // 2.1 Avvio dei timer per la schermata di caricamento (Splash Screen)
    app.startSplashScreenTimers();
    // 2.2 Configurazione iniziale della struttura grafica e layout shell
    app.setupShellLayout();
    // 2.3 Registrazione di tutti i listener degli eventi DOM dell'interfaccia
    setupEventListeners(app);
    // 2.4 Registrazione dei comandi slash da tastiera (es. /help, /roll)
    app.setupSlashCommands();
    // 2.5 Esecuzione del bootstrap asincrono (verifica token, carico università e dati iniziali)
    app.bootstrap().catch((error) => app.showToast(error.message));
  };
};
