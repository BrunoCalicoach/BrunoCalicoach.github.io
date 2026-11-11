// TEST version of the Level 1 challenge rules, used only by challenge-test.html.
// Plans follow Bruno's weeks 1 and 2 of B-Low and the level-1-plan-v8 draft: 9 weeks, then a retest.

const PLAN_WEEKS = 9;
// Logs saved from an older plan cannot be replayed on this one, so they are cleared once
const PLAN_VERSION = 2;
const TEST_RULES = { closePercent: 0.1, closeReps: 2, weeklyLimit: 0.1, stallSessions: 2 };

// One pull step and one push step per workout. Week 2 is the step out of the adaptation week.
const PULL_WEEKS = [2, 3, 5, 6, 7, 9];
const PUSH_WEEKS = [2, 3, 4, 5, 7, 8, 9];
// Supersets: the pull side steps in weeks 4 and 8, the push side in week 6
const SUPERSET_WEEKS = [2, 4, 6, 8];
const DIP_EMOM_WEEKS = [2, 6];
const PYRAMID_WEEKS = [2, 3, 5, 7, 9];
const BAND_NAMES = ['heavy band', 'medium band', 'light band', 'no band'];
const BAND_SETS = [2, 2, 3, 3, 3, 3, 3, 3, 3];
const CIRCUIT_REST = ['45 seconds', '40 seconds', '35 seconds', '30 seconds'];

function flatRounds(n, count = 10) { return Array(count).fill(n).join(', '); }
function altRounds(a, b, count = 10) { return Array.from({ length: count }, (_, i) => (i % 2 ? b : a)).join(', '); }
function threeRounds(a, b, c, count = 10) { return Array.from({ length: count }, (_, i) => [a, b, c][i % 3]).join(', '); }

// Bruno's EMOM ladder: n every round, then n+1, n, n-1, then n+1, n, then n+1 every round
function emomSteps(week1, type, n, count = 9) {
  const list = [week1];
  for (let i = 0; i < count; i += 1) {
    if (type === 'flat') list.push(flatRounds(n));
    if (type === 'three') list.push(threeRounds(n + 1, n, n - 1));
    if (type === 'alt') list.push(altRounds(n + 1, n));
    if (type === 'flat') type = 'three';
    else if (type === 'three') type = 'alt';
    else { type = 'flat'; n += 1; }
  }
  return list;
}

// Week 2 has 6 sets. Week 1 leaves out sets 4 and 6.
// Then the pull side's two lowest sets gain 1 rep (weeks 4, 8), and every push side set gains 1 rep (week 6).
function supersetSteps(side, push, pushFirst) {
  const write = (sideReps, added, sets) => sets.map((i) => {
    const pushReps = push[i] + added;
    return pushFirst ? `${pushReps} + ${sideReps[i]}` : `${sideReps[i]} + ${pushReps}`;
  }).join(', ');
  const raise = (reps) => {
    const next = reps.slice();
    next[next.length - 1] += 1;
    next[next.length - 2] += 1;
    return next.sort((a, b) => b - a);
  };
  const all = [0, 1, 2, 3, 4, 5];
  const s1 = raise(side);
  const s2 = raise(s1);
  const s3 = raise(s2);
  return [write(side, 0, [0, 1, 2, 4]), write(side, 0, all), write(s1, 0, all), write(s1, 1, all), write(s2, 1, all), write(s2, 2, all), write(s3, 2, all)];
}

// The peak follows the pull up beep test: one below it in week 1, with a shorter way down, then at it in week 2.
// After that a second top round, then a higher peak with a higher base, and so on.
function pyramidSteps(beep) {
  const top1 = beep - 1;
  const list = [[top1 - 3, top1 - 2, top1 - 1, top1, top1, top1 - 1].join(', ')];
  let base = beep - 4;
  let top = beep;
  for (let i = 0; i < 8; i += 1) {
    const up = [];
    for (let n = base; n <= top; n += 1) up.push(n);
    const down = up.slice(0, -1).reverse();
    list.push(up.concat(i % 2 ? [top] : [], down).join(', '));
    if (i % 2) { base += 1; top += 1; }
  }
  return list;
}

// Abs and legs stay the same every week. Bruno adds Abs training 2 and 3 for weeks 4 to 9 later.
const ABS_ONE = {
  kind: 'fixed', block: 'Abs', name: 'L-sit raises + L-sit hold + knee raises', rest: '30 sec', sets: 5, firstWeekSets: 5,
  text: '5 + 5 sec hold + 10, then 4 + hold + 8, 3 + hold + 6, 2 + hold + 4, 1 + hold + 2',
  stepText: '5 + hold + 10 down to 1 + hold + 2',
  setParts: [[5, 10], [4, 8], [3, 6], [2, 4], [1, 2]].map(([a, b]) => [`${a} L-sit ${a === 1 ? 'raise' : 'raises'}`, `5 sec L-sit hold, then ${b} knee raises`])
};
const ABS_TWO = {
  kind: 'fixed', block: 'Abs', name: 'Side to side knee raises + tucked L-sit hold + knee raises', rest: '30 sec', sets: 5, firstWeekSets: 5,
  text: '10 + hold + 10, then 8 + hold + 8, 6 + hold + 6, 4 + hold + 4, 2 + hold + 2',
  stepText: '10 + hold + 10 down to 2 + hold + 2',
  setParts: [10, 8, 6, 4, 2].map((a) => [`${a} side to side knee raises`, `tucked L-sit hold, then ${a} knee raises`])
};
const LEGS = [
  { kind: 'fixed', block: 'Legs', name: 'Jumping lunges + jump squats', rest: 'every 45 sec', sets: 4, firstWeekSets: 3, text: '10 + 10 every 45 sec', stepText: '10 + 10', parts: ['10 jumping lunges', 'then 10 jump squats'] },
  { kind: 'fixed', block: 'Legs', name: 'Side squats + squats', rest: 'every 45 sec', sets: 4, firstWeekSets: 3, text: '10 + 10 every 45 sec', stepText: '10 + 10', parts: ['10 side squats', 'then 10 squats'] },
  { kind: 'fixed', block: 'Legs', name: 'Wall sit', rest: 'every 60 sec', sets: 4, firstWeekSets: 3, hold: 20, text: '20 sec hold every 60 sec', stepText: '20 sec hold', parts: ['20 sec hold', ''] }
];

