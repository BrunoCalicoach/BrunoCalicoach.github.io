// Coach side (Bruno): dashboard, a spreadsheet editor for each athlete's weekly plan with draft and publish,
// results and feedback, progress, nutrition targets and PRO meal plans, athlete settings and guide texts.

const app = document.getElementById('app');
const signOutButton = document.getElementById('sign-out');
signOutButton.addEventListener('click', signOut);

const C = { clients: [], current: null, view: 'dashboard', tab: 'plan', week: mondayOf(), resultsFrom: 'same', d: {} };
const MEAL_COLS = [
  { key: 'meal', label: 'Meal', width: 130 }, { key: 'foods', label: 'Foods and amounts', width: 380 },
  { key: 'kcal', label: 'kcal', width: 70 }, { key: 'protein', label: 'Protein g', width: 85 }, { key: 'fat', label: 'Fat g', width: 70 }, { key: 'carbs', label: 'Carbs g', width: 80 }
];

/* ---------- Start ---------- */

if (DEMO) {
  demoBar('Demo mode: sample athletes, saved only in this browser. ');
  document.querySelector('.demo-bar').append(' ', el('a', { href: 'coaching.html?demo' }, 'Open the athlete app'));
  Data.setOwner('demo-coach');
  start();
} else {
  watchAuth(async (user) => {
    Data.setOwner(user.id);
    signOutButton.classList.remove('hidden');
    let coach = false;
    try { coach = await Data.rpc('is_coach'); } catch (e) { return fatal(e); }
    if (!coach) {
      return app.replaceChildren(el('div', { class: 'auth stack' }, el('h1', {}, 'Not a coach account'),
        el('p', { class: 'soft' }, `You are logged in as ${user.email}. This page is only for Bruno.`), el('a', { class: 'btn', href: 'coaching.html' }, 'Go to my coaching')));
    }
    start();
  }, () => { signOutButton.classList.add('hidden'); authView(app, { title: 'Coach login' }); });
}

function fatal(error) {
  console.error(error);
  app.replaceChildren(el('div', { class: 'card', style: 'max-width:600px;margin:30px auto' }, el('h2', {}, 'Something went wrong'),
    el('p', { class: 'soft', style: 'margin-top:8px' }, /relation .* does not exist|schema cache/i.test(error.message)
      ? 'The coaching tables are not in Supabase yet. Paste supabase/coaching.sql into the SQL Editor and run it.' : error.message)));
}

async function start() {
  try { C.clients = await Data.select('coaching_clients', {}, ['name']); } catch (e) { return fatal(e); }
  const saved = new URLSearchParams(location.hash.slice(1));
  if (saved.get('a') && C.clients.find((c) => c.user_id === saved.get('a'))) { C.view = 'athlete'; C.current = saved.get('a'); C.tab = saved.get('t') || 'plan'; if (saved.get('w')) C.week = saved.get('w'); }
  render();
}

function remember() {
  history.replaceState(null, '', C.view === 'athlete' ? `#a=${C.current}&t=${C.tab}&w=${C.week}` : '#' + C.view);
}

const client = () => C.clients.find((c) => c.user_id === C.current);
const clientName = () => client()?.name || 'The athlete';

// A copied workout day (exercises, title, description), kept while the coach page is open: paste it into any week of any athlete
let DAY_CLIPBOARD = null;

// Titles like "DAY 3" (or "Dan 3") follow the order of the days; other titles stay as they are
function renumberDays(days) {
  days.forEach((d, i) => { const m = String(d.title || '').match(/^(\s*(?:day|dan)\s*)\d+(\s*)$/i); if (m) d.title = `${m[1]}${i + 1}${m[2]}`; });
}

// The copied day with new ids; columns it uses that this week does not have yet are added to the week
function pastedDay(content) {
  const copy = clone(DAY_CLIPBOARD.day);
  copy.id = uid(); copy.rows.forEach((r) => { r.id = uid(); });
  for (const col of DAY_CLIPBOARD.columns || []) if (!content.columns.some((c) => c.key === col.key)) content.columns.push(clone(col));
  return copy;
}

/* ---------- Download all data: a backup file of every coaching table ---------- */
// Everything the coach can read, table by table, in one JSON file (also answers an athlete's GDPR request for their data).
// Photos stay in storage: the file lists their names only.
const BACKUP_TABLES = ['coaching_clients', 'coaching_profiles', 'coaching_intake', 'coaching_drafts', 'coaching_weeks', 'coaching_logs',
  'coaching_feedback', 'coaching_checkins', 'coaching_daily', 'coaching_measurements', 'coaching_targets', 'coaching_meal_plans',
  'coaching_meal_choices', 'coaching_foods', 'coaching_athlete_foods', 'coaching_meal_templates', 'coaching_guides'];

