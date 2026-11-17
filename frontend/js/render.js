// View rendering (UI only). Receives plain data and callbacks; never touches storage.
import { h, clear } from './dom.js';
import { T } from './strings.js';
import { MISSING } from './constants.js';
import { formatDate, formatYear, formatGrade, statusSlug } from './utils.js';

const pageHead = (title, subtitle, actions = []) =>
  h('header', { class: 'page-head' },
    h('div', {}, h('h1', {}, title), subtitle ? h('p', { class: 'page-sub' }, subtitle) : null),
    actions.length ? h('div', { class: 'page-actions' }, actions) : null);

const button = (label, cls, onclick, extra = {}) => h('button', { type: 'button', class: `btn ${cls}`, onclick, ...extra }, label);

const emptyState = ({ title, text, actionLabel, onAction }) =>
  h('div', { class: 'empty' },
    h('h2', {}, title), h('p', {}, text),
    actionLabel ? button(actionLabel, 'btn-primary', onAction) : null);

export const statusBadge = (status) => h('span', { class: `badge status-${statusSlug(status)}` }, status);
const orMissing = (v) => (v === null || v === undefined || v === '' ? MISSING : v);

function table({ columns, rows, head }) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      head ?? h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: c.class }, c.label)))),
      h('tbody', {}, rows.map((row) =>
        h('tr', {}, columns.map((c) => h('td', { class: c.class, dataset: { label: c.label } }, c.render(row))))))));
}

const rowActions = (...buttons) => h('div', { class: 'row-actions' }, buttons);
const smallBtn = (label, onclick, cls = 'btn-ghost', aria = null) =>
  h('button', { type: 'button', class: `btn btn-small ${cls}`, onclick, 'aria-label': aria }, label);

function searchBar({ label, placeholder, onSearch }) {
  const input = h('input', { type: 'search', class: 'search', placeholder, 'aria-label': label, autocomplete: 'off' });
  input.addEventListener('input', () => onSearch(input.value));
  const count = h('p', { class: 'count', 'aria-live': 'polite' });
  return { el: h('div', { class: 'toolbar' }, input, count), count };
}

// ---- Dashboard -----------------------------------------------------------
export function mountDashboard(root) {
  clear(root);
  const body = h('div', {});
  root.append(body);
  return {
    update({ stats }) {
      const D = T.dashboard;
      const tiles = [
        ['totalBooks', stats.totalBooks, null], ['totalAuthors', stats.totalAuthors, null],
        ['booksRead', stats.booksRead, 'read'], ['currentlyReading', stats.currentlyReading, 'reading'],
        ['wantToRead', stats.wantToRead, 'want-to-read'], ['paused', stats.paused, 'paused'],
        ['abandoned', stats.abandoned, 'abandoned'],
        ['averageGrade', stats.averageGrade === null ? MISSING : stats.averageGrade.toFixed(1), null],
      ];
      const max = Math.max(1, ...stats.perYear.map((y) => y.count));
      const att = stats.attention;
      const attention = [
        [att.booksNoAuthor, D.attention.booksNoAuthor], [att.booksNoYear, D.attention.booksNoYear],
        [att.readNoGrade, D.attention.readNoGrade], [att.authorsNoCountry, D.attention.authorsNoCountry],
      ].filter(([n]) => n > 0);

      clear(body);
      body.append(
        pageHead(D.title, null),
        h('p', { class: 'lede' }, D.lede(stats.booksRead, stats.firstYear)),
        h('dl', { class: 'stats' }, tiles.map(([key, value, tone]) =>
          h('div', { class: `stat${tone ? ` stat-${tone}` : ''}` },
            h('dt', {}, D.stats[key]),
            h('dd', {}, String(value)),
            key === 'averageGrade' && stats.gradedCount ? h('p', { class: 'stat-hint' }, D.averageHint(stats.gradedCount)) : null))),
        h('div', { class: 'panels' },
          h('section', { class: 'panel', 'aria-labelledby': 'per-year-title' },
            h('h2', { id: 'per-year-title' }, D.perYear.title),
            stats.perYear.length
              ? h('ul', { class: 'year-list' }, stats.perYear.map((y) =>
                h('li', {}, h('span', { class: 'year-label' }, String(y.year)),
                  h('progress', { class: 'bar', max: String(max), value: String(y.count), 'aria-label': `${y.year}: ${D.perYear.count(y.count)}` }),
                  h('span', { class: 'year-count' }, String(y.count)))))
              : h('p', { class: 'muted' }, D.perYear.empty)),
          h('section', { class: 'panel', 'aria-labelledby': 'attention-title' },
            h('h2', { id: 'attention-title' }, D.attention.title),
            attention.length
              ? h('ul', { class: 'attention-list' }, attention.map(([n, text]) => h('li', {}, text(n))))
              : h('p', { class: 'muted' }, D.attention.allGood))));
    },
  };
}

