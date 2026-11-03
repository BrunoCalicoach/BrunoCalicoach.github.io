// TEST version of the adaptive challenge rules, used only by challenge-test.html.
// Plans are Bruno's week 1 with the approved draft 3 pace: one pull step and one push step per workout.

const TEST_RULES = { closePercent: 0.1, closeReps: 2, weeklyLimit: 0.1, stallSessions: 2 };

const EVERY_WEEK = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ODD_WEEKS = [2, 3, 5, 7, 9, 11];
const EVEN_WEEKS = [2, 4, 6, 8, 10, 12];
const PULLUP_WEEKS = [2, 3, 5, 6, 7, 9, 10, 11]; // Pauses when the superset's rows step up
const RANGE_WEEKS = [5, 9];

function flatRounds(n) { return Array(10).fill(n).join(', '); }
function altRounds(a, b) { return Array.from({ length: 10 }, (_, i) => (i % 2 ? b : a)).join(', '); }
function threeRounds(a, b, c) { return Array.from({ length: 10 }, (_, i) => [a, b, c][i % 3]).join(', '); }

const TEST_PLANS = {
  low: {
    label: 'B-Low',
    description: 'Lowest beginner: 10 pull-ups, 15 dips, 18 push-ups, 0 muscle-ups',
    exercises: [
      { day: 1, name: 'Muscle up w/ resistance band attempt', kind: 'skill', rest: '180 - 300 sec', list: ['1, 1', '1, 1', '1, 1, 1', '1, 1, 1', '2, 1, 1', '2, 1, 1', '2, 2, 1', '2, 2, 1', '2, 1, 1', '2, 1, 1', '2, 2, 1', '2, 2, 1'], weights: ['heavy band', 'heavy band', 'heavy band', 'heavy band', 'heavy band', 'heavy band', 'heavy band', 'heavy band', 'medium band', 'medium band', 'medium band', 'medium band'] },
      { day: 1, name: 'Pull ups', kind: 'straight', family: 'pull', rest: '180 - 300 sec', weeks: PULLUP_WEEKS, list: ['7, 6, 5', '8, 7, 6, 5', '8, 7, 6, 6', '8, 7, 7, 6', '8, 7, 7, 7', '9, 8, 7, 7', '9, 8, 8, 7', '9, 8, 8, 8', '10, 9, 8, 8', '10, 9, 9, 8', '10, 9, 9, 9', '11, 10, 9, 9', '11, 10, 10, 9'] },
      { day: 1, name: 'Dips EMOM', kind: 'emom', family: 'dip', rest: 'every 60 sec', weeks: ODD_WEEKS, list: [flatRounds(6), flatRounds(7), altRounds(8, 7), flatRounds(8), threeRounds(9, 8, 7), altRounds(9, 8), flatRounds(9), threeRounds(10, 9, 8), altRounds(10, 9), flatRounds(10), threeRounds(11, 10, 9), altRounds(11, 10)] },
      { day: 1, name: 'Push ups + Bodyweight rows superset', kind: 'superset', family: 'push', sets: 6, rest: 'under 60 sec', weeks: EVEN_WEEKS, list: ['8 + 8', '9 + 8', '9 + 9', '10 + 9', '10 + 10', '11 + 10', '11 + 11', '12 + 11', '12 + 12', '13 + 12', '13 + 13', '14 + 13'] },
      { day: 1, name: 'Knee raises ladder', kind: 'fixed', text: '5, 6, 7 ... to max', rest: '30 sec interval' },
      { day: 2, name: 'Dips', kind: 'straight', family: 'dip', rest: '180 - 300 sec', weeks: EVERY_WEEK, list: ['13, 11, 10', '14, 12, 11, 10', '14, 12, 11, 11', '14, 12, 12, 11', '14, 13, 12, 12', '15, 13, 12, 12', '15, 13, 13, 12', '15, 14, 13, 13', '16, 14, 13, 13', '16, 14, 14, 13', '16, 15, 14, 14', '17, 15, 14, 14', '17, 15, 15, 14'] },
      { day: 2, name: 'Pull ups EMOM', kind: 'emom', family: 'pull', rest: 'every 60 sec', weeks: ODD_WEEKS, list: [flatRounds(5), altRounds(6, 5), flatRounds(6), threeRounds(7, 6, 5), altRounds(7, 6), flatRounds(7), threeRounds(8, 7, 6), altRounds(8, 7), flatRounds(8), threeRounds(9, 8, 7), altRounds(9, 8), flatRounds(9)] },
      { day: 2, name: 'Neutral pull ups pyramid', kind: 'pyramid', family: 'pull', rest: 'under 60 sec', weeks: EVEN_WEEKS, list: ['2, 4, 6, 6, 4, 2', '4, 6, 8, 6, 4, 2', '4, 6, 8, 8, 4, 2', '3, 6, 9, 6, 3', '3, 6, 9, 9, 3', '3, 6, 9, 9, 6', '3, 6, 9, 9, 6, 3', '4, 7, 10, 7, 4', '4, 7, 10, 10, 4', '4, 7, 10, 10, 7', '4, 7, 10, 10, 7, 4'] },
      { day: 2, name: 'Chair dips', kind: 'range', sets: 4, rest: '60 - 90 sec', weeks: RANGE_WEEKS, list: ['10 to 15', '12 to 17', '14 to 19', '16 to 21'] },
      { day: 2, name: 'Split squat + squat superset', kind: 'fixed', text: '4 sets of 10 + 10', rest: '90 sec', load: 'Weight vest up to 20kg' },
      { day: 3, name: 'Explosive chest-to-bar pull ups', kind: 'skill', rest: '180 - 300 sec', list: ['3, 2, 1', '3, 2, 2', '3, 3, 2', '3, 3, 3', '4, 3, 3', '4, 3, 3', '4, 4, 3', '4, 4, 3', '4, 4, 4', '4, 4, 4', '5, 4, 4', '5, 4, 4'] },
      { day: 3, name: 'Dips pyramid', kind: 'pyramid', family: 'dip', rest: '60 - 90 sec', weeks: EVERY_WEEK, list: ['2, 4, 6, 6, 4, 2', '4, 6, 8, 6, 4, 2', '4, 6, 8, 8, 4, 2', '3, 6, 9, 6, 3', '3, 6, 9, 9, 3', '3, 6, 9, 9, 6', '3, 6, 9, 9, 6, 3', '4, 7, 10, 7, 4', '4, 7, 10, 10, 4', '4, 7, 10, 10, 7', '4, 7, 10, 10, 7, 4', '5, 8, 11, 8, 5', '5, 8, 11, 11, 5'] },
      { day: 3, name: 'Pull up ladder', kind: 'ladder', family: 'pull', rest: 'under 60 sec', weeks: EVERY_WEEK, list: ['6, 5, 4, 3, 2, 1', '7, 5, 4, 3, 2, 1', '7, 6, 4, 3, 2, 1', '7, 6, 5, 3, 2, 1', '7, 6, 5, 4, 2, 1', '7, 6, 5, 4, 3, 1', '7, 6, 5, 4, 3, 2', '8, 6, 5, 4, 3, 2', '8, 7, 5, 4, 3, 2', '8, 7, 6, 4, 3, 2', '8, 7, 6, 5, 3, 2', '8, 7, 6, 5, 4, 2', '8, 7, 6, 5, 4, 3'] },
      { day: 3, name: 'Inclined push ups', kind: 'range', sets: 4, rest: '90 sec', weeks: RANGE_WEEKS, list: ['14 to 18', '16 to 20', '18 to 22', '20 to 24'] },
      { day: 3, name: 'Tempo australian chin ups', kind: 'range', sets: 4, rest: '90 - 180 sec', tempo: '0 - 1 - 3', weeks: RANGE_WEEKS, list: ['6 to 8', '7 to 9', '8 to 10', '9 to 11'] },
      { day: 3, name: 'Knee raises ladder', kind: 'fixed', text: '5, 6, 7 ... to max', rest: '30 sec interval' },
      { day: 4, name: 'Pull ups pyramid', kind: 'pyramid', family: 'pull', rest: '60 - 90 sec', weeks: EVERY_WEEK, list: ['1, 2, 3, 4, 4, 3, 2, 1', '2, 3, 4, 5, 4, 3, 2, 1', '2, 3, 4, 5, 5, 3, 2, 1', '2, 4, 6, 6, 4, 2', '3, 5, 7, 5, 3', '3, 5, 7, 7, 3', '3, 5, 7, 7, 5', '3, 5, 7, 7, 5, 3', '4, 6, 8, 6, 4', '4, 6, 8, 8, 4', '4, 6, 8, 8, 6', '4, 6, 8, 8, 6, 4', '5, 7, 9, 7, 5'] },
      { day: 4, name: 'Push ups ladder', kind: 'ladder', family: 'push', rest: 'under 60 sec', weeks: EVERY_WEEK, list: ['14, 12, 10, 8, 6, 4', '15, 13, 10, 8, 6, 4', '15, 13, 11, 9, 6, 4', '15, 13, 11, 9, 7, 5', '16, 14, 11, 9, 7, 5', '16, 14, 12, 10, 7, 5', '16, 14, 12, 10, 8, 6', '17, 15, 12, 10, 8, 6', '17, 15, 13, 11, 8, 6', '17, 15, 13, 11, 9, 7', '18, 16, 13, 11, 9, 7', '18, 16, 14, 12, 9, 7', '18, 16, 14, 12, 10, 8'] },
      { day: 4, name: 'Bodyweight tricep extensions', kind: 'fixed', text: '4 sets of 10 to 15', rest: '60 - 90 sec' },
      { day: 4, name: 'Close grip chin ups', kind: 'range', sets: 4, rest: '60 - 90 sec', weeks: RANGE_WEEKS, list: ['4 to 6', '5 to 7', '6 to 8', '7 to 9'] },
      { day: 4, name: 'Nordic hamstring curl', kind: 'fixed', text: '3 sets of 4 to 6', rest: '90 - 180 sec', load: 'Weight vest up to 20kg' },
      { day: 4, name: 'Single leg deadlift', kind: 'fixed', text: '3 sets of 8 to 10', rest: '90 sec', load: 'Weight vest up to 20kg' }
    ]
  },
  high: {
    label: 'B-High',
    description: 'Highest beginner: 16 pull-ups, 22 dips, 32 push-ups, 3 muscle-ups',
    exercises: [
      { day: 1, name: 'Muscle ups', kind: 'skill', rest: '180 - 300 sec', list: ['3, 2', '3, 2, 1', '3, 2, 1', '3, 2, 2', '3, 2, 2', '3, 3, 2', '3, 3, 2', '4, 3, 2', '4, 3, 2', '4, 3, 3', '4, 3, 3', '4, 4, 3'] },
      { day: 1, name: 'Pull ups', kind: 'straight', family: 'pull', rest: '180 - 300 sec', weeks: PULLUP_WEEKS, list: ['14, 12, 11', '15, 13, 12, 11', '15, 13, 13, 12', '15, 14, 13, 13', '16, 14, 14, 13', '16, 15, 14, 14', '17, 15, 15, 14', '17, 16, 15, 15', '18, 16, 16, 15', '18, 17, 16, 16', '19, 17, 17, 16', '19, 18, 17, 17', '20, 18, 18, 17'] },
      { day: 1, name: 'Dips EMOM', kind: 'emom', family: 'dip', rest: 'every 60 sec', weeks: ODD_WEEKS, list: [flatRounds(9), flatRounds(10), altRounds(11, 10), flatRounds(11), threeRounds(12, 11, 10), altRounds(12, 11), flatRounds(12), threeRounds(13, 12, 11), altRounds(13, 12), flatRounds(13), threeRounds(14, 13, 12), altRounds(14, 13)] },
      { day: 1, name: 'Push ups + Bodyweight rows superset', kind: 'superset', family: 'push', sets: 6, rest: 'under 60 sec', weeks: EVEN_WEEKS, list: ['16 + 11', '18 + 11', '18 + 12', '20 + 12', '20 + 13', '22 + 13', '22 + 14', '24 + 14', '24 + 15', '26 + 15', '26 + 16', '28 + 16'] },
      { day: 1, name: 'Tempo bodyweight rows', kind: 'skill', rest: '90 sec', tempo: '0 - 1 - 3', list: ['10, 10, 9, 9, 8, 8', '10, 10, 9, 9, 8, 8', '10, 10, 9, 9, 8, 8', '10, 10, 9, 9, 8, 8', '10, 10, 10, 9, 9, 9', '10, 10, 10, 9, 9, 9', '10, 10, 10, 9, 9, 9', '10, 10, 10, 9, 9, 9', '11, 10, 10, 10, 9, 9', '11, 10, 10, 10, 9, 9', '11, 10, 10, 10, 9, 9', '11, 10, 10, 10, 9, 9'] },
      { day: 1, name: 'Knee raises ladder', kind: 'fixed', text: '5, 6, 7 ... to max', rest: '30 sec interval' },
      { day: 2, name: 'Dips', kind: 'straight', family: 'dip', rest: '180 - 300 sec', weeks: EVERY_WEEK, list: ['20, 17, 16', '21, 18, 17, 16', '21, 18, 18, 17', '21, 19, 18, 18', '21, 19, 19, 19', '22, 20, 19, 19', '22, 20, 20, 20', '23, 21, 20, 20', '23, 21, 21, 21', '24, 22, 21, 21', '24, 22, 22, 22', '25, 23, 22, 22', '25, 23, 23, 23'] },
      { day: 2, name: 'Pull ups EMOM', kind: 'emom', family: 'pull', rest: 'every 60 sec', weeks: ODD_WEEKS, list: [altRounds(7, 6), flatRounds(7), threeRounds(8, 7, 6), altRounds(8, 7), flatRounds(8), threeRounds(9, 8, 7), altRounds(9, 8), flatRounds(9), threeRounds(10, 9, 8), altRounds(10, 9), flatRounds(10), threeRounds(11, 10, 9)] },
      { day: 2, name: 'Neutral pull ups pyramid', kind: 'pyramid', family: 'pull', rest: 'under 60 sec', weeks: EVEN_WEEKS, list: ['3, 6, 9, 9, 6, 3', '5, 8, 11, 8, 5, 3', '5, 8, 11, 11, 5, 3', '4, 8, 12, 8, 4', '4, 8, 12, 12, 4', '4, 8, 12, 12, 8', '4, 8, 12, 12, 8, 4', '5, 9, 13, 9, 5', '5, 9, 13, 13, 5', '5, 9, 13, 13, 9', '5, 9, 13, 13, 9, 5', '6, 10, 14, 10, 6'] },
      { day: 2, name: 'Chair dips', kind: 'range', sets: 4, rest: '60 - 90 sec', weeks: RANGE_WEEKS, list: ['16 to 20', '18 to 22', '20 to 24', '22 to 26'] },
      { day: 2, name: 'Split squat + squat superset', kind: 'fixed', text: '4 sets of 10 + 10', rest: '90 sec', load: 'Weight vest up to 20kg' },
      { day: 3, name: 'Muscle ups w/ band ladder', kind: 'skill', rest: '180 - 300 sec', load: 'Light band', list: ['4, 3, 2, 1', '4, 3, 2, 2', '4, 3, 2, 2', '4, 3, 3, 2', '4, 3, 3, 2', '4, 4, 3, 2', '4, 4, 3, 2', '5, 4, 3, 2', '5, 4, 3, 2', '5, 4, 3, 3', '5, 4, 3, 3', '5, 4, 4, 3'] },
      { day: 3, name: 'Dips pyramid', kind: 'pyramid', family: 'dip', rest: '60 - 90 sec', weeks: EVERY_WEEK, list: ['8, 10, 12, 12, 10, 8', '10, 12, 14, 12, 10, 8', '10, 12, 14, 14, 10, 8', '9, 12, 15, 12, 9', '9, 12, 15, 15, 9', '9, 12, 15, 15, 12', '9, 12, 15, 15, 12, 9', '10, 13, 16, 13, 10', '10, 13, 16, 16, 10', '10, 13, 16, 16, 13', '10, 13, 16, 16, 13, 10', '11, 14, 17, 14, 11', '11, 14, 17, 17, 11'] },
      { day: 3, name: 'Pull up ladder', kind: 'ladder', family: 'pull', rest: 'under 60 sec', weeks: EVERY_WEEK, list: ['10, 9, 8, 7, 6, 5', '11, 10, 8, 7, 6, 5', '11, 10, 9, 8, 6, 5', '11, 10, 9, 8, 7, 6', '12, 11, 9, 8, 7, 6', '12, 11, 10, 9, 7, 6', '12, 11, 10, 9, 8, 7', '13, 12, 10, 9, 8, 7', '13, 12, 11, 10, 8, 7', '13, 12, 11, 10, 9, 8', '14, 13, 11, 10, 9, 8', '14, 13, 12, 11, 9, 8', '14, 13, 12, 11, 10, 9'] },
      { day: 3, name: 'Inclined push ups', kind: 'range', sets: 4, rest: '90 sec', weeks: RANGE_WEEKS, list: ['26 to 32', '28 to 34', '30 to 36', '32 to 38'] },
      { day: 3, name: 'Tempo australian chin ups', kind: 'range', sets: 4, rest: '90 - 180 sec', tempo: '0 - 1 - 3', weeks: RANGE_WEEKS, list: ['8 to 12', '9 to 13', '10 to 14', '11 to 15'] },
      { day: 3, name: 'Knee raises ladder', kind: 'fixed', text: '5, 6, 7 ... to max', rest: '30 sec interval' },
      { day: 4, name: 'Pull ups pyramid', kind: 'pyramid', family: 'pull', rest: '60 - 90 sec', weeks: EVERY_WEEK, list: ['2, 4, 6, 8, 8, 6, 4, 2', '3, 5, 7, 9, 8, 6, 4, 2', '3, 5, 7, 9, 9, 6, 4, 2', '4, 7, 10, 10, 7, 4', '5, 8, 11, 8, 5', '5, 8, 11, 11, 5', '5, 8, 11, 11, 8', '5, 8, 11, 11, 8, 5', '6, 9, 12, 9, 6', '6, 9, 12, 12, 6', '6, 9, 12, 12, 9', '6, 9, 12, 12, 9, 6', '7, 10, 13, 10, 7'] },
      { day: 4, name: 'Push ups ladder', kind: 'ladder', family: 'push', rest: 'under 60 sec', weeks: EVERY_WEEK, list: ['27, 24, 21, 18, 15, 12', '29, 26, 21, 18, 15, 12', '29, 26, 23, 20, 15, 12', '29, 26, 23, 20, 17, 14', '31, 28, 23, 20, 17, 14', '31, 28, 25, 22, 17, 14', '31, 28, 25, 22, 19, 16', '33, 30, 25, 22, 19, 16', '33, 30, 27, 24, 19, 16', '33, 30, 27, 24, 21, 18', '35, 32, 27, 24, 21, 18', '35, 32, 29, 26, 21, 18', '35, 32, 29, 26, 23, 20'] },
      { day: 4, name: 'Bodyweight tricep extensions', kind: 'fixed', text: '4 sets of 10 to 15', rest: '60 - 90 sec' },
      { day: 4, name: 'Close grip chin ups', kind: 'range', sets: 4, rest: '60 - 90 sec', weeks: RANGE_WEEKS, list: ['6 to 8', '7 to 9', '8 to 10', '9 to 11'] },
      { day: 4, name: 'Nordic hamstring curl', kind: 'fixed', text: '3 sets of 4 to 6', rest: '90 - 180 sec', load: 'Weight vest up to 20kg' },
      { day: 4, name: 'Single leg deadlift', kind: 'fixed', text: '3 sets of 8 to 10', rest: '90 sec', load: 'Weight vest up to 20kg' }
    ]
  }
};