async function allRows(table) {
  if (DEMO) return Data.select(table, {});
  const rows = [];
  for (let from = 0; ; from += 1000) {   // the database hands out at most 1000 rows per request
    const { data, error } = await supa.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function downloadAllData() {
  const box = el('p', { class: 'soft' }, 'Collecting…');
  const m = modal('Download all data', box);
  const backup = { app: 'Bruno Zgela Coaching', made: new Date().toISOString(), tables: {}, skipped: {}, photos: {} };
  try {
    for (const t of BACKUP_TABLES) {
      box.textContent = `Collecting ${t.replace('coaching_', '').replace(/_/g, ' ')}…`;
      try { backup.tables[t] = await allRows(t); }
      catch (e) { if (e?.code === 'PGRST205' || e?.code === '42P01') backup.skipped[t] = 'table not set up'; else throw e; }
    }
    if (!DEMO) for (const c of backup.tables.coaching_clients || []) {
      try { backup.photos[c.name || c.user_id] = await Photos.list(c.user_id); } catch (e) { /* photos are optional in the file */ }
    }
    const rows = Object.values(backup.tables).reduce((n, r) => n + r.length, 0);
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const name = `coaching-backup-${ymd(new Date())}.json`;
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    box.replaceChildren(
      el('p', {}, `Saved ${name}: ${(backup.tables.coaching_clients || []).length} athletes, ${rows} entries in total.`),
      el('p', { class: 'small muted' }, 'Keep it somewhere safe (it holds health data). Progress photos are not in the file, only their names; they stay in the app.'),
      Object.keys(backup.skipped).length ? el('p', { class: 'small muted' }, `Not set up yet, so not included: ${Object.keys(backup.skipped).join(', ')}.`) : null);
  } catch (e) {
    box.replaceChildren(el('p', { class: 'error' }, 'Could not make the file: ' + (e.message || e)), el('p', { class: 'small muted' }, 'Check the connection and try again.'));
  }
  return m;
}

/* ---------- Layout ---------- */

function render() {
  remember();
  // On phones the menu folds into one button that shows where you are; picking an item closes it again
  const where = C.view === 'dashboard' ? 'Dashboard' : C.view === 'guides' ? 'Guide texts' : (client()?.name || 'Athlete');
  const toggle = el('button', { class: 'side-toggle', type: 'button', 'aria-expanded': String(!!C.menuOpen), onclick: () => { C.menuOpen = !C.menuOpen; render(); } },
    el('span', { class: 'side-toggle-icon', 'aria-hidden': 'true' }, C.menuOpen ? '✕' : '☰'), el('span', { class: 'grow' }, where), el('span', { class: 'small muted' }, 'Menu'));
  const pick = (fn) => () => { C.menuOpen = false; fn(); };
  const side = el('aside', { class: 'side card tight' + (C.menuOpen ? ' open' : '') }, toggle, el('div', { class: 'side-list' },
    el('button', { class: 'ath' + (C.view === 'dashboard' ? ' active' : ''), onclick: pick(() => { C.view = 'dashboard'; render(); }) }, 'Dashboard'),
    el('div', { class: 'section-title', style: 'margin:14px 12px 6px' }, 'Athletes'),
    ...C.clients.map((c) => el('button', { class: 'ath' + (C.view === 'athlete' && C.current === c.user_id ? ' active' : ''), style: c.active ? '' : 'opacity:.5',
      onclick: pick(() => openAthlete(c.user_id)) }, el('span', { class: 'grow' }, c.name), el('span', { class: 'pill ' + (c.tier === 'pro' ? 'pro' : '') }, c.tier.toUpperCase()))),
    el('button', { class: 'ath', onclick: pick(addAthlete) }, '+ Add athlete'),
    el('div', { class: 'section-title', style: 'margin:14px 12px 6px' }, 'Content'),
    el('button', { class: 'ath' + (C.view === 'guides' ? ' active' : ''), onclick: pick(() => { C.view = 'guides'; render(); }) }, 'Guide texts'),
    el('button', { class: 'ath', title: 'Save every athlete\'s data to one file on this device', onclick: pick(downloadAllData) }, 'Download all data')));
  const content = el('section', { class: 'grow', style: 'min-width:0' }, el('p', { class: 'muted' }, 'Loading…'));
  app.replaceChildren(el('div', { class: 'coach-layout' }, side, content));
  if (C.view === 'dashboard') renderDashboard(content);
  else if (C.view === 'guides') renderGuides(content);
  else renderAthlete(content);
}

async function openAthlete(id) {
  C.view = 'athlete'; C.current = id; C.d = {};
  render();
}

async function loadAthlete() {
  const id = { client_id: C.current };
  const [drafts, weeks, logs, feedback, daily, measurements, checkins, targets, meals, profile, choices, athleteFoods, intake] = await Promise.all([
    Data.select('coaching_drafts', id, ['week_start']), Data.select('coaching_weeks', id, ['week_start']),
    Data.select('coaching_logs', id), Data.select('coaching_feedback', id), Data.select('coaching_daily', id, ['day']),
    Data.select('coaching_measurements', id, ['day']), Data.select('coaching_checkins', id, ['week_start']),
    Data.select('coaching_targets', id), Data.select('coaching_meal_plans', id), Data.select('coaching_profiles', { user_id: C.current }),
    Data.select('coaching_meal_choices', id).catch(() => []),
    Data.select('coaching_athlete_foods', id, ['name']).catch(() => []),
    Data.select('coaching_intake', id).catch(() => null)]);
  C.d = { loaded: C.current, intake: intake ? intake[0] || null : undefined, drafts, weeks, logs, feedback, daily, measurements, checkins, targets: targets[0] || null, meals: meals[0] || null, profile: profile[0] || null, choices: choices[0]?.choices || {},
    athleteFoods: athleteFoods.map((r) => ({ id: r.id, name: r.name, cat: r.cat, athlete: true, note: r.note, ...r.per100, al: r.allergens || [] })) };
}

async function renderAthlete(content) {
  try { if (C.d.loaded !== C.current) await loadAthlete(); } catch (e) { return fatal(e); }
  const c = client();
  const tabs = [['overview', 'Overview'], ['plan', 'Training plan'], ['progress', 'Progress'], ['nutrition', 'Nutrition'], ['settings', 'Settings']];
  const body = el('div', { class: `athlete-tab tab-${C.tab}` });
  content.replaceChildren(
    el('div', { class: 'row', style: 'margin-bottom:10px' }, el('h1', {}, c.name), el('span', { class: 'pill ' + (c.tier === 'pro' ? 'pro' : '') }, c.tier.toUpperCase()),
      c.active ? null : el('span', { class: 'pill warn' }, 'Inactive')),
    el('div', { class: 'subtabs' }, ...tabs.map(([k, l]) => el('button', { class: C.tab === k ? 'active' : '', onclick: () => { C.tab = k; render(); } }, l))),
    body);
  if (C.tab === 'overview') renderOverview(body);
  if (C.tab === 'plan') renderPlan(body);
  if (C.tab === 'progress') renderProgress(body);
  if (C.tab === 'nutrition') renderNutrition(body);
  if (C.tab === 'settings') renderSettings(body);
}

/* ---------- Overview: the Initial Form and the athlete's key numbers in one place ---------- */

function renderOverview(body) {
  const c = client();
  const intake = C.d.intake;
  const a = intake?.answers || {};
  const p = C.d.profile || {};
  const sections = intakeSectionsFor(c.tier === 'pro');
  const valueOf = (f) => (f.profile ? p[f.key] : a[f.key]);
  const has = (v) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
  const none = (t) => !t || /^\s*(no|none|nothing|ne|nema|-)\s*\.?\s*$/i.test(String(t));

  // Form status, with a way to ask the athlete to look over their answers again
  const sentBefore = Boolean(a._sentBefore);
  const status = intake === undefined ? el('span', { class: 'pill' }, 'Form not set up')
    : intake?.submitted_at ? el('span', { class: 'status-badge done' }, icon('check', 14), `Sent ${niceDate(ymd(intake.submitted_at))}`)
    : intake ? el('span', { class: 'status-badge partial' }, sentBefore ? 'Asked to update' : `In progress · step ${(a._step || 0) + 1} of ${sections.length}`)
    : el('span', { class: 'pill warn' }, 'Not started');
  const askAgain = intake?.submitted_at ? el('button', { class: 'btn small ghost', type: 'button', onclick: async () => {
    if (!confirm(`Ask ${c.name.split(' ')[0]} to look over the initial form again? The answers stay filled in; the app shows the form the next time they open it.`)) return;
    try {
      const row = { client_id: c.user_id, answers: { ...a, _sentBefore: true }, submitted_at: null };
      await Data.upsert('coaching_intake', row); C.d.intake = row; render();
    } catch (e) { alert('Not saved: ' + e.message); }
  } }, 'Ask to update') : null;

  // Contact and basics
  const phone = String(a.phone || '').trim();
  const wa = phone.replace(/[^\d]/g, '').replace(/^00/, '');
  const age = p.birth_date ? Calc.age(p.birth_date) : null;
  const weeksIn = c.start_date ? Math.floor((parseDay(today()) - parseDay(c.start_date)) / (7 * 86400000)) + 1 : null;
  const contact = el('div', { class: 'chips' },
    phone ? el('a', { class: 'chip teal-chip', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, 'WhatsApp ', el('b', {}, phone)) : null,
    a.email ? el('a', { class: 'chip', href: `mailto:${a.email}` }, el('b', {}, a.email)) : null,
    p.sex ? el('span', { class: 'chip' }, p.sex === 'male' ? 'Male' : 'Female') : null,
    age !== null ? el('span', { class: 'chip' }, 'Age ', el('b', {}, String(age))) : null,
    weeksIn > 0 ? el('span', { class: 'chip' }, 'Coaching week ', el('b', {}, String(weeksIn))) : null);

  // Right now: numbers from the rest of the app
  const weeks = Calc.weeks(C.d.daily).filter((w) => w.avgWeight);
  const latest = weeks[weeks.length - 1];
  const est = C.d.profile ? Calc.targets(C.d.profile, Calc.latestWeight(C.d.daily, C.d.profile)) : null;
  const t = C.d.targets?.kcal ? C.d.targets : est;
  const thisWeek = C.d.weeks.find((w) => w.week_start === mondayOf());
  const doneThisWeek = C.d.logs.filter((l) => l.week_start === mondayOf() && l.completed_at).length;
  const lastCheck = C.d.checkins.slice().sort((x, y) => (x.week_start < y.week_start ? 1 : -1))[0];
  const stat = (label, value, sub) => el('div', { class: 'hero-stat', style: 'flex-direction:column;align-items:flex-start;gap:2px' },
    el('div', { class: 'mlabel', style: 'color:var(--text-muted)' }, label), el('div', { class: 'hero-num', style: 'font-size:22px' }, value), sub ? el('div', { class: 'tiny muted' }, sub) : null);
  const now = el('div', { class: 'stat-grid' },
    stat('Height', p.height_cm ? `${fmt(num(p.height_cm), 0)} cm` : '–'),
    stat('Start weight', p.start_weight ? `${fmt(num(p.start_weight), 1)} kg` : '–'),
    stat('Weekly average', latest ? `${fmt(latest.avgWeight, 1)} kg` : '–', latest?.change != null ? `${latest.change > 0 ? '+' : ''}${fmt(latest.change, 2)} kg this week` : null),
    stat('Goal', p.goal ? GOALS[p.goal] : '–', p.activity ? ACTIVITY_LEVELS.find((x) => x.value === Number(p.activity))?.label.split(':')[0] : null),
    stat('Targets', t ? `${fmt(t.kcal, 0)} kcal` : '–', t ? `P ${fmt(t.protein, 0)} · C ${fmt(t.carbs, 0)} · F ${fmt(t.fat, 0)} g${C.d.targets?.kcal ? ' (yours)' : ' (estimate)'}` : null),
    stat('This week', thisWeek ? `${doneThisWeek}/${thisWeek.content.days?.length || 0}` : '–', thisWeek ? 'workouts done' : 'no plan published'),
    stat('Last check-in', lastCheck ? niceDate(lastCheck.week_start) : '–'));

  // One card per form section, answers in reading order
  const flags = [];
  if (!none(a.injuries_now) && has(a.injuries_now)) flags.push('current injury');
  if (a.medical === 'yes') flags.push('medical condition');
  const allergyKeys = Array.isArray(a.allergies) ? a.allergies : [];
  const missingAllergies = allergyKeys.filter((k) => !(c.allergies || []).includes(k));
  const missingAvoid = String(a.avoid || '').split(',').map((w) => w.trim()).filter((w) => w && !String(c.avoid_foods || '').toLowerCase().includes(w.toLowerCase()));
  const sectionCard = (s) => {
    const rows = s.fields.filter((f) => !f.showIf || f.showIf(a)).map((f) => {
      const v = valueOf(f);
      const text = intakeAnswerText(f, v);
      return el('div', { class: 'qa' }, el('div', { class: 'small muted' }, f.label), el('div', { class: 'pre' + (text ? '' : ' muted') }, text || '–'));
    });
    const extra = s.key === 'health' && flags.length ? el('span', { class: 'pill warn' }, `Check: ${flags.join(', ')}`)
      : s.key === 'nutrition' && (missingAllergies.length || missingAvoid.length) ? el('span', { class: 'pill bad' }, 'Not in Settings yet') : null;
    const apply = s.key === 'nutrition' && (missingAllergies.length || missingAvoid.length) ? el('button', { class: 'btn small primary', type: 'button', onclick: async () => {
      const row = { user_id: c.user_id, allergies: [...new Set([...(c.allergies || []), ...missingAllergies])],
        avoid_foods: [c.avoid_foods, ...missingAvoid].filter(Boolean).join(', ') || null };
      try { await Data.upsert('coaching_clients', row); Object.assign(c, row); toast('Added to allergies and foods to avoid'); render(); } catch (e) { alert('Not saved: ' + e.message); }
    } }, `Add ${[...missingAllergies.map(allergenLabel), ...missingAvoid].join(', ')} to Settings`) : null;
    return el('div', { class: 'card stack' + (s.key === 'health' && flags.length ? ' flagged' : '') }, cardHead(s.icon, s.title, extra), el('div', { class: 'qa-list' }, ...rows), apply);
  };

  const empty = intake === undefined
    ? el('div', { class: 'notice warn' }, 'The Initial Form needs the database update first: run supabase/coaching-update-2026-11-26-initial-form.sql in the Supabase SQL Editor.')
    : !intake ? el('div', { class: 'notice' }, `${c.name.split(' ')[0]} hasn't started the initial form yet. The app asks for it the next time they open it.`) : null;

  body.replaceChildren(el('div', { class: 'stack' },
    el('div', { class: 'card stack' }, cardHead('users', a.name || c.name, el('div', { class: 'row nowrap', style: 'gap:8px' }, status, askAgain)), contact, now),
    empty,
    intake ? el('div', { class: 'overview-grid' }, ...sections.map(sectionCard)) : null));
}

/* ---------- Results text ---------- */

function resultText(entry) {
  const sets = (entry?.sets || []).filter((s) => s.reps || s.weight);
  let text = '';
  if (sets.length) {
    const weights = [...new Set(sets.map((s) => s.weight).filter(Boolean))];
    const rpes = sets.map((s) => s.rpe).filter(Boolean);
    text = sets.map((s) => s.reps || '–').join(', ') + (weights.length ? ` @ ${weights.join('/')}kg` : '') + (rpes.length ? `\nRPE ${rpes.join(', ')}` : '');
  }
  if (entry?.note) text += (text ? '\n' : '') + '“' + entry.note + '”';
  return text;
}

/* ---------- Training plan editor ---------- */

function renderPlan(body) {
  const draftRow = C.d.drafts.find((d) => d.week_start === C.week);
  const published = C.d.weeks.find((w) => w.week_start === C.week);
  const thisMonday = mondayOf();
  const status = el('span', { class: 'save-state' });
  const setStatus = (text, kind = '') => { status.textContent = text; status.className = 'save-state ' + kind; };
  const sameAsLive = () => published && draftRow && JSON.stringify(published.content) === JSON.stringify(draftRow.content) && published.label === draftRow.label;
  const refreshStatus = () => {
    if (!draftRow) return setStatus('');
    if (sameAsLive()) setStatus(`● Live for the athlete since ${new Date(published.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, 'live');
    else if (published) setStatus('● Changes saved as a draft, not published yet', 'dirty');
    else setStatus('● Draft saved, not published yet', 'dirty');
  };

  const labelIn = el('input', { class: 'field', style: 'max-width:220px;font-weight:800;padding:9px 12px', value: draftRow?.label || '', placeholder: 'Week label', disabled: !draftRow });
  const weekBar = el('div', { class: 'card tight row' },
    el('button', { class: 'btn icon-btn', 'aria-label': 'Previous week', onclick: () => { C.week = addDays(C.week, -7); render(); } }, icon('left')),
    el('div', {}, labelIn, el('div', { class: 'small muted', style: 'margin-top:2px' }, weekRange(C.week) + (C.week === thisMonday ? ' · this week' : C.week === addDays(thisMonday, 7) ? ' · next week' : ''))),
    el('button', { class: 'btn icon-btn', 'aria-label': 'Next week', onclick: () => { C.week = addDays(C.week, 7); render(); } }, icon('right')),
    C.week !== thisMonday ? el('button', { class: 'btn small ghost', onclick: () => { C.week = thisMonday; render(); } }, 'This week') : null,
    el('div', { class: 'grow' }),
    status);

  // Weeks with a plan, as quick links
  const weekLinks = el('div', { class: 'row small', style: 'margin:10px 0' }, el('span', { class: 'muted' }, 'Weeks:'),
    ...C.d.drafts.map((d) => {
      const live = C.d.weeks.find((w) => w.week_start === d.week_start);
      return el('button', { class: 'btn small' + (d.week_start === C.week ? ' primary' : ''), title: weekRange(d.week_start) + (live ? ' (published)' : ' (draft only)'),
        onclick: () => { C.week = d.week_start; render(); } }, (d.label || niceDate(d.week_start)) + (live ? '' : ' ✎'));
    }));

  if (!draftRow) {
    const previous = C.d.drafts.filter((d) => d.week_start < C.week).pop();
    body.replaceChildren(weekBar, weekLinks, el('div', { class: 'card stack', style: 'margin-top:12px' },
      el('h2', {}, 'No plan for this week yet'),
      el('div', { class: 'row' },
        previous ? el('button', { class: 'btn primary', onclick: () => createWeek(clone(previous.content), nextLabel(previous.label)) }, `Copy ${previous.label || 'the previous week'} (${weekRange(previous.week_start)})`) : null,
        el('button', { class: 'btn', onclick: () => createWeek(emptyContent(), previous ? nextLabel(previous.label) : 'Week 1') }, 'Start empty'),
        el('button', { class: 'btn', onclick: copyFromDialog }, 'Copy from another athlete or week'),
        // A day copied with ⋮ → Copy day: start this week with just that day
        DAY_CLIPBOARD ? el('button', { class: 'btn', onclick: () => {
          const fresh = emptyContent(); fresh.days = []; DAY_CLIPBOARD.columns && (fresh.columns = clone(DAY_CLIPBOARD.columns));
          fresh.days.push(pastedDay(fresh)); renumberDays(fresh.days);
          createWeek(fresh, previous ? nextLabel(previous.label) : 'Week 1');
        } }, `Start with the copied ${DAY_CLIPBOARD.day.title || 'day'}${DAY_CLIPBOARD.from ? ` (${DAY_CLIPBOARD.from})` : ''}`) : null),
      el('p', { class: 'small muted' }, 'Copying keeps every exercise, so the athlete sees "last time" results next to each one. Change only what is different, then publish.')));
    return;
  }

  const draft = draftRow;
  const content = draft.content;
  content.columns = content.columns || clone(DEFAULT_COLUMNS);
  const save = debounce(async () => {
    setStatus('Saving…');
    try { await Data.upsert('coaching_drafts', { client_id: C.current, week_start: C.week, label: draft.label, content }); refreshStatus(); }
    catch (e) { setStatus('Not saved: ' + e.message, 'dirty'); }
  }, 900);
  const changed = () => { setStatus('Saving…'); save(); };
  labelIn.addEventListener('input', () => { draft.label = labelIn.value; changed(); });

  const resultsWeek = C.resultsFrom === 'same' ? C.week : addDays(C.week, -7);
  const resultsWeekPlan = C.d.weeks.find((w) => w.week_start === resultsWeek);
  const logsFor = (i) => C.d.logs.find((l) => l.week_start === resultsWeek && l.day_index === i);
  const resultFor = (dayIndex, row) => {
    // The same exercise row in any day of that week (it stays found after the days were moved)
    const byRow = C.d.logs.find((l) => l.week_start === resultsWeek && l.entries?.[row.id]);
    if (byRow) return resultText(byRow.entries[row.id]);
    const log = logsFor(dayIndex);
    if (!log) return '';
    // Same exercise name anywhere in that week's day
    const name = String(row.c.name || '').trim().toLowerCase();
    const other = resultsWeekPlan?.content.days?.[dayIndex]?.rows?.find((r) => String(r.c.name || '').trim().toLowerCase() === name);
    return other ? resultText(log.entries?.[other.id]) : '';
  };

  const sheets = [];
  const refreshSheets = () => sheets.forEach((s) => s.refresh());
  const dayBlocks = el('div');
  function drawDays() {
    sheets.length = 0;
    dayBlocks.replaceChildren(...content.days.map((day, i) => dayBlock(day, i)));
  }
  function dayBlock(day, i) {
    const title = el('input', { class: 'field title-in', value: day.title || '', placeholder: 'DAY 1' });
    const subtitle = el('input', { class: 'field', value: day.subtitle || '', placeholder: 'e.g. PUSH WEIGHTED + BODYWEIGHT PULL' });
    const desc = el('textarea', { class: 'field', value: day.description || '', placeholder: 'Description for the whole day (circuit rules, rounds…), optional' });
    title.addEventListener('input', () => { day.title = title.value; changed(); });
    subtitle.addEventListener('input', () => { day.subtitle = subtitle.value; changed(); });
    desc.addEventListener('input', () => { day.description = desc.value; changed(); });
    let lastColumns = JSON.stringify(content.columns);
    const sheet = createSheet({
      columns: content.columns, rows: day.rows,
      onChange: () => {
        const cols = JSON.stringify(content.columns);
        if (cols !== lastColumns) { lastColumns = cols; sheets.forEach((s) => s !== sheet && s.refresh()); }
        changed();
      },
      extraColumn: (row) => resultFor(i, row),
      extraLabel: C.resultsFrom === 'same' ? 'Athlete did (this week)' : 'Athlete did (last week)'
    });
    sheets.push(sheet);
    const log = logsFor(i);
    const fbRow = C.d.feedback.find((f) => f.week_start === resultsWeek && f.day_index === i);
    const fb = el('textarea', { class: 'field', style: 'min-height:60px', value: fbRow?.body || '', placeholder: `Your feedback for ${day.title || 'this day'} (${C.resultsFrom === 'same' ? 'this week' : 'last week'}), shown to the athlete` });
    const fbState = el('span', { class: 'save-state' });
    const saveFb = debounce(async () => {
      const key = { client_id: C.current, week_start: resultsWeek, day_index: i };
      try {
        if (fb.value.trim()) await Data.upsert('coaching_feedback', { ...key, body: fb.value.trim() }); else await Data.remove('coaching_feedback', key);
        C.d.feedback = C.d.feedback.filter((f) => !(f.week_start === resultsWeek && f.day_index === i));
        if (fb.value.trim()) C.d.feedback.push({ ...key, body: fb.value.trim() });
        fbState.textContent = fb.value.trim() ? 'Feedback saved, the athlete can see it' : '';
      } catch (e) { fbState.textContent = 'Not saved: ' + e.message; }
    }, 900);
    fb.addEventListener('input', () => { fbState.textContent = 'Saving…'; saveFb(); });

    // Moving, adding or deleting days: titles like "DAY 2" follow the new order, so they never need retyping.
    // The athlete's results are saved by day position, so warn when this week already has some.
    const loggedThisWeek = () => C.d.logs.some((l) => l.week_start === C.week);
    const reorderOk = () => !loggedThisWeek() || confirm(`${clientName()} has already logged workouts this week. Their results are saved by day position, so after this change they may show next to a different day. Continue?`);
    const restructured = () => { renumberDays(content.days); drawDays(); changed(); };
    const move = (to) => { if (to < 0 || to >= content.days.length || !reorderOk()) return; content.days.splice(to, 0, content.days.splice(i, 1)[0]); restructured(); };
    const freshCopy = (d) => { const copy = clone(d); copy.id = uid(); copy.rows.forEach((r) => { r.id = uid(); }); return copy; };
    const pasteLabel = DAY_CLIPBOARD ? `${DAY_CLIPBOARD.day.title || 'day'}${DAY_CLIPBOARD.from ? ` (${DAY_CLIPBOARD.from})` : ''}` : '';
    const dayMenu = el('button', { class: 'kebab', type: 'button', 'aria-label': `Options for ${day.title || 'this day'}`, onclick: (e) => popMenu(e.currentTarget, [
      i > 0 ? ['Move up', () => move(i - 1)] : null,
      i < content.days.length - 1 ? ['Move down', () => move(i + 1)] : null,
      ['Duplicate', () => { if (!reorderOk()) return; content.days.splice(i + 1, 0, freshCopy(day)); restructured(); }],
      ['Copy day', () => {
        DAY_CLIPBOARD = { day: clone(day), columns: clone(content.columns), from: clientName().split(' ')[0] };
        toast(`Copied ${day.title || 'the day'}. Open ⋮ on any day, of any athlete and week, and choose Paste.`);
      }],
      DAY_CLIPBOARD ? [`Paste ${pasteLabel} after this day`, () => {
        if (!reorderOk()) return;
        content.days.splice(i + 1, 0, pastedDay(content)); restructured();
      }] : null,
      DAY_CLIPBOARD ? [`Paste ${pasteLabel} over ${day.title || 'this day'}`, () => {
        if (day.rows.some((r) => String(r.c.name || '').trim()) && !confirm(`Replace every exercise in ${day.title || 'this day'} with the copied ${DAY_CLIPBOARD.day.title || 'day'}?`)) return;
        const copy = pastedDay(content);
        Object.assign(day, { subtitle: copy.subtitle, description: copy.description, rows: copy.rows });
        drawDays(); changed();
      }] : null,
      ['Delete day', () => { if (confirm(`Delete ${day.title || 'this day'}?`) && reorderOk()) { content.days.splice(i, 1); restructured(); } }, true]
    ]) }, '⋮');
    return el('div', { class: 'card day-block' },
      el('div', { class: 'row between', style: 'margin-bottom:10px' },
        el('div', { class: 'row' }, numTag(i + 1), el('span', { class: 'meal-icon' }, icon('pullup', 18)),
          log?.completed_at ? el('span', { class: 'pill good' }, `Done ${niceDate(ymd(log.completed_at))}`) : log ? el('span', { class: 'pill warn' }, 'Started') : null,
          log?.difficulty ? el('span', { class: 'pill' }, `Difficulty ${log.difficulty}/10`) : null),
        el('div', { class: 'row nowrap', style: 'gap:4px' },
          el('button', { class: 'btn small ghost', title: 'Move this day up', 'aria-label': 'Move this day up', disabled: i === 0, onclick: () => move(i - 1) }, '↑ Up'),
          el('button', { class: 'btn small ghost', title: 'Move this day down', 'aria-label': 'Move this day down', disabled: i === content.days.length - 1, onclick: () => move(i + 1) }, '↓ Down'),
          dayMenu)),
      el('div', { class: 'day-head' }, title, subtitle, desc),
      el('div', { style: 'margin-top:10px' }, sheet.node),
      log?.note ? el('div', { class: 'notice pre', style: 'margin-top:12px' }, el('b', {}, 'Athlete\'s note: '), log.note) : null,
      el('div', { style: 'margin-top:12px' }, fb, fbState));
  }
  drawDays();

  const note = el('textarea', { class: 'field', style: 'min-height:50px', value: content.note || '', placeholder: 'Message at the top of the week (optional), e.g. "Deload week: keep everything at RPE 7"' });
  note.addEventListener('input', () => { content.note = note.value; changed(); });

  const publish = el('button', { class: 'btn primary' }, published ? 'Publish changes' : 'Publish to athlete');
  publish.addEventListener('click', async () => {
    publish.disabled = true;
    save.flush();
    await new Promise((r) => setTimeout(r, 400));
    try {
      await Data.upsert('coaching_drafts', { client_id: C.current, week_start: C.week, label: draft.label, content });
      const stamp = await Data.rpc('publish_week', { p_client: C.current, p_week: C.week });
      C.d.weeks = C.d.weeks.filter((w) => w.week_start !== C.week).concat({ client_id: C.current, week_start: C.week, label: draft.label, content: clone(content), published_at: stamp })
        .sort((a, b) => (a.week_start > b.week_start ? 1 : -1));
      render();
    } catch (e) { alert('Not published: ' + e.message); publish.disabled = false; }
  });
  const previewUrl = `coaching.html?${DEMO ? 'demo&' : ''}as=${encodeURIComponent(C.current)}&preview=draft#week/${C.week}`;

  const toggle = el('div', { class: 'seg' },
    el('button', { class: C.resultsFrom === 'same' ? 'active' : '', onclick: () => { C.resultsFrom = 'same'; render(); } }, 'Results: this week'),
    el('button', { class: C.resultsFrom === 'prev' ? 'active' : '', onclick: () => { C.resultsFrom = 'prev'; render(); } }, 'Results: last week'));

  body.replaceChildren(weekBar, weekLinks,
    el('div', { class: 'row', style: 'margin:4px 0 12px' }, publish,
      el('a', { class: 'btn', href: previewUrl }, 'Preview as athlete'),
      published ? el('button', { class: 'btn ghost', onclick: async () => {
        if (!confirm('Hide this week from the athlete again? The draft stays here.')) return;
        await Data.rpc('unpublish_week', { p_client: C.current, p_week: C.week });
        C.d.weeks = C.d.weeks.filter((w) => w.week_start !== C.week); render();
      } }, 'Unpublish') : el('button', { class: 'btn ghost danger', onclick: async () => {
        if (!confirm('Delete this draft week?')) return;
        await Data.remove('coaching_drafts', { client_id: C.current, week_start: C.week });
        C.d.drafts = C.d.drafts.filter((d) => d.week_start !== C.week); render();
      } }, 'Delete draft'),
      el('div', { class: 'grow' }), toggle),
    el('details', { class: 'small muted', style: 'margin-bottom:10px' }, el('summary', { style: 'cursor:pointer' }, 'Keyboard shortcuts'),
      el('p', { style: 'margin-top:6px' }, 'Tab / Shift+Tab next or previous cell · Enter next row · Alt+Enter new line in a cell · arrows move at the edge of the text · paste a block copied from Excel or Google Sheets · drag over cells (or Shift+click) then Ctrl+C to copy or Delete to clear · Ctrl+Z undo, Ctrl+Y redo · Ctrl+Enter insert row · Ctrl+Delete delete row · Alt+↑/↓ move row · click a row number for more · right-click a column title to add, move or delete columns.')),
    note,
    weekFeedback(resultsWeek),
    dayBlocks,
    el('button', { class: 'add-day', type: 'button', style: 'margin-top:14px', onclick: () => { content.days.push(emptyDay(content.days.length + 1)); drawDays(); changed(); } }, icon('plus', 18), `Add day ${content.days.length + 1}`));
  refreshStatus();

  async function createWeek(newContent, label) {
    const row = { client_id: C.current, week_start: C.week, label, content: newContent };
    await Data.upsert('coaching_drafts', row);
    C.d.drafts = C.d.drafts.concat(row).sort((a, b) => (a.week_start > b.week_start ? 1 : -1));
    render();
  }
  async function copyFromDialog() {
    const who = el('select', { class: 'select field' }, ...C.clients.map((c) => el('option', { value: c.user_id, selected: c.user_id === C.current }, c.name)));
    const which = el('select', { class: 'select field' });
    const fill = async () => {
      const drafts = who.value === C.current ? C.d.drafts : await Data.select('coaching_drafts', { client_id: who.value }, ['week_start']);
      which.replaceChildren(...drafts.slice().reverse().map((d) => el('option', { value: d.week_start }, `${d.label || 'Week'} · ${weekRange(d.week_start)}`)));
      which._drafts = drafts;
    };
    who.addEventListener('change', fill);
    await fill();
    const m = modal('Copy a week', el('label', { class: 'lab' }, 'Athlete', who), el('label', { class: 'lab' }, 'Week', which),
      el('button', { class: 'btn primary', onclick: () => {
        const src = which._drafts.find((d) => d.week_start === which.value);
        if (!src) return;
        m.close();
        createWeek(clone(src.content), who.value === C.current ? nextLabel(src.label) : src.label);
      } }, 'Copy into ' + weekRange(C.week)));
  }
}

function weekFeedback(week) {
  const row = C.d.feedback.find((f) => f.week_start === week && f.day_index === -1);
  const t = el('textarea', { class: 'field', style: 'min-height:50px;margin-top:8px', value: row?.body || '', placeholder: `Feedback on the whole week (${C.resultsFrom === 'same' ? 'this week' : 'last week'}), optional` });
  const save = debounce(async () => {
    const key = { client_id: C.current, week_start: week, day_index: -1 };
    if (t.value.trim()) await Data.upsert('coaching_feedback', { ...key, body: t.value.trim() }); else await Data.remove('coaching_feedback', key);
    C.d.feedback = C.d.feedback.filter((f) => !(f.week_start === week && f.day_index === -1)).concat(t.value.trim() ? [{ ...key, body: t.value.trim() }] : []);
  }, 900);
  t.addEventListener('input', save);
  return t;
}

function nextLabel(label) {
  const m = String(label || '').match(/^(.*?)(\d+)(\D*)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : '';
}

/* ---------- Progress ---------- */

function renderProgress(body) {
  const { daily, measurements, checkins, profile } = C.d;
  const weeks = Calc.weeks(daily);
  const points = daily.filter((d) => num(d.weight)).map((d) => ({ x: parseDay(d.day).getTime(), y: num(d.weight) }));
  const avg = weeks.filter((w) => w.avgWeight).map((w) => ({ x: parseDay(addDays(w.week, 3)).getTime(), y: w.avgWeight }));
  const est = profile ? Calc.targets(profile, Calc.latestWeight(daily, profile)) : null;
  const photos = el('div', {}, el('p', { class: 'small muted' }, 'Loading…'));
  Photos.list(C.current).then((paths) => photos.replaceChildren(paths.length ? photoGrid(paths) : el('p', { class: 'small muted' }, 'No photos yet.')))
    .catch(() => photos.replaceChildren(el('p', { class: 'small muted' }, 'Photos could not be loaded.')));

  // Headline numbers: latest weekly average, its change and the estimated balance, coloured by the athlete's goal
  const goal = profile?.goal || 'maintain';
  const mood = (ch) => ch === null ? 'neutral' : goal === 'cut' ? (ch < 0 ? 'good' : ch > 0.1 ? 'bad' : 'neutral')
    : goal === 'gain' ? (ch > 0 ? 'good' : ch < -0.1 ? 'bad' : 'neutral') : (Math.abs(ch) <= 0.3 ? 'good' : 'neutral');
  const signed = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x), d);
  const withWeight = weeks.filter((w) => w.avgWeight);
  const latest = withWeight[withWeight.length - 1];
  const firstAvg = withWeight[0];
  const stat = (label, value, extra) => el('div', { class: 'hero-stat', style: 'flex-direction:column;align-items:flex-start;gap:4px' },
    el('div', { class: 'mlabel', style: 'color:var(--text-muted)' }, label), el('div', { class: 'hero-num', style: 'font-size:26px' }, ...[].concat(value)), extra || null);
  const MEAS = [['chest', 'Chest'], ['waist_narrow', 'Narrowest waist'], ['waist_navel', 'Waist (navel)'], ['hips', 'Hips'], ['biceps', 'Biceps'], ['thigh', 'Thigh']];
  const RATE = [['training', 'Training'], ['nutrition', 'Nutrition'], ['stress', 'Stress'], ['sleep', 'Sleep'], ['satisfaction', 'Satisfaction'], ['motivation', 'Motivation']];
  const dots = (v) => el('span', { class: 'rate-dots', 'aria-label': `${v ?? 'not rated'} of 5` }, ...[1, 2, 3, 4, 5].map((i) => el('i', { class: v >= i ? 'on' : '' })));
  const since = firstAvg && latest && firstAvg !== latest ? latest.avgWeight - firstAvg.avgWeight : null;

  body.replaceChildren(el('div', { class: 'stack-lg' },
    el('div', { class: 'card stack' }, cardHead('scale', 'Body weight', latest ? el('span', { class: 'tiny muted' }, `${withWeight.length} week${withWeight.length === 1 ? '' : 's'} of data`) : null),
      latest ? el('div', { class: 'stat-grid' },
        stat('Weekly average', [fmt(latest.avgWeight, 1), el('span', {}, ' kg')], el('span', { class: 'tiny muted' }, weekRange(latest.week))),
        stat('This week', latest.change === null ? '–' : [signed(latest.change), el('span', {}, ' kg')],
          latest.change !== null ? changeChip(goal === 'cut' ? 'Goal: lose' : goal === 'gain' ? 'Goal: gain' : 'Goal: maintain', mood(latest.change)) : null),
        stat('Est. balance', latest.balance === null ? '–' : [signed(latest.balance, 0), el('span', {}, ' kcal/day')]),
        stat('Since start', since === null ? '–' : [signed(since), el('span', {}, ' kg')], since === null ? null : changeChip(`from ${fmt(firstAvg.avgWeight, 1)} kg`, mood(since)))) : null,
      lineChart(points, { avg }),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data' },
        el('thead', {}, el('tr', {}, ...['Week', 'Average', 'Change', 'Est. balance', 'Weigh-ins', 'Avg steps'].map((h) => el('th', {}, h)))),
        el('tbody', {}, ...weeks.slice().reverse().map((w) => el('tr', {},
          el('td', {}, weekRange(w.week)), el('td', {}, w.avgWeight ? el('b', {}, fmt(w.avgWeight, 2) + ' kg') : '–'),
          el('td', {}, w.change === null ? '–' : changeChip(signed(w.change), mood(w.change))),
          el('td', {}, w.balance === null ? '–' : signed(w.balance, 0) + ' kcal/day'),
          el('td', { class: w.weights.length < 4 ? 'accent-warn' : '' }, String(w.weights.length)), el('td', {}, w.avgSteps ? fmt(w.avgSteps, 0) : '–'))))))),
    el('div', { class: 'card stack' }, cardHead('info', 'Starting details and estimate'),
      profile && !est && profile.birth_date ? el('div', { class: 'notice warn' }, `Details look wrong, so no estimate: ${Calc.ageProblem(profile.birth_date) || 'check height, weight and activity.'} Entered: ${profile.sex || '?'}, born ${profile.birth_date}, ${profile.height_cm ?? '?'} cm, start ${profile.start_weight ?? '?'} kg, activity ${profile.activity ?? '?'}, goal ${GOALS[profile.goal] || '?'}. The athlete is asked to fix them in the app.`) : null,
      profile && est ? el('div', { class: 'stack', style: 'gap:8px' },
        el('div', { class: 'chips' }, ...[profile.sex, `age ${est.age}`, `${profile.height_cm} cm`, `start ${profile.start_weight} kg`, `activity ${profile.activity}`, GOALS[profile.goal]].map((t) => el('span', { class: 'chip' }, t))),
        el('div', { class: 'chips' }, el('span', { class: 'chip' }, 'BMR ', el('b', {}, fmt(est.bmr, 0))), el('span', { class: 'chip' }, 'TDEE ', el('b', {}, fmt(est.tdee, 0))),
          el('span', { class: 'chip teal-chip' }, 'Target ', el('b', {}, `${fmt(est.kcal, 0)} kcal`)),
          el('span', { class: 'chip', style: 'color:var(--prot)' }, 'Protein ', el('b', {}, `${est.protein} g`)),
          el('span', { class: 'chip', style: 'color:var(--carb)' }, 'Carbs ', el('b', {}, `${est.carbs} g`)),
          el('span', { class: 'chip', style: 'color:var(--fat)' }, 'Fat ', el('b', {}, `${est.fat} g`))))
        : profile?.birth_date ? null : el('p', { class: 'muted' }, 'The athlete has not filled in their starting details yet.')),
    el('div', { class: 'card stack' }, cardHead('ruler', 'Measurements', measurements.length ? el('span', { class: 'tiny muted' }, `Last ${niceDate(measurements[measurements.length - 1].day)}`) : null),
      measurements.length ? el('div', { class: 'wk-list' }, ...MEAS.map(([k, l]) => {
        const now = [...measurements].reverse().find((m) => num(m[k]) !== null);
        const start = measurements.find((m) => num(m[k]) !== null);
        const d = now && start && now !== start ? num(now[k]) - num(start[k]) : null;
        return el('div', { class: 'wk-row' }, el('b', { class: 'grow' }, l), el('b', {}, now ? `${fmt(num(now[k]))} cm` : '–'), d !== null ? changeChip(signed(d, 1), 'neutral') : null);
      })) : el('p', { class: 'muted' }, 'None yet.'),
      measurements.length > 1 ? el('p', { class: 'tiny muted' }, 'Change since the first measurement.') : null,
      measurements.length > 1 ? el('details', { class: 'fold' }, el('summary', {}, `All entries (${measurements.length})`),
        el('div', { class: 'table-wrap', style: 'margin-top:8px' }, el('table', { class: 'data' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Date'), ...MEAS.map(([, h]) => el('th', {}, h)))),
          el('tbody', {}, ...measurements.slice().reverse().map((m) => el('tr', {}, el('td', {}, niceDate(m.day)), ...MEAS.map(([k]) => el('td', {}, m[k] ?? '–')))))))) : null),
    el('div', { class: 'card stack' }, cardHead('clipboard', 'Weekly check-ins'),
      checkins.length ? el('div', { class: 'stack' }, ...checkins.slice().reverse().map((c) => el('div', { class: 'card alt tight stack' },
        el('div', { class: 'row between' }, el('b', {}, weekRange(c.week_start)), c.avg_kcal ? el('span', { class: 'chip' }, 'avg ', el('b', {}, `${c.avg_kcal} kcal`)) : null),
        el('div', { class: 'rate-grid' }, ...RATE.map(([k, l]) => el('div', { class: 'rate-cell' }, el('span', { class: 'small soft grow' }, l), dots(c.ratings?.[k]), el('b', { class: 'small' }, String(c.ratings?.[k] ?? '–'))))),
        c.impression ? el('p', { class: 'soft pre small' }, c.impression) : null,
        (c.activities || []).filter((a) => a.activity).length ? el('p', { class: 'small' }, 'Activities: ' + c.activities.filter((a) => a.activity).map((a) => `${a.activity} ${a.duration || ''} ${a.intensity || ''}`.trim()).join('; ')) : null,
        c.questions ? el('p', { class: 'small' }, el('b', {}, 'Questions: '), c.questions) : null,
        c.feedback ? el('p', { class: 'small' }, el('b', {}, 'Feedback for you: '), c.feedback) : null))) : el('p', { class: 'muted' }, 'None yet.')),
    el('div', { class: 'card stack' }, cardHead('camera', 'Progress photos'), photos)));
}

/* ---------- Nutrition ---------- */

function renderNutrition(body) {
  const c = client();
  const t = C.d.targets || { client_id: C.current };
  const est = C.d.profile ? Calc.targets(C.d.profile, Calc.latestWeight(C.d.daily, C.d.profile)) : null;

  // Daily targets (folded): the app's estimate, or Bruno's own numbers
  const field = (k, ph) => el('input', { class: 'field', inputMode: 'numeric', value: t[k] ?? '', placeholder: ph });
  const kcal = field('kcal', est ? String(est.kcal) : ''), protein = field('protein', est ? String(est.protein) : ''),
    fat = field('fat', est ? String(est.fat) : ''), carbs = field('carbs', est ? String(est.carbs) : '');
  const note = el('textarea', { class: 'field', value: t.note || '', placeholder: 'Note shown with the targets (optional)' });
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary' }, 'Save targets');
  save.addEventListener('click', async () => {
    const row = { client_id: C.current, kcal: num(kcal.value), protein: num(protein.value), fat: num(fat.value), carbs: num(carbs.value), note: note.value.trim() || null };
    if (!row.kcal) { msg.className = 'msg err'; msg.textContent = 'Enter calories, or use "Use the estimate".'; return; }
    try { await Data.upsert('coaching_targets', row); C.d.targets = { ...(C.d.targets || {}), ...row }; render(); }
    catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
  });
  const reset = el('button', { class: 'btn ghost' }, 'Use the estimate');
  reset.addEventListener('click', async () => {
    const water = C.d.targets?.water_ml || null;
    await Data.remove('coaching_targets', { client_id: C.current });
    C.d.targets = null;
    if (water) { await Data.upsert('coaching_targets', { client_id: C.current, water_ml: water }); C.d.targets = { client_id: C.current, water_ml: water }; }
    render();
  });

  // Targets the plan is checked against: Bruno's numbers if set, otherwise the app's estimate
  const byCoach = Boolean(C.d.targets?.kcal);
  const planTarget = byCoach ? { kcal: C.d.targets.kcal, protein: C.d.targets.protein, fat: C.d.targets.fat, carbs: C.d.targets.carbs }
    : est ? { kcal: est.kcal, protein: est.protein, fat: est.fat, carbs: est.carbs } : null;
  const targetsCard = el('details', { class: 'card tight' },
    el('summary', { style: 'cursor:pointer' },
      el('b', {}, 'Daily targets '), el('span', { class: 'pill ' + (byCoach ? 'teal' : '') }, byCoach ? 'Set by you' : 'Estimate'),
      el('div', { class: 'small soft', style: 'margin-top:4px' }, planTarget
        ? `${fmt(planTarget.kcal, 0)} kcal · P ${fmt(planTarget.protein, 0)} g · C ${fmt(planTarget.carbs, 0)} g · F ${fmt(planTarget.fat, 0)} g`
        : 'No targets yet: the athlete has not entered their details. Tap to set them yourself.')),
    el('div', { class: 'stack', style: 'margin-top:12px' },
      el('p', { class: 'small soft' }, est
        ? `The app's estimate from the athlete's details: ${fmt(est.kcal, 0)} kcal, protein ${est.protein} g, fat ${est.fat} g, carbs ${est.carbs} g (TDEE ${fmt(est.tdee, 0)}). Leave empty to use the estimate, or enter your own numbers; they replace it for every tier.`
        : 'The athlete has not entered their details yet, so there is no estimate. You can still set targets yourself.'),
      el('div', { class: 'form-grid' }, el('label', { class: 'lab' }, 'Calories (kcal)', kcal), el('label', { class: 'lab' }, 'Protein min (g)', protein),
        el('label', { class: 'lab' }, 'Fat min (g)', fat), el('label', { class: 'lab' }, 'Carbs (g)', carbs)),
      note, el('div', { class: 'row' }, save, byCoach ? reset : null), msg));

  // Water: the target (estimate or Bruno's) and what the athlete logged lately
  const water = Calc.waterTarget(C.d.profile, C.d.targets?.water_ml);
  const waterIn = el('input', { class: 'field', inputMode: 'numeric', style: 'max-width:140px', value: C.d.targets?.water_ml ?? '', placeholder: String(Calc.waterTarget(C.d.profile).ml) });
  const waterMsg = el('span', { class: 'small' });
  const saveWater = async (ml) => {
    try {
      await Data.upsert('coaching_targets', { client_id: C.current, water_ml: ml });
      C.d.targets = { ...(C.d.targets || { client_id: C.current }), water_ml: ml };
      render();
    } catch (e) {
      waterMsg.className = 'small msg err';
      waterMsg.textContent = /water_ml/.test(e.message) ? 'The database needs the water update first (coaching-update-2026-11-26-water.sql).' : e.message;
    }
  };
  const lastDays = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6)).map((d) => ({ d, ml: num(C.d.daily.find((x) => x.day === d)?.water_ml) }));
  const logged = lastDays.filter((x) => x.ml !== null);
  const todayMl = lastDays[6].ml || 0;
  const waterCard = el('div', { class: 'card stack' },
    el('div', { class: 'row between' }, el('h2', {}, 'Water'), el('span', { class: 'pill ' + (water.byCoach ? 'teal' : '') }, water.byCoach ? 'Set by you' : 'Estimate')),
    waterTracker(todayMl, water.ml, null),
    el('p', { class: 'small soft', style: 'text-align:center' }, logged.length
      ? `Today so far. Last 7 days: ${logged.length} day${logged.length === 1 ? '' : 's'} logged, average ${fmt(logged.reduce((a, x) => a + x.ml, 0) / logged.length, 0)} ml.`
      : 'The athlete has not logged any water in the last 7 days.'),
    el('details', {}, el('summary', { class: 'small', style: 'cursor:pointer;color:var(--accent-soft)' }, 'Change the water target'),
      el('div', { class: 'stack', style: 'margin-top:10px' },
        el('p', { class: 'tiny muted' }, water.byCoach ? `Your target replaces the estimate (${fmt(Calc.waterTarget(C.d.profile).ml, 0)} ml).`
          : `Estimate: ${C.d.profile?.sex === 'female' ? '1.6' : '2.0'} L from drinks (EFSA adequate intake${C.d.profile?.sex ? '' : ', assuming male until the athlete enters their details'})${water.extra ? ' + 0.5 L because they train on most days' : ''}, rounded to 250 ml.`),
        el('div', { class: 'row nowrap' }, waterIn, el('span', { class: 'small muted' }, 'ml a day'),
          el('button', { class: 'btn small primary', type: 'button', onclick: () => { const v = num(waterIn.value); if (!v || v < 500 || v > 8000) { waterMsg.className = 'small msg err'; waterMsg.textContent = 'Enter 500 to 8000 ml.'; return; } saveWater(Math.round(v)); } }, 'Save'),
          water.byCoach ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => saveWater(null) }, 'Use the estimate') : null),
        waterMsg)));

  // Meal plan (PRO)
  const meals = C.d.meals ? clone(C.d.meals) : { client_id: C.current, plans: [], note: '' };
  const legacy = isLegacyMealPlan(meals.plans);
  const mealState = el('span', { class: 'save-state' });
  const saveMeals = debounce(async () => {
    try { await Data.upsert('coaching_meal_plans', { client_id: C.current, plans: meals.plans, note: meals.note || null, split: meals.split || null }); C.d.meals = meals; mealState.textContent = 'Saved, live'; mealState.className = 'save-state live'; }
    catch (e) { mealState.textContent = 'Not saved: ' + e.message; }
  }, 900);
  const mealChanged = () => { mealState.textContent = 'Saving…'; mealState.className = 'save-state'; saveMeals(); };
  const editorHost = el('div', {}, el('p', { class: 'muted' }, 'Loading foods…'));
  loadOwnFoods().then(() => editorHost.replaceChildren(mealPlanEditor(meals, planTarget, mealChanged, blockFor(c), { name: c.name, foods: C.d.athleteFoods || [] })));

  body.replaceChildren(el('div', { class: 'stack' },
    el('div', { class: 'row between' }, el('h2', {}, 'Meal plan'), mealState),
    c.tier !== 'pro' ? el('div', { class: 'notice warn' }, `${c.name} is on REGULAR, so they cannot see meal plans. Switch them to PRO in Settings to show these.`) : null,
    legacy ? el('div', { class: 'notice warn' }, 'This athlete had an older typed-in meal plan. It is replaced as soon as you add a food here.') : null,
    editorHost,
    waterCard,
    targetsCard,
    athleteSwaps()));
}

