/**
 * ============================================================================
 * CONTROLLER RICERCA GLOBALE (globalSearch.js)
 * 1. Esecuzione ricerca: interrogazione API backend (/api/search) per termine chiave
 * 2. Filtri di ambito: ricerca in tutti i server, server attivo, canale o contatti
 * 3. Paginazione e navigazione: rendering risultati con salto diretto al messaggio/contatto
 * ============================================================================
 */
export const registerGlobalSearchController = (app) => {
  const { elements, api, showToast } = app;
  let page = 1;
  let sequence = 0;
  let pending;
  let debounce;

  const render = (result) => {
    elements.globalSearchResults.replaceChildren();
    elements.globalSearchPage.textContent = String(result.page);
    elements.globalSearchPrevious.disabled = result.page <= 1;
    elements.globalSearchNext.disabled = !result.hasMore;
    elements.globalSearchStatus.textContent = result.items.length ? '' : 'Nessun risultato accessibile';
    for (const item of result.items) {
      const row = document.createElement('div');
      row.className = 'global-search-result';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'secondary-button';
      const scope = elements.globalSearchScope.value;
      title.textContent = item.name || item.fullName || item.username || 'Risultato';
      detail.textContent = scope === 'channels' ? `${item.server.name} · ${item.type}`
        : item.description || 'Server di appartenenza';
      if (scope === 'member') {
        action.textContent = 'Apri';
        action.addEventListener('click', async () => {
          elements.globalSearchDialog.close();
          try { await app.selectServer(item.id); } catch (error) { showToast(error.message); }
        });
      } else if (scope === 'channels') {
        action.textContent = 'Apri';
        action.addEventListener('click', async () => {
          elements.globalSearchDialog.close();
          try {
            await app.selectServer(item.serverId);
            await app.selectChannel(item.id);
          } catch (error) { showToast(error.message); }
        });
      }
      info.append(title, detail);
      row.append(info, action);
      elements.globalSearchResults.append(row);
    }
  };

  const search = async () => {
    const current = ++sequence;
    pending?.abort();
    pending = new AbortController();
    elements.globalSearchStatus.textContent = 'Ricerca in corso…';
    const params = new URLSearchParams({ scope: elements.globalSearchScope.value,
      q: elements.globalSearchInput.value.trim(), page: String(page), limit: '10' });
    try {
      const result = await api(`/search?${params}`, { signal: pending.signal });
      if (current === sequence) render(result);
    } catch (error) {
      if (error.name !== 'AbortError' && current === sequence) {
        elements.globalSearchStatus.textContent = error.message;
        elements.globalSearchResults.replaceChildren();
      }
    }
  };
  const schedule = () => {
    page = 1;
    ++sequence;
    pending?.abort();
    clearTimeout(debounce);
    debounce = setTimeout(search, 250);
  };
  const openSearch = () => {
    if (elements.globalSearchDialog.open) return;
    elements.globalSearchDialog.showModal();
    elements.globalSearchInput.focus();
    search();
  };
  elements.globalSearchButton.addEventListener('click', openSearch);
  elements.globalSearchClose.addEventListener('click', () => elements.globalSearchDialog.close());
  elements.globalSearchDialog.addEventListener('close', () => { ++sequence; pending?.abort(); clearTimeout(debounce); });
  elements.globalSearchInput.addEventListener('input', schedule);
  elements.globalSearchScope.addEventListener('change', schedule);
  elements.globalSearchPrevious.addEventListener('click', () => { if (page > 1) { --page; search(); } });
  elements.globalSearchNext.addEventListener('click', () => { ++page; search(); });
};
