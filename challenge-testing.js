// Testing week: the 11 tests spread over 3 days, guided one test at a time like the workouts.
// Loaded after challenge-workout.js (beeps, clock, video) and before challenge-test.js (testState, render...).

// Edit the tests, their order and their explanations here. `fields` are the TEST_FIELDS keys a test fills in.
const TESTING_DAYS = [
  {
    day: 1,
    tests: [
      {
        type: 'max', name: 'Max pull-ups without stopping + with stopping', fields: ['pullNo', 'pull'],
        how: [
          'Do as many pull-ups as you can without stopping, and remember that number.',
          'Then keep going: rest while still hanging on the bar, and add reps until you cannot do another one.',
          'Enter both numbers: your reps without stopping, and your total reps including the ones after the breaks.'
        ]
      },
      {
        type: 'beep', name: 'Dips beep test', fields: ['beepDip'], every: 45,
        how: [
          'A new round starts every 45 seconds. Round 1 is 1 dip, round 2 is 2 dips, and every round adds 1 rep.',
          'Do the round\'s reps, then rest for what is left of the 45 seconds.',
          'When you cannot finish a round in time, tap End test. Your score is the last round you completed.'
        ]
      },
      {
        type: 'single', name: 'Max bodyweight rows without stopping', fields: ['rows'],
        how: ['Do as many bodyweight rows as you can without stopping.', 'Enter the number of reps you did in a row.']
      }
    ]
  },
  {
    day: 2,
    tests: [
      {
        type: 'max', name: 'Max push-ups without stopping + with stopping', fields: ['pushNo', 'push'],
        how: [
          'Do as many push-ups as you can without stopping, and remember that number.',
          'Then keep going: you may rest in the top position, for no more than 3 seconds at a time, until you cannot do another one.',
          'Enter both numbers: your reps without stopping, and your total reps including the ones after the breaks.'
        ]
      },
      {
        type: 'beep', name: 'Pull-up beep test', fields: ['beepPull'], every: 60,
        how: [
          'A new round starts every 60 seconds. Round 1 is 1 pull-up, round 2 is 2 pull-ups, and every round adds 1 rep.',
          'Do the round\'s reps, then rest for what is left of the 60 seconds.',
          'When you cannot finish a round in time, tap End test. Your score is the last round you completed.'
        ]
      }
    ]
  },
  {
    day: 3,
    tests: [
      {
        type: 'max', name: 'Max dips without stopping + with stopping', fields: ['dipNo', 'dip'],
        how: [
          'Do as many dips as you can without stopping, and remember that number.',
          'Then keep going: you may rest in the top position, for no more than 3 seconds at a time, until you cannot do another one.',
          'Enter both numbers: your reps without stopping, and your total reps including the ones after the breaks.'
        ]
      },
      {
        type: 'single', name: 'Max neutral grip pull-ups without stopping', fields: ['neutral'],
        how: ['Do as many neutral grip pull-ups as you can without stopping.', 'Enter the number of reps you did in a row.']
      },
      {
        type: 'beep', name: 'Push-up beep test', fields: ['beepPush'], every: 30,
        how: [
          'A new round starts every 30 seconds. Round 1 is 1 push-up, round 2 is 2 push-ups, and every round adds 1 rep.',
          'Do the round\'s reps, then rest for what is left of the 30 seconds.',
          'When you cannot finish a round in time, tap End test. Your score is the last round you completed.'
        ]
      }
    ]
  }
];

// Labels on the two numbers of a "without + with stopping" test
const MAX_LABELS = ['Without stopping', 'Total with breaks'];

let tester = null;
let testerTick = null;

function testingState() {
  if (!testState.testing) testState.testing = { results: {}, activeDay: 1 };
  return testState.testing;
}

function fieldInfo(key) {
  return TEST_FIELDS.find((field) => field.key === key);
}

// The B-Low minimum: below it, the plan is built from the minimum instead of the result
function minimumOf(key) {
  return fieldInfo(key).anchors[0];
}

function testDone(test) {
  return test.fields.every((key) => testingState().results[key] !== undefined);
}

function testingDayDone(day) {
  return TESTING_DAYS[day - 1].tests.every(testDone);
}

