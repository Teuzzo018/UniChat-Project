import { setupEventListeners } from './events.js';

export const registerStartup = (app) => {
  app.start = () => {
    app.startSplashScreenTimers();
    app.setupShellLayout();
    setupEventListeners(app);
    app.setupSlashCommands();
    app.bootstrap().catch((error) => app.showToast(error.message));
  };
};
