/* View navigation only; authentication and data access stay in app.js. */
(() => {
  const title = document.getElementById('workspaceTitle');
  if (!title) return;
  function updateWorkspace() {
    const reviews = location.hash === '#recensioni';
    const active = reviews ? 'reviews' : 'mail';
    title.textContent = reviews ? 'Recensioni' : 'Mail e consensi';
    document.getElementById('workspaceDescription').textContent = reviews
      ? 'Valutazioni e commenti dei locali.'
      : 'Utenti con consenso attivo alle comunicazioni.';
    document.querySelectorAll('[data-workspace]').forEach(panel => {
      panel.hidden = panel.dataset.workspace !== active;
    });
    document.querySelectorAll('[data-workspace-link]').forEach(link => {
      const selected = link.dataset.workspaceLink === active;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = (reviews ? 'Recensioni' : 'Mail e consensi') + ' · Jazagora Backend';
  }
  window.addEventListener('hashchange', updateWorkspace);
  updateWorkspace();
})();
