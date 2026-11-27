/* Stage 3: meal plans made automatically (coach page only).
   The app fills each meal of a PRO athlete's plans from ready-made meals (the starter set below plus Bruno's own,
   saved with "Save as ready-made meal"), then sets the amounts with Fit to target for that meal's share of the day.
   It follows the athlete's meals a day and split, leaves out or replaces foods they must not have, keeps countable
   foods whole, and uses the athlete's own foods (e.g. eggs from their store) and whey instead of the library's. */

// The starter set. Amounts are for an ordinary portion; the app rescales them to each athlete's targets.
// 'WHEY' = the athlete's own whey, else Bruno's own whey; 'WHEY?' = only if there is one (left out otherwise).
// kind: breakfast, main (lunch or dinner) or snack.
const STARTER_MEALS = [
  // Breakfasts
  { id: 'st-oats-banana', kind: 'breakfast', name: 'Oats with milk, banana and whey', items: [['Oats (rolled), dry', 60], ['Milk 1%', 250], ['Banana', 118], ['WHEY?', 25]] },
  { id: 'st-eggs-toast', kind: 'breakfast', name: 'Eggs on wholegrain toast with tomato', items: [['Egg, whole, raw', 156], ['Egg white, raw', 66], ['Bread, whole wheat', 64], ['Tomato', 120]] },
  { id: 'st-yogurt-bowl', kind: 'breakfast', name: 'Greek yogurt bowl with oats, blueberries and walnuts', items: [['Greek yogurt, low fat', 250], ['Oats (rolled), dry', 40], ['Blueberries', 100], ['Honey', 10], ['Walnuts', 15]] },
  { id: 'st-eggs-avocado', kind: 'breakfast', name: 'Scrambled eggs, rye bread and avocado', items: [['Egg, whole, raw', 104], ['Egg white, raw', 99], ['Bread, rye', 64], ['Avocado', 70]] },
  { id: 'st-cottage-toast', kind: 'breakfast', name: 'Cottage cheese on toast with a peach', items: [['Cottage cheese, 2% fat', 200], ['Bread, whole wheat', 64], ['Peach', 150]] },
  { id: 'st-oat-pancakes', kind: 'breakfast', name: 'Protein oat pancakes with berries', items: [['Oats (rolled), dry', 50], ['Egg, whole, raw', 104], ['Egg white, raw', 66], ['Banana', 118], ['Strawberries', 100], ['WHEY?', 20]] },
  { id: 'st-kefir-oats', kind: 'breakfast', name: 'Kefir overnight oats with chia and strawberries', items: [['Kefir, low fat, plain', 300], ['Oats (rolled), dry', 50], ['Chia seeds', 10], ['Strawberries', 150], ['WHEY?', 20]] },
  { id: 'st-ricecakes-shake', kind: 'breakfast', name: 'Rice cakes with peanut butter, banana and a whey shake', items: [['Rice cakes', 27], ['Peanut butter (no salt)', 20], ['Banana', 118], ['WHEY', 30], ['Milk 0.1% (skim)', 250]] },
  { id: 'st-veggie-omelette', kind: 'breakfast', name: 'Vegetable omelette with feta and rye bread', items: [['Egg, whole, raw', 156], ['Spinach', 50], ['Pepper, red', 80], ['Mushrooms (white)', 60], ['Feta', 30], ['Bread, rye', 64]] },
  // Lunches and dinners
  { id: 'st-chicken-rice', kind: 'main', name: 'Chicken, rice and broccoli', items: [['Chicken breast, raw', 170], ['Rice, white (long grain), dry', 80], ['Broccoli', 150], ['Olive oil', 8]] },
  { id: 'st-beef-pasta', kind: 'main', name: 'Pasta with lean beef tomato sauce', items: [['Beef mince 5% fat, raw', 150], ['Pasta, dry', 90], ['Tomato passata (canned puree)', 150], ['Onion', 40], ['Parmesan', 10], ['Olive oil', 5]] },
  { id: 'st-salmon-potatoes', kind: 'main', name: 'Salmon, potatoes and green beans', items: [['Salmon (farmed), raw', 150], ['Potatoes, raw', 300], ['Green beans', 150], ['Olive oil', 5]] },
  { id: 'st-turkey-wraps', kind: 'main', name: 'Turkey wraps with yogurt sauce and salad', items: [['Turkey breast, raw', 150], ['Tortilla (wheat)', 120], ['Lettuce (romaine)', 50], ['Tomato', 100], ['Cucumber', 60], ['Greek yogurt, 0% fat', 50]] },
  { id: 'st-tuna-pasta', kind: 'main', name: 'Tuna pasta salad with corn and cucumber', items: [['Tuna, canned in water, drained', 150], ['Pasta, whole wheat, dry', 80], ['Sweet corn', 50], ['Cucumber', 100], ['Tomato', 100], ['Olive oil', 8]] },
  { id: 'st-thigh-sweetpotato', kind: 'main', name: 'Chicken thighs with sweet potato and rocket salad', items: [['Chicken thigh, raw', 180], ['Sweet potato, raw', 250], ['Arugula (rocket)', 40], ['Tomato', 100], ['Olive oil', 8]] },
  { id: 'st-beef-quinoa', kind: 'main', name: 'Lean beef with quinoa, zucchini and peppers', items: [['Beef, lean (top round), raw', 160], ['Quinoa, dry', 70], ['Zucchini', 150], ['Pepper, red', 100], ['Olive oil', 8]] },
  { id: 'st-cod-rice', kind: 'main', name: 'Cod with brown rice and peas', items: [['Cod, raw', 200], ['Rice, brown, dry', 80], ['Green peas, frozen', 100], ['Lemon juice', 10], ['Olive oil', 8]] },
  { id: 'st-lentil-chicken', kind: 'main', name: 'Lentil stew with chicken and carrots', items: [['Lentils, dry', 70], ['Chicken breast, raw', 110], ['Carrot', 80], ['Onion', 50], ['Tomato passata (canned puree)', 100], ['Olive oil', 8]] },
  { id: 'st-pork-buckwheat', kind: 'main', name: 'Pork tenderloin, buckwheat and cabbage', items: [['Pork tenderloin, raw', 160], ['Buckwheat, dry', 70], ['Cabbage', 150], ['Olive oil', 8]] },
  { id: 'st-tofu-stirfry', kind: 'main', name: 'Tofu stir-fry with rice and vegetables', items: [['Tofu, firm', 200], ['Rice, white (long grain), dry', 80], ['Broccoli', 100], ['Pepper, red', 100], ['Sesame seeds', 8], ['Sunflower oil', 8]] },
  { id: 'st-shrimp-couscous', kind: 'main', name: 'Shrimp couscous with zucchini and tomato', items: [['Shrimp, raw', 180], ['Couscous, dry', 70], ['Zucchini', 150], ['Tomato', 100], ['Olive oil', 8]] },
  { id: 'st-burger-bowl', kind: 'main', name: 'Burger bowl: beef, potatoes and salad', items: [['Beef mince 10% fat, raw', 150], ['Potatoes, raw', 250], ['Lettuce (iceberg)', 60], ['Tomato', 100], ['Cheddar', 20]] },
  { id: 'st-trout-bulgur', kind: 'main', name: 'Trout with bulgur and spinach', items: [['Trout (farmed), raw', 170], ['Bulgur, dry', 70], ['Spinach', 100], ['Olive oil', 8]] },
  // Snacks
  { id: 'st-shake-banana', kind: 'snack', name: 'Whey shake and a banana', items: [['WHEY', 30], ['Milk 1%', 250], ['Banana', 118]] },
  { id: 'st-yogurt-berries', kind: 'snack', name: 'Greek yogurt with raspberries and honey', items: [['Greek yogurt, 0% fat', 200], ['Raspberries', 100], ['Honey', 10]] },
  { id: 'st-cottage-apple', kind: 'snack', name: 'Cottage cheese, apple and almonds', items: [['Cottage cheese, 1% fat', 150], ['Apple', 180], ['Almonds', 15]] },
  { id: 'st-ricecakes-kefir', kind: 'snack', name: 'Rice cakes with peanut butter and kefir', items: [['Rice cakes', 27], ['Peanut butter (no salt)', 15], ['Kefir, low fat, plain', 250]] },
  { id: 'st-hummus-eggs', kind: 'snack', name: 'Boiled eggs, hummus and vegetables', items: [['Egg, whole, raw', 104], ['Hummus', 50], ['Carrot', 100], ['Cucumber', 100]] },
  { id: 'st-cottage-pineapple', kind: 'snack', name: 'Cottage cheese with pineapple', items: [['Cottage cheese, 2% fat', 200], ['Pineapple', 150]] },
  { id: 'st-tuna-ricecakes', kind: 'snack', name: 'Tuna on rice cakes with cucumber', items: [['Tuna, canned in water, drained', 100], ['Rice cakes', 27], ['Cucumber', 80]] }
];

