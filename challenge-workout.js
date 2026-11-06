// Guided workout: one set per screen with rest timers, then a short check-in.
// It writes into the same week draft as the manual log, so the adaptive rules see the same data.
// Loaded before challenge-test.js, whose globals (draft, testState, render...) it uses at run time.

let player = null;
let playerTick = null;
let playerAudio = null;
let playerWakeLock = null;

// '180 - 300 sec', 'under 60 sec', '45 seconds', 'every 60 sec', 'every 2 minutes'
function restWindow(text) {
  if (!text) return { min: 0, max: 0 };
  const unit = /minute/.test(text) ? 60 : 1;
  const every = text.match(/every (\d+)/);
  if (every) return { every: Number(every[1]) * unit };
  const range = text.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return { min: Number(range[1]) * unit, max: Number(range[2]) * unit };
  const under = text.match(/under (\d+)/);
  if (under) return { min: 0, max: Number(under[1]) * unit };
  const single = text.match(/(\d+)/);
  return single ? { min: Number(single[1]) * unit, max: Number(single[1]) * unit } : { min: 0, max: 0 };
}

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

function restText(rest) {
  if (rest.every) return rest.every >= 120 ? `every ${rest.every / 60} min` : `every ${rest.every} sec`;
  const show = (s) => (s >= 120 && s % 60 === 0 ? `${s / 60} min` : `${s} sec`);
  if (!rest.max) return 'no rest';
  if (rest.min === rest.max) return show(rest.max);
  if (!rest.min) return `up to ${show(rest.max)}`;
  return rest.min >= 120 && rest.max % 60 === 0 && rest.min % 60 === 0
    ? `${rest.min / 60}–${rest.max / 60} min`
    : `${rest.min}–${rest.max} sec`;
}

function workoutSetCount(exercise, target, week) {
  if (exercise.kind === 'fixed') return week === 1 ? exercise.firstWeekSets : exercise.sets;
  if (exercise.kind === 'superset') return target.reps.length / 2;
  return target.reps.length;
}

// Every set of the day in the order it is done. A circuit goes round by round instead of exercise by exercise.
function workoutSteps(plan, day, targets, week) {
  const list = plan.exercises.filter((exercise) => exercise.day === day);
  const steps = [];
  if (list.every((exercise) => exercise.kind === 'circuit')) {
    const rounds = targets[list[0].id].reps.length;
    const between = restWindow(targets[list[0].id].rest);
    for (let round = 0; round < rounds; round += 1) {
      list.forEach((exercise, position) => {
        const endOfRound = position === list.length - 1;
        let after = Object.assign({ label: 'Rest, then the next exercise' }, between);
        if (endOfRound) after = round === rounds - 1 ? null : { min: 90, max: 90, label: 'Rest between rounds' };
        steps.push({ exercise, set: round, sets: rounds, circuit: true, position, count: list.length, after });
      });
    }
    return steps;
  }
  list.forEach((exercise, position) => {
    const sets = workoutSetCount(exercise, targets[exercise.id], week);
    const own = restWindow(exercise.rest);
    for (let set = 0; set < sets; set += 1) {
      let after = null;
      if (set < sets - 1) after = Object.assign({ label: 'Rest' }, own);
      // An EMOM has no rest of its own after the last round, so the next exercise gets a normal rest
      else if (position < list.length - 1) after = own.every ? { min: 60, max: 180, label: 'Rest before the next exercise' } : Object.assign({}, own, { label: 'Rest before the next exercise' });
      steps.push({ exercise, set, sets, position, count: list.length, after });
    }
  });
  return steps;
}

function stepTarget(step, target) {
  const { exercise, set } = step;
  const reps = target.reps;
  if (exercise.kind === 'fixed') return { main: exercise.stepText, sub: '' };
  if (exercise.kind === 'superset') {
    return { main: `${reps[set * 2]} ${exercise.sides[0].toLowerCase()}`, sub: `then ${reps[set * 2 + 1]} ${exercise.sides[1].toLowerCase()}` };
  }
  if (exercise.kind === 'range') return { main: `${reps[set]} to ${target.high} reps`, sub: '' };
  if (exercise.kind === 'band') return { main: '1 to 3 reps', sub: target.load };
  return { main: `${reps[set]} reps`, sub: '' };
}

