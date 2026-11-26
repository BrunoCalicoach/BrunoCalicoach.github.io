// Meal plan builder for coach.html, laid out for phones first: plan tabs, a compact summary with macro bars,
// one card per meal with coloured counters, and a full-screen "Add food" window (search, barcode scan,
// My foods / Food library / Recipes). Foods come from the USDA library (coaching-foods.js) or Bruno's own foods.

let OWN_FOODS = [];

async function loadOwnFoods() {
  try {
    const rows = await Data.select('coaching_foods', {}, ['name']);
    OWN_FOODS = rows.map((r) => ({ id: r.id, name: r.name, cat: r.cat, own: true, note: r.note, ...r.per100, al: r.allergens || [] }));
  } catch (e) { console.warn('Own foods not loaded', e); }
}

const FOOD_CATS = { protein: 'Protein', dairy: 'Dairy', legumes: 'Legumes', carbs: 'Carbs', fruit: 'Fruit', veg: 'Vegetables', fats: 'Fats', other: 'Other' };

// Foods this athlete may not have are left out; hiddenOut.count says how many matches were hidden
function searchFoods(query, block, hiddenOut, pool = [...OWN_FOODS, ...FOOD_LIBRARY], limit = 40) {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (hiddenOut) hiddenOut.count = 0;
  return pool.map((f) => {
    const name = f.name.toLowerCase();
    if (words.length && !words.every((w) => name.includes(w))) return null;
    if (!isAllowed(f, block)) { if (hiddenOut) hiddenOut.count++; return null; }
    const score = (words.length && name.startsWith(words[0]) ? 0 : 1) + (f.own ? -0.5 : 0) + name.length / 1000;
    return { f, score };
  }).filter(Boolean).sort((a, b) => (words.length ? a.score - b.score : a.f.name.localeCompare(b.f.name))).slice(0, limit).map((x) => x.f);
}

// Food groups by dominating nutrient, worked out from the values per 100 g, so own and athlete foods join in too.
// Shares are of the energy from macros (4 kcal/g protein and carbs, 9 kcal/g fat). A food can sit in more than one group.
function macroShares(f) {
  const P = 4 * (f.p || 0), C = 4 * (f.c || 0), F = 9 * (f.f || 0), E = P + C + F || 1;
  return { p: P / E, c: C / E, f: F / E, fibPer100kcal: ((f.fib || 0) / (f.kcal || 1)) * 100 };
}
const groupPct = (x) => `${Math.round(x * 100)}%`;
const FOOD_GROUPS = [
  { key: 'protein', label: 'Protein', hint: 'At least half the calories from protein: lean meat, fish, egg whites, whey, skyr, cottage cheese.',
    test: (s) => s.p >= 0.5, sort: (s) => -s.p, tag: (s) => `${groupPct(s.p)} protein` },
  { key: 'protfat', label: 'Protein + fat', hint: 'Protein with plenty of fat: whole eggs, salmon, fattier meat, cheese, tofu.',
    test: (s) => s.p >= 0.25 && s.p < 0.5 && s.f >= 0.4, sort: (s) => -s.p, tag: (s) => `${groupPct(s.p)} protein · ${groupPct(s.f)} fat` },
  { key: 'protcarb', label: 'Protein + carbs', hint: 'Protein with plenty of carbs: lentils, beans, chickpeas, peas.',
    test: (s, f) => s.p >= 0.2 && s.c >= 0.45 && (f.kcal || 0) >= 60, sort: (s) => -s.p, tag: (s) => `${groupPct(s.p)} protein · ${groupPct(s.c)} carbs` },
  { key: 'carbs', label: 'Carbs', hint: 'Mostly carbohydrate and energy-dense: rice, oats, pasta, bread, potatoes, banana, dried fruit.',
    test: (s, f) => s.c >= 0.65 && s.p < 0.2 && (f.kcal || 0) >= 70, sort: (s, f) => (f.cat === 'carbs' && (f.sug || 0) < 40 ? 0 : (f.sug || 0) >= 40 ? 2 : 1), tag: (s) => `${groupPct(s.c)} carbs` },
  { key: 'fats', label: 'Fats', hint: 'At least half the calories from fat: oils, nuts, seeds, nut butters, avocado.',
    test: (s) => s.f >= 0.5 && s.p < 0.25, sort: (s) => -s.f, tag: (s) => `${groupPct(s.f)} fat` },
  { key: 'fibre', label: 'Fibre-rich', hint: 'At least 2 g fibre per 100 g and 3 g per 100 kcal, or 7 g per 100 g: vegetables, berries, legumes, oats, chia, flax.',
    test: (s, f) => ((f.fib || 0) >= 2 && s.fibPer100kcal >= 3) || (f.fib || 0) >= 7, sort: (s, f) => -(f.fib || 0), tag: (s, f) => `${fmt(f.fib || 0, 1)} g fibre` },
  { key: 'light', label: 'Low calorie', hint: '45 kcal or less per 100 g: lots of volume for few calories, handy on a cut.',
    test: (s, f) => (f.kcal || 0) <= 45, sort: (s, f) => f.kcal || 0, tag: () => '' },
  { key: 'dairy', label: 'Dairy', hint: 'Milk, yogurt, kefir, skyr and cheese.', test: (s, f) => f.cat === 'dairy', sort: (s) => -s.p, tag: (s) => `${groupPct(s.p)} protein` },
  { key: 'produce', label: 'Fruit & veg', hint: 'All fruit and vegetables.',
    test: (s, f) => f.cat === 'fruit' || f.cat === 'veg', sort: () => 0, tag: () => '' }
];
const inFoodGroup = (f, group) => !group || group.test(macroShares(f), f);
function sortByGroup(list, group) {
  if (!group) return list;
  return list.slice().sort((a, b) => (group.sort(macroShares(a), a) - group.sort(macroShares(b), b)) || a.name.localeCompare(b.name));
}

