// Form dialogs (UI only). Rules come from validation.js / status.js; saving is
// delegated to the onSubmit callback supplied by app.js.
import { h, uid, clear } from './dom.js';
import { T } from './strings.js';
import { FORMS, MODES, CONTENTS, STATUSES, STATUS, PRIORITIES, GRADE } from './constants.js';
import { ApiError } from './errors.js';
import { allowedFields, applyStatusChange } from './status.js';
import { validateThemeName, todayISO } from './validation.js';
import { confirmDialog, showFormDialog, closeFormDialog } from './dialogs.js';
import { normalizeSearch, byText } from './utils.js';

// ---- Field helpers -------------------------------------------------------
function field({ name, label, control, hint = null, required = false, group = false }) {
  const id = uid('f');
  const labelId = `${id}-label`;
  control.id = id;
  control.dataset.control = '';
  control.setAttribute('aria-describedby', [hint ? `${id}-hint` : null, `${id}-err`].filter(Boolean).join(' '));
  if (group) {
    control.setAttribute('role', 'group');
    control.setAttribute('aria-labelledby', labelId);
  }
  const tag = h('span', { class: 'field-tag', hidden: !required }, T.common.required);
  const labelEl = group
    ? h('span', { class: 'field-label', id: labelId }, label, ' ', tag)
    : h('label', { class: 'field-label', for: id, id: labelId }, label, ' ', tag);
  const el = h('div', { class: 'field', dataset: { field: name } },
    labelEl, control,
    hint ? h('p', { class: 'field-hint', id: `${id}-hint` }, hint) : null,
    h('p', { class: 'field-error', id: `${id}-err`, hidden: true }));
  return { el, control, setRequired: (b) => { tag.hidden = !b; } };
}

function clearErrors(root) {
  root.querySelectorAll('.field-error').forEach((p) => { p.hidden = true; p.textContent = ''; });
  root.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

function showErrors(root, errors) {
  clearErrors(root);
  const unmatched = [];
  let first = null;
  for (const e of errors) {
    const wrap = root.querySelector(`[data-field="${e.field}"]`);
    if (!wrap) { unmatched.push(e); continue; }
    const p = wrap.querySelector(':scope > .field-error');
    p.textContent = p.textContent ? `${p.textContent} ${e.message}` : e.message;
    p.hidden = false;
    const control = wrap.querySelector('[data-control]');
    control?.setAttribute('aria-invalid', 'true');
    first ??= control;
  }
  return { unmatched, first };
}

const selectEl = (name, options, current, placeholder = null) =>
  h('select', { name },
    placeholder !== null ? h('option', { value: '' }, placeholder) : null,
    options.map((o) => h('option', { value: o, selected: o === current }, o)));

// ---- Dialog shell --------------------------------------------------------
function openShell({ title, subtitle = null, submitLabel = T.common.save, body, getValues, onSubmit }) {
  const banner = h('p', { class: 'form-banner', role: 'alert', hidden: true, tabindex: '-1' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);
  const form = h('form', { class: 'form', novalidate: true, 'aria-labelledby': 'form-title' },
    h('header', { class: 'dialog-head' },
      h('div', {}, h('h2', { id: 'form-title' }, title), subtitle ? h('p', { class: 'dialog-sub' }, subtitle) : null),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': T.common.close, onclick: closeFormDialog }, '×')),
    h('div', { class: 'dialog-scroll' }, banner, body),
    h('footer', { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: closeFormDialog }, T.common.cancel), submit));

  const clearField = (e) => {
    const wrap = e.target.closest?.('.field');
    if (!wrap) return;
    const p = wrap.querySelector(':scope > .field-error');
    p.hidden = true; p.textContent = '';
    wrap.querySelector('[data-control]')?.removeAttribute('aria-invalid');
  };
  form.addEventListener('input', clearField);
  form.addEventListener('change', clearField);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    submit.disabled = true;
    banner.hidden = true;
    clearErrors(form);
    try {
      await onSubmit(getValues());
      closeFormDialog();
    } catch (err) {
      const errors = err instanceof ApiError ? err.errors : [];
      const { unmatched, first } = showErrors(form, errors);
      const lines = [];
      if (errors.length) lines.push(T.form.fixErrors);
      unmatched.forEach((u) => lines.push(u.message));
      if (!errors.length) {
        if (!(err instanceof ApiError)) console.error(err);
        lines.push(err instanceof ApiError ? err.message : T.errors.unexpected);
      }
      banner.textContent = lines.join(' ');
      banner.hidden = false;
      const target = first?.matches('[role="group"]') ? first.querySelector('input') : first;
      (target ?? banner).focus();
    } finally {
      submit.disabled = false;
    }
  });
  showFormDialog(form);
  form.querySelector('.dialog-scroll input:not([type=checkbox]):not([disabled]), .dialog-scroll select:not([disabled])')?.focus();
}

