// The Initial Form: questions an athlete answers once before using the app (Bruno's former Google Form,
// plus the starting details the Nutrition tab used to ask for). Shared by the athlete form (coaching.js)
// and Bruno's Overview tab (coach.js), so both always show the same questions.
// Fields marked profile: true are stored in coaching_profiles (used for calories and macros); the rest in coaching_intake.answers.
// pro: true = asked only of PRO athletes (meal plans). Answers are free text or option keys.

const WEEKDAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

const INTAKE_SECTIONS = [
  { key: 'personal', title: 'About you', icon: 'users',
    intro: 'The basics, so Bruno knows who he is coaching and how to reach you.',
    fields: [
      { key: 'name', label: 'Your full name', type: 'text', required: true },
      { key: 'sex', label: 'Sex', type: 'choice', profile: true, required: true, hint: 'Used to estimate your energy needs.',
        options: [['male', 'Male'], ['female', 'Female']] },
      { key: 'birth_date', label: 'Date of birth', type: 'date', profile: true, required: true },
      { key: 'phone', label: 'Phone number', type: 'tel', required: true, hint: 'Communication happens over WhatsApp. Include the country code, e.g. +385 91 234 5678.' },
      { key: 'email', label: 'Email', type: 'email', required: true, hint: 'Prefilled with your login email; change it if you prefer another one.' }
    ] },
  { key: 'body', title: 'Body and activity', icon: 'scale',
    intro: 'Your starting point. These numbers also set your calorie and macro targets.',
    fields: [
      { key: 'height_cm', label: 'Height', type: 'number', unit: 'cm', profile: true, required: true, min: 100, max: 250 },
      { key: 'start_weight', label: 'Weight', type: 'number', unit: 'kg', profile: true, required: true, min: 30, max: 300, hint: 'Ideally weighed in the morning, after the bathroom and before eating.' },
      { key: 'activity', label: 'Activity level', type: 'choice', profile: true, required: true, wide: true,
        options: () => ACTIVITY_LEVELS.map((a) => [String(a.value), a.label]) },
      { key: 'job', label: 'What kind of work or study do you do?', type: 'choice', required: true,
        options: [['desk', 'Mostly sitting (desk, student)'], ['feet', 'On my feet a lot'], ['physical', 'Physical work'], ['other', 'Something else']] }
    ] },
  { key: 'training', title: 'Training', icon: 'dumbbell',
    intro: 'What you do now, so the first weeks match your current level.',
    fields: [
      { key: 'days_per_week', label: 'How many days a week do you usually work out?', type: 'choice', required: true,
        options: [1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), `${n} day${n > 1 ? 's' : ''}`]) },
      { key: 'session_length', label: 'How long are your training sessions usually?', type: 'choice', required: true,
        options: [['30-45', '30–45 min'], ['45-60', '45–60 min'], ['60-90', '60–90 min'], ['90+', '90+ min']] },
      { key: 'experience', label: 'How long have you been training?', type: 'choice', required: true,
        options: [['<6m', 'Less than 6 months'], ['6-12m', '6–12 months'], ['1-3y', '1–3 years'], ['3y+', 'More than 3 years']] },
      { key: 'sessions', label: 'Describe your workout sessions', type: 'textarea', required: true,
        hint: 'It can be one of the trainings you\'ve been doing: which exercises and methods got you your current results. The more detail, the better Bruno can match the training to your current level.' },
      { key: 'where', label: 'Where do you train?', type: 'multi', required: true,
        options: [['gym', 'Gym'], ['home', 'At home'], ['park', 'Calisthenics park'], ['outdoors', 'Outdoors / running']] },
      { key: 'equipment', label: 'What equipment do you have?', type: 'textarea', hint: 'For example pull-up bar, rings, parallettes, dumbbells, weight vest, resistance bands. Optional if you train in a full gym.' },
      { key: 'weekdays', label: 'Which days can you usually train?', type: 'multi', required: true, options: WEEKDAYS },
      { key: 'train_time', label: 'When do you usually train?', type: 'choice', required: true,
        options: [['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['varies', 'It varies']] }
    ] },
  { key: 'goals', title: 'Goals', icon: 'chart',
    intro: 'Where you want to get to, and what matters most right now.',
    fields: [
      { key: 'goal', label: 'Your body composition goal for now', type: 'choice', profile: true, required: true,
        options: () => Object.entries(GOALS) },
      { key: 'long_term', label: 'What are your long-term goals?', type: 'textarea', required: true },
      { key: 'priorities', label: 'What are your current priority goals?', type: 'textarea', required: true,
        hint: 'Write them in order of importance, the most important first. For example: first muscle-up, 15 strict pull-ups, lose 4 kg.' }
    ] },
  { key: 'health', title: 'Health', icon: 'info',
    intro: 'Only Bruno sees this. It keeps your training safe.',
    fields: [
      { key: 'injuries_now', label: 'Are you dealing with any injuries right now?', type: 'textarea', required: true, hint: 'Write "None" if there are none.' },
      { key: 'injuries_past', label: 'What injuries have you had in the past?', type: 'textarea', required: true, hint: 'Write "None" if there are none.' },
      { key: 'medical', label: 'Do you have any medical conditions, or take medication, that Bruno should know about?', type: 'choice', required: true,
        options: [['no', 'No'], ['yes', 'Yes']] },
      { key: 'medical_details', label: 'Please explain', type: 'textarea', required: true, showIf: (a) => a.medical === 'yes' }
    ] },
  { key: 'nutrition', title: 'Nutrition', icon: 'apple',
    intro: 'How you eat today.',
    fields: [
      { key: 'diet', label: 'What is your diet like?', type: 'textarea', required: true,
        hint: 'Do you eat healthily? Do you follow a specific diet? Do you have an idea how many calories you eat a day? Tell as much as you like.' },
      { key: 'diet_type', label: 'Which describes your diet?', type: 'choice', required: true, pro: true,
        options: [['all', 'I eat everything'], ['pescatarian', 'Pescatarian'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['other', 'Other']] },
      { key: 'allergies', label: 'Food allergies or intolerances', type: 'multi', pro: true,
        options: () => ALLERGENS.map(([k, l]) => [k, l]), hint: 'Tick all that apply. Leave empty if none.' },
      { key: 'avoid', label: 'Foods you don\'t eat or really dislike', type: 'text', pro: true, placeholder: 'e.g. mushrooms, liver, kiwi' },
      { key: 'cooking', label: 'How much do you cook?', type: 'choice', required: true, pro: true,
        options: [['enjoy', 'I enjoy cooking, time is no problem'], ['quick', 'Simple, quick meals'], ['prep', 'I prefer to meal prep a few times a week'], ['rarely', 'I rarely cook / eat out a lot']] },
      { key: 'supplements', label: 'Which supplements do you take?', type: 'text', pro: true, placeholder: 'e.g. whey protein, creatine, vitamin D. Leave empty if none.' }
    ] },
  { key: 'routine', title: 'Daily routine', icon: 'timer',
    intro: 'A normal weekday, so meals and training fit your day.',
    fields: [
      { key: 'wake', label: 'Usual wake-up time', type: 'time', required: true },
      { key: 'bed', label: 'Usual bedtime', type: 'time', required: true },
      { key: 'routine_note', label: 'Anything else about your week Bruno should know?', type: 'textarea', hint: 'Shift work, travel, exams, kids… Optional.' }
    ] }
];

const intakeOptions = (f) => (typeof f.options === 'function' ? f.options() : f.options || []);

// Sections and fields this athlete gets (REGULAR athletes skip the meal-plan questions)
function intakeSectionsFor(pro) {
  return INTAKE_SECTIONS.map((s) => ({ ...s, fields: s.fields.filter((f) => pro || !f.pro) })).filter((s) => s.fields.length);
}

// Answer as readable text for Bruno's overview
function intakeAnswerText(f, v) {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (f.type === 'choice') return intakeOptions(f).find(([k]) => String(k) === String(v))?.[1] || String(v);
  if (f.type === 'multi') return v.map((k) => intakeOptions(f).find(([o]) => o === k)?.[1] || k).join(', ');
  if (f.type === 'date') return niceDate(v, { day: 'numeric', month: 'long', year: 'numeric' }) + (Calc.age(v) !== null ? ` (age ${Calc.age(v)})` : '');
  if (f.type === 'number') return `${fmt(num(v))} ${f.unit || ''}`.trim();
  return String(v);
}

// Problem with one answer, or '' when it is fine
function intakeProblem(f, v) {
  const empty = v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && !v.length);
  if (empty) return f.required ? 'Please answer this question.' : '';
  if (f.type === 'number') { const n = num(v); if (n === null || n < f.min || n > f.max) return `Please enter a number between ${f.min} and ${f.max} ${f.unit}.`; }
  if (f.type === 'date' && f.key === 'birth_date') return Calc.ageProblem(v) || '';
  if (f.type === 'tel' && String(v).replace(/\D/g, '').length < 7) return 'Please enter your full phone number.';
  if (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(String(v))) return 'Please enter a valid email.';
  return '';
}
