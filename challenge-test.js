const testApp = document.getElementById('test-app');
const TEST_STORAGE_KEY = 'challengeTestLevel1';

let testState = loadTestState();
// The week being logged is saved too, so a reload in the middle of a week keeps finished workouts
let draft = testState.draft || null;
let lastMessage = '';

function loadTestState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY));
    if (saved && (TEST_PLANS[saved.athlete] || saved.athlete === 'custom')) return Object.assign({ tab: 'week', logs: {} }, saved);
  } catch (error) { /* Storage can be blocked. The page still works until it is closed. */ }
  return { athlete: 'custom', results: null, logs: {}, tab: 'week' };
}

function needsResults() {
  return testState.athlete === 'custom' && (!testState.results || testState.editing);
}

function saveTestState() {
  testState.draft = draft;
  testState.player = player;
  try {
    localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(testState));
  } catch (error) { /* See loadTestState */ }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function activePlan() {
  if (testState.athlete !== 'custom') return preparePlan(testState.athlete);
  return testState.results ? buildPersonalPlan(testState.results) : preparePlan('medium');
}

function resultsForm() {
  const saved = testState.results || {};
  const fields = TEST_FIELDS.map((field) => {
    const id = 'result-' + field.key;
    const value = saved[field.key] === undefined ? '' : saved[field.key];
    return `<div>
      <label class="exercise-title block" for="${id}">${esc(field.label)}</label>
      <div class="stepper mt-2">
        <button type="button" class="step" data-result="${field.key}" data-change="-1" aria-label="One less, ${esc(field.label)}">&minus;</button>
        <input id="${id}" class="set-input" type="number" min="0" inputmode="numeric" value="${value}">
        <button type="button" class="step" data-result="${field.key}" data-change="1" aria-label="One more, ${esc(field.label)}">+</button>
      </div>
    </div>`;
  }).join('');
  return `<section class="card grid gap-5">
    <div>
      <h2 class="text-2xl font-bold">Enter test results</h2>
      <p class="text-gray-600 mt-2">Your 12-week plan is built from these 7 results. Enter 0 for muscle-ups if you can't do one yet.</p>
    </div>
    <div class="result-grid">${fields}</div>
    <p id="results-error" class="target" role="alert" hidden></p>
    <button type="button" class="btn-primary" data-action="create">${testState.results ? 'Update my plan' : 'Create my plan'}</button>
    ${testState.results ? '<p class="text-sm text-gray-600">Updating your results starts the plan again from week 1.</p><button type="button" class="btn-outline" data-action="cancel-edit">Keep my current plan</button>' : ''}
  </section>`;
}

function createPlanFromForm() {
  const results = {};
  const missing = TEST_FIELDS.some((field) => {
    const raw = document.getElementById('result-' + field.key).value;
    results[field.key] = Number(raw);
    return raw === '' || !Number.isFinite(results[field.key]) || results[field.key] < 0;
  });
  if (missing) {
    const error = document.getElementById('results-error');
    error.textContent = 'Enter a number for all 7 results.';
    error.hidden = false;
    return;
  }
  testState.results = results;
  testState.editing = false;
  testState.logs = {};
  testState.tab = 'week';
  draft = null;
  player = null;
  lastMessage = 'Your plan is ready. Start with week 1, Day 1.';
  saveTestState();
  window.scrollTo({ top: 0 });
  render();
}

function resultsSummary() {
  if (testState.athlete !== 'custom' || !testState.results) return '';
  const summary = TEST_FIELDS.map((field) => `${field.label}: ${testState.results[field.key]}`).join(' · ');
  const notes = resultNotes(testState.results).map((note) => `<p class="target mt-2">${esc(note)}</p>`).join('');
  return `<section class="card">
    <h2 class="font-semibold">Your test results</h2>
    <p class="text-sm text-gray-600 mt-1">${esc(summary)}</p>
    ${notes}
    <button type="button" class="btn-outline mt-3" data-action="edit-results">Change my results</button>
  </section>`;
}

function currentWeek() {
  return Object.keys(testState.logs).length + 1;
}

function makeDraft(plan, weeks) {
  const week = currentWeek();
  if (week > 12) return null;
  const targets = weeks[week - 1].targets;
  const next = { week, activeDay: 1, days: {}, daysDone: {}, ex: {} };
  [1, 2, 3, 4].forEach((day) => { next.days[day] = defaultDay(); });
  plan.exercises.forEach((exercise) => {
    if (exercise.kind === 'fixed') return;
    next.ex[exercise.id] = { actual: fillActual(exercise, targets[exercise.id], week, 'hit'), tooEasy: false };
  });
  return next;
}

