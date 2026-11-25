// First-launch tour for athletes (not on coach.html): a spotlight on each part of the app with a short
// explanation. Opens by itself once per account, can be skipped, and comes back from the "?" button.
// Uses the athlete app's globals (S, currentWeek, isPro) from coaching.js.

const TOUR_KEY = () => `coaching-tour-v1:${S.client.user_id}`;

function tourSeen() {
  if (S.profile?.tour_seen_at) return true;
  try { return localStorage.getItem(TOUR_KEY()) === '1'; } catch (e) { return false; }
}

function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY(), '1'); } catch (e) { /* ignore */ }
  if (S.readOnly || S.profile?.tour_seen_at) return;
  S.profile = { ...S.profile, tour_seen_at: new Date().toISOString() };
  Data.upsert('coaching_profiles', { user_id: S.client.user_id, tour_seen_at: S.profile.tour_seen_at }).catch(() => {});
}

function tourSteps() {
  const week = S.weeks.length ? currentWeek() : null;
  const firstDay = week && (week.content.days || []).length ? `workout/${week.week_start}/0` : null;
  const name = (S.client.name || '').split(' ')[0];
  const steps = [
    { title: `Welcome${name ? ', ' + name : ''}!`, text: 'A quick tour of your coaching app: where to find your training, how to log it and where to track your progress. It takes about a minute.' },
    { go: 'training', target: '.week-nav', title: 'Your training week', text: 'Bruno publishes your plan here every week. Use the arrows to look at earlier weeks or an upcoming one. All past weeks are listed further down.' },
    { go: 'training', target: '.day-card', title: 'Open a training day', text: 'Tap a day to see its exercises. A green tick means done, orange means started.' }
  ];
  if (firstDay) {
    steps.push(
      { go: firstDay, target: '.card.ex .chips', title: 'Your targets', text: 'Sets, reps, weight, rest and RPE for each exercise, with Bruno\'s notes underneath. "Last time" shows what you did before.' },
      { go: firstDay, target: '.card.ex .sets', title: 'Log every set', text: 'After each set, enter the reps you did, the weight in kg and the RPE. The grey numbers are your targets. Everything saves by itself, even without wifi.' },
      { go: firstDay, target: '[data-tour="rest"]', title: 'Rest timer', text: 'Starts by itself when you enter a set, or tap it any time. It beeps when the shortest rest is over and again at the longest.' },
      { go: firstDay, target: '[data-tour="download"]', title: 'Gym without wifi?', text: 'Save the day as a PDF or an image. Once the app is on your home screen, your plan also works offline.' },
      { go: firstDay, target: '[data-tour="finish"]', title: 'Finish with feedback', text: 'Rate how hard the workout was and write how it felt. Bruno reads it before planning your next week, and his feedback appears at the top of the day.' });
  }
  steps.push(
    { go: 'progress', target: '[data-tour="weigh"] .form-grid', title: 'Weigh in every morning', text: 'After the bathroom, before eating or drinking. The app works out your weekly average and your estimated calorie deficit or surplus.' },
    { go: 'progress', target: '[data-tour="checkin"]', title: 'Weekly check-in', text: 'At the end of each week, rate your week and leave questions for Bruno. Body measurements and progress photos are on this page too.' },
    { go: 'nutrition', target: '[data-tour="targets"] .stats', title: 'Nutrition', text: isPro()
      ? 'Your daily calories and macros, your 3 meal plans and your water target.'
      : 'Your daily calories and macros, calculated from your details and goal, plus your water target.' },
    { go: 'lifestyle', target: '[data-tour="steps"] .form-grid', title: 'Steps and habits', text: 'Copy your daily steps from your phone\'s health app, and read the tips on activity, sleep and healthy habits.' },
    { go: 'training', target: '#help', title: 'That\'s it!', text: 'Tap the ? any time to see this tour again. Enjoy your training!' });
  return steps;
}

let tour = null;

function startTour() {
  endTour(false);
  const block = el('div', { class: 'tour-block' });
  const spot = el('div', { class: 'tour-spot none' });
  const tip = el('div', { class: 'tour-tip', role: 'dialog', 'aria-label': 'App tour' });
  document.body.append(block, spot, tip);
  tour = { steps: tourSteps(), i: 0, block, spot, tip, back: location.hash, target: null };
  tour.onMove = () => placeTour();
  tour.onKey = (e) => {
    if (e.key === 'Escape') endTour(true);
    if (e.key === 'ArrowRight') tourGo(1);
    if (e.key === 'ArrowLeft') tourGo(-1);
  };
  window.addEventListener('resize', tour.onMove);
  window.addEventListener('scroll', tour.onMove, { passive: true });
  document.addEventListener('keydown', tour.onKey);
  showTourStep();
}

