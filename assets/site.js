(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const toast = document.querySelector('[data-toast]');
  const year = document.querySelector('[data-year]');
  let toastTimer;

  if (year) year.textContent = String(new Date().getFullYear());

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    const label = menuButton?.querySelector('.sr-only');
    if (label) label.textContent = 'Open menu';
    navigation?.classList.remove('is-open');
  };

  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    const label = menuButton.querySelector('.sr-only');
    if (label) label.textContent = expanded ? 'Open menu' : 'Close menu';
    navigation?.classList.toggle('is-open', !expanded);
  });

  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

  const showToast = (message) => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  };

  document.querySelectorAll('[data-coming-soon]').forEach((button) => {
    button.addEventListener('click', () => {
      showToast(`${button.dataset.comingSoon} will be available soon on Google Play.`);
    });
  });
})();
