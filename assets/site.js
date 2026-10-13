(() => {
  const toast = document.querySelector("[data-toast]");
  const year = document.querySelector("[data-year]");
  let toastTimer;
  if (year) year.textContent = String(new Date().getFullYear());
    const page = document;
    const header = page.querySelector('[data-header]');
    const menuButton = header.querySelector('.menu-toggle');
    const navigation = header.querySelector('.site-nav');
    const sections = ['vision', 'apps', 'future'].map(id => document.getElementById(id));
    const sectionLinks = [...navigation.querySelectorAll('[data-section-link]')];
    const mobileNavigation = window.matchMedia('(max-width: 860px)');
    let orbitEpoch = null;
    const synchronizeOrbits = () => {
      const currentTime = document.timeline.currentTime;
      if (currentTime === null) { window.requestAnimationFrame(synchronizeOrbits); return; }
      if (orbitEpoch === null) orbitEpoch = currentTime;
      page.querySelectorAll('.universe-orbit').forEach(orbit => {
        orbit.getAnimations().forEach(animation => { animation.startTime = orbitEpoch; });
      });
    };
    window.requestAnimationFrame(synchronizeOrbits);
    const moveNavigationIndicator = link => {
      if (!link || mobileNavigation.matches) { navigation.style.setProperty('--indicator-opacity', '0'); return; }
      navigation.style.setProperty('--indicator-left', (link.offsetLeft + 15) + 'px');
      navigation.style.setProperty('--indicator-width', Math.max(0, link.offsetWidth - 30) + 'px');
      navigation.style.setProperty('--indicator-opacity', '1');
    };
    const refreshNavigationIndicator = () => {
      const highlightedLink = sectionLinks.find(link => link.matches(':hover, :focus-visible')) || sectionLinks.find(link => link.hasAttribute('aria-current'));
      moveNavigationIndicator(highlightedLink);
    };
    sectionLinks.forEach(link => {
      link.addEventListener('mouseenter', () => moveNavigationIndicator(link));
      link.addEventListener('focus', () => moveNavigationIndicator(link));
    });
    navigation.addEventListener('mouseleave', refreshNavigationIndicator);
    navigation.addEventListener('focusout', () => window.requestAnimationFrame(refreshNavigationIndicator));
    const closeMenu = () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
      navigation.classList.remove('is-open');
    };
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!expanded));
      menuButton.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
      navigation.classList.toggle('is-open', !expanded);
    });
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('click', event => { if (!header.contains(event.target)) closeMenu(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
    });
    mobileNavigation.addEventListener('change', closeMenu);

    let navigationFrame = 0;
    const updateNavigation = () => {
      navigationFrame = 0;
      const heroTop = document.getElementById('top').getBoundingClientRect().top;
      header.classList.toggle('is-scrolled', heroTop < -24);
      let activeSection = '';
      const readingLine = Math.min(window.innerHeight * .35, 220);
      sections.forEach(section => { if (section.getBoundingClientRect().top <= readingLine) activeSection = section.id; });
      sectionLinks.forEach(link => {
        if (link.hash === '#' + activeSection) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      refreshNavigationIndicator();
    };
    const scheduleNavigationUpdate = () => { if (!navigationFrame) navigationFrame = window.requestAnimationFrame(updateNavigation); };
    window.addEventListener('scroll', scheduleNavigationUpdate, { passive: true });
    window.addEventListener('resize', scheduleNavigationUpdate, { passive: true });
    updateNavigation();

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionPreference.addEventListener("change", () => window.requestAnimationFrame(synchronizeOrbits));
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
