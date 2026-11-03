const testApp = document.getElementById('test-app');
const TEST_STORAGE_KEY = 'challengeTest';

let testState = loadTestState();
let draft = null;
let lastMessage = '';

function loadTestState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY));
    if (saved && TEST_PLANS[saved.athlete]) return Object.assign({ tab: 'week', logs: {} }, saved);
  } catch (error) { /* Storage can be blocked. The page still works until it is closed. */ }
  return { athlete: 'low', logs: {}, tab: 'week' };
}

function saveTestState() {
  try {
    localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(testState));
  } catch (error) { /* See loadTestState */ }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function activePlan() {
  return preparePlan(testState.athlete);
}

function currentWeek() {
  return Object.keys(testState.logs).length + 1;
}

function makeDraft(plan, weeks) {
  const week = currentWeek();
  if (week > 12) return null;
  const targets = weeks[week - 1].targets;
  const next = { week, days: {}, ex: {} };
  [1, 2, 3, 4].forEach((day) => { next.days[day] = defaultDay(); });
  plan.exercises.forEach((exercise) => {
    if (exercise.kind === 'fixed') return;
    next.ex[exercise.id] = { actual: fillActual(exercise, targets[exercise.id], week, 'hit'), tooEasy: false, type: 'hit' };
  });
  return next;
}

function checkinSelect(day, key, label, min, max) {
  const value = draft.days[day][key];
  let options = '';
  for (let n = min; n <= max; n += 1) options += `<option value="${n}"${n === value ? ' selected' : ''}>${n}</option>`;
  return `<label class="text-sm text-gray-600">${label}
    <select id="d${day}-${key}" class="checkin block mt-1" data-day="${day}" data-key="${key}">${options}</select>
  </label>`;
}

function setInputs(exercise) {
  const entry = draft.ex[exercise.id];
  if (exercise.kind === 'superset') {
    return entry.actual.map((value, i) => `<label class="set-label">${i % 2 ? 'Rows' : 'Push'} ${Math.floor(i / 2) + 1}
      <input id="${exercise.id}-${i}" class="set-input" type="number" min="0" inputmode="numeric" value="${value}" data-ex="${exercise.id}" data-set="${i}">
    </label>`).join('');
  }
  return entry.actual.map((value, i) => `<label class="set-label">${exercise.kind === 'emom' ? 'Round' : 'Set'} ${i + 1}
    <input id="${exercise.id}-${i}" class="set-input" type="number" min="0" inputmode="numeric" value="${value}" data-ex="${exercise.id}" data-set="${i}">
  </label>`).join('');
}

function exerciseCard(exercise, target) {
  const meta = [exercise.rest && 'Rest: ' + exercise.rest, exercise.tempo && 'Tempo: ' + exercise.tempo, (target ? target.load : exercise.load)].filter(Boolean).join(' · ');
  if (exercise.kind === 'fixed') {
    return `<div class="exercise exercise-unchanged">
      <div class="font-semibold">${esc(exercise.name)}</div>
      <div class="text-sm text-gray-600 mt-1">${esc(exercise.text)}</div>
      <div class="text-xs text-gray-500 mt-1">${esc(meta)} · Stays the same each week</div>
    </div>`;
  }
  const entry = draft.ex[exercise.id];
  const tag = target.lighter ? '<span class="tag tag-lighter">Lighter</span>' : target.rebuilt ? '<span class="tag tag-rebuilt">Rebuilt</span>' : '';
  const button = (type, label) => `<button type="button" class="quick${entry.type === type ? ' active' : ''}" data-quick="${type}" data-ex="${exercise.id}">${label}</button>`;
  return `<div class="exercise">
    <div class="flex flex-wrap items-center gap-2"><span class="font-semibold">${esc(exercise.name)}</span>${tag}</div>
    <div class="target mt-1">Target: ${esc(shortTarget(exercise, target))}</div>
    <div class="text-xs text-gray-500 mt-1">${esc(meta)}</div>
    <div class="flex flex-wrap gap-2 mt-3">
      ${button('hit', 'Hit target')}${button('close', 'Close miss')}${button('big', 'Big miss')}
    </div>
    <div class="flex flex-wrap gap-2 mt-3">${setInputs(exercise)}</div>
    <label class="flex items-center gap-2 mt-3 text-sm">
      <input id="${exercise.id}-easy" type="checkbox" class="easy-box" data-ex="${exercise.id}"${entry.tooEasy ? ' checked' : ''}> This was too easy
    </label>
  </div>`;
}