function checkinButtons(day, key, label, max) {
  const value = draft.days[day][key];
  let buttons = '';
  for (let n = 1; n <= max; n += 1) {
    buttons += `<button type="button" class="checkin-button${n === value ? ' active' : ''}" aria-pressed="${n === value}" data-checkin="${key}" data-day="${day}" data-value="${n}">${n}</button>`;
  }
  return `<div role="group" aria-label="${label}">
    <div class="checkin-label">${label}</div>
    <div class="checkin-row">${buttons}</div>
  </div>`;
}

function setLabel(exercise, i) {
  if (exercise.kind === 'superset') return `${exercise.sides[i % 2]} ${Math.floor(i / 2) + 1}`;
  return `${exercise.kind === 'emom' || exercise.kind === 'circuit' || exercise.roundLabel ? 'Round' : 'Set'} ${i + 1}`;
}

function setInputs(exercise) {
  return draft.ex[exercise.id].actual.map((value, i) => {
    const label = setLabel(exercise, i);
    const data = `data-ex="${exercise.id}" data-set="${i}"`;
    return `<div>
      <label class="set-label" for="${exercise.id}-${i}">${label}</label>
      <div class="stepper">
        <button type="button" class="step" data-step="-1" ${data} aria-label="One rep less, ${label}">&minus;</button>
        <input id="${exercise.id}-${i}" class="set-input" type="number" min="0" inputmode="numeric" value="${value}" ${data}>
        <button type="button" class="step" data-step="1" ${data} aria-label="One rep more, ${label}">+</button>
      </div>
    </div>`;
  }).join('');
}

function exerciseCard(exercise, target) {
  const rest = target && target.rest ? target.rest + ' between exercises' : exercise.rest;
  const meta = [rest && 'Rest: ' + rest, exercise.tempo && 'Tempo: ' + exercise.tempo, target && exercise.kind !== 'band' ? target.load : exercise.load].filter(Boolean).join(' · ');
  if (exercise.kind === 'fixed') {
    return `<div class="exercise exercise-unchanged text-center">
      <div class="exercise-title">${esc(exercise.name)}</div>
      <div class="target mt-1">${esc(exercise.text)}</div>
      <div class="exercise-info mt-1">${esc(meta)}</div>
      <div class="text-sm text-gray-700 mt-1">Stays the same each week</div>
    </div>`;
  }
  const entry = draft.ex[exercise.id];
  const tag = target.lighter ? '<span class="tag tag-lighter">Lighter</span>' : target.rebuilt ? '<span class="tag tag-rebuilt">Rebuilt</span>' : '';
  const hint = exercise.kind === 'band' ? '3 sets of 3 reps moves you to the next band.'
    : exercise.kind === 'straight' && currentWeek() > 1 ? 'Go past the first-set target if you feel strong.'
    : '';
  return `<div class="exercise">
    <div class="exercise-head">
      <div class="flex flex-wrap items-center justify-center gap-2"><span class="exercise-title">${esc(exercise.name)}</span>${tag}</div>
      <div class="target mt-1">Target: ${esc(shortTarget(exercise, target))}</div>
      <div class="exercise-info mt-1">${esc(meta)}</div>
      ${hint ? `<div class="text-sm text-gray-700 mt-1">${esc(hint)}</div>` : ''}
    </div>
    <div class="set-grid mt-3">${setInputs(exercise)}</div>
    <label class="easy-row mt-3">
      <input id="${exercise.id}-easy" type="checkbox" class="easy-box" data-ex="${exercise.id}"${entry.tooEasy ? ' checked' : ''}> This was too easy
    </label>
  </div>`;
}

