import { state } from './state.js';

export const api = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || 'Richiesta non riuscita');
    error.code = payload.code;
    throw error;
  }

  return payload;
};
