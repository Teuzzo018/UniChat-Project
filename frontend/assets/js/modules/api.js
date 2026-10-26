import { state } from './state.js';

// 1. Wrapper per le richieste HTTP verso il backend (/api)
export const api = async (path, options = {}) => {
  // 1.1 Riconoscimento del tipo di corpo (FormData multipart o JSON)
  const isFormData = options.body instanceof FormData;

  // 1.2 Esecuzione della chiamata fetch verso il prefisso /api
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      // Imposta Content-Type su application/json se non si tratta di upload FormData
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      // Iniezione automatica del token di autenticazione Bearer se presente in memoria
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers
    }
  });

  // 1.3 Parsing del corpo JSON della risposta
  const payload = await response.json().catch(() => ({}));

  // 1.4 Gestione delle risposte di errore HTTP (stato diverso da 2xx)
  if (!response.ok) {
    const error = new Error(payload.error || 'Richiesta non riuscita');
    error.code = payload.code;
    throw error;
  }

  // 1.5 Restituzione del carico utile elaborato
  return payload;
};

