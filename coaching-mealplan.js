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
function mealPlanEditor(meals, target, onChange, block) {
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
        const source = it.food?.startsWith('usda:') ? '' : (own?.note && !/^Open Food Facts/.test(own.note) ? own.note : '');
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

    const add = el('button', { class: 'add-food', type: 'button', onclick: () => openFoodSheet(meal, block, recentFoods(), () => { drawRows(); update(); changed(); }) },
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

function openFoodSheet(meal, block, recent, onAdded) {
  let tab = 'mine';
  let open = null; // id of the food whose amount panel is open
  const hidden = { count: 0 };
  const search = el('input', { type: 'search', placeholder: 'Search foods', autocomplete: 'off', 'aria-label': 'Search foods' });
  const body = el('div', { class: 'sheet-body' });
  const tabs = el('div', { class: 'sheet-tabs' });
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
      tabs),
    body);
  sheet.querySelector('.search-box span')?.remove(); // keep the box clean: the search field says what it is

  function row(food, defaultG) {
    const per = { kcal: food.kcal || 0, p: food.p || 0, c: food.c || 0, f: food.f || 0 };
    const btn = el('button', { class: 'food-pick', type: 'button', onclick: () => { open = open === food.id ? null : food.id; draw(); } },
      el('div', { class: 'top' }, el('b', {}, food.name, food.own ? el('span', { class: 'pill teal', style: 'margin-left:6px' }, 'Own') : null), el('span', { class: 'k' }, `${fmt(per.kcal, 0)} kcal`)),
      el('div', { class: 'sub' }, el('span', {}, food.own ? (food.note || 'Your food') : 'USDA', ' · per 100 g'), coloredMacros(per)));
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
    tabs.replaceChildren(...[['mine', 'My foods'], ['library', 'Food library'], ['recipes', 'Recipes']].map(([k, l]) =>
      el('button', { type: 'button', class: tab === k ? 'active' : '', onclick: () => { tab = k; open = null; draw(); } }, l)));
    const q = search.value.trim();
    const out = [];
    if (tab === 'recipes') {
      out.push(el('div', { class: 'card', style: 'margin-top:14px;text-align:center' },
        el('h3', {}, 'Recipes are coming soon'),
        el('p', { class: 'small soft', style: 'margin-top:6px' }, 'Save a group of ingredients once (e.g. "Protein oats") and add them to a meal in one go.')));
    } else if (tab === 'mine') {
      const recents = recent.filter((r) => isAllowed(r.food, block) && (!q || r.food.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);
      if (recents.length) { out.push(el('div', { class: 'sheet-section' }, 'Recent')); recents.forEach((r) => out.push(...row(r.food, r.g))); }
      const own = searchFoods(q, block, hidden, OWN_FOODS, 200);
      out.push(el('div', { class: 'sheet-section' }, 'My foods'));
      if (own.length) own.forEach((f) => out.push(...row(f)));
      else out.push(el('p', { class: 'small muted', style: 'padding:4px' }, OWN_FOODS.length ? 'No match in your foods.' : 'No own foods yet. Scan a barcode or add one from a label.'));
      out.push(el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn small', type: 'button', onclick: () => ownFoodDialog((food) => { open = food.id; draw(); }) }, '+ Add your own food'),
        q ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => { tab = 'library'; draw(); } }, `Search "${q}" in the Food library →`) : null));
    } else {
      const lib = searchFoods(q, block, hidden, FOOD_LIBRARY, q ? 60 : 200);
      out.push(el('div', { class: 'sheet-section' }, q ? `${lib.length} result${lib.length === 1 ? '' : 's'}` : `Food library · ${FOOD_LIBRARY.length} foods, per 100 g raw or dry`));
      lib.forEach((f) => out.push(...row(f)));
      if (!lib.length) out.push(el('p', { class: 'small muted', style: 'padding:4px' }, 'Nothing found. Try another word, or scan the product\'s barcode.'));
    }
    if (hidden.count && tab !== 'recipes') out.push(el('p', { class: 'tiny muted', style: 'padding:8px 4px' }, `${hidden.count} food${hidden.count > 1 ? 's' : ''} hidden because of this athlete's allergies.`));
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
function scanBarcode(onFood) {
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
    const known = OWN_FOODS.find((f) => f.id === `own:bc:${code}`);
    if (known) { m.close(); toast(`Found in your foods: ${known.name}`); onFood(known); return; }
    msg.className = 'msg'; msg.textContent = `Looking up ${code}…`;
    try {
      const prefill = await lookupBarcode(code);
      m.close();
      ownFoodDialog((food) => onFood(food), prefill);
    } catch (e) {
      done = false;
      msg.className = 'msg err';
      msg.textContent = e.message;
      if (/not found/i.test(e.message)) {
        msg.append(' ', el('button', { class: 'btn small', type: 'button', onclick: () => { m.close(); ownFoodDialog((food) => onFood(food), { barcode: code }); } }, 'Enter it from the label'));
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
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_hr,product_name_en,brands,quantity,nutriments,allergens_tags,traces_tags`);
  } catch (e) { throw new Error('No connection to the product database. Try again, or enter the food from the label.'); }
  if (res.status === 404) throw new Error(`Product ${code} not found in Open Food Facts.`);
  if (!res.ok) throw new Error(`The product database answered with an error (${res.status}). Try again in a minute.`);
  const data = await res.json();
  if (data.status === 0 || !data.product) throw new Error(`Product ${code} not found in Open Food Facts.`);
  const p = data.product, n = p.nutriments || {};
  const v = (k) => (n[k] === undefined || n[k] === '' ? undefined : Math.round(Number(n[k]) * 10) / 10);
  const kcal = v('energy-kcal_100g') ?? (n['energy_100g'] ? Math.round(Number(n['energy_100g']) / 4.184) : undefined);
  const al = [...(p.allergens_tags || []), ...(p.traces_tags || [])].map((t) => OFF_ALLERGENS[t]).filter(Boolean);
  return {
    barcode: code,
    name: [p.brands?.split(',')[0]?.trim(), p.product_name_en || p.product_name || p.product_name_hr].filter(Boolean).join(' ') || `Product ${code}`,
    per100: { kcal, p: v('proteins_100g'), c: v('carbohydrates_100g'), f: v('fat_100g'), fib: v('fiber_100g'), sug: v('sugars_100g'), sat: v('saturated-fat_100g'),
      na: n['sodium_100g'] !== undefined ? Math.round(Number(n['sodium_100g']) * 1000) : undefined },
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
function ownFoodDialog(onSaved, prefill = {}) {
  const name = el('input', { class: 'field', placeholder: 'e.g. Zbregov protein shake (brand, product)', value: prefill.name || '' });
  const cat = el('select', { class: 'select field' }, ...Object.entries(FOOD_CATS).map(([k, l]) => el('option', { value: k }, l)));
  const fields = [['kcal', 'Calories (kcal)'], ['p', 'Protein (g)'], ['c', 'Carbohydrates (g)'], ['f', 'Fat (g)'], ['fib', 'Fibre (g)'], ['sug', 'Sugars (g)'], ['sat', 'Saturated fat (g)'], ['na', 'Sodium (mg) = salt g × 400']];
  const inputs = Object.fromEntries(fields.map(([k]) => [k, el('input', { class: 'field', inputMode: 'decimal', value: prefill.per100?.[k] ?? '' })]));
  const source = el('input', { class: 'field', placeholder: 'Source, e.g. "label, 2026"', value: prefill.note || '' });
  const have = new Set(prefill.allergens || []);
  const alBoxes = ALLERGENS.map(([k, label]) => ({ k, box: el('input', { type: 'checkbox', value: k, checked: have.has(k) }), label }));
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary' }, 'Save food');
  const m = modal(prefill.barcode ? 'New product' : 'Add your own food',
    prefill.per100 ? el('div', { class: 'notice' }, `Found in Open Food Facts (barcode ${prefill.barcode}). This is crowd-sourced label data: check it against the pack before saving.`)
      : el('p', { class: 'small soft' }, 'Values per 100 g (or 100 ml) from the nutrition label. Your foods appear first in the search.'),
    el('label', { class: 'lab' }, 'Name', name), el('label', { class: 'lab' }, 'Group', cat),
    el('div', { class: 'form-grid' }, ...fields.map(([k, l]) => el('label', { class: 'lab' }, l, inputs[k]))),
    el('div', {}, el('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px' }, 'Allergens (bold on the label, including "may contain")'),
      el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px' },
        ...alBoxes.map((a) => el('label', { class: 'row nowrap small', style: 'gap:6px' }, a.box, a.label.replace(/ \(.*\)/, ''))))),
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
    const row = { id: prefill.barcode ? `own:bc:${prefill.barcode}` : 'own:' + uid(), name: name.value.trim(), cat: cat.value, per100,
      note: source.value.trim() || null, allergens: alBoxes.filter((a) => a.box.checked).map((a) => a.k) };
    try {
      await Data.upsert('coaching_foods', row);
      await loadOwnFoods();
      m.close();
      onSaved?.(OWN_FOODS.find((f) => f.id === row.id));
    } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
  });
}
