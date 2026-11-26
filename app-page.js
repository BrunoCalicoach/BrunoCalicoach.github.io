// Coaching app sales page (app.html): small animations inside the phone screens, and the FAQ.
// Illustration only, with example data; the real app is coaching.html.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CIRC = 2 * Math.PI * 40;
  const setRing = (ring, part) => {
    const fill = ring.querySelector('.fill');
    fill.setAttribute('stroke-dasharray', `${(Math.max(0, Math.min(1, part)) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`);
    return fill;
  };

  // Runs `start` while `element` is on screen and `stop` when it leaves, to save battery
  function whileVisible(element, start, stop = () => {}) {
    if (!element) return;
    if (!('IntersectionObserver' in window)) { start(); return; }
    new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0.3 }).observe(element);
  }
  // Repeats `step` every `ms` while visible (or shows the final state once when motion is reduced)
  function loop(element, ms, step, finalState) {
    if (!element) return;
    if (reduceMotion) { finalState(); return; }
    let timer = null;
    whileVisible(element, () => { if (!timer) { step(); timer = setInterval(step, ms); } }, () => { clearInterval(timer); timer = null; });
  }

  // 1. Week ring and meal ring fill once they are seen
  document.querySelectorAll('[data-ring]').forEach((ring) => {
    const [a, b] = ring.dataset.ring.split('/').map(Number);
    const text = ring.querySelector('[data-ring-text]');
    whileVisible(ring, () => {
      setRing(ring, a / b);
      if (a === b) ring.querySelector('.fill').style.stroke = '#3fb37f';
      if (text) text.textContent = `${a}/${b}`;
    });
  });

  // 2. Sets fill in one by one, then the rest timer counts down: red until the minimum rest, then green
  const sets = document.querySelector('[data-sets]');
  const timer = document.querySelector('[data-timer]');
  if (sets && timer) {
    const cells = Array.from(sets.querySelectorAll('.ui-in'));
    cells.forEach((c) => { c.dataset.p = c.textContent; }); // the grey target shown before a set is logged
    const timerText = document.querySelector('[data-timer-text]');
    const note = document.querySelector('[data-timer-note]');
    const TOTAL = 180, MIN = 120;
    let tick = 0;
    const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const show = (filledRows, elapsed) => {
      cells.forEach((c, i) => {
        const on = Math.floor(i / 3) < filledRows;
        c.classList.toggle('empty', !on);
        c.classList.toggle('done', on);
        c.textContent = on ? c.dataset.v : c.dataset.p;
      });
      const fill = setRing(timer, elapsed / TOTAL);
      fill.style.stroke = elapsed < MIN ? '#b5473f' : '#3fb37f';
      timerText.textContent = clock(TOTAL - elapsed);
      note.textContent = elapsed < MIN ? `Ready in ${clock(MIN - elapsed)}` : 'You can start when ready';
    };
    // 4 sets; between them the rest timer runs (sped up: 15 seconds a step)
    loop(sets, 140, () => {
      tick = (tick + 1) % 64;
      const row = Math.min(4, Math.floor(tick / 13) + 1);
      const elapsed = Math.min(TOTAL, (tick % 13) * 15);
      show(row, row >= 4 ? TOTAL : elapsed);
    }, () => show(4, MIN));
  }

  // 3. The weekly average line draws itself
  const chart = document.querySelector('[data-chart]');
  whileVisible(chart, () => chart.classList.add('on'));

  // 4. Macro bars grow
  const meal = document.querySelector('[data-meal]');
  whileVisible(meal, () => meal.querySelectorAll('[data-w]').forEach((bar) => { bar.style.width = bar.dataset.w; }));

  // 5. Swap options light up one after another
  const options = Array.from(document.querySelectorAll('[data-option]'));
  let pick = -1;
  loop(options[0], 1300, () => { pick = (pick + 1) % options.length; options.forEach((o, i) => o.classList.toggle('pick', i === pick)); }, () => options[0]?.classList.add('pick'));

  // 6. Shopping list ticks itself off
  const shop = document.querySelector('[data-shop]');
  if (shop) {
    const items = Array.from(shop.querySelectorAll('.ui-item'));
    const ring = document.querySelector('[data-shop-ring]');
    const count = document.querySelector('[data-shop-count]');
    let n = 0;
    const draw = (k) => {
      items.forEach((it, i) => it.classList.toggle('done', i < k));
      setRing(ring, k / items.length).style.stroke = k === items.length ? '#3fb37f' : '#4db8b8';
      count.textContent = `${k}/${items.length}`;
    };
    loop(shop, 700, () => { n = n >= items.length + 3 ? 0 : n + 1; draw(Math.min(n, items.length)); }, () => draw(4));
  }

  // FAQ accordion (same behaviour as the home page)
  const list = document.querySelector('.faq-list');
  if (list) {
    list.classList.add('faq-ready');
    list.addEventListener('click', (event) => {
      const question = event.target.closest('.faq-question');
      if (!question) return;
      const item = question.closest('.faq-item');
      const open = !item.classList.contains('open');
      item.classList.toggle('open', open);
      question.setAttribute('aria-expanded', String(open));
    });
  }

  // Plan pages on phones: one phone screen at a time, swiped sideways; dots show which one and switch on tap
  document.querySelectorAll('.mini-phones').forEach((strip) => {
    const screens = Array.from(strip.children);
    if (screens.length < 2) return;
    const dots = document.createElement('div');
    dots.className = 'mini-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'App screens');
    const buttons = screens.map((screen, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Screen ${i + 1} of ${screens.length}`);
      b.addEventListener('click', () => strip.scrollTo({ left: screen.offsetLeft - strip.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' }));
      dots.append(b);
      return b;
    });
    strip.after(dots);
    const mark = () => {
      const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      buttons.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    };
    strip.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
    mark();
  });
})();
