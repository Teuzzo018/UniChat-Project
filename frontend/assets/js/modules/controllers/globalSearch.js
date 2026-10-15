export const registerGlobalSearchController = (app) => {
  const { state, elements, api, showToast } = app;
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
        : ['users', 'friends'].includes(scope) ? `@${item.username || 'utente'}`
          : item.description || (scope === 'explore' ? 'Server scopribile' : 'Server di appartenenza');
      if (scope === 'explore') {
        action.textContent = 'Richiedi ingresso';
        action.addEventListener('click', () => app.joinServer(item.id));
      } else if (scope === 'member') {
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
      } else {
        const friend = state.friends.find((entry) => entry.friend.id === item.id);
        action.textContent = friend ? 'Chat' : 'Aggiungi';
        action.addEventListener('click', async () => {
          if (friend) {
            elements.globalSearchDialog.close();
            try { await app.selectPrivateChat(friend.friend); } catch (error) { showToast(error.message); }
          } else await app.addFriend(item.username);
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
  elements.globalSearchButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSearch(); }
  });
  elements.globalSearchClose.addEventListener('click', () => elements.globalSearchDialog.close());
  elements.globalSearchDialog.addEventListener('close', () => { ++sequence; pending?.abort(); clearTimeout(debounce); });
  elements.globalSearchInput.addEventListener('input', schedule);
  elements.globalSearchScope.addEventListener('change', schedule);
  elements.globalSearchPrevious.addEventListener('click', () => { if (page > 1) { --page; search(); } });
  elements.globalSearchNext.addEventListener('click', () => { ++page; search(); });
};