/* ---------- Settings ---------- */

function renderSettings(body) {
  const c = client();
  const saved = () => JSON.stringify({ name: c.name, tier: c.tier, active: !!c.active, start_date: c.start_date || '', allergies: [...(c.allergies || [])].sort(), avoid_foods: c.avoid_foods || '' });
  const name = el('input', { class: 'field', value: c.name });
  const startDate = el('input', { class: 'field', type: 'date', value: c.start_date || '' });
  const current = new Set(c.allergies || []);
  const boxes = ALLERGENS.map(([k, label]) => {
    const box = el('input', { type: 'checkbox', value: k, checked: current.has(k) });
    return { k, box, node: el('label', { class: 'allergen-chip' }, box, label) };
  });
  const avoid = el('input', { class: 'field', value: c.avoid_foods || '', placeholder: 'e.g. kiwi, mushrooms, pork' });
  const avoidChips = el('div', { class: 'allergen-chips' });

  // Coaching plan: two option cards instead of a dropdown, so it is clear what each one includes
  let tier = c.tier;
  const plans = [
    ['regular', 'REGULAR', ['Weekly training plan and logging', 'Calorie and macro targets', 'Progress, check-ins, water and steps']],
    ['pro', 'PRO', ['Everything in REGULAR', 'Personal meal plans with swaps', 'Shopping list, food lists and supplement texts']]
  ];
  const planBox = el('div', { class: 'plan-options', role: 'radiogroup', 'aria-label': 'Coaching plan' });
  const drawPlans = () => planBox.replaceChildren(...plans.map(([k, label, perks]) => el('button', {
    type: 'button', role: 'radio', 'aria-checked': String(tier === k), class: `plan-option${tier === k ? ' active' : ''}${k === 'pro' ? ' pro' : ''}`,
    onclick: () => { tier = k; drawPlans(); changed(); }
  }, el('div', { class: 'row between nowrap' }, el('b', {}, label), el('span', { class: 'plan-radio', 'aria-hidden': 'true' })),
    el('ul', {}, ...perks.map((p) => el('li', {}, p))))));
  drawPlans();

  // Access: a switch with a plain explanation of what it does
  const active = el('input', { type: 'checkbox', checked: !!c.active, role: 'switch' });
  const accessText = el('span', { class: 'small soft' });
  const drawAccess = () => { accessText.textContent = active.checked ? 'Can log in and save workouts, weigh-ins and check-ins.' : 'Cannot save anything any more. Their data stays, and you can switch them back on at any time.'; };
  drawAccess();

  // Save bar: shows whether anything changed, stays in view at the bottom while you scroll
  const state = el('span', { class: 'small muted' });
  const save = el('button', { class: 'btn primary', type: 'button' }, 'Save changes');
  const undo = el('button', { class: 'btn ghost', type: 'button', onclick: () => renderSettings(body) }, 'Discard');
  const values = () => ({ user_id: c.user_id, name: name.value.trim() || c.name, tier, active: active.checked, start_date: startDate.value || c.start_date,
    allergies: boxes.filter((b) => b.box.checked).map((b) => b.k), avoid_foods: avoid.value.trim() || null });
  function changed() {
    const v = values();
    const dirty = JSON.stringify({ name: v.name, tier: v.tier, active: v.active, start_date: v.start_date || '', allergies: [...v.allergies].sort(), avoid_foods: v.avoid_foods || '' }) !== saved();
    save.disabled = !dirty; undo.classList.toggle('hidden', !dirty);
    state.className = 'small ' + (dirty ? 'accent-warn' : 'muted');
    state.textContent = dirty ? 'Unsaved changes' : 'All changes saved';
    const words = avoid.value.split(',').map((w) => w.trim()).filter(Boolean);
    avoidChips.replaceChildren(...words.map((w) => el('span', { class: 'allergen-chip avoid' }, w)));
    allergyCount.textContent = v.allergies.length + words.length ? `${v.allergies.length + words.length} to avoid` : 'None';
    allergyCount.className = 'pill ' + (v.allergies.length + words.length ? 'bad' : '');
  }
  const allergyCount = el('span', { class: 'pill' });
  [name, startDate, avoid].forEach((i) => i.addEventListener('input', changed));
  boxes.forEach((b) => b.box.addEventListener('change', changed));
  active.addEventListener('change', () => { drawAccess(); changed(); });
  save.addEventListener('click', async () => {
    save.disabled = true; state.textContent = 'Saving…';
    const row = values();
    try { await Data.upsert('coaching_clients', row); Object.assign(c, row); toast('Settings saved'); render(); }
    catch (e) { state.className = 'small msg err'; state.textContent = 'Not saved: ' + e.message; save.disabled = false; }
  });

  const weeksIn = c.start_date ? Math.floor((parseDay(today()) - parseDay(c.start_date)) / (7 * 86400000)) + 1 : null;
  body.replaceChildren(el('div', { class: 'settings-grid' },
    el('div', { class: 'stack' },
      el('div', { class: 'card stack' }, cardHead('users', 'Athlete', weeksIn > 0 ? el('span', { class: 'small muted' }, `Week ${weeksIn} of coaching`) : null),
        el('div', { class: 'form-grid' }, el('label', { class: 'lab' }, 'Name', name), el('label', { class: 'lab' }, 'Coaching start', startDate))),
      el('div', { class: 'card stack' }, cardHead('clipboard', 'Coaching plan'), planBox),
      el('div', { class: 'card stack' }, cardHead('lock', 'Access'),
        el('label', { class: 'switch-row' }, active, el('span', { class: 'switch', 'aria-hidden': 'true' }),
          el('span', { class: 'grow' }, el('b', { style: 'display:block' }, 'Active'), accessText)))),
    el('div', { class: 'card stack' },
      cardHead('leaf', 'Allergies and foods to avoid', allergyCount),
      el('p', { class: 'small soft' }, 'Foods containing these are hidden from your food search and from every swap the athlete is offered. Meals that still contain one are flagged in the meal plan with a button to replace them.'),
      el('h3', {}, 'Allergens'),
      el('div', { class: 'allergen-chips' }, ...boxes.map((b) => b.node)),
      el('h3', { style: 'margin-top:4px' }, 'Other foods to avoid'),
      el('label', { class: 'lab' }, 'Words in the food name, separated by commas', avoid),
      avoidChips,
      el('p', { class: 'tiny muted' }, 'Allergens follow the 14 the EU requires on food labels. For your own foods, tick their allergens when you add them. Always double-check product labels.')),
    el('div', { class: 'save-bar' }, state, el('div', { class: 'grow' }), undo, save)));
  changed();
}

