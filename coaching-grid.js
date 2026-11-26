// Spreadsheet-like grid for coach.html. Works like Excel / Google Sheets:
// Tab / Shift+Tab and Enter move between cells, arrows move at the edge of the text, Alt+Enter adds a line,
// paste a block copied from Excel or Google Sheets, drag over cells and Ctrl+C to copy them,
// Delete clears selected cells, Ctrl+Z / Ctrl+Y undo and redo, Ctrl+Enter inserts a row,
// Alt+Up / Alt+Down move a row. The row number opens a menu (insert, duplicate, section, delete).

function createSheet({ columns, rows, onChange, editableColumns = true, sections = true, extraColumn = null, extraLabel = '' }) {
  const state = { columns, rows, undo: [], redo: [], anchor: null, focus: null, range: null };
  const wrap = el('div', { class: 'sheet-wrap' });
  const tools = el('div', { class: 'sheet-tools' });
  const node = el('div', {}, wrap, tools);
  let typingSnapshot = null;

  const snapshot = () => JSON.stringify({ columns: state.columns, rows: state.rows });
  function remember() {
    state.undo.push(snapshot());
    if (state.undo.length > 100) state.undo.shift();
    state.redo = [];
  }
  function restore(text) {
    const data = JSON.parse(text);
    state.columns.splice(0, state.columns.length, ...data.columns);
    state.rows.splice(0, state.rows.length, ...data.rows);
    render(); changed();
  }
  function changed() { onChange?.(state.rows, state.columns); }

  function cellAt(r, c) { return wrap.querySelector(`textarea[data-r="${r}"][data-c="${c}"]`); }
  function focusCell(r, c, selectAll = false) {
    r = Math.max(0, Math.min(state.rows.length - 1, r));
    c = Math.max(0, Math.min(state.columns.length - 1, c));
    const cell = cellAt(r, c);
    if (!cell) return;
    cell.focus();
    if (selectAll) cell.select(); else cell.setSelectionRange(cell.value.length, cell.value.length);
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

  function setRange(a, b) {
    state.range = a && b ? { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) } : null;
    wrap.querySelectorAll('td.sel').forEach((td) => td.classList.remove('sel'));
    if (!state.range || (state.range.r0 === state.range.r1 && state.range.c0 === state.range.c1)) return;
    for (let r = state.range.r0; r <= state.range.r1; r++)
      for (let c = state.range.c0; c <= state.range.c1; c++) cellAt(r, c)?.parentElement.classList.add('sel');
  }
  const multi = () => state.range && (state.range.r0 !== state.range.r1 || state.range.c0 !== state.range.c1);

  function insertRow(at, kind = 'ex') { remember(); state.rows.splice(at, 0, emptyRow(kind)); render(); changed(); }
  function deleteRows(r0, r1 = r0) {
    remember();
    state.rows.splice(r0, r1 - r0 + 1);
    if (!state.rows.length) state.rows.push(emptyRow());
    render(); changed();
    focusCell(Math.min(r0, state.rows.length - 1), 0);
  }
  function moveRow(from, to) {
    if (to < 0 || to >= state.rows.length || from === to) return;
    remember();
    const [row] = state.rows.splice(from, 1);
    state.rows.splice(to, 0, row);
    render(); changed();
  }

  // Excel puts cells with line breaks in quotes; tabs split columns, line breaks split rows
  function parseTSV(text) {
    const out = [[]];
    let cell = '', quoted = false;
    text = text.replace(/\r\n?/g, '\n');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === '\t') { out[out.length - 1].push(cell); cell = ''; }
      else if (ch === '\n') { out[out.length - 1].push(cell); cell = ''; out.push([]); }
      else cell += ch;
    }
    out[out.length - 1].push(cell);
    if (out.length > 1 && out[out.length - 1].length === 1 && out[out.length - 1][0] === '') out.pop();
    return out;
  }
  function toTSV(range) {
    const lines = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const vals = [];
      for (let c = range.c0; c <= range.c1; c++) {
        const v = String(state.rows[r].c[state.columns[c].key] ?? '');
        vals.push(/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      }
      lines.push(vals.join('\t'));
    }
    return lines.join('\n');
  }
  function pasteBlock(r, c, grid) {
    // Skip a pasted header row such as "Exercise  Weight  Sets  Reps"
    const labels = state.columns.map((col) => col.label.toLowerCase());
    if (grid.length > 1 && grid[0].filter((v) => labels.includes(v.trim().toLowerCase())).length >= 2) grid = grid.slice(1);
    remember();
    grid.forEach((vals, i) => {
      if (!state.rows[r + i]) state.rows.push(emptyRow());
      const row = state.rows[r + i];
      vals.forEach((v, j) => {
        const col = state.columns[c + j];
        if (col) row.c[col.key] = v.trim();
      });
    });
    render(); changed();
    setRange({ r, c }, { r: r + grid.length - 1, c: Math.min(state.columns.length - 1, c + Math.max(...grid.map((g) => g.length)) - 1) });
  }
  function clearRange(range) {
    remember();
    for (let r = range.r0; r <= range.r1; r++)
      for (let c = range.c0; c <= range.c1; c++) delete state.rows[r].c[state.columns[c].key];
    render(); changed();
  }

  function rowMenu(r, x, y) {
    closeMenu();
    const row = state.rows[r];
    const item = (label, key, fn) => el('button', { type: 'button', onclick: () => { closeMenu(); fn(); } }, el('span', {}, label), key ? el('kbd', {}, key) : '');
    const menu = el('div', { class: 'ctx', id: 'sheet-menu' },
      item('Insert row above', '', () => insertRow(r)),
      item('Insert row below', 'Ctrl+Enter', () => insertRow(r + 1)),
      item('Duplicate row', '', () => { remember(); const copy = clone(row); copy.id = uid(); state.rows.splice(r + 1, 0, copy); render(); changed(); }),
      sections ? item(row.kind === 'section' ? 'Make it an exercise row' : 'Make it a section title (ABS, ROUND 1…)', '', () => { remember(); row.kind = row.kind === 'section' ? 'ex' : 'section'; render(); changed(); }) : null,
      item('Move up', 'Alt+↑', () => moveRow(r, r - 1)),
      item('Move down', 'Alt+↓', () => moveRow(r, r + 1)),
      item('Delete row', 'Ctrl+Del', () => deleteRows(r)));
    document.body.append(menu);
    menu.style.left = Math.min(x, innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(y, innerHeight - menu.offsetHeight - 8) + 'px';
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
  }
  function columnMenu(c, x, y) {
    closeMenu();
    const col = state.columns[c];
    const item = (label, fn) => el('button', { type: 'button', onclick: () => { closeMenu(); fn(); } }, label);
    const menu = el('div', { class: 'ctx', id: 'sheet-menu' },
      item('Insert column right', () => addColumn(c + 1)),
      item('Make wider', () => { remember(); col.width = (col.width || 120) + 40; render(); changed(); }),
      item('Make narrower', () => { remember(); col.width = Math.max(60, (col.width || 120) - 40); render(); changed(); }),
      c > 0 ? item('Move left', () => { remember(); state.columns.splice(c - 1, 0, state.columns.splice(c, 1)[0]); render(); changed(); }) : null,
      c < state.columns.length - 1 ? item('Move right', () => { remember(); state.columns.splice(c + 1, 0, state.columns.splice(c, 1)[0]); render(); changed(); }) : null,
      col.key !== 'name' && col.key !== 'meal' ? item('Delete column', () => {
        if (!confirm(`Delete the column "${col.label}" and everything in it?`)) return;
        remember(); state.columns.splice(c, 1); state.rows.forEach((row) => delete row.c[col.key]); render(); changed();
      }) : null);
    document.body.append(menu);
    menu.style.left = Math.min(x, innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(y, innerHeight - menu.offsetHeight - 8) + 'px';
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
  }
  function outside(e) { if (!e.target.closest('#sheet-menu')) closeMenu(); }
  function closeMenu() { document.getElementById('sheet-menu')?.remove(); document.removeEventListener('mousedown', outside); }
  function addColumn(at = state.columns.length) {
    askText('Add a column', 'Name of the new column (for example Tempo, Video, Distance)', 'Tempo', (label) => {
      remember();
      state.columns.splice(at, 0, { key: 'x_' + uid(), label, width: 120 });
      render(); changed();
    }, { okLabel: 'Add column' });
  }

  function onKey(e, r, c) {
    const t = e.target;
    const ctrl = e.ctrlKey || e.metaKey;
    const atStart = t.selectionStart === 0 && t.selectionEnd === 0;
    const atEnd = t.selectionStart === t.value.length && t.selectionEnd === t.value.length;
    const lastRow = r === state.rows.length - 1;
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redoIt(); return; }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); insertRow(r + 1); focusCell(r + 1, 0); return; }
    if (ctrl && e.key === 'Delete') { e.preventDefault(); deleteRows(r); return; }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); moveRow(r, r - 1); focusCell(r - 1, c); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); moveRow(r, r + 1); focusCell(r + 1, c); return; }
    if (multi() && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); clearRange(state.range); focusCell(r, c); return; }
    if (multi() && ctrl && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
      e.preventDefault();
      navigator.clipboard?.writeText(toTSV(state.range));
      if (e.key.toLowerCase() === 'x') clearRange(state.range);
      return;
    }
    if (e.key === 'Enter' && e.altKey) { // new line inside the cell, like Excel
      e.preventDefault();
      const s = t.selectionStart;
      t.setRangeText('\n', s, t.selectionEnd, 'end');
      t.dispatchEvent(new Event('input'));
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (lastRow) { insertRow(r + 1); }
      focusCell(r + 1, c);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) { if (c > 0) focusCell(r, c - 1, true); else if (r > 0) focusCell(r - 1, state.columns.length - 1, true); return; }
      if (c < state.columns.length - 1) focusCell(r, c + 1, true);
      else { if (lastRow) insertRow(r + 1); focusCell(r + 1, 0, true); }
      return;
    }
    const firstLine = !t.value.slice(0, t.selectionStart).includes('\n');
    const lastLine = !t.value.slice(t.selectionEnd).includes('\n');
    if (e.key === 'ArrowUp' && firstLine && r > 0) { e.preventDefault(); if (e.shiftKey) extend(r - 1, c); else focusCell(r - 1, c); return; }
    if (e.key === 'ArrowDown' && lastLine && !lastRow) { e.preventDefault(); if (e.shiftKey) extend(r + 1, c); else focusCell(r + 1, c); return; }
    if (e.key === 'ArrowLeft' && atStart && c > 0) { e.preventDefault(); if (e.shiftKey) extend(r, c - 1); else focusCell(r, c - 1); return; }
    if (e.key === 'ArrowRight' && atEnd && c < state.columns.length - 1) { e.preventDefault(); if (e.shiftKey) extend(r, c + 1); else focusCell(r, c + 1); return; }
    if (e.key === 'Escape') { setRange(null); t.blur(); }
  }
  // Shift+arrow at the edge of a cell selects a block of cells
  function extend(r, c) {
    const anchor = state.anchor || state.focus;
    const end = state.rangeEnd || state.focus;
    const next = { r: Math.max(0, Math.min(state.rows.length - 1, end.r + (r - state.focus.r))), c: Math.max(0, Math.min(state.columns.length - 1, end.c + (c - state.focus.c))) };
    state.anchor = anchor; state.rangeEnd = next;
    setRange(anchor, next);
  }

  function undo() { if (!state.undo.length) return; state.redo.push(snapshot()); restore(state.undo.pop()); }
  function redoIt() { if (!state.redo.length) return; state.undo.push(snapshot()); restore(state.redo.pop()); }

  let dragFrom = null, mouseAnchor = null;
  function render() {
    const extra = typeof extraColumn === 'function';
    // Column widths are proportions: on a wide screen the table fills the space, on a narrower one the columns
    // shrink to 70% of their set width, and only below that does the table scroll sideways
    const widths = [34, ...state.columns.map((col) => col.width || 120), ...(extra ? [220] : []), ...(editableColumns ? [44] : [])];
    const total = widths.reduce((a, b) => a + b, 0);
    const share = (w) => `width:${((w / total) * 100).toFixed(3)}%`;
    let wi = 0;
    const colgroup = el('colgroup', {}, el('col', { style: share(widths[wi++]) }),
      ...state.columns.map(() => el('col', { style: share(widths[wi++]) })),
      extra ? el('col', { style: share(widths[wi++]) }) : null,
      editableColumns ? el('col', { style: share(widths[wi++]) }) : null);
    const minWidth = Math.max(640, Math.round(total * 0.7));
    const head = el('tr', {}, el('th', {}),
      ...state.columns.map((col, c) => {
        const input = el('input', { class: 'colname', value: col.label, readOnly: !editableColumns, title: editableColumns ? 'Click to rename, right-click for more' : '' });
        input.addEventListener('focus', () => { typingSnapshot = snapshot(); });
        input.addEventListener('input', () => { col.label = input.value; changed(); });
        input.addEventListener('change', () => { if (typingSnapshot) { state.undo.push(typingSnapshot); typingSnapshot = null; } });
        const th = el('th', {}, input);
        if (editableColumns) th.addEventListener('contextmenu', (e) => { e.preventDefault(); columnMenu(c, e.clientX, e.clientY); });
        return th;
      }),
      extra ? el('th', { class: 'did' }, extraLabel) : null,
      editableColumns ? el('th', {}, el('button', { class: 'btn ghost small', title: 'Add a column', type: 'button', onclick: () => addColumn() }, '+')) : null);

    const body = el('tbody');
    state.rows.forEach((row, r) => {
      const handle = el('td', { class: 'handle', draggable: true, title: 'Click for options, drag to move' }, String(r + 1));
      handle.addEventListener('click', (e) => rowMenu(r, e.clientX, e.clientY));
      handle.addEventListener('contextmenu', (e) => { e.preventDefault(); rowMenu(r, e.clientX, e.clientY); });
      handle.addEventListener('dragstart', (e) => { dragFrom = r; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(r)); });
      const tr = el('tr', { class: row.kind === 'section' ? 'section' : '' }, handle);
      tr.addEventListener('dragover', (e) => { if (dragFrom === null) return; e.preventDefault(); tr.classList.add('drag-over'); });
      tr.addEventListener('dragleave', () => tr.classList.remove('drag-over'));
      tr.addEventListener('drop', (e) => { e.preventDefault(); tr.classList.remove('drag-over'); if (dragFrom !== null) moveRow(dragFrom, r); dragFrom = null; });

      state.columns.forEach((col, c) => {
        const t = el('textarea', { class: 'cell', rows: 1, spellcheck: false, 'data-r': r, 'data-c': c, 'aria-label': `${col.label} row ${r + 1}` });
        t.value = row.c[col.key] ?? '';
        if (row.kind === 'section' && c > 0) { t.disabled = true; t.value = ''; }
        t.addEventListener('focus', () => {
          state.focus = { r, c };
          if (!mouseAnchor) { state.anchor = null; state.rangeEnd = null; setRange(null); }
          typingSnapshot = snapshot();
          requestAnimationFrame(() => grow(t));
        });
        t.addEventListener('input', () => {
          if (typingSnapshot) { state.undo.push(typingSnapshot); state.redo = []; typingSnapshot = null; }
          row.c[col.key] = t.value; grow(t); changed();
        });
        t.addEventListener('blur', () => { typingSnapshot = null; });
        t.addEventListener('keydown', (e) => onKey(e, r, c));
        t.addEventListener('paste', (e) => {
          const text = e.clipboardData?.getData('text/plain') || '';
          if (!/[\t\n]/.test(text.replace(/\n$/, ''))) return; // one value: normal paste into the cell
          e.preventDefault();
          pasteBlock(r, c, parseTSV(text));
        });
        t.addEventListener('mousedown', (e) => {
          if (e.shiftKey && state.focus) { e.preventDefault(); state.anchor = state.focus; state.rangeEnd = { r, c }; setRange(state.focus, { r, c }); return; }
          mouseAnchor = { r, c };
        });
        t.addEventListener('mouseenter', (e) => {
          if (mouseAnchor && e.buttons === 1 && (mouseAnchor.r !== r || mouseAnchor.c !== c)) {
            window.getSelection()?.removeAllRanges();
            state.anchor = mouseAnchor; state.rangeEnd = { r, c };
            setRange(mouseAnchor, { r, c });
            cellAt(mouseAnchor.r, mouseAnchor.c)?.focus({ preventScroll: true });
          }
        });
        tr.append(el('td', {}, t));
      });
      if (extra) tr.append(el('td', { class: 'did' }, extraColumn(row) || ''));
      if (editableColumns) tr.append(el('td', {}));
      body.append(tr);
    });
    wrap.replaceChildren(el('table', { class: 'sheet', style: `min-width:${minWidth}px` }, colgroup, el('thead', {}, head), body));
    requestAnimationFrame(() => wrap.querySelectorAll('textarea.cell').forEach(grow));
  }
  document.addEventListener('mouseup', () => { mouseAnchor = null; });

  tools.append(
    el('button', { class: 'btn small', type: 'button', onclick: () => { insertRow(state.rows.length); focusCell(state.rows.length - 1, 0); } }, '+ Row'),
    sections ? el('button', { class: 'btn small', type: 'button', onclick: () => { insertRow(state.rows.length, 'section'); focusCell(state.rows.length - 1, 0); } }, '+ Section title') : null,
    el('button', { class: 'btn small ghost', type: 'button', title: 'Ctrl+Z', onclick: undo }, 'Undo'),
    el('button', { class: 'btn small ghost', type: 'button', title: 'Ctrl+Y', onclick: redoIt }, 'Redo'));

  render();
  return {
    node,
    refresh: render,
    setRows(next) { state.rows = next; render(); }
  };
}
