// Shared code for the 1-on-1 coaching app (coaching.html for athletes, coach.html for Bruno).
// Separate from the challenge: own tables (supabase/coaching.sql), same Supabase project and login.
// The publishable key is public by design; row level security limits every athlete to their own rows.
// Add ?demo to either page to try everything with sample data kept only in this browser.

const SUPABASE_URL = 'https://nhohgqpvxuibtrtnqewn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eDXtsUYHrXDELNfE_0LrTA_KPesC0dp';
const DEMO = new URLSearchParams(location.search).has('demo');
const PAGE_URL = location.origin + location.pathname;

/* ---------- Small DOM helpers ---------- */

// Optional parts of a page are written as "condition ? part : null". The browser would print a left-over null as
// the text "null", so these two skip empty slots everywhere in the app.
for (const method of ['replaceChildren', 'append']) {
  const original = Element.prototype[method];
  Element.prototype[method] = function (...nodes) {
    return original.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false));
  };
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'style') node.style.cssText = value;
    else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (name === 'html') node.innerHTML = value;
    else if (name in node && name !== 'list') node[name] = value;
    else node.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

const ICONS = {
  dumbbell: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  chart: '<path d="M4 19h16M7 15l3-4 3 2 4-6"/>',
  apple: '<path d="M12 7c-2-2-6-1.5-6 3 0 4 3 9 6 9s6-5 6-9c0-4.5-4-5-6-3zM12 7c0-2 1-3.5 3-4"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  timer: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M10 3h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a4 4 0 0 1 8 0M12 9l1.5-2"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  steps: '<path d="M7 16c-1.5 0-2.5-1.5-2.5-4S5.5 6 7 6s2.5 2.5 2.5 5-1 5-2.5 5zM5 19h4M17 13c-1.5 0-2.5-1.5-2.5-4S15.5 3 17 3s2.5 2.5 2.5 5-1 5-2.5 5zM15 16h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'
};

// Card header used across the app: a teal icon tile, the title and something on the right
function cardHead(iconName, title, right) {
  return el('div', { class: 'card-head' }, el('span', { class: 'head-icon' }, icon(iconName, 18)), el('h2', {}, title), right || null);
}

// One labelled value row in the app's style (name, box, unit); cls picks the colour (carb, prot, fat, kcal)
function valueRow(label, input, unit, cls = '', hint = '') {
  input.classList.add('minput');
  return el('label', { class: `macro-input ${cls}` }, el('span', { class: 'dot' }),
    el('span', { class: 'mname' }, label, hint ? el('span', { class: 'tiny muted', style: 'display:block;font-weight:400' }, hint) : null),
    input, el('span', { class: 'unit' }, unit));
}