// ---- Books ---------------------------------------------------------------
export function mountBooks(root, { onSearch, onAdd, onEdit, onDelete, onAddReading }) {
  clear(root);
  const B = T.books;
  const bar = searchBar({ label: B.searchLabel, placeholder: B.searchPlaceholder, onSearch });
  const host = h('div', {});
  root.append(pageHead(B.title, B.subtitle, [button(B.add, 'btn-primary', onAdd)]), bar.el, host);
  const columns = [
    { label: B.columns.title, class: 'cell-title', render: (r) => r.title },
    { label: B.columns.authors, render: (r) => (r.authors.length ? r.authors.join(', ') : MISSING) },
    { label: B.columns.year, class: 'cell-num', render: (r) => formatYear(r.publicationYear) },
    { label: B.columns.form, render: (r) => orMissing(r.form) },
    { label: B.columns.themes, render: (r) => (r.themes.length
      ? h('span', { class: 'tags' }, r.themes.slice(0, 3).map((t) => h('span', { class: 'tag' }, t)), r.themes.length > 3 ? h('span', { class: 'tag tag-more' }, `+${r.themes.length - 3}`) : null)
      : MISSING) },
    { label: B.columns.readings, class: 'cell-num', render: (r) => String(r.readingCount) },
    { label: B.columns.actions, class: 'cell-actions', render: (r) => rowActions(
      smallBtn(B.addReading, () => onAddReading(r.id), 'btn-ghost', `${B.addReading}: ${r.title}`),
      smallBtn(T.common.edit, () => onEdit(r.id), 'btn-ghost', `${T.common.edit}: ${r.title}`),
      smallBtn(T.common.delete, () => onDelete(r.id), 'btn-ghost btn-danger-text', `${T.common.delete}: ${r.title}`)) },
  ];
  return {
    update({ rows, query, total }) {
      clear(host);
      bar.count.textContent = B.count(rows.length, total);
      if (!rows.length) {
        host.append(total === 0
          ? emptyState({ title: B.empty.title, text: B.empty.text, actionLabel: B.add, onAction: onAdd })
          : emptyState({ title: B.noMatch(query), text: '' }));
        return;
      }
      host.append(table({ columns, rows }));
    },
  };
}

// ---- Authors -------------------------------------------------------------
export function mountAuthors(root, { onSearch, onAdd, onEdit, onDelete }) {
  clear(root);
  const A = T.authors;
  const bar = searchBar({ label: A.searchLabel, placeholder: A.searchPlaceholder, onSearch });
  const host = h('div', {});
  root.append(pageHead(A.title, A.subtitle, [button(A.add, 'btn-primary', onAdd)]), bar.el, host);
  const columns = [
    { label: A.columns.name, class: 'cell-title', render: (r) => r.name },
    { label: A.columns.nationality, render: (r) => orMissing(r.country) },
    { label: A.columns.born, render: (r) => formatDate(r.birthDate) },
    { label: A.columns.died, render: (r) => formatDate(r.deathDate) },
    { label: A.columns.books, class: 'cell-num', render: (r) => String(r.bookCount) },
    { label: A.columns.actions, class: 'cell-actions', render: (r) => rowActions(
      smallBtn(T.common.edit, () => onEdit(r.id), 'btn-ghost', `${T.common.edit}: ${r.name}`),
      smallBtn(T.common.delete, () => onDelete(r.id), 'btn-ghost btn-danger-text', `${T.common.delete}: ${r.name}`)) },
  ];
  return {
    update({ rows, query, total }) {
      clear(host);
      bar.count.textContent = A.count(rows.length, total);
      if (!rows.length) {
        host.append(total === 0
          ? emptyState({ title: A.empty.title, text: A.empty.text, actionLabel: A.add, onAction: onAdd })
          : emptyState({ title: A.noMatch(query), text: '' }));
        return;
      }
      host.append(table({ columns, rows }));
    },
  };
}