function stepCounter(step) {
  if (step.circuit) return `Round ${step.set + 1} of ${step.sets}`;
  const word = step.exercise.kind === 'emom' || step.exercise.roundLabel ? 'Round' : 'Set';
  return `${word} ${step.set + 1} of ${step.sets}`;
}

// Which numbers in the draft belong to a step: supersets keep two per set
function stepSlots(step) {
  const { exercise, set } = step;
  if (exercise.kind === 'fixed') return [];
  if (exercise.kind === 'superset') return [{ index: set * 2, label: exercise.sides[0] }, { index: set * 2 + 1, label: exercise.sides[1] }];
  return [{ index: set, label: 'Reps done' }];
}

function workoutContext() {
  const plan = activePlan();
  const week = currentWeek();
  const targets = runPlan(plan, testState.logs)[week - 1].targets;
  return { plan, week, targets, steps: workoutSteps(plan, player.day, targets, week) };
}

function playerMedia(exercise) {
  if (exercise.image) return `<img src="${esc(exercise.image)}" alt="${esc(exercise.name)}">`;
  return `<div class="media-empty"><span class="media-icon" aria-hidden="true">▶</span><span>Exercise video coming soon</span></div>`;
}

function topBar(step) {
  return `<div class="player-top">
    <span class="player-where">Day ${player.day} · Exercise ${step.position + 1} of ${step.count}</span>
    <span class="total-clock" id="total-clock" aria-label="Total workout time">0:00</span>
    <button type="button" class="player-exit" data-workout="exit">Exit</button>
  </div>`;
}

function adjustBlock(step) {
  const slots = stepSlots(step);
  if (!slots.length) return '';
  const entry = draft.ex[step.exercise.id];
  const title = step.circuit ? `${step.exercise.name}, round ${step.set + 1}` : `${step.exercise.name}, ${stepCounter(step).split(' of ')[0].toLowerCase()}`;
  return `<div class="player-adjust">
    <div class="adjust-title">Reps you did: ${esc(title)}</div>
    <div class="adjust-row">${slots.map((slot) => `<div class="adjust-slot">
      ${slots.length > 1 ? `<div class="adjust-label">${esc(slot.label)}</div>` : ''}
      <div class="stepper">
        <button type="button" class="step" data-workout="adjust" data-ex="${step.exercise.id}" data-set="${slot.index}" data-change="-1" aria-label="One rep less">&minus;</button>
        <output class="set-input adjust-value" id="adjust-${step.exercise.id}-${slot.index}">${entry.actual[slot.index]}</output>
        <button type="button" class="step" data-workout="adjust" data-ex="${step.exercise.id}" data-set="${slot.index}" data-change="1" aria-label="One rep more">+</button>
      </div>
    </div>`).join('')}</div>
    <div class="adjust-hint">Leave it if you hit the target.</div>
  </div>`;
}

function workScreen(step, target) {
  const goal = stepTarget(step, target);
  const meta = [step.exercise.tempo && 'Tempo ' + step.exercise.tempo, step.exercise.kind !== 'band' && target.load].filter(Boolean).join(' · ');
  const label = step.after ? (step.circuit || step.exercise.kind === 'emom' || step.exercise.roundLabel ? 'Round done' : 'Set done') : 'Last set done';
  return `${topBar(step)}
    <div class="player-media">${playerMedia(step.exercise)}</div>
    <div class="player-main">
      <div class="player-name">${esc(step.exercise.name)}</div>
      <div class="player-count">${esc(stepCounter(step))}</div>
      <div class="player-target">${esc(goal.main)}</div>
      ${goal.sub ? `<div class="player-sub">${esc(goal.sub)}</div>` : ''}
      ${meta ? `<div class="player-meta">${esc(meta)}</div>` : ''}
    </div>
    <button type="button" class="btn-primary player-button" data-workout="done">${label}</button>`;
}