function level1Plan(p) {
  const on = (day, exercise) => Object.assign({ day }, exercise);
  return {
    label: p.label,
    description: p.description,
    exercises: [
      { day: 1, name: 'Dips submax', kind: 'straight', family: 'dip', test: 'dip', rest: '180 - 300 sec', weeks: PUSH_WEEKS, list: p.dips },
      { day: 1, name: 'Pull ups EMOM', kind: 'emom', family: 'pull', test: 'pullNo', rest: 'every 60 sec', weeks: PULL_WEEKS, list: p.pullEmom },
      { day: 1, name: 'Push ups + Rows superset', kind: 'superset', family: 'push', families: ['push', 'rows'], tests: ['pushNo', 'rows'], sides: ['Push-ups', 'Rows'], rest: '90 sec', weeks: SUPERSET_WEEKS, list: p.supersetOne },
      on(1, ABS_ONE),
      on(1, ABS_TWO),
      { day: 2, name: 'Pull ups submax', kind: 'straight', family: 'pull', test: 'pull', rest: '180 - 300 sec', weeks: PULL_WEEKS, list: p.pull },
      { day: 2, name: 'Push ups EMOM', kind: 'emom', family: 'push', test: 'pushNo', rest: 'every 60 sec', weeks: PUSH_WEEKS, list: p.pushEmom },
      { day: 2, name: 'Neutral pull ups + Dips superset', kind: 'superset', family: 'dip', families: ['pull', 'dip'], tests: ['neutral', 'dipNo'], sides: ['Neutral pull-ups', 'Dips'], rest: '90 - 180 sec', weeks: SUPERSET_WEEKS, list: p.supersetTwo },
      ...LEGS.map((exercise) => on(2, exercise)),
      { day: 3, name: 'Push ups submax', kind: 'straight', family: 'push', test: 'push', rest: '180 - 300 sec', weeks: PUSH_WEEKS, list: p.push },
      { day: 3, name: 'Dips EMOM', kind: 'emom', family: 'dip', test: 'dipNo', rest: 'every 60 sec', weeks: DIP_EMOM_WEEKS, list: p.dipEmom },
      { day: 3, name: 'Pull up pyramid', kind: 'ladder', family: 'pull', test: 'beepPull', roundLabel: 'Round', rest: 'every 60 sec', weeks: PYRAMID_WEEKS, list: pyramidSteps(p.beepPull) },
      on(3, ABS_ONE),
      on(3, ABS_TWO),
      { day: 4, name: 'Pull ups', kind: 'circuit', family: 'pull', test: 'pullCircuit', week1: p.circuit[0][0], base: p.circuit[0][1] },
      { day: 4, name: 'Dips', kind: 'circuit', family: 'dip', test: 'dipCircuit', week1: p.circuit[1][0], base: p.circuit[1][1] },
      { day: 4, name: 'Chin ups', kind: 'circuit', family: 'chin', test: 'pullCircuit', week1: p.circuit[2][0], base: p.circuit[2][1] },
      { day: 4, name: 'Push ups', kind: 'circuit', family: 'push', test: 'pushCircuit', week1: p.circuit[3][0], base: p.circuit[3][1] },
      { day: 4, name: 'Negative pull ups', kind: 'circuit', test: 'pullCircuit', week1: p.circuit[4][0], base: p.circuit[4][1] },
      { day: 4, name: 'Squats', kind: 'circuit', test: 'allCircuit', week1: p.circuit[5][0], base: p.circuit[5][1] }
    ]
  };
}

