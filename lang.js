// English / Croatian switch, shared by every public page.
// English pages live at the site root (index.html), Croatian copies in /hr/ (hr/index.html).
// - Adds an "EN · HR" switch to the top menu.
// - Remembers the visitor's choice.
// - Visitors whose phone or browser is set to Croatian get a small suggestion on English pages
//   (never an automatic redirect).
(function () {
  const lang = (document.documentElement.lang || 'en').slice(0, 2) === 'hr' ? 'hr' : 'en';
  const file = location.pathname.split('/').pop() || 'index.html';
  const otherUrl = (lang === 'hr' ? '../' : 'hr/') + file + location.search + location.hash;

  const store = {
    get() { try { return localStorage.getItem('site-language'); } catch (e) { return null; } },
    set(value) { try { localStorage.setItem('site-language', value); } catch (e) { /* private mode */ } }
  };

  // ---------- The switch in the top menu ----------
  const nav = document.querySelector('nav');
  if (nav && nav.lastElementChild) {
    const link = (code, label) => code === lang
      ? `<span class="lang-option active" aria-current="true">${label}</span>`
      : `<a class="lang-option" href="${otherUrl}" hreflang="${code}" lang="${code}" data-lang="${code}">${label}</a>`;
    const switcher = document.createElement('div');
    switcher.className = 'lang-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', lang === 'hr' ? 'Jezik' : 'Language');
    switcher.innerHTML = `${link('en', 'EN')}<span class="lang-dot" aria-hidden="true">·</span>${link('hr', 'HR')}`;

    const right = nav.lastElementChild;
    if (right.tagName === 'DIV') {
      // e.g. the social icons on the home page
      right.appendChild(switcher);
    } else {
      // e.g. the "Back" button: keep it, with the switch beside it
      const group = document.createElement('div');
      group.className = 'lang-group';
      right.replaceWith(group);
      group.appendChild(switcher);
      group.appendChild(right);
    }
  }

  document.addEventListener('click', (event) => {
    const option = event.target.closest('[data-lang]');
    if (option) store.set(option.dataset.lang);
  });

  // ---------- Suggestion for Croatian visitors ----------
  const prefersCroatian = (navigator.languages || [navigator.language || ''])
    .some((code) => /^hr\b/i.test(code));
  if (lang === 'en' && prefersCroatian && !store.get()) {
    const banner = document.createElement('div');
    banner.className = 'lang-suggest';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Hrvatska verzija stranice');
    banner.lang = 'hr';
    banner.innerHTML = `
      <span>Prikaži stranicu na hrvatskom?</span>
      <a class="lang-suggest-yes" href="${otherUrl}" data-lang="hr">Da</a>
      <button type="button" class="lang-suggest-no">Ne, hvala</button>`;
    banner.querySelector('.lang-suggest-no').addEventListener('click', () => {
      store.set('en');
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 300);
    });
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 900);
  }
})();