function addAthlete() {
  const email = el('input', { class: 'field', type: 'email', placeholder: 'their login email' });
  const name = el('input', { class: 'field', placeholder: 'First and last name' });
  const tier = el('select', { class: 'select field' }, el('option', { value: 'regular' }, 'REGULAR'), el('option', { value: 'pro' }, 'PRO'));
  const msg = el('p', { class: 'msg' });
  const go = el('button', { class: 'btn primary' }, 'Add athlete');
  const m = modal('Add an athlete',
    el('p', { class: 'small soft' }, `First the athlete creates an account at ${location.origin}/coaching.html (or you invite them from Supabase > Authentication > Users > Invite). Then enter the same email here.`),
    el('label', { class: 'lab' }, 'Email', email), el('label', { class: 'lab' }, 'Name', name), el('label', { class: 'lab' }, 'Plan', tier), go, msg);
  go.addEventListener('click', async () => {
    if (!email.value.includes('@') || !name.value.trim()) { msg.className = 'msg err'; msg.textContent = 'Enter an email and a name.'; return; }
    go.disabled = true;
    try {
      const id = await Data.rpc('coach_add_client', { p_email: email.value.trim(), p_name: name.value.trim(), p_tier: tier.value });
      C.clients = await Data.select('coaching_clients', {}, ['name']);
      m.close(); openAthlete(id);
    } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; go.disabled = false; }
  });
}