function nextLine(next, targets) {
  const goal = stepTarget(next, targets[next.exercise.id]);
  const change = next.position !== player.lastPosition && !next.circuit ? 'Next exercise: ' : 'Next: ';
  return `${change}${next.exercise.name} · ${stepCounter(next)} · ${goal.main}${goal.sub ? ' ' + goal.sub : ''}`;
}

function restScreen(step, next, targets) {
  const rest = player.rest;
  const restRule = rest.every
    ? `Rounds start every ${restText(rest).replace('every ', '')}`
    : rest.min === rest.max ? `Rest ${restText(rest)}` : `Rest ${restText(rest)}: start after the minimum, before the maximum`;
  return `${topBar(step)}
    <div class="player-rest">
      <div class="rest-label" id="rest-label">${esc(rest.label || 'Rest')}</div>
      <div class="rest-clock" id="rest-clock">0:00</div>
      <div class="rest-status" id="rest-status"></div>
      <div class="rest-bar" aria-hidden="true">
        <div class="rest-fill" id="rest-fill"></div>
        ${!rest.every && rest.min && rest.max > rest.min ? `<div class="rest-mark" style="left:${(rest.min / rest.max) * 100}%"></div>` : ''}
      </div>
      <div class="rest-window">${esc(restRule)}</div>
    </div>
    ${adjustBlock(step)}
    <div class="player-next">${esc(nextLine(next, targets))}</div>
    <button type="button" class="btn-primary player-button" id="rest-go" data-workout="next">Start</button>
    ${location.hash === '#tools' ? '<button type="button" class="link-button skip-rest" data-workout="next">Skip rest (testing only)</button>' : ''}`;
}

function lastSetScreen(step) {
  return `${topBar(step)}
    <div class="player-rest">
      <div class="rest-label">Last set done</div>
      <div class="rest-clock">${clock((Date.now() - player.startedAt) / 1000)}</div>
      <div class="rest-status">Total workout time</div>
    </div>
    ${adjustBlock(step)}
    <button type="button" class="btn-primary player-button" data-workout="finish">Finish workout</button>`;
}

function checkRow(key, question, max) {
  const value = player.check[key];
  let buttons = '';
  for (let n = 1; n <= max; n += 1) {
    buttons += `<button type="button" class="checkin-button${n === value ? ' active' : ''}" aria-pressed="${n === value}" data-workout="check" data-key="${key}" data-value="${n}">${n}</button>`;
  }
  return `<div role="group" aria-label="${esc(question)}"><div class="checkin-label">${esc(question)}</div><div class="checkin-row">${buttons}</div></div>`;
}

function reviewScreen(context) {
  const done = player.check.effort && player.check.energy && player.check.sleep;
  const adaptive = context.plan.exercises.filter((exercise) => exercise.day === player.day && exercise.kind !== 'fixed');
  return `<div class="player-review">
    <div>
      <h2 class="text-2xl font-bold">Workout complete</h2>
      <p class="player-count mt-1">Total time ${clock((player.finishedAt - player.startedAt) / 1000)}</p>
    </div>
    ${checkRow('effort', 'How hard was this session? 1 very easy, 10 maximum', 10)}
    ${checkRow('energy', 'Energy today: 1 very low, 5 very high', 5)}
    ${checkRow('sleep', 'Sleep last night: 1 very badly, 5 very well', 5)}
    <div>
      <div class="checkin-label">Anything too easy? Tap to mark it</div>
      <div class="easy-chips">${adaptive.map((exercise) => `<button type="button" class="easy-chip${draft.ex[exercise.id].tooEasy ? ' active' : ''}" aria-pressed="${!!draft.ex[exercise.id].tooEasy}" data-workout="easy" data-ex="${exercise.id}">${esc(exercise.name)}</button>`).join('')}</div>
    </div>
    <button type="button" class="btn-primary player-button" data-workout="save"${done ? '' : ' disabled'}>${done ? 'Save workout' : 'Answer the 3 questions to save'}</button>
  </div>`;
}

