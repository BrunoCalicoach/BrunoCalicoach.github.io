// Meal plan builder for coach.html: days of 3 meals, foods searched from the USDA library (coaching-foods.js)
// or Bruno's own foods, grams typed in, and every meal and day totalled live against the athlete's targets.

let OWN_FOODS = [];

async function loadOwnFoods() {
  try {
    const rows = await Data.select('coaching_foods', {}, ['name']);
    OWN_FOODS = rows.map((r) => ({ id: r.id, name: r.name, cat: r.cat, own: true, note: r.note, ...r.per100 }));
  } catch (e) { console.warn('Own foods not loaded', e); }
}

const FOOD_CATS = { protein: 'Protein', dairy: 'Dairy', legumes: 'Legumes', carbs: 'Carbs', fruit: 'Fruit', veg: 'Vegetables', fats: 'Fats', other: 'Other' };

function searchFoods(query) {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const all = [...OWN_FOODS, ...FOOD_LIBRARY];
  return all.map((f) => {
    const name = f.name.toLowerCase();
    if (!words.every((w) => name.includes(w))) return null;
    const score = (name.startsWith(words[0]) ? 0 : 1) + (f.own ? -0.5 : 0) + name.length / 1000;
    return { f, score };
  }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 12).map((x) => x.f);
}

function macroLine(v, digits = 0) {
  return `${fmt(v.kcal, 0)} kcal · P ${fmt(v.p, digits)} g · C ${fmt(v.c, digits)} g · F ${fmt(v.f, digits)} g`;
}

