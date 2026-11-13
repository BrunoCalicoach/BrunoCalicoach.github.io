// "Compare programs" on the plan detail pages.
// The page says which program it shows with data-current on this script tag, for example
//   <script src="compare.js" data-current="regular"></script>
// and needs a button with data-compare-open somewhere on the page.
//
// To change what is compared, edit PROGRAMS and FEATURES below. Only programs with
// available: true can be picked (the 8-week plan is hidden on the home page for now).
(function () {
  const PROGRAMS = {
    regular: {
      name: 'Coaching REGULAR',
      tagline: 'Calisthenics Plan',
      photo: 'folder/img9.jpeg',
      page: 'regular.html',
      apply: 'apply.html?plan=regular',
      monthly: 200,
      threeMonths: 540,
      coachDays: ['Mon', 'Wed', 'Fri'],
      available: true
    },
    pro: {
      name: 'Coaching PRO',
      tagline: 'Calisthenics + Nutrition',
      photo: 'folder/img7.jpeg',
      page: 'pro.html',
      apply: 'apply.html?plan=pro',
      monthly: 300,
      threeMonths: 840,
      coachDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      available: true
    }
  };

  // Each feature: what each program gets. true = included, false = not included,
  // or a short text for "included, and here's how much".
  const FEATURES = [
    { name: 'Personal training plan', note: 'With video tutorials and explanations', regular: true, pro: true },
    { name: 'Coach availability', note: '12pm – 4pm CEST', regular: '3 days a week', pro: '5 days a week' },
    { name: 'Training feedback', note: 'Form, technique and performance', regular: 'Once a week', pro: 'Once a week' },
    { name: 'Check in', note: 'Plan updates based on your progress', regular: 'Once a week', pro: 'Once a week' },
    { name: 'Basic nutritional guidance', note: 'Nutrition, hydration, sleep, supplements', regular: true, pro: true },
    { name: 'Nutrition plan', note: 'Fully personalised to your goals', regular: false, pro: true },
    { name: 'Customisable sample menus', note: 'For your meal plan', regular: false, pro: '4 menus' }
  ];

  // The same in every program, shown as a short list at the end.
  const SHARED = [
    ['Equipment', 'Pull up bar & dip bars'],
    ['Duration', 'Subscription based'],
    ['Difficulty', 'Personalised'],
    ['Workout time', 'Personalised']
  ];

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const script = document.currentScript;
  const current = script && script.dataset.current;
  if (!PROGRAMS[current]) return;

  const others = Object.keys(PROGRAMS).filter((key) => key !== current && PROGRAMS[key].available);
  if (!others.length) {
    document.querySelectorAll('[data-compare-open]').forEach((button) => button.remove());
    return;
  }

  let other = others[0];
  let onlyDifferences = false;
  let lastFocus = null;

  const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, size) => `<svg width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    name === 'check' ? '<polyline points="20 6 9 17 4 12"/>' :
    name === 'x' ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' :
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'}</svg>`;

  // ---------- Building the comparison ----------

  function header(key) {
    const program = PROGRAMS[key];
    return `
      <div class="cmp-head">
        <div class="cmp-photo"><img src="${program.photo}" alt=""></div>
        <div>
          ${key === current ? '<span class="cmp-badge">You are viewing</span>' : '<span class="cmp-badge cmp-badge-other">Comparing with</span>'}
          <div class="cmp-name">${escape(program.name)}</div>
          <div class="cmp-tagline">${escape(program.tagline)}</div>
        </div>
      </div>`;
  }

  function priceBlock(keys) {
    const highest = Math.max(...keys.map((key) => PROGRAMS[key].monthly));
    const row = (key, label, perMonth, total) => `
      <div class="cmp-bar-row">
        <div class="cmp-bar-label">${label}</div>
        <div class="cmp-bar-track"><div class="cmp-bar ${key === current ? 'is-current' : ''}" style="--w:${(perMonth / highest * 100).toFixed(1)}%"></div></div>
        <div class="cmp-bar-value"><strong>${Math.round(perMonth)}€</strong><span>/month</span>${total ? `<em>${total}€ total</em>` : ''}</div>
      </div>`;
    return keys.map((key) => {
      const program = PROGRAMS[key];
      const saving = program.monthly * 3 - program.threeMonths;
      return `
        <div class="cmp-price">
          <div class="cmp-price-name">${escape(program.name)}</div>
          ${row(key, '1 month', program.monthly)}
          ${row(key, '3 months', program.threeMonths / 3, program.threeMonths)}
          <div class="cmp-saving">Save ${saving}€ with 3 months</div>
        </div>`;
    }).join('');
  }

  function daysBlock(keys) {
    return keys.map((key) => {
      const program = PROGRAMS[key];
      const chips = WEEKDAYS.map((day) => `<span class="cmp-day ${program.coachDays.includes(day) ? 'on' : ''}">${day.charAt(0)}<span class="sr-only">${day}</span></span>`).join('');
      return `
        <div class="cmp-days">
          <div class="cmp-price-name">${escape(program.name)}</div>
          <div class="cmp-day-row">${chips}</div>
          <div class="cmp-days-count"><strong>${program.coachDays.length}</strong> of 5 weekdays</div>
        </div>`;
    }).join('');
  }

  function cell(value) {
    if (value === false) return `<div class="cmp-cell no">${icon('x', 16)}<span>Not included</span></div>`;
    if (value === true) return `<div class="cmp-cell yes">${icon('check', 16)}<span>Included</span></div>`;
    return `<div class="cmp-cell yes">${icon('check', 16)}<span>${escape(value)}</span></div>`;
  }

  function featuresBlock(keys) {
    return FEATURES.map((feature) => {
      const differs = String(feature[keys[0]]) !== String(feature[keys[1]]);
      if (onlyDifferences && !differs) return '';
      return `
        <div class="cmp-row ${differs ? 'differs' : ''}">
          <div class="cmp-row-label">
            <div class="cmp-row-name">${escape(feature.name)}${differs ? '<span class="cmp-diff-tag">Difference</span>' : ''}</div>
            <div class="cmp-row-note">${escape(feature.note)}</div>
          </div>
          ${cell(feature[keys[0]])}
          ${cell(feature[keys[1]])}
        </div>`;
    }).join('');
  }

  function render() {
    const keys = [current, other];
    const differences = FEATURES.filter((feature) => String(feature[keys[0]]) !== String(feature[keys[1]])).length;

    panel.innerHTML = `
      <div class="cmp-top">
        <div>
          <div class="cmp-eyebrow">Compare programs</div>
          <h2 class="cmp-title" id="cmp-title">${escape(PROGRAMS[current].name)} <span>vs</span> ${escape(PROGRAMS[other].name)}</h2>
        </div>
        <button type="button" class="cmp-close" data-compare-close aria-label="Close comparison">${icon('x', 20)}</button>
      </div>

      <div class="cmp-picker" role="radiogroup" aria-label="Program to compare with">
        <span>Compare with:</span>
        ${others.map((key) => `<button type="button" role="radio" aria-checked="${key === other}" class="cmp-chip ${key === other ? 'active' : ''}" data-compare-pick="${key}">${escape(PROGRAMS[key].name)}</button>`).join('')}
      </div>

      <div class="cmp-scroll">
        <div class="cmp-heads">${header(keys[0])}${header(keys[1])}</div>

        <section class="cmp-section cmp-anim">
          <h3>Price</h3>
          <div class="cmp-two">${priceBlock(keys)}</div>
        </section>

        <section class="cmp-section cmp-anim">
          <h3>Coach availability</h3>
          <div class="cmp-two">${daysBlock(keys)}</div>
        </section>

        <section class="cmp-section cmp-anim">
          <div class="cmp-section-top">
            <h3>What's included</h3>
            <label class="cmp-toggle">
              <input type="checkbox" data-compare-diff ${onlyDifferences ? 'checked' : ''}>
              <span class="cmp-switch" aria-hidden="true"></span>
              Only differences (${differences})
            </label>
          </div>
          <div class="cmp-table">
            <div class="cmp-row cmp-row-head">
              <div></div>
              <div>${escape(PROGRAMS[keys[0]].name)}</div>
              <div>${escape(PROGRAMS[keys[1]].name)}</div>
            </div>
            ${featuresBlock(keys)}
          </div>
        </section>

        <section class="cmp-section cmp-anim">
          <h3>The same in both</h3>
          <div class="cmp-shared">
            ${SHARED.map(([label, value]) => `<div class="cmp-shared-item"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('')}
          </div>
        </section>
      </div>

      <div class="cmp-actions">
        ${keys.map((key) => `<a class="cmp-apply ${key === current ? 'primary' : ''}" href="${PROGRAMS[key].apply}">Apply for ${escape(PROGRAMS[key].name.replace('Coaching ', ''))} ${icon('arrow', 16)}</a>`).join('')}
        <a class="cmp-link" href="${PROGRAMS[other].page}">See all ${escape(PROGRAMS[other].name.replace('Coaching ', ''))} details</a>
      </div>`;

    // Let the bars grow once they are on screen.
    setTimeout(() => panel.classList.add('cmp-ready'), 40);
  }

  // ---------- The pop-up ----------

  const overlay = document.createElement('div');
  overlay.className = 'cmp-overlay';
  overlay.hidden = true;
  overlay.innerHTML = '<div class="cmp-backdrop" data-compare-close></div>';
  const panel = document.createElement('div');
  panel.className = 'cmp-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'cmp-title');
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function open() {
    lastFocus = document.activeElement;
    render();
    overlay.hidden = false;
    document.documentElement.classList.add('cmp-locked');
    setTimeout(() => overlay.classList.add('open'), 10);
    const closeButton = panel.querySelector('.cmp-close');
    if (closeButton) closeButton.focus();
  }

  function close() {
    overlay.classList.remove('open');
    panel.classList.remove('cmp-ready');
    document.documentElement.classList.remove('cmp-locked');
    setTimeout(() => { overlay.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-compare-open]')) { event.preventDefault(); open(); return; }
    if (overlay.hidden) return;
    if (event.target.closest('[data-compare-close]')) { close(); return; }
    const pick = event.target.closest('[data-compare-pick]');
    if (pick) { other = pick.dataset.comparePick; panel.classList.remove('cmp-ready'); render(); }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-compare-diff]')) {
      onlyDifferences = event.target.checked;
      render();
      const toggle = panel.querySelector('[data-compare-diff]');
      if (toggle) toggle.focus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      // Keep keyboard focus inside the pop-up while it is open.
      const focusable = panel.querySelectorAll('button, a, input');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