// The day's whole workout at a glance, before starting the guided workout
function weekPanel(plan, weeks) {
  const week = currentWeek();
  if (week > 12 || testState.manual) return manualPanel(plan, weeks);
  const targets = weeks[week - 1].targets;
  const day = draft.activeDay;
  const done = draft.daysDone || {};
  const list = plan.exercises.filter((exercise) => exercise.day === day);
  const circuit = list.every((exercise) => exercise.kind === 'circuit');
  const paused = player && player.paused && player.day === day && player.week === week;
  const rows = list.map((exercise) => {
    const target = targets[exercise.id];
    let goal = exercise.kind === 'fixed' ? exercise.stepText : shortTarget(exercise, target);
    if (exercise.kind === 'band') goal = `1 to 3 reps, ${target.load}`;
    if (exercise.kind === 'superset') {
      const reps = target.reps;
      goal = `${reps[0]} + ${reps[1]} down to ${reps[reps.length - 2]} + ${reps[reps.length - 1]}`;
    }
    if (exercise.kind === 'circuit') goal = target.reps.join(', ');
    const sets = workoutSetCount(exercise, target, week);
    const word = circuit || exercise.kind === 'emom' || exercise.roundLabel ? 'rounds' : 'sets';
    const rest = restWindow(exercise.rest);
    const restPart = rest.every ? `one round ${restText(rest)}` : `rest ${restText(rest)}`;
    const meta = circuit ? `${sets} rounds` : `${sets} ${word} · ${restPart}`;
    return `<li class="plan-row">
      <span class="plan-row-name">${esc(exercise.name)}</span>
      <span class="plan-row-target">${esc(goal)}</span>
      <span class="plan-row-meta">${esc(meta)}${exercise.tempo ? ' · tempo 0-1-3' : ''}</span>
    </li>`;
  }).join('');
  const circuitNote = circuit
    ? `<p class="plan-row-meta">Circuit: 1 set of each exercise in order, then 90 sec rest. Rest between exercises: ${esc(restText(restWindow(targets[list[0].id].rest)))}.</p>`
    : '';
  let action = `<button type="button" class="btn-primary player-button" data-workout="start" data-day="${day}">Start workout</button>`;
  if (paused) action = `<button type="button" class="btn-primary player-button" data-workout="resume">Resume workout</button>`;
  else if (done[day]) action = `<p class="done-note">Day ${day} is done.</p>`;
  const someDone = [1, 2, 3, 4].some((n) => done[n]);
  return `<div class="grid gap-3">
    <div class="day-tabs" role="group" aria-label="Choose a workout">
      ${[1, 2, 3, 4].map((n) => `<button type="button" class="day-tab${n === day ? ' active' : ''}" aria-pressed="${n === day}" data-day-tab="${n}">Day ${n}${done[n] ? ' ✓' : ''}</button>`).join('')}
    </div>
    <section class="card grid gap-3">
      <h3 class="text-xl font-bold">Week ${week}, Day ${day}${week === 1 ? ' · adaptation week' : ''}</h3>
      ${circuitNote}
      <ol class="plan-list">${rows}</ol>
      ${action}
    </section>
    <div class="small-actions">
      <button type="button" class="link-button" data-action="manual">Change reps without the timer</button>
      ${someDone ? `<button type="button" class="link-button" data-action="finish">Finish week ${week} now</button>` : ''}
      ${week > 1 ? '<button type="button" class="link-button" data-action="undo">Undo last week</button>' : ''}
    </div>
  </div>`;
}

// The full form with every set on one page, for corrections or logging after training
function manualPanel(plan, weeks) {
  const week = currentWeek();
  if (week > 12) {
    return `<div class="card text-center">
      <h2 class="text-2xl font-bold">All 12 weeks are logged</h2>
      <p class="text-gray-600 mt-2">In week 13, athletes get a reminder to retest after 2 to 3 days off. Open Whole plan to see how the program changed.</p>
      <button type="button" class="btn-outline mt-4" data-action="undo">Undo last week</button>
    </div>`;
  }
  const targets = weeks[week - 1].targets;
  const day = draft.activeDay;
  return `<div class="grid gap-4">
    <button type="button" class="btn-outline" data-action="overview">Back to the workout view</button>
    <p class="text-sm text-gray-600">${week > 1 ? '' : 'Week 1 is the adaptation week. '}Reps start filled in with the target. Change any set where you did something different.</p>
    <div class="day-tabs" role="group" aria-label="Choose a workout">
      ${[1, 2, 3, 4].map((n) => `<button type="button" class="day-tab${n === day ? ' active' : ''}" aria-pressed="${n === day}" data-day-tab="${n}">Day ${n}</button>`).join('')}
    </div>
    <section class="card grid gap-4">
      <h3 class="text-xl font-bold">Week ${week}, Day ${day}</h3>
      ${checkinButtons(day, 'energy', 'Energy today: 1 very low, 5 very high', 5)}
      ${checkinButtons(day, 'sleep', 'Sleep last night: 1 very badly, 5 very well', 5)}
      ${day === 4 ? '<p class="exercise-info">Circuit: do 1 set of each exercise from first to last, then rest 90 seconds. Repeat for every round. Each round number below is one trip through the circuit.</p>' : ''}
      <div class="exercise-list">
        ${plan.exercises.filter((exercise) => exercise.day === day).map((exercise) => exerciseCard(exercise, targets[exercise.id])).join('')}
      </div>
      ${checkinButtons(day, 'effort', 'How hard was this session? 1 very easy, 10 maximum', 10)}
    </section>
    <div class="action-row">
      ${day < 4 ? `<button type="button" class="btn-primary" data-day-tab="${day + 1}">Next: Day ${day + 1}</button>` : ''}
      <button type="button" class="${day === 4 ? 'btn-primary' : 'btn-outline'}" data-action="finish">Finish week ${week}</button>
      ${week > 1 ? '<button type="button" class="btn-outline" data-action="undo">Undo last week</button>' : ''}
    </div>
  </div>`;
}