/* ---------- Dashboard ---------- */

async function renderDashboard(content) {
  const thisWeek = mondayOf(), nextWeek = addDays(thisWeek, 7);
  content.replaceChildren(el('h1', {}, 'Dashboard'), el('p', { class: 'muted', style: 'margin-top:10px' }, 'Loading…'));
  if (!C.clients.length) {
    content.replaceChildren(el('h1', {}, 'Dashboard'), el('div', { class: 'card stack', style: 'margin-top:16px' },
      el('p', { class: 'soft' }, 'No athletes yet.'), el('button', { class: 'btn primary', onclick: addAthlete }, '+ Add your first athlete')));
    return;
  }
  const rows = await Promise.all(C.clients.filter((c) => c.active).map(async (c) => {
    const id = { client_id: c.user_id };
    const [weeks, drafts, logs, daily, checkins, intake] = await Promise.all([Data.select('coaching_weeks', id), Data.select('coaching_drafts', id),
      Data.select('coaching_logs', id), Data.select('coaching_daily', id, ['day']), Data.select('coaching_checkins', id), Data.select('coaching_intake', id).catch(() => null)]);
    const week = weeks.find((w) => w.week_start === thisWeek);
    const total = week?.content.days?.length || 0;
    const done = logs.filter((l) => l.week_start === thisWeek && l.completed_at).length;
    const last = logs.filter((l) => l.completed_at).sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))[0];
    const lastWeigh = daily.filter((d) => num(d.weight)).pop();
    const next = weeks.find((w) => w.week_start === nextWeek) ? 'Published' : drafts.find((d) => d.week_start === nextWeek) ? 'Draft' : 'Not started';
    const notes = logs.filter((l) => l.note && l.week_start >= addDays(thisWeek, -7)).length;
    const lastCheck = checkins.sort((a, b) => (a.week_start < b.week_start ? 1 : -1))[0];
    const form = intake === null ? 'n/a' : intake[0]?.submitted_at ? 'sent' : intake[0] ? 'started' : 'none';
    return { c, total, done, week, last, lastWeigh, next, notes, lastCheck, form };
  }));
  const go = (c, tab = 'plan', week = thisWeek) => { C.tab = tab; C.week = week; openAthlete(c.user_id); };
  // One card per athlete: a ring for this week's workouts, then chips that open the right tab
  const chipBtn = (cls, onclick, ...kids) => el('button', { class: `chip ${cls}`, type: 'button', style: 'border:0;cursor:pointer;font:inherit;font-size:13px', onclick }, ...kids);
  const cards = rows.map((r) => {
    const allDone = r.week && r.total && r.done >= r.total;
    const weighDays = r.lastWeigh ? Math.round((parseDay(today()) - parseDay(r.lastWeigh.day)) / 86400000) : null;
    return el('div', { class: 'card athlete-card' },
      el('div', { class: 'top' },
        r.week ? progressRing(r.done, r.total, { size: 64, big: `${r.done}/${r.total}`, small: 'done', color: allDone ? 'var(--good)' : 'var(--kcal)' })
          : progressRing(0, 1, { size: 64, big: '–', small: 'no plan' }),
        el('div', { class: 'grow', style: 'min-width:0' },
          el('div', { class: 'row nowrap', style: 'gap:8px' }, el('span', { class: 'name' }, r.c.name), el('span', { class: 'pill ' + (r.c.tier === 'pro' ? 'pro' : '') }, r.c.tier.toUpperCase())),
          el('div', { class: 'small muted' }, r.week ? (r.last ? `Last workout ${niceDate(ymd(r.last.completed_at), { weekday: 'short', day: 'numeric', month: 'short' })}` : 'No workout done yet') : 'No plan published this week')),
        el('button', { class: 'btn icon-btn ghost', 'aria-label': `Open ${r.c.name}`, onclick: () => go(r.c) }, icon('right'))),
      el('div', { class: 'chips' },
        r.form === 'none' || r.form === 'started' ? chipBtn('warn', () => go(r.c, 'overview'), icon('clipboard', 14), r.form === 'none' ? ' Initial form not started' : ' Initial form in progress') : null,
        chipBtn(weighDays === null || weighDays > 3 ? 'warn' : '', () => go(r.c, 'progress'), icon('scale', 14), ' ',
          r.lastWeigh ? el('b', {}, `${fmt(num(r.lastWeigh.weight), 1)} kg`) : 'No weigh-in', r.lastWeigh ? ` · ${weighDays === 0 ? 'today' : weighDays === 1 ? 'yesterday' : niceDate(r.lastWeigh.day)}` : ''),
        chipBtn(r.lastCheck?.week_start === thisWeek ? 'good' : '', () => go(r.c, 'progress'), icon('clipboard', 14), ' Check-in ',
          el('b', {}, r.lastCheck ? (r.lastCheck.week_start === thisWeek ? 'this week' : niceDate(r.lastCheck.week_start)) : '–')),
        r.notes ? chipBtn('teal-chip', () => go(r.c), el('b', {}, String(r.notes)), ` note${r.notes > 1 ? 's' : ''}`) : null,
        chipBtn(r.next === 'Published' ? 'good' : r.next === 'Draft' ? 'warn' : '', () => go(r.c, 'plan', nextWeek), 'Next week ',
          el('b', {}, r.next === 'Published' ? 'published' : r.next === 'Draft' ? 'draft' : 'create'))));
  });
  content.replaceChildren(el('h1', {}, 'Dashboard'),
    el('p', { class: 'muted small', style: 'margin:6px 0 14px' }, `This week: ${weekRange(thisWeek)}`),
    el('div', { class: 'athlete-cards' }, ...cards));
}

