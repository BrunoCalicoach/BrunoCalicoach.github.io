// Challenge sales page: the adaptive progression demo, the animated app screens and the FAQ.
// Everything here is illustration only; the real rules live in the challenge app.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Runs `start` while `element` is on screen and `stop` when it leaves, to save battery.
  function whileVisible(element, start, stop) {
    if (!element) return;
    if (!('IntersectionObserver' in window)) { start(); return; }
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
    }, { threshold: 0.25 }).observe(element);
  }

  // ---------- 1. Adaptive progression demo ----------
  // Example workouts for pull-ups (target 9, 7, 6, 5), following the challenge's rules.
  const SCENARIOS = {
    strong: {
      did: [11, 7, 6, 5], energy: 5, sleep: 4, easy: false,
      next: [11, 8, 7, 5],
      why: 'Every set hit, and your first set beat the target by 2. Your next first set starts from 11, and the plan takes its normal step up.'
    },
    miss: {
      did: [9, 7, 5, 4], energy: 5, sleep: 4, easy: false,
      next: [9, 7, 5, 4],
      why: 'You missed two sets on a good day, so that is your real level right now. Next time matches what you did, then climbs back by 1 rep per set every week.'
    },
    tired: {
      did: [8, 6, 5, 4], energy: 2, sleep: 1, easy: false,
      next: [9, 7, 6, 5],
      why: 'Low energy and a bad night explain the miss. Your target simply stays the same: no step back, no lost progress.'
    },
    easy: {
      did: [9, 7, 6, 5], energy: 4, sleep: 4, easy: true,
      next: [10, 8, 7, 6],
      why: 'Every set hit and you ticked "too easy", so the plan skips ahead a step instead of waiting.'
    }
  };
  const TARGET = [9, 7, 6, 5];
  const ORDER = ['strong', 'miss', 'tired', 'easy'];

  const demo = document.getElementById('how-it-adapts');
  if (demo) {
    const tabs = Array.from(demo.querySelectorAll('.demo-tab'));
    const row = (name) => demo.querySelector(`[data-row="${name}"]`);
    const why = demo.querySelector('[data-why]');
    const easy = demo.querySelector('[data-easy]');
    let current = 'strong';
    let autoTimer = null;
    let userPicked = false;

    const cell = (value, cls, delay, delta) =>
      `<span class="demo-cell ${cls}${reduceMotion ? '' : ' pop'}" style="--d:${delay}s">${value}${delta ? `<span class="demo-delta">${delta}</span>` : ''}</span>`;

    const dots = (name, value) => {
      const holder = demo.querySelector(`[data-feel="${name}"]`);
      holder.classList.toggle('low', value <= 2);
      holder.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('');
      holder.setAttribute('aria-label', `${name} ${value} out of 5`);
    };

    function show(key) {
      const s = SCENARIOS[key];
      current = key;
      tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.scenario === key)));
      row('target').innerHTML = TARGET.map((v) => cell(v, 'same', 0)).join('');
      row('did').innerHTML = s.did.map((v, i) => {
        const cls = v > TARGET[i] ? 'over' : v === TARGET[i] ? 'hit' : 'miss';
        return cell(v, cls, 0.08 * i, v > TARGET[i] ? `+${v - TARGET[i]}` : '');
      }).join('');
      dots('energy', s.energy);
      dots('sleep', s.sleep);
      easy.classList.toggle('on', s.easy);
      row('next').innerHTML = s.next.map((v, i) => {
        const diff = v - TARGET[i];
        const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
        return cell(v, cls, 0.45 + 0.08 * i, diff ? `${diff > 0 ? '+' : ''}${diff}` : '');
      }).join('');
      why.textContent = s.why;
      why.classList.remove('pop');
      void why.offsetWidth;
      if (!reduceMotion) why.classList.add('pop');
    }

    tabs.forEach((tab) => tab.addEventListener('click', () => {
      userPicked = true;
      clearInterval(autoTimer);
      show(tab.dataset.scenario);
    }));

    show(current);
    // Until a visitor picks one, the examples take turns while the demo is on screen.
    if (!reduceMotion) {
      whileVisible(demo, () => {
        if (userPicked || autoTimer) return;
        autoTimer = setInterval(() => show(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]), 6500);
      }, () => { clearInterval(autoTimer); autoTimer = null; });
    }
  }

  // ---------- 2. App screens ----------
  const fmt = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  // Demo video plays only while visible
  document.querySelectorAll('[data-lazy-video]').forEach((video) => {
    if (reduceMotion) return;
    whileVisible(video, () => { video.preload = 'auto'; video.play().catch(() => {}); }, () => video.pause());
  });

  // Rest screen: 2 to 4 minutes, shown about 25 times faster
  const restFill = document.querySelector('[data-rest-fill]');
  if (restFill) {
    const restTime = document.querySelector('[data-rest-time]');
    const restHint = document.querySelector('[data-rest-hint]');
    const restText = document.querySelector('[data-rest-text]');
    const MIN = 120, MAX = 240;
    let elapsed = 0, timer = null;
    const draw = () => {
      const ready = elapsed >= MIN;
      restFill.style.width = `${Math.min(100, (elapsed / MAX) * 100)}%`;
      restFill.classList.toggle('ready', ready);
      restTime.textContent = ready ? fmt(MAX - elapsed) : fmt(MIN - elapsed);
      restHint.textContent = ready ? 'Start when you are ready' : 'Keep resting until the minimum';
      restText.textContent = ready ? 'Start' : 'Start';
    };
    if (reduceMotion) { elapsed = 150; draw(); }
    else {
      draw();
      whileVisible(restFill, () => {
        if (timer) return;
        timer = setInterval(() => {
          elapsed += 4;
          if (elapsed > MAX + 20) elapsed = 0;
          draw();
        }, 160);
      }, () => { clearInterval(timer); timer = null; });
    }
  }

  // EMOM screen: 60-second rounds, shown 10 times faster
  const ring = document.querySelector('[data-emom-ring]');
  if (ring) {
    const seconds = document.querySelector('[data-emom-seconds]');
    const round = document.querySelector('[data-emom-round]');
    const LENGTH = 326.7;
    let left = 42, r = 4, timer = null;
    const draw = () => {
      seconds.textContent = Math.ceil(left);
      ring.style.strokeDashoffset = String(LENGTH * (1 - left / 60));
      round.textContent = `Round ${r} of 10`;
    };
    draw();
    if (!reduceMotion) {
      whileVisible(ring, () => {
        if (timer) return;
        timer = setInterval(() => {
          left -= 1;
          if (left <= 0) { left = 60; r = r >= 10 ? 1 : r + 1; }
          draw();
        }, 100);
      }, () => { clearInterval(timer); timer = null; });
    }
  }

  // Check-in screen: the ratings fill in, then the plan updates
  const scales = Array.from(document.querySelectorAll('[data-scale]'));
  const adapt = document.querySelector('[data-adapt]');
  if (scales.length && adapt) {
    const fill = (count) => scales.forEach((scale, index) => {
      const value = Number(scale.dataset.scale);
      const shown = Math.max(0, Math.min(value, count - index * 5));
      scale.querySelectorAll('i').forEach((dot, i) => dot.classList.toggle('on', i < shown));
    });
    if (reduceMotion) { fill(99); adapt.classList.add('on'); }
    else {
      let step = 0, timer = null;
      whileVisible(adapt, () => {
        if (timer) return;
        timer = setInterval(() => {
          step += 1;
          if (step > 26) { step = 0; adapt.classList.remove('on'); }
          fill(step);
          if (step === 16) adapt.classList.add('on');
        }, 160);
      }, () => { clearInterval(timer); timer = null; });
    }
  }

  // ---------- 3. FAQ accordion (same behaviour as the home page) ----------
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

  // Payments aren't set up yet: the join buttons lead to the price for now.
  document.querySelectorAll('[data-join]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    button.textContent = 'Coming soon';
  }));
})();