function macroLine(v, digits = 0) {
  return `${fmt(v.kcal, 0)} kcal · P ${fmt(v.p, digits)} g · C ${fmt(v.c, digits)} g · F ${fmt(v.f, digits)} g`;
}

function coloredMacros(v, digits = 1) {
  return el('div', { class: 'fmacros' },
    el('span', { class: 'carb' }, `C ${fmt(v.c, digits)}`), el('span', { class: 'prot' }, `P ${fmt(v.p, digits)}`), el('span', { class: 'fat' }, `F ${fmt(v.f, digits)}`));
}

function toast(text) {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}

// Small pop-up menu next to a button (the ⋮ menus)
function popMenu(anchor, items) {
  document.getElementById('pop-menu')?.remove();
  const menu = el('div', { class: 'ctx', id: 'pop-menu' }, ...items.filter(Boolean).map(([label, fn, danger]) =>
    el('button', { type: 'button', style: danger ? 'color:#ff9d96' : '', onclick: () => { menu.remove(); fn(); } }, label)));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8) + 'px';
  setTimeout(() => document.addEventListener('mousedown', function off(e) {
    if (!e.target.closest('#pop-menu')) { menu.remove(); document.removeEventListener('mousedown', off); }
  }), 0);
}

// meals: { plans: [plans of 3 meals], note, split }, target: { kcal, protein, fat, carbs } or null, onChange(): save,
// block: this athlete's allergies (see blockFor)
// athlete: { name, foods } - the foods this athlete added at home (Athlete's foods tab)
function mealPlanEditor(meals, target, onChange, block, athlete = { name: 'Athlete', foods: [] }) {
  if (!Array.isArray(meals.plans) || isLegacyMealPlan(meals.plans) || !meals.plans.length) meals.plans = [emptyMealDay(1)];
  let active = 0;
  const node = el('div', { class: 'stack' });

  // Every food in any plan that this athlete must not have
  function blockedList() {
    const out = [];
    meals.plans.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => {
      const why = blockedReasons(it, block);
      if (why.length) out.push(`${d.title} · ${m.name}: ${it.name} (${why.join(', ')})`);
    })));
    return out;
  }

  // Foods already used in this athlete's plans, most recent plan first: the "Recent" list in the Add food window
  function recentFoods() {
    const seen = new Map();
    [...meals.plans].reverse().forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => {
      if (seen.has(it.food)) return;
      const f = FOOD_LIBRARY.find((x) => x.id === it.food) || OWN_FOODS.find((x) => x.id === it.food) || { id: it.food, name: it.name, ...it.per100, al: it.al };
      seen.set(it.food, { food: f, g: it.g });
    })));
    return [...seen.values()];
  }

  function draw() {
    active = Math.min(active, meals.plans.length - 1);
    const day = meals.plans[active];
    const split = mealSplit(meals);

    const planMenu = el('button', { class: 'kebab', type: 'button', 'aria-label': 'Plan options', onclick: (e) => popMenu(e.currentTarget, [
      ['Rename this plan', () => { const n = prompt('Plan name', day.title); if (n && n.trim()) { day.title = n.trim(); onChange(); draw(); } }],
      ['Add an empty plan', () => { meals.plans.push(emptyMealDay(meals.plans.length + 1)); active = meals.plans.length - 1; onChange(); draw(); }],
      ['Duplicate this plan', () => {
        const copy = clone(day); copy.id = uid(); copy.title = `Plan ${meals.plans.length + 1}`;
        copy.meals.forEach((m) => { m.id = uid(); m.items.forEach((it) => { it.id = uid(); }); });
        meals.plans.push(copy); active = meals.plans.length - 1; onChange(); draw();
      }],
      meals.plans.length > 1 ? ['Delete this plan', () => { if (confirm(`Delete ${day.title}?`)) { meals.plans.splice(active, 1); onChange(); draw(); } }, true] : null
    ]) }, '⋮');
    const tabs = el('div', { class: 'row nowrap' },
      el('div', { class: 'seg grow', style: 'overflow-x:auto;flex-wrap:nowrap' }, ...meals.plans.map((d, i) => el('button', { type: 'button', class: i === active ? 'active' : '', style: 'white-space:nowrap', onclick: () => { active = i; draw(); } }, d.title || `Plan ${i + 1}`))),
      planMenu);

    const summary = el('div');
    const updateDay = () => summary.replaceChildren(macroSummary(mealTotals(dayItems(day)), target));
    const mealCards = day.meals.map((meal, i) => mealCard(meal, () => { updateDay(); onChange(); }, target, i, split[i]));
    updateDay();

    // Allergy check across all plans, with one button to replace every blocked food
    const blocked = blockedList();
    const allergyNotice = block?.any && blocked.length ? el('div', { class: 'notice warn' },
      el('div', {}, el('b', {}, 'Allergies: '), [...block.allergens.map(allergenLabel), ...block.avoid].join(', ')),
      el('ul', { class: 'small', style: 'margin:6px 0;padding-left:18px' }, ...blocked.map((b) => el('li', {}, b))),
      el('button', { class: 'btn small primary', type: 'button', onclick: () => {
        const left = [];
        meals.plans.forEach((d) => d.meals.forEach((m, i) => {
          left.push(...replaceBlockedFoods(m, mealTargetFor(target, split[i]), block).map((n) => `${d.title} · ${m.name}: ${n}`));
        }));
        onChange(); draw();
        if (left.length) alert('No safe equivalent kept these meals on target, please change them by hand:\n' + left.join('\n'));
      } }, 'Replace allergy foods in all plans')) : null;

    node.replaceChildren(...[tabs,
      el('div', { class: 'card tight' }, summary,
        target ? null : el('p', { class: 'tiny muted', style: 'text-align:center;margin-top:6px' }, 'No targets yet: set them under "Daily targets" below.')),
      allergyNotice,
      ...mealCards,
      settingsCard(day, split)].filter(Boolean));
  }

  // Less used settings, folded away: meal split, fibre/vitamins/minerals of this plan, note above the plans
  function settingsCard(day, split) {
    const t = mealTotals(dayItems(day));
    const splitInputs = split.map((v) => el('input', { class: 'set-in', style: 'width:64px;padding:7px 4px', inputMode: 'numeric', value: String(v) }));
    const splitMsg = el('span', { class: 'small muted' });
    splitInputs.forEach((inp) => inp.addEventListener('change', () => {
      const vals = splitInputs.map((x) => num(x.value) || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.5) { splitMsg.className = 'small msg err'; splitMsg.textContent = `Adds up to ${sum}%, needs to be 100%.`; return; }
      meals.split = vals; onChange(); draw();
    }));
    const note = el('textarea', { class: 'field', style: 'min-height:50px', value: meals.note || '', placeholder: 'Note above the meal plans, e.g. "Almonds, hazelnuts and cashews can be swapped"' });
    note.addEventListener('input', () => { meals.note = note.value; onChange(); });
    return el('details', { class: 'card tight' },
      el('summary', { style: 'cursor:pointer;font-weight:700' }, 'Plan settings, vitamins and minerals'),
      el('div', { class: 'stack', style: 'margin-top:12px' },
        el('div', { class: 'row small' }, el('b', {}, 'Meal split:'),
          ...day.meals.map((m, i) => el('label', { class: 'row nowrap', style: 'gap:4px' }, m.name || `Meal ${i + 1}`, splitInputs[i], '%')), splitMsg),
        el('p', { class: 'tiny muted' }, 'Every meal gets this share of the daily targets. A meal that fits its target can be swapped by the athlete for the same meal in any other plan.'),
        el('div', {}, el('div', { class: 'small', style: 'font-weight:700;margin-bottom:6px' }, `Fibre, vitamins and minerals (${day.title})`),
          el('div', { class: 'chips' }, ...MICROS.map(([k, label, unit]) =>
            el('span', { class: 'chip' }, `${label} `, el('b', {}, t.known[k] === false ? `≥${fmt(t[k], 1)}` : fmt(t[k], 1)), ` ${unit}`))),
          el('p', { class: 'tiny muted', style: 'margin-top:6px' }, '"≥" means one or more foods have no value for that nutrient in the source data.')),
        el('label', { class: 'lab' }, 'Note shown above the meal plans', note),
        el('button', { class: 'btn small', type: 'button', onclick: () => ownFoodDialog() }, '+ Add your own food (from a label)')));
  }

  function mealCard(meal, changed, dayTarget, index, share) {
    const target = mealTargetFor(dayTarget, share);
    const counters = el('div');
    const headStats = el('div', { class: 'meal-stats' });
    const fitLine = el('div', { class: 'meal-fit' });
    const list = el('ul', { class: 'meal-items' });
    const card = el('div', { class: 'card meal-card' });
    let editing = null; // id of the food whose amount is open for editing

    const update = () => {
      const t = mealTotals(meal.items);
      counters.replaceChildren(macroCounters(t, target));
      headStats.replaceChildren(el('span', { class: 'meal-kcal' }, `${fmt(t.kcal, 0)} kcal`), macroDonut(t, 30));
      const fit = target && meal.items.length ? mealFit(t, target) : null;
      fitLine.replaceChildren(...[
        fit ? el('span', { class: 'pill ' + (fit.ok ? 'good' : 'warn') }, fit.ok ? '✓ Fits its target, swappable' : 'Off: ' + fit.issues.join(', ')) : null,
        target ? el('span', { class: 'muted' }, `Target ${share}% of the day`) : null].filter(Boolean));
    };
    // Each food: grams as a chip, the name with a slim macro bar underneath, calories on the right.
    // Tap a food to see its exact carbs, protein and fat and to change the amount.
    const drawRows = () => {
      list.replaceChildren(...meal.items.flatMap((it, i) => {
        const t = mealTotals([it]);
        const why = blockedReasons(it, block);
        const own = OWN_FOODS.find((f) => f.id === it.food);
        const source = it.food?.startsWith('usda:') ? '' : it.food?.startsWith('ath:') ? `Added by ${athlete.name.split(' ')[0]}` : (own?.note && !/^Open Food Facts/.test(own.note) ? own.note : '');
        const chip = el('span', { class: 'gram-chip' }, `${fmt(num(it.g), 0)} g`);
        const kcal = el('div', { class: 'fkcal' }, fmt(t.kcal, 0));
        const bar = el('div', {}, macroMiniBar(t));
        const rowEl = el('li', { class: 'food-row' + (editing === it.id ? ' open' : ''), role: 'button', tabindex: 0, 'aria-expanded': String(editing === it.id),
          title: it.food?.startsWith('usda:') ? `USDA FoodData Central ${it.food.slice(5)}` : 'Own food',
          onclick: () => { editing = editing === it.id ? null : it.id; drawRows(); },
          onkeydown: (e) => { if (e.key === 'Enter') { editing = editing === it.id ? null : it.id; drawRows(); } } },
          chip,
          el('div', { class: 'info' },
            el('div', { class: 'fname' }, it.name, why.length ? el('span', { class: 'pill bad', style: 'margin-left:6px' }, `Allergy: ${why.join(', ')}`) : null),
            source ? el('div', { class: 'fsub' }, source) : null,
            bar),
          kcal);
        if (editing !== it.id) return [rowEl];
        const g = el('input', { class: 'set-in gram', inputMode: 'decimal', value: it.g ?? '', 'aria-label': `Grams of ${it.name}` });
        const exact = el('div', {}, coloredMacros(t));
        g.addEventListener('input', () => {
          it.g = num(g.value) || 0;
          const nt = mealTotals([it]);
          chip.textContent = `${fmt(num(it.g), 0)} g`;
          kcal.textContent = fmt(nt.kcal, 0);
          bar.replaceChildren(macroMiniBar(nt));
          exact.replaceChildren(coloredMacros(nt));
          update(); changed();
        });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { editing = null; drawRows(); } });
        setTimeout(() => { g.focus(); g.select(); }, 0);
        return [rowEl, el('li', { class: 'food-edit' },
          el('div', { class: 'row nowrap', style: 'gap:4px' }, g, el('span', { class: 'small muted' }, 'g')),
          exact,
          el('div', { class: 'grow' }),
          i > 0 ? el('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Move up', onclick: () => { meal.items.splice(i - 1, 0, meal.items.splice(i, 1)[0]); drawRows(); changed(); } }, '↑') : null,
          i < meal.items.length - 1 ? el('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Move down', onclick: () => { meal.items.splice(i + 1, 0, meal.items.splice(i, 1)[0]); drawRows(); changed(); } }, '↓') : null,
          el('button', { class: 'btn small danger', type: 'button', onclick: () => { meal.items.splice(i, 1); editing = null; drawRows(); update(); changed(); } }, 'Remove'),
          el('button', { class: 'btn small primary', type: 'button', onclick: () => { editing = null; drawRows(); } }, 'Done'))];
      }));
    };
    drawRows(); update();

    const title = el('h3', {}, meal.name);
    const addLabel = el('span', {}, `Add food to ${meal.name}`);
    const menu = el('button', { class: 'kebab', type: 'button', 'aria-label': `Options for ${meal.name}`, onclick: (e) => popMenu(e.currentTarget, [
      ['Rename', () => { const n = prompt('Meal name', meal.name); if (n && n.trim()) { meal.name = n.trim(); title.textContent = meal.name; addLabel.textContent = `Add food to ${meal.name}`; changed(); } }],
      target && meal.items.length ? ['Fit to target (adjust grams)', () => {
        const ok = fitMealToTarget(meal, target);
        drawRows(); update(); changed();
        toast(ok ? 'Fits its target now' : 'Closer, but these foods cannot hit every macro');
      }] : null,
      meal.items.some((it) => !isAllowed(it, block)) ? ['Replace allergy foods', () => {
        const left = replaceBlockedFoods(meal, target, block);
        drawRows(); update(); changed();
        if (left.length) alert(`No safe swap kept the meal on target for: ${left.join(', ')}. Change it by hand.`);
      }] : null,
      ['Note for this meal', () => { const n = prompt('Note for this meal (preparation, swaps)', meal.note || ''); if (n !== null) { meal.note = n.trim(); changed(); drawNote(); } }],
      meal.items.length ? ['Remove all foods', () => { if (confirm(`Remove every food from ${meal.name}?`)) { meal.items = []; drawRows(); update(); changed(); } }, true] : null
    ]) }, '⋮');
    const noteLine = el('p', { class: 'small soft pre', style: 'margin-top:8px' });
    const drawNote = () => { noteLine.textContent = meal.note || ''; noteLine.classList.toggle('hidden', !meal.note); };
    drawNote();

    const add = el('button', { class: 'add-food', type: 'button', onclick: () => openFoodSheet(meal, block, recentFoods(), athlete, () => { drawRows(); update(); changed(); }) },
      el('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), addLabel);

    card.append(
      el('div', { class: 'meal-head' },
        el('span', { class: 'meal-num' }, String(index + 1).padStart(2, '0')),
        mealIcon(index), title, headStats, menu),
      list, noteLine, add, counters, fitLine);
    return card;
  }

  draw();
  return node;
}