const TEST_PLANS = {
  low: level1Plan({
    label: 'B-Low',
    description: 'Pull-ups 6 / 10, dips 10 / 15, push-ups 12 / 18 (without / with stopping)',
    dips: ['13, 11, 10', '14, 12, 11, 10', '15, 12, 11, 10', '15, 12, 11, 11', '15, 13, 11, 11', '16, 13, 11, 11', '16, 13, 12, 11', '16, 13, 12, 12', '17, 13, 12, 12', '17, 14, 12, 12', '18, 14, 12, 12'],
    pullEmom: emomSteps(altRounds(4, 3, 6), 'alt', 3),
    supersetOne: supersetSteps([12, 11, 10, 10, 9, 8], [10, 9, 8, 8, 7, 6], true),
    pull: ['7, 6, 5', '8, 7, 6, 5', '9, 7, 6, 5', '9, 7, 6, 6', '9, 8, 7, 6', '10, 8, 7, 6', '10, 8, 7, 7', '10, 9, 8, 7', '11, 9, 8, 7', '11, 9, 9, 8'],
    pushEmom: emomSteps(altRounds(6, 5, 6), 'alt', 5),
    supersetTwo: supersetSteps([8, 7, 6, 6, 5, 4], [10, 9, 8, 8, 7, 6], false),
    push: ['15, 13, 11', '16, 13, 11, 10', '16, 13, 11, 11', '17, 13, 11, 11', '17, 13, 12, 11', '17, 14, 12, 11', '18, 14, 12, 11', '18, 14, 12, 12', '18, 14, 13, 12', '19, 14, 13, 12', '19, 15, 13, 12'],
    dipEmom: emomSteps(altRounds(5, 4, 6), 'alt', 4),
    beepPull: 5,
    circuit: [['5, 5, 4', '6, 5, 5, 4'], ['8, 8, 7', '9, 8, 8, 7'], ['5, 5, 4', '6, 5, 5, 4'], ['10, 10, 9', '11, 10, 10, 9'], ['5, 5, 4', '6, 5, 5, 4'], ['15, 15, 14', '16, 15, 15, 14']]
  }),
  medium: level1Plan({
    label: 'B-Medium',
    description: 'Pull-ups 12 / 16, dips 16 / 22, push-ups 22 / 32 (without / with stopping)',
    dips: ['17, 15, 13', '18, 15, 13, 11', '19, 15, 13, 11', '20, 15, 13, 12', '21, 15, 13, 12', '21, 16, 14, 12', '22, 16, 14, 13', '23, 16, 14, 13', '24, 17, 14, 13', '24, 17, 15, 14', '25, 17, 15, 14'],
    pullEmom: emomSteps(altRounds(7, 6, 6), 'alt', 6),
    supersetOne: supersetSteps([18, 16, 15, 15, 14, 12], [18, 16, 15, 15, 13, 11], true),
    pull: ['13, 10, 8', '13, 11, 10, 9', '14, 12, 10, 9', '14, 12, 11, 10', '15, 12, 11, 10', '16, 13, 11, 10', '16, 13, 12, 11', '17, 14, 12, 12', '18, 14, 13, 12', '18, 15, 14, 13'],
    pushEmom: emomSteps(flatRounds(10, 6), 'flat', 10),
    supersetTwo: supersetSteps([14, 12, 10, 10, 9, 7], [16, 14, 13, 13, 11, 10], false),
    push: ['24, 21, 18', '26, 22, 18, 16', '27, 22, 19, 16', '28, 22, 19, 17', '29, 23, 19, 17', '30, 23, 20, 17', '31, 23, 20, 18', '31, 24, 21, 18', '32, 24, 21, 19', '33, 24, 22, 19', '34, 25, 22, 19'],
    dipEmom: emomSteps(altRounds(8, 7, 6), 'alt', 7),
    beepPull: 8,
    circuit: [['7, 6, 5', '7, 7, 6, 5'], ['12, 11, 10', '12, 12, 11, 10'], ['7, 6, 5', '7, 7, 6, 5'], ['13, 13, 12', '13, 13, 13, 12'], ['7, 6, 5', '7, 7, 6, 5'], ['20, 18, 16', '20, 20, 18, 16']]
  }),
  high: level1Plan({
    label: 'B-High',
    description: 'Pull-ups 15 / 20, dips 24 / 30, push-ups 28 / 40 (without / with stopping): the Level 1 upper limit',
    dips: ['24, 21, 18', '25, 21, 19, 16', '26, 21, 19, 17', '27, 22, 19, 17', '28, 22, 20, 17', '29, 22, 20, 18', '30, 23, 20, 18', '31, 23, 21, 18', '32, 23, 21, 19', '33, 24, 21, 19', '34, 24, 22, 19'],
    pullEmom: emomSteps(threeRounds(8, 7, 6, 6), 'three', 7),
    supersetOne: supersetSteps([22, 20, 18, 18, 16, 15], [23, 21, 19, 19, 16, 14], true),
    pull: ['15, 13, 11', '16, 13, 11, 10', '17, 14, 11, 11', '18, 14, 12, 12', '19, 14, 13, 12', '20, 15, 13, 13', '20, 15, 14, 14', '21, 16, 15, 14', '22, 16, 15, 15', '22, 17, 16, 15'],
    pushEmom: emomSteps(altRounds(13, 12, 6), 'alt', 12),
    supersetTwo: supersetSteps([18, 16, 14, 14, 11, 9], [24, 22, 19, 19, 17, 14], false),
    push: ['32, 26, 22', '34, 28, 24, 20', '35, 28, 24, 21', '36, 29, 24, 21', '37, 29, 25, 21', '38, 29, 25, 22', '39, 30, 25, 22', '40, 30, 26, 22', '41, 30, 26, 23', '42, 31, 26, 23', '43, 31, 27, 23'],
    dipEmom: emomSteps(altRounds(10, 9, 6), 'alt', 9),
    beepPull: 10,
    circuit: [['8, 7, 6', '8, 8, 7, 6'], ['14, 12, 11', '14, 14, 12, 11'], ['8, 7, 6', '8, 8, 7, 6'], ['16, 14, 13', '16, 16, 14, 13'], ['8, 7, 6', '8, 8, 7, 6'], ['22, 20, 18', '22, 22, 20, 18']]
  })
};

function repsTotal(reps) {
  return reps.reduce((sum, n) => sum + n, 0);
}

function parseEntry(exercise, text) {
  if (exercise.kind === 'range') {
    const [low, high] = text.split(' to ').map(Number);
    return { reps: Array(exercise.sets).fill(low), high };
  }
  if (exercise.kind === 'superset') {
    return { reps: text.split(',').flatMap((pair) => pair.split('+').map(Number)) };
  }
  return { reps: text.split(',').map(Number) };
}

function preparePlan(key) {
  const plan = TEST_PLANS[key];
  if (plan.ready) return plan;
  plan.exercises.forEach((exercise, index) => {
    exercise.id = 'ex' + index;
    if (exercise.kind === 'circuit') {
      exercise.firstReps = exercise.week1.split(',').map(Number);
      exercise.baseReps = exercise.base.split(',').map(Number);
    }
    if (!exercise.list) return;
    // A skill keeps its weekly list, with repeats. Other exercises only move when they get a step.
    const list = exercise.kind === 'skill'
      ? exercise.list
      : exercise.list.filter((text, i) => i === 0 || text !== exercise.list[i - 1]);
    exercise.seq = list.map((text) => parseEntry(exercise, text));
  });
  plan.ready = true;
  return plan;
}

