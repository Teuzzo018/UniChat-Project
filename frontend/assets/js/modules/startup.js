import { setupEventListeners } from './events.js';

export const registerStartup = (app) => {
  app.start = () => {
    app.startSplashScreenTimers();
    setupEventListeners(app);
    app.bootstrap().catch((error) => app.showToast(error.message));
  };
};