// Bruno's own ready-made meals (table coaching_meal_templates; missing until he runs the SQL)
let MY_MEALS = [];
let MY_MEALS_READY = null;   // null = not loaded, false = table not set up, true = loaded
async function loadMyMeals() {
  try { MY_MEALS = await Data.select('coaching_meal_templates', {}, ['name']); MY_MEALS_READY = true; }
  catch (e) { MY_MEALS = []; MY_MEALS_READY = (e?.code === 'PGRST205' || e?.code === '42P01') ? false : null; }
  return MY_MEALS;
}
const templateKind = (kind) => (kind === 'lunch' || kind === 'dinner' ? 'main' : kind === 'snack' ? 'snack' : kind === 'breakfast' ? 'breakfast' : 'main');

// "Save as ready-made meal": the meal's foods as they are (with their values), so Bruno's own foods work too
async function saveMealTemplate(meal, slotKind) {
  if (!meal.items.length) { toast('Add some foods to the meal first.'); return; }
  if (MY_MEALS_READY === null) await loadMyMeals();
  if (MY_MEALS_READY === false) { toast('Ready-made meals need a small database update first: paste supabase/coaching-update-2026-11-28-meal-templates.sql in the SQL Editor.'); return; }
  const kindSel = el('select', { class: 'select field' },
    ...[['breakfast', 'Breakfast'], ['main', 'Lunch or dinner'], ['snack', 'Snack']].map(([v, l]) => el('option', { value: v, selected: v === templateKind(slotKind) }, l)));
  const name = el('input', { class: 'field', value: meal.name && !/^(breakfast|lunch|dinner|(morning |afternoon |evening )?snack)$/i.test(meal.name) ? meal.name : '', placeholder: 'e.g. Chicken, rice and broccoli', maxLength: 120 });
  const save = el('button', { class: 'btn primary', type: 'button' }, 'Save');
  const m = modal('Save as ready-made meal',
    el('p', { class: 'small soft' }, 'Automatic meal plans will use this meal too, with the amounts set to each athlete\'s targets.'),
    el('label', { class: 'small muted' }, 'Name'), name,
    el('label', { class: 'small muted' }, 'Used for'), kindSel,
    el('div', { class: 'row', style: 'margin-top:12px' }, save));
  setTimeout(() => name.focus(), 50);
  save.onclick = async () => {
    if (!name.value.trim()) { name.focus(); return; }
    const items = meal.items.map(({ id, locked, ...rest }) => clone(rest));
    try {
      await Data.upsert('coaching_meal_templates', { id: 'my-' + uid(), kind: kindSel.value, name: name.value.trim(), items });
      await loadMyMeals();
      m.close(); toast(`Saved "${name.value.trim()}". You now have ${MY_MEALS.length} ready-made meal${MY_MEALS.length > 1 ? 's' : ''} of your own.`);
    } catch (e) { toast('Not saved: ' + (e.message || e)); }
  };
}