function repsTotal(reps) {
  return reps.reduce((sum, reps) => sum + reps, 0);
}

function parseEntry(exercise, text) {
  if (exercise.kind === 'range') {
    const [low, high] = text.split(' to ').map(Number);
    return { reps: Array(exercise.sets).fill(low), high };
  }
  if (exercise.kind === 'superset') {
    const pair = text.split('+').map(Number);
    return { reps: Array.from({ length: exercise.sets * 2 }, (_, i) => pair[i % 2]) };
  }
  return { reps: text.split(',').map(Number) };
}

function preparePlan(key) {
  const plan = TEST_PLANS[key];
  if (plan.ready) return plan;
  plan.exercises.forEach((exercise, index) => {
    exercise.id = 'ex' + index;
    if (exercise.kind === 'fixed') return;
    // A skill keeps its weekly list, with repeats. Other exercises only move when they get a step.
    const list = exercise.kind === 'skill'
      ? exercise.list
      : exercise.list.filter((text, i) => i === 0 || text !== exercise.list[i - 1]);
    exercise.seq = list.map((text) => parseEntry(exercise, text));
    if (exercise.weights) exercise.seq.forEach((entry, i) => { entry.load = exercise.weights[i]; });
  });
  plan.ready = true;
  return plan;
}

function lighterReps(exercise, reps) {
  const lowered = exercise.kind === 'superset'
    ? reps.slice(0, -2).map((n) => Math.max(n - 1, 1))
    : reps.slice(0, -1).map((n) => Math.max(n - 1, 1));
  // Targets do not go below the adaptation week
  return repsTotal(lowered) < repsTotal(exercise.seq[0].reps) ? exercise.seq[0].reps.slice() : lowered;
}