// ---- Picker (authors / themes) -----------------------------------------
function createPicker({ items, selectedIds = [], searchLabel, noMatchText, noneText, create = null }) {
  const sorted = items.slice().sort((a, b) => byText(a.label, b.label));
  const selected = new Set(selectedIds);
  const pending = [];
  const boxes = new Map();
  const chips = h('ul', { class: 'chips', 'aria-live': 'polite' });
  const empty = h('p', { class: 'picker-empty', hidden: true }, noMatchText);

  const chip = (label, onRemove, isNew = false) =>
    h('li', { class: `chip${isNew ? ' chip-new' : ''}` }, label,
      isNew ? h('span', { class: 'chip-tag' }, create.newBadge) : null,
      h('button', { type: 'button', 'aria-label': `${T.common.remove} ${label}`, onclick: onRemove }, '×'));

  function renderChips() {
    clear(chips);
    const sel = sorted.filter((i) => selected.has(i.id));
    sel.forEach((i) => chips.append(chip(i.label, () => { selected.delete(i.id); boxes.get(i.id).checked = false; renderChips(); })));
    pending.forEach((name, idx) => chips.append(chip(name, () => { pending.splice(idx, 1); renderChips(); }, true)));
    if (!sel.length && !pending.length) chips.append(h('li', { class: 'chips-empty' }, noneText));
  }

  const list = h('ul', { class: 'picker-list' }, sorted.map((item) => {
    const cb = h('input', { type: 'checkbox', checked: selected.has(item.id) });
    cb.addEventListener('change', () => { if (cb.checked) selected.add(item.id); else selected.delete(item.id); renderChips(); });
    boxes.set(item.id, cb);
    return h('li', { dataset: { search: normalizeSearch(item.label) } }, h('label', {}, cb, h('span', {}, item.label)));
  }));

  const search = h('input', { type: 'search', class: 'picker-search', 'aria-label': searchLabel, placeholder: searchLabel, autocomplete: 'off' });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  search.addEventListener('input', () => {
    const q = normalizeSearch(search.value);
    let visible = 0;
    for (const li of list.children) {
      const show = !q || li.dataset.search.includes(q);
      li.hidden = !show;
      if (show) visible++;
    }
    empty.hidden = visible > 0;
  });

  let createRow = null;
  if (create) {
    const input = h('input', { type: 'text', class: 'picker-new', 'aria-label': create.label, placeholder: create.label, maxlength: '100', autocomplete: 'off' });
    const err = h('p', { class: 'field-error', hidden: true, role: 'alert' });
    const add = () => {
      const errors = validateThemeName(input.value, items.map((i) => ({ name: i.label })), pending);
      if (errors.length) { err.textContent = errors[0].message; err.hidden = false; return; }
      pending.push(input.value.trim());
      input.value = '';
      err.hidden = true;
      renderChips();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    input.addEventListener('input', () => { err.hidden = true; });
    createRow = h('div', { class: 'picker-create' },
      h('div', { class: 'picker-create-row' }, input, h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: add }, create.addLabel)), err);
  }

  renderChips();
  return {
    el: h('div', { class: 'picker' }, chips, search, list, empty, createRow),
    getSelectedIds: () => [...selected],
    getPendingNames: () => [...pending],
  };
}

