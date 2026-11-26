// Athlete side of the 1-on-1 coaching app: weekly plans and history, workout logging set by set,
// progress (weight, measurements, check-ins, photos), nutrition (TDEE, targets, PRO meal plans) and lifestyle (steps).
// Bruno's preview: coaching.html?as=<athlete id>&preview=draft while logged in as the coach (read only).

const app = document.getElementById('app');
const tabsNav = document.getElementById('tabs');
const signOutButton = document.getElementById('sign-out');
const params = new URLSearchParams(location.search);

const S = {
  client: null, profile: null, weeks: [], logs: [], feedback: [], daily: [], measurements: [], checkins: [],
  targets: null, meals: null, guides: [], readOnly: false, preview: false
};

const TABS = [
  { id: 'training', label: 'Training', icon: 'dumbbell' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'nutrition', label: 'Nutrition', icon: 'apple' },
  { id: 'shopping', label: 'Shopping', icon: 'cart', pro: true },
  { id: 'lifestyle', label: 'Lifestyle', icon: 'leaf' }
];

/* ---------- Start ---------- */

signOutButton.addEventListener('click', signOut);

if (DEMO) {
  const as = params.get('as') || 'demo-athlete';
  demoBar('Demo mode: sample data, saved only in this browser. ');
  const bar = document.querySelector('.demo-bar');
  bar.append(' View as: ',
    el('a', { href: '?demo&as=demo-athlete', style: 'margin:0 4px' }, 'PRO athlete'),
    el('a', { href: '?demo&as=demo-regular', style: 'margin:0 4px' }, 'REGULAR athlete'),
    el('a', { href: 'coach.html?demo', style: 'margin:0 4px' }, 'Coach'));
  startFor(as, { preview: params.get('preview') === 'draft' });
} else {
  watchAuth(async (user) => {
    signOutButton.classList.remove('hidden');
    Data.setOwner(user.id);
    let coach = false;
    try { coach = await Data.rpc('is_coach'); } catch (e) { /* offline: not needed */ }
    const as = params.get('as');
    if (coach && as) return startFor(as, { preview: params.get('preview') === 'draft', coachView: true });
    let rows = [];
    try { rows = await Data.select('coaching_clients', { user_id: user.id }); } catch (e) { return fatal(e); }
    if (!rows.length) {
      return show(el('div', { class: 'stack', style: 'margin-top:30px' },
        el('h1', {}, coach ? 'Coach account' : 'Your account is ready'),
        coach
          ? el('p', { class: 'soft' }, 'This is the coach account. Plans are edited in the coach editor.')
          : el('p', { class: 'soft' }, 'Bruno will connect your account to your coaching plan. Once he has, this page shows your training, progress and nutrition.'),
        coach ? el('a', { class: 'btn primary', href: 'coach.html' }, 'Open the coach editor') : el('p', { class: 'muted small' }, `Logged in as ${user.email}`)));
    }
    startFor(user.id, { email: user.email });
  }, () => {
    signOutButton.classList.add('hidden');
    tabsNav.classList.add('hidden');
    authView(app, { title: 'Log in to your coaching', intro: 'Your training plan, progress and nutrition in one place.' });
  });
}

window.addEventListener('hashchange', route);

async function startFor(clientId, { preview = false, coachView = false, email = '' }) {
  S.preview = preview;
  S.email = email;
  S.readOnly = preview || coachView;
  if (!DEMO && !coachView) Data.setOwner(clientId);
  if (DEMO) Data.setOwner('demo:' + clientId);
  show(el('p', { class: 'muted', style: 'text-align:center;margin-top:40px' }, 'Loading…'));
  try {
    await Data.flush();
    const id = { client_id: clientId };
    const [client, profile, weeks, logs, feedback, daily, measurements, checkins, targets, meals, guides, choices, athleteFoods, intake] = await Promise.all([
      Data.select('coaching_clients', { user_id: clientId }),
      Data.select('coaching_profiles', { user_id: clientId }),
      Data.select(preview ? 'coaching_drafts' : 'coaching_weeks', id, ['week_start']),
      Data.select('coaching_logs', id),
      Data.select('coaching_feedback', id),
      Data.select('coaching_daily', id, ['day']),
      Data.select('coaching_measurements', id, ['day']),
      Data.select('coaching_checkins', id, ['week_start']),
      Data.select('coaching_targets', id),
      Data.select('coaching_meal_plans', id).catch(() => []),
      loadGuides(),
      Data.select('coaching_meal_choices', id).catch(() => []),
      Data.select('coaching_athlete_foods', id, ['name']).catch(() => []),
      // The Initial Form; if its table isn't set up yet, the app works as before instead of blocking everyone
      Data.select('coaching_intake', id).catch(() => null)
    ]);
    Object.assign(S, { client: client[0], profile: profile[0] || { user_id: clientId }, weeks, logs, feedback, daily, measurements, checkins,
      targets: targets[0] || null, meals: meals[0] || null, guides, choices: choices[0]?.choices || {}, athleteFoods, intake: intake ? intake[0] || null : undefined });
  } catch (error) { return fatal(error); }
  if (!S.client) return fatal(new Error('No coaching account found.'));
  if (S.readOnly) {
    document.body.prepend(el('div', { class: 'demo-bar' }, `${S.preview ? 'Preview of the draft plan' : 'Coach view'} for ${S.client.name}. Nothing here can be changed.`));
  }
  registerWorker();
  if (!S.readOnly && !S.profile.consent_at) return consentGate();
  openApp();
}

// After consent: the Initial Form first (until it is sent), then the app and, the first time, the tour
function openApp() {
  if (!S.readOnly && S.intake !== undefined && !S.intake?.submitted_at) return intakeForm({ onDone: openApp });
  renderTabs();
  route();
  ready();
}

// The "?" button is always there; the tour opens by itself only the first time on this account
function ready() {
  const help = document.getElementById('help');
  help.classList.remove('hidden');
  help.onclick = () => startTour();
  if (!S.readOnly && !tourSeen()) setTimeout(() => startTour(), 400);
}

