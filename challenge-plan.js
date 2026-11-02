// EXAMPLE 12-week plan. Replace these rules with the real challenge plan.
// A member's program is saved when they start, so later rule changes only affect new members.

const CHALLENGE_EXERCISES = [
  { key: 'pullups', name: 'Pull-ups', easier: 'Negative pull-ups', benchmark: 15 },
  { key: 'pushups', name: 'Push-ups', easier: 'Incline push-ups', benchmark: 40 },
  { key: 'dips', name: 'Dips', easier: 'Bench dips', benchmark: 20 }
];

// Share of the starting max used each week. Every 4th week is lighter for recovery.
const CHALLENGE_WEEK_INTENSITY = [0.5, 0.55, 0.6, 0.45, 0.6, 0.65, 0.7, 0.5, 0.7, 0.75, 0.8, 0.55];

const CHALLENGE_DAYS = [
  { day: 1, title: 'Strength', effort: 1, extraSets: 0 },
  { day: 2, title: 'Volume', effort: 0.8, extraSets: 1 },
  { day: 3, title: 'Mixed', effort: 0.9, extraSets: 0 }
];

const CHALLENGE_LEVELS = [
  { name: 'Beginner', below: 0.35, sets: 3 },
  { name: 'Intermediate', below: 0.7, sets: 4 },
  { name: 'Advanced', below: Infinity, sets: 5 }
];

function challengeLevel(maxes) {
  const score = CHALLENGE_EXERCISES.reduce(
    (sum, exercise) => sum + Math.min(maxes[exercise.key] / exercise.benchmark, 1), 0
  ) / CHALLENGE_EXERCISES.length;
  return CHALLENGE_LEVELS.find((level) => score < level.below);
}

function generateChallengeProgram(maxes) {
  const level = challengeLevel(maxes);

  const weeks = CHALLENGE_WEEK_INTENSITY.map((intensity, index) => {
    const week = index + 1;
    const lighter = week % 4 === 0;

    const days = CHALLENGE_DAYS.map((template) => {
      // The last session repeats the starting test to measure progress
      if (week === 12 && template.day === 3) {
        return {
          day: template.day,
          title: 'Final test',
          exercises: CHALLENGE_EXERCISES.map((exercise) => ({
            key: exercise.key,
            name: 'Max ' + exercise.name.toLowerCase(),
            sets: 1,
            reps: null
          }))
        };
      }

      const sets = Math.max(level.sets + template.extraSets - (lighter ? 1 : 0), 2);

      return {
        day: template.day,
        title: template.title,
        exercises: CHALLENGE_EXERCISES.map((exercise) => {
          const max = maxes[exercise.key];
          // Members who cannot do one rep yet start on an easier variation
          const reps = max === 0
            ? 5 + Math.floor(index / 2)
            : Math.max(Math.round(max * intensity * template.effort), 1);
          return { key: exercise.key, name: max === 0 ? exercise.easier : exercise.name, sets, reps };
        })
      };
    });

    return { week, lighter, days };
  });

  return { version: 1, level: level.name, weeks };
}