/* ---------- Full-screen "Add food" window ---------- */

function openFoodSheet(meal, block, recent, athlete, onAdded) {
  let tab = 'mine';
  let open = null; // id of the food whose amount panel is open
  const hidden = { count: 0 };
  const search = el('input', { type: 'search', placeholder: 'Search foods', autocomplete: 'off', 'aria-label': 'Search foods' });
  const body = el('div', { class: 'sheet-body' });
  const tabs = el('div', { class: 'sheet-tabs' });
  // Food groups by dominating nutrient (Protein, Carbs, Fats, Fibre-rich…): a filter on top of the tab and the search
  let group = null;
  const groupBar = el('div', { class: 'group-chips', role: 'group', 'aria-label': 'Food groups' });
  // The foods of a pool that pass the search, the athlete's allergies and the chosen group; without a search, best of the group first
  const pick = (q, pool, limit) => {
    const found = searchFoods(q, block, hidden, pool.filter((f) => inFoodGroup(f, group)), limit);
    return q ? found : sortByGroup(found, group);
  };
  const close = () => { sheet.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal-back')) close(); };

  const scanBtn = el('button', { class: 'btn ghost icon-btn', type: 'button', 'aria-label': 'Scan a barcode', title: 'Scan a barcode', onclick: () => scanBarcode((food) => { tab = 'mine'; open = food.id; search.value = ''; draw(); }) }, barcodeIcon());
  const sheet = el('div', { class: 'food-sheet', role: 'dialog', 'aria-label': `Add food to ${meal.name}` },
    el('div', { class: 'sheet-top' },
      el('div', { class: 'sheet-bar' },
        el('button', { class: 'btn ghost icon-btn', type: 'button', 'aria-label': 'Back', onclick: close }, icon('left')),
        el('h2', {}, `Add to ${meal.name}`),
        el('button', { class: 'btn small primary', type: 'button', onclick: close }, 'Done')),
      el('div', { class: 'search-box' }, icon('info', 0), search, scanBtn),
      tabs, groupBar),
    body);
  sheet.querySelector('.search-box span')?.remove(); // keep the box clean: the search field says what it is

  function row(food, defaultG) {
    const per = { kcal: food.kcal || 0, p: food.p || 0, c: food.c || 0, f: food.f || 0 };
    const tag = group ? group.tag(macroShares(food), food) : '';
    const btn = el('button', { class: 'food-pick', type: 'button', onclick: () => { open = open === food.id ? null : food.id; draw(); } },
      el('div', { class: 'top' }, el('b', {}, food.name, food.own ? el('span', { class: 'pill teal', style: 'margin-left:6px' }, 'Own') : null), el('span', { class: 'k' }, `${fmt(per.kcal, 0)} kcal`)),
      el('div', { class: 'sub' }, el('span', {}, food.athlete ? `Added by ${athlete.name.split(' ')[0]}` : food.own ? (food.note || 'Your food') : 'USDA', ' · per 100 g'), coloredMacros(per),
        tag ? el('span', { class: `group-tag ${group.key}` }, tag) : null));
    if (open !== food.id) return [btn];
    const g = el('input', { class: 'set-in gram', inputMode: 'decimal', value: String(defaultG || 100), 'aria-label': `Grams of ${food.name}` });
    const preview = el('div', { class: 'small' });
    const showPreview = () => { const t = mealTotals([newMealItem(food, num(g.value) || 0)]); preview.replaceChildren(el('b', { style: 'color:var(--kcal)' }, `${fmt(t.kcal, 0)} kcal `), coloredMacros(t)); };
    g.addEventListener('input', showPreview);
    showPreview();
    const addIt = () => {
      const grams = num(g.value);
      if (!grams) { g.focus(); return; }
      meal.items.push(newMealItem(food, grams));
      onAdded();
      recent.unshift({ food, g: grams });
      open = null;
      toast(`Added ${food.name}, ${fmt(grams, 0)} g`);
      draw();
    };
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });
    const panel = el('div', { class: 'amount-panel row nowrap' },
      el('div', { class: 'row nowrap', style: 'gap:4px' }, g, el('span', { class: 'small muted' }, 'g')),
      el('div', { class: 'grow' }, preview),
      el('button', { class: 'btn small primary', type: 'button', onclick: addIt }, 'Add'));
    setTimeout(() => { g.focus(); g.select(); }, 0);
    return [btn, panel];
  }

  function draw() {
    tabs.replaceChildren(...[['mine', 'My foods'], ['library', 'Food library'], ['athlete', `${athlete.name.split(' ')[0]}'s foods`]].map(([k, l]) =>
      el('button', { type: 'button', class: tab === k ? 'active' : '', onclick: () => { tab = k; open = null; draw(); } }, l)));
    groupBar.replaceChildren(...[null, ...FOOD_GROUPS].map((g) => el('button', { type: 'button', class: `group-chip ${g ? g.key : 'all'}${group === g ? ' active' : ''}`, 'aria-pressed': String(group === g),
      onclick: () => { group = g; open = null; draw(); body.scrollTop = 0; groupBar.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } }, g ? g.label : 'All')));
    const q = search.value.trim();
    const out = [];
    if (group) out.push(el('p', { class: 'group-hint' }, group.hint));
    if (tab === 'athlete') {
      // Foods the athlete scanned or typed in at home (local brands); they appear here as soon as they are saved
      const theirs = pick(q, athlete.foods, 200);
      out.push(el('div', { class: 'sheet-section' }, `Added by ${athlete.name}`));
      if (theirs.length) theirs.forEach((f) => out.push(...row(f)));
      else out.push(el('p', { class: 'small muted', style: 'padding:4px' }, athlete.foods.length ? 'No match.'
        : `${athlete.name.split(' ')[0]} hasn't added any foods yet. PRO athletes can scan or type in foods they have at home from their Nutrition tab, and they show up here.`));
    } else if (tab === 'mine') {
      const recents = recent.filter((r) => isAllowed(r.food, block) && inFoodGroup(r.food, group) && (!q || r.food.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);
      if (recents.length) { out.push(el('div', { class: 'sheet-section' }, 'Recent')); recents.forEach((r) => out.push(...row(r.food, r.g))); }
      const own = pick(q, OWN_FOODS, 200);
      out.push(el('div', { class: 'sheet-section' }, 'My foods'));
      if (own.length) own.forEach((f) => out.push(...row(f)));
      else out.push(el('p', { class: 'small muted', style: 'padding:4px' }, !OWN_FOODS.length ? 'No own foods yet. Scan a barcode or add one from a label.'
        : group ? `None of your own foods is in ${group.label}.` : 'No match in your foods.'));
      out.push(el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn small', type: 'button', onclick: () => ownFoodDialog((food) => { open = food.id; draw(); }) }, '+ Add your own food'),
        q || group ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => { tab = 'library'; draw(); } },
          q ? `Search "${q}" in the Food library →` : `${group.label} in the Food library →`) : null));
    } else {
      const lib = pick(q, FOOD_LIBRARY, q ? 60 : 200);
      out.push(el('div', { class: 'sheet-section' }, q || group ? `${lib.length} food${lib.length === 1 ? '' : 's'}${group ? ` in ${group.label}` : ''}${q ? ` matching "${q}"` : ''} · per 100 g raw or dry`
        : `Food library · ${FOOD_LIBRARY.length} foods, per 100 g raw or dry`));
      lib.forEach((f) => out.push(...row(f)));
      if (!lib.length) out.push(el('p', { class: 'small muted', style: 'padding:4px' }, 'Nothing found. Try another word, or scan the product\'s barcode.'));
    }
    if (hidden.count) out.push(el('p', { class: 'tiny muted', style: 'padding:8px 4px' }, `${hidden.count} food${hidden.count > 1 ? 's' : ''} hidden because of this athlete's allergies.`));
    body.replaceChildren(...out);
  }

  search.addEventListener('input', () => { open = null; draw(); });
  document.addEventListener('keydown', esc);
  document.body.style.overflow = 'hidden';
  document.body.append(sheet);
  draw();
  setTimeout(() => search.focus(), 50);
}