// The formula: an athlete's plan is built between B-Low, B-Medium and B-High, exercise by exercise.
// Each exercise follows the test named in Bruno's notes (its `test`, or `tests` for the two sides of a superset).
const TEST_FIELDS = [
  { key: 'pullNo', label: 'Max pull-ups without stopping', anchors: [6, 12, 15] },
  { key: 'pull', label: 'Max pull-ups with stopping', anchors: [10, 16, 20] },
  { key: 'neutral', label: 'Max neutral grip pull-ups without stopping', anchors: [8, 14, 18] },
  { key: 'rows', label: 'Max bodyweight rows without stopping', anchors: [12, 18, 22] },
  { key: 'dipNo', label: 'Max dips without stopping', anchors: [10, 16, 24] },
  { key: 'dip', label: 'Max dips with stopping', anchors: [15, 22, 30] },
  { key: 'pushNo', label: 'Max push-ups without stopping', anchors: [12, 22, 28] },
  { key: 'push', label: 'Max push-ups with stopping', anchors: [18, 32, 40] },
  { key: 'beepPull', label: 'Pull-up beep test score', anchors: [5, 8, 10] },
  { key: 'beepDip', label: 'Dip beep test score', anchors: [6, 10, 13] },
  { key: 'beepPush', label: 'Push-up beep test score', anchors: [8, 12, 16] }
];

// 0 is B-Low, 1 is B-Medium, 2 is B-High. Below B-Low stays at B-Low.
// Above B-High, 2.5 means results 50% above it, so the plan keeps B-High's shape at 1.5 times the reps.
function planPosition(value, anchors) {
  const [low, medium, high] = anchors;
  if (value > high) return 1 + value / high;
  const position = value <= medium ? (value - low) / (medium - low) : 1 + (value - medium) / (high - medium);
  return Math.max(0, position);
}

function blend(values, position) {
  const [low, medium, high] = values;
  if (position > 2) return high * (position - 1);
  return position <= 1 ? low + (medium - low) * position : medium + (high - medium) * (position - 1);
}

// A shorter superset gains sets by repeating its last pair
function paddedPairs(reps, length) {
  return Array.from({ length }, (_, i) => (i < reps.length ? reps[i] : reps[reps.length - 2 + ((i - reps.length) % 2)]));
}

function padded(reps, length) {
  return Array.from({ length }, (_, i) => (i < reps.length ? reps[i] : reps[reps.length - 1]));
}

// Blends one list of sets; positionFor can give each set its own position, as supersets need
function blendReps(lists, positionFor, countPosition) {
  const count = lists[countPosition < 0.5 ? 0 : countPosition < 1.5 ? 1 : 2].length;
  const longest = Math.max(...lists.map((reps) => reps.length));
  const full = lists.map((reps) => padded(reps, longest));
  return Array.from({ length: count }, (_, i) => Math.max(1, Math.round(blend(full.map((reps) => reps[i]), positionFor(i)))));
}

// EMOM totals snap to Bruno's patterns: every round the same, or n+1, n, n-1 repeating, or n+1, n alternating
function emomRounds(total, rounds) {
  const base = Math.floor(total / 10);
  const options = [10 * base, 10 * base + 1, 10 * base + 5, 10 * base + 10];
  const best = options.reduce((a, b) => (Math.abs(b - total) < Math.abs(a - total) ? b : a));
  const n = Math.floor(best / 10);
  if (best === 10 * n + 1) return Array.from({ length: rounds }, (_, i) => [n + 1, n, n - 1][i % 3]);
  if (best === 10 * n + 5) return Array.from({ length: rounds }, (_, i) => (i % 2 ? n : n + 1));
  return Array(rounds).fill(n);
}

function testPositions(results) {
  const p = {};
  TEST_FIELDS.forEach((field) => { p[field.key] = planPosition(results[field.key], field.anchors); });
  // The circuit is endurance work, so max reps and beep score count equally
  p.pullCircuit = 0.5 * p.pull + 0.5 * p.beepPull;
  p.dipCircuit = 0.5 * p.dip + 0.5 * p.beepDip;
  p.pushCircuit = 0.5 * p.push + 0.5 * p.beepPush;
  p.allCircuit = (p.pullCircuit + p.dipCircuit + p.pushCircuit) / 3;
  return p;
}

