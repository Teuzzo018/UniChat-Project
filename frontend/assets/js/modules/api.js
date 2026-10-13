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
    throw new Error(payload.error || 'Richiesta non riuscita');
  }

  return payload;
};
