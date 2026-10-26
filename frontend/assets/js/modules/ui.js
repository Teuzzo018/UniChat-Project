import { elements } from './dom.js';

// 1. Mostra un messaggio toast temporaneo di notifica
export const showToast = (message) => {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  window.setTimeout(() => elements.toast.classList.remove('visible'), 2600);
};

// 2. Mostra una finestra modale di conferma asincrona
export const showConfirm = (message, confirmLabel = 'Conferma') => new Promise((resolve) => {
  elements.confirmDialogMessage.textContent = message;
  elements.confirmAcceptButton.textContent = confirmLabel;

  const finish = (confirmed) => {
    elements.confirmAcceptButton.removeEventListener('click', onAccept);
    elements.confirmCancelButton.removeEventListener('click', onCancel);
    elements.confirmDialog.removeEventListener('cancel', onDialogCancel);
    elements.confirmDialog.close();
    resolve(confirmed);
  };

  const onAccept = () => finish(true);
  const onCancel = () => finish(false);
  const onDialogCancel = (event) => {
    event.preventDefault();
    finish(false);
  };

  elements.confirmAcceptButton.addEventListener('click', onAccept);
  elements.confirmCancelButton.addEventListener('click', onCancel);
  elements.confirmDialog.addEventListener('cancel', onDialogCancel);
  elements.confirmDialog.showModal();
});

// 3. Estrae le iniziali maiuscole dal nome completo dell'utente (fallback avatar)
export const getInitials = (name = '?') => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

// 4. Crea un elemento DOM avatar per l'utente (immagine o iniziali con fallback)
export const createUserAvatar = (user, className = 'avatar') => {
  const avatar = document.createElement('div');
  avatar.className = className;

  if (user?.avatarUrl) {
    const image = document.createElement('img');
    image.src = user.avatarUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      avatar.replaceChildren();
      avatar.textContent = getInitials(user.fullName);
    }, { once: true });
    avatar.append(image);
    return avatar;
  }

  avatar.textContent = getInitials(user?.fullName);
  return avatar;
};

// 5. Esegue il rendering dell'avatar all'interno di un contenitore esistente
export const renderAvatarContent = (container, user) => {
  container.replaceChildren();

  if (user?.avatarUrl) {
    const image = document.createElement('img');
    image.src = user.avatarUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      container.replaceChildren();
      container.textContent = getInitials(user.fullName);
    }, { once: true });
    container.append(image);
    return;
  }

  container.textContent = getInitials(user?.fullName);
};

// 6. Restituisce l'handle o identificativo visibile (@username o email)
export const getDisplayHandle = (user) => user?.username ? `@${user.username}` : user?.email || '';

// 7. Rende cliccabili i link URL all'interno del testo di un messaggio
export const appendMessageContent = (container, text = '') => {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;

  text.replace(urlPattern, (url, _match, index) => {
    container.append(document.createTextNode(text.slice(lastIndex, index)));

    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    link.rel = 'noopener';
    container.append(link);

    lastIndex = index + url.length;
    return url;
  });

  container.append(document.createTextNode(text.slice(lastIndex)));
};

// 8. Aggiorna il contatore numerico di un badge di notifica
export const setBadgeCount = (badge, count) => {
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count <= 0);
};