function blendExercise(anchors, p) {
  const [low, medium, high] = anchors;
  const exercise = Object.assign({}, medium);
  if (medium.kind === 'fixed' || medium.kind === 'band' || medium.kind === 'skill') return exercise;
  const position = medium.kind === 'superset' ? (p[medium.tests[0]] + p[medium.tests[1]]) / 2 : p[medium.test];
  if (medium.kind === 'circuit') {
    exercise.firstReps = blendReps([low.firstReps, medium.firstReps, high.firstReps], () => position, position);
    exercise.baseReps = blendReps([low.baseReps, medium.baseReps, high.baseReps], () => position, position);
    return exercise;
  }
  const steps = Math.min(low.seq.length, medium.seq.length, high.seq.length);
  exercise.seq = Array.from({ length: steps }, (_, i) => {
    const lists = [low.seq[i].reps, medium.seq[i].reps, high.seq[i].reps];
    if (medium.kind === 'range') {
      return {
        reps: Array(medium.sets).fill(Math.round(blend(lists.map((reps) => reps[0]), position))),
        high: Math.round(blend([low.seq[i].high, medium.seq[i].high, high.seq[i].high], position))
      };
    }
    if (medium.kind === 'emom') {
      const rounds = lists[1].length;
      const total = blend(lists.map((reps) => repsTotal(padded(reps, 10))), position);
      return { reps: rounds === 10 ? emomRounds(total, 10) : null };
    }
    if (medium.kind === 'superset') {
      // Each side follows its own test
      const positionFor = (set) => p[medium.tests[set % 2]];
      const longest = Math.max(...lists.map((reps) => reps.length));
      const count = lists[position < 0.5 ? 0 : position < 1.5 ? 1 : 2].length;
      return { reps: blendReps(lists.map((reps) => paddedPairs(reps, longest)), positionFor, position).slice(0, count) };
    }
    return { reps: blendReps(lists, () => position, position) };
  });
  // Week 1 of an EMOM is the first 6 rounds of week 2
  if (medium.kind === 'emom') exercise.seq[0] = { reps: exercise.seq[1].reps.slice(0, 6) };
  return exercise;
}

function buildPersonalPlan(results) {
  const [low, medium, high] = ['low', 'medium', 'high'].map(preparePlan);
  const p = testPositions(results);
  const exercises = medium.exercises.map((exercise, i) => blendExercise([low.exercises[i], exercise, high.exercises[i]], p));
  exercises.forEach((exercise, i) => { exercise.id = 'ex' + i; });
  return { label: 'Personal plan', description: 'Built from these test results', exercises, ready: true };
}

function resultNotes(results) {
  const notes = [];
  const fieldFor = (key) => TEST_FIELDS.find((f) => f.key === key);
  const below = ['pull', 'dip', 'push'].filter((key) => results[key] < fieldFor(key).anchors[0]);
  const above = TEST_FIELDS.filter((field) => results[field.key] > field.anchors[2]);
  if (below.length) notes.push('Below the Level 1 minimum of 10 pull-ups, 15 dips and 18 push-ups with stopping. This program may be too demanding.');
  if (above.length > TEST_FIELDS.length / 2) notes.push('Above the Level 1 limit on most tests. Level 2 is probably the better fit.');
  return notes;
}

function lighterReps(exercise, reps) {
  const lowered = exercise.kind === 'superset'
    ? reps.slice(0, -2).map((n) => Math.max(n - 1, 1))
    : reps.slice(0, -1).map((n) => Math.max(n - 1, 1));
  // A lighter week does not go below the adaptation week, unless the target is already lower than it
  const floor = exercise.seq[0].reps;
  return repsTotal(lowered) < repsTotal(floor) && repsTotal(reps) > repsTotal(floor) ? floor.slice() : lowered;
}

function circuitTarget(exercise, circuit) {
  if (circuit.stage === 0) return { reps: exercise.firstReps.slice(), rest: CIRCUIT_REST[0], load: '' };
  const added = Math.floor((circuit.stage - 1) / 4);
  return {
    reps: exercise.baseReps.map((n) => n + added),
    rest: CIRCUIT_REST[(circuit.stage - 1) % 4],
    load: ''
  };
}

function currentTarget(exercise, state, circuit) {
  if (exercise.kind === 'circuit') return circuitTarget(exercise, circuit);
  if (exercise.kind === 'band') {
    return {
      reps: Array(BAND_SETS[Math.min(state.idx, BAND_SETS.length - 1)]).fill(1),
      high: 3,
      load: BAND_NAMES[state.band]
    };
  }
  const entry = exercise.seq[state.idx];
  const base = state.custom || entry.reps;
  const reps = state.lighter ? lighterReps(exercise, base) : base.slice();
  if (exercise.kind === 'straight' && !state.lighter && state.firstFloor > reps[0]) reps[0] = state.firstFloor;
  return {
    reps,
    high: entry.high,
    load: exercise.load || '',
    rebuilt: !!state.custom && !state.lighter,
    lighter: state.lighter
  };
}

function missAmount(total, type) {
  const close = Math.floor(Math.max(total * TEST_RULES.closePercent, TEST_RULES.closeReps));
  return type === 'close' ? Math.min(close, total) : Math.min(Math.max(close + 1, Math.ceil(total * 0.2)), total);
}

function removeReps(reps, amount) {
  const result = reps.slice();
  let i = result.length - 1;
  let left = amount;
  while (left > 0 && repsTotal(result) > 0) {
    if (result[i] > 0) { result[i] -= 1; left -= 1; }
    i = (i - 1 + result.length) % result.length;
  }
  return result;
}

// Reps filled in by the test athletes: 'hit', 'close', 'big', 'easy' or 'first'
function fillActual(exercise, target, week, type) {
  if (type === 'close' || type === 'big') return removeReps(target.reps, missAmount(repsTotal(target.reps), type));
  if (exercise.kind === 'band') return target.reps.map(() => 2);
  // Range exercises reach the top number just before the plan moves them up
  if (exercise.kind === 'range' && (type === 'easy' || exercise.weeks.includes(week + 1))) {
    return target.reps.map(() => target.high);
  }
  const reps = target.reps.slice();
  if (type === 'first' && exercise.kind === 'straight') reps[0] += 2;
  return reps;
}

function defaultDay() {
  return { energy: 3, sleep: 3, effort: 8 };
}

function hitLog(plan, targets, week) {
  const log = { days: { 1: defaultDay(), 2: defaultDay(), 3: defaultDay(), 4: defaultDay() }, ex: {} };
  plan.exercises.forEach((exercise) => {
    if (exercise.kind === 'fixed') return;
    log.ex[exercise.id] = { actual: fillActual(exercise, targets[exercise.id], week, 'hit'), tooEasy: false };
  });
  return log;
}