// A food search box: type, pick with the mouse or arrows + Enter
function foodPicker(onPick, placeholder = 'Add food: type to search (e.g. chicken, oats, rice)') {
  const input = el('input', { class: 'field', placeholder, autocomplete: 'off', style: 'padding:9px 12px;font-size:15px' });
  const list = el('div', { class: 'food-results hidden', role: 'listbox' });
  let results = [], active = 0;
  const draw = () => {
    list.classList.toggle('hidden', !results.length);
    list.replaceChildren(...results.map((f, i) => el('button', { type: 'button', class: 'food-hit' + (i === active ? ' active' : ''), role: 'option',
      onmousedown: (e) => { e.preventDefault(); pick(f); } },
      el('span', { class: 'grow' }, f.name, f.own ? el('span', { class: 'pill teal', style: 'margin-left:6px' }, 'Own') : null),
      el('span', { class: 'tiny muted' }, `${macroLine(f, 1)} /100 g`))));
  };
  const pick = (f) => { onPick(f); input.value = ''; results = []; draw(); };
  input.addEventListener('input', () => { results = searchFoods(input.value); active = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
    if (e.key === 'Escape') { results = []; draw(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { results = []; draw(); }, 150));
  return el('div', { class: 'food-picker' }, input, list);
}

function diffClass(value, target, tol = 0.05) {
  if (!target) return '';
  const d = Math.abs(value - target) / target;
  return d <= tol ? 'good' : d <= tol * 2 ? 'warn' : 'bad';
}

// meals: { plans: [days], note }, target: { kcal, protein, fat, carbs } or null, onChange(): save
function mealPlanEditor(meals, target, onChange) {
  if (!Array.isArray(meals.plans) || isLegacyMealPlan(meals.plans) || !meals.plans.length) meals.plans = [emptyMealDay(1)];
  let active = 0;
  const node = el('div', { class: 'stack' });

  function draw() {
    active = Math.min(active, meals.plans.length - 1);
    const day = meals.plans[active];
    const tabs = el('div', { class: 'row' },
      el('div', { class: 'seg' }, ...meals.plans.map((d, i) => el('button', { type: 'button', class: i === active ? 'active' : '', onclick: () => { active = i; draw(); } }, d.title || `Day ${i + 1}`))),
      el('button', { class: 'btn small', type: 'button', onclick: () => { meals.plans.push(emptyMealDay(meals.plans.length + 1)); active = meals.plans.length - 1; onChange(); draw(); } }, '+ Day'),
      el('button', { class: 'btn small ghost', type: 'button', onclick: () => {
        const copy = clone(day); copy.id = uid(); copy.title = `Day ${meals.plans.length + 1}`;
        copy.meals.forEach((m) => { m.id = uid(); m.items.forEach((it) => { it.id = uid(); }); });
        meals.plans.push(copy); active = meals.plans.length - 1; onChange(); draw();
      } }, 'Duplicate day'),
      meals.plans.length > 1 ? el('button', { class: 'btn small ghost danger', type: 'button', onclick: () => {
        if (!confirm(`Delete ${day.title}?`)) return;
        meals.plans.splice(active, 1); onChange(); draw();
      } }, 'Delete day') : null);

    const title = el('input', { class: 'field', style: 'max-width:220px;font-weight:800;padding:9px 12px', value: day.title || '' });
    title.addEventListener('input', () => { day.title = title.value; onChange(); });
    const summary = el('div');
    const micros = el('div');
    const updateDay = () => {
      const t = mealTotals(dayItems(day));
      const cell = (label, v, tv, unit, isMin) => el('div', { class: 'stat' },
        el('div', { class: 'k' }, label),
        el('div', { class: 'v ' + (tv ? (isMin ? (v >= tv * 0.97 ? 'good' : v >= tv * 0.9 ? 'warn' : 'bad') : diffClass(v, tv)) : '') }, fmt(v, 0) + unit),
        el('div', { class: 'tiny muted' }, tv ? `target ${fmt(tv, 0)}${unit}${isMin ? ' min' : ''} · ${v - tv >= 0 ? '+' : ''}${fmt(v - tv, 0)}` : 'no target set'));
      summary.replaceChildren(el('div', { class: 'stats' },
        cell('Calories', t.kcal, target?.kcal, ' kcal'), cell('Protein', t.p, target?.protein, ' g', true),
        cell('Carbs', t.c, target?.carbs, ' g'), cell('Fat', t.f, target?.fat, ' g')));
      micros.replaceChildren(el('details', {}, el('summary', { class: 'small', style: 'cursor:pointer;color:var(--accent-soft)' }, 'Fibre, vitamins and minerals for this day'),
        el('div', { class: 'chips', style: 'margin-top:8px' }, ...MICROS.map(([k, label, unit]) =>
          el('span', { class: 'chip' }, `${label} `, el('b', {}, t.known[k] === false ? `≥${fmt(t[k], 1)}` : fmt(t[k], 1)), ` ${unit}`))),
        el('p', { class: 'tiny muted', style: 'margin-top:6px' }, '"≥" means one or more foods have no value for that nutrient in the source data.')));
    };

    const mealCards = day.meals.map((meal) => mealCard(meal, () => { updateDay(); onChange(); }, target));
    updateDay();
    node.replaceChildren(tabs,
      el('div', { class: 'card stack' }, el('div', { class: 'row between' }, title, el('span', { class: 'small muted' }, 'Day total')), summary, micros),
      ...mealCards);
  }

  function mealCard(meal, changed, dayTarget) {
    const name = el('input', { class: 'field', style: 'max-width:200px;font-weight:700;padding:8px 12px', value: meal.name });
    name.addEventListener('input', () => { meal.name = name.value; changed(); });
    const foot = el('div', { class: 'small', style: 'font-weight:700' });
    const body = el('tbody');
    const updateFoot = () => {
      const t = mealTotals(meal.items);
      const share = dayTarget?.kcal ? ` · ${fmt((t.kcal / dayTarget.kcal) * 100, 0)}% of the day's target` : '';
      foot.textContent = `${meal.name || 'Meal'}: ${macroLine(t)}${share}`;
    };
    const drawRows = () => {
      body.replaceChildren(...meal.items.map((it, i) => {
        const g = el('input', { class: 'set-in', style: 'width:80px;padding:7px 6px', inputMode: 'decimal', value: it.g ?? '', 'aria-label': `Grams of ${it.name}` });
        const v = el('td', { class: 'small soft' });
        const show = () => { const t = mealTotals([it]); v.textContent = macroLine(t, 1); };
        show();
        g.addEventListener('input', () => { it.g = num(g.value) || 0; show(); updateFoot(); changed(); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.closest('.card').querySelector('.food-picker input').focus(); } });
        return el('tr', {},
          el('td', { title: it.food?.startsWith('usda:') ? `USDA FoodData Central ${it.food.slice(5)}` : 'Own food' }, it.name),
          el('td', {}, el('div', { class: 'row nowrap', style: 'gap:4px' }, g, el('span', { class: 'small muted' }, 'g'))),
          v,
          el('td', {}, el('div', { class: 'row nowrap', style: 'gap:2px' },
            el('button', { class: 'btn ghost small', type: 'button', title: 'Move up', onclick: () => { if (i > 0) { meal.items.splice(i - 1, 0, meal.items.splice(i, 1)[0]); drawRows(); changed(); } } }, '↑'),
            el('button', { class: 'btn ghost small', type: 'button', title: 'Remove', 'aria-label': `Remove ${it.name}`, onclick: () => { meal.items.splice(i, 1); drawRows(); updateFoot(); changed(); } }, '✕'))));
      }));
    };
    drawRows(); updateFoot();
    const picker = foodPicker((food) => {
      meal.items.push(newMealItem(food, 100));
      drawRows(); updateFoot(); changed();
      const inputs = body.querySelectorAll('input');
      const last = inputs[inputs.length - 1];
      last?.focus(); last?.select();
    });
    const note = el('input', { class: 'field', style: 'padding:8px 12px;font-size:14px', value: meal.note || '', placeholder: 'Note for this meal (preparation, swaps), optional' });
    note.addEventListener('input', () => { meal.note = note.value; changed(); });
    return el('div', { class: 'card stack' }, name,
      el('div', { class: 'table-wrap' }, el('table', { class: 'data meal-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Food (raw / dry weight)'), el('th', {}, 'Amount'), el('th', {}, 'Values'), el('th', {}))), body)),
      picker, foot, note);
  }

  draw();
  return node;
}