function barcodeIcon() {
  const s = el('span', { style: 'display:inline-flex' });
  s.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>';
  return s;
}

/* ---------- Barcode: scan with the camera, then look the product up ---------- */

const SCANNER_SRC = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
function loadScanner() {
  if (window.Html5Qrcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = el('script', { src: SCANNER_SRC });
    s.onload = resolve; s.onerror = () => reject(new Error('The scanner could not load. Check the connection.'));
    document.head.append(s);
  });
}

// Opens the camera (or a field to type the number). A known own food is used straight away; a new product is
// looked up in Open Food Facts and opened in "Add your own food" with its label values filled in for checking.
// Where a scanned or typed food is saved: Bruno's own foods (default) or one athlete's foods (see coaching.js)
const COACH_FOOD_STORE = {
  prefix: 'own',
  foods: () => OWN_FOODS,
  found: 'Found in your foods',
  intro: 'Type the values from the nutrition label. Your foods appear first in the search.',
  async save(row) { await Data.upsert('coaching_foods', row); await loadOwnFoods(); return OWN_FOODS.find((f) => f.id === row.id); }
};

function scanBarcode(onFood, store = COACH_FOOD_STORE) {
  const box = el('div', { class: 'scan-box', id: 'scan-box' });
  const manual = el('input', { class: 'field', inputMode: 'numeric', placeholder: 'Or type the barcode number' });
  const msg = el('p', { class: 'msg' });
  let scanner = null, done = false;
  const stop = async () => { try { if (scanner?.isScanning) await scanner.stop(); } catch (e) { /* already stopped */ } };
  const m = modal('Scan a barcode',
    box,
    el('p', { class: 'tiny muted' }, 'Hold the barcode inside the frame. Works with EAN and UPC codes on food packs.'),
    el('div', { class: 'row nowrap' }, el('div', { class: 'grow' }, manual), el('button', { class: 'btn', type: 'button', onclick: () => found(manual.value) }, 'Look up')),
    msg);
  const closeAll = async () => { await stop(); m.close(); };
  m.box.closest('.modal-back').addEventListener('click', (e) => { if (e.target.classList.contains('modal-back')) stop(); });
  m.box.querySelector('button[aria-label="Close"]').addEventListener('click', stop);

  async function found(raw) {
    const code = String(raw || '').replace(/\D/g, '');
    if (done) return;
    if (code.length < 8) { msg.className = 'msg err'; msg.textContent = 'That doesn\'t look like a barcode (8 to 14 digits).'; return; }
    done = true;
    await stop();
    const known = store.foods().find((f) => f.id === `${store.prefix}:bc:${code}`);
    if (known) { m.close(); toast(`${store.found}: ${known.name}`); onFood(known); return; }
    msg.className = 'msg'; msg.textContent = `Looking up ${code}…`;
    try {
      const prefill = await lookupBarcode(code);
      m.close();
      ownFoodDialog((food) => onFood(food), prefill, store);
    } catch (e) {
      done = false;
      msg.className = 'msg err';
      msg.textContent = e.message;
      if (/not found/i.test(e.message)) {
        msg.append(' ', el('button', { class: 'btn small', type: 'button', onclick: () => { m.close(); ownFoodDialog((food) => onFood(food), { barcode: code }, store); } }, 'Enter it from the label'));
      }
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    box.replaceChildren(el('p', { class: 'small muted', style: 'padding:16px' }, 'No camera available here. Type the number under the barcode instead.'));
    return;
  }
  loadScanner().then(() => {
    if (!document.getElementById('scan-box')) return;
    const F = window.Html5QrcodeSupportedFormats;
    scanner = new window.Html5Qrcode('scan-box', { verbose: false, formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E] });
    return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 140 } }, (text) => found(text), () => {});
  }).catch((e) => {
    box.replaceChildren(el('p', { class: 'small muted', style: 'padding:16px' }, /permission|denied|notallowed/i.test(String(e?.name || e)) ? 'Camera access was not allowed. Allow it in the browser settings, or type the number below.' : (e?.message || 'The camera could not start. Type the number below.')));
  });
  void closeAll;
}