function planPanel(plan, weeks, baseline) {
  const header = weeks.map((item) => `<th class="${item.done ? 'done-week' : ''}">W${item.week}</th>`).join('');
  let lastDay = 0;
  const rows = plan.exercises.filter((exercise) => exercise.kind !== 'fixed').map((exercise) => {
    let dayRow = '';
    if (exercise.day !== lastDay) {
      lastDay = exercise.day;
      dayRow = `<tr class="day-row"><th colspan="13"><span class="day-label">Day ${exercise.day}</span></th></tr>`;
    }
    const cells = weeks.map((item, i) => {
      const adapted = shortTarget(exercise, item.targets[exercise.id]);
      const planned = shortTarget(exercise, baseline[i].targets[exercise.id]);
      const status = item.done ? item.results[exercise.id].status : '';
      const changed = adapted !== planned;
      return `<td class="cell ${status ? 'status-' + status : ''} ${changed ? 'changed' : ''}">
        <div>${esc(adapted)}</div>${changed ? `<div class="planned">Plan: ${esc(planned)}</div>` : ''}
      </td>`;
    }).join('');
    return `${dayRow}<tr><th class="exercise-name">${esc(exercise.name)}</th>${cells}</tr>`;
  }).join('');

  const totalRow = (label, key) => {
    const cells = weeks.map((item, i) => {
      const value = item.totals[key];
      const planned = baseline[i].totals[key];
      return `<td class="cell ${value !== planned ? 'changed' : ''}"><div>${value}</div>${value !== planned ? `<div class="planned">Plan: ${planned}</div>` : ''}</td>`;
    }).join('');
    return `<tr><th class="exercise-name">${label}</th>${cells}</tr>`;
  };

  return `<div class="grid gap-5">
    <div class="legend text-sm">
      <span><i class="swatch status-hit"></i>Hit</span>
      <span><i class="swatch status-close"></i>Close miss</span>
      <span><i class="swatch status-big"></i>Big miss</span>
      <span><i class="swatch status-low"></i>Low energy or sleep</span>
      <span><i class="swatch changed"></i>Different from the original plan</span>
    </div>
    <div class="card card-flush">
      <h3 class="text-xl font-bold px-5 pt-5">Weekly reps</h3>
      <div class="table-wrap"><table class="plan-table"><thead><tr><th class="exercise-name">Total</th>${header}</tr></thead>
        <tbody>${totalRow('Pull-ups', 'pull')}${totalRow('Chin-ups', 'chin')}${totalRow('Dips', 'dip')}${totalRow('Push-ups', 'push')}</tbody></table></div>
    </div>
    <div class="card card-flush">
      <h3 class="text-xl font-bold px-5 pt-5">Targets by week</h3>
      <div class="table-wrap"><table class="plan-table"><thead><tr><th class="exercise-name">Exercise</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <p class="text-sm text-gray-600">Swipe the tables sideways to see all 12 weeks. Weeks not logged yet assume every target is hit. The split squat superset stays the same, so it is left out.</p>
  </div>`;
}

function weekChanges(plan, item) {
  return plan.exercises.filter((exercise) => exercise.kind !== 'fixed' && item.results[exercise.id].notable);
}