// Bruno's own food from a label: values per 100 g, with a check that calories fit the macros
function ownFoodDialog(onSaved) {
  const name = el('input', { class: 'field', placeholder: 'e.g. Zbregov protein shake (brand, product)' });
  const cat = el('select', { class: 'select field' }, ...Object.entries(FOOD_CATS).map(([k, l]) => el('option', { value: k }, l)));
  const fields = [['kcal', 'Calories (kcal)'], ['p', 'Protein (g)'], ['c', 'Carbohydrates (g)'], ['f', 'Fat (g)'], ['fib', 'Fibre (g)'], ['sug', 'Sugars (g)'], ['sat', 'Saturated fat (g)'], ['na', 'Sodium (mg) = salt g × 400']];
  const inputs = Object.fromEntries(fields.map(([k]) => [k, el('input', { class: 'field', inputMode: 'decimal' })]));
  const source = el('input', { class: 'field', placeholder: 'Source, e.g. "label, 2026"' });
  const msg = el('p', { class: 'msg' });
  const save = el('button', { class: 'btn primary' }, 'Save food');
  const m = modal('Add your own food',
    el('p', { class: 'small soft' }, 'Values per 100 g (or 100 ml) from the nutrition label. Your foods appear first in the search.'),
    el('label', { class: 'lab' }, 'Name', name), el('label', { class: 'lab' }, 'Group', cat),
    el('div', { class: 'form-grid' }, ...fields.map(([k, l]) => el('label', { class: 'lab' }, l, inputs[k]))),
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
    const row = { id: 'own:' + uid(), name: name.value.trim(), cat: cat.value, per100, note: source.value.trim() || null };
    try {
      await Data.upsert('coaching_foods', row);
      await loadOwnFoods();
      m.close(); onSaved?.();
    } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; }
  });
}