function exitPrompt() {
  return `<div class="player-confirm" role="dialog" aria-label="Leave the workout?">
    <div class="card grid gap-3">
      <h2 class="text-xl font-bold">Leave the workout?</h2>
      <p class="text-gray-600">Your progress is kept. You can resume from Day ${player.day}.</p>
      <button type="button" class="btn-primary" data-workout="stay">Keep going</button>
      <button type="button" class="btn-outline" data-workout="leave">Leave for now</button>
    </div>
  </div>`;
}

function playerScreen() {
  const context = workoutContext();
  const step = context.steps[player.index];
  let body;
  if (player.phase === 'review') body = reviewScreen(context);
  else if (player.phase === 'last') body = lastSetScreen(step);
  else if (player.phase === 'rest') body = restScreen(step, context.steps[player.index + 1], context.targets);
  else body = workScreen(step, context.targets[step.exercise.id]);
  return `<div class="player${player.phase === 'review' ? ' player-scroll' : ''}">${body}${player.confirmExit ? exitPrompt() : ''}</div>`;
}

function beep() {
  try {
    if (playerAudio) {
      const tone = playerAudio.createOscillator();
      const volume = playerAudio.createGain();
      tone.frequency.value = 880;
      volume.gain.value = 0.2;
      tone.connect(volume);
      volume.connect(playerAudio.destination);
      tone.start();
      tone.stop(playerAudio.currentTime + 0.3);
    }
    if (navigator.vibrate) navigator.vibrate(250);
  } catch (error) { /* Sound and vibration are extras */ }
}

async function keepScreenOn() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') playerWakeLock = await navigator.wakeLock.request('screen');
  } catch (error) { /* Not every browser allows it */ }
}

function letScreenSleep() {
  try { if (playerWakeLock) playerWakeLock.release(); } catch (error) { /* Already released */ }
  playerWakeLock = null;
}

function updatePlayerClock() {
  if (!player || player.paused) return;
  const now = Date.now();
  const total = document.getElementById('total-clock');
  if (total) total.textContent = clock(((player.finishedAt || now) - player.startedAt) / 1000);
  if (player.phase !== 'rest') return;
  const rest = player.rest;
  const label = document.getElementById('rest-label');
  const big = document.getElementById('rest-clock');
  const status = document.getElementById('rest-status');
  const fill = document.getElementById('rest-fill');
  const go = document.getElementById('rest-go');
  if (!big) return;
  const panel = big.closest('.player-rest');

  if (rest.every) {
    const remaining = rest.every - (now - player.roundAt) / 1000;
    if (remaining <= 0) {
      beep();
      advance();
      return;
    }
    label.textContent = 'Next round starts in';
    big.textContent = clock(remaining);
    status.textContent = 'It starts by itself, or start now';
    fill.style.width = `${Math.min(100, (1 - remaining / rest.every) * 100)}%`;
    go.textContent = 'Start now';
    return;
  }

  const elapsed = (now - player.phaseAt) / 1000;
  fill.style.width = `${rest.max ? Math.min(100, (elapsed / rest.max) * 100) : 100}%`;
  if (elapsed < rest.min) {
    big.textContent = clock(rest.min - elapsed);
    status.textContent = 'Keep resting';
    panel.dataset.state = 'resting';
    go.disabled = true;
    go.textContent = `Start in ${clock(rest.min - elapsed)}`;
  } else if (elapsed < rest.max) {
    if (!player.beeped && rest.min > 0) { player.beeped = true; beep(); }
    big.textContent = clock(rest.max - elapsed);
    status.textContent = rest.min ? 'Ready. Start before this reaches 0:00' : 'Start when ready, before this reaches 0:00';
    panel.dataset.state = 'ready';
    go.disabled = false;
    go.textContent = 'Start';
  } else {
    if (!player.lateBeep) { player.lateBeep = true; beep(); }
    big.textContent = `+${clock(elapsed - rest.max)}`;
    status.textContent = rest.max ? 'Rest is over. Start now' : 'Start now';
    panel.dataset.state = 'late';
    go.disabled = false;
    go.textContent = 'Start';
  }
}