function weekPanel(plan, weeks) {
  const week = currentWeek();
  if (week > 12) {
    return `<div class="card text-center">
      <h2 class="text-2xl font-bold">All 12 weeks are logged</h2>
      <p class="text-gray-600 mt-2">In week 13, athletes get a reminder to retest. Open Whole plan to see how the program changed.</p>
      <button type="button" class="btn-outline mt-4" data-action="undo">Undo last week</button>
    </div>`;
  }
  const targets = weeks[week - 1].targets;
  const days = [1, 2, 3, 4].map((day) => `<section class="card">
    <h3 class="text-xl font-bold">Day ${day}</h3>
    <div class="flex flex-wrap gap-4 mt-3">
      ${checkinSelect(day, 'energy', 'Energy (1-5)', 1, 5)}
      ${checkinSelect(day, 'sleep', 'Sleep (1-5)', 1, 5)}
      ${checkinSelect(day, 'effort', 'Session effort (1-10)', 1, 10)}
    </div>
    <div class="exercise-list mt-4">
      ${plan.exercises.filter((exercise) => exercise.day === day).map((exercise) => exerciseCard(exercise, targets[exercise.id])).join('')}
    </div>
  </section>`).join('');
  return `<div class="grid gap-5">
    ${week > 1 ? '' : '<p class="text-sm text-gray-600">Week 1 is the adaptation week. Everything starts filled in as "hit". Change only what you want to test, then finish the week.</p>'}
    ${days}
    <div class="flex flex-wrap gap-3">
      <button type="button" class="btn-primary" data-action="finish">Finish week ${week}</button>
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
      dayRow = `<tr class="day-row"><th colspan="13">Day ${exercise.day}</th></tr>`;
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
        <tbody>${totalRow('Pull-ups', 'pull')}${totalRow('Dips', 'dip')}${totalRow('Push-ups', 'push')}</tbody></table></div>
    </div>
    <div class="card card-flush">
      <h3 class="text-xl font-bold px-5 pt-5">Targets by week</h3>
      <div class="table-wrap"><table class="plan-table"><thead><tr><th class="exercise-name">Exercise</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <p class="text-sm text-gray-600">Weeks not logged yet assume every target is hit. Legs, knee raises and tricep extensions stay the same, so they are left out.</p>
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
  const plan = activePlan();
  const weeks = runPlan(plan, testState.logs);
  const baseline = runPlan(plan, {});
  const week = currentWeek();
  if (!draft || draft.week !== week) draft = makeDraft(plan, weeks);
  const tabs = [['week', week > 12 ? 'Finished' : `Log week ${week}`], ['plan', 'Whole plan'], ['why', 'Why it changed']];
  const panel = testState.tab === 'plan' ? planPanel(plan, weeks, baseline)
    : testState.tab === 'why' ? whyPanel(plan, weeks)
    : weekPanel(plan, weeks);

  testApp.innerHTML = `<div class="grid gap-5">
    <section class="card">
      <div class="flex flex-wrap gap-4 items-end justify-between">
        <label class="font-medium">Test athlete
          <select id="athlete" class="field-select block mt-2">
            ${Object.keys(TEST_PLANS).map((key) => `<option value="${key}"${key === testState.athlete ? ' selected' : ''}>${esc(TEST_PLANS[key].label)}: ${esc(TEST_PLANS[key].description)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="btn-outline" data-action="reset">Start over</button>
      </div>
      <h2 class="font-semibold mt-5">Run all 12 weeks as</h2>
      <div class="scenario-grid mt-2">
        ${TEST_SCENARIOS.map((scenario) => `<button type="button" class="scenario" data-scenario="${scenario.id}">
          <span class="font-semibold block">${esc(scenario.label)}</span>
          <span class="text-xs text-gray-600 block mt-1">${esc(scenario.description)}</span>
        </button>`).join('')}
      </div>
    </section>
    ${lastMessage ? `<div class="message" role="status">${esc(lastMessage)}</div>` : ''}
    <div class="tab-row" role="tablist">
      ${tabs.map(([key, label]) => `<button type="button" role="tab" aria-selected="${key === testState.tab}" class="tab${key === testState.tab ? ' active' : ''}" data-tab="${key}">${esc(label)}</button>`).join('')}
    </div>
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
  const plan = activePlan();

  if (target.dataset.tab) {
    testState.tab = target.dataset.tab;
    lastMessage = '';
    saveTestState();
    render();
  } else if (target.dataset.scenario) {
    const scenario = TEST_SCENARIOS.find((item) => item.id === target.dataset.scenario);
    testState.logs = scenarioLogs(plan, scenario);
    testState.tab = 'plan';
    lastMessage = `${scenario.label}: all 12 weeks are filled in. ${scenario.description}`;
    saveTestState();
    render();
  } else if (target.dataset.quick) {
    const exercise = plan.exercises.find((item) => item.id === target.dataset.ex);
    const week = currentWeek();
    const weekTarget = runPlan(plan, testState.logs)[week - 1].targets[exercise.id];
    const entry = draft.ex[exercise.id];
    entry.type = target.dataset.quick;
    entry.actual = fillActual(exercise, weekTarget, week, entry.type);
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
    saveTestState();
    render();
  }
});

testApp.addEventListener('change', (event) => {
  const field = event.target;
  if (field.id === 'athlete') {
    testState.athlete = field.value;
    testState.logs = {};
    testState.tab = 'week';
    draft = null;
    lastMessage = '';
    saveTestState();
    render();
  } else if (field.classList.contains('checkin')) {
    draft.days[field.dataset.day][field.dataset.key] = Number(field.value);
  } else if (field.classList.contains('set-input')) {
    const entry = draft.ex[field.dataset.ex];
    entry.actual[Number(field.dataset.set)] = Number(field.value) || 0;
    entry.type = '';
    render();
  } else if (field.classList.contains('easy-box')) {
    draft.ex[field.dataset.ex].tooEasy = field.checked;
  }
});

render();