// ---- Reading Log ---------------------------------------------------------
const SORT_KEYS = ['title', 'authors', 'status', 'yearRead', 'grade'];

export function mountReadingLog(root, { onAdd, onEdit, onDelete, onReread, onSort, onSortKey, onSortDir }) {
  clear(root);
  const L = T.readingLog;
  const keySel = h('select', { 'aria-label': L.sortBy }, SORT_KEYS.map((k) => h('option', { value: k }, L.columns[k])));
  keySel.addEventListener('change', () => onSortKey(keySel.value));
  const dirBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: onSortDir });
  const count = h('p', { class: 'count', 'aria-live': 'polite' });
  const host = h('div', {});
  root.append(
    pageHead(L.title, L.subtitle, [button(L.add, 'btn-primary', onAdd)]),
    h('div', { class: 'toolbar mobile-sort' }, h('label', {}, L.sortBy, ' ', keySel), dirBtn, count),
    host);

  const columns = [
    { key: 'title', label: L.columns.title, class: 'cell-title', render: (r) => r.title },
    { key: 'authors', label: L.columns.authors, render: (r) => orMissing(r.authors) },
    { key: 'status', label: L.columns.status, render: (r) => statusBadge(r.status) },
    { key: 'yearRead', label: L.columns.yearRead, class: 'cell-num', render: (r) => orMissing(r.yearRead) },
    { key: 'grade', label: L.columns.grade, class: 'cell-num', render: (r) => formatGrade(r.grade) },
    { label: L.columns.actions, class: 'cell-actions', render: (r) => rowActions(
      smallBtn(L.reread, () => onReread(r.bookId), 'btn-ghost', `${L.reread}: ${r.title}`),
      smallBtn(T.common.edit, () => onEdit(r.id), 'btn-ghost', `${T.common.edit}: ${r.title}`),
      smallBtn(T.common.delete, () => onDelete(r.id), 'btn-ghost btn-danger-text', `${T.common.delete}: ${r.title}`)) },
  ];

  return {
    update({ rows, sort, total }) {
      clear(host);
      count.textContent = String(total);
      keySel.value = sort.key;
      dirBtn.textContent = sort.dir === 'asc' ? L.ascending : L.descending;
      if (!rows.length) {
        host.append(emptyState({ title: L.empty.title, text: L.empty.text, actionLabel: L.add, onAction: onAdd }));
        return;
      }
      const head = h('thead', {}, h('tr', {}, columns.map((c) => {
        if (!c.key) return h('th', { scope: 'col', class: c.class }, c.label);
        const active = sort.key === c.key;
        return h('th', { scope: 'col', class: c.class, 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
          h('button', { type: 'button', class: 'sort-btn', onclick: () => onSort(c.key) }, c.label));
      })));
      host.append(table({ columns, rows, head }));
    },
  };
}

// ---- Settings ------------------------------------------------------------
export function mountSettings(root, { onReset }) {
  clear(root);
  const body = h('div', {});
  root.append(body);
  return {
    update({ counts }) {
      const S = T.settings;
      clear(body);
      body.append(
        pageHead(S.title, S.subtitle),
        h('section', { class: 'panel panel-wide', 'aria-labelledby': 'storage-title' },
          h('h2', { id: 'storage-title' }, S.storage.title), h('p', {}, S.storage.summary(counts))),
        h('section', { class: 'panel panel-wide', 'aria-labelledby': 'reset-title' },
          h('h2', { id: 'reset-title' }, S.reset.title), h('p', {}, S.reset.text),
          button(S.reset.button, 'btn-danger', onReset)));
    },
  };
}