// Weight, measurements and photos are health data (GDPR): ask once before anything is stored
function consentGate() {
  const box = el('input', { type: 'checkbox', id: 'consent' });
  const go = el('button', { class: 'btn primary block', disabled: true }, 'Continue');
  box.addEventListener('change', () => { go.disabled = !box.checked; });
  go.addEventListener('click', async () => {
    go.disabled = true;
    const row = { user_id: S.client.user_id, consent_at: new Date().toISOString() };
    try { await Data.upsert('coaching_profiles', row); } catch (e) { go.disabled = false; return alert(e.message); }
    S.profile = { ...S.profile, ...row };
    openApp();
  });
  show(el('div', { class: 'stack', style: 'margin-top:20px' },
    el('h1', {}, `Welcome, ${S.client.name.split(' ')[0]}`),
    el('div', { class: 'card stack' },
      el('p', { class: 'soft' }, 'This app keeps your initial form (training history, goals, injuries and health), your training plan, workout results, body weight, measurements, steps, check-ins and progress photos.'),
      el('p', { class: 'soft' }, 'Only you and Bruno can see them. They are used only for your coaching, and you can ask Bruno to delete them at any time.'),
      el('label', { class: 'row nowrap', style: 'align-items:flex-start;gap:12px;font-weight:600', for: 'consent' }, box,
        el('span', {}, 'I agree that my health and training data is stored for my coaching.')),
      el('p', { class: 'small soft' }, 'Under 18? A parent or legal guardian must agree to your coaching and to this before you continue.'),
      el('p', { class: 'small' }, el('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, 'Read the privacy policy')),
      go)));
}

/* ---------- Initial Form: one section per step, saved as the athlete goes, sent to Bruno at the end ---------- */

function intakeForm({ onDone, editing = false }) {
  const sections = intakeSectionsFor(isPro());
  const answers = clone(S.intake?.answers || {});
  if (!answers.name) answers.name = S.client.name;
  if (!answers.email && S.email) answers.email = S.email;
  const profile = { ...S.profile };
  // Profile answers (sex, birth date, height, weight, activity, goal) live in the athlete's profile
  const get = (f) => (f.profile ? (profile[f.key] ?? '') : answers[f.key]);
  const set = (f, v) => { if (f.profile) profile[f.key] = v; else answers[f.key] = v; };
  let step = Math.max(0, Math.min(sections.length - 1, editing ? 0 : (S.intake?.answers?._step || 0)));
  const reopened = !editing && S.intake && !S.intake.submitted_at && S.intake.answers?._sentBefore;
  tabsNav.classList.add('hidden');

  function control(f, onChange) {
    const v = get(f);
    if (f.type === 'choice') {
      const box = el('div', { class: 'choice-grid' + (f.wide ? ' wide' : '') });
      const draw = () => box.replaceChildren(...intakeOptions(f).map(([k, label]) => el('button', { type: 'button', class: 'choice-btn' + (String(get(f)) === String(k) ? ' active' : ''), 'aria-pressed': String(String(get(f)) === String(k)),
        onclick: () => { set(f, k); draw(); onChange(); } }, label)));
      draw();
      return box;
    }
    if (f.type === 'multi') {
      const chosen = new Set(Array.isArray(v) ? v : []);
      return el('div', { class: 'allergen-chips' }, ...intakeOptions(f).map(([k, label]) => {
        const box = el('input', { type: 'checkbox', checked: chosen.has(k) });
        box.addEventListener('change', () => { if (box.checked) chosen.add(k); else chosen.delete(k); set(f, intakeOptions(f).map(([o]) => o).filter((o) => chosen.has(o))); onChange(); });
        return el('label', { class: 'allergen-chip pick' }, box, label);
      }));
    }
    if (f.type === 'textarea') {
      const t = el('textarea', { class: 'field', value: v || '', placeholder: f.placeholder || '', rows: 3 });
      t.addEventListener('input', () => { set(f, t.value); onChange(); });
      return t;
    }
    const type = { number: 'text', tel: 'tel', email: 'email', date: 'date', time: 'time' }[f.type] || 'text';
    const input = el('input', { class: 'field', type, value: v ?? '', placeholder: f.placeholder || '', inputMode: f.type === 'number' ? 'decimal' : null, max: f.type === 'date' ? today() : null,
      autocomplete: f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.key === 'name' ? 'name' : null });
    input.addEventListener('input', () => { set(f, input.value); onChange(); });
    return f.unit ? el('div', { class: 'row nowrap', style: 'gap:8px' }, el('div', { class: 'grow' }, input), el('span', { class: 'muted' }, f.unit)) : input;
  }

  // Saves what is there so far (the athlete can close the app and continue later)
  async function saveDraft(submitted) {
    const prof = { user_id: S.client.user_id };
    for (const s of sections) for (const f of s.fields) if (f.profile && profile[f.key] !== '' && profile[f.key] !== undefined) {
      prof[f.key] = ['height_cm', 'start_weight', 'activity'].includes(f.key) ? num(profile[f.key]) : profile[f.key];
    }
    // Answers to questions that no longer apply (e.g. "Please explain" after switching to No) are dropped
    for (const s of sections) for (const f of s.fields) if (f.showIf && !f.showIf(answers)) delete answers[f.key];
    const row = { client_id: S.client.user_id, answers: { ...answers, _step: step, _sentBefore: answers._sentBefore || Boolean(submitted) || undefined },
      submitted_at: submitted ? new Date().toISOString() : (editing ? S.intake?.submitted_at || null : null) };
    if (submitted) delete row.answers._step;
    await saveRow('coaching_profiles', prof);
    await saveRow('coaching_intake', row);
    S.profile = { ...S.profile, ...prof };
    S.intake = row;
  }

  function draw() {
    const s = sections[step];
    const errors = new Map();
    const rows = [];
    const drawFields = () => rows.forEach((r) => r());
    const fieldsBox = el('div', { class: 'stack', style: 'gap:18px' });
    const msg = el('p', { class: 'msg' });
    const buildFields = () => {
      rows.length = 0;
      fieldsBox.replaceChildren(...s.fields.filter((f) => !f.showIf || f.showIf(answers)).map((f) => {
        const err = el('p', { class: 'msg err small' });
        rows.push(() => { err.textContent = errors.get(f.key) || ''; });
        const onChange = () => {
          if (errors.has(f.key)) { errors.delete(f.key); drawFields(); }
          if (s.fields.some((x) => x.showIf)) { const before = fieldsBox.querySelectorAll('.q').length; const after = s.fields.filter((x) => !x.showIf || x.showIf(answers)).length; if (before !== after) buildFields(); }
        };
        return el('div', { class: 'q' },
          el('div', { class: 'q-label' }, f.label, f.required ? null : el('span', { class: 'muted', style: 'font-weight:500' }, ' (optional)')),
          f.hint ? el('p', { class: 'small muted', style: 'margin:2px 0 8px' }, f.hint) : null,
          control(f, onChange), err);
      }));
      drawFields();
    };
    buildFields();

    const back = step > 0 ? el('button', { class: 'btn', type: 'button', onclick: () => { step--; draw(); } }, 'Back')
      : editing ? el('button', { class: 'btn', type: 'button', onclick: () => onDone() }, 'Cancel') : null;
    const last = step === sections.length - 1;
    const next = el('button', { class: 'btn primary grow', type: 'button' }, last ? (editing && S.intake?.submitted_at ? 'Save changes' : 'Send to Bruno') : 'Next');
    next.addEventListener('click', async () => {
      errors.clear();
      for (const f of s.fields) {
        if (f.showIf && !f.showIf(answers)) continue;
        const p = intakeProblem(f, get(f));
        if (p) errors.set(f.key, p);
      }
      drawFields();
      if (errors.size) { msg.className = 'msg err'; msg.textContent = 'Please check the answers marked in red.'; fieldsBox.querySelector('.msg.err:not(:empty)')?.closest('.q')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      next.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving…';
      try {
        if (last) step = sections.length - 1;
        else step++;
        await saveDraft(last);
        if (last) { toast(editing ? 'Your answers are updated. Bruno can see them now.' : 'Thank you! Bruno has your answers.'); onDone(); return; }
        draw();
      } catch (e) {
        if (!last) step--;
        next.disabled = false; msg.className = 'msg err';
        msg.textContent = navigator.onLine ? 'Not saved: ' + e.message : 'You are offline. Your answers are kept on this phone; connect to the internet to continue.';
      }
    });

    show(el('div', { class: 'stack intake', style: 'margin-top:12px' },
      el('div', {},
        el('div', { class: 'mlabel', style: 'color:var(--accent-soft)' }, editing ? 'Your initial form' : 'Before you start'),
        el('h1', {}, step === 0 && !editing ? `Hi ${(answers.name || S.client.name).split(' ')[0]}!` : s.title)),
      step === 0 && !editing ? el('p', { class: 'soft' }, reopened
        ? 'Bruno asked you to look over your initial form again. Your earlier answers are filled in: update anything that has changed and send it again.'
        : 'Before your first plan, Bruno needs to get to know you. It takes about 5–10 minutes and your answers are saved after every step, so you can finish later. Please be thorough: the more Bruno knows, the better he can coach you.') : null,
      el('div', { class: 'intake-steps', 'aria-label': `Step ${step + 1} of ${sections.length}` }, ...sections.map((x, i) => el('span', { class: i < step ? 'done' : i === step ? 'now' : '' }))),
      el('div', { class: 'small muted' }, `Step ${step + 1} of ${sections.length} · ${s.title}`),
      el('div', { class: 'card stack' }, cardHead(s.icon, s.title), el('p', { class: 'small soft' }, s.intro), fieldsBox),
      msg,
      el('div', { class: 'row nowrap intake-nav' }, back, next)));
  }
  draw();
}

function fatal(error) {
  console.error(error);
  show(el('div', { class: 'card', style: 'margin-top:30px' },
    el('h2', {}, error instanceof OfflineError ? 'You are offline' : 'Something went wrong'),
    el('p', { class: 'soft', style: 'margin-top:8px' }, error instanceof OfflineError
      ? 'Open the app once while online, then it also works without a connection.'
      : (error.message || 'Please reload the page.'))));
}

function show(...nodes) { app.replaceChildren(...nodes); window.scrollTo(0, 0); }

function renderTabs() {
  tabsNav.classList.remove('hidden');
  tabsNav.replaceChildren(...TABS.filter((t) => !t.pro || isPro()).map((t) => el('button', { type: 'button', 'data-tab': t.id, onclick: () => { location.hash = t.id; } }, icon(t.icon), t.label)));
}

function route() {
  if (!S.client) return;
  const hash = decodeURIComponent(location.hash.slice(1));
  const [view, a, b] = hash.split('/');
  const tab = view === 'workout' || view === 'week' || !view ? 'training' : view;
  tabsNav.querySelectorAll('button').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  stopTimer();
  // Safety net: if a page fails to draw, say so (with a way back) instead of leaving "Loading…" on screen
  try {
    if (view === 'workout') return renderWorkout(a, Number(b));
    if (view === 'progress') return renderProgress();
    if (view === 'nutrition') return renderNutrition();
    if (view === 'shopping') return renderShopping();
    if (view === 'lifestyle') return renderLifestyle();
    return renderTraining(view === 'week' ? a : null);
  } catch (error) {
    console.error(error);
    show(el('div', { class: 'card stack', style: 'margin-top:20px' },
      el('h2', {}, 'This page could not open'),
      el('p', { class: 'soft' }, 'Sorry, something went wrong. Your saved data is safe. Please tell Bruno, and include this message:'),
      el('p', { class: 'small muted pre' }, String(error?.message || error)),
      el('button', { class: 'btn', onclick: () => { location.hash = 'training'; } }, 'Back to training')));
  }
}

/* ---------- Helpers ---------- */

const logFor = (week, day) => S.logs.find((l) => l.week_start === week && l.day_index === day);
const feedbackFor = (week, day) => S.feedback.find((f) => f.week_start === week && f.day_index === day);
const guide = (key) => S.guides.find((g) => g.key === key);
const isPro = () => S.client.tier === 'pro';

function currentWeek() {
  const now = mondayOf();
  const past = S.weeks.filter((w) => w.week_start <= now);
  return past.length ? past[past.length - 1] : S.weeks[0];
}

function dayStatus(week, i) {
  const log = logFor(week.week_start, i);
  if (log?.completed_at) return 'done';
  if (log && Object.keys(log.entries || {}).length) return 'partial';
  return 'todo';
}

async function saveRow(table, row) {
  if (S.readOnly) return row;
  return Data.upsert(table, row);
}

function guideCard(key, open = false) {
  const g = guide(key);
  if (!g || !g.body) return null;
  const d = el('details', { class: 'card', open }, el('summary', { style: 'cursor:pointer;font-weight:700' }, g.title),
    el('p', { class: 'soft pre small', style: 'margin-top:10px' }, g.body));
  return d;
}

/* ---------- Training: week overview and history ---------- */

function renderTraining(weekStart) {
  if (!S.weeks.length) {
    return show(el('h1', {}, 'Training'), el('div', { class: 'card', style: 'margin-top:16px' },
      el('p', { class: 'soft' }, 'Your first week is on its way. Bruno publishes it here as soon as it is ready.')));
  }
  const week = S.weeks.find((w) => w.week_start === weekStart) || currentWeek();
  const index = S.weeks.indexOf(week);
  const days = week.content.days || [];
  const thisMonday = mondayOf();
  const when = week.week_start === thisMonday ? 'This week' : week.week_start > thisMonday ? 'Upcoming' : 'Past week';

  // Week header: arrows, the week's name and a ring for workouts done this week
  const total = days.length;
  const doneCount = days.filter((_, i) => dayStatus(week, i) === 'done').length;
  const nav = el('div', { class: 'card week-hero' },
    el('div', { class: 'week-nav' },
      el('button', { class: 'btn icon-btn', 'aria-label': 'Previous week', disabled: index <= 0, onclick: () => { location.hash = 'week/' + S.weeks[index - 1].week_start; } }, icon('left')),
      el('div', { class: 'grow' }, el('div', { class: 'mlabel', style: 'color:var(--accent-soft)' }, when),
        el('h1', {}, week.label || 'Week'), el('div', { class: 'muted small' }, weekRange(week.week_start))),
      el('button', { class: 'btn icon-btn', 'aria-label': 'Next week', disabled: index >= S.weeks.length - 1, onclick: () => { location.hash = 'week/' + S.weeks[index + 1].week_start; } }, icon('right'))),
    el('div', { class: 'week-ring-row' },
      progressRing(doneCount, total, { size: 84, big: `${doneCount}/${total}`, small: 'done', color: doneCount === total && total ? 'var(--good)' : 'var(--kcal)' }),
      el('div', { class: 'small soft' }, doneCount === total && total ? 'Every workout of this week is done. Great work!'
        : `${total - doneCount} workout${total - doneCount === 1 ? '' : 's'} to go this week.`)));

  // One numbered card per training day, like the meal cards
  const cards = days.map((day, i) => {
    const status = dayStatus(week, i);
    const count = exerciseRows(day).length;
    const fb = feedbackFor(week.week_start, i);
    return el('button', { class: 'card card-link day-card' + (status === 'done' ? ' is-done' : ''), type: 'button', onclick: () => { location.hash = `workout/${week.week_start}/${i}`; } },
      el('div', { class: 'meal-head', style: 'margin-bottom:0' },
        numTag(i + 1), el('span', { class: 'meal-icon' }, icon('dumbbell', 18)),
        el('h3', {}, day.title || `Day ${i + 1}`),
        status === 'done' ? el('span', { class: 'status-badge done' }, icon('check', 14), 'Done')
          : status === 'partial' ? el('span', { class: 'status-badge partial' }, 'Started') : el('span', { class: 'muted' }, icon('right', 18))),
      day.subtitle ? el('div', { class: 'day-sub' }, day.subtitle) : null,
      el('div', { class: 'chips', style: 'margin-top:10px' },
        el('span', { class: 'chip' }, el('b', {}, String(count)), ` exercise${count === 1 ? '' : 's'}`),
        fb ? el('span', { class: 'chip teal-chip' }, 'Feedback from Bruno') : null));
  });

  const weekFb = feedbackFor(week.week_start, -1);
  const history = S.weeks.slice().reverse().map((w) => {
    const t = (w.content.days || []).length;
    const done = (w.content.days || []).filter((_, i) => dayStatus(w, i) === 'done').length;
    return el('button', { class: 'card card-link tight week-row' + (w === week ? ' current' : ''), type: 'button', onclick: () => { location.hash = 'week/' + w.week_start; } },
      progressRing(done, t, { size: 40, big: String(done), stroke: 11, color: done === t && t ? 'var(--good)' : 'var(--kcal)' }),
      el('div', { class: 'grow' }, el('b', {}, w.label || 'Week'), el('div', { class: 'small muted' }, weekRange(w.week_start))),
      el('span', { class: 'small muted' }, `${done}/${t}`));
  });

  show(el('div', { class: 'stack' }, nav,
    installCard(),
    week.content.note ? el('div', { class: 'notice pre' }, week.content.note) : null,
    weekFb ? el('div', { class: 'notice pre' }, el('b', {}, 'Bruno: '), weekFb.body) : null,
    ...cards,
    el('div', { class: 'section-title' }, 'All weeks'),
    ...history,
    el('div', { class: 'section-title' }, 'Guides'),
    guideCard('rpe')));
}

/* ---------- Workout: targets, set-by-set logging, rest timer, feedback ---------- */

const RPE_VALUES = ['', '5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];

function previousResult(weekStart, row) {
  // The same exercise in an earlier week: same row (Bruno copied the week) or the same name
  const name = String(row.c.name || '').trim().toLowerCase();
  const earlier = S.logs.filter((l) => l.week_start < weekStart).sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  for (const log of earlier) {
    if (log.entries?.[row.id]?.sets?.some((s) => s.reps)) return { log, entry: log.entries[row.id] };
    const week = S.weeks.find((w) => w.week_start === log.week_start);
    const other = week?.content.days?.[log.day_index]?.rows?.find((r) => String(r.c.name || '').trim().toLowerCase() === name);
    if (other && log.entries?.[other.id]?.sets?.some((s) => s.reps)) return { log, entry: log.entries[other.id] };
  }
  return null;
}

function summary(entry) {
  const sets = (entry?.sets || []).filter((s) => s.reps || s.weight);
  if (!sets.length) return '';
  const reps = sets.map((s) => s.reps || '–').join(', ');
  const weights = [...new Set(sets.map((s) => s.weight).filter(Boolean))];
  const rpes = sets.map((s) => s.rpe).filter(Boolean);
  return reps + (weights.length ? ` @ ${weights.join('/')}` : '') + (rpes.length ? ` · RPE ${rpes.join(', ')}` : '');
}

function renderWorkout(weekStart, dayIndex) {
  const week = S.weeks.find((w) => w.week_start === weekStart);
  const day = week?.content.days?.[dayIndex];
  if (!day) { location.hash = 'training'; return; }
  const existing = logFor(weekStart, dayIndex);
  const log = existing ? clone(existing) : { client_id: S.client.user_id, week_start: weekStart, day_index: dayIndex, entries: {}, note: '', difficulty: null, completed_at: null };
  const columns = week.content.columns || DEFAULT_COLUMNS;
  const extraCols = columns.filter((c) => !['name', 'weight', 'sets', 'reps', 'rest', 'rpe', 'notes'].includes(c.key));
  const state = el('span', { class: 'save-state' }, '');

  const persist = debounce(async () => {
    log.client_id = S.client.user_id;
    const at = S.logs.findIndex((l) => l.week_start === weekStart && l.day_index === dayIndex);
    if (at >= 0) S.logs[at] = clone(log); else S.logs.push(clone(log));
    state.textContent = 'Saving…';
    try { await saveRow('coaching_logs', log); state.textContent = navigator.onLine ? 'Saved' : 'Saved on this phone'; }
    catch (e) { state.textContent = 'Not saved: ' + e.message; state.classList.add('dirty'); }
  }, 600);

  const blocks = [];
  let number = 0;
  for (const row of day.rows || []) {
    if (row.kind === 'section') { if (row.c.name) blocks.push(el('div', { class: 'ex-section' }, row.c.name)); continue; }
    if (!String(row.c.name || '').trim()) continue;
    blocks.push(exerciseCard(row, log, weekStart, extraCols, persist, ++number));
  }

  const fb = feedbackFor(weekStart, dayIndex);
  const difficulty = el('div', { class: 'rating', role: 'group', 'aria-label': 'How hard was it, 1 to 10' },
    ...Array.from({ length: 10 }, (_, i) => {
      const b = el('button', { type: 'button', class: log.difficulty === i + 1 ? 'active' : '', disabled: S.readOnly }, String(i + 1));
      b.addEventListener('click', () => { log.difficulty = i + 1; difficulty.querySelectorAll('button').forEach((x, j) => x.classList.toggle('active', j === i)); persist(); });
      return b;
    }));
  const note = el('textarea', { class: 'field', placeholder: 'How did it feel? Energy, pain, anything you changed or could not finish…', disabled: S.readOnly, value: log.note || '' });
  note.addEventListener('input', () => { log.note = note.value; persist(); });
  const finish = el('button', { class: 'btn primary block', type: 'button', disabled: S.readOnly }, log.completed_at ? 'Save changes' : 'Finish workout');
  const doneText = el('p', { class: 'small muted', style: 'text-align:center' }, log.completed_at ? `Completed ${new Date(log.completed_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '');
  finish.addEventListener('click', () => {
    if (!log.completed_at) log.completed_at = new Date().toISOString();
    persist.flush();
    location.hash = 'week/' + weekStart;
  });

  show(el('div', { class: 'stack' },
    el('div', { class: 'row nowrap' },
      el('button', { class: 'btn icon-btn', 'aria-label': 'Back to the week', onclick: () => { location.hash = 'week/' + weekStart; } }, icon('left')),
      el('div', { class: 'grow' }, el('div', { class: 'small muted' }, `${week.label || 'Week'} · ${weekRange(weekStart)}`), el('h1', {}, day.title || `Day ${dayIndex + 1}`)),
      el('button', { class: 'btn icon-btn', 'aria-label': 'Download this day', 'data-tour': 'download', title: 'Download for offline use', onclick: () => downloadMenu(week, day) }, icon('download'))),
    day.subtitle ? el('p', { class: 'soft', style: 'font-weight:600' }, day.subtitle) : null,
    day.description ? el('div', { class: 'notice pre' }, day.description) : null,
    fb ? el('div', { class: 'notice pre' }, el('b', {}, 'Feedback from Bruno: '), fb.body) : null,
    el('div', { class: 'row between small' }, el('a', { href: '#', onclick: (e) => { e.preventDefault(); rpeHelp(); } }, 'What is RPE?'), state),
    ...blocks,
    el('div', { class: 'card stack', style: 'margin-top:24px', 'data-tour': 'finish' },
      el('h2', {}, 'How did it go?'),
      el('div', { class: 'small soft' }, 'Overall difficulty (1 = very easy, 10 = as hard as it gets)'),
      difficulty, note, finish, doneText)));
}

function exerciseCard(row, log, weekStart, extraCols, persist, number = 1) {
  const entry = log.entries[row.id] = log.entries[row.id] || { sets: [] };
  const count = Math.max(setCount(row), entry.sets.length);
  while (entry.sets.length < count) entry.sets.push({ reps: '', weight: '', rpe: '' });
  const rest = restSeconds(row.c.rest);
  const prev = previousResult(weekStart, row);

  // Targets as small labelled tiles: SETS 4 · REPS 30, 28, 26 · WEIGHT 40kg …
  const chips = el('div', { class: 'targets' });
  const chip = (label, value) => { if (value && value !== '/') chips.append(el('div', { class: 'target' }, el('span', { class: 'tlabel' }, label), el('b', {}, value))); };
  chip('Sets', row.c.sets); chip('Reps', row.c.reps); chip('Weight', row.c.weight); chip('Rest', row.c.rest); chip('RPE', row.c.rpe);
  for (const col of extraCols) chip(col.label, row.c[col.key]);

  const body = el('tbody');
  const weightTargets = (i) => targetForSet(row.c.weight === '/' ? '' : row.c.weight, i, entry.sets.length);
  function drawSets() {
    body.replaceChildren(...entry.sets.map((set, i) => {
      const target = targetForSet(row.c.reps, i, entry.sets.length);
      const reps = el('input', { class: 'set-in', inputMode: 'decimal', value: set.reps || '', placeholder: target.length <= 6 ? target : '', 'aria-label': `Set ${i + 1} reps`, disabled: S.readOnly });
      const weight = el('input', { class: 'set-in', inputMode: 'decimal', value: set.weight || '', placeholder: (weightTargets(i) || '').replace(/kg/i, '').trim().slice(0, 6), 'aria-label': `Set ${i + 1} weight`, disabled: S.readOnly });
      const rpe = el('select', { class: 'set-in rpe', 'aria-label': `Set ${i + 1} RPE`, disabled: S.readOnly },
        ...RPE_VALUES.map((v) => el('option', { value: v, selected: String(set.rpe || '') === v }, v || '–')));
      const tr = el('tr', { class: set.reps ? 'set-done' : '' },
        el('td', { class: 'n' }, String(i + 1)),
        el('td', { class: 't' }, target.length > 6 ? target : ''),
        el('td', {}, reps), el('td', {}, weight), el('td', {}, rpe));
      const update = () => { set.reps = reps.value.trim(); set.weight = weight.value.trim(); set.rpe = rpe.value; tr.classList.toggle('set-done', Boolean(set.reps)); persist(); };
      reps.addEventListener('input', update); weight.addEventListener('input', update); rpe.addEventListener('change', update);
      reps.addEventListener('change', () => { if (reps.value && rest && i < entry.sets.length - 1) startTimer(rest, row.c.name); });
      return tr;
    }));
  }
  drawSets();
  const hasLongTargets = entry.sets.some((_, i) => targetForSet(row.c.reps, i, entry.sets.length).length > 6);

  const exNote = el('textarea', { class: 'field', style: 'min-height:60px;margin-top:8px', placeholder: 'Note on this exercise (optional)', value: entry.note || '', disabled: S.readOnly });
  exNote.addEventListener('input', () => { entry.note = exNote.value; persist(); });
  const noteWrap = el('div', { class: entry.note ? '' : 'hidden' }, exNote);

  return el('div', { class: 'card ex' },
    el('div', { class: 'ex-head' }, numTag(number), el('div', { class: 'grow' }, el('div', { class: 'ex-name' }, row.c.name)),
      rest ? el('button', { class: 'btn small rest-btn', type: 'button', 'data-tour': 'rest', title: 'Start the rest timer', onclick: () => startTimer(rest, row.c.name) }, icon('timer', 16), 'Rest') : null),
    chips,
    row.c.notes ? el('div', { class: 'ex-notes' }, row.c.notes) : null,
    row.c.video ? el('a', { class: 'small', href: row.c.video, target: '_blank', rel: 'noopener' }, 'Watch the video') : null,
    prev ? el('div', { class: 'ex-last' }, `Last time (${niceDate(prev.log.week_start)}): ${summary(prev.entry)}`) : null,
    el('table', { class: 'sets' },
      el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, hasLongTargets ? 'Target' : ''), el('th', {}, 'Reps'), el('th', {}, 'Kg'), el('th', {}, 'RPE'))),
      body),
    S.readOnly ? null : el('div', { class: 'row', style: 'margin-top:8px' },
      el('button', { class: 'btn small ghost', type: 'button', onclick: () => { entry.sets.push({ reps: '', weight: '', rpe: '' }); drawSets(); persist(); } }, '+ Set'),
      el('button', { class: 'btn small ghost', type: 'button', onclick: () => { if (entry.sets.length > 1) { entry.sets.pop(); drawSets(); persist(); } } }, '− Set'),
      el('button', { class: 'btn small ghost', type: 'button', onclick: () => { noteWrap.classList.toggle('hidden'); exNote.focus(); } }, 'Note')),
    noteWrap);
}

function rpeHelp() {
  const g = guide('rpe');
  modal(g?.title || 'RPE', el('p', { class: 'soft pre' }, g?.body || ''));
}

/* Rest timer: counts down from the longest rest, marks the shortest, beeps and vibrates */
let timer = null;
function startTimer(rest, name) {
  stopTimer();
  const started = Date.now();
  const total = Math.max(rest.max, 10);
  // A ring that fills while you rest: red until the shortest rest is over, then green
  const ring = progressRing(0, 1000, { size: 64, big: clock(total), color: '#b5473f', stroke: 10 });
  const label = el('div', { class: 'small muted' });
  const box = el('div', { class: 'timer', role: 'timer' },
    el('div', { class: 'row nowrap', style: 'gap:12px' }, ring,
      el('div', { class: 'grow' }, el('div', { class: 'mlabel', style: 'color:var(--text-muted)' }, 'Rest'), el('div', { class: 'small', style: 'font-weight:700' }, name), label),
      el('div', { class: 'stack', style: 'gap:6px' }, el('button', { class: 'btn small', type: 'button', onclick: () => { timer.extra += 30; } }, '+30 s'),
        el('button', { class: 'btn small primary', type: 'button', onclick: stopTimer }, 'Done'))));
  document.body.append(box);
  let buzzedMin = false;
  timer = { box, extra: 0, tick: setInterval(() => {
    const t = (Date.now() - started) / 1000;
    const end = total + timer.extra;
    const left = Math.max(0, end - t);
    ring.update(Math.min(1000, (t / end) * 1000), clock(left), undefined, rest.min && t < rest.min ? '#b5473f' : 'var(--good)');
    label.textContent = rest.min && rest.min < rest.max ? (t < rest.min ? `Ready in ${clock(rest.min - t)}` : 'You can start when ready') : '';
    if (rest.min && t >= rest.min && !buzzedMin) { buzzedMin = true; buzz(1); }
    if (left <= 0) { buzz(2); stopTimer(); }
  }, 250) };
}
function stopTimer() { if (timer) { clearInterval(timer.tick); timer.box.remove(); timer = null; } }
function clock(s) { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function buzz(times) {
  try { navigator.vibrate?.(times > 1 ? [200, 120, 200] : 200); } catch (e) { /* ignore */ }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.3); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.25);
      o.start(ctx.currentTime + i * 0.3); o.stop(ctx.currentTime + i * 0.3 + 0.26);
    }
  } catch (e) { /* no sound */ }
}

/* ---------- Download a day: PDF (print) or image ---------- */

function downloadMenu(week, day) {
  const m = modal('Download for the gym',
    el('p', { class: 'soft small' }, 'Once installed, the app keeps your current week on the phone and works without wifi. You can also save this day as a PDF or an image.'),
    el('button', { class: 'btn primary block', onclick: () => { m.close(); printDay(week, day); } }, 'Save as PDF / print'),
    el('button', { class: 'btn block', onclick: () => { m.close(); dayImage(week, day); } }, 'Save as image'));
}

function dayLines(week, day) {
  const cols = (week.content.columns || DEFAULT_COLUMNS).filter((c) => c.key !== 'name');
  return { cols, rows: (day.rows || []).filter((r) => String(r.c.name || '').trim()) };
}

function printDay(week, day) {
  const { cols, rows } = dayLines(week, day);
  const area = document.getElementById('print-area');
  area.replaceChildren(
    el('h1', {}, `${day.title}${day.subtitle ? ' – ' + day.subtitle : ''}`),
    el('div', {}, `${S.client.name} · ${week.label || ''} · ${weekRange(week.week_start)}`),
    day.description ? el('p', { style: 'margin-top:6px' }, day.description) : null,
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Exercise'), ...cols.map((c) => el('th', {}, c.label)), el('th', { class: 'write' }, 'Done (reps / kg / RPE)'))),
      el('tbody', {}, ...rows.map((r) => r.kind === 'section'
        ? el('tr', { class: 'sec' }, el('td', { colSpan: cols.length + 2 }, r.c.name))
        : el('tr', {}, el('td', {}, r.c.name), ...cols.map((c) => el('td', {}, r.c[c.key] || '')), el('td', { class: 'write' }, ''))))));
  setTimeout(() => window.print(), 50);
}

async function dayImage(week, day) {
  const { cols, rows } = dayLines(week, day);
  const W = 1080, pad = 48;
  const canvas = el('canvas', { width: W, height: 4000 });
  const ctx = canvas.getContext('2d');
  const wrap = (text, width, font) => {
    ctx.font = font;
    const words = String(text || '').split(/\s+/); const lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line);
    return lines;
  };
  ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, W, 4000);
  let y = pad + 10;
  ctx.fillStyle = '#4db8b8'; ctx.font = '700 26px Inter, sans-serif'; ctx.fillText(`${week.label || ''} · ${weekRange(week.week_start)}`, pad, y); y += 54;
  ctx.fillStyle = '#ffffff'; ctx.font = '800 52px Inter, sans-serif'; ctx.fillText(day.title || '', pad, y); y += 46;
  if (day.subtitle) { for (const l of wrap(day.subtitle, W - 2 * pad, '600 28px Inter, sans-serif')) { ctx.fillStyle = '#b4b4b4'; ctx.fillText(l, pad, y); y += 38; } }
  if (day.description) { y += 10; for (const l of wrap(day.description, W - 2 * pad, '400 24px Inter, sans-serif')) { ctx.fillStyle = '#b4b4b4'; ctx.fillText(l, pad, y); y += 32; } }
  y += 20;
  for (const r of rows) {
    if (r.kind === 'section') { y += 16; ctx.fillStyle = '#4db8b8'; ctx.font = '800 26px Inter, sans-serif'; ctx.fillText(String(r.c.name).toUpperCase(), pad, y); y += 40; continue; }
    const nameLines = wrap(r.c.name, W - 2 * pad - 40, '700 32px Inter, sans-serif');
    const detail = cols.filter((c) => r.c[c.key] && r.c[c.key] !== '/' && c.key !== 'notes').map((c) => `${c.label}: ${r.c[c.key]}`).join('   ·   ');
    const detailLines = wrap(detail, W - 2 * pad - 40, '400 26px Inter, sans-serif');
    const noteLines = r.c.notes ? wrap(r.c.notes, W - 2 * pad - 40, 'italic 400 23px Inter, sans-serif') : [];
    const h = 30 + nameLines.length * 42 + detailLines.length * 34 + noteLines.length * 30 + 20;
    ctx.fillStyle = '#181818'; ctx.beginPath(); ctx.roundRect(pad, y, W - 2 * pad, h, 18); ctx.fill();
    let yy = y + 50;
    ctx.fillStyle = '#ffffff'; ctx.font = '700 32px Inter, sans-serif'; for (const l of nameLines) { ctx.fillText(l, pad + 20, yy); yy += 42; }
    ctx.fillStyle = '#d0d0d0'; ctx.font = '400 26px Inter, sans-serif'; for (const l of detailLines) { ctx.fillText(l, pad + 20, yy); yy += 34; }
    ctx.fillStyle = '#9a9a9a'; ctx.font = 'italic 400 23px Inter, sans-serif'; for (const l of noteLines) { ctx.fillText(l, pad + 20, yy); yy += 30; }
    y += h + 14;
  }
  ctx.fillStyle = '#6a6a6a'; ctx.font = '600 22px Inter, sans-serif'; ctx.fillText('brunozgela.com', pad, y + 30);
  const out = el('canvas', { width: W, height: y + 60 });
  out.getContext('2d').drawImage(canvas, 0, 0);
  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  const name = `${week.week_start}-${(day.title || 'day').replace(/\W+/g, '-').toLowerCase()}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: day.title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
}

/* ---------- Progress: weight, measurements, weekly check-in, photos ---------- */

function renderProgress() {
  const weeks = Calc.weeks(S.daily);
  const todayRow = S.daily.find((d) => d.day === today());
  const dateIn = el('input', { class: 'field', type: 'date', value: today(), max: today() });
  const weightIn = el('input', { class: 'field', inputMode: 'decimal', placeholder: '', value: todayRow?.weight ?? '' });
  const msg = el('p', { class: 'msg' });
  dateIn.addEventListener('change', () => { weightIn.value = S.daily.find((d) => d.day === dateIn.value)?.weight ?? ''; });
  const saveWeight = el('button', { class: 'btn primary', disabled: S.readOnly }, 'Save');
  saveWeight.addEventListener('click', async () => {
    const w = num(weightIn.value);
    if (!w || w < 30 || w > 300) { msg.className = 'msg err'; msg.textContent = 'Please enter your weight in kg, for example 78.4'; return; }
    await upsertDaily(dateIn.value, { weight: w });
    renderProgress();
  });

  const points = S.daily.filter((d) => num(d.weight)).map((d) => ({ x: parseDay(d.day).getTime(), y: num(d.weight) }));
  const avg = weeks.filter((w) => w.avgWeight).map((w) => ({ x: parseDay(addDays(w.week, 3)).getTime(), y: w.avgWeight }));
  // Whether a weekly change is going the athlete's way (cut: down, gain: up, maintain: about level)
  const goal = S.profile?.goal || 'maintain';
  const mood = (change) => change === null ? 'neutral'
    : goal === 'cut' ? (change < 0 ? 'good' : change > 0.1 ? 'bad' : 'neutral')
    : goal === 'gain' ? (change > 0 ? 'good' : change < -0.1 ? 'bad' : 'neutral')
    : (Math.abs(change) <= 0.3 ? 'good' : 'neutral');
  const signed = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x), d);
  const withWeight = weeks.filter((w) => w.avgWeight);
  const latest = withWeight[withWeight.length - 1];
  const weekRows = withWeight.slice().reverse().map((w) => el('div', { class: 'wk-row' },
    el('div', { class: 'grow' }, el('b', {}, weekRange(w.week)), el('div', { class: 'tiny ' + (w.weights.length < 4 ? 'accent-warn' : 'muted') }, `${w.weights.length} weigh-in${w.weights.length === 1 ? '' : 's'}`)),
    el('div', { style: 'text-align:right' }, el('b', {}, `${fmt(w.avgWeight, 2)} kg`),
      el('div', { class: 'row nowrap', style: 'gap:4px;justify-content:flex-end;margin-top:3px' },
        w.change !== null ? changeChip(`${signed(w.change)} kg`, mood(w.change)) : null,
        w.balance !== null ? el('span', { class: 'tiny muted' }, `${signed(w.balance, 0)} kcal/day`) : null))));

  show(el('div', { class: 'stack' },
    el('h1', {}, 'Progress'),
    el('div', { class: 'card stack', 'data-tour': 'weigh' },
      cardHead('scale', 'Morning weigh-in'),
      latest ? el('div', { class: 'hero-stat' },
        el('div', {}, el('div', { class: 'mlabel', style: 'color:var(--text-muted)' }, 'Weekly average'), el('div', { class: 'hero-num' }, fmt(latest.avgWeight, 1), el('span', {}, ' kg'))),
        el('div', { style: 'text-align:right' },
          latest.change !== null ? changeChip(`${signed(latest.change)} kg this week`, mood(latest.change)) : el('span', { class: 'tiny muted' }, 'Change shows after two weeks'),
          latest.balance !== null ? el('div', { class: 'tiny muted', style: 'margin-top:4px' }, `≈ ${signed(latest.balance, 0)} kcal a day`) : null)) : null,
      el('p', { class: 'small soft' }, 'Every morning, after the bathroom, before eating or drinking anything.'),
      el('label', { class: 'lab' }, 'Date', dateIn),
      valueRow('Weight', weightIn, 'kg', 'kcal'),
      saveWeight, msg),
    el('div', { class: 'card stack' },
      cardHead('chart', 'Weekly average'),
      lineChart(points, { avg, unit: 'kg' }),
      el('p', { class: 'tiny muted' }, 'Grey: daily weigh-ins. Teal: weekly average. Daily numbers jump with water and food; the weekly average is what counts.'),
      weekRows.length ? el('div', { class: 'wk-list' }, ...weekRows) : null,
      el('p', { class: 'tiny muted' }, 'Estimated balance: change in weekly average × 7,700 kcal per kg ÷ 7 days. Negative means a deficit. It is a rough guide that settles after 2–3 weeks; aim for at least 4 weigh-ins a week.')),
    measurementsCard(),
    checkinCard(),
    photosCard(),
    guideCard('weigh_in')));
}

async function upsertDaily(day, values) {
  const row = { client_id: S.client.user_id, day, ...values };
  await saveRow('coaching_daily', row);
  const at = S.daily.findIndex((d) => d.day === day);
  if (at >= 0) S.daily[at] = { ...S.daily[at], ...row }; else { S.daily.push(row); S.daily.sort((a, b) => (a.day > b.day ? 1 : -1)); }
}

const MEASURES = [
  ['chest', 'Chest (under the nipples)'], ['waist_narrow', 'Narrowest waist'], ['waist_navel', 'Waist (below the navel)'],
  ['hips', 'Hips'], ['biceps', 'Biceps'], ['thigh', 'Thigh']
];

function measurementsCard() {
  const last = S.measurements[S.measurements.length - 1];
  const first = S.measurements[0];
  const dateIn = el('input', { class: 'field', type: 'date', value: today(), max: today() });
  const inputs = Object.fromEntries(MEASURES.map(([k]) => [k, el('input', { class: 'field', inputMode: 'decimal', placeholder: last?.[k] ? String(last[k]) : '' })]));
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary', disabled: S.readOnly }, 'Save measurements');
  save.addEventListener('click', async () => {
    const row = { client_id: S.client.user_id, day: dateIn.value };
    let any = false;
    for (const [k] of MEASURES) { const v = num(inputs[k].value); if (v !== null) { row[k] = v; any = true; } }
    if (!any) { msg.className = 'msg err'; msg.textContent = 'Enter at least one measurement in cm.'; return; }
    await saveRow('coaching_measurements', row);
    const at = S.measurements.findIndex((m) => m.day === row.day);
    if (at >= 0) S.measurements[at] = { ...S.measurements[at], ...row }; else S.measurements.push(row);
    S.measurements.sort((a, b) => (a.day > b.day ? 1 : -1));
    renderProgress();
  });
  const summary = S.measurements.length ? el('div', { class: 'wk-list' }, ...MEASURES.map(([k, l]) => {
    const now = [...S.measurements].reverse().find((m) => num(m[k]) !== null);
    const start = S.measurements.find((m) => num(m[k]) !== null);
    const d = now && start && now !== start ? num(now[k]) - num(start[k]) : null;
    return el('div', { class: 'wk-row' }, el('div', { class: 'grow' }, el('b', {}, l.replace(/ \(.*\)/, '')), el('div', { class: 'tiny muted' }, l.match(/\((.*)\)/)?.[1] || '')),
      el('b', {}, now ? `${fmt(num(now[k]))} cm` : '–'),
      d !== null ? changeChip(`${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmt(Math.abs(d))}`, 'neutral') : null);
  })) : el('p', { class: 'small muted' }, 'No measurements yet.');
  const history = S.measurements.length > 1 ? el('details', { class: 'fold' }, el('summary', {}, `All entries (${S.measurements.length})`),
    el('div', { class: 'table-wrap', style: 'margin-top:8px' }, el('table', { class: 'data' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Date'), ...MEASURES.map(([, l]) => el('th', {}, l.replace(/ \(.*\)/, ''))))),
      el('tbody', {}, ...S.measurements.slice().reverse().map((m) => el('tr', {}, el('td', {}, niceDate(m.day)), ...MEASURES.map(([k]) => el('td', {}, m[k] ?? '–')))))))) : null;
  return el('details', { class: 'card', open: !S.measurements.length },
    el('summary', { class: 'card-sum' }, cardHead('ruler', 'Body measurements', last ? el('span', { class: 'tiny muted' }, niceDate(last.day)) : null)),
    el('div', { class: 'stack', style: 'margin-top:12px' },
      summary,
      S.measurements.length > 1 ? el('p', { class: 'tiny muted' }, 'Change since your first measurement.') : null,
      el('h3', { style: 'margin-top:6px' }, 'New measurement'),
      el('p', { class: 'small soft' }, 'At the end of each week, in the morning, under the same conditions. Tape snug but not tight, in cm.'),
      el('label', { class: 'lab' }, 'Date', dateIn),
      el('div', { class: 'stack', style: 'gap:6px' }, ...MEASURES.map(([k, l]) => valueRow(l.replace(/ \(.*\)/, ''), inputs[k], 'cm', 'kcal', l.match(/\((.*)\)/)?.[1] || ''))),
      save, msg, history));
}

const RATINGS = [
  ['training', 'Training adherence'], ['nutrition', 'Nutrition adherence'], ['stress', 'Stress level'],
  ['sleep', 'Sleep'], ['satisfaction', 'Personal satisfaction'], ['motivation', 'Motivation']
];

function checkinCard() {
  const thisWeek = mondayOf();
  const weekSel = el('select', { class: 'select field' }, ...[0, -7, -14, -21].map((d) => {
    const w = addDays(thisWeek, d);
    return el('option', { value: w }, (d === 0 ? 'This week · ' : '') + weekRange(w));
  }));
  const body = el('div', { class: 'stack' });
  function draw() {
    const week = weekSel.value;
    const saved = S.checkins.find((c) => c.week_start === week);
    const c = saved ? clone(saved) : { client_id: S.client.user_id, week_start: week, ratings: {}, activities: [] };
    const stepWeek = Calc.weeks(S.daily).find((w) => w.week === week);
    const msg = el('p', { class: 'msg' });
    const save = debounce(async () => {
      await saveRow('coaching_checkins', c);
      const at = S.checkins.findIndex((x) => x.week_start === week);
      if (at >= 0) S.checkins[at] = clone(c); else S.checkins.push(clone(c));
      msg.className = 'msg ok'; msg.textContent = navigator.onLine ? 'Saved. Bruno can see it now.' : 'Saved on this phone. It is sent when you are online.';
    }, 700);
    const rate = ([k, label]) => {
      const box = el('div', { class: 'rating' }, ...[1, 2, 3, 4, 5].map((v) => {
        const b = el('button', { type: 'button', class: c.ratings[k] === v ? 'active' : '', disabled: S.readOnly }, String(v));
        b.addEventListener('click', () => { c.ratings[k] = v; box.querySelectorAll('button').forEach((x, i) => x.classList.toggle('active', i === v - 1)); save(); });
        return b;
      }));
      return el('div', { class: 'rate-row' }, el('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px' }, label), box);
    };
    const text = (key, label, placeholder) => {
      const t = el('textarea', { class: 'field', placeholder, value: c[key] || '', disabled: S.readOnly });
      t.addEventListener('input', () => { c[key] = t.value; save(); });
      return el('label', { class: 'lab' }, label, t);
    };
    const kcal = el('input', { class: 'field', inputMode: 'numeric', placeholder: 'optional', value: c.avg_kcal ?? '', disabled: S.readOnly });
    kcal.addEventListener('input', () => { c.avg_kcal = num(kcal.value) === null ? null : Math.round(num(kcal.value)); save(); });

    const acts = el('div', { class: 'stack' });
    const drawActs = () => acts.replaceChildren(...c.activities.map((a, i) => {
      const f = (key, ph) => { const inp = el('input', { class: 'field', placeholder: ph, value: a[key] || '', disabled: S.readOnly }); inp.addEventListener('input', () => { a[key] = inp.value; save(); }); return inp; };
      return el('div', { class: 'row nowrap' }, el('div', { class: 'grow' }, f('activity', 'Activity, e.g. football')),
        el('div', { style: 'width:28%' }, f('duration', 'Duration')), el('div', { style: 'width:24%' }, f('intensity', 'Intensity')),
        S.readOnly ? null : el('button', { class: 'btn ghost icon-btn', 'aria-label': 'Remove', onclick: () => { c.activities.splice(i, 1); drawActs(); save(); } }, icon('x', 18)));
    }));
    drawActs();

    body.replaceChildren(
      el('p', { class: 'small soft' }, 'Rate the week honestly (1 = poor, 5 = great; for stress, 5 = a lot of stress). It helps Bruno plan your next week.'),
      ...RATINGS.map(rate),
      text('impression', 'How was your week?', 'Hunger, appetite, soreness, stress, sleep, how well you kept to calories, macros and water, which workouts you missed or found hard…'),
      el('label', { class: 'lab' }, 'Average calories this week', kcal),
      stepWeek?.avgSteps ? el('p', { class: 'small soft' }, `Average steps: ${fmt(stepWeek.avgSteps, 0)} a day (from your daily entries)`) : null,
      el('div', {}, el('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px' }, 'Additional activities'), acts,
        S.readOnly ? null : el('button', { class: 'add-day', type: 'button', style: 'margin-top:6px;padding:9px', onclick: () => { c.activities.push({ activity: '', duration: '', intensity: '' }); drawActs(); } }, '+ Add activity')),
      text('questions', 'Questions for Bruno', 'For example eating out next week and not sure what to choose. For anything urgent, message Bruno on WhatsApp.'),
      text('feedback', 'Feedback for Bruno', 'Anything he could do better (optional)'),
      msg);
  }
  weekSel.addEventListener('change', draw);
  draw();
  const due = !S.checkins.find((c) => c.week_start === thisWeek) && new Date().getDay() % 6 === 0;
  return el('details', { class: 'card', 'data-tour': 'checkin', open: due },
    el('summary', { class: 'card-sum' }, cardHead('clipboard', 'Weekly check-in',
      due ? el('span', { class: 'pill warn' }, 'Due') : S.checkins.find((c) => c.week_start === thisWeek) ? el('span', { class: 'status-badge done' }, icon('check', 14)) : null)),
    el('div', { class: 'stack', style: 'margin-top:12px' }, el('label', { class: 'lab' }, 'Week', weekSel), body));
}

function photosCard() {
  const grid = el('div', {}, el('p', { class: 'small muted' }, 'Loading photos…'));
  const folder = S.client.user_id;
  const refresh = async () => {
    try {
      const paths = await Photos.list(folder);
      grid.replaceChildren(paths.length ? photoGrid(paths, { onDelete: S.readOnly ? null : async (p) => { if (confirm('Delete this photo?')) { await Photos.remove(p); refresh(); } } })
        : el('p', { class: 'small muted' }, 'No photos yet.'));
    } catch (e) { grid.replaceChildren(el('p', { class: 'small muted' }, navigator.onLine ? 'Photos could not be loaded.' : 'Photos load when you are online.')); }
  };
  refresh();
  const pose = el('select', { class: 'select field' }, ...['front', 'side', 'back'].map((p) => el('option', { value: p }, p[0].toUpperCase() + p.slice(1))));
  const file = el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
  const msg = el('p', { class: 'msg' });
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    msg.className = 'msg'; msg.textContent = 'Uploading…';
    try {
      const blob = await shrinkImage(file.files[0]);
      await Photos.upload(`${folder}/${today()}-${pose.value}-${uid()}.jpg`, blob);
      msg.className = 'msg ok'; msg.textContent = 'Uploaded. Only you and Bruno can see it.';
      refresh();
    } catch (e) { msg.className = 'msg err'; msg.textContent = navigator.onLine ? 'Upload failed: ' + e.message : 'Photos can only be uploaded online.'; }
    file.value = '';
  });
  return el('details', { class: 'card' },
    el('summary', { class: 'card-sum' }, cardHead('camera', 'Progress photos')),
    el('div', { class: 'stack', style: 'margin-top:12px' },
      el('p', { class: 'small soft' }, 'Every other weekend: front, side and back, in the same place, light and clothes. Private: only you and Bruno can see them.'),
      S.readOnly ? null : el('div', { class: 'row nowrap' }, el('div', { class: 'grow' }, pose),
        el('button', { class: 'btn primary', onclick: () => file.click() }, icon('camera', 18), 'Add photo')),
      file, msg, grid));
}

