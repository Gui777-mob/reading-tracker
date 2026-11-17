// Entry point: routing, state and wiring between services, views and forms.
import * as store from './store.js';
import * as authorsSvc from './authors.js';
import * as booksSvc from './books.js';
import * as readingsSvc from './readings.js';
import * as view from './render.js';
import * as forms from './forms.js';
import { confirmDialog, noticeDialog, toast } from './dialogs.js';
import { T } from './strings.js';
import { ApiError } from './errors.js';
import { STATUS, ROUTES, DEFAULT_ROUTE, DEFAULT_LOG_SORT } from './constants.js';

const state = { data: null, route: null, booksQuery: '', authorsQuery: '', logSort: { ...DEFAULT_LOG_SORT } };
let current = null;
const main = document.getElementById('view');

const resolve = (path) => path.split('.').reduce((o, k) => o?.[k], T);

function applyStaticText() {
  document.title = T.app.name;
  document.querySelectorAll('[data-text]').forEach((el) => { el.textContent = resolve(el.dataset.text); });
  document.querySelectorAll('[data-aria-label]').forEach((el) => el.setAttribute('aria-label', resolve(el.dataset.ariaLabel)));
}

// Runs a handler and reports unexpected failures as an error toast.
const run = (fn) => async (...args) => {
  try { await fn(...args); } catch (err) {
    if (!(err instanceof ApiError)) console.error(err);
    toast(err instanceof ApiError ? err.message : T.errors.unexpected, { type: 'error' });
  }
};

async function reload() {
  state.data = await store.getAllData();
  refresh();
}

function model() {
  const d = state.data;
  switch (state.route) {
    case 'dashboard': return { stats: readingsSvc.computeStats(d) };
    case 'books': return { rows: booksSvc.buildBookRows(d, state.booksQuery), query: state.booksQuery, total: d.books.length };
    case 'authors': return { rows: authorsSvc.buildAuthorRows(d, state.authorsQuery), query: state.authorsQuery, total: d.authors.length };
    case 'reading-log': return { rows: readingsSvc.sortLogRows(readingsSvc.buildLogRows(d), state.logSort), sort: state.logSort, total: d.readings.length };
    default: return { counts: { books: d.books.length, authors: d.authors.length, readings: d.readings.length, themes: d.themes.length } };
  }
}
const refresh = () => current?.update(model());

// ---- Actions ---------------------------------------------------------------
const bookById = (id) => state.data.books.find((b) => b.id === id);

function addAuthor() {
  forms.openAuthorForm({ countries: state.data.countries, onSubmit: async (v) => {
    await authorsSvc.saveAuthor(v); await reload(); toast(T.authors.toast.saved);
  } });
}
function editAuthor(id) {
  const author = state.data.authors.find((a) => a.id === id);
  forms.openAuthorForm({ author, countries: state.data.countries, onSubmit: async (v) => {
    await authorsSvc.saveAuthor(v); await reload(); toast(T.authors.toast.saved);
  } });
}
async function deleteAuthor(id) {
  const author = state.data.authors.find((a) => a.id === id);
  const linked = authorsSvc.findLinkedBooks(id, state.data.books);
  if (linked.length) {
    await noticeDialog({ title: T.authors.blocked.title, message: T.authors.blocked.message(author.name, linked.length), items: linked.map((b) => b.title) });
    return;
  }
  const ok = await confirmDialog({ title: T.authors.delete.title, message: T.authors.delete.message(author.name), confirmLabel: T.authors.delete.confirm, danger: true });
  if (!ok) return;
  try {
    await authorsSvc.deleteAuthor(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) { await noticeDialog({ title: T.authors.blocked.title, message: err.message }); return; }
    throw err;
  }
  await reload();
  toast(T.authors.toast.deleted);
}

const saveBookFromForm = async (v) => {
  const result = await booksSvc.saveBook(v.book, { newThemeNames: v.newThemeNames, firstReading: v.firstReading });
  await reload();
  toast(result.reading ? T.books.toast.savedWithReading : T.books.toast.saved);
};
const addBook = () => forms.openBookForm({ authors: state.data.authors, themes: state.data.themes, onSubmit: saveBookFromForm });
const editBook = (id) => forms.openBookForm({ book: bookById(id), authors: state.data.authors, themes: state.data.themes, onSubmit: saveBookFromForm });
async function deleteBook(id) {
  const book = bookById(id);
  const n = state.data.readings.filter((r) => r.bookId === id).length;
  const ok = await confirmDialog({ title: T.books.delete.title, message: T.books.delete.message(book.title, n), confirmLabel: T.books.delete.confirm, danger: true });
  if (!ok) return;
  await booksSvc.deleteBook(id);
  await reload();
  toast(T.books.toast.deleted);
}