function whyPanel(plan, weeks) {
  const done = weeks.filter((item) => item.done).reverse();
  const groups = done.map((item) => {
    const changes = weekChanges(plan, item);
    if (!changes.length) return '';
    const next = weeks[item.week];
    return `<section class="card">
      <h3 class="text-xl font-bold">After week ${item.week}</h3>
      <div class="grid gap-3 mt-3">
        ${changes.map((exercise) => {
          const result = item.results[exercise.id];
          return `<div class="why status-border-${result.status}">
            <div class="font-semibold">${esc(exercise.name)}</div>
            <div class="text-sm text-gray-600">${esc(result.text)}</div>
            ${next ? `<div class="text-sm mt-1">Next week: <strong>${esc(shortTarget(exercise, next.targets[exercise.id]))}</strong></div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }).join('');
  return groups
    ? `<div class="grid gap-5">${groups}</div>`
    : '<div class="card text-gray-600">Nothing has changed from the original plan yet. Log a missed target or tick "too easy", or run a test athlete above.</div>';
}

function render() {
  if (player && !player.paused) {
    if (player.week === currentWeek() && draft && draft.week === player.week) {
      renderPlayer();
      return;
    }
    player = null;
  }
  const plan = activePlan();
  const showForm = needsResults();
  document.documentElement.classList.toggle('has-plan', !showForm);
  const weeks = runPlan(plan, testState.logs);
  const baseline = runPlan(plan, {});
  const week = currentWeek();
  if (!showForm && (!draft || draft.week !== week)) draft = makeDraft(plan, weeks);
  const tabs = [['week', week > 12 ? 'Finished' : `Log week ${week}`], ['plan', 'Whole plan'], ['why', 'Why it changed']];
  const panel = showForm ? resultsForm()
    : testState.tab === 'plan' ? planPanel(plan, weeks, baseline)
    : testState.tab === 'why' ? whyPanel(plan, weeks)
    : weekPanel(plan, weeks);
  const athletes = [['custom', 'Enter test results', 'Build a plan from 7 test results']]
    .concat(Object.keys(TEST_PLANS).map((key) => [key, TEST_PLANS[key].label, TEST_PLANS[key].description]));

  testApp.innerHTML = `<div class="grid gap-5">
    <details id="test-tools" class="card"${testState.toolsOpen ? ' open' : ''}${location.hash === '#tools' ? '' : ' hidden'}>
      <summary class="tools-summary">Test tools${showForm ? '' : ': ' + esc(plan.label)}</summary>
      <div class="grid gap-3 mt-3">
        <h2 class="font-semibold">Test athlete</h2>
        <div class="scenario-grid">
          ${athletes.map(([key, label, description]) => `<button type="button" class="scenario${key === testState.athlete ? ' active' : ''}" aria-pressed="${key === testState.athlete}" data-athlete="${key}">
            <span class="font-semibold block">${esc(label)}</span>
            <span class="text-sm text-gray-600 block mt-1">${esc(description)}</span>
          </button>`).join('')}
        </div>
        ${showForm ? '' : `<h2 class="font-semibold mt-2">Run all 12 weeks as</h2>
        <div class="scenario-grid">
          ${TEST_SCENARIOS.map((scenario) => `<button type="button" class="scenario" data-scenario="${scenario.id}">
            <span class="font-semibold block">${esc(scenario.label)}</span>
            <span class="text-sm text-gray-600 block mt-1">${esc(scenario.description)}</span>
          </button>`).join('')}
        </div>
        <button type="button" class="btn-outline mt-2" data-action="reset">Start over</button>`}
      </div>
    </details>
    ${lastMessage ? `<div class="message" role="status">${esc(lastMessage)}</div>` : ''}
    ${showForm || testState.tab !== 'plan' ? '' : resultsSummary()}
    ${showForm ? '' : `<div class="tab-row" role="tablist">
      ${tabs.map(([key, label]) => `<button type="button" role="tab" aria-selected="${key === testState.tab}" class="tab${key === testState.tab ? ' active' : ''}" data-tab="${key}">${esc(label)}</button>`).join('')}
    </div>`}
    ${panel}
  </div>`;
}

function finishWeek() {
  const plan = activePlan();
  const week = currentWeek();
  const log = { days: draft.days, ex: {} };
  Object.keys(draft.ex).forEach((id) => {
    log.ex[id] = { actual: draft.ex[id].actual.map((n) => Number(n) || 0), tooEasy: draft.ex[id].tooEasy };
  });
  testState.logs[week] = log;
  testState.manual = false;
  player = null;
  saveTestState();
  const item = runPlan(plan, testState.logs)[week - 1];
  const count = weekChanges(plan, item).length;
  lastMessage = count
    ? `Week ${week} logged. ${count} ${count === 1 ? 'exercise changes' : 'exercises change'} because of it. Open Why it changed to see the reasons.`
    : `Week ${week} logged. Everything stays on plan.`;
  window.scrollTo({ top: 0 });
  render();
}

testApp.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (handleWorkoutClick(target)) return;
  const plan = activePlan();

  if (target.dataset.action === 'manual' || target.dataset.action === 'overview') {
    testState.manual = target.dataset.action === 'manual';
    lastMessage = '';
    saveTestState();
    render();
    window.scrollTo({ top: 0 });
  } else if (target.dataset.result) {
    const field = document.getElementById('result-' + target.dataset.result);
    field.value = Math.max(0, (Number(field.value) || 0) + Number(target.dataset.change));
  } else if (target.dataset.action === 'create') {
    createPlanFromForm();
  } else if (target.dataset.action === 'edit-results') {
    testState.editing = true;
    lastMessage = '';
    render();
    window.scrollTo({ top: 0 });
  } else if (target.dataset.action === 'cancel-edit') {
    testState.editing = false;
    render();
  } else if (target.dataset.tab) {
    testState.tab = target.dataset.tab;
    lastMessage = '';
    saveTestState();
    render();
  } else if (target.dataset.dayTab) {
    draft.activeDay = Number(target.dataset.dayTab);
    lastMessage = '';
    saveTestState();
    render();
    document.querySelector('.day-tabs').scrollIntoView({ block: 'start' });
  } else if (target.dataset.step) {
    const entry = draft.ex[target.dataset.ex];
    const set = Number(target.dataset.set);
    entry.actual[set] = Math.max(0, (Number(entry.actual[set]) || 0) + Number(target.dataset.step));
    document.getElementById(`${target.dataset.ex}-${set}`).value = entry.actual[set];
  } else if (target.dataset.checkin) {
    draft.days[target.dataset.day][target.dataset.checkin] = Number(target.dataset.value);
    target.parentElement.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button === target);
      button.setAttribute('aria-pressed', button === target);
    });
  } else if (target.dataset.athlete) {
    testState.athlete = target.dataset.athlete;
    testState.results = null;
    testState.editing = false;
    testState.logs = {};
    testState.tab = 'week';
    draft = null;
    player = null;
    lastMessage = '';
    saveTestState();
    render();
  } else if (target.dataset.scenario) {
    const scenario = TEST_SCENARIOS.find((item) => item.id === target.dataset.scenario);
    testState.logs = scenarioLogs(plan, scenario);
    testState.tab = 'plan';
    testState.toolsOpen = false;
    lastMessage = `${scenario.label}: all 12 weeks are filled in. ${scenario.description}`;
    saveTestState();
    render();
  } else if (target.dataset.action === 'finish') {
    finishWeek();
  } else if (target.dataset.action === 'undo') {
    delete testState.logs[currentWeek() - 1];
    testState.tab = 'week';
    lastMessage = 'Last week removed. You can log it again.';
    saveTestState();
    render();
  } else if (target.dataset.action === 'reset') {
    testState.logs = {};
    testState.tab = 'week';
    lastMessage = '';
    draft = null;
    player = null;
    saveTestState();
    render();
  }
});

testApp.addEventListener('change', (event) => {
  const field = event.target;
  // The test results form has no draft yet; its numbers are read when the plan is created
  if (!field.dataset.ex || !draft) return;
  if (field.classList.contains('set-input')) {
    draft.ex[field.dataset.ex].actual[Number(field.dataset.set)] = Number(field.value) || 0;
  } else if (field.classList.contains('easy-box')) {
    draft.ex[field.dataset.ex].tooEasy = field.checked;
  }
});

const themeToggle = document.getElementById('theme-toggle');

function showThemeLabel() {
  themeToggle.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  showThemeLabel();
  try {
    localStorage.setItem('challengeTheme', theme);
  } catch (error) { /* See loadTestState */ }
});

showThemeLabel();

// The toggle event does not bubble, so it is caught on the way down
testApp.addEventListener('toggle', (event) => {
  if (event.target.id !== 'test-tools') return;
  testState.toolsOpen = event.target.open;
  saveTestState();
}, true);

player = testState.player || null;
render();