/* ---------- Nutrition ---------- */

function profileComplete(p) { return p && p.sex && p.birth_date && num(p.height_cm) && num(p.start_weight) && p.activity && p.goal; }

function profileForm(onSaved) {
  const p = S.profile;
  const sex = el('select', { class: 'select field' }, el('option', { value: '' }, 'Choose'), el('option', { value: 'male', selected: p.sex === 'male' }, 'Male'), el('option', { value: 'female', selected: p.sex === 'female' }, 'Female'));
  const birth = el('input', { class: 'field', type: 'date', value: p.birth_date || '', max: today() });
  const height = el('input', { class: 'field', inputMode: 'decimal', placeholder: 'cm', value: p.height_cm ?? '' });
  const weight = el('input', { class: 'field', inputMode: 'decimal', placeholder: 'kg', value: p.start_weight ?? '' });
  const activity = el('select', { class: 'select field' }, el('option', { value: '' }, 'Choose'),
    ...ACTIVITY_LEVELS.map((a) => el('option', { value: a.value, selected: Number(p.activity) === a.value }, a.label)));
  const goal = el('select', { class: 'select field' }, el('option', { value: '' }, 'Choose'),
    ...Object.entries(GOALS).map(([k, l]) => el('option', { value: k, selected: p.goal === k }, l)));
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary', disabled: S.readOnly }, 'Save my details');
  save.addEventListener('click', async () => {
    const row = { user_id: S.client.user_id, sex: sex.value || null, birth_date: birth.value || null, height_cm: num(height.value), start_weight: num(weight.value),
      activity: num(activity.value), goal: goal.value || null };
    if (!profileComplete(row)) { msg.className = 'msg err'; msg.textContent = 'Please fill in every field.'; return; }
    if (row.height_cm < 100 || row.height_cm > 250 || row.start_weight < 30 || row.start_weight > 300) { msg.className = 'msg err'; msg.textContent = 'Please check height (cm) and weight (kg).'; return; }
    const ageMsg = Calc.ageProblem(row.birth_date);
    if (ageMsg) { msg.className = 'msg err'; msg.textContent = ageMsg; return; }
    await saveRow('coaching_profiles', row);
    S.profile = { ...S.profile, ...row };
    if (!S.daily.some((d) => num(d.weight))) await upsertDaily(today(), { weight: row.start_weight });
    onSaved();
  });
  return el('div', { class: 'stack' },
    el('div', { class: 'form-grid' },
      el('label', { class: 'lab' }, 'Sex', sex), el('label', { class: 'lab' }, 'Date of birth', birth),
      el('label', { class: 'lab' }, 'Height (cm)', height), el('label', { class: 'lab' }, 'Weight today (kg)', weight)),
    el('label', { class: 'lab' }, 'Activity level', activity),
    el('label', { class: 'lab' }, 'Goal', goal),
    save, msg);
}