// Open Food Facts (open, crowd-sourced label data, ODbL). Only the barcode number is sent.
const OFF_ALLERGENS = { 'en:gluten': 'gluten', 'en:crustaceans': 'crustaceans', 'en:eggs': 'eggs', 'en:fish': 'fish', 'en:peanuts': 'peanuts',
  'en:soybeans': 'soy', 'en:milk': 'milk', 'en:nuts': 'nuts', 'en:celery': 'celery', 'en:mustard': 'mustard', 'en:sesame-seeds': 'sesame',
  'en:sulphur-dioxide-and-sulphites': 'sulphites', 'en:lupin': 'lupin', 'en:molluscs': 'molluscs' };
async function lookupBarcode(code) {
  let res;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_hr,product_name_en,brands,quantity,serving_size,serving_quantity,nutriments,allergens_tags,traces_tags`);
  } catch (e) { throw new Error('No connection to the product database. Try again, or enter the food from the label.'); }
  if (res.status === 404) throw new Error(`Product ${code} not found in Open Food Facts.`);
  if (!res.ok) throw new Error(`The product database answered with an error (${res.status}). Try again in a minute.`);
  const data = await res.json();
  if (data.status === 0 || !data.product) throw new Error(`Product ${code} not found in Open Food Facts.`);
  const p = data.product, n = p.nutriments || {};
  const v = (k) => (n[k] === undefined || n[k] === '' ? undefined : Math.round(Number(n[k]) * 10) / 10);
  // Values for a reference amount: "_100g" (Open Food Facts' per-100 g figures) or "_serving" (per pack serving)
  const valuesFor = (suffix) => ({
    kcal: v(`energy-kcal${suffix}`) ?? (n[`energy${suffix}`] ? Math.round(Number(n[`energy${suffix}`]) / 4.184) : undefined),
    p: v(`proteins${suffix}`), c: v(`carbohydrates${suffix}`), f: v(`fat${suffix}`), fib: v(`fiber${suffix}`), sug: v(`sugars${suffix}`),
    sat: v(`saturated-fat${suffix}`), na: n[`sodium${suffix}`] !== undefined ? Math.round(Number(n[`sodium${suffix}`]) * 1000) : undefined
  });
  const per100 = valuesFor('_100g');
  const servingQty = num(p.serving_quantity);
  const perServing = servingQty ? valuesFor('_serving') : null;
  // Some products only have per-serving values: then the form starts on the serving and saves them converted to per 100 g
  const useServing = per100.kcal === undefined && perServing?.kcal !== undefined;
  const al = [...(p.allergens_tags || []), ...(p.traces_tags || [])].map((t) => OFF_ALLERGENS[t]).filter(Boolean);
  return {
    barcode: code,
    name: [p.brands?.split(',')[0]?.trim(), p.product_name_en || p.product_name || p.product_name_hr].filter(Boolean).join(' ') || `Product ${code}`,
    values: useServing ? perServing : per100,
    per: useServing ? servingQty : 100,
    serving: servingQty ? { qty: servingQty, label: p.serving_size || `${servingQty} g` } : null,
    allergens: [...new Set(al)],
    note: `Open Food Facts, barcode ${code}`
  };
}

// What the athlete changed in the published plan (only swaps still based on the current meal count)
function athleteSwaps() {
  const plans = C.d.meals?.plans;
  const choices = C.d.choices || {};
  const lines = [];
  if (Array.isArray(plans) && !isLegacyMealPlan(plans)) {
    for (const day of plans) {
      day.meals.forEach((meal, mi) => {
        const ch = choices[day.id]?.[mi];
        if (!ch || ch.basedOn !== mealSignature(meal)) return;
        const what = [ch.from ? `uses ${ch.from}` : null, ...(ch.swaps || [])].filter(Boolean).join('; ');
        lines.push(el('li', {}, el('b', {}, `${day.title} · ${meal.name}: `), what));
      });
    }
  }
  return el('details', { class: 'card tight' }, el('summary', { style: 'cursor:pointer;font-weight:700' }, `Athlete's swaps${lines.length ? ` (${lines.length})` : ''}`),
    el('div', { style: 'margin-top:10px' }, lines.length ? el('ul', { class: 'small soft', style: 'margin:0;padding-left:18px' }, ...lines)
      : el('p', { class: 'small muted' }, 'No swaps yet. When the athlete swaps a meal or a food, it shows here. Changing a meal yourself resets the athlete\'s swap for that meal.')));
}