function tourGo(d) {
  if (!tour) return;
  const to = tour.i + d;
  if (to < 0) return;
  if (to >= tour.steps.length) return endTour(true);
  tour.i = to;
  showTourStep();
}

function showTourStep() {
  const step = tour.steps[tour.i];
  const moved = step.go && decodeURIComponent(location.hash.slice(1)) !== step.go;
  if (moved) location.hash = step.go;
  setTimeout(() => {
    if (!tour) return;
    const target = step.target ? document.querySelector(step.target) : null;
    if (step.target && !target) { // nothing to point at for this athlete: leave the step out
      tour.steps.splice(tour.i, 1);
      if (tour.i >= tour.steps.length) return endTour(true);
      return showTourStep();
    }
    tour.target = target;
    if (target && !target.closest('.topbar, .tabs')) {
      const r = target.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 230) window.scrollTo({ top: window.scrollY + r.top - Math.max(80, (innerHeight - r.height) / 4), behavior: 'instant' });
    }
    const last = tour.i === tour.steps.length - 1;
    tour.tip.replaceChildren(
      el('div', { class: 'tour-arrow hidden' }),
      el('h3', {}, step.title),
      el('p', {}, step.text),
      el('div', { class: 'tour-dots', style: 'margin-top:12px', 'aria-label': `Step ${tour.i + 1} of ${tour.steps.length}` },
        ...tour.steps.map((_, j) => el('span', { class: j === tour.i ? 'on' : '' }))),
      el('div', { class: 'row between nowrap', style: 'margin-top:10px' },
        last ? el('span') : el('button', { class: 'btn small ghost', style: 'padding-left:0', type: 'button', onclick: () => endTour(true) }, tour.i === 0 ? 'Skip tour' : 'Skip'),
        el('div', { class: 'row nowrap', style: 'gap:6px' },
          tour.i > 0 ? el('button', { class: 'btn small', type: 'button', onclick: () => tourGo(-1) }, 'Back') : null,
          el('button', { class: 'btn small primary', type: 'button', onclick: () => tourGo(1) }, tour.i === 0 ? 'Show me' : last ? 'Done' : 'Next'))));
    placeTour();
    tour.tip.querySelector('.btn.primary').focus({ preventScroll: true });
  }, moved ? 150 : 0);
}

// Spotlight around the target; the explanation sits below it (or above when there is no room) with an arrow
function placeTour() {
  if (!tour) return;
  const { spot, tip, target } = tour;
  const gap = 8, margin = 16;
  if (!target) {
    spot.className = 'tour-spot none';
    tip.style.left = Math.max(margin, (innerWidth - tip.offsetWidth) / 2) + 'px';
    tip.style.top = Math.max(margin, (innerHeight - tip.offsetHeight) / 2) + 'px';
    return;
  }
  const r = target.getBoundingClientRect();
  spot.className = 'tour-spot';
  Object.assign(spot.style, { top: r.top - gap + 'px', left: r.left - gap + 'px', width: r.width + gap * 2 + 'px', height: r.height + gap * 2 + 'px' });
  const below = r.bottom + gap + 14 + tip.offsetHeight < innerHeight - 8;
  const top = below ? r.bottom + gap + 14 : Math.max(margin, r.top - gap - 14 - tip.offsetHeight);
  const left = Math.min(Math.max(margin, r.left + r.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - margin);
  tip.style.top = top + 'px';
  tip.style.left = left + 'px';
  const arrow = tip.querySelector('.tour-arrow');
  arrow.className = 'tour-arrow ' + (below ? 'up' : 'down');
  arrow.style.left = Math.min(Math.max(14, r.left + r.width / 2 - left - 7), tip.offsetWidth - 28) + 'px';
}

function endTour(seen) {
  if (!tour) return;
  const back = tour.back;
  tour.block.remove(); tour.spot.remove(); tour.tip.remove();
  window.removeEventListener('resize', tour.onMove);
  window.removeEventListener('scroll', tour.onMove);
  document.removeEventListener('keydown', tour.onKey);
  tour = null;
  if (seen) {
    markTourSeen();
    location.hash = back && !back.startsWith('#workout') ? back.slice(1) || 'training' : 'training';
  }
}
