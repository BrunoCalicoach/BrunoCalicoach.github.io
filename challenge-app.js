// Member area for the 12-week challenge: login, starting test, program, logging and history.
// The publishable key is safe in public code. Database rules limit members to their own rows.
const db = window.supabase.createClient(
  'https://nhohgqpvxuibtrtnqewn.supabase.co',
  'sb_publishable_eDXtsUYHrXDELNfE_0LrTA_KPesC0dp'
);

const app = document.getElementById('app');
const pageTitle = document.getElementById('page-title');
const signOutButton = document.getElementById('sign-out');
const backLink = document.getElementById('back-link');
const PAGE_URL = location.origin + location.pathname;

const state = { user: null, profile: null, logs: [], week: 1 };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([name, value]) => {
    if (name === 'class') node.className = value;
    else node[name] = value;
  });
  node.append(...children);
  return node;
}

function show(title, ...nodes) {
  pageTitle.textContent = title;
  app.replaceChildren(...nodes);
}

function message(text, isError) {
  return el('p', { class: 'text-sm mt-4 text-center ' + (isError ? 'text-red-600' : 'text-green-600'), textContent: text });
}

function field(label, props) {
  const input = el('input', { class: 'field', required: true, ...props });
  return { input, node: el('label', { class: 'block font-semibold mt-5 first:mt-0' }, label, input) };
}

// Disables the button while saving and shows any error under the form
function submitHandler(form, button, action) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait...';
    form.querySelector('[data-message]')?.remove();
    let result;
    try {
      result = await action();
    } catch (error) {
      result = { error: 'Something went wrong. Please check your connection and try again.' };
    }
    button.disabled = false;
    button.textContent = label;
    if (result?.error || result?.success) {
      const note = message(result.error || result.success, Boolean(result.error));
      note.dataset.message = 'true';
      form.append(note);
    }
  });
}

/* ---------- Login, sign up and password reset ---------- */

function showAuth(mode) {
  signOutButton.classList.add('hidden');
  backLink.classList.remove('hidden');

  const titles = { login: 'Log in', signup: 'Create your account', reset: 'Reset your password' };
  const buttons = { login: 'Log in', signup: 'Create account', reset: 'Send reset link' };

  const email = field('Email', { type: 'email', autocomplete: 'email' });
  const password = field('Password', {
    type: 'password',
    minLength: 8,
    autocomplete: mode === 'signup' ? 'new-password' : 'current-password'
  });
  const button = el('button', { type: 'submit', class: 'btn-primary w-full py-4 rounded-xl font-semibold mt-6', textContent: buttons[mode] });

  const form = el('form', { class: 'card' }, email.node);
  if (mode !== 'reset') form.append(password.node);
  form.append(button);

  submitHandler(form, button, async () => {
    if (mode === 'reset') {
      const { error } = await db.auth.resetPasswordForEmail(email.input.value, { redirectTo: PAGE_URL });
      return error ? { error: error.message } : { success: 'If that email has an account, a reset link is on its way.' };
    }
    if (mode === 'signup') {
      const { data, error } = await db.auth.signUp({
        email: email.input.value,
        password: password.input.value,
        options: { emailRedirectTo: PAGE_URL }
      });
      if (error) return { error: error.message };
      return data.session ? null : { success: 'Almost done! Open the confirmation email we just sent you, then log in.' };
    }
    const { error } = await db.auth.signInWithPassword({ email: email.input.value, password: password.input.value });
    return error ? { error: 'Wrong email or password, or your email is not confirmed yet.' } : null;
  });

  const switcher = (text, target) => {
    const link = el('button', { type: 'button', class: 'link-button', textContent: text });
    link.addEventListener('click', () => showAuth(target));
    return link;
  };
  const links = el('div', { class: 'flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm' });
  if (mode !== 'login') links.append(switcher('Log in', 'login'));
  if (mode !== 'signup') links.append(switcher('Create an account', 'signup'));
  if (mode !== 'reset') links.append(switcher('Forgot password?', 'reset'));

  show(titles[mode], form, links);
}

function showNewPassword() {
  const password = field('New password', { type: 'password', minLength: 8, autocomplete: 'new-password' });
  const button = el('button', { type: 'submit', class: 'btn-primary w-full py-4 rounded-xl font-semibold mt-6', textContent: 'Save new password' });
  const form = el('form', { class: 'card' }, password.node, button);

  submitHandler(form, button, async () => {
    const { error } = await db.auth.updateUser({ password: password.input.value });
    if (error) return { error: error.message };
    await loadMember();
    return null;
  });

  show('Choose a new password', form);
}

/* ---------- Starting test ---------- */

