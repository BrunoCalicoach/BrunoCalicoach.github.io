// Newsletter / waitlist sign-up. Any <form data-signup> on a page sends its details to Bruno's
// Brevo form "Website sign-up" (double opt-in: Brevo emails a confirmation link first).
// Lists in Brevo: 3 = 1-on-1 coaching waitlist, 4 = Challenge launch, 5 = News and updates.
// A link like index.html?topic=challenge#updates ticks a topic in advance (coaching, challenge, news).
(function () {
  const BREVO_FORM = 'https://8d60ce78.sibforms.com/serve/MUIFACr6i8u_vfUGm50C5aG85mnlijZRo15LnPv-s3K6-nTCkI12qW9IkdSxpt8DyEZaFJrawgXiLOUnOaxzX9Ag8cLcs99Ww-gLue9kqvmfu6izcZz6YnR3lRsdVWMZveVSi9smnfnMreIwTb9tbxk2lfMVOPN9yO0H9WdbbQCWDDF_dFjTrDzS5zLJsqz-1ecT6X0frt4Ybx21xQ==';
  const TOPICS = { coaching: '3', challenge: '4', news: '5' };

  const croatian = (document.documentElement.lang || '').slice(0, 2) === 'hr';
  const TEXT = croatian ? {
    sending: 'Šaljem...',
    name: 'Upiši svoje ime.',
    email: 'Provjeri svoju e-mail adresu.',
    topic: 'Odaberi barem jednu temu.',
    failed: 'Nažalost, nešto nije uspjelo. Pokušaj ponovno ili mi piši na bruno.calicoach@gmail.com.',
    doneTitle: 'Još samo jedan korak',
    doneText: 'Provjeri svoj inbox i klikni na poveznicu u e-mailu s adrese coaching@brunozgela.com da potvrdiš prijavu. Ako ga ne vidiš, pogledaj i spam.'
  } : {
    sending: 'Sending...',
    name: 'Please enter your first name.',
    email: 'Please check your email address.',
    topic: 'Please pick at least one topic.',
    failed: 'Sorry, something went wrong. Please try again, or email me at bruno.calicoach@gmail.com.',
    doneTitle: 'Almost there',
    doneText: 'Check your inbox and click the link in the email from coaching@brunozgela.com to confirm. If you can\'t find it, have a look in your spam folder.'
  };

  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  // Pre-tick a topic from the page address, e.g. ?topic=challenge
  const wanted = new URLSearchParams(location.search).get('topic');

  document.querySelectorAll('form[data-signup]').forEach((form) => {
    const status = form.querySelector('[data-signup-status]');
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    const topics = form.querySelector('.signup-topics');
    const boxes = Array.from(form.querySelectorAll('input[name="lists_26[]"]'));
    const name = form.querySelector('[name="FIRSTNAME"]');
    const email = form.querySelector('[name="EMAIL"]');

    if (wanted && TOPICS[wanted]) {
      boxes.forEach((box) => { if (box.value === TOPICS[wanted]) box.checked = true; });
    }

    const show = (message) => {
      status.textContent = message;
      status.classList.toggle('error', Boolean(message));
    };

    // Clear the warnings as soon as the visitor fixes them
    [name, email].forEach((input) => input.addEventListener('input', () => input.classList.remove('invalid')));
    boxes.forEach((box) => box.addEventListener('change', () => topics.classList.remove('invalid')));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      name.value = name.value.trim();
      email.value = email.value.trim();

      let problem = '';
      if (!boxes.some((box) => box.checked)) { topics.classList.add('invalid'); problem = TEXT.topic; }
      if (!validEmail(email.value)) { email.classList.add('invalid'); problem = TEXT.email; }
      if (!name.value) { name.classList.add('invalid'); problem = TEXT.name; }
      if (problem) { show(problem); return; }

      show('');
      button.disabled = true;
      button.textContent = TEXT.sending;

      const data = new FormData(form);
      data.append('locale', croatian ? 'hr' : 'en');
      data.append('html_type', 'simple');

      try {
        const response = await fetch(BREVO_FORM + '?isAjax=1', { method: 'POST', body: data });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          if (result.errors && result.errors.EMAIL) email.classList.add('invalid');
          throw new Error('Brevo did not accept the sign-up');
        }
        form.innerHTML = `
          <div class="signup-done">
            <span class="signup-done-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg></span>
            <h3>${TEXT.doneTitle}</h3>
            <p>${TEXT.doneText}</p>
          </div>`;
        form.setAttribute('role', 'status');
      } catch (error) {
        show(email.classList.contains('invalid') ? TEXT.email : TEXT.failed);
        button.disabled = false;
        button.textContent = label;
      }
    });
  });
})();