function familyTotals(plan, targets) {
  const totals = { pull: 0, chin: 0, dip: 0, push: 0, rows: 0 };
  plan.exercises.forEach((exercise) => {
    if (!exercise.family) return;
    const reps = targets[exercise.id].reps;
    if (exercise.kind === 'superset') {
      reps.forEach((n, i) => { totals[exercise.families[i % 2]] += n; });
    } else {
      totals[exercise.family] += repsTotal(reps);
    }
  });
  return totals;
}

function rebuildFromActual(target, actual) {
  // 12, 12, 10, 8 on a target of 48 becomes 12, 11, 11, 10: more total reps, smaller drop
  const done = repsTotal(actual);
  const total = Math.min(repsTotal(target.reps), done + Math.max(1, Math.round(done * 0.04)));
  const sets = target.reps.length;
  const first = Math.max(actual[0] || 0, Math.ceil(total / sets));
  const rest = total - first;
  const each = Math.floor(rest / (sets - 1));
  const extra = rest - each * (sets - 1);
  return [first].concat(Array.from({ length: sets - 1 }, (_, i) => each + (i < extra ? 1 : 0)));
}

// Average of energy and sleep: 2 or below is low, 4.5 or above is high, anything between is middle
function readiness(day) {
  const average = (day.energy + day.sleep) / 2;
  return average <= 2 ? 'low' : average >= 4.5 ? 'high' : 'middle';
}

// An EMOM keeps Bruno's round patterns, so a missed EMOM is rebuilt from its total
function emomAtTotal(total, rounds) {
  const n = Math.max(1, Math.floor(total / rounds));
  const alternate = total - n * rounds >= Math.ceil(rounds / 2);
  return Array.from({ length: rounds }, (_, i) => (alternate && i % 2 === 0 ? n + 1 : n));
}

// Next week's target after a miss, set by set: what was done (high), or halfway between it and the target (middle)
function missedTarget(exercise, target, actual, feeling) {
  if (exercise.kind === 'emom') {
    const done = repsTotal(actual);
    return emomAtTotal(feeling === 'high' ? done : Math.round((done + repsTotal(target.reps)) / 2), target.reps.length);
  }
  return target.reps.map((planned, i) => {
    const did = actual[i] || 0;
    return Math.max(1, feeling === 'high' ? did : Math.round((did + planned) / 2));
  });
}

function checkResult(exercise, target, actual) {
  const goal = repsTotal(target.reps);
  const done = repsTotal(actual);
  const hit = ['range', 'band'].includes(exercise.kind)
    ? actual.every((n) => n >= target.reps[0])
    : done >= goal;
  let status = 'hit';
  if (!hit) status = goal - done <= Math.max(goal * TEST_RULES.closePercent, TEST_RULES.closeReps) ? 'close' : 'big';
  return { status, done, goal, notable: false, text: '' };
}