function renderNutrition() {
  const p = S.profile;
  if (!profileComplete(p)) {
    return show(el('div', { class: 'stack' }, el('h1', {}, 'Nutrition'),
      el('div', { class: 'card stack' }, el('h2', {}, 'Your starting details'),
        el('p', { class: 'small soft' }, 'Used to estimate your daily energy needs (TDEE) and your calorie and macro targets.'),
        profileForm(renderNutrition))));
  }
  const weight = Calc.latestWeight(S.daily, p);
  const est = Calc.targets(p, weight);
  if (!est) {
    // Saved details that can't give an estimate (e.g. a birth date in this year): ask to fix them instead of failing
    return show(el('div', { class: 'stack' }, el('h1', {}, 'Nutrition'),
      el('div', { class: 'card stack' }, el('h2', {}, 'Please check your details'),
        el('p', { class: 'small soft' }, Calc.ageProblem(p.birth_date) || 'Something in your starting details looks unusual, so your calorie needs can\'t be calculated yet.'),
        profileForm(renderNutrition))));
  }
  const t = S.targets;
  const byBruno = t && t.kcal;
  const kcal = byBruno ? t.kcal : est.kcal;
  const macros = byBruno ? { protein: t.protein, fat: t.fat, carbs: t.carbs } : est;

  const targetsCard = el('div', { class: 'card stack', 'data-tour': 'targets' },
    el('div', { class: 'row between' }, el('h2', {}, 'Daily targets'), el('span', { class: 'pill ' + (byBruno ? 'teal' : '') }, byBruno ? 'Set by Bruno' : 'Estimate')),
    targetSummary({ kcal, protein: macros.protein, carbs: macros.carbs, fat: macros.fat }),
    el('p', { class: 'tiny muted', style: 'text-align:center' }, 'Calories ± 100 kcal a day'),
    byBruno && t.note ? el('p', { class: 'small soft pre' }, t.note) : null,
    el('p', { class: 'small soft' }, 'Not every day will be perfect: aim to stay close to these numbers on most days. Food labels and apps vary, so check your own products.'),
    el('details', {}, el('summary', { class: 'small', style: 'cursor:pointer;color:var(--accent-soft)' }, 'How this is calculated'),
      el('div', { class: 'small soft stack', style: 'margin-top:8px' },
        el('p', {}, `Resting energy (Mifflin-St Jeor equation): ${fmt(est.bmr, 0)} kcal, using ${fmt(weight)} kg (your latest weekly average), ${fmt(num(p.height_cm), 0)} cm and age ${est.age}.`),
        el('p', {}, `Maintenance (TDEE) = resting energy × activity factor ${p.activity} = ${fmt(est.tdee, 0)} kcal.`),
        el('p', {}, `Goal "${GOALS[p.goal]}": ${p.goal === 'cut' ? 'about 20% below maintenance' : p.goal === 'gain' ? 'about 10% above maintenance' : 'maintenance'} = ${fmt(est.kcal, 0)} kcal.`),
        el('p', {}, `Protein ${p.goal === 'cut' ? '2.0' : '1.8'} g per kg (research range for people who train: 1.6–2.2 g/kg), fat about 25% of calories, carbohydrates the rest.`),
        el('p', {}, 'Equations are estimates for an average person. Your weekly weight trend in Progress shows what really happens, and Bruno adjusts from there.'),
        byBruno ? el('p', {}, `Bruno set your targets himself, so they replace the estimate.`) : null)),
    S.readOnly ? null : el('button', { class: 'btn small', onclick: () => { const m = modal('My details', profileForm(() => { m.close(); renderNutrition(); })); } }, 'Edit my details'));

  // Water tracker: today's drinks with -/+ 250 ml, against Bruno's target or the estimate
  const waterGoal = Calc.waterTarget(p, S.targets?.water_ml);
  const waterHost = el('div');
  const waterMsg = el('p', { class: 'msg', style: 'text-align:center' });
  const drawWater = () => {
    const ml = num(S.daily.find((d) => d.day === today())?.water_ml) || 0;
    waterHost.replaceChildren(waterTracker(ml, waterGoal.ml, S.readOnly ? null : async (next) => {
      const prev = ml;
      const at = S.daily.findIndex((d) => d.day === today());
      if (at >= 0) S.daily[at] = { ...S.daily[at], water_ml: next }; else S.daily.push({ client_id: S.client.user_id, day: today(), water_ml: next });
      drawWater();
      try { await saveRow('coaching_daily', { client_id: S.client.user_id, day: today(), water_ml: next }); waterMsg.textContent = ''; }
      catch (e) {
        const back = S.daily.findIndex((d) => d.day === today());
        if (back >= 0) S.daily[back].water_ml = prev;
        drawWater();
        waterMsg.className = 'msg err';
        waterMsg.textContent = /water_ml/.test(e.message) ? 'Water tracking is being set up. Please try again later.' : 'Not saved: ' + e.message;
      }
    }));
  };
  drawWater();
  const waterCard = el('div', { class: 'card stack' },
    el('div', { class: 'row between' }, el('h2', {}, 'Water'), el('span', { class: 'small muted' }, 'Today')),
    waterHost, waterMsg,
    el('details', {}, el('summary', { class: 'small', style: 'cursor:pointer;color:var(--accent-soft)' }, 'About your water target'),
      el('p', { class: 'small soft', style: 'margin-top:8px' }, waterGoal.byCoach
        ? 'Bruno set this target for you. Add more when you sweat a lot: in training, in heat or on long walks.'
        : `Your target is the European Food Safety Authority's adequate intake from drinks (${p.sex === 'female' ? '1.6' : '2.0'} L a day for ${p.sex === 'female' ? 'women' : 'men'})${waterGoal.extra ? ', plus 0.5 L because you train on most days' : ''}. Food gives you roughly another 20%. On training days add about 0.5–1 L per hour of training, more in heat. Pale yellow urine is a good sign.`)));

  let mealsSection;
  if (isPro()) {
    const plans = S.meals?.plans || [];
    const hasFood = isLegacyMealPlan(plans) || plans.some((d) => d.meals?.some((m) => m.items.length));
    mealsSection = hasFood ? mealPlansCard(plans, S.meals.note, { kcal, protein: macros.protein, carbs: macros.carbs, fat: macros.fat }) : el('div', { class: 'card' }, el('h2', {}, 'Meal plan'), el('p', { class: 'soft', style: 'margin-top:8px' }, 'Bruno is preparing your meal plan. It appears here when ready.'));
  } else {
    mealsSection = el('div', { class: 'card lock' }, icon('lock'), el('h2', { style: 'margin-top:8px' }, 'Personal meal plans'),
      el('p', { class: 'soft', style: 'margin-top:8px' }, 'Coaching PRO includes a personal meal plan built around your calories and macros, plus food lists and supplement advice.'),
      el('a', { class: 'btn', style: 'margin-top:14px', href: 'pro.html' }, 'About Coaching PRO'));
  }

  show(el('div', { class: 'stack' }, el('h1', {}, 'Nutrition'), targetsCard, mealsSection, isPro() ? homeFoodsCard() : null, waterCard,
    guideCard('nutrition_basics'), isPro() ? guideCard('food_lists') : null, isPro() ? guideCard('supplements') : null));
  if (isPro()) refreshMealPlan('nutrition');
}