function showStartingTest() {
  const inputs = CHALLENGE_EXERCISES.map((exercise) => ({
    key: exercise.key,
    ...field('Max ' + exercise.name.toLowerCase(), {
      type: 'number',
      min: 0,
      max: exercise.key === 'pushups' ? 500 : 200,
      step: 1,
      inputMode: 'numeric'
    })
  }));

  const button = el('button', { type: 'submit', class: 'btn-primary w-full py-4 rounded-xl font-semibold mt-6', textContent: 'Create my 12-week plan' });
  const form = el('form', { class: 'card' },
    el('p', { class: 'text-gray-500 leading-relaxed mb-6', textContent: 'Warm up, then do as many clean reps as you can of each exercise, with a good rest between them. Enter 0 if you cannot do one yet.' }),
    ...inputs.map((item) => item.node),
    button
  );

  submitHandler(form, button, async () => {
    const maxes = Object.fromEntries(inputs.map((item) => [item.key, Number(item.input.value)]));
    const program = generateChallengeProgram(maxes);
    const { data, error } = await db.from('challenge_profiles')
      .insert({ user_id: state.user.id, ...maxes, level: program.level, program })
      .select()
      .single();
    if (error) return { error: 'Your plan could not be saved. Please try again.' };
    state.profile = data;
    showProgram();
    return null;
  });

  show('Your starting test', form);
}

/* ---------- Program and logging ---------- */

function findLog(week, day) {
  return state.logs.find((log) => log.week === week && log.day === day);
}

function firstUnfinishedWeek() {
  const week = state.profile.program.weeks.find((item) => item.days.some((day) => !findLog(item.week, day.day)));
  return week ? week.week : 12;
}