/* ---------- Using the athlete's own foods instead of the library's ---------- */

// Words that name the same food in an athlete's (often Croatian) product names
const FOOD_WORDS = {
  'Egg, whole, raw': ['egg', 'eggs', 'jaja', 'jaje'], 'Egg white, raw': ['egg white', 'bjelanj', 'bjelanc'],
  'Oats (rolled), dry': ['oat', 'zob', 'zobene', 'pahuljice'], 'Banana': ['banana'],
  'Milk 0.1% (skim)': ['milk', 'mlijeko'], 'Milk 1%': ['milk', 'mlijeko'], 'Milk 2%': ['milk', 'mlijeko'], 'Milk 3.25% (whole)': ['milk', 'mlijeko'],
  'Greek yogurt, 0% fat': ['greek', 'grcki', 'skyr', 'jogurt', 'yogurt'], 'Greek yogurt, low fat': ['greek', 'grcki', 'skyr', 'jogurt', 'yogurt'],
  'Kefir, low fat, plain': ['kefir'], 'Cottage cheese, 1% fat': ['cottage', 'zrnati', 'svjezi sir', 'posni sir'], 'Cottage cheese, 2% fat': ['cottage', 'zrnati', 'svjezi sir', 'posni sir'],
  'Chicken breast, raw': ['chicken', 'piletina', 'pileci', 'pileca', 'pileca prsa', 'prsa'], 'Chicken thigh, raw': ['chicken', 'piletina', 'pileci', 'zabatak', 'batak'],
  'Turkey breast, raw': ['turkey', 'puretina', 'pureci', 'pureca'], 'Beef mince 5% fat, raw': ['mince', 'mljeveno', 'junet', 'govedin'],
  'Beef mince 10% fat, raw': ['mince', 'mljeveno', 'junet', 'govedin'], 'Tuna, canned in water, drained': ['tuna', 'tunj'],
  'Salmon (farmed), raw': ['salmon', 'losos'], 'Rice, white (long grain), dry': ['rice', 'riza'], 'Rice, brown, dry': ['brown rice', 'smeda riza', 'integralna riza'],
  'Pasta, dry': ['pasta', 'tjestenin', 'spaghetti', 'spageti', 'penne', 'fusilli'], 'Pasta, whole wheat, dry': ['integral', 'whole wheat', 'pasta', 'tjestenin'],
  'Bread, whole wheat': ['bread', 'kruh', 'integral'], 'Bread, rye': ['rye', 'razeni', 'kruh'], 'Tortilla (wheat)': ['tortilla', 'wrap'],
  'Rice cakes': ['rice cake', 'rizini krekeri', 'galete', 'krekeri'], 'Peanut butter (no salt)': ['peanut', 'kikiriki'],
  'Olive oil': ['olive oil', 'maslinovo'], 'Tofu, firm': ['tofu'], 'Hummus': ['hummus', 'humus'], 'Feta': ['feta'], 'Cheddar': ['cheddar'],
  'Tomato passata (canned puree)': ['passata', 'pasirana rajcica', 'pelat'], 'Couscous, dry': ['couscous', 'kus'], 'Quinoa, dry': ['quinoa', 'kvinoja'],
  'Honey': ['honey', 'med']
};
const short = (name) => String(name || '').replace(/, (raw|dry|drained|canned in water)$/i, '').replace(/, (raw|dry)$/i, '');
const plainText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
// Close enough per 100 g to stand in for the library food (so "milk chocolate" never replaces milk)
function similarValues(a, b) {
  const near = (x, y, abs, rel) => Math.abs((num(x) || 0) - (num(y) || 0)) <= Math.max(abs, (num(y) || 0) * rel);
  return near(a.kcal, b.kcal, 30, 0.25) && near(a.p, b.p, 3, 0.3) && near(a.c, b.c, 5, 0.35) && near(a.f, b.f, 3, 0.4);
}
// The athlete's own version of a library food, if they added one: matching name and similar values, closest first
function athleteVersion(libFood, athleteFoods) {
  const words = FOOD_WORDS[libFood.name] || [plainText(libFood.name).split(/[ ,(]/)[0]];
  const found = (athleteFoods || []).filter((f) => {
    const n = plainText(f.name);
    return words.some((w) => n.includes(plainText(w))) && similarValues(f, libFood);
  });
  const dist = (f) => Math.abs(f.kcal - libFood.kcal) / 30 + Math.abs(f.p - libFood.p) / 3 + Math.abs(f.c - libFood.c) / 5 + Math.abs(f.f - libFood.f) / 3;
  return found.sort((a, b) => dist(a) - dist(b))[0] || null;
}
// Whey: the athlete's own, else Bruno's own (a protein powder: mostly protein)
function findWhey(athleteFoods) {
  const isWhey = (f) => /whey|protein|proteinski|izolat|isolate/i.test(plainText(f.name)) && num(f.p) >= 60;
  return (athleteFoods || []).find(isWhey) || OWN_FOODS.find(isWhey) || null;
}

/* ---------- Making the plans ---------- */

// A ready-made meal turned into plan items for this athlete (null if it needs whey and there is none)
function templateItems(tpl, ctx) {
  const out = [];
  for (const entry of tpl.items) {
    if (!Array.isArray(entry)) {   // Bruno's saved meal: plan items with their values
      const it = { ...clone(entry), id: uid() };
      const lib = FOOD_LIBRARY.find((f) => f.id === it.food);
      const theirs = lib && athleteVersion(lib, ctx.athleteFoods);
      out.push(theirs ? withPiece(newMealItem(theirs, it.g), lib, it.g) : it);
      continue;
    }
    const [name, g] = entry;
    if (name === 'WHEY' || name === 'WHEY?') {
      if (ctx.whey) out.push(newMealItem(ctx.whey, g)); else if (name === 'WHEY') return null;
      continue;
    }
    const lib = FOOD_LIBRARY.find((f) => f.name === name);
    if (!lib) continue;
    const theirs = athleteVersion(lib, ctx.athleteFoods);
    out.push(theirs ? withPiece(newMealItem(theirs, g), lib, g) : newMealItem(lib, g));
  }
  return out.length ? out : null;
}
// The athlete's eggs stay counted in eggs, even if they did not give a piece weight
function withPiece(item, lib, grams) {
  const pc = PIECES[lib.name];
  if (!item.pc && pc) { item.pc = { g: pc.g, one: pc.one, many: pc.many, half: !!pc.half }; item.g = roundToPieces(grams, item.pc); }
  return item;
}

// "3 eggs", "4 slices Bread, whole wheat", "150 g Chicken breast"
const itemText = (it) => (it.pc && plainText(it.name).includes(plainText(it.pc.one)) ? amountLabel(it) : `${amountLabel(it)} ${short(it.name)}`);

// How far a meal is from its target (0 = spot on), on the same scale as the fit rules
function fitError(items, target) {
  const t = mealTotals(items);
  return FIT_RULES.reduce((s, [k, , , abs, rel]) => (target[k] ? s + ((t[k] - target[k]) / Math.max(abs, target[k] * rel)) ** 2 : s), 0);
}

// The most of one food a meal should have, in grams (so the fit never asks for 1 kg of kefir or 6 slices of bread)
function amountCap(it) {
  const n = it.name, cat = it.cat || FOOD_LIBRARY.find((f) => f.id === it.food)?.cat || '';
  if (/oil|butter$/i.test(n) && !/peanut|almond/i.test(n)) return 20;
  if (/honey|sugar|syrup|lemon juice/i.test(n)) return 20;
  if (/feta|cheddar|parmesan|mozzarella|emmental|swiss/i.test(n)) return 50;
  if (it.pc) return it.pc.g * ({ egg: 4, 'egg white': 6, slice: 4, tortilla: 2, 'rice cake': 6, crispbread: 6, banana: 2, apple: 2 }[it.pc.one] || 3);
  if (/whey|protein|izolat|isolate/i.test(n) && num(it.per100?.p) >= 60) return 50;
  if (cat === 'fats') return /avocado/i.test(n) ? 150 : 40;
  if (cat === 'veg') return 300;
  if (cat === 'fruit') return 300;
  if (/milk|kefir|drink|mlijeko/i.test(n)) return 500;
  if (cat === 'dairy') return 400;
  if (cat === 'protein') return 300;
  if (/potato|krumpir/i.test(n)) return 500;
  if (cat === 'carbs' || cat === 'legumes') return 150;
  return 300;
}

// One meal for one slot: tries the ready-made meals (unused ones first, in random order) and keeps the best fit.
// avoid: ready-made meals not to use here (already in this plan, or in this slot of another plan).
function makeMeal(pool, target, ctx, avoid) {
  const order = pool.map((t) => ({ t, r: Math.random() + (avoid.has(t.id) ? 1 : 0) })).sort((a, b) => a.r - b.r).map((x) => x.t);
  let best = null;
  // First only meals the athlete can have as they are; replacing foods (allergies) only if none of those works
  for (const allowSwaps of [false, true]) {
    for (const tpl of order) {
      const items = templateItems(tpl, ctx);
      if (!items) continue;
      const meal = { items };
      const blocked = ctx.block?.any && items.some((it) => !isAllowed(it, ctx.block));
      if (blocked && !allowSwaps) continue;
      // Scale the portion to the meal's calories, then let each food move only within sensible limits
      const kcal = mealTotals(meal.items).kcal;
      const ratio = kcal > 0 ? Math.min(2.5, Math.max(0.4, target.kcal / kcal)) : 1;
      const bounds = {};
      meal.items.forEach((it) => {
        const veg = (it.cat || FOOD_LIBRARY.find((f) => f.id === it.food)?.cat) === 'veg';
        const base = it.g * (veg ? Math.min(ratio, 1.3) : ratio);
        const cap = amountCap(it);
        const lo = it.pc ? pieceStep(it.pc) * it.pc.g : Math.max(5, Math.min(cap, base) * 0.5);
        bounds[it.id] = [lo, Math.max(lo, Math.min(cap, base * 1.8))];
        it.g = it.pc ? roundToPieces(Math.min(cap, base), it.pc) : Math.max(5, Math.round(Math.min(cap, base) / 5) * 5);
      });
      const before = meal.items.map((it) => it.name);
      if (blocked && replaceBlockedFoods(meal, target, ctx.block).length) continue;
      // What was swapped, for the preview (e.g. "bread → quinoa")
      const swapped = blocked ? before.filter((n) => !meal.items.some((it) => it.name === n)).map((n, k) => `${short(n)} → ${short(meal.items.filter((it) => !before.includes(it.name))[k]?.name || '?')}`) : [];
      fitMealToTarget(meal, target, { bounds: blocked ? null : bounds });
      // Rounding to whole pieces can step over a limit (2½ tortillas): bring those back under it
      meal.items.forEach((it) => { const cap = amountCap(it); if (it.pc && it.g > cap + 0.01) it.g = Math.floor(cap / (pieceStep(it.pc) * it.pc.g)) * pieceStep(it.pc) * it.pc.g; });
      const fits = mealFit(mealTotals(meal.items), target).ok;
      const err = fitError(meal.items, target);
      const score = err + (avoid.has(tpl.id) ? 3 : 0) + (blocked ? 1 : 0);
      if (!best || score < best.score) best = { tpl, items: meal.items, fits, score, swapped };
      if (fits && !avoid.has(tpl.id)) return best;   // fits and not used elsewhere: take it
    }
    if (best?.fits) return best;
  }
  return best;
}

// count plans for this athlete. dayTarget: { kcal, protein, carbs, fat }. Returns { plans, misses }.
function makePlans({ count, layoutCount, split, dayTarget, block, athleteFoods, useStarter = true }) {
  const ctx = { block, athleteFoods, whey: findWhey(athleteFoods) };
  const all = [...(useStarter ? STARTER_MEALS : []), ...MY_MEALS];
  const used = {};   // slot index -> ready-made meals already used in an earlier plan
  const plans = []; let misses = 0;
  for (let p = 0; p < count; p++) {
    const plan = emptyMealDay(p + 1, layoutCount);
    const inPlan = new Set();   // never the same meal twice in one plan (e.g. lunch and dinner)
    plan.meals.forEach((meal, j) => {
      const kind = templateKind(mealKind(meal, j, layoutCount));
      const pool = all.filter((t) => t.kind === kind && !inPlan.has(t.id));
      used[j] = used[j] || new Set();
      const target = mealTargetFor(dayTarget, split[j]);
      const made = pool.length && target ? makeMeal(pool, target, ctx, used[j]) : null;
      if (!made) { misses++; return; }
      used[j].add(made.tpl.id); inPlan.add(made.tpl.id);
      meal.items = made.items;
      meal.note = '';
      meal.from = made.tpl.name + (made.swapped?.length ? ` (${made.swapped.join(', ')})` : '');   // shown in the preview only
      if (!made.fits) misses++;
    });
    plans.push(plan);
  }
  return { plans, misses, whey: ctx.whey };
}

/* ---------- The window: make, look, keep ---------- */

// opts: { meals (the athlete's meal plan row), target (day target), block, athlete: { name, foods }, apply(plans, mode) }
async function mealMakerDialog({ meals, target, block, athlete, apply }) {
  if (!target?.kcal) { toast('Set this athlete\'s calorie and macro targets first (Nutrition, above the meal plans).'); return; }
  await loadMyMeals();
  const layoutCount = layoutOf(meals.plans);
  const split = mealSplit(meals);
  const first = (athlete?.name || 'the athlete').split(' ')[0];
  const countSel = el('select', { class: 'select field', style: 'width:auto' }, ...[1, 2, 3, 4, 5, 6].map((n) => el('option', { value: n, selected: n === 4 }, `${n} plan${n > 1 ? 's' : ''}`)));
  const starter = el('input', { type: 'checkbox', checked: true });
  const out = el('div', { class: 'stack', style: 'gap:10px' });
  let result = null;
  const hasPlans = meals.plans.some((d) => d.meals.some((m) => m.items.length));

  function make() {
    result = makePlans({ count: Number(countSel.value), layoutCount, split, dayTarget: target, block, athleteFoods: athlete?.foods || [], useStarter: starter.checked || !MY_MEALS.length });
    const theirs = new Set((athlete?.foods || []).map((f) => f.id));
    const usedTheirs = [...new Set(result.plans.flatMap((d) => d.meals.flatMap((m) => m.items.filter((it) => theirs.has(it.food)).map((it) => it.name))))];
    out.replaceChildren(
      ...result.plans.map((d) => {
        const t = mealTotals(dayItems(d));
        const dayOk = mealFit(t, { kcal: num(target.kcal), p: num(target.protein), c: num(target.carbs), f: num(target.fat) });
        return el('div', { class: 'card tight' },
          el('div', { class: 'row between' }, el('b', {}, d.title),
            el('span', { class: 'small ' + (dayOk?.ok ? 'good' : 'warn') }, `${fmt(t.kcal, 0)} kcal · P ${fmt(t.p, 0)} · C ${fmt(t.c, 0)} · F ${fmt(t.f, 0)}`)),
          ...d.meals.map((m, i) => {
            const mt = mealTotals(m.items);
            const ok = m.items.length && mealFit(mt, mealTargetFor(target, split[i])).ok;
            return el('div', { class: 'small', style: 'margin-top:4px' },
              el('span', { class: 'muted' }, `${m.name}: `), m.items.length ? m.from : el('i', { class: 'warn' }, 'nothing suitable found'),
              m.items.length ? el('span', { class: 'muted' }, ` · ${m.items.map(itemText).join(', ')}`) : null,
              m.items.length && !ok ? el('span', { class: 'warn' }, ' · a little off target') : null);
          }));
      }),
      el('p', { class: 'small muted' }, [
        `Target ${fmt(num(target.kcal), 0)} kcal · P ${fmt(num(target.protein), 0)} · C ${fmt(num(target.carbs), 0)} · F ${fmt(num(target.fat), 0)}, split ${split.join('/')}.`,
        block?.any ? 'Foods this athlete must not have were left out or replaced.' : '',
        usedTheirs.length ? `${first}'s own foods used: ${usedTheirs.join(', ')}.` : '',
        result.whey ? `Whey: ${result.whey.name}.` : 'No whey added yet (add one under My foods, or the athlete adds theirs), so meals with whey were skipped or made without it.',
        result.misses ? `${result.misses} meal${result.misses > 1 ? 's are' : ' is'} a little off: Fit to target or a swap fixes ${result.misses > 1 ? 'them' : 'it'} after.` : ''
      ].filter(Boolean).join(' ')),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', type: 'button', onclick: () => keep('add') }, 'Add as new plans'),
        hasPlans ? el('button', { class: 'btn', type: 'button', onclick: () => keep('replace') }, 'Replace the current plans') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: make }, 'Make different ones')));
  }
  function keep(mode) {
    if (mode === 'replace' && !confirm(`Replace all ${meals.plans.length} current plans of ${athlete?.name || 'this athlete'} with these?`)) return;
    result.plans.forEach((d) => d.meals.forEach((m) => { delete m.from; }));
    apply(result.plans, mode);
    m.close();
  }

  const m = modal('Make plans automatically',
    el('p', { class: 'small soft' }, `Fills ${first}'s ${MEAL_LAYOUTS[layoutCount].label.toLowerCase()} from ready-made meals, sized to their targets. Nothing changes until you keep them, and athletes see nothing until you publish.`),
    el('div', { class: 'row' }, countSel,
      el('label', { class: 'row small', style: 'gap:6px' }, starter, `Use the starter meals (${STARTER_MEALS.length})`),
      el('span', { class: 'small muted' }, MY_MEALS_READY === false ? 'Your own ready-made meals: needs the database update' : `Your own ready-made meals: ${MY_MEALS.length}`)),
    el('button', { class: 'btn primary', type: 'button', onclick: make }, 'Make plans'),
    out);
  return m;
}
