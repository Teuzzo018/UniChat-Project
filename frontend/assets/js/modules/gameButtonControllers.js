// 1. Configurazione animazione particelle a controller per il pulsante minigiochi
export const setupGameButtonControllers = (button) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'game-controller-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  let timer = null;

  // 1.1 Generazione di un mini-controller fluttuante con animazione CSS
  const spawnController = () => {
    if (reducedMotion.matches || layer.childElementCount >= 3) return;

    const rect = button.getBoundingClientRect();
    const angle = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.6;
    const distance = 34 + Math.random() * 20;
    const controller = document.createElement('span');
    controller.className = 'game-mini-controller';
    controller.style.left = `${Math.max(4, Math.min(window.innerWidth - 28, rect.left + rect.width / 2 + Math.cos(angle) * distance - 12))}px`;
    controller.style.top = `${Math.max(4, Math.min(window.innerHeight - 24, rect.top + rect.height / 2 + Math.sin(angle) * distance - 10))}px`;
    controller.style.setProperty('--controller-rotation', `${-14 + Math.random() * 28}deg`);
    controller.innerHTML = '<svg viewBox="0 0 32 24" aria-hidden="true"><path class="controller-shell" d="M9.5 5.5h13c3.1 0 4.5 1.9 5.2 4.6l1.4 5.7c.7 3-.6 5.1-2.9 5.1-1.4 0-2.4-.7-3.5-2.1l-2-2.4h-9.4l-2 2.4c-1.1 1.4-2.1 2.1-3.5 2.1-2.3 0-3.6-2.1-2.9-5.1l1.4-5.7c.7-2.7 2.1-4.6 5.2-4.6Z"/><path class="controller-detail" d="M9 11h6m-3-3v6"/><circle class="controller-detail-fill" cx="21.5" cy="10" r="1.2"/><circle class="controller-detail-fill" cx="24.5" cy="13" r="1.2"/></svg>';
    controller.addEventListener('animationend', () => controller.remove(), { once: true });
    layer.append(controller);
  };

  // 1.2 Avvio dell'effetto al passaggio del mouse o focus
  const start = () => {
    if (timer !== null || reducedMotion.matches) return;
    spawnController();
    timer = window.setInterval(spawnController, 420);
  };

  // 1.3 Arresto dell'effetto
  const stop = () => {
    window.clearInterval(timer);
    timer = null;
  };

  // 1.4 Registrazione degli eventi pointer ed accessibilità
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') start();
  });
  button.addEventListener('pointerleave', stop);
  button.addEventListener('focus', () => {
    if (button.matches(':focus-visible')) start();
  });
  button.addEventListener('blur', stop);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      stop();
      layer.replaceChildren();
    }
  });
};