// ---- Reading fields (shared by the reading form and the book form) --------
function buildReadingFields({ namePrefix = '', values = {}, books = null, lockBook = false, fixedBookId = null }) {
  const n = (k) => `${namePrefix}${k}`;
  const nodes = [];

  let bookSel = null;
  if (books) {
    bookSel = h('select', { name: 'bookId', disabled: lockBook },
      h('option', { value: '' }, T.reading.bookPlaceholder),
      books.slice().sort((a, b) => byText(a.title, b.title)).map((b) => h('option', { value: b.id, selected: b.id === fixedBookId }, b.title)));
    nodes.push(field({ name: n('bookId'), label: T.reading.book, control: bookSel, required: true }).el);
  }

  const statusSel = selectEl('status', STATUSES, values.status ?? STATUS.WANT_TO_READ);
  const priority = selectEl('priority', PRIORITIES, values.priority ?? null, T.reading.priorityNone);
  const year = h('input', { type: 'number', name: 'yearRead', step: '1', inputmode: 'numeric', value: values.yearRead ?? '' });
  const grade = h('input', { type: 'number', name: 'grade', step: String(GRADE.STEP), min: String(GRADE.MIN), max: String(GRADE.MAX), inputmode: 'decimal', value: values.grade ?? '' });
  const recommended = h('input', { type: 'text', name: 'recommendedBy', value: values.recommendedBy ?? '', autocomplete: 'off' });
  const notes = h('textarea', { name: 'notes', rows: '3' });
  notes.value = values.notes ?? '';

  const fStatus = field({ name: n('status'), label: T.reading.status, control: statusSel, required: true });
  const fPriority = field({ name: n('priority'), label: T.reading.priority, control: priority, hint: T.reading.priorityHint });
  const fYear = field({ name: n('yearRead'), label: T.reading.yearRead, control: year, hint: T.reading.yearHint });
  const fGrade = field({ name: n('grade'), label: T.reading.grade, control: grade, hint: T.reading.gradeHint });
  nodes.push(
    h('div', { class: 'field-row' }, fStatus.el, fPriority.el),
    h('div', { class: 'field-row' }, fYear.el, fGrade.el),
    field({ name: n('recommendedBy'), label: T.reading.recommendedBy, control: recommended }).el,
    field({ name: n('notes'), label: T.reading.notes, control: notes }).el);

  function sync() {
    const rules = allowedFields(statusSel.value);
    year.disabled = !rules.year;
    grade.disabled = !rules.grade;
    priority.disabled = !rules.priority;
    fYear.setRequired(statusSel.value === STATUS.READ);
  }
  sync();

  let previous = statusSel.value;
  statusSel.addEventListener('change', async () => {
    const next = statusSel.value;
    const plan = applyStatusChange({ status: previous, yearRead: year.value, grade: grade.value, priority: priority.value }, next);
    if (plan.needsConfirmation) {
      const ok = await confirmDialog({
        title: T.reading.clear.title,
        message: T.reading.clear.message(next, plan.clearedFields.map((f) => T.reading.fieldNames[f])),
        confirmLabel: T.reading.clear.confirm,
      });
      if (!ok) { statusSel.value = previous; sync(); return; }
    }
    year.value = plan.reading.yearRead ?? '';
    grade.value = plan.reading.grade ?? '';
    priority.value = plan.reading.priority ?? '';
    previous = next;
    sync();
    if (plan.requiresYear) year.focus();
  });

  return {
    nodes,
    getValues: () => ({
      bookId: bookSel ? bookSel.value : fixedBookId,
      status: statusSel.value, yearRead: year.value, grade: grade.value, priority: priority.value,
      recommendedBy: recommended.value, notes: notes.value,
    }),
  };
}

// ---- Public forms ------------------------------------------------------
export function openAuthorForm({ author = null, countries, onSubmit }) {
  const name = h('input', { type: 'text', name: 'name', value: author?.name ?? '', autocomplete: 'off', maxlength: '200' });
  const country = h('select', { name: 'countryId' },
    h('option', { value: '' }, T.common.notSpecified),
    countries.map((c) => h('option', { value: c.id, selected: c.id === author?.countryId }, c.name)));
  const birth = h('input', { type: 'date', name: 'birthDate', value: author?.birthDate ?? '', max: todayISO() });
  const death = h('input', { type: 'date', name: 'deathDate', value: author?.deathDate ?? '' });
  const body = h('div', { class: 'fields' },
    field({ name: 'name', label: T.authors.form.name, control: name, required: true }).el,
    field({ name: 'countryId', label: T.authors.form.nationality, control: country }).el,
    h('div', { class: 'field-row' },
      field({ name: 'birthDate', label: T.authors.form.birthDate, control: birth }).el,
      field({ name: 'deathDate', label: T.authors.form.deathDate, control: death }).el));
  openShell({
    title: author ? T.authors.form.editTitle : T.authors.form.addTitle,
    body,
    getValues: () => ({ id: author?.id ?? null, name: name.value, countryId: country.value, birthDate: birth.value, deathDate: death.value }),
    onSubmit,
  });
}