function testingComplete() {
  return TESTING_DAYS.every((item) => testingDayDone(item.day));
}

function minimumNote(test) {
  const parts = test.fields.map((key) => (test.type === 'beep' ? `round ${minimumOf(key)}` : `${minimumOf(key)} reps${test.fields.length > 1 ? ` ${fieldInfo(key).label.includes('without') ? 'without stopping' : 'with stopping'}` : ''}`));
  return `Minimum for this plan: ${parts.join(' and ')}. If you can't reach it yet, use a resistance band that makes it possible.`;
}

/* ---------- Testing overview: day tabs, test list, Start testing ---------- */

function testingPanel() {
  const state = testingState();
  const day = state.activeDay || 1;
  const info = TESTING_DAYS[day - 1];
  const results = state.results;
  const rows = info.tests.map((test) => {
    const done = testDone(test);
    const result = done ? test.fields.map((key) => results[key]).join(' / ') : '';
    return `<li class="plan-row">
      <div class="plan-row-name">${esc(test.name)}${done ? ` <span class="test-done">✓ ${esc(result)}</span>` : ''}</div>
      <ul class="test-how">${test.how.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      <div class="plan-row-meta mt-1">${esc(minimumNote(test))}</div>
    </li>`;
  }).join('');
  const dayDone = testingDayDone(day);
  const action = dayDone
    ? `<p class="done-note">Testing Day ${day} is done.</p>
       <button type="button" class="btn-outline player-button" data-testing="start" data-day="${day}">Test Day ${day} again</button>`
    : `<button type="button" class="btn-primary player-button" data-testing="start" data-day="${day}">START TESTING</button>`;
  return `<div class="grid gap-3">
    <p class="text-sm text-gray-600">Your plan is built from ${TEST_FIELDS.length} tests over 3 days. Do each testing day on a separate day, so the tests don't tire you out for each other.</p>
    <div class="day-tabs day-tabs-3" role="group" aria-label="Choose a testing day">
      ${TESTING_DAYS.map((item) => `<button type="button" class="day-tab${item.day === day ? ' active' : ''}" aria-pressed="${item.day === day}" data-testing="day" data-day="${item.day}">Day ${item.day}${testingDayDone(item.day) ? ' ✓' : ''}</button>`).join('')}
    </div>
    <section class="card grid gap-3">
      <h3 class="text-xl font-bold">Testing – Day ${day}</h3>
      <ol class="plan-list">${rows}</ol>
      ${action}
    </section>
    ${testingComplete() ? '<button type="button" class="btn-primary player-button" data-testing="finish-all">Create my plan</button>' : ''}
    <div class="small-actions">
      <button type="button" class="link-button" data-action="enter-all">Enter all results at once</button>
    </div>
  </div>`;
}

/* ---------- Guided testing ---------- */

function currentTest() {
  return TESTING_DAYS[tester.day - 1].tests[tester.index];
}

function testerTop() {
  const count = TESTING_DAYS[tester.day - 1].tests.length;
  return `<div class="player-top">
    <span class="player-where">Testing · Day ${tester.day} · Test ${tester.index + 1} of ${count}</span>
    <button type="button" class="player-exit" data-testing="exit">Exit</button>
  </div>`;
}

function testStepper(key, label) {
  return `<div class="adjust-slot">
    ${label ? `<div class="adjust-label">${esc(label)}</div>` : ''}
    <div class="stepper">
      <button type="button" class="step" data-testing="adjust" data-key="${key}" data-change="-1" aria-label="One less">&minus;</button>
      <output class="set-input adjust-value" id="test-value-${key}">${tester.values[key] || 0}</output>
      <button type="button" class="step" data-testing="adjust" data-key="${key}" data-change="1" aria-label="One more">+</button>
    </div>
  </div>`;
}

// Below the minimum, the first Save shows why and asks again
function lowWarning(test) {
  const low = test.fields.filter((key) => (tester.values[key] || 0) < minimumOf(key));
  if (!low.length || !tester.warned) return '';
  return `<div class="test-warning" role="alert">
    Below the minimum of ${low.map((key) => minimumOf(key)).join(' and ')}. Your plan will be built from the minimum, not from this result.
    Make the exercise easier, for example with a resistance band, so you can reach the minimum in training.
  </div>`;
}