function sessionCard(week, day) {
  const log = findLog(week.week, day.day);
  const inputs = [];

  const exercises = day.exercises.map((exercise) => {
    const saved = log?.results?.[exercise.key] || [];
    const row = el('div', { class: 'flex flex-wrap gap-2 mt-3' });

    for (let set = 0; set < exercise.sets; set++) {
      const input = el('input', {
        class: 'set-input',
        type: 'number',
        min: 0,
        max: 500,
        step: 1,
        inputMode: 'numeric',
        value: saved[set] ?? '',
        placeholder: exercise.reps ?? 'max',
        ariaLabel: exercise.name + ', set ' + (set + 1)
      });
      inputs.push({ key: exercise.key, input });
      row.append(input);
    }

    const target = exercise.reps === null ? 'As many clean reps as you can' : exercise.sets + ' sets × ' + exercise.reps + ' reps';
    return el('div', { class: 'mt-5' },
      el('div', { class: 'flex flex-wrap justify-between gap-x-4' },
        el('span', { class: 'font-semibold', textContent: exercise.name }),
        el('span', { class: 'text-gray-500 text-sm', textContent: target })
      ),
      row
    );
  });

  const notes = el('textarea', { class: 'field', rows: 2, maxLength: 1000, placeholder: 'Notes (optional)', value: log?.notes || '' });
  const button = el('button', { type: 'submit', class: 'btn-primary w-full py-3 rounded-xl font-semibold mt-5', textContent: log ? 'Update session' : 'Save session' });
  const status = el('span', {
    class: 'text-sm font-semibold ' + (log ? 'text-green-600' : 'text-gray-400'),
    textContent: log ? '✓ Done ' + log.completed_on : 'Not done yet'
  });

  const sessionKey = week.week + '-' + day.day;
  const form = el('form', { class: 'card' },
    el('div', { class: 'flex flex-wrap justify-between items-center gap-x-4' },
      el('h3', { class: 'font-extrabold text-lg', textContent: 'Day ' + day.day + ' · ' + day.title }),
      status
    ),
    el('p', { class: 'text-gray-500 text-sm mt-2', textContent: 'Enter the reps you did in each set. Grey numbers are your targets.' }),
    ...exercises,
    notes,
    button
  );
  if (state.savedSession === sessionKey) form.append(message('Session saved.', false));

  submitHandler(form, button, async () => {
    if (inputs.every(({ input }) => input.value === '')) {
      return { error: 'Enter your reps for at least one set first.' };
    }
    const results = {};
    inputs.forEach(({ key, input }) => {
      (results[key] = results[key] || []).push(input.value === '' ? null : Number(input.value));
    });
    const { data, error } = await db.from('session_logs')
      .upsert({
        user_id: state.user.id,
        week: week.week,
        day: day.day,
        results,
        notes: notes.value.trim() || null,
        completed_on: log?.completed_on || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,week,day' })
      .select()
      .single();
    if (error) return { error: 'Your session could not be saved: ' + error.message };
    state.logs = state.logs.filter((item) => item.id !== data.id).concat(data);
    state.savedSession = sessionKey;
    showProgram();
    return null;
  });

  return form;
}

function historyCard() {
  const { profile, logs } = { profile: state.profile, logs: state.logs };
  const rows = [...logs].sort((a, b) => b.week - a.week || b.day - a.day).map((log) => {
    const totals = CHALLENGE_EXERCISES.map((exercise) => {
      const reps = (log.results[exercise.key] || []).reduce((sum, value) => sum + value, 0);
      return exercise.name + ': ' + reps;
    }).join(' · ');
    return el('li', { class: 'py-3 border-t border-gray-100' },
      el('div', { class: 'flex flex-wrap justify-between gap-x-4 font-semibold text-sm' },
        el('span', { textContent: 'Week ' + log.week + ', day ' + log.day }),
        el('span', { class: 'text-gray-500 font-normal', textContent: log.completed_on })
      ),
      el('p', { class: 'text-gray-500 text-sm mt-1', textContent: 'Total reps · ' + totals }),
      log.notes ? el('p', { class: 'text-gray-500 text-sm mt-1 break-words', textContent: log.notes }) : ''
    );
  });

  const finalTest = findLog(12, 3);
  const comparison = finalTest
    ? el('p', { class: 'font-semibold mt-3', textContent: 'Your progress: ' + CHALLENGE_EXERCISES.map((exercise) =>
        exercise.name + ' ' + profile[exercise.key] + ' → ' + (finalTest.results[exercise.key]?.[0] ?? 0)).join(', ') })
    : '';

  return el('div', { class: 'card mt-8' },
    el('h2', { class: 'font-extrabold text-xl', textContent: 'Progress history' }),
    el('p', { class: 'text-gray-500 text-sm mt-2', textContent: 'Starting test: ' + CHALLENGE_EXERCISES.map((exercise) => exercise.name + ' ' + profile[exercise.key]).join(', ') }),
    comparison,
    rows.length
      ? el('ul', { class: 'mt-4' }, ...rows)
      : el('p', { class: 'text-gray-500 text-sm mt-4', textContent: 'Your saved sessions will appear here.' })
  );
}

function showProgram() {
  const { profile, logs } = state;
  const weeks = profile.program.weeks;
  const total = weeks.reduce((sum, week) => sum + week.days.length, 0);
  const percent = Math.round((logs.length / total) * 100);
  const current = weeks.find((week) => week.week === state.week);

  const summary = el('div', { class: 'card' },
    el('div', { class: 'flex flex-wrap justify-between gap-x-4 font-semibold' },
      el('span', { textContent: 'Level: ' + profile.level }),
      el('span', { class: 'text-gray-500 font-normal', textContent: logs.length + ' of ' + total + ' sessions done' })
    ),
    el('div', { class: 'h-2 bg-gray-100 rounded-full overflow-hidden mt-3' },
      el('div', { class: 'h-full bg-red-500', style: 'width:' + percent + '%' })
    )
  );

  const selector = el('div', { class: 'flex flex-wrap gap-2 mt-8' }, ...weeks.map((week) => {
    const button = el('button', {
      type: 'button',
      class: 'week-button' + (week.week === state.week ? ' active' : ''),
      textContent: week.week,
      ariaLabel: 'Week ' + week.week
    });
    button.addEventListener('click', () => {
      state.week = week.week;
      state.savedSession = null;
      showProgram();
    });
    return button;
  }));

  const heading = el('h2', { class: 'font-extrabold text-2xl mt-8', textContent: 'Week ' + current.week + (current.lighter ? ' · Lighter week' : '') });
  const sessions = el('div', { class: 'space-y-5 mt-5' }, ...current.days.map((day) => sessionCard(current, day)));

  signOutButton.classList.remove('hidden');
  backLink.classList.add('hidden');
  show('Your 12-week plan', summary, selector, heading, sessions, historyCard());
}

/* ---------- Loading ---------- */

async function loadMember() {
  signOutButton.classList.remove('hidden');
  backLink.classList.add('hidden');

  const [profileResult, logsResult] = await Promise.all([
    db.from('challenge_profiles').select('*').eq('user_id', state.user.id).maybeSingle(),
    db.from('session_logs').select('*').eq('user_id', state.user.id)
  ]);

  if (profileResult.error || logsResult.error) {
    show('Your 12-week plan', message('Your plan could not be loaded. Please refresh the page and try again.', true));
    return;
  }

  state.profile = profileResult.data;
  state.logs = logsResult.data;

  if (!state.profile) {
    showStartingTest();
    return;
  }
  state.week = firstUnfinishedWeek();
  showProgram();
}

signOutButton.addEventListener('click', () => db.auth.signOut());

// Supabase asks not to run other requests directly inside this listener, so they wait a tick
db.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    const previousId = state.user?.id;
    state.user = session?.user || null;

    if (event === 'PASSWORD_RECOVERY') {
      showNewPassword();
    } else if (event === 'SIGNED_OUT' || !state.user) {
      state.profile = null;
      state.logs = [];
      showAuth('login');
    } else if (event === 'INITIAL_SESSION' || (event === 'SIGNED_IN' && previousId !== state.user.id)) {
      loadMember();
    }
  }, 0);
});