/* ---------- Foods the athlete has at home (PRO): scanned or typed in, so Bruno can use them in the meal plan ---------- */

function athleteFoodStore() {
  return {
    prefix: 'ath',
    foods: () => S.athleteFoods.map((r) => ({ id: r.id, name: r.name, ...r.per100 })),
    found: 'You already added this food',
    intro: 'Type the values from the nutrition label. Bruno sees the foods you add and can use them in your meal plan.',
    async save(row) {
      const full = { client_id: S.client.user_id, ...row };
      await saveRow('coaching_athlete_foods', full);
      S.athleteFoods = [...S.athleteFoods.filter((f) => f.id !== row.id), full].sort((a, b) => a.name.localeCompare(b.name));
      return { id: row.id, name: row.name, justSaved: true };
    }
  };
}

function homeFoodsCard() {
  const store = athleteFoodStore();
  const list = el('div', { class: 'stack', style: 'gap:0' });
  const msg = el('p', { class: 'msg' });
  const drawList = () => {
    list.replaceChildren(...(S.athleteFoods.length ? S.athleteFoods.map((f) => {
      const per = { kcal: f.per100?.kcal || 0, p: f.per100?.p || 0, c: f.per100?.c || 0, f: f.per100?.f || 0 };
      return el('div', { class: 'home-food' },
        el('div', { class: 'grow' }, el('div', { class: 'fname' }, f.name),
          el('div', { class: 'tiny muted' }, `${fmt(per.kcal, 0)} kcal per 100 g`), coloredMacros(per)),
        S.readOnly ? null : el('button', { class: 'btn small ghost danger', type: 'button', onclick: async () => {
          if (!confirm(`Remove ${f.name}?`)) return;
          try { await Data.remove('coaching_athlete_foods', { client_id: S.client.user_id, id: f.id }); S.athleteFoods = S.athleteFoods.filter((x) => x.id !== f.id); drawList(); }
          catch (e) { msg.className = 'msg err'; msg.textContent = navigator.onLine ? 'Not removed: ' + e.message : 'Removing works only online.'; }
        } }, 'Remove'));
    }) : [el('p', { class: 'small muted' }, 'Nothing added yet.')]));
  };
  drawList();
  const added = (food) => { drawList(); if (food?.justSaved) toast(`Added ${food.name}. Bruno can use it in your plan now.`); };
  const count = S.athleteFoods.length;
  return el('details', { class: 'card', 'data-tour': 'home-foods' },
    el('summary', { style: 'cursor:pointer' },
      el('b', {}, 'Foods you have at home'), count ? el('span', { class: 'pill', style: 'margin-left:8px' }, String(count)) : null,
      el('div', { class: 'small muted', style: 'margin-top:2px;font-weight:400' }, 'Local brands Bruno can use in your meal plan')),
    el('div', { class: 'stack', style: 'margin-top:12px' },
      el('p', { class: 'small soft' }, 'Have a product that isn\'t in the plan, like a local yogurt or protein bar? Scan its barcode or type the values from the label. Bruno sees it straight away when he updates your meal plan.'),
      S.readOnly ? null : el('div', { class: 'row' },
        el('button', { class: 'btn small primary', type: 'button', onclick: () => scanBarcode(added, store) }, barcodeIcon(), 'Scan a barcode'),
        el('button', { class: 'btn small', type: 'button', onclick: () => ownFoodDialog(added, {}, store) }, '+ Enter from label')),
      msg, list));
}