function advanceExercise(exercise, state, target, entry, week, day) {
  const next = week + 1;
  const actual = entry.actual.map((n) => n || 0);
  const result = checkResult(exercise, target, actual);
  const { done, goal } = result;
  const detail = `Did ${done} of ${goal} reps.`;

  if (exercise.kind === 'band') {
    state.idx += 1;
    const reachedThree = actual.length >= 3 && actual.every((n) => n >= 3);
    if ((reachedThree || entry.tooEasy) && state.band < BAND_NAMES.length - 1) {
      state.band += 1;
      result.notable = true;
      result.text = entry.tooEasy && !reachedThree
        ? `Marked too easy. Next week moves to: ${BAND_NAMES[state.band]}.`
        : `3 sets of 3 reps done. Next week moves to: ${BAND_NAMES[state.band]}.`;
    }
    return result;
  }

  const last = exercise.seq.length - 1;
  if (result.status !== 'hit') {
    const label = result.status === 'close' ? 'Close miss' : 'Big miss';
    result.notable = true;
    state.firstFloor = 0;

    // How the athlete felt decides what a miss means
    const feeling = readiness(day);
    if (feeling === 'low') {
      result.status = 'low';
      result.text = `${detail} Low energy and sleep, so the same target repeats next week. Rested, it should go better.`;
      return result;
    }
    state.stall += 1;
    if (state.lighter) {
      result.text = `${label}. ${detail} Stays on the lighter target. An athlete stuck here should talk to the coach.`;
      return result;
    }
    if (state.stall >= TEST_RULES.stallSessions) {
      state.lighter = true;
      state.stall = 0;
      result.text = `${label}. ${detail} Second session in a row without progress, so next week is lighter: one set fewer and about 1 rep less per set.`;
      return result;
    }
    const reason = feeling === 'high'
      ? 'Energy and sleep were high, so the target was too hard. Next week matches what was done.'
      : 'Energy and sleep were average, so each set next week sits halfway between its target and what was done.';
    if (['straight', 'emom', 'ladder', 'superset'].includes(exercise.kind)) {
      // This can go below the adaptation week: the athlete has shown that week was too hard
      state.custom = missedTarget(exercise, target, actual, feeling);
      result.text = `${label}. ${detail} ${reason}`;
    } else if (exercise.kind === 'range' && feeling === 'high' && state.idx > 0) {
      state.idx -= 1;
      result.text = `${label}. ${detail} Energy and sleep were high, so the rep range steps back down.`;
    } else {
      result.text = `${label}. ${detail} Repeats the same target.`;
    }
    return result;
  }

  state.stall = 0;
  if (state.lighter) {
    state.lighter = false;
    result.notable = true;
    result.text = 'Lighter week done. Returns to the target from before it.';
    return result;
  }
  if (state.custom) {
    // Climb back to the plan by 1 rep per set each week instead of jumping straight back
    const planned = exercise.seq[state.idx].reps;
    const climbed = exercise.kind === 'emom'
      ? emomAtTotal(Math.min(repsTotal(planned), repsTotal(state.custom) + Math.ceil(state.custom.length / 2)), state.custom.length)
      : state.custom.map((n, i) => Math.min(planned[i] === undefined ? n + 1 : planned[i], n + 1));
    result.notable = true;
    if (climbed.length === planned.length && climbed.every((n, i) => n >= planned[i])) {
      state.custom = null;
      result.text = 'Lower target hit, and the next step reaches the plan again.';
    } else {
      state.custom = climbed;
      result.text = 'Lower target hit, so next week climbs back toward the plan by 1 rep per set.';
    }
    return result;
  }
  if (exercise.kind === 'range') {
    if (actual.every((n) => n >= target.high) || entry.tooEasy) {
      state.idx = Math.min(state.idx + 1, last);
      result.notable = entry.tooEasy;
      if (entry.tooEasy) result.text = 'Marked too easy, so the rep range moves up.';
    }
    return result;
  }
  if (exercise.kind === 'skill') {
    state.idx = Math.min(state.idx + 1, last);
    if (entry.tooEasy) {
      const value = repsTotal(exercise.seq[state.idx].reps);
      const found = exercise.seq.findIndex((step, i) => i > state.idx && repsTotal(step.reps) > value);
      if (found !== -1) state.idx = found;
      result.notable = true;
      result.text = 'Marked too easy, so this moves ahead.';
    }
    return result;
  }

  // The scheduled step, then any extra step earned. The weekly limit can take back only the extra.
  const scheduled = exercise.weeks.includes(next);
  if (scheduled && day.effort >= 10 && !entry.tooEasy) {
    result.notable = true;
    result.text = 'Target hit at maximum effort, so the planned step waits.';
  } else if (scheduled) {
    state.idx = Math.min(state.idx + 1, last);
  }
  state.beforeExtra = state.idx;
  state.floorBefore = state.firstFloor;

  // Extra reps on the first set lift the next first set; extra reps elsewhere move the plan up
  const counted = exercise.kind === 'straight'
    ? target.reps[0] + repsTotal(actual.slice(1).map((n, i) => Math.max(n, target.reps[i + 1])))
    : done;
  if (counted > goal) {
    let reached = state.idx;
    exercise.seq.forEach((step, i) => { if (i > reached && repsTotal(step.reps) <= counted) reached = i; });
    if (reached > state.idx) {
      state.idx = reached;
      result.extra = true;
      result.notable = true;
      result.text = `Did ${done} reps against a target of ${goal}, so the plan moves up to match.`;
    }
  }
  if (entry.tooEasy) {
    state.idx = Math.min(state.idx + 1, last);
    result.extra = true;
    result.notable = true;
    result.text = 'Marked too easy, so this gets an extra step next week.';
  }
  if (exercise.kind === 'straight' && actual[0] > exercise.seq[state.idx].reps[0]) {
    state.firstFloor = actual[0];
    result.extra = true;
    result.notable = true;
    result.text = `First set reached ${actual[0]}, past the target, so next week's first set starts there.`;
  }
  return result;
}

// Day 4 moves as one: every rep hit means the next rest time or rep step
function advanceCircuit(plan, circuit, targets, log) {
  const members = plan.exercises.filter((exercise) => exercise.kind === 'circuit');
  const day = log.days[members[0].day];
  const results = {};
  let missed = false;
  let easy = false;
  members.forEach((exercise) => {
    const entry = log.ex[exercise.id];
    const actual = entry.actual.map((n) => n || 0);
    results[exercise.id] = checkResult(exercise, targets[exercise.id], actual);
    if (results[exercise.id].status !== 'hit') missed = true;
    if (entry.tooEasy) easy = true;
  });
  const lead = results[members[0].id];
  if (!missed) {
    circuit.stall = 0;
    if (day.effort >= 10 && !easy) {
      lead.notable = true;
      lead.text = 'Circuit done at maximum effort, so it repeats next week.';
      return results;
    }
    circuit.stage += easy ? 2 : 1;
    if (easy) {
      lead.notable = true;
      lead.text = 'Circuit marked too easy, so it skips ahead one step.';
    }
    return results;
  }
  const feeling = readiness(day);
  const first = members.find((exercise) => results[exercise.id].status !== 'hit');
  const missResult = results[first.id];
  missResult.notable = true;
  if (feeling === 'low') {
    members.forEach((exercise) => { if (results[exercise.id].status !== 'hit') results[exercise.id].status = 'low'; });
    missResult.text = 'Circuit reps missed with low energy and sleep, so the same circuit repeats next week.';
    return results;
  }
  // One step back means 5 seconds more rest, or the reps before the last rep increase
  const back = feeling === 'high' ? 2 : 1;
  circuit.stage = circuit.stage > 1 ? Math.max(1, circuit.stage - back) : circuit.stage;
  missResult.text = feeling === 'high'
    ? 'Circuit reps missed although energy and sleep were high, so the circuit steps back two steps next week.'
    : 'Circuit reps missed with average energy and sleep, so the circuit steps back one step next week.';
  return results;
}