export function openBookForm({ book = null, authors, themes, onSubmit }) {
  const F = T.books.form;
  const title = h('input', { type: 'text', name: 'title', value: book?.title ?? '', autocomplete: 'off' });
  const year = h('input', { type: 'number', name: 'publicationYear', step: '1', inputmode: 'numeric', value: book?.publicationYear ?? '' });
  const formSel = selectEl('form', FORMS, book?.form ?? null, F.choose);
  const modeSel = selectEl('mode', MODES, book?.mode ?? null, F.choose);
  const contentSel = selectEl('content', CONTENTS, book?.content ?? null, F.choose);

  const authorPicker = createPicker({
    items: authors.map((a) => ({ id: a.id, label: a.name })), selectedIds: book?.authorIds ?? [],
    searchLabel: F.authorSearch, noMatchText: F.authorsNone, noneText: F.noAuthorSelected,
  });
  const themePicker = createPicker({
    items: themes.map((t) => ({ id: t.id, label: t.name })), selectedIds: book?.themeIds ?? [],
    searchLabel: F.themeSearch, noMatchText: F.themesNone, noneText: F.noThemeSelected,
    create: { label: F.newTheme, addLabel: F.addTheme, newBadge: F.newBadge },
  });

  const nodes = [
    field({ name: 'title', label: F.title, control: title, required: true }).el,
    field({ name: 'authorIds', label: F.authors, control: authorPicker.el, hint: F.authorsHint, group: true }).el,
    field({ name: 'publicationYear', label: F.publicationYear, control: year, hint: F.yearHint }).el,
    h('div', { class: 'field-row field-row-3' },
      field({ name: 'form', label: F.form, control: formSel }).el,
      field({ name: 'mode', label: F.mode, control: modeSel }).el,
      field({ name: 'content', label: F.content, control: contentSel }).el),
    field({ name: 'themes', label: F.themes, control: themePicker.el, group: true }).el,
  ];

  let reading = null;
  let toggle = null;
  if (!book) {
    const FR = T.books.firstReading;
    toggle = h('input', { type: 'checkbox', id: 'first-reading-toggle' });
    reading = buildReadingFields({ namePrefix: 'firstReading.', values: { status: STATUS.WANT_TO_READ } });
    const host = h('div', { class: 'subform-fields', hidden: true }, reading.nodes);
    toggle.addEventListener('change', () => { host.hidden = !toggle.checked; });
    nodes.push(h('fieldset', { class: 'subform' },
      h('legend', {}, FR.legend),
      h('p', { class: 'field-hint' }, FR.hint),
      h('label', { class: 'check' }, toggle, h('span', {}, FR.toggle)),
      host));
  }

  openShell({
    title: book ? F.editTitle : F.addTitle,
    body: h('div', { class: 'fields' }, nodes),
    getValues: () => ({
      book: {
        id: book?.id ?? null, title: title.value, authorIds: authorPicker.getSelectedIds(),
        publicationYear: year.value, form: formSel.value, mode: modeSel.value, content: contentSel.value,
        themeIds: themePicker.getSelectedIds(),
      },
      newThemeNames: themePicker.getPendingNames(),
      firstReading: toggle?.checked ? reading.getValues() : null,
    }),
    onSubmit,
  });
}

export function openReadingForm({ reading = null, books, bookId = null, lockBook = false, defaults = {}, title, subtitle = null, onSubmit }) {
  const fixedBookId = reading ? reading.bookId : bookId;
  const fields = buildReadingFields({ values: reading ?? defaults, books, lockBook: lockBook || Boolean(reading), fixedBookId });
  openShell({
    title: title ?? (reading ? T.reading.editTitle : T.reading.addTitle),
    subtitle: subtitle ?? books.find((b) => b.id === fixedBookId)?.title ?? null,
    body: h('div', { class: 'fields' }, fields.nodes),
    getValues: () => ({ ...fields.getValues(), id: reading?.id ?? null }),
    onSubmit,
  });
}
