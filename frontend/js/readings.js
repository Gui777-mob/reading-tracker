import * as store from './store.js';
import { STATUS } from './constants.js';
import { validateReading, assertValid } from './validation.js';
import { toText, toNumberOrNull, byText } from './utils.js';

export function normalizeReading(raw) {
  return {
    id: raw.id ?? null,
    bookId: toNumberOrNull(raw.bookId),
    status: toText(raw.status),
    yearRead: toNumberOrNull(raw.yearRead),
    grade: toNumberOrNull(raw.grade),
    priority: toText(raw.priority),
    recommendedBy: toText(raw.recommendedBy),
    notes: toText(raw.notes),
  };
}

export async function saveReading(raw) {
  const reading = normalizeReading(raw);
  const books = await store.getBooks();
  const book = books.find((b) => b.id === reading.bookId);
  assertValid(validateReading(reading, { book }));
  return store.saveReading(reading);
}

export const deleteReading = (id) => store.deleteReading(id);

// ---- Reading Log view model (FR-05) ------------------------------------
export function buildLogRows(data) {
  const books = new Map(data.books.map((b) => [b.id, b]));
  const authors = new Map(data.authors.map((a) => [a.id, a.name]));
  return data.readings.map((r) => {
    const book = books.get(r.bookId);
    const names = (book?.authorIds ?? []).map((id) => authors.get(id)).filter(Boolean);
    return {
      id: r.id, bookId: r.bookId, title: book?.title ?? '', authors: names.join(', '),
      status: r.status, yearRead: r.yearRead, grade: r.grade,
    };
  });
}

const isMissing = (v) => v === null || v === undefined || v === '';

// Missing values always go last (in both directions); ties are broken by ID.
export function sortLogRows(rows, { key, dir }) {
  return rows.slice().sort((a, b) => {
    const va = a[key], vb = b[key];
    const ma = isMissing(va), mb = isMissing(vb);
    if (ma && mb) return a.id - b.id;
    if (ma) return 1;
    if (mb) return -1;
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : byText(va, vb);
    if (c !== 0) return dir === 'desc' ? -c : c;
    return a.id - b.id;
  });
}

// ---- Dashboard statistics ----------------------------------------------
export function computeStats(data) {
  const booksWith = (status) => new Set(data.readings.filter((r) => r.status === status).map((r) => r.bookId)).size;
  const graded = data.readings.filter((r) => r.grade !== null && r.grade !== undefined);
  const years = new Map();
  for (const r of data.readings) {
    if (r.yearRead !== null && r.yearRead !== undefined) years.set(r.yearRead, (years.get(r.yearRead) ?? 0) + 1);
  }
  const perYear = [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year, count }));
  return {
    totalBooks: data.books.length,
    totalAuthors: data.authors.length,
    booksRead: booksWith(STATUS.READ),
    currentlyReading: booksWith(STATUS.READING),
    wantToRead: booksWith(STATUS.WANT_TO_READ),
    paused: booksWith(STATUS.PAUSED),
    abandoned: booksWith(STATUS.ABANDONED),
    averageGrade: graded.length ? graded.reduce((s, r) => s + r.grade, 0) / graded.length : null,
    gradedCount: graded.length,
    firstYear: perYear.length ? perYear[perYear.length - 1].year : null,
    perYear,
    attention: {
      booksNoAuthor: data.books.filter((b) => !b.authorIds.length).length,
      booksNoYear: data.books.filter((b) => b.publicationYear === null || b.publicationYear === undefined).length,
      readNoGrade: data.readings.filter((r) => r.status === STATUS.READ && (r.grade === null || r.grade === undefined)).length,
      authorsNoCountry: data.authors.filter((a) => a.countryId === null || a.countryId === undefined).length,
    },
  };
}