const MEAL_COLUMNS = [
  { key: 'meal', label: 'Meal', width: 120 }, { key: 'foods', label: 'Foods', width: 320 },
  { key: 'kcal', label: 'kcal', width: 70 }, { key: 'protein', label: 'Protein', width: 70 }, { key: 'fat', label: 'Fat', width: 60 }, { key: 'carbs', label: 'Carbs', width: 60 }
];

function mealPlansCard(plans, note, dayTarget) {
  return isLegacyMealPlan(plans) ? legacyMealPlansCard(plans, note) : mealDaysCard(plans, note, dayTarget);
}

// Days of 3 to 5 meals (snacks optional per athlete) with foods and grams, totals per meal and per day
// The athlete's version of a meal: their swap if Bruno has not changed that meal since, otherwise Bruno's meal.
// Swaps are saved by the meal's id, so adding or removing snacks never moves them to another meal (older ones by position).
function effectiveMeal(day, mi) {
  const original = day.meals[mi];
  const choice = S.choices?.[day.id]?.[original.id] ?? S.choices?.[day.id]?.[mi];
  if (choice && choice.basedOn === mealSignature(original)) return { ...original, items: choice.items, choice };
  return original;
}

async function saveChoices() {
  await saveRow('coaching_meal_choices', { client_id: S.client.user_id, choices: S.choices });
}

