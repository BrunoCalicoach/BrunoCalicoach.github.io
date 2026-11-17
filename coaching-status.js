// ===================== THE SWITCH =====================
// false = coaching is open: Apply buttons work as normal.
// true  = coaching is full: every Apply button becomes "Join the waitlist" (the newsletter sign-up
//         with "A 1-on-1 coaching spot opens" ticked), a short notice appears at the top of the page,
//         and the application form is replaced by the waitlist link.
const COACHING_FULL = false;
// ======================================================

(function () {
  // A test address can preview the full state without changing the switch: add ?coaching=full
  const preview = new URLSearchParams(location.search).get('coaching') === 'full';
  if (!COACHING_FULL && !preview) return;

  const croatian = (document.documentElement.lang || '').slice(0, 2) === 'hr';
  const TEXT = croatian ? {
    button: 'Prijavi se na listu čekanja',
    notice: 'Sva mjesta za 1-na-1 coaching su trenutno popunjena.',
    noticeLink: 'Prijavi se na listu čekanja i prvi ćeš saznati kad se mjesto otvori.',
    formTitle: 'Coaching je trenutno popunjen',
    formText: 'Trenutno ne primam nove klijente. Prijavi se na listu čekanja i javit ću ti se e-mailom čim se otvori mjesto.'
  } : {
    button: 'Join the waitlist',
    notice: 'All 1-on-1 coaching spots are currently taken.',
    noticeLink: 'Join the waitlist and be the first to know when one opens.',
    formTitle: 'Coaching is currently full',
    formText: 'I\'m not taking on new clients right now. Join the waitlist and I\'ll email you as soon as a spot opens.'
  };

  const onHome = Boolean(document.querySelector('#updates form[data-signup]'));
  const waitlistUrl = onHome ? '#updates' : 'index.html?topic=coaching#updates';
  // Only real Apply buttons (apply.html in the same folder), not the EN/HR switch (hr/apply.html, ../apply.html)
  const isApplyLink = (link) => /^apply\.html/.test(link.getAttribute('href') || '') && !link.closest('.lang-switch');

  // On the home page, jump to the sign-up and tick the coaching topic
  const goToWaitlist = () => {
    const section = document.getElementById('updates');
    const form = section.querySelector('form[data-signup]');
    if (form) form.dispatchEvent(new CustomEvent('signup:topic', { detail: 'coaching' }));
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#updates');
  };

  // 1. Apply buttons (also ones added later, like the Compare popup) lead to the waitlist
  const relabel = () => document.querySelectorAll('a[href*="apply.html"]').forEach((link) => {
    if (!isApplyLink(link) || link.dataset.waitlist) return;
    link.dataset.waitlist = '1';
    link.textContent = TEXT.button;
  });
  relabel();
  new MutationObserver(relabel).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !isApplyLink(link)) return;
    event.preventDefault();
    if (onHome) goToWaitlist();
    else location.href = waitlistUrl;
  }, true);

  // 2. A short notice at the very top of the page
  const bar = document.createElement('div');
  bar.className = 'coaching-full-bar';
  bar.innerHTML = `<span>${TEXT.notice}</span> <a href="${waitlistUrl}">${TEXT.noticeLink}</a>`;
  if (onHome) bar.querySelector('a').addEventListener('click', (event) => { event.preventDefault(); goToWaitlist(); });
  document.body.prepend(bar);

  // 3. The application page: the form is replaced by the waitlist
  const application = document.getElementById('application-form');
  if (application) {
    const box = document.createElement('div');
    box.className = 'question coaching-full-box';
    box.innerHTML = `<h2>${TEXT.formTitle}</h2><p>${TEXT.formText}</p><a class="btn-primary" href="${waitlistUrl}">${TEXT.button}</a>`;
    application.replaceWith(box);
  }

  // Styles, kept here so the switch is one self-contained file
  const style = document.createElement('style');
  style.textContent = `
    .coaching-full-bar { position: relative; z-index: 60; padding: 11px 16px; text-align: center; font-size: .9rem; line-height: 1.5;
      background: #0d3b3b; color: #e6f4f4; border-bottom: 1px solid rgba(0,128,128,.6); }
    .coaching-full-bar a { color: #7fdcdc; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
    .coaching-full-box { text-align: center; display: grid; gap: 14px; justify-items: center; }
    .coaching-full-box h2 { font-size: 1.5rem; font-weight: 800; }
    .coaching-full-box p { max-width: 32rem; line-height: 1.6; opacity: .85; }
    .coaching-full-box .btn-primary { display: inline-block; padding: 14px 26px; border-radius: 12px; color: #fff; font-weight: 700; }
  `;
  document.head.appendChild(style);
})();
