// Start menu, today's workout and the progress screen.
// Kept apart from the test tools so it can move to the member area later as it is.
// Loaded before challenge-test.js, whose globals (testState, draft, render...) it uses at run time.

// Training days of the week: Sunday is 0. Day 1 on Monday, Day 2 on Tuesday, Day 3 on Thursday, Day 4 on Saturday.
const TRAINING_DAYS = { 1: 1, 2: 2, 4: 3, 6: 4 };
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Rough height the body rises in one pull-up, for the "you climbed" fact
const PULL_UP_METRES = 0.6;

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function scheduleText() {
  return Object.keys(TRAINING_DAYS).map((weekday) => WEEKDAY_NAMES[weekday].slice(0, 3)).join(', ');
}

// The next workout not done yet this week
function nextWorkoutDay() {
  const done = (draft && draft.daysDone) || {};
  return [1, 2, 3, 4].find((day) => !done[day]) || 4;
}

function trainedToday() {
  const today = todayText();
  const lastLog = testState.logs[currentWeek() - 1];
  return [draft && draft.days, lastLog && lastLog.days].some((days) => days && Object.values(days).some((day) => day && day.date === today));
}

// What "Let's Workout" shows first: train now, or a rest day with the choice to train anyway
function todayStatus() {
  const weekday = new Date().getDay();
  const next = nextWorkoutDay();
  if (trainedToday()) return { rest: true, title: 'Today\'s workout is done', text: 'Recovery is part of the plan. Rest up and come back tomorrow.', next };
  if (!TRAINING_DAYS[weekday]) {
    let ahead = 1;
    while (!TRAINING_DAYS[(weekday + ahead) % 7]) ahead += 1;
    const when = ahead === 1 ? 'tomorrow' : WEEKDAY_NAMES[(weekday + ahead) % 7];
    return { rest: true, title: 'Rest day today', text: `Your next workout is ${when}. Resting lets your muscles adapt, but you can train today if your schedule needs it.`, next };
  }
  return { rest: false, next };
}

/* ---------- Start menu ---------- */

// First visit: testing is the only way in, everything else waits for the plan it creates
function firstTimeMenu() {
  const locked = (title, text) => `<button type="button" class="menu-option" disabled aria-disabled="true">
    <span class="menu-title">${esc(title)}</span>
    <span class="menu-text">${esc(text)}</span>
  </button>`;
  return `<div class="grid gap-4">
    <section class="card text-center">
      <div class="menu-week">Welcome</div>
      <p class="mt-1 text-gray-600">Your plan is built from your own test results. Test yourself first, and your workouts, calendar and progress unlock.</p>
    </section>
    <div class="menu-grid">
      <button type="button" class="menu-option menu-option-main" data-tab="test">
        <span class="menu-title">Start testing</span>
        <span class="menu-text">${TEST_FIELDS.length} short tests create your ${PLAN_WEEKS}-week plan</span>
      </button>
      ${locked('Let\'s Workout', 'Unlocks after testing')}
      ${locked('Workout Calendar', 'Unlocks after testing')}
      ${locked('Your Progress', 'Unlocks after testing')}
    </div>
  </div>`;
}

function homePanel(plan, weeks) {
  if (needsResults()) return firstTimeMenu();
  const week = currentWeek();
  const finished = week > PLAN_WEEKS;
  const status = finished ? null : todayStatus();
  const line = finished
    ? `All ${PLAN_WEEKS} weeks are done. Time to retest after 2 to 3 days off.`
    : status.rest ? `${status.title}. Next up: Day ${status.next}.` : `Today: Week ${week}, Day ${status.next}.`;
  const option = (tab, title, text) => `<button type="button" class="menu-option" data-tab="${tab}">
    <span class="menu-title">${esc(title)}</span>
    <span class="menu-text">${esc(text)}</span>
  </button>`;
  return `<div class="grid gap-4">
    <section class="card text-center">
      <div class="menu-week">${finished ? 'Plan complete' : `Week ${week} of ${PLAN_WEEKS}`}</div>
      <p class="mt-1 text-gray-600">${esc(line)}</p>
    </section>
    <div class="menu-grid">
      ${option('week', 'Let\'s Workout', finished ? 'See your last week' : 'Start today\'s workout')}
      ${option('plan', 'Workout Calendar', `Every week of your plan · training ${scheduleText()}`)}
      ${option('progress', 'Your Progress', 'Your reps, records and stats so far')}
    </div>
  </div>`;
}