function mealDaysCard(days, note, dayTarget) {
  let active = 0;
  const block = blockFor(S.client);
  const split = mealSplit(S.meals);
  const seg = el('div', { class: 'seg' });
  const body = el('div', { class: 'stack', style: 'margin-top:12px' });
  const line = (t) => `${fmt(t.kcal, 0)} kcal · P ${fmt(t.p, 0)} g · C ${fmt(t.c, 0)} g · F ${fmt(t.f, 0)} g`;
  const canSwap = !S.readOnly;

  function setChoice(day, mi, choice) {
    S.choices = { ...S.choices, [day.id]: { ...(S.choices[day.id] || {}) } };
    const key = day.meals[mi].id;
    delete S.choices[day.id][mi]; // older swaps were saved by position
    if (choice) S.choices[day.id][key] = choice; else delete S.choices[day.id][key];
    saveChoices().catch((e) => alert('Not saved: ' + e.message));
    draw();
  }

  function swapMealDialog(day, mi) {
    const current = effectiveMeal(day, mi);
    const target = mealTargetFor(dayTarget, split[mi]);
    const ref = swapReference(current.items, target);
    const count = day.meals.length;
    const kind = mealKind(day.meals[mi], mi, count);
    const options = days.map((d, i) => ({ d, i, meal: d.meals[mi] }))
      .filter((o) => o.d.id !== day.id && o.meal?.items.length && mealKind(o.meal, mi, o.d.meals.length) === kind && mealSignature(o.meal) !== mealSignature(current))
      .filter((o) => mealFit(mealTotals(o.meal.items), ref).ok && mealAllowed(o.meal, block));
    const m = modal(`Swap ${current.name.toLowerCase()}`,
      el('p', { class: 'small soft' }, `These ${current.name.toLowerCase()}s from your other plans have about the same calories and macros, so your day stays on target.`),
      ...(options.length ? options.map((o) => el('button', { class: 'card card-link tight', type: 'button', onclick: () => {
        m.close();
        setChoice(day, mi, { basedOn: mealSignature(day.meals[mi]), from: `${o.meal.name} from ${o.d.title}`, items: clone(o.meal.items), swaps: [] });
      } }, el('div', { class: 'row between nowrap' }, el('b', {}, `${o.d.title}`), el('span', { class: 'pill' }, `${fmt(mealTotals(o.meal.items).kcal, 0)} kcal`)),
        el('p', { class: 'small soft', style: 'margin-top:4px' }, o.meal.items.map((it) => `${it.name} ${amountLabel(it)}`).join(' · '))))
        : [el('p', { class: 'muted' }, 'No other plan has a matching meal for this slot yet.')]));
  }

  function swapFoodDialog(day, mi, ii) {
    const current = effectiveMeal(day, mi);
    const target = mealTargetFor(dayTarget, split[mi]);
    const item = current.items[ii];
    const options = foodSwapOptions(current.items, ii, target, block);
    const m = modal(`Instead of ${item.name.toLowerCase()}`,
      el('p', { class: 'small soft' }, `${amountLabel(item)} now. Each option keeps this meal within its calorie and macro target; the amount is adjusted for you.`),
      ...(options.length ? options.map((o) => el('button', { class: 'card card-link tight', type: 'button', onclick: () => {
        m.close();
        const prev = current.choice;
        setChoice(day, mi, { basedOn: mealSignature(day.meals[mi]), from: prev?.from || null, items: o.items,
          swaps: [...(prev?.swaps || []), `${item.name} → ${o.food.name} ${o.label}`] });
      } }, el('div', { class: 'row between nowrap' }, el('b', {}, o.food.name), el('span', { class: 'g' }, o.label)),
        el('p', { class: 'tiny muted', style: 'margin-top:4px' }, `Meal becomes ${line(o.totals)}`)))
        : [el('p', { class: 'muted' }, 'No equal swap for this food keeps the meal on target.')]));
  }

  function draw() {
    seg.replaceChildren(...days.map((d, i) => el('button', { type: 'button', class: i === active ? 'active' : '', onclick: () => { active = i; draw(); } }, d.title || `Plan ${i + 1}`)));
    const day = days[active];
    const meals = day.meals.map((_, mi) => effectiveMeal(day, mi));
    const total = mealTotals(meals.flatMap((m) => m.items));
    // Same look as Bruno's editor: the plan's calorie ring, then one numbered card per meal.
    // Tapping a food opens its swap options; each meal keeps its "Swap" and "Back to Bruno's meal" buttons.
    body.replaceChildren(
      el('div', { class: 'card tight' }, macroSummary(total, dayTarget ? { kcal: dayTarget.kcal, protein: dayTarget.protein, carbs: dayTarget.carbs, fat: dayTarget.fat } : null)),
      ...meals.map((m, mi) => {
        if (!m.items.length) return null;
        const t = mealTotals(m.items);
        const target = mealTargetFor(dayTarget, split[mi]);
        return el('div', { class: 'card meal-card' },
          el('div', { class: 'meal-head' },
            el('span', { class: 'meal-num' }, String(mi + 1).padStart(2, '0')),
            mealIcon(mealKind(m, mi, meals.length)), el('h3', {}, m.name),
            el('div', { class: 'meal-stats' }, el('span', { class: 'meal-kcal' }, `${fmt(t.kcal, 0)} kcal`), macroDonut(t, 30))),
          m.choice ? el('div', { class: 'row small', style: 'margin:-4px 0 6px' }, el('span', { class: 'pill teal' }, 'Your swap'),
            m.choice.from ? el('span', { class: 'muted' }, `Using ${m.choice.from}`) : null) : null,
          el('ul', { class: 'meal-items' }, ...m.items.map((it, ii) => {
            const ft = mealTotals([it]);
            return el('li', { class: 'food-row' + (canSwap ? '' : ' static'), role: canSwap ? 'button' : null, tabindex: canSwap ? 0 : null,
              title: canSwap ? 'Tap to swap this food' : null,
              onclick: canSwap ? () => swapFoodDialog(day, mi, ii) : null,
              onkeydown: canSwap ? (e) => { if (e.key === 'Enter') swapFoodDialog(day, mi, ii); } : null },
              el('span', { class: 'gram-chip' + (it.pc ? ' pieces' : '') }, amountLabel(it)),
              el('div', { class: 'info' }, el('div', { class: 'fname' }, it.name, canSwap ? el('span', { class: 'swap-icon', 'aria-hidden': 'true' }, ' ⇄') : null), macroMiniBar(ft)),
              el('div', { class: 'fkcal' }, fmt(ft.kcal, 0)));
          })),
          m.note && !m.choice ? el('p', { class: 'small soft pre', style: 'margin-top:8px' }, m.note) : null,
          macroCounters(t, target),
          canSwap ? el('div', { class: 'row', style: 'margin-top:10px' },
            el('button', { class: 'btn small', type: 'button', onclick: () => swapMealDialog(day, mi) }, `⇄ Swap ${m.name.toLowerCase()}`),
            m.choice ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => setChoice(day, mi, null) }, 'Back to Bruno\'s meal') : null) : null);
      }),
      day.note ? el('p', { class: 'small soft pre' }, day.note) : null,
      el('p', { class: 'tiny muted' }, `Total for the day: ${line(total)}. Weights are raw or dry, before cooking. ${canSwap ? 'Tap a food to swap it. ' : ''}Values: USDA FoodData Central.`));
  }
  draw();
  return el('div', { class: 'stack' },
    el('div', { class: 'row between' }, el('h2', {}, 'Meal plan'), el('span', { class: 'pill pro' }, 'PRO')),
    el('p', { class: 'small soft' }, note || 'Swap any meal for the same meal in another plan, or swap single foods: your calories and macros stay on target.'),
    block.any ? el('p', { class: 'tiny muted' }, `Swaps never include: ${[...block.allergens.map(allergenLabel), ...block.avoid].join(', ')}.`) : null,
    seg, body);
}

function legacyMealPlansCard(plans, note) {
  let active = 0;
  const seg = el('div', { class: 'seg' });
  const body = el('div', { class: 'stack', style: 'margin-top:12px' });
  function draw() {
    seg.replaceChildren(...plans.map((pl, i) => el('button', { type: 'button', class: i === active ? 'active' : '', onclick: () => { active = i; draw(); } }, pl.title || `Plan ${i + 1}`)));
    const plan = plans[active];
    const rows = (plan.rows || []).filter((r) => r.c.meal || r.c.foods);
    const total = (k) => rows.reduce((s, r) => s + (num(r.c[k]) || 0), 0);
    body.replaceChildren(
      ...rows.map((r) => r.kind === 'section' ? el('div', { class: 'ex-section' }, r.c.meal || r.c.foods) : el('div', { class: 'card alt tight' },
        el('div', { class: 'row between nowrap' }, el('b', {}, r.c.meal || ''), r.c.kcal ? el('span', { class: 'pill' }, `${r.c.kcal} kcal`) : null),
        el('p', { class: 'soft pre', style: 'margin-top:4px' }, r.c.foods || ''),
        (r.c.protein || r.c.fat || r.c.carbs) ? el('p', { class: 'tiny muted', style: 'margin-top:4px' }, `P ${r.c.protein || 0} g · F ${r.c.fat || 0} g · C ${r.c.carbs || 0} g`) : null)),
      el('div', { class: 'row between small', style: 'font-weight:700' }, el('span', {}, 'Total'),
        el('span', {}, `${fmt(total('kcal'), 0)} kcal · P ${fmt(total('protein'), 0)} g · F ${fmt(total('fat'), 0)} g · C ${fmt(total('carbs'), 0)} g`)),
      plan.note ? el('p', { class: 'small soft pre' }, plan.note) : null);
  }
  draw();
  return el('div', { class: 'card' },
    el('div', { class: 'row between' }, el('h2', {}, 'Meal plans'), el('span', { class: 'pill pro' }, 'PRO')),
    el('p', { class: 'small soft', style: 'margin:6px 0 12px' }, note || 'The plans are interchangeable: pick the one that suits your day.'),
    seg, body);
}

/* ---------- Shopping list (PRO): every food of the meal plan, with the athlete's swaps, for the days they shop for ---------- */

// Bruno may have changed the plan since the app opened: fetch it again quietly and redraw if it differs
async function refreshMealPlan(view) {
  if (!navigator.onLine || !S.client) return;
  try {
    const rows = await Data.select('coaching_meal_plans', { client_id: S.client.user_id });
    const fresh = rows[0] || null;
    if (JSON.stringify(fresh) === JSON.stringify(S.meals)) return;
    S.meals = fresh;
    if (location.hash.slice(1).split('/')[0] === view) route();
  } catch (e) { /* keep what we have */ }
}

const SHOP_ORDER = ['veg', 'fruit', 'protein', 'dairy', 'carbs', 'legumes', 'fats', 'other'];
const SHOP_LABELS = { veg: 'Vegetables', fruit: 'Fruit', protein: 'Meat, fish and eggs', dairy: 'Dairy', carbs: 'Grains, bread and potatoes', legumes: 'Legumes', fats: 'Nuts, seeds and oils', other: 'Other' };
let LIBRARY_CATS = null;
function shopCategory(it) {
  if (it.cat && SHOP_LABELS[it.cat]) return it.cat;
  LIBRARY_CATS = LIBRARY_CATS || new Map(FOOD_LIBRARY.map((f) => [f.id, f.cat]));
  return LIBRARY_CATS.get(it.food) || S.athleteFoods.find((f) => f.id === it.food)?.cat || 'other';
}
// Amount to buy: whole pieces for countable foods (rounded up, e.g. "14 eggs"), otherwise grams or kilograms
const shopAmount = (g, pc) => {
  if (pc) { const n = Math.max(1, Math.ceil(g / pc.g - 0.01)); return `${n} ${n === 1 ? pc.one : pc.many}`; }
  return g >= 1000 ? `${fmt(Math.round(g / 100) / 10, 1)} kg` : `${g >= 50 ? Math.round(g / 5) * 5 : Math.round(g)} g`;
};

function shoppingPlans() {
  const plans = S.meals?.plans;
  if (!Array.isArray(plans) || isLegacyMealPlan(plans)) return [];
  return plans.filter((d) => d.meals?.some((m) => m.items.length));
}

// Days per plan: the athlete's own numbers, or a week spread evenly over the plans
function shoppingDays(plans) {
  const saved = S.choices?._shop?.days || {};
  const base = Math.floor(7 / plans.length), extra = 7 % plans.length;
  return Object.fromEntries(plans.map((d, i) => [d.id, Number.isFinite(saved[d.id]) ? saved[d.id] : base + (i < extra ? 1 : 0)]));
}

function shoppingLines(plans, days) {
  const lines = new Map();
  plans.forEach((day, pi) => {
    const times = days[day.id] || 0;
    if (!times) return;
    day.meals.forEach((_, mi) => {
      const meal = effectiveMeal(day, mi);
      for (const it of meal.items) {
        const g = num(it.g) || 0;
        if (!g) continue;
        const key = it.food || it.name.trim().toLowerCase();
        const line = lines.get(key) || { key, name: it.name, cat: shopCategory(it), g: 0, uses: new Set(), pc: it.pc || null };
        if (!it.pc || (line.pc && line.pc.g !== it.pc.g)) line.pc = null; // counted only when every use is in the same pieces
        line.g += g * times;
        line.uses.add(`${day.title || `Plan ${pi + 1}`} ${meal.name.toLowerCase()}`);
        lines.set(key, line);
      }
    });
  });
  return [...lines.values()];
}