const saveReadingFromForm = async (v) => { await readingsSvc.saveReading(v); await reload(); toast(T.readingLog.toast.saved); };
const addReadingFor = (bookId) => forms.openReadingForm({
  books: state.data.books, bookId, lockBook: true, defaults: { status: STATUS.READING },
  title: T.reading.rereadTitle, subtitle: bookById(bookId)?.title, onSubmit: saveReadingFromForm,
});
const addReading = () => forms.openReadingForm({ books: state.data.books, defaults: { status: STATUS.WANT_TO_READ }, onSubmit: saveReadingFromForm });
const editReading = (id) => forms.openReadingForm({ reading: state.data.readings.find((r) => r.id === id), books: state.data.books, onSubmit: saveReadingFromForm });
async function deleteReading(id) {
  const reading = state.data.readings.find((r) => r.id === id);
  const ok = await confirmDialog({ title: T.readingLog.delete.title, message: T.readingLog.delete.message(bookById(reading.bookId)?.title ?? ''), confirmLabel: T.readingLog.delete.confirm, danger: true });
  if (!ok) return;
  await readingsSvc.deleteReading(id);
  await reload();
  toast(T.readingLog.toast.deleted);
}

async function resetData() {
  const S = T.settings.reset;
  const ok = await confirmDialog({ title: S.confirmTitle, message: S.confirmMessage, confirmLabel: S.confirmLabel, danger: true });
  if (!ok) return;
  await store.resetData();
  state.booksQuery = ''; state.authorsQuery = ''; state.logSort = { ...DEFAULT_LOG_SORT };
  await reload();
  toast(S.done);
}

const defaultDir = (key) => (key === 'yearRead' || key === 'grade' ? 'desc' : 'asc');
const flip = (dir) => (dir === 'asc' ? 'desc' : 'asc');

// ---- Routing ---------------------------------------------------------------
function mountRoute() {
  switch (state.route) {
    case 'books': current = view.mountBooks(main, {
      onSearch: (q) => { state.booksQuery = q; refresh(); }, onAdd: addBook, onEdit: editBook,
      onDelete: run(deleteBook), onAddReading: addReadingFor }); break;
    case 'authors': current = view.mountAuthors(main, {
      onSearch: (q) => { state.authorsQuery = q; refresh(); }, onAdd: addAuthor, onEdit: editAuthor, onDelete: run(deleteAuthor) }); break;
    case 'reading-log': current = view.mountReadingLog(main, {
      onAdd: addReading, onEdit: editReading, onDelete: run(deleteReading), onReread: addReadingFor,
      onSort: (key) => { state.logSort = state.logSort.key === key ? { key, dir: flip(state.logSort.dir) } : { key, dir: defaultDir(key) }; refresh(); },
      onSortKey: (key) => { state.logSort = { key, dir: defaultDir(key) }; refresh(); },
      onSortDir: () => { state.logSort = { ...state.logSort, dir: flip(state.logSort.dir) }; refresh(); } }); break;
    case 'settings': current = view.mountSettings(main, { onReset: run(resetData) }); break;
    default: current = view.mountDashboard(main);
  }
  refresh();
}

function navigate() {
  const hash = location.hash.slice(1);
  state.route = ROUTES.includes(hash) ? hash : DEFAULT_ROUTE;
  if (hash !== state.route) history.replaceState(null, '', `#${state.route}`);
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === state.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  setMenu(false);
  mountRoute();
}

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
  document.getElementById('scrim').hidden = !open;
}

function showFatal(err) {
  console.error(err);
  main.replaceChildren();
  const box = document.createElement('div');
  box.className = 'empty';
  const title = document.createElement('h2'); title.textContent = T.fatal.title;
  const text = document.createElement('p'); text.textContent = err instanceof ApiError ? err.message : T.errors.unexpected;
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'btn btn-primary'; retry.textContent = T.fatal.retry;
  retry.addEventListener('click', init);
  box.append(title, text, retry);
  main.append(box);
}

async function init() {
  try {
    state.data = await store.getAllData(); // first run loads seed.json
    navigate();
  } catch (err) { showFatal(err); }
}

applyStaticText();
document.getElementById('menu-toggle').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.getElementById('scrim').addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('hashchange', () => { if (state.data) navigate(); });
init();