// Shown above the day's workout when today is a rest day, until the athlete chooses to train anyway
function restNotice(status) {
  return `<section class="card text-center grid gap-3">
    <h3 class="text-xl font-bold">${esc(status.title)}</h3>
    <p class="text-gray-600">${esc(status.text)}</p>
    <button type="button" class="btn-primary player-button" data-action="train-anyway">Train anyway: Day ${status.next}</button>
  </section>`;
}

/* ---------- Progress ---------- */

// Every exercise logged on a day that was actually done: finished weeks, plus finished days of this week
function doneEntries(plan) {
  const entries = [];
  const add = (week, log, days) => plan.exercises.forEach((exercise) => {
    if (exercise.kind === 'fixed' || !log.ex[exercise.id] || !days.includes(exercise.day)) return;
    entries.push({ week, day: exercise.day, exercise, actual: log.ex[exercise.id].actual.map((n) => Number(n) || 0) });
  });
  Object.keys(testState.logs).forEach((key) => {
    const log = testState.logs[key];
    add(Number(key), log, log.daysDone ? [1, 2, 3, 4].filter((day) => log.daysDone[day]) : [1, 2, 3, 4]);
  });
  if (draft && draft.daysDone) add(draft.week, draft, [1, 2, 3, 4].filter((day) => draft.daysDone[day]));
  return entries;
}

const MOVEMENT_NAMES = { pull: 'Pull-ups', dip: 'Dips', push: 'Push-ups', chin: 'Chin-ups' };

