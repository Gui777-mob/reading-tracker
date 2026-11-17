// The ONLY module that touches localStorage. Every function is async and the
// interface is storage-agnostic: in Delivery 2 only this file is rewritten to
// call the REST API. Errors use the API shape { status, message, errors }.
import { STORAGE_KEY, SEED_URL, COLLECTIONS } from './constants.js';
import { ApiError, badRequest, notFound, conflict } from './errors.js';
import { T } from './strings.js';

let seedLoading = null;

const hasShape = (db) => COLLECTIONS.every((k) => Array.isArray(db?.[k]));

function readDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const db = JSON.parse(raw);
    return hasShape(db) ? db : null;
  } catch {
    return null; // missing, unreadable or corrupted: fall back to the seed
  }
}

function writeDb(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    throw new ApiError(500, T.errors.storageWrite, []);
  }
}

async function fetchSeed() {
  let res;
  try {
    res = await fetch(SEED_URL, { cache: 'no-store' });
  } catch {
    throw new ApiError(500, T.errors.seedLoad, []);
  }
  if (!res.ok) throw new ApiError(500, T.errors.seedLoad, []);
  const seed = await res.json();
  if (!hasShape(seed)) throw new ApiError(500, T.errors.seedShape, []);
  return seed;
}

// First access: fetch seed.json and save it. Later accesses read localStorage only.
async function loadDb() {
  const db = readDb();
  if (db) return db;
  if (!seedLoading) {
    seedLoading = fetchSeed().then((seed) => { writeDb(seed); return seed; }).finally(() => { seedLoading = null; });
  }
  return structuredClone(await seedLoading);
}

const nextId = (list) => list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

function upsert(list, entity, label) {
  if (entity.id === null || entity.id === undefined) {
    const created = { ...entity, id: nextId(list) };
    list.push(created);
    return created;
  }
  const i = list.findIndex((x) => x.id === entity.id);
  if (i < 0) throw notFound(T.errors.notFound(label, entity.id));
  list[i] = { ...entity };
  return list[i];
}

// ---- Reads -------------------------------------------------------------
export async function getAuthors() { return (await loadDb()).authors; }
export async function getBooks() { return (await loadDb()).books; }
export async function getReadings() { return (await loadDb()).readings; }
export async function getThemes() { return (await loadDb()).themes; }
export async function getCountries() { return (await loadDb()).countries; }
export async function getAllData() { return await loadDb(); }

// ---- Authors -----------------------------------------------------------
export async function saveAuthor(author) {
  const db = await loadDb();
  if (db.authors.some((a) => a.id !== author.id && sameName(a.name, author.name))) {
    const message = T.errors.authorDuplicate(String(author.name).trim());
    throw conflict(message, [{ field: 'name', message }]);
  }
  const saved = upsert(db.authors, author, 'Author');
  writeDb(db);
  return structuredClone(saved);
}

export async function deleteAuthor(id) {
  const db = await loadDb();
  const author = db.authors.find((a) => a.id === id);
  if (!author) throw notFound(T.errors.notFound('Author', id));
  const linked = db.books.filter((b) => b.authorIds.includes(id));
  if (linked.length) {
    const message = T.errors.authorLinked(author.name, linked.map((b) => b.title));
    throw conflict(message, [{ field: 'id', message }]);
  }
  db.authors = db.authors.filter((a) => a.id !== id);
  writeDb(db);
}

// ---- Books -------------------------------------------------------------
export async function saveBook(book) {
  const db = await loadDb();
  const errors = [];
  if ((book.authorIds ?? []).some((id) => !db.authors.some((a) => a.id === id))) errors.push({ field: 'authorIds', message: T.errors.unknownAuthor });
  if ((book.themeIds ?? []).some((id) => !db.themes.some((t) => t.id === id))) errors.push({ field: 'themes', message: T.errors.unknownTheme });
  if (errors.length) throw badRequest(errors);
  const saved = upsert(db.books, book, 'Book');
  writeDb(db);
  return structuredClone(saved);
}

// Deleting a book also deletes all of its readings.
export async function deleteBook(id) {
  const db = await loadDb();
  if (!db.books.some((b) => b.id === id)) throw notFound(T.errors.notFound('Book', id));
  db.books = db.books.filter((b) => b.id !== id);
  db.readings = db.readings.filter((r) => r.bookId !== id);
  writeDb(db);
}

// ---- Readings ----------------------------------------------------------
export async function saveReading(reading) {
  const db = await loadDb();
  if (!db.books.some((b) => b.id === reading.bookId)) throw notFound(T.errors.notFound('Book', reading.bookId));
  const saved = upsert(db.readings, reading, 'Reading');
  writeDb(db);
  return structuredClone(saved);
}

export async function deleteReading(id) {
  const db = await loadDb();
  if (!db.readings.some((r) => r.id === id)) throw notFound(T.errors.notFound('Reading', id));
  db.readings = db.readings.filter((r) => r.id !== id);
  writeDb(db);
}

// ---- Themes ------------------------------------------------------------
export async function saveTheme(theme) {
  const db = await loadDb();
  if (db.themes.some((t) => t.id !== theme.id && sameName(t.name, theme.name))) {
    const message = T.errors.themeDuplicate(String(theme.name).trim());
    throw conflict(message, [{ field: 'themes', message }]);
  }
  const saved = upsert(db.themes, { ...theme, name: String(theme.name).trim() }, 'Theme');
  writeDb(db);
  return structuredClone(saved);
}

export async function deleteTheme(id) { // used to roll back a failed multi-step save
  const db = await loadDb();
  db.themes = db.themes.filter((t) => t.id !== id);
  writeDb(db);
}

// ---- Reset -------------------------------------------------------------
export async function resetData() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignored: overwritten below */ }
  const seed = await fetchSeed();
  writeDb(seed);
}