function renderPlayer() {
  document.documentElement.classList.add('workout-open');
  testApp.innerHTML = playerScreen();
  updatePlayerClock();
  if (!playerTick) playerTick = setInterval(updatePlayerClock, 250);
}

function closePlayer() {
  document.documentElement.classList.remove('workout-open');
  clearInterval(playerTick);
  playerTick = null;
  letScreenSleep();
}

function startWorkout(day) {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !playerAudio) playerAudio = new Audio();
    if (playerAudio && playerAudio.state === 'suspended') playerAudio.resume();
  } catch (error) { /* No sound */ }
  const now = Date.now();
  player = { day, week: currentWeek(), index: 0, phase: 'work', startedAt: now, phaseAt: now, roundAt: now, check: {} };
  keepScreenOn();
  saveTestState();
  renderPlayer();
}

function advance() {
  const now = Date.now();
  player.index += 1;
  player.phase = 'work';
  player.phaseAt = now;
  player.roundAt = now;
  player.beeped = false;
  player.lateBeep = false;
  saveTestState();
  renderPlayer();
}

// Handles every button inside the workout. Returns true when it used the click.
function handleWorkoutClick(button) {
  const action = button.dataset.workout;
  if (!action) return false;
  if (action === 'start') {
    startWorkout(Number(button.dataset.day));
    return true;
  }
  if (action === 'resume') {
    player.paused = false;
    keepScreenOn();
    renderPlayer();
    return true;
  }
  if (!player) return true;
  const context = workoutContext();
  const step = context.steps[player.index];

  if (action === 'done') {
    player.lastPosition = step.position;
    if (!step.after) {
      player.phase = 'last';
    } else {
      player.phase = 'rest';
      player.rest = step.after;
      player.roundAt = player.phaseAt;
      player.phaseAt = Date.now();
    }
    saveTestState();
    renderPlayer();
  } else if (action === 'next') {
    advance();
  } else if (action === 'adjust') {
    const entry = draft.ex[button.dataset.ex];
    const set = Number(button.dataset.set);
    entry.actual[set] = Math.max(0, (Number(entry.actual[set]) || 0) + Number(button.dataset.change));
    document.getElementById(`adjust-${button.dataset.ex}-${set}`).textContent = entry.actual[set];
    saveTestState();
  } else if (action === 'finish') {
    player.phase = 'review';
    player.finishedAt = Date.now();
    saveTestState();
    renderPlayer();
  } else if (action === 'check') {
    player.check[button.dataset.key] = Number(button.dataset.value);
    renderPlayer();
  } else if (action === 'easy') {
    const entry = draft.ex[button.dataset.ex];
    entry.tooEasy = !entry.tooEasy;
    renderPlayer();
  } else if (action === 'save') {
    const day = player.day;
    draft.days[day] = { energy: player.check.energy, sleep: player.check.sleep, effort: player.check.effort };
    draft.daysDone = Object.assign({}, draft.daysDone, { [day]: true });
    player = null;
    closePlayer();
    if ([1, 2, 3, 4].every((n) => draft.daysDone[n])) {
      finishWeek();
    } else {
      lastMessage = `Day ${day} saved.`;
      draft.activeDay = [1, 2, 3, 4].find((n) => !draft.daysDone[n]);
      saveTestState();
      render();
      window.scrollTo({ top: 0 });
    }
  } else if (action === 'exit') {
    player.confirmExit = true;
    renderPlayer();
  } else if (action === 'stay') {
    player.confirmExit = false;
    renderPlayer();
  } else if (action === 'leave') {
    player.confirmExit = false;
    player.paused = true;
    closePlayer();
    saveTestState();
    render();
  }
  return true;
}

document.addEventListener('visibilitychange', () => {
  if (player && !player.paused && document.visibilityState === 'visible') {
    keepScreenOn();
    updatePlayerClock();
  }
});