function entryBlock(test, title) {
  const labels = test.type === 'max' ? MAX_LABELS : [''];
  return `<div class="player-adjust">
    <div class="adjust-title">${esc(title)}</div>
    <div class="adjust-row">${test.fields.map((key, i) => testStepper(key, labels[i])).join('')}</div>
  </div>
  ${lowWarning(test)}
  <button type="button" class="btn-primary player-button" data-testing="save">${tester.warned ? 'Save anyway' : 'SAVE RESULT'}</button>`;
}

function testerScreen() {
  const test = currentTest();
  const info = `<div class="player-main">
    <ul class="test-how test-how-player">${test.how.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
    <div class="test-minimum">${esc(minimumNote(test))}</div>
  </div>`;
  const name = `<div class="player-name">${esc(test.name)}</div>`;

  if (tester.phase === 'rest') {
    const next = TESTING_DAYS[tester.day - 1].tests[tester.index + 1];
    const last = !next;
    return `${testerTop()}
      <div class="player-rest">
        <div class="rest-label">Result saved</div>
        <div class="rest-status">${last ? `Testing Day ${tester.day} is done. Great work!` : 'Rest at least 3 to 5 minutes before the next test.'}</div>
      </div>
      ${last ? '' : `<div class="player-next">Next test: ${esc(next.name)}</div>`}
      <button type="button" class="btn-primary player-button" data-testing="${last ? 'exit' : 'next'}">${last ? (testingComplete() ? 'See my results' : 'Back to testing') : 'Start next test'}</button>`;
  }
  if (test.type !== 'beep') {
    return `${testerTop()}${name}
      <div class="player-media player-media-small">${playerMedia(test)}</div>
      ${info}
      ${entryBlock(test, test.type === 'max' ? 'Your reps' : 'Reps without stopping')}`;
  }
  if (tester.phase === 'intro') {
    return `${testerTop()}${name}
      <div class="player-media">${playerMedia(test)}</div>
      ${info}
      <button type="button" class="btn-primary player-button" data-testing="beep-start">Start test</button>`;
  }
  if (tester.phase === 'running') {
    return `${testerTop()}${name}
      <div class="player-media player-media-small">${playerMedia(test)}</div>
      <div class="player-main">
        <div class="player-count" id="beep-round">Round 1</div>
        <div class="player-target" id="beep-reps">1 rep</div>
      </div>
      <div class="interval-clock-block">
        <div class="rest-label" id="beep-label">Get into position. Starts in</div>
        <div class="rest-clock" id="beep-clock">${GET_READY}</div>
        <div class="interval-bar" aria-hidden="true"><span id="beep-fill"></span></div>
      </div>
      <button type="button" class="btn-outline player-button" data-testing="beep-end">End test</button>`;
  }
  return `${testerTop()}${name}
    <div class="player-rest">
      <div class="rest-label">Test finished</div>
      <div class="rest-clock">Round ${tester.values[test.fields[0]] || 0}</div>
      <div class="rest-status">Your last completed round. Change it if it's not right.</div>
    </div>
    ${entryBlock(test, 'Last round completed')}`;
}

function renderTester() {
  document.documentElement.classList.add('workout-open');
  testApp.innerHTML = `<div class="player">${testerScreen()}</div>`;
  updateTester();
  if (!testerTick) testerTick = setInterval(updateTester, 250);
}

function closeTester() {
  tester = null;
  document.documentElement.classList.remove('workout-open');
  clearInterval(testerTick);
  testerTick = null;
  letScreenSleep();
}