function currentTarget(exercise, state) {
  const entry = exercise.seq[state.idx];
  const base = state.custom || entry.reps;
  return {
    reps: state.lighter ? lighterReps(exercise, base) : base.slice(),
    high: entry.high,
    load: entry.load || exercise.load || '',
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
  while (amount > 0 && repsTotal(result) > 0) {
    if (result[i] > 0) { result[i] -= 1; amount -= 1; }
    i = (i - 1 + result.length) % result.length;
  }
  return result;
}

// Reps logged by the quick buttons: 'hit', 'close', 'big' or 'easy'
function fillActual(exercise, target, week, type) {
  if (type === 'close' || type === 'big') return removeReps(target.reps, missAmount(repsTotal(target.reps), type));
  // Range exercises reach the top number just before the plan moves them up
  if (exercise.kind === 'range' && (type === 'easy' || exercise.weeks.includes(week + 1))) {
    return target.reps.map(() => target.high);
  }
  return target.reps.slice();
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
  const totals = { pull: 0, dip: 0, push: 0 };
  plan.exercises.forEach((exercise) => {
    if (!exercise.family) return;
    const reps = targets[exercise.id].reps;
    totals[exercise.family] += exercise.kind === 'superset'
      ? repsTotal(reps.filter((_, i) => i % 2 === 0))
      : repsTotal(reps);
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

function closestStep(exercise, state, limit) {
  let best = 0;
  for (let i = 0; i <= state.idx; i += 1) {
    if (repsTotal(exercise.seq[i].reps) <= limit) best = i;
  }
  return best;
}

function advanceExercise(exercise, state, target, entry, week, day) {
  const next = week + 1;
  const last = exercise.seq.length - 1;
  const actual = entry.actual.map((n) => n || 0);
  const goal = repsTotal(target.reps);
  const done = repsTotal(actual);
  const lowRecovery = day.energy <= 2 || day.sleep <= 2;
  const hit = exercise.kind === 'range' ? actual.every((n) => n >= target.reps[0]) : done >= goal;
  const detail = `Did ${done} of ${goal} reps.`;
  const result = { status: 'hit', done, goal, notable: false, text: '' };

  if (!hit) {
    const closeLimit = Math.max(goal * TEST_RULES.closePercent, TEST_RULES.closeReps);
    result.status = goal - done <= closeLimit ? 'close' : 'big';
    result.notable = true;
    const label = result.status === 'close' ? 'Close miss' : 'Big miss';

    if (lowRecovery) {
      result.status = 'low';
      result.text = `${detail} Low energy or sleep, so this does not count as a real miss. Same target next week.`;
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
    if (result.status === 'big') {
      result.text = `${label}. ${detail} Repeats the same target once.`;
      return result;
    }
    const spare = Math.max(1, Math.round(done * 0.04));
    if (exercise.kind === 'straight') {
      state.custom = rebuildFromActual(target, actual);
      result.text = `${label}. ${detail} Next target is rebuilt from what was actually done, with sets more even.`;
    } else if (['emom', 'ladder', 'superset'].includes(exercise.kind)) {
      const before = state.idx;
      state.idx = closestStep(exercise, state, done + spare);
      result.text = state.idx < before
        ? `${label}. ${detail} Steps back to the closest target to what was actually done.`
        : `${label}. ${detail} Repeats the same target.`;
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
    const customTotal = repsTotal(state.custom);
    const found = exercise.seq.findIndex((step) => repsTotal(step.reps) > customTotal);
    state.custom = null;
    state.idx = found === -1 ? last : found;
    result.notable = true;
    result.text = 'Rebuilt target hit. Rejoins the plan at the next step up.';
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
  if (done > goal && exercise.kind !== 'pyramid') {
    let reached = state.idx;
    exercise.seq.forEach((step, i) => { if (i > reached && repsTotal(step.reps) <= done) reached = i; });
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
  return result;
}

// Replays the logged weeks, then assumes every target is hit for the weeks still to come
function runPlan(plan, logs) {
  const states = {};
  plan.exercises.forEach((exercise) => {
    if (exercise.kind !== 'fixed') states[exercise.id] = { idx: 0, custom: null, lighter: false, stall: 0 };
  });
  const weeks = [];
  const adaptive = plan.exercises.filter((exercise) => exercise.kind !== 'fixed');

  for (let week = 1; week <= 12; week += 1) {
    const targets = {};
    adaptive.forEach((exercise) => { targets[exercise.id] = currentTarget(exercise, states[exercise.id]); });
    const logged = logs[week];
    const log = logged || hitLog(plan, targets, week);
    const results = {};
    adaptive.forEach((exercise) => {
      results[exercise.id] = advanceExercise(exercise, states[exercise.id], targets[exercise.id], log.ex[exercise.id], week, log.days[exercise.day]);
    });
    const totals = familyTotals(plan, targets);

    // Weekly limit on each movement. The jump out of the adaptation week is exempt.
    if (week >= 2) {
      ['pull', 'dip', 'push'].forEach((family) => {
        const members = adaptive.filter((exercise) => exercise.family === family);
        const nextTotal = () => {
          const nextTargets = {};
          adaptive.forEach((exercise) => { nextTargets[exercise.id] = currentTarget(exercise, states[exercise.id]); });
          return familyTotals(plan, nextTargets)[family];
        };
        members.slice().reverse().forEach((exercise) => {
          if (results[exercise.id].extra && nextTotal() > totals[family] * (1 + TEST_RULES.weeklyLimit)) {
            states[exercise.id].idx = states[exercise.id].beforeExtra;
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
  let text;
  const reps = target.reps;
  if (exercise.kind === 'range') {
    text = `${reps[0]} to ${target.high}`;
  } else if (exercise.kind === 'superset') {
    text = `${reps[0]} + ${reps[1]} x${reps.length / 2}`;
  } else if (reps.length >= 9 && exercise.kind === 'emom') {
    const period = [1, 2, 3].find((p) => reps.every((n, i) => n === reps[i % p]));
    text = period ? `${reps.slice(0, period).join('/')} x${reps.length}` : reps.join(', ');
  } else {
    text = reps.join(', ');
  }
  return text;
}

const TEST_MAIN = ['Pull ups', 'Dips', 'Pull ups EMOM', 'Dips EMOM'];

const TEST_SCENARIOS = [
  { id: 'all', label: 'Hits every target', description: 'The plan exactly as drafted.', pick: () => 'hit' },
  { id: 'pull', label: 'Pull-ups get hard', description: 'Close misses on pull-ups and pull-up EMOMs in weeks 5 to 8.', pick: (exercise, week) => (['Pull ups', 'Pull ups EMOM'].includes(exercise.name) && week >= 5 && week <= 8 ? 'close' : 'hit') },
  { id: 'strong', label: 'Finds it too easy', description: 'Ticks "too easy" on pull-ups, dips and both EMOMs from week 2.', pick: (exercise, week) => (TEST_MAIN.includes(exercise.name) && week >= 2 ? 'easy' : 'hit') },
  { id: 'bad', label: 'One bad week', description: 'Week 6: poor sleep, low energy, big misses on everything.', pick: (exercise, week) => (week === 6 ? 'big' : 'hit'), day: (week) => (week === 6 ? { energy: 2, sleep: 2, effort: 9 } : defaultDay()) },
  { id: 'stuck', label: 'Stuck on one exercise', description: 'Big misses on the pull-up EMOM in weeks 5, 6 and 7.', pick: (exercise, week) => (exercise.name === 'Pull ups EMOM' && week >= 5 && week <= 7 ? 'big' : 'hit') }
];

function scenarioLogs(plan, scenario) {
  const logs = {};
  for (let week = 1; week <= 12; week += 1) {
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