// Small coloured chip for a change: good (green), bad (red) or neutral
function changeChip(text, mood = 'neutral') { return el('span', { class: `delta ${mood}` }, text); }
function icon(name, size = 22) {
  const span = el('span', { style: 'display:inline-flex' });
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function round(value, step = 1) { return Math.round(value / step) * step; }
function fmt(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function modal(title, ...content) {
  const back = el('div', { class: 'modal-back' });
  const close = () => back.remove();
  const box = el('div', { class: 'modal', role: 'dialog', 'aria-label': title },
    el('div', { class: 'row between nowrap' }, el('h2', {}, title),
      el('button', { class: 'btn ghost icon-btn', 'aria-label': 'Close', onclick: close }, icon('x'))),
    el('div', { class: 'stack', style: 'margin-top:14px' }, ...content));
  back.append(box);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.append(back);
  return { close, box };
}

/* ---------- Dates (weeks start on Monday) ---------- */

function ymd(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDay(text) { const [y, m, d] = text.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(text, n) { const d = parseDay(text); d.setDate(d.getDate() + n); return ymd(d); }
function mondayOf(date = new Date()) {
  const d = typeof date === 'string' ? parseDay(date) : new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
function today() { return ymd(new Date()); }
function niceDate(text, opts = { day: 'numeric', month: 'short' }) {
  return parseDay(text).toLocaleDateString('en-GB', opts);
}
function weekRange(start) { return `${niceDate(start)} – ${niceDate(addDays(start, 6))}`; }

/* ---------- Data layer: Supabase or demo, with an offline cache and a send queue ---------- */

const KEYS = {
  coaching_clients: ['user_id'], coaching_profiles: ['user_id'], coaching_drafts: ['client_id', 'week_start'],
  coaching_weeks: ['client_id', 'week_start'], coaching_logs: ['client_id', 'week_start', 'day_index'],
  coaching_feedback: ['client_id', 'week_start', 'day_index'], coaching_checkins: ['client_id', 'week_start'],
  coaching_daily: ['client_id', 'day'], coaching_measurements: ['client_id', 'day'], coaching_targets: ['client_id'],
  coaching_meal_plans: ['client_id'], coaching_guides: ['key'], coaching_foods: ['id'], coaching_meal_choices: ['client_id'], coaching_athlete_foods: ['client_id', 'id']
};

class OfflineError extends Error {}

function isNetworkError(error) {
  const text = String(error?.message || error || '');
  return !navigator.onLine || /fetch|network|load failed|timed? ?out/i.test(text);
}

const supa = DEMO ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SupabaseBackend = {
  async select(table, match = {}, order) {
    let query = supa.from(table).select('*');
    for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
    if (order) query = query.order(order[0], { ascending: order[1] !== 'desc' });
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async upsert(table, row) {
    const { data, error } = await supa.from(table).upsert(row, { onConflict: KEYS[table].join(',') }).select();
    if (error) throw error;
    return data?.[0] || row;
  },
  async remove(table, match) {
    let query = supa.from(table).delete();
    for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
    const { error } = await query;
    if (error) throw error;
  },
  async rpc(name, args) {
    const { data, error } = await supa.rpc(name, args);
    if (error) throw error;
    return data;
  },
  async upload(path, blob) {
    const { error } = await supa.storage.from('coaching-photos').upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
  },
  async listFiles(folder) {
    const { data, error } = await supa.storage.from('coaching-photos').list(folder, { limit: 500, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw error;
    return data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  },
  async fileUrl(path) {
    const { data, error } = await supa.storage.from('coaching-photos').createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
  async removeFile(path) {
    const { error } = await supa.storage.from('coaching-photos').remove([path]);
    if (error) throw error;
  }
};

/* Demo: the same tables kept in localStorage, shared by coach.html?demo and coaching.html?demo */
const DEMO_KEY = 'coaching-demo-db-v5';
const DemoBackend = {
  load() {
    try { const saved = JSON.parse(localStorage.getItem(DEMO_KEY)); if (saved) return saved; } catch (e) { /* fall through */ }
    const seeded = demoSeed();
    this.save(seeded);
    return seeded;
  },
  save(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { console.warn('Demo data not saved', e); } },
  reset() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ } },
  matches(row, match) { return Object.entries(match).every(([k, v]) => row[k] === v); },
  async select(table, match = {}, order) {
    const rows = (this.load().tables[table] || []).filter((r) => this.matches(r, match));
    if (order) rows.sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * (order[1] === 'desc' ? -1 : 1));
    return clone(rows);
  },
  async upsert(table, row) {
    const db = this.load();
    const list = db.tables[table] = db.tables[table] || [];
    const keys = KEYS[table];
    const i = list.findIndex((r) => keys.every((k) => r[k] === row[k]));
    if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row);
    this.save(db);
    return clone(row);
  },
  async remove(table, match) {
    const db = this.load();
    db.tables[table] = (db.tables[table] || []).filter((r) => !this.matches(r, match));
    this.save(db);
  },
  async rpc(name, args) {
    const db = this.load();
    if (name === 'publish_week') {
      const draft = db.tables.coaching_drafts.find((r) => r.client_id === args.p_client && r.week_start === args.p_week);
      if (!draft) throw new Error('No draft for that week');
      const stamp = new Date().toISOString();
      await this.upsert('coaching_weeks', { client_id: draft.client_id, week_start: draft.week_start, label: draft.label, content: clone(draft.content), published_at: stamp });
      return stamp;
    }
    if (name === 'unpublish_week') return this.remove('coaching_weeks', { client_id: args.p_client, week_start: args.p_week });
    if (name === 'coach_add_client') {
      const id = 'demo-' + uid();
      await this.upsert('coaching_clients', { user_id: id, name: args.p_name, tier: args.p_tier, active: true, start_date: today(), email: args.p_email });
      return id;
    }
    throw new Error('Unknown demo function ' + name);
  },
  async upload(path, blob) {
    const db = this.load();
    db.files = db.files || {};
    db.files[path] = await blobToDataUrl(await shrinkImage(blob, 420));
    this.save(db);
  },
  async listFiles(folder) { return Object.keys(this.load().files || {}).filter((p) => p.startsWith(folder + '/')).sort().reverse(); },
  async fileUrl(path) { return (this.load().files || {})[path]; },
  async removeFile(path) { const db = this.load(); delete (db.files || {})[path]; this.save(db); }
};

const backend = DEMO ? DemoBackend : SupabaseBackend;

// Reads fall back to the last copy seen; writes made offline wait in a queue and go out when back online.
const Data = {
  owner: 'anon',
  setOwner(id) { this.owner = id || 'anon'; },
  cacheKey(table, match, order) { return `coaching-cache:${this.owner}:${table}:${JSON.stringify(match)}:${order || ''}`; },
  readCache(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
  writeCache(key, rows) { try { localStorage.setItem(key, JSON.stringify(rows)); } catch (e) { /* storage full: still works online */ } },

  async select(table, match = {}, order) {
    const key = this.cacheKey(table, match, order);
    try {
      const rows = await backend.select(table, match, order);
      this.writeCache(key, rows);
      return rows;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const cached = this.readCache(key);
      if (cached) return this.applyQueue(table, match, cached);
      throw new OfflineError('Offline and not saved on this device yet.');
    }
  },

  async upsert(table, row) {
    row = { ...row };
    if (table !== 'coaching_clients' && table !== 'coaching_weeks') row.updated_at = new Date().toISOString();
    this.patchCaches(table, row);
    try {
      return await backend.upsert(table, row);
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      this.queue(table, row);
      return row;
    }
  },

  remove(table, match) { return backend.remove(table, match); },
  rpc(name, args) { return backend.rpc(name, args); },

  // Keep cached lists in step with local writes so offline screens show what was entered
  patchCaches(table, row) {
    const prefix = `coaching-cache:${this.owner}:${table}:`;
    const keys = KEYS[table];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const match = JSON.parse(key.slice(prefix.length).replace(/:[^:]*$/, '') || '{}');
      if (!Object.entries(match).every(([k, v]) => row[k] === v)) continue;
      const rows = this.readCache(key) || [];
      const at = rows.findIndex((r) => keys.every((k) => r[k] === row[k]));
      if (at >= 0) rows[at] = { ...rows[at], ...row }; else rows.push(row);
      this.writeCache(key, rows);
    }
  },
  applyQueue(table, match, rows) {
    const keys = KEYS[table];
    for (const item of this.outbox()) {
      if (item.table !== table || !Object.entries(match).every(([k, v]) => item.row[k] === v)) continue;
      const at = rows.findIndex((r) => keys.every((k) => r[k] === item.row[k]));
      if (at >= 0) rows[at] = { ...rows[at], ...item.row }; else rows.push(item.row);
    }
    return rows;
  },
  outboxKey() { return `coaching-outbox:${this.owner}`; },
  outbox() { return this.readCache(this.outboxKey()) || []; },
  queue(table, row) {
    const keys = KEYS[table];
    const list = this.outbox().filter((item) => !(item.table === table && keys.every((k) => item.row[k] === row[k])));
    list.push({ table, row });
    this.writeCache(this.outboxKey(), list);
    showOffline(true);
  },
  async flush() {
    const list = this.outbox();
    if (!list.length || !navigator.onLine) return 0;
    const left = [];
    for (const item of list) {
      try { await backend.upsert(item.table, item.row); } catch (error) { left.push(item); }
    }
    this.writeCache(this.outboxKey(), left);
    showOffline(!navigator.onLine || left.length > 0);
    return list.length - left.length;
  }
};

function showOffline(on) {
  let bar = document.getElementById('offline-bar');
  const waiting = Data.outbox().length;
  if (!on && !waiting) { bar?.remove(); return; }
  if (!bar) {
    bar = el('div', { id: 'offline-bar', class: 'offline-bar' });
    document.body.prepend(bar);
  }
  bar.textContent = navigator.onLine
    ? `Sending ${waiting} saved change${waiting === 1 ? '' : 's'}…`
    : `Offline. Your entries are saved on this phone${waiting ? ` (${waiting} waiting)` : ''} and sent when you are back online.`;
}
window.addEventListener('online', () => Data.flush());
window.addEventListener('offline', () => showOffline(true));

/* ---------- Plans: content shape and reading Bruno's free-text cells ---------- */

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Exercise', width: 230 },
  { key: 'weight', label: 'Weight', width: 100 },
  { key: 'sets', label: 'Sets', width: 80 },
  { key: 'reps', label: 'Reps', width: 190 },
  { key: 'rest', label: 'Rest', width: 110 },
  { key: 'rpe', label: 'RPE', width: 70 },
  { key: 'notes', label: 'Notes', width: 220 }
];

function emptyRow(kind = 'ex') { return { id: uid(), kind, c: {} }; }
function emptyDay(n) { return { id: uid(), title: `DAY ${n}`, subtitle: '', description: '', rows: [emptyRow(), emptyRow(), emptyRow()] }; }
function emptyContent() { return { columns: clone(DEFAULT_COLUMNS), days: [1, 2, 3, 4].map(emptyDay), note: '' }; }

// "30, 28, 26, 24" or "(15 + 30) , (14 + 28)" -> separate parts; commas inside brackets stay together
function splitList(text) {
  const parts = [];
  let depth = 0, current = '';
  for (const ch of String(text || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  // "52,5kg" style decimal commas: join a part that is only digits with the next one
  return parts.filter((p) => p !== '');
}

function setCount(row) {
  const sets = String(row.c.sets || '').trim();
  const emom = sets.match(/emom\s*(\d+)/i);
  if (emom) return Math.min(30, Number(emom[1]));
  const n = sets.match(/^(\d+)(?:[.,]0)?$/);
  if (n) return Math.max(1, Math.min(30, Number(n[1])));
  const reps = splitList(row.c.reps);
  if (reps.length > 1 && /\d/.test(reps.join(''))) return Math.min(30, reps.length);
  return 1;
}

function targetForSet(text, index, count) {
  const parts = splitList(text);
  if (parts.length > 1 && parts.length === count) return parts[index];
  return String(text || '').trim();
}

// "2 - 3 min", "<90 sec", "1,5 min", "45 sec", "5 - 6 min" -> seconds; "Complete rest" / "EMOM" -> null
function restSeconds(text) {
  const t = String(text || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  if (!/\d/.test(t) || /emom|interval/.test(t) && !/sec|min/.test(t)) return null;
  const unit = /min/.test(t) ? 60 : 1;
  const range = t.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Math.round(Number(range[1]) * unit), max: Math.round(Number(range[2]) * unit) };
  const single = t.match(/(\d+(?:\.\d+)?)/);
  const s = Math.round(Number(single[1]) * unit);
  return /</.test(t) ? { min: 0, max: s } : { min: s, max: s };
}

function exerciseRows(day) { return (day?.rows || []).filter((r) => r.kind !== 'section' && String(r.c.name || '').trim()); }

/* ---------- Meal plans: days of 3 meals, foods with grams ---------- */

const NUTRIENT_KEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'sat', 'na', 'k', 'ca', 'fe', 'mg', 'zn', 'vc', 'vd', 'b12', 'va', 'fol'];
const MICROS = [
  ['fib', 'Fibre', 'g'], ['sug', 'Sugars', 'g'], ['sat', 'Saturated fat', 'g'], ['na', 'Sodium', 'mg'], ['k', 'Potassium', 'mg'],
  ['ca', 'Calcium', 'mg'], ['fe', 'Iron', 'mg'], ['mg', 'Magnesium', 'mg'], ['zn', 'Zinc', 'mg'], ['vc', 'Vitamin C', 'mg'],
  ['vd', 'Vitamin D', 'µg'], ['b12', 'Vitamin B12', 'µg'], ['va', 'Vitamin A', 'µg'], ['fol', 'Folate', 'µg']
];
const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner'];

function emptyMealDay(n) {
  return { id: uid(), title: `Plan ${n}`, note: '', meals: MEAL_NAMES.map((name) => ({ id: uid(), name, note: '', items: [] })) };
}

// The food's values per 100 g (and its allergens) are copied into the plan, so a published plan never shifts
function newMealItem(food, grams) {
  const per100 = {};
  for (const k of NUTRIENT_KEYS) if (food[k] !== undefined && food[k] !== null) per100[k] = food[k];
  return { id: uid(), food: food.id, name: food.name, g: grams, per100, al: [...(food.al || [])] };
}

/* ---------- Allergies: the 14 EU label allergens plus any foods Bruno lists for an athlete ---------- */

const ALLERGENS = [
  ['gluten', 'Gluten (wheat, rye, barley, oats)'], ['crustaceans', 'Crustaceans'], ['eggs', 'Eggs'], ['fish', 'Fish'],
  ['peanuts', 'Peanuts'], ['soy', 'Soy'], ['milk', 'Milk (dairy)'], ['nuts', 'Tree nuts'], ['celery', 'Celery'],
  ['mustard', 'Mustard'], ['sesame', 'Sesame'], ['sulphites', 'Sulphites'], ['lupin', 'Lupin'], ['molluscs', 'Molluscs']
];
const allergenLabel = (key) => (ALLERGENS.find(([k]) => k === key)?.[1] || key).replace(/ \(.*\)/, '');

// What one athlete must not get: allergen keys and extra words (e.g. "kiwi, mushrooms") matched against food names
function blockFor(client) {
  const allergens = Array.isArray(client?.allergies) ? client.allergies : [];
  const avoid = String(client?.avoid_foods || '').split(/[,;\n]/).map((w) => w.trim().toLowerCase()).filter((w) => w.length > 1);
  return { allergens, avoid, any: allergens.length > 0 || avoid.length > 0 };
}

// Why a food (library food, own food or plan item) is blocked for this athlete: [] when it is fine
function blockedReasons(food, block) {
  if (!block?.any || !food) return [];
  const lib = food.food ? FOOD_LIBRARY.find((f) => f.id === food.food) : null;
  const al = new Set([...(food.al || []), ...(lib?.al || [])]);
  const name = String(food.name || '').toLowerCase();
  return [
    ...block.allergens.filter((a) => al.has(a)).map(allergenLabel),
    ...block.avoid.filter((w) => name.includes(w)).map((w) => `"${w}"`)
  ];
}
const isAllowed = (food, block) => blockedReasons(food, block).length === 0;
const mealAllowed = (meal, block) => (meal?.items || []).every((it) => isAllowed(it, block));

// Adds up foods (or meals, or days). Missing micronutrients count as unknown, not zero.
function mealTotals(items) {
  const t = { known: {} };
  for (const k of NUTRIENT_KEYS) t[k] = 0;
  for (const it of items) {
    const g = num(it.g) || 0;
    for (const k of NUTRIENT_KEYS) {
      if (it.per100?.[k] === undefined) { if (g) t.known[k] = false; continue; }
      t[k] += (it.per100[k] * g) / 100;
      if (t.known[k] === undefined) t.known[k] = true;
    }
  }
  return t;
}
const dayItems = (day) => day.meals.flatMap((m) => m.items);

/* Stage 2: every meal has its own share of the day's targets, so any breakfast can replace any other breakfast */

const DEFAULT_SPLIT = [30, 35, 35];
function mealSplit(plan) {
  const s = plan?.split;
  return Array.isArray(s) && s.length === 3 && s.every((x) => num(x) > 0) && Math.abs(s.reduce((a, b) => a + num(b), 0) - 100) < 0.5 ? s.map(num) : DEFAULT_SPLIT;
}

// dayTarget: { kcal, protein, carbs, fat } -> the share for one meal
function mealTargetFor(dayTarget, share) {
  if (!dayTarget?.kcal) return null;
  const x = share / 100;
  return { kcal: dayTarget.kcal * x, p: (num(dayTarget.protein) || 0) * x, c: (num(dayTarget.carbs) || 0) * x, f: (num(dayTarget.fat) || 0) * x };
}

// A meal fits when calories are within 5% (at least 25 kcal) and each macro within a few grams
const FIT_RULES = [['kcal', 'kcal', '', 25, 0.05], ['p', 'protein', ' g', 5, 0.10], ['c', 'carbs', ' g', 10, 0.15], ['f', 'fat', ' g', 5, 0.15]];
function mealFit(totals, target) {
  if (!target) return null;
  const issues = [];
  for (const [k, label, unit, abs, rel] of FIT_RULES) {
    if (!target[k]) continue;
    const d = totals[k] - target[k];
    if (Math.abs(d) > Math.max(abs, target[k] * rel)) issues.push(`${label} ${d > 0 ? '+' : '−'}${Math.round(Math.abs(d))}${unit}`);
  }
  return { ok: !issues.length, issues };
}

// When the original meal itself is off target, swaps are judged against the original meal instead
function swapReference(items, target) {
  const t = mealTotals(items);
  return target && mealFit(t, target).ok ? target : { kcal: t.kcal, p: t.p, c: t.c, f: t.f };
}

const mealSignature = (meal) => (meal?.items || []).map((i) => `${i.food}:${i.g}`).join('|');

// Replaces every blocked food in a meal with the closest safe swap that keeps the meal on target.
// Returns the names it could not replace (no safe equivalent kept the meal on target).
// Looks in the food's own group first, then related groups (dairy -> meat, fish, eggs, tofu; wheat -> rice, potatoes...),
// and re-fits the grams of the whole meal after each replacement so it stays on target.
const RELATED_CATS = { dairy: ['protein', 'legumes'], protein: ['dairy', 'legumes'], carbs: ['legumes', 'fruit'], legumes: ['protein', 'carbs'],
  fruit: ['carbs'], fats: [], veg: [], other: ['dairy', 'protein'] };
// The usual replacements when a whole group is ruled out (milk allergy: no dairy left to swap within)
const PREFERRED_REPLACEMENTS = {
  dairy: ['Egg white, raw', 'Egg, whole, raw', 'Tofu, firm', 'Soy drink, unsweetened', 'Tempeh'],
  protein: ['Tofu, firm', 'Tempeh', 'Lentils, dry', 'Chickpeas, canned, drained'],
  other: ['Soy drink, unsweetened', 'Rice drink, unsweetened', 'Almond drink, unsweetened']
};
function replaceBlockedFoods(meal, target, block) {
  const left = [];
  for (let i = 0; i < meal.items.length; i++) {
    const it = meal.items[i];
    if (isAllowed(it, block)) continue;
    const quick = foodSwapOptions(meal.items, i, target, block)[0];
    if (quick) { meal.items = quick.items; continue; }
    const lib = FOOD_LIBRARY.find((f) => f.id === it.food);
    const cat = lib?.cat || it.cat || 'other';
    const ref = swapReference(meal.items, target);
    const old = mealTotals(meal.items);
    let best = null;
    const basis = SWAP_BASIS[cat] || 'kcal';
    const amount = ((it.per100[basis] || 0) * (num(it.g) || 0)) / 100;
    const preferred = (PREFERRED_REPLACEMENTS[cat] || []).map((n) => FOOD_LIBRARY.find((f) => f.name === n)).filter(Boolean);
    // Search order: same group, then the usual replacements (e.g. eggs or tofu for dairy), then related groups
    for (const group of [FOOD_LIBRARY.filter((f) => f.cat === cat), preferred, ...(RELATED_CATS[cat] || []).map((c) => FOOD_LIBRARY.filter((f) => f.cat === c))]) {
      for (const f of group) {
        if (NO_SWAP.test(f.name) || !isAllowed(f, block) || !(f[basis] > 0)) continue;
        if (meal.items.some((x) => x.food === f.id)) continue;
        const g = Math.min(600, Math.max(10, Math.round(((amount || 100) / f[basis]) * 100 / 5) * 5));
        const copy = { ...meal, items: meal.items.map((x, n) => (n === i ? { ...newMealItem(f, g), id: x.id } : { ...x })) };
        fitMealToTarget(copy, ref);
        const t = mealTotals(copy.items);
        if (!mealFit(t, ref).ok) continue;
        const score = Math.abs(t.kcal - old.kcal) / 50 + Math.abs(t.p - old.p) / 5 + Math.abs(t.c - old.c) / 10 + Math.abs(t.f - old.f) / 5;
        if (!best || score < best.score) best = { items: copy.items, score };
      }
      if (best) break;
    }
    if (best) meal.items = best.items; else left.push(it.name);
  }
  return left;
}

// Other plans' meals in the same slot that fit this slot's target
function mealSwapOptions(days, dayIndex, mealIndex, target) {
  const current = days[dayIndex].meals[mealIndex];
  const ref = swapReference(current.items, target);
  return days.map((d, i) => ({ day: d, dayIndex: i, meal: d.meals[mealIndex] }))
    .filter((o) => o.dayIndex !== dayIndex && o.meal?.items.length && mealSignature(o.meal) !== mealSignature(current))
    .map((o) => ({ ...o, totals: mealTotals(o.meal.items) }))
    .filter((o) => mealFit(o.totals, ref).ok);
}

// Equivalent foods from the same group, in the amount that keeps the main nutrient the same
const SWAP_BASIS = { protein: 'p', dairy: 'p', legumes: 'c', carbs: 'c', fruit: 'c', fats: 'f', veg: 'kcal', other: 'kcal' };
const NO_SWAP = /sugar|honey|maple|flour|semolina|lemon juice|garlic|butter|passata|sauerkraut|egg yolk/i;
function foodSwapOptions(items, itemIndex, target, block) {
  const it = items[itemIndex];
  const lib = FOOD_LIBRARY.find((f) => f.id === it.food);
  if (!lib || (NO_SWAP.test(lib.name) && isAllowed(it, block))) return [];
  const basis = SWAP_BASIS[lib.cat] || 'kcal';
  const amount = ((it.per100[basis] || 0) * (num(it.g) || 0)) / 100;
  if (!amount) return [];
  const old = mealTotals(items);
  const ref = swapReference(items, target);
  return FOOD_LIBRARY.filter((f) => f.cat === lib.cat && f.id !== lib.id && !NO_SWAP.test(f.name) && f[basis] > 0 && isAllowed(f, block))
    .map((f) => {
      const g = Math.round((amount / f[basis]) * 100 / 5) * 5;
      if (g < 5 || g > 700) return null;
      const next = items.map((x, i) => (i === itemIndex ? { ...newMealItem(f, g), id: x.id } : x));
      const t = mealTotals(next);
      if (!mealFit(t, ref).ok) return null;
      const score = Math.abs(t.kcal - old.kcal) / 50 + Math.abs(t.p - old.p) / 5 + Math.abs(t.c - old.c) / 10 + Math.abs(t.f - old.f) / 5;
      return { food: f, g, items: next, totals: t, score };
    })
    .filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 10);
}

// Adjusts the grams of the foods already in the meal so calories, protein, carbs and fat all come as close as
// possible to the target (least squares, amounts kept between 5 g and 3x the start, then rounded to 5 g).
// Returns whether the result fits. Foods are never added or removed: that stays Bruno's choice.
function fitMealToTarget(meal, target) {
  const items = meal.items.filter((it) => num(it.g) > 0);
  if (!target?.kcal || !items.length) return false;
  const keys = [['kcal', 25], ['p', 5], ['c', 10], ['f', 5]].filter(([k]) => target[k]);
  const a = items.map((it) => keys.map(([k]) => (it.per100[k] || 0) / 100));
  const start = items.map((it) => num(it.g));
  let g = start.map((x) => x * (target.kcal / Math.max(1, mealTotals(items).kcal)));
  const lo = start.map(() => 5), hi = start.map((x) => Math.max(30, x * 3));
  const cost = (gs) => keys.reduce((s, [k, sc], j) => s + ((gs.reduce((acc, x, i) => acc + a[i][j] * x, 0) - target[k]) / sc) ** 2, 0)
    + gs.reduce((s, x, i) => s + 0.02 * ((x - start[i]) / start[i]) ** 2, 0);
  for (let iter = 0; iter < 4000; iter++) {
    const grad = g.map((_, i) => keys.reduce((s, [k, sc], j) => s + 2 * a[i][j] * ((g.reduce((acc, x, n) => acc + a[n][j] * x, 0) - target[k]) / sc ** 2), 0)
      + 0.04 * (g[i] - start[i]) / start[i] ** 2);
    const norm = Math.sqrt(grad.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-6) break;
    const step = Math.max(0.2, 30 / (1 + iter / 50));
    const next = g.map((x, i) => Math.min(hi[i], Math.max(lo[i], x - (step * grad[i]) / norm)));
    if (cost(next) < cost(g)) g = next;
  }
  items.forEach((it, i) => { it.g = Math.max(5, Math.round(g[i] / 5) * 5); });
  return mealFit(mealTotals(meal.items), target).ok;
}

// Plans saved before the food library (free-text rows) are shown as they were
function isLegacyMealPlan(plans) { return Array.isArray(plans) && plans.some((p) => p && Array.isArray(p.rows)); }

/* ---------- Macro summary: a calorie ring with the three macros beside it ---------- */

// The day's targets on their own (athletes without a meal plan): a full ring and the three macro targets
function targetSummary(target) {
  const R = 52, CIRC = 2 * Math.PI * R;
  const ring = el('div', { class: 'kring', html:
    `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="fill" stroke-dasharray="${CIRC.toFixed(1)} 0"/></svg>` },
    el('div', { class: 'kring-text' }, el('b', {}, fmt(num(target.kcal), 0)), el('span', {}, 'kcal a day')));
  const row = (key, label, value, note) => el('div', { class: 'mrow' },
    el('div', { class: 'mrow-top' }, el('span', { class: `mlabel ${key}` }, label), el('span', { class: `mval ${key}` }, value ? `${fmt(num(value), 0)} g` : '–')),
    el('div', { class: `mbar ${key}` }, el('span', { style: 'width:100%' })),
    el('div', { class: 'tiny muted', style: 'margin-top:3px' }, note));
  return el('div', { class: 'msummary' }, ring, el('div', { class: 'mrows' },
    row('carb', 'Carbs', target.carbs, 'about'), row('prot', 'Protein', target.protein, 'minimum'), row('fat', 'Fat', target.fat, 'minimum')));
}

// totals: { kcal, p, c, f }; target: { kcal, protein, carbs, fat } or null
function macroSummary(totals, target) {
  const bar = (key, value, goal) => {
    const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
    const over = goal && value > goal * 1.05;
    return el('div', { class: `mbar ${key}${over ? ' over' : ''}` }, el('span', { style: `width:${pct}%` }));
  };
  const row = (key, label, value, goal) => el('div', { class: 'mrow' },
    el('div', { class: 'mrow-top' }, el('span', { class: `mlabel ${key}` }, label),
      el('span', { class: `mval ${key}` }, `${fmt(value, 0)}${goal ? ` / ${fmt(goal, 0)}` : ''} g`)),
    bar(key, value, goal));
  const goal = num(target?.kcal);
  const pct = goal ? Math.min(1, totals.kcal / goal) : 0;
  const over = goal && totals.kcal > goal * 1.05;
  const R = 52, CIRC = 2 * Math.PI * R;
  const ring = el('div', { class: 'kring' + (over ? ' over' : ''), html:
    `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="track"/>` +
    `<circle cx="60" cy="60" r="${R}" class="fill" stroke-dasharray="${(pct * CIRC).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>` },
    el('div', { class: 'kring-text' }, el('b', {}, fmt(totals.kcal, 0)), el('span', {}, goal ? `/ ${fmt(goal, 0)} kcal` : 'kcal')));
  ring.setAttribute('aria-label', `${fmt(totals.kcal, 0)}${goal ? ` of ${fmt(goal, 0)}` : ''} kcal`);
  return el('div', { class: 'msummary' }, ring,
    el('div', { class: 'mrows' },
      row('carb', 'Carbs', totals.c, num(target?.carbs)),
      row('prot', 'Protein', totals.p, num(target?.protein)),
      row('fat', 'Fat', totals.f, num(target?.fat))));
}

// General progress ring (workouts done, steps, rest timer): value/goal filled in a colour, text in the middle
function progressRing(value, goal, { size = 96, big = '', small = '', color = 'var(--kcal)', stroke = 9 } = {}) {
  const R = 50 - stroke / 2 - 1, CIRC = 2 * Math.PI * R;
  const pct = goal ? Math.max(0, Math.min(1, value / goal)) : 0;
  const ring = el('div', { class: 'pring', style: `width:${size}px;height:${size}px`, html:
    `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="track" style="stroke-width:${stroke}"/>` +
    `<circle cx="50" cy="50" r="${R}" class="fill" style="stroke:${color};stroke-width:${stroke}" stroke-dasharray="${(pct * CIRC).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>` },
    el('div', { class: 'pring-text' }, el('b', { style: `font-size:${Math.max(12, Math.min(24, Math.round(size * 0.21)))}px` }, big), small ? el('span', {}, small) : null));
  ring.update = (v, text, sub, col) => {
    const p = goal ? Math.max(0, Math.min(1, v / goal)) : 0;
    const fill = ring.querySelector('.fill');
    fill.setAttribute('stroke-dasharray', `${(p * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`);
    if (col) fill.style.stroke = col;
    ring.querySelector('b').textContent = text;
    const s = ring.querySelector('.pring-text span'); if (s && sub !== undefined) s.textContent = sub;
  };
  return ring;
}

// Small numbered tag used on cards ("01")
const numTag = (n) => el('span', { class: 'meal-num' }, String(n).padStart(2, '0'));

// Small donut showing how a meal's (or food's) calories split between carbs, protein and fat
function macroDonut(totals, size = 30) {
  const parts = [['carb', totals.c * 4], ['prot', totals.p * 4], ['fat', totals.f * 9]];
  const sum = parts.reduce((a, [, v]) => a + v, 0);
  const R = 15, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const arcs = sum ? parts.map(([k, v]) => {
    const len = (v / sum) * CIRC;
    const arc = `<circle cx="20" cy="20" r="${R}" class="seg ${k}" stroke-dasharray="${len.toFixed(2)} ${CIRC.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 20 20)"/>`;
    offset += len;
    return arc;
  }).join('') : '';
  const span = el('span', { class: 'mdonut', style: `width:${size}px;height:${size}px`,
    html: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${R}" class="track"/>${arcs}</svg>` });
  if (sum) span.title = `Calories from carbs ${fmt((parts[0][1] / sum) * 100, 0)}%, protein ${fmt((parts[1][1] / sum) * 100, 0)}%, fat ${fmt((parts[2][1] / sum) * 100, 0)}%`;
  return span;
}

// Slim stacked bar under a food: its macro mix by calories
function macroMiniBar(totals) {
  const c = totals.c * 4, p = totals.p * 4, f = totals.f * 9;
  return el('div', { class: 'minibar' }, ...(c + p + f ? [
    el('span', { class: 'carb', style: `flex:${c}` }), el('span', { class: 'prot', style: `flex:${p}` }), el('span', { class: 'fat', style: `flex:${f}` })] : []));
}

// Sunrise, sun and moon for the three meals of the day
const MEAL_ICONS = [
  '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v4M5.6 9.6l1.4 1.4M18.4 9.6 17 11"/>',
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'
];
function mealIcon(index) {
  return el('span', { class: 'meal-icon', html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MEAL_ICONS[index] || MEAL_ICONS[1]}</svg>` });
}

// Four coloured counters for one meal: carbs, protein, fat, calories, as "value / target" when there is a target
function macroCounters(totals, target) {
  const cell = (key, label, value, goal) => el('div', { class: 'mcount' },
    el('div', { class: `mnum ${key}` }, fmt(value, 0) + (goal ? ` / ${fmt(goal, 0)}` : '')),
    el('div', { class: `mlabel ${key}` }, label));
  return el('div', { class: 'mcounters' },
    cell('carb', 'Carbs', totals.c, target?.c),
    cell('prot', 'Protein', totals.p, target?.p),
    cell('fat', 'Fat', totals.f, target?.f),
    cell('kcal', 'Calories', totals.kcal, target?.kcal));
}

// Thin three-colour bar under a meal's name: how its calories split between carbs, protein and fat
function compositionBar(totals) {
  const c = totals.c * 4, p = totals.p * 4, f = totals.f * 9, sum = c + p + f;
  if (!sum) return el('div', { class: 'compbar empty' });
  return el('div', { class: 'compbar', title: `Calories from carbs ${fmt((c / sum) * 100, 0)}%, protein ${fmt((p / sum) * 100, 0)}%, fat ${fmt((f / sum) * 100, 0)}%` },
    el('span', { class: 'carb', style: `flex:${c}` }), el('span', { class: 'prot', style: `flex:${p}` }), el('span', { class: 'fat', style: `flex:${f}` }));
}

// Water: amount drunk against the day's target, with -/+ 250 ml buttons when onChange is given
function waterTracker(ml, target, onChange) {
  const pct = target ? Math.min(100, (ml / target) * 100) : 0;
  return el('div', { class: 'water' },
    el('div', { class: 'water-head' }, el('b', {}, `${fmt(pct, 0)} %`)),
    el('div', { class: 'mbar water-bar' }, el('span', { style: `width:${pct}%` })),
    el('div', { class: 'water-amount' }, `${fmt(ml, 0)} / ${fmt(target, 0)} ml`),
    onChange ? el('div', { class: 'water-buttons' },
      el('button', { class: 'round-btn', type: 'button', 'aria-label': 'Remove 250 ml', onclick: () => onChange(Math.max(0, ml - 250)) }, '−'),
      el('span', { class: 'water-step' }, '250 ml'),
      el('button', { class: 'round-btn', type: 'button', 'aria-label': 'Add 250 ml', onclick: () => onChange(Math.min(10000, ml + 250)) }, '+')) : null);
}

/* ---------- Calculations ---------- */

const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentary: desk job, little walking, no training' },
  { value: 1.375, label: 'Lightly active: training 1–3 days a week' },
  { value: 1.55, label: 'Moderately active: training 3–5 days a week' },
  { value: 1.725, label: 'Very active: hard training 6–7 days a week' },
  { value: 1.9, label: 'Extremely active: physical job plus hard training' }
];
const GOALS = { cut: 'Lose fat (cut)', maintain: 'Maintain', gain: 'Build muscle (gain)' };

const Calc = {
  age(birth) {
    if (!birth) return null;
    const b = parseDay(birth), now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  },
  // Mifflin-St Jeor (1990), validated as the most accurate common equation for healthy adults
  bmr({ sex, weight, height, age }) {
    if (!sex || !weight || !height || !age) return null;
    return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  },
  // A birth date that gives an impossible age (left on this year in a phone's date picker, a typo) means no estimate
  ageProblem(birth) {
    const age = this.age(birth);
    if (age === null || !Number.isFinite(age)) return 'Please enter your date of birth.';
    if (age < 0) return 'Your date of birth is in the future. Please check the year.';
    if (age < 10) return `Your date of birth (${birth ? niceDate(birth, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}) gives an age of ${Math.max(age, 0)}. Please check the year.`;
    if (age > 100) return `Your date of birth gives an age of ${age}. Please check the year.`;
    return '';
  },
  targets(profile, weight) {
    const age = this.age(profile?.birth_date);
    if (this.ageProblem(profile?.birth_date)) return null;
    const bmr = this.bmr({ sex: profile?.sex, weight, height: num(profile?.height_cm), age });
    if (!bmr || !profile?.activity) return null;
    const tdee = bmr * Number(profile.activity);
    const goal = profile.goal || 'maintain';
    // Cut about 20% below maintenance, gain about 10% above (roughly 0.5–1% bodyweight lost, or 0.25–0.5% gained, per week)
    const kcal = round(tdee * (goal === 'cut' ? 0.8 : goal === 'gain' ? 1.1 : 1), 10);
    // Protein 1.6–2.2 g/kg covers the research range for people who train (Morton 2018; ISSN); higher end while cutting
    const protein = round(weight * (goal === 'cut' ? 2.0 : 1.8));
    // Fat about 25% of calories (inside the 20–35% reference range), carbohydrates fill the rest
    const fat = round((kcal * 0.25) / 9);
    const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4));
    return { bmr: round(bmr), tdee: round(tdee, 10), kcal, protein, fat, carbs, goal, age };
  },
  // EFSA (2010) adequate total water intake: 2.5 L men, 2.0 L women, about 80% of it from drinks
  water(sex, trainingHours = 1) {
    const total = sex === 'female' ? 2.0 : 2.5;
    return { total, drinks: round(total * 0.8, 0.1), training: [round(0.5 * trainingHours, 0.1), round(1 * trainingHours, 0.1)] };
  },
  // Daily drinking target in ml: EFSA's adequate intake from drinks (2.0 L men, 1.6 L women), plus 0.5 L for
  // athletes who train on most days (activity factor 1.55+), rounded to 250 ml. Bruno's own number wins.
  waterTarget(profile, override) {
    if (num(override)) return { ml: num(override), byCoach: true };
    const base = profile?.sex === 'female' ? 1600 : 2000;
    const extra = num(profile?.activity) >= 1.55 ? 500 : 0;
    return { ml: round(base + extra, 250), byCoach: false, base, extra, known: Boolean(profile?.sex) };
  },
  // Weekly averages of the daily log (weeks start Monday)
  weeks(daily) {
    const map = new Map();
    for (const r of daily) {
      const w = mondayOf(r.day);
      if (!map.has(w)) map.set(w, { week: w, weights: [], steps: [] });
      if (num(r.weight)) map.get(w).weights.push(num(r.weight));
      if (num(r.steps) !== null) map.get(w).steps.push(num(r.steps));
    }
    const list = [...map.values()].sort((a, b) => (a.week > b.week ? 1 : -1));
    let prev = null;
    for (const w of list) {
      w.avgWeight = w.weights.length ? w.weights.reduce((s, x) => s + x, 0) / w.weights.length : null;
      w.avgSteps = w.steps.length ? w.steps.reduce((s, x) => s + x, 0) / w.steps.length : null;
      w.change = prev?.avgWeight && w.avgWeight ? w.avgWeight - prev.avgWeight : null;
      // About 7,700 kcal per kg of body weight change, spread over 7 days. A rough estimate: water and food in the gut move the scale too.
      w.balance = w.change !== null ? round((w.change * 7700) / 7, 10) : null;
      if (w.avgWeight) prev = w;
    }
    return list;
  },
  latestWeight(daily, profile) {
    const weeks = this.weeks(daily).filter((w) => w.avgWeight);
    return weeks.length ? weeks[weeks.length - 1].avgWeight : num(profile?.start_weight);
  }
};

/* ---------- Guide texts (Bruno can replace any of them in coach.html > Guides) ---------- */

const DEFAULT_GUIDES = [
  { key: 'rpe', title: 'RPE scale (rate of perceived exertion)', sort: 1, pro_only: false, body:
`Based on reps in reserve: how many more good reps you could have done.

10 – You cannot do another rep with proper form
9 – You could do 1 more rep
8 – You could do at least 2 more reps
7 – You could do 3 or more reps
6 – You could do 4–6 more reps
5 or less – Very light or light effort

Half steps are fine: 9.5 means maybe one more rep, but not sure.` },
  { key: 'weigh_in', title: 'How to weigh in', sort: 2, pro_only: false, body:
`Weigh yourself every morning: after the bathroom, before eating or drinking anything, in the same clothes (or none), on the same scale on a hard floor.

Daily weight jumps up and down with water, salt, carbohydrates and digestion. That is normal. The weekly average is what counts, so try to weigh in at least 4 times a week, ideally every day.

Take your body measurements under the same conditions at the end of each week.` },
  { key: 'lifestyle', title: 'Activity, steps and healthy habits', sort: 3, pro_only: false, body:
`Steps: large studies that pooled data from tens of thousands of adults (Paluch et al., Lancet Public Health 2022) found that more daily steps go with a lower risk of early death, with the benefit levelling off at around 8,000–10,000 steps for adults under 60 and 6,000–8,000 for adults over 60. Start from your current average and add about 1,000 steps a day every week or two.

Activity: the WHO recommends 150–300 minutes of moderate activity (brisk walking, easy cycling) or 75–150 minutes of vigorous activity a week, plus muscle strengthening on 2 or more days. Your training covers the strength part; walking covers much of the rest.

Sitting: break up long periods of sitting every 30–60 minutes with a few minutes of walking or stretching.

Sleep: adults need 7–9 hours. Keep regular sleep and wake times, get daylight in the morning, keep the bedroom dark and cool, and avoid caffeine in the 8 hours before bed.

Alcohol: less is better for recovery, sleep and progress.` },
  { key: 'nutrition_basics', title: 'Nutrition basics', sort: 4, pro_only: false, body:
`Build every meal around a protein source, add vegetables or fruit, then carbohydrates and fats to fit your calories.

Hit your calories first, then protein. Fat and carbohydrates can move a little from day to day.

Not every day will be perfect. What matters is the weekly average and being consistent.

Track what you eat in an app for a few weeks: it teaches you portion sizes faster than anything else.` },
  { key: 'food_lists', title: 'Food lists and swaps', sort: 10, pro_only: true, body: 'Bruno will add your food lists here.' },
  { key: 'supplements', title: 'Supplements', sort: 11, pro_only: true, body: 'Bruno will add his supplement recommendations here.' }
];

async function loadGuides() {
  let saved = [];
  try { saved = await Data.select('coaching_guides', {}, ['sort']); } catch (e) { console.warn(e); }
  const byKey = new Map(DEFAULT_GUIDES.map((g) => [g.key, g]));
  for (const g of saved) byKey.set(g.key, g);
  return [...byKey.values()].sort((a, b) => a.sort - b.sort);
}

/* ---------- Photos ---------- */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
}
// Photos are resized on the phone before upload (max 1280 px, JPEG) so they stay small
async function shrinkImage(file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = el('canvas', { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}
const Photos = {
  upload: (path, blob) => backend.upload(path, blob),
  list: (folder) => backend.listFiles(folder),
  url: (path) => backend.fileUrl(path),
  remove: (path) => backend.removeFile(path)
};

function photoGrid(paths, { onDelete } = {}) {
  const grid = el('div', { class: 'photos' });
  for (const path of paths) {
    const name = path.split('/').pop().replace(/\.\w+$/, '');
    const [date, pose] = [name.slice(0, 10), name.slice(11).split('-')[0]];
    const img = el('img', { alt: `${pose} ${date}`, loading: 'lazy' });
    Photos.url(path).then((src) => { img.src = src; }).catch(() => { img.alt = 'Not available offline'; });
    img.addEventListener('click', () => {
      const box = el('div', { class: 'lightbox', onclick: () => box.remove() }, el('img', { src: img.src, alt: img.alt }));
      document.body.append(box);
    });
    grid.append(el('figure', {}, img, el('figcaption', { class: 'row between nowrap' },
      el('span', {}, `${niceDate(date)} · ${pose}`),
      onDelete ? el('button', { class: 'btn ghost small', style: 'min-height:0;padding:0 4px', onclick: () => onDelete(path) }, '✕') : null)));
  }
  return grid;
}

/* ---------- Simple SVG line chart (daily weight with weekly averages) ---------- */

function lineChart(points, { avg = [], unit = '' } = {}) {
  const W = 640, H = 220, P = { l: 40, r: 12, t: 12, b: 26 };
  const all = [...points, ...avg].filter((p) => Number.isFinite(p.y));
  if (all.length < 2) return el('p', { class: 'muted small' }, 'The chart appears after a few entries.');
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
  const X = (x) => P.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (y) => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const path = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,0.07)"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const labels = [x0, x1].map((x, i) => `<text x="${X(x)}" y="${H - 6}" text-anchor="${i ? 'end' : 'start'}">${niceDate(ymd(new Date(x)))}</text>`).join('');
  const dots = points.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.6" fill="#8c8c8c"/>`).join('');
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart${unit ? ' in ' + unit : ''}">${grid}${labels}
    <path d="${path(points)}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>${dots}
    ${avg.length > 1 ? `<path d="${path(avg)}" fill="none" stroke="#4db8b8" stroke-width="3" stroke-linejoin="round"/>` : ''}
    ${avg.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="#4db8b8"/>`).join('')}</svg>`;
  return el('div', { html: svg });
}

/* ---------- Login, sign up and password reset ---------- */

const linkParams = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
let recovering = linkParams.get('type') === 'recovery';

function authView(container, { title = 'Log in', intro = '' } = {}) {
  const errorFromLink = linkParams.get('error_code') === 'otp_expired'
    ? 'This link has expired or was already used. Links work once, for 1 hour. Please ask for a new one.'
    : linkParams.get('error_description')?.replace(/\+/g, ' ') || '';

  function form(mode) {
    const email = el('input', { class: 'field', type: 'email', autocomplete: 'email', required: true });
    const password = el('input', { class: 'field', type: 'password', minLength: 8, required: true,
      autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
    const button = el('button', { class: 'btn primary block', type: 'submit' },
      { login: 'Log in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save new password' }[mode]);
    const msg = el('p', { class: 'msg' });
    const fields = [];
    if (mode !== 'newpass') fields.push(el('label', { class: 'lab' }, 'Email', email));
    if (mode !== 'reset') fields.push(el('label', { class: 'lab' }, mode === 'newpass' ? 'New password (at least 8 characters)' : mode === 'signup' ? 'Password (at least 8 characters)' : 'Password', password));
    const links = el('div', { class: 'row between small', style: 'margin-top:14px' });
    if (mode === 'login') links.append(
      el('a', { href: '#', onclick: (e) => { e.preventDefault(); show('signup'); } }, 'Create an account'),
      el('a', { href: '#', onclick: (e) => { e.preventDefault(); show('reset'); } }, 'Forgot password?'));
    else if (mode !== 'newpass') links.append(el('a', { href: '#', onclick: (e) => { e.preventDefault(); show('login'); } }, '← Back to log in'));

    const f = el('form', { class: 'card stack' }, ...fields, button, msg, links);
    if (mode === 'signup') f.append(el('p', { class: 'tiny muted' }, 'By creating an account you accept the ', el('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, 'privacy policy'), '.'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      button.disabled = true; msg.className = 'msg'; msg.textContent = 'Please wait…';
      try {
        let result;
        if (mode === 'login') result = await supa.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (mode === 'signup') result = await supa.auth.signUp({ email: email.value.trim(), password: password.value, options: { emailRedirectTo: PAGE_URL } });
        if (mode === 'reset') result = await supa.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: PAGE_URL });
        if (mode === 'newpass') result = await supa.auth.updateUser({ password: password.value });
        if (result.error) throw result.error;
        if (mode === 'signup' && !result.data.session) { msg.className = 'msg ok'; msg.textContent = 'Check your email and click the link to confirm your account.'; }
        else if (mode === 'reset') { msg.className = 'msg ok'; msg.textContent = 'If that email has an account, a reset link is on its way.'; }
        else if (mode === 'newpass') { recovering = false; location.replace(PAGE_URL); }
        else msg.textContent = '';
      } catch (error) {
        msg.className = 'msg err';
        msg.textContent = /invalid login/i.test(error.message) ? 'Wrong email or password.'
          : isNetworkError(error) ? 'No connection. Please try again when you are online.' : error.message;
      }
      button.disabled = false;
    });
    return f;
  }

  function show(mode) {
    container.replaceChildren(el('div', { class: 'auth stack' },
      el('h1', {}, mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset password' : mode === 'newpass' ? 'Choose a new password' : title),
      intro && mode === 'login' ? el('p', { class: 'soft' }, intro) : null,
      errorFromLink && mode === 'login' ? el('p', { class: 'msg err' }, errorFromLink) : null,
      form(mode)));
  }
  show(recovering ? 'newpass' : 'login');
}

// Calls onUser(user) whenever someone is logged in, or onLoggedOut()
function watchAuth(onUser, onLoggedOut) {
  if (DEMO) return;
  let last = null;
  supa.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; onLoggedOut(); return; }
    const user = session?.user || null;
    if (recovering) { onLoggedOut(); return; }
    if ((user?.id || null) === last && event !== 'INITIAL_SESSION') return;
    last = user?.id || null;
    setTimeout(() => (user ? onUser(user) : onLoggedOut()), 0);
  });
}

// Logging out also removes the offline copy of this person's data from the device (shared phones, gym computers).
// Entries still waiting to be sent are kept unless the person confirms, so nothing is lost by accident.
async function signOut() {
  if (DEMO) { location.href = location.pathname.replace(/[^/]*$/, '') + 'index.html'; return; }
  const waiting = Data.outbox().length;
  if (waiting && !confirm(`${waiting} entr${waiting === 1 ? 'y has' : 'ies have'} not been sent yet because you are offline. Log out anyway and delete ${waiting === 1 ? 'it' : 'them'} from this device?`)) return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('coaching-cache:') || k.startsWith('coaching-outbox:'))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* storage unavailable: nothing to clear */ }
  await supa.auth.signOut();
}

function demoBar(text) {
  const bar = el('div', { class: 'demo-bar' }, text,
    el('button', { class: 'btn small', onclick: () => { if (confirm('Reset the demo data to the start?')) { DemoBackend.reset(); location.reload(); } } }, 'Reset demo'));
  document.body.prepend(bar);
}

/* ---------- Demo data (sample athletes, no real client data) ---------- */

function demoSeed() {
  const thisWeek = mondayOf();
  const lastWeek = addDays(thisWeek, -7);
  const twoAgo = addDays(thisWeek, -14);
  const row = (name, weight, sets, reps, rest, rpe, notes = '') => ({ id: uid(), kind: 'ex', c: { name, weight, sets, reps, rest, rpe, notes } });
  const section = (name) => ({ id: uid(), kind: 'section', c: { name } });
  const plan = (pullTop) => ({
    columns: clone(DEFAULT_COLUMNS), note: '',
    days: [
      { id: 'd1', title: 'DAY 1', subtitle: 'PUSH WEIGHTED + BODYWEIGHT PULL', description: '', rows: [
        row('Weighted Dips', '40kg', '3', '3 - 6', '2 - 3 min', '8 - 9'),
        row('Weighted Dips EMOM', '20kg', 'EMOM 10\'', '9, 8, 9, 8, 9, 8, 9, 8, 9, 8', 'EMOM', '7 - 8'),
        row('Pull Ups', '/', '4', `${pullTop}, ${pullTop - 2}, ${pullTop - 4}, ${pullTop - 5}`, '5 - 6 min', '8 - 9'),
        row('Bodyweight Rows + Push Ups SUPERSET', '/', '4', '(15 + 30) , (14 + 28) , (13 + 26) , (12 + 24)', 'As short as possible', '8 - 10', 'Rows first, push-ups straight after.')] },
      { id: 'd2', title: 'DAY 2', subtitle: 'PULL WEIGHTED + BODYWEIGHT PUSH', description: '', rows: [
        row('Weighted Pull Ups', '25kg, 22,5kg, 20kg', '3', '1 - 3', '2 - 3 min', '8 - 9'),
        row('Dips w/ Top Hold', '/', '1', '8 - 1 (3 sec top hold after each step)', '3 - 5 min', ''),
        row('Pike Push Ups', '/', '4', '8 - 12', '1,5 min', '8 - 9')] },
      { id: 'd3', title: 'DAY 3', subtitle: 'TECHNIQUE + LEGS + CORE', description: '', rows: [
        row('Tempo Pull Ups (3 - 1 - 3)', '/', '3', '6', '2 - 3 min', '7'),
        row('RDL', '60kg', '4', '8 - 12', '<90 sec', '8 - 9'),
        row('Split Squat + Squat SUPERSET', '20kg', '4', '(10 each leg + 20) , (10 e.l. + 18) , (10 e.l. + 16) , (10 e.l. + 14)', '<90 sec', '8 - 9'),
        section('ABS'),
        row('L-Sit Raises', '/', '5', '6, 7, 8, 9, 10', '30 sec', '8 - 9'),
        row('Finisher - Knee Raises', '/', '1', 'Until failure', '', '10')] },
      { id: 'd4', title: 'DAY 4', subtitle: 'FULL BODY CIRCUIT',
        description: 'Complete one set of each exercise, resting 30 seconds before the next one. After the last exercise rest 90 seconds, then repeat for 5 rounds in total.', rows: [
        row('Pull Ups', '/', '5', '10', '30 sec', ''),
        row('Push Ups on Parallettes', '/', '5', '25', '30 sec', ''),
        row('Dips', '/', '5', '20', '30 sec', ''),
        row('Air bike', '', '', 'Your choice', '', '', 'Write down the time and intensity so I know.')] }]
  });
  const A = 'demo-athlete', R = 'demo-regular';
  const daily = [];
  for (let i = 27; i >= 1; i--) {
    const day = addDays(today(), -i);
    if (i % 7 === 3) continue;
    daily.push({ client_id: A, day, weight: Math.round((82.4 - (27 - i) * 0.06 + Math.sin(i * 1.7) * 0.45) * 10) / 10, steps: 6500 + Math.round(Math.cos(i) * 2500 + (27 - i) * 60) });
  }
  const p2 = plan(18), p1 = plan(20), p0 = plan(20);
  const lastLog = { client_id: A, week_start: lastWeek, day_index: 0, difficulty: 8, completed_at: new Date(Date.now() - 6 * 864e5).toISOString(),
    note: 'Felt strong on dips, pull-ups dropped off after the first set.', entries: {} };
  p1.days[0].rows.forEach((r, i) => {
    const n = setCount(r);
    lastLog.entries[r.id] = { sets: Array.from({ length: n }, (_, s) => ({ reps: String([5, 9, 20, 15][i] - (i === 2 ? s * 4 : 0)), weight: ['42.5', '20', '', ''][i], rpe: String(8 + (s % 2) * 0.5) })) };
  });
  const items = (list) => list.map(([name, g]) => newMealItem(FOOD_LIBRARY.find((f) => f.name === name), g));
  const meal = (title, b, l, d) => {
    const day = emptyMealDay(1);
    day.title = title;
    [b, l, d].forEach((list, i) => { day.meals[i].items = items(list); });
    // Demo plan fitted to the demo athlete's estimated targets so every meal is swappable
    day.meals.forEach((m, i) => fitMealToTarget(m, mealTargetFor({ kcal: 2230, protein: 162, carbs: 256, fat: 62 }, DEFAULT_SPLIT[i])));
    return day;
  };
  return {
    tables: {
      coaching_clients: [
        { user_id: A, name: 'Demo athlete (PRO)', tier: 'pro', active: true, start_date: twoAgo },
        { user_id: R, name: 'Demo athlete (REGULAR)', tier: 'regular', active: true, start_date: lastWeek }],
      coaching_profiles: [{ user_id: A, sex: 'male', birth_date: '1996-05-14', height_cm: 181, start_weight: 82.4, activity: 1.55, goal: 'cut', consent_at: new Date().toISOString() }],
      coaching_drafts: [
        { client_id: A, week_start: twoAgo, label: 'Week 1', content: p2 },
        { client_id: A, week_start: lastWeek, label: 'Week 2', content: p1 },
        { client_id: A, week_start: thisWeek, label: 'Week 3', content: p0 },
        { client_id: R, week_start: thisWeek, label: 'Week 1', content: plan(12) }],
      coaching_weeks: [
        { client_id: A, week_start: twoAgo, label: 'Week 1', content: clone(p2), published_at: new Date().toISOString() },
        { client_id: A, week_start: lastWeek, label: 'Week 2', content: clone(p1), published_at: new Date().toISOString() },
        { client_id: A, week_start: thisWeek, label: 'Week 3', content: clone(p0), published_at: new Date().toISOString() },
        { client_id: R, week_start: thisWeek, label: 'Week 1', content: plan(12), published_at: new Date().toISOString() }],
      coaching_logs: [lastLog],
      coaching_feedback: [{ client_id: A, week_start: lastWeek, day_index: 0, body: 'Very good workout. Next week we push the dips a bit harder.' }],
      coaching_checkins: [],
      coaching_daily: daily,
      coaching_measurements: [
        { client_id: A, day: addDays(twoAgo, 6), chest: 104, waist_narrow: 84, waist_navel: 88, hips: 99, biceps: 38, thigh: 59 },
        { client_id: A, day: addDays(lastWeek, 6), chest: 104, waist_narrow: 83, waist_navel: 87, hips: 98.5, biceps: 38, thigh: 58.5 }],
      coaching_targets: [],
      coaching_meal_plans: [{ client_id: A, note: 'Weigh foods raw or dry. Every breakfast, lunch and dinner has about the same calories and macros, so you can swap them between days.', plans: [
        meal('Plan 1', [['Oats (rolled), dry', 80], ['Greek yogurt, 0% fat', 200], ['Blueberries', 150], ['Walnuts', 15]],
          [['Chicken breast, raw', 200], ['Rice, white (long grain), dry', 90], ['Broccoli', 200], ['Olive oil', 10]],
          [['Salmon (farmed), raw', 150], ['Potatoes, raw', 350], ['Lettuce (romaine)', 100], ['Tomato', 150]]),
        meal('Plan 2', [['Egg, whole, raw', 150], ['Egg white, raw', 100], ['Bread, whole wheat', 80], ['Tomato', 100]],
          [['Turkey breast, raw', 200], ['Pasta, dry', 100], ['Pepper, red', 150], ['Olive oil', 10]],
          [['Beef, lean (top round), raw', 180], ['Bulgur, dry', 70], ['Zucchini', 200], ['Banana', 120], ['Olive oil', 10]]),
        meal('Plan 3', [['Cottage cheese, 1% fat', 250], ['Rice cakes', 30], ['Strawberries', 200], ['Almonds', 15]],
          [['Tuna, canned in water, drained', 150], ['Tortilla (wheat)', 120], ['Cucumber', 150], ['Avocado', 60]],
          [['Chicken thigh, raw', 200], ['Sweet potato, raw', 300], ['Green beans', 200], ['Olive oil', 10]])] }],
      coaching_guides: []
    },
    files: {}
  };
}