/* ---------- Guide texts ---------- */

async function renderGuides(content) {
  const guides = await loadGuides();
  content.replaceChildren(el('h1', {}, 'Guide texts'),
    el('p', { class: 'soft small', style: 'margin:6px 0 16px' }, 'Shown to athletes in the app. "PRO only" hides a text from REGULAR athletes. Texts not saved here use the app\'s default wording.'),
    el('div', { class: 'stack' }, ...guides.map((g) => {
      const title = el('input', { class: 'field', style: 'font-weight:700', value: g.title });
      const text = el('textarea', { class: 'field', style: 'min-height:180px', value: g.body });
      const pro = el('input', { type: 'checkbox', checked: g.pro_only });
      const msg = el('span', { class: 'save-state' });
      const save = el('button', { class: 'btn primary small' }, 'Save');
      save.addEventListener('click', async () => {
        try { await Data.upsert('coaching_guides', { key: g.key, title: title.value, body: text.value, pro_only: pro.checked, sort: g.sort }); msg.textContent = 'Saved'; }
        catch (e) { msg.textContent = 'Not saved: ' + e.message; }
      });
      const def = DEFAULT_GUIDES.find((d) => d.key === g.key);
      const hint = g.key === 'exercise_library' ? el('p', { class: 'small muted' }, 'On the Training tab. One exercise per line: its name, then its YouTube link, for example "Pull ups - https://youtu.be/ZxJQwLQlR8A". Athletes tap a name to watch the video in the app.') : null;
      return el('div', { class: 'card stack' }, title, hint, text,
        el('div', { class: 'row' }, el('label', { class: 'row small' }, pro, 'PRO only'), el('div', { class: 'grow' }), msg,
          def ? el('button', { class: 'btn ghost small', onclick: async () => { if (confirm('Go back to the default text?')) { await Data.remove('coaching_guides', { key: g.key }); render(); } } }, 'Default text') : null, save));
    })));
}