// Bruno's own food from a label (or a scanned product): values per 100 g, with a check that calories fit the macros.
// prefill: { name, per100, allergens, note, barcode } from a barcode lookup. onSaved(food) gets the new food.
function ownFoodDialog(onSaved, prefill = {}, store = COACH_FOOD_STORE) {
  const name = el('input', { class: 'field', placeholder: 'e.g. Zbregov protein shake (brand, product)', value: prefill.name || '' });
  const cat = el('select', { class: 'select field' }, ...Object.entries(FOOD_CATS).map(([k, l]) => el('option', { value: k }, l)));
  const fields = [['kcal', 'Calories (kcal)'], ['p', 'Protein (g)'], ['c', 'Carbohydrates (g)'], ['f', 'Fat (g)'], ['fib', 'Fibre (g)'], ['sug', 'Sugars (g)'], ['sat', 'Saturated fat (g)'], ['na', 'Sodium (mg) = salt g × 400']];
  const startValues = prefill.values || prefill.per100 || {};
  const inputs = Object.fromEntries(fields.map(([k]) => [k, el('input', { class: 'field', inputMode: 'decimal', value: startValues[k] ?? '' })]));
  const source = el('input', { class: 'field', placeholder: 'Source, e.g. "label, 2026"', value: prefill.note || '' });
  const have = new Set(prefill.allergens || []);
  const alBoxes = ALLERGENS.map(([k, label]) => ({ k, box: el('input', { type: 'checkbox', value: k, checked: have.has(k) }), label }));
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary' }, 'Save food');

  // "Values per": the amount the numbers below refer to. Changing it recalculates every value; saving always
  // stores them per 100 g, so a label that only shows "per 32 g scoop" can be typed exactly as printed.
  let perAmount = num(prefill.per) || 100;
  const perIn = el('input', { class: 'field per-in', inputMode: 'decimal', value: String(perAmount), 'aria-label': 'Values per (grams)' });
  const per100Line = el('p', { class: 'tiny muted' });
  const roundFor = (k, x) => (k === 'kcal' || k === 'na' ? Math.round(x) : Math.round(x * 10) / 10);
  const showPer100 = () => {
    const kcal = num(inputs.kcal.value);
    per100Line.textContent = perAmount !== 100 && kcal !== null
      ? `Saved per 100 g: ${fmt((kcal * 100) / perAmount, 0)} kcal · C ${fmt(((num(inputs.c.value) || 0) * 100) / perAmount, 1)} g · P ${fmt(((num(inputs.p.value) || 0) * 100) / perAmount, 1)} g · F ${fmt(((num(inputs.f.value) || 0) * 100) / perAmount, 1)} g`
      : 'The app always saves the values per 100 g, so meal plans stay accurate.';
  };
  const perButtons = el('div', { class: 'row small', style: 'gap:6px' });
  const drawPerButtons = () => perButtons.replaceChildren(
    perAmount !== 100 ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => setPer(100) }, 'Show per 100 g') : null,
    prefill.serving && prefill.serving.qty !== perAmount ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => setPer(prefill.serving.qty) }, `Show per serving (${prefill.serving.label})`) : null);
  function setPer(next) {
    next = num(next);
    if (!next || next <= 0 || next > 5000) { perIn.value = String(perAmount); return; }
    const k = next / perAmount;
    for (const [key] of fields) { const x = num(inputs[key].value); if (x !== null) inputs[key].value = String(roundFor(key, x * k)); }
    perAmount = next; perIn.value = String(next); showPer100(); drawPerButtons();
  }
  // One row per value: coloured marker, name, box, unit
  function macroInput(k, label, unit, cls = '', hint = '') {
    inputs[k].classList.add('minput');
    inputs[k].setAttribute('aria-label', `${label} (${unit})`);
    return el('label', { class: `macro-input ${cls}` }, el('span', { class: 'dot' }),
      el('span', { class: 'mname' }, label, hint ? el('span', { class: 'tiny muted', style: 'display:block;font-weight:400' }, hint) : null),
      inputs[k], el('span', { class: 'unit' }, unit));
  }
  // Live check: do protein, carbs and fat add up to the calories? (same rule as when saving)
  const check = el('div', { class: 'macro-check' });
  const updateCheck = () => {
    const v = (k) => num(inputs[k].value);
    if (v('p') === null || v('c') === null || v('f') === null) { check.replaceChildren(el('span', { class: 'tiny muted' }, 'Fill in calories, carbs, protein and fat to check they add up.')); return; }
    const t = { c: v('c'), p: v('p'), f: v('f') };
    const calc = 4 * t.p + 4 * (t.c - (v('fib') || 0)) + 2 * (v('fib') || 0) + 9 * t.f;
    const kcal = v('kcal');
    const off = kcal !== null && Math.abs(calc - kcal) > Math.max(25 * (perAmount / 100), kcal * 0.15);
    check.replaceChildren(macroDonut(t, 34),
      el('span', { class: 'small ' + (off ? 'accent-warn' : 'soft') },
        kcal === null ? `Macros add up to about ${fmt(calc, 0)} kcal.` : off ? `Macros add up to about ${fmt(calc, 0)} kcal, not ${fmt(kcal, 0)}. Check the label.` : `✓ Macros add up to about ${fmt(calc, 0)} kcal.`));
  };
  perIn.addEventListener('change', () => { setPer(perIn.value); updateCheck(); });
  for (const [key] of fields) inputs[key].addEventListener('input', () => { showPer100(); updateCheck(); });
  showPer100(); drawPerButtons(); updateCheck();

  const m = modal(prefill.barcode ? 'New product' : 'Add your own food',
    prefill.values || prefill.per100 ? el('div', { class: 'notice' }, `Found in Open Food Facts (barcode ${prefill.barcode}). This is crowd-sourced label data: check it against the pack before saving.${prefill.serving ? ` Pack serving: ${prefill.serving.label}.` : ''}`)
      : el('p', { class: 'small soft' }, store.intro),
    el('label', { class: 'lab' }, 'Name', name), el('label', { class: 'lab' }, 'Group', cat),
    el('div', { class: 'per-box' },
      el('div', { class: 'row nowrap', style: 'gap:8px' }, el('b', {}, 'Values per'), perIn, el('span', { class: 'soft' }, 'g (or ml)')),
      el('p', { class: 'tiny muted', style: 'margin-top:6px' }, 'Label shows values per serving (e.g. per 32 g scoop)? Enter that amount here first, then type the numbers as printed. Change it later and all values recalculate.'),
      perButtons, per100Line),
    // Main values one below the other, each in its macro colour, with a live check that they add up
    el('div', { class: 'macro-inputs' },
      macroInput('kcal', 'Calories', 'kcal', 'kcal'), macroInput('c', 'Carbs', 'g', 'carb'),
      macroInput('p', 'Protein', 'g', 'prot'), macroInput('f', 'Fat', 'g', 'fat')),
    check,
    el('details', { class: 'more-nutrients', open: ['fib', 'sug', 'sat', 'na'].some((k) => startValues[k] !== undefined && startValues[k] !== null) },
      el('summary', {}, 'More details: fibre, sugars, saturated fat, sodium (optional)'),
      el('div', { class: 'macro-inputs', style: 'margin-top:10px' },
        macroInput('fib', 'Fibre', 'g'), macroInput('sug', 'Sugars', 'g'), macroInput('sat', 'Saturated fat', 'g'),
        macroInput('na', 'Sodium', 'mg', '', 'salt g × 400'))),
    el('div', {}, el('div', { class: 'small', style: 'font-weight:700;margin-bottom:8px' }, 'Allergens', el('span', { class: 'muted', style: 'font-weight:400' }, ' · bold on the label, including "may contain"')),
      el('div', { class: 'allergen-chips' },
        ...alBoxes.map((a) => el('label', { class: 'allergen-chip' }, a.box, a.label.replace(/ \(.*\)/, ''))))),
    el('label', { class: 'lab' }, 'Source', source), save, msg);
  save.addEventListener('click', async () => {
    const per100 = {};
    for (const [k] of fields) { const v = num(inputs[k].value); if (v !== null) per100[k] = v; }
    if (!name.value.trim() || ['kcal', 'p', 'c', 'f'].some((k) => per100[k] === undefined)) {
      msg.className = 'msg err'; msg.textContent = 'Enter a name plus calories, protein, carbohydrates and fat.'; return;
    }
    const calc = 4 * per100.p + 4 * (per100.c - (per100.fib || 0)) + 2 * (per100.fib || 0) + 9 * per100.f;
    if (Math.abs(calc - per100.kcal) > Math.max(25, per100.kcal * 0.15) && !save.dataset.confirmed) {
      msg.className = 'msg err';
      msg.textContent = `Check the numbers: the macros add up to about ${fmt(calc, 0)} kcal, not ${per100.kcal}. Press Save again if the label really says so.`;
      save.dataset.confirmed = '1';
      return;
    }
    // Store per 100 g whatever amount the values were entered for
    if (perAmount !== 100) for (const k of Object.keys(per100)) per100[k] = roundFor(k, (per100[k] * 100) / perAmount);
    const row = { id: prefill.barcode ? `${store.prefix}:bc:${prefill.barcode}` : `${store.prefix}:` + uid(), name: name.value.trim(), cat: cat.value, per100,
      note: source.value.trim() || null, allergens: alBoxes.filter((a) => a.box.checked).map((a) => a.k) };
    try {
      const saved = await store.save(row);
      m.close();
      onSaved?.(saved);
    } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
  });
}