function renderShopping() {
  if (!isPro()) { location.hash = 'nutrition'; return; }
  const plans = shoppingPlans();
  if (!plans.length) {
    show(el('div', { class: 'stack' }, el('h1', {}, 'Shopping list'),
      el('div', { class: 'card stack' }, cardHead('cart', 'Nothing to buy yet'),
        el('p', { class: 'soft' }, isLegacyMealPlan(S.meals?.plans || []) ? 'Your shopping list works with the new meal plans. It appears here as soon as Bruno moves your plan over.'
          : 'Bruno is preparing your meal plan. Your shopping list fills in by itself as soon as it is ready.'))));
    refreshMealPlan('shopping');
    return;
  }
  const shop = () => { S.choices = { ...S.choices, _shop: { days: {}, have: {}, ...(S.choices._shop || {}) } }; return S.choices._shop; };
  const save = debounce(() => saveChoices().catch((e) => toast(navigator.onLine ? 'Not saved: ' + e.message : 'Saved on this phone. It syncs when you are online.')), 600);

  const host = el('div', { class: 'stack' });
  let daysOpen = !S.choices?._shop?.days;
  function draw() {
    const days = shoppingDays(plans);
    const totalDays = Object.values(days).reduce((a, b) => a + b, 0);
    const have = S.choices?._shop?.have || {};
    const lines = shoppingLines(plans, days);
    // Ticked = bought with at least today's amount; if the plan now needs more, the tick comes off with a note
    const isTicked = (l) => have[l.key] !== undefined && have[l.key] >= Math.round(l.g) - 1;
    const done = lines.filter(isTicked).length;

    const tick = (l, on) => {
      const s = shop();
      s.have = { ...s.have };
      if (on) s.have[l.key] = Math.round(l.g); else delete s.have[l.key];
      save(); draw();
    };
    const setDays = (id, n) => { const s = shop(); s.days = { ...shoppingDays(plans), ...s.days, [id]: Math.max(0, Math.min(14, n)) }; save(); draw(); };

    const hero = el('div', { class: 'card week-hero' },
      el('div', { class: 'week-ring-row', style: 'margin-top:0;padding-top:0;border-top:0' },
        progressRing(done, lines.length, { size: 84, big: `${done}/${lines.length}`, small: 'ticked', color: lines.length && done === lines.length ? 'var(--good)' : 'var(--kcal)' }),
        el('div', { class: 'grow' },
          el('div', { style: 'font-weight:700;font-size:1.05rem' }, lines.length && done === lines.length ? 'You have everything!' : `${lines.length - done} item${lines.length - done === 1 ? '' : 's'} to get`),
          el('div', { class: 'small muted', style: 'margin-top:2px' }, `For ${totalDays} day${totalDays === 1 ? '' : 's'} of your meal plan`))));

    const daysCard = el('details', { class: 'card', open: daysOpen, ontoggle: (e) => { daysOpen = e.target.open; } },
      el('summary', { class: 'card-sum' }, cardHead('calendar', 'Days to shop for', el('span', { class: 'pill teal' }, `${totalDays} days`))),
      el('div', { class: 'stack', style: 'margin-top:12px;gap:8px' },
        el('p', { class: 'small soft' }, 'How many days you will eat each plan until your next shopping trip. The amounts below follow.'),
        ...plans.map((d, i) => el('div', { class: 'day-count' },
          numTag(i + 1), el('b', { class: 'grow' }, d.title || `Plan ${i + 1}`),
          el('button', { class: 'btn icon-btn', type: 'button', 'aria-label': `One day less of ${d.title || `Plan ${i + 1}`}`, disabled: S.readOnly || !days[d.id], onclick: () => setDays(d.id, days[d.id] - 1) }, '−'),
          el('span', { class: 'count' }, `${days[d.id]} day${days[d.id] === 1 ? '' : 's'}`),
          el('button', { class: 'btn icon-btn', type: 'button', 'aria-label': `One day more of ${d.title || `Plan ${i + 1}`}`, disabled: S.readOnly || days[d.id] >= 14, onclick: () => setDays(d.id, days[d.id] + 1) }, '+')))));

    const groups = SHOP_ORDER.map((cat) => [cat, lines.filter((l) => l.cat === cat)]).filter(([, ls]) => ls.length);
    const groupCards = groups.map(([cat, ls]) => {
      ls.sort((a, b) => (isTicked(a) - isTicked(b)) || a.name.localeCompare(b.name));
      const left = ls.filter((l) => !isTicked(l)).length;
      return el('div', { class: 'card shop-group' },
        el('div', { class: 'row between', style: 'margin-bottom:4px' }, el('h3', {}, SHOP_LABELS[cat]), el('span', { class: 'small muted' }, left ? `${left} to get` : 'All done')),
        ...ls.map((l) => {
          const on = isTicked(l);
          const more = !on && have[l.key] !== undefined;
          const box = el('input', { type: 'checkbox', checked: on, disabled: S.readOnly, 'aria-label': `${l.name}, ${shopAmount(l.g, l.pc)}` });
          box.addEventListener('change', () => tick(l, box.checked));
          return el('label', { class: 'shop-item' + (on ? ' done' : '') }, box, el('span', { class: 'shop-box', 'aria-hidden': 'true' }, icon('check', 14)),
            el('span', { class: 'grow', style: 'min-width:0' }, el('span', { class: 'sname' }, l.name),
              el('span', { class: 'tiny ' + (more ? 'accent-warn' : 'muted'), style: 'display:block' },
                more ? `Your plan changed: you ticked ${shopAmount(have[l.key], l.pc)}, now ${shopAmount(l.g, l.pc)}` : [...l.uses].join(', '))),
            el('span', { class: 'gram-chip' }, shopAmount(l.g, l.pc)));
        }));
    });

    const asText = () => groups.map(([cat, ls]) => `${SHOP_LABELS[cat]}\n` + ls.map((l) => `${isTicked(l) ? '[x]' : '[ ]'} ${l.name}: ${shopAmount(l.g, l.pc)}`).join('\n')).join('\n\n');
    host.replaceChildren(hero, daysCard,
      ...groupCards,
      el('div', { class: 'row' },
        S.readOnly || !done ? null : el('button', { class: 'btn', type: 'button', onclick: () => { if (confirm('Untick everything for a new shopping trip?')) { shop().have = {}; save(); draw(); } } }, 'New shopping trip'),
        el('button', { class: 'btn ghost', type: 'button', onclick: async () => {
          try { await navigator.clipboard.writeText(`Shopping list (${totalDays} days)\n\n${asText()}`); toast('Copied. Paste it into a note or a message.'); }
          catch (e) { toast('Copying is not allowed in this browser.'); }
        } }, 'Copy list')),
      el('p', { class: 'tiny muted' }, 'Amounts are raw or dry weight, as in your meal plan; buy a little extra for peeling and trimming. The list updates by itself when Bruno changes your plan or you swap a meal or a food.'));
  }
  draw();
  show(el('div', { class: 'stack', 'data-tour': 'shopping' }, el('h1', {}, 'Shopping list'), host));
  refreshMealPlan('shopping');
}

/* ---------- Lifestyle: steps and healthy habits ---------- */

function renderLifestyle() {
  const dateIn = el('input', { class: 'field', type: 'date', value: today(), max: today() });
  const steps = el('input', { class: 'field', inputMode: 'numeric', placeholder: '', value: S.daily.find((d) => d.day === today())?.steps ?? '' });
  dateIn.addEventListener('change', () => { steps.value = S.daily.find((d) => d.day === dateIn.value)?.steps ?? ''; });
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary', disabled: S.readOnly }, 'Save');
  save.addEventListener('click', async () => {
    const n = num(steps.value);
    if (n === null || n < 0 || n > 150000) { msg.className = 'msg err'; msg.textContent = 'Please enter a number of steps.'; return; }
    await upsertDaily(dateIn.value, { steps: Math.round(n) });
    renderLifestyle();
  });

  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13)).map((day) => ({ day, steps: num(S.daily.find((d) => d.day === day)?.steps) }));
  const maxSteps = Math.max(10000, ...last14.map((d) => d.steps || 0));
  const bars = el('div', { html: `<svg class="chart" viewBox="0 0 640 170" role="img" aria-label="Steps in the last 14 days">
    <line x1="0" x2="640" y1="${150 - (8000 / maxSteps) * 130}" y2="${150 - (8000 / maxSteps) * 130}" stroke="rgba(77,184,184,0.5)" stroke-dasharray="4 4"/>
    <text x="636" y="${146 - (8000 / maxSteps) * 130}" text-anchor="end">8,000</text>
    ${last14.map((d, i) => { const h = ((d.steps || 0) / maxSteps) * 130; const x = i * 45 + 6;
      return `<rect x="${x}" y="${150 - h}" width="34" height="${Math.max(h, 1)}" rx="5" fill="${d.steps ? (d.steps >= 8000 ? '#4db8b8' : '#2f7f7f') : '#2a2a2a'}"/>
      <text x="${x + 17}" y="166" text-anchor="middle">${parseDay(d.day).getDate()}</text>`; }).join('')}</svg>` });
  const weeks = Calc.weeks(S.daily).filter((w) => w.avgSteps).slice(-6).reverse();
  const todaySteps = num(S.daily.find((d) => d.day === today())?.steps) || 0;
  const STEP_GOAL = 8000;
  const ring = progressRing(todaySteps, STEP_GOAL, { size: 116, big: fmt(todaySteps, 0), small: `of ${fmt(STEP_GOAL, 0)}`, color: todaySteps >= STEP_GOAL ? 'var(--good)' : 'var(--kcal)', stroke: 10 });
  const week = weeks[0];

  show(el('div', { class: 'stack' },
    el('h1', {}, 'Lifestyle'),
    el('div', { class: 'card stack', 'data-tour': 'steps' },
      cardHead('steps', 'Daily steps'),
      el('div', { class: 'week-ring-row' }, ring,
        el('div', { class: 'grow' },
          el('div', { class: 'mlabel', style: 'color:var(--text-muted)' }, 'Today'),
          el('div', { style: 'font-weight:700;font-size:1.05rem' }, todaySteps >= STEP_GOAL ? 'Goal reached, nice!' : todaySteps ? `${fmt(STEP_GOAL - todaySteps, 0)} steps to go` : 'Not entered yet'),
          week ? el('div', { class: 'tiny muted', style: 'margin-top:4px' }, `This week: ${fmt(week.avgSteps, 0)} a day on average`) : null)),
      el('p', { class: 'small soft' }, 'Best in the evening: open your phone\'s health app (Health on iPhone, Google Fit, Samsung Health or your watch app) and copy today\'s number.'),
      el('label', { class: 'lab' }, 'Date', dateIn),
      valueRow('Steps', steps, 'steps', 'kcal'),
      save, msg),
    el('div', { class: 'card stack' },
      cardHead('chart', 'Last 14 days'),
      bars,
      el('p', { class: 'tiny muted' }, 'Bright bars reached 8,000 steps.'),
      weeks.length ? el('div', { class: 'wk-list' }, ...weeks.map((w) => el('div', { class: 'wk-row' },
        el('div', { class: 'grow' }, el('b', {}, weekRange(w.week)), el('div', { class: 'tiny muted' }, `${w.steps.length} day${w.steps.length === 1 ? '' : 's'} entered`)),
        el('b', {}, `${fmt(w.avgSteps, 0)}`), el('span', { class: 'tiny muted' }, 'a day'),
        changeChip(w.avgSteps >= STEP_GOAL ? 'On goal' : `${Math.round((w.avgSteps / STEP_GOAL) * 100)} %`, w.avgSteps >= STEP_GOAL ? 'good' : 'neutral')))) : null),
    guideCard('lifestyle', true),
    S.intake?.submitted_at && !S.readOnly ? el('div', { class: 'card tight row nowrap', style: 'gap:12px' }, el('span', { class: 'head-icon' }, icon('clipboard', 18)),
      el('div', { class: 'grow' }, el('b', {}, 'Your initial form'), el('div', { class: 'small muted' }, `Sent ${niceDate(ymd(S.intake.submitted_at))}. Update it when something changes, like a new injury, goal or schedule.`)),
      el('button', { class: 'btn small', type: 'button', onclick: () => intakeForm({ editing: true, onDone: () => { renderTabs(); route(); } }) }, 'View or update')) : null));
}

/* ---------- Installing the app ---------- */

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (location.hash.slice(1) === '' || location.hash.startsWith('#training') || location.hash.startsWith('#week')) route(); });

function installCard() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem('coaching-install-dismissed') === '1'; } catch (e) { /* ignore */ }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone || dismissed || S.readOnly || (!installEvent && !ios)) return null;
  const card = el('div', { class: 'card tight row nowrap' },
    el('div', { class: 'grow small' }, el('b', {}, 'Install the app'), el('div', { class: 'soft' },
      ios ? 'Tap the Share button, then "Add to Home Screen". Your plan then works without wifi.' : 'Add it to your home screen. Your plan then works without wifi.')),
    installEvent ? el('button', { class: 'btn primary small', onclick: async () => { installEvent.prompt(); await installEvent.userChoice; installEvent = null; card.remove(); } }, 'Install') : null,
    el('button', { class: 'btn ghost icon-btn', 'aria-label': 'Hide', onclick: () => { try { localStorage.setItem('coaching-install-dismissed', '1'); } catch (e) { /* ignore */ } card.remove(); } }, icon('x', 18)));
  return card;
}

function registerWorker() {
  if (!('serviceWorker' in navigator) || DEMO && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('coaching-sw.js', { scope: 'coaching' }).catch((e) => console.warn('Offline mode not available', e));
}