// Replays the logged weeks, then assumes every target is hit for the weeks still to come
function runPlan(plan, logs) {
  const states = {};
  const circuit = { stage: 0, stall: 0 };
  const adaptive = plan.exercises.filter((exercise) => exercise.kind !== 'fixed');
  adaptive.forEach((exercise) => {
    states[exercise.id] = { idx: 0, custom: null, lighter: false, stall: 0, band: 0, firstFloor: 0 };
  });
  const allTargets = () => {
    const targets = {};
    adaptive.forEach((exercise) => { targets[exercise.id] = currentTarget(exercise, states[exercise.id], circuit); });
    return targets;
  };
  const weeks = [];

  for (let week = 1; week <= PLAN_WEEKS; week += 1) {
    const targets = allTargets();
    const logged = logs[week];
    const log = logged || hitLog(plan, targets, week);
    const results = advanceCircuit(plan, circuit, targets, log);
    adaptive.filter((exercise) => exercise.kind !== 'circuit').forEach((exercise) => {
      results[exercise.id] = advanceExercise(exercise, states[exercise.id], targets[exercise.id], log.ex[exercise.id], week, log.days[exercise.day]);
    });
    const totals = familyTotals(plan, targets);

    // Weekly limit on each movement. The jump out of the adaptation week is exempt.
    if (week >= 2) {
      ['pull', 'chin', 'dip', 'push', 'rows'].forEach((family) => {
        adaptive.filter((exercise) => exercise.family === family && results[exercise.id].extra).reverse().forEach((exercise) => {
          if (familyTotals(plan, allTargets())[family] > totals[family] * (1 + TEST_RULES.weeklyLimit)) {
            states[exercise.id].idx = states[exercise.id].beforeExtra;
            states[exercise.id].firstFloor = states[exercise.id].floorBefore;
            results[exercise.id].extra = false;
            results[exercise.id].text += ' The weekly limit holds this step back for now.';
          }
        });
      });
    }
    weeks.push({ week, targets, totals, done: !!logged, log, results });
  }
  return weeks;
}

function shortTarget(exercise, target) {
  const reps = target.reps;
  if (exercise.kind === 'band') return `1 to 3, ${reps.length} sets, ${target.load}`;
  if (exercise.kind === 'range') return `${reps[0]} to ${target.high}`;
  if (exercise.kind === 'superset') {
    const pairs = [];
    for (let i = 0; i < reps.length; i += 2) pairs.push(`${reps[i]} + ${reps[i + 1]}`);
    return pairs.join(', ');
  }
  if (exercise.kind === 'circuit') return `${reps.join(', ')} (${target.rest.replace(' seconds', 's')} rest)`;
  if (exercise.kind === 'emom') {
    const period = [1, 2, 3].find((p) => reps.every((n, i) => n === reps[i % p]));
    return period ? `${reps.slice(0, period).join('/')} x${reps.length}` : reps.join(', ');
  }
  return reps.join(', ');
}

const TEST_MAIN = ['Pull ups submax', 'Dips submax', 'Pull ups EMOM', 'Push ups EMOM'];

const TEST_SCENARIOS = [
  { id: 'all', label: 'Hits every target', description: 'The plan exactly as drafted.', pick: () => 'hit' },
  { id: 'pull', label: 'Pull-ups get hard', description: 'Close misses on submax pull-ups and the pull-up EMOM in weeks 5 to 8.', pick: (exercise, week) => (['Pull ups submax', 'Pull ups EMOM'].includes(exercise.name) && week >= 5 && week <= 8 ? 'close' : 'hit') },
  { id: 'first', label: 'Beats first sets', description: 'Goes 2 reps past the first-set targets in weeks 3, 6 and 9.', pick: (exercise, week) => (exercise.kind === 'straight' && [3, 6, 9].includes(week) ? 'first' : 'hit') },
  { id: 'strong', label: 'Finds it too easy', description: 'Ticks "too easy" on submax pull-ups and dips and the pull-up and push-up EMOMs from week 2.', pick: (exercise, week) => (TEST_MAIN.includes(exercise.name) && exercise.kind !== 'circuit' && week >= 2 ? 'easy' : 'hit') },
  { id: 'circuit', label: 'Circuit gets hard', description: 'Close misses on the Day 4 circuit in weeks 5 and 6.', pick: (exercise, week) => (exercise.kind === 'circuit' && (week === 5 || week === 6) ? 'close' : 'hit') },
  { id: 'fresh', label: 'Misses while feeling fresh', description: 'Week 5: energy and sleep 5, but big misses on submax pull-ups and dips.', pick: (exercise, week) => (['Pull ups submax', 'Dips submax'].includes(exercise.name) && exercise.kind === 'straight' && week === 5 ? 'big' : 'hit'), day: (week) => (week === 5 ? { energy: 5, sleep: 5, effort: 9 } : defaultDay()) },
  { id: 'bad', label: 'One bad week', description: 'Week 6: poor sleep, low energy, big misses on everything.', pick: (exercise, week) => (week === 6 ? 'big' : 'hit'), day: (week) => (week === 6 ? { energy: 2, sleep: 2, effort: 9 } : defaultDay()) },
  { id: 'stuck', label: 'Stuck on one exercise', description: 'Big misses on the pull-up EMOM in weeks 5, 6 and 7.', pick: (exercise, week) => (exercise.name === 'Pull ups EMOM' && week >= 5 && week <= 7 ? 'big' : 'hit') }
];

function scenarioLogs(plan, scenario) {
  const logs = {};
  for (let week = 1; week <= PLAN_WEEKS; week += 1) {
    const targets = runPlan(plan, logs)[week - 1].targets;
    const log = { days: {}, ex: {} };
    [1, 2, 3, 4].forEach((day) => { log.days[day] = scenario.day ? scenario.day(week) : defaultDay(); });
    plan.exercises.forEach((exercise) => {
      if (exercise.kind === 'fixed') return;
      const type = scenario.pick(exercise, week);
      log.ex[exercise.id] = { actual: fillActual(exercise, targets[exercise.id], week, type), tooEasy: type === 'easy' };
    });
    logs[week] = log;
  }
  return logs;
}