// The beep test clock: 3 second get ready, then a round every `every` seconds, each with 1 rep more
function updateTester() {
  if (!tester || tester.phase !== 'running') return;
  const test = currentTest();
  const now = Date.now();
  const label = document.getElementById('beep-label');
  const big = document.getElementById('beep-clock');
  const fill = document.getElementById('beep-fill');
  if (!big) return;
  if (now < tester.startedAt) {
    const wait = Math.ceil((tester.startedAt - now) / 1000);
    if (tester.lastTick !== `ready-${wait}`) { tester.lastTick = `ready-${wait}`; countdownBeep(); }
    big.textContent = String(wait);
    fill.style.width = '0%';
    return;
  }
  const elapsed = (now - tester.startedAt) / 1000;
  const round = Math.floor(elapsed / test.every) + 1;
  const left = test.every - (elapsed % test.every);
  if (tester.round !== round) {
    tester.round = round;
    roundStartBeep();
    document.getElementById('beep-round').textContent = `Round ${round}`;
    document.getElementById('beep-reps').textContent = `${round} ${round === 1 ? 'rep' : 'reps'}`;
    label.textContent = 'Next round in';
  }
  const tick = Math.ceil(left);
  if (tick <= 3 && tester.lastTick !== `${round}-${tick}`) { tester.lastTick = `${round}-${tick}`; countdownBeep(); }
  big.textContent = clock(left);
  fill.style.width = `${(1 - left / test.every) * 100}%`;
}

function startTesting(day) {
  unlockAudio();
  keepScreenOn();
  const tests = TESTING_DAYS[day - 1].tests;
  const first = tests.findIndex((test) => !testDone(test));
  tester = { day, index: first === -1 ? 0 : first, phase: 'intro', values: {} };
  prepareTest();
  renderTester();
}

function prepareTest() {
  const results = testingState().results;
  tester.phase = 'intro';
  tester.warned = false;
  tester.round = 0;
  tester.values = {};
  currentTest().fields.forEach((key) => { tester.values[key] = results[key] || 0; });
}

function finishTesting() {
  testState.results = Object.assign({}, testingState().results);
  testState.editing = false;
  testState.planChanged = false;
  testState.logs = {};
  testState.tab = 'home';
  draft = null;
  player = null;
  lastMessage = `Testing complete. Your ${PLAN_WEEKS}-week plan is ready: start with week 1, Day 1.`;
  saveTestState();
  window.scrollTo({ top: 0 });
  render();
}

// Handles every testing button. Returns true when it used the click.
function handleTestingClick(button) {
  const action = button.dataset.testing;
  if (!action) return false;
  unlockAudio();
  const state = testingState();
  if (action === 'day') {
    state.activeDay = Number(button.dataset.day);
    saveTestState();
    render();
  } else if (action === 'start') {
    startTesting(Number(button.dataset.day));
  } else if (action === 'finish-all') {
    finishTesting();
  } else if (!tester) {
    return true;
  } else if (action === 'exit') {
    // Back to the overview, on the next day still to test
    const nextDay = TESTING_DAYS.find((item) => !testingDayDone(item.day));
    if (nextDay) state.activeDay = nextDay.day;
    closeTester();
    saveTestState();
    render();
  } else if (action === 'adjust') {
    const key = button.dataset.key;
    tester.values[key] = Math.max(0, (tester.values[key] || 0) + Number(button.dataset.change));
    tester.warned = false;
    renderTester();
  } else if (action === 'beep-start') {
    tester.phase = 'running';
    tester.startedAt = Date.now() + GET_READY * 1000;
    renderTester();
  } else if (action === 'beep-end') {
    // The round in progress was not finished, so the score is the one before it
    tester.values[currentTest().fields[0]] = Math.max(0, (tester.round || 1) - 1);
    tester.phase = 'result';
    beep();
    renderTester();
  } else if (action === 'save') {
    const test = currentTest();
    if (test.type === 'max') {
      // The total with breaks can't be lower than the reps without stopping
      const [first, total] = test.fields;
      tester.values[total] = Math.max(tester.values[total] || 0, tester.values[first] || 0);
    }
    const low = test.fields.some((key) => (tester.values[key] || 0) < minimumOf(key));
    if (low && !tester.warned) {
      tester.warned = true;
      renderTester();
      return true;
    }
    test.fields.forEach((key) => { state.results[key] = tester.values[key] || 0; });
    tester.phase = 'rest';
    saveTestState();
    renderTester();
  } else if (action === 'next') {
    tester.index += 1;
    prepareTest();
    renderTester();
  }
  return true;
}