// Reps by movement: a superset counts each side apart, so rows and neutral pull-ups get their own line
function movementTotals(entries) {
  const totals = {};
  const add = (name, n) => { totals[name] = (totals[name] || 0) + n; };
  entries.forEach(({ exercise, actual }) => {
    if (exercise.kind === 'superset') actual.forEach((n, i) => add(exercise.sides[i % 2], n));
    else add(MOVEMENT_NAMES[exercise.family] || exercise.name, repsTotal(actual));
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function workoutDays() {
  const list = [];
  const add = (week, days, done) => [1, 2, 3, 4].forEach((day) => {
    if (days && days[day] && (!done || done[day])) list.push(Object.assign({ week, day }, days[day]));
  });
  Object.keys(testState.logs).forEach((key) => add(Number(key), testState.logs[key].days, testState.logs[key].daysDone));
  if (draft) add(draft.week, draft.days, draft.daysDone || {});
  return list;
}

function statTile(value, label) {
  return `<div class="stat"><div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>`;
}

function progressPanel(plan) {
  const entries = doneEntries(plan);
  if (!entries.length) {
    return `<section class="card text-center grid gap-3">
      <h3 class="text-xl font-bold">Your progress starts with your first workout</h3>
      <p class="text-gray-600">Finish a workout and your reps, records and stats show up here.</p>
      <button type="button" class="btn-primary player-button" data-tab="week">Let's Workout</button>
    </section>`;
  }
  const days = workoutDays();
  const total = entries.reduce((sum, entry) => sum + repsTotal(entry.actual), 0);
  const minutes = days.reduce((sum, day) => sum + (day.minutes || 0), 0);
  const movements = movementTotals(entries);
  const climbing = movements.filter(([name]) => /pull-ups|chin-ups/i.test(name)).reduce((sum, [, n]) => sum + n, 0);

  // Reps per week, as bars
  const byWeek = {};
  entries.forEach((entry) => { byWeek[entry.week] = (byWeek[entry.week] || 0) + repsTotal(entry.actual); });
  const most = Math.max(...Object.values(byWeek));
  const bars = Object.keys(byWeek).map((week) => `<div class="bar-row">
    <span class="bar-name">Week ${week}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${(byWeek[week] / most) * 100}%"></span></span>
    <span class="bar-value">${byWeek[week]}</span>
  </div>`).join('');

  // Best first set on every submax exercise, against where it started
  let firstSetGain = 0;
  const records = plan.exercises.filter((exercise) => exercise.kind === 'straight').map((exercise) => {
    const best = Math.max(0, ...entries.filter((entry) => entry.exercise === exercise).map((entry) => entry.actual[0] || 0));
    const start = exercise.seq[0].reps[0];
    if (best > start) firstSetGain += best - start;
    return best ? `<li class="record-row"><span>${esc(exercise.name)}</span><span><strong>${best}</strong> <span class="plan-row-meta">started at ${start}</span></span></li>` : '';
  }).join('');

  // Most reps in one workout
  const perWorkout = {};
  entries.forEach((entry) => { const key = `Week ${entry.week}, Day ${entry.day}`; perWorkout[key] = (perWorkout[key] || 0) + repsTotal(entry.actual); });
  const [bestDay, bestDayReps] = Object.entries(perWorkout).sort((a, b) => b[1] - a[1])[0];

  const facts = [
    climbing ? `Your pull-ups lifted you about ${Math.round(climbing * PULL_UP_METRES)} metres, roughly ${Math.max(1, Math.round((climbing * PULL_UP_METRES) / 3))} floors of a building.` : '',
    `Your biggest workout so far: ${bestDayReps} reps in ${bestDay}.`,
    firstSetGain ? `Your first sets have grown by ${firstSetGain} reps in total since week 1.` : ''
  ].filter(Boolean);

  const recent = days.filter((day) => day.date).slice(-6).reverse().map((day) => {
    const reps = entries.filter((entry) => entry.week === day.week && entry.day === day.day).reduce((sum, entry) => sum + repsTotal(entry.actual), 0);
    return `<li class="record-row"><span>Week ${day.week}, Day ${day.day} <span class="plan-row-meta">· ${esc(day.date)}</span></span><span><strong>${reps}</strong> reps${day.effort ? ` · effort ${day.effort}/10` : ''}</span></li>`;
  }).join('');

  return `<div class="grid gap-4">
    <div class="stat-grid">
      ${statTile(String(days.length), days.length === 1 ? 'workout done' : 'workouts done')}
      ${statTile(total.toLocaleString(), 'total reps')}
      ${statTile(minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : '–', 'training time')}
      ${statTile(`${Math.min(currentWeek(), PLAN_WEEKS)}/${PLAN_WEEKS}`, 'current week')}
    </div>
    <section class="card">
      <h3 class="font-bold">Reps by exercise</h3>
      <ul class="record-list mt-2">${movements.map(([name, n]) => `<li class="record-row"><span>${esc(name)}</span><strong>${n.toLocaleString()}</strong></li>`).join('')}</ul>
    </section>
    <section class="card">
      <h3 class="font-bold">Reps per week</h3>
      <div class="grid gap-2 mt-3">${bars}</div>
    </section>
    ${records ? `<section class="card"><h3 class="font-bold">Best first sets</h3><ul class="record-list mt-2">${records}</ul></section>` : ''}
    <section class="card">
      <h3 class="font-bold">Did you know?</h3>
      <ul class="fact-list mt-2">${facts.map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul>
    </section>
    ${recent ? `<section class="card"><h3 class="font-bold">Recent workouts</h3><ul class="record-list mt-2">${recent}</ul></section>` : ''}
  </div>`;
}
