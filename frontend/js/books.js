import * as store from './store.js';
import { validateBook, validateReading, validateThemeName, assertValid } from './validation.js';
import { normalizeReading } from './readings.js';
import { toText, toNumberOrNull, normalizeSearch, byText } from './utils.js';

export function normalizeBook(raw) {
  return {
    id: raw.id ?? null,
    title: (raw.title ?? '').trim(),
    authorIds: [...new Set(raw.authorIds ?? [])],
    publicationYear: toNumberOrNull(raw.publicationYear),
    form: toText(raw.form),
    mode: toText(raw.mode),
    content: toText(raw.content),
    themeIds: [...new Set(raw.themeIds ?? [])],
  };
}

// Saves a book, creates any new themes typed in the form and, for new books,
// an optional first reading. Everything is validated before anything is saved;
// if a later step still fails, earlier steps are rolled back.
export async function saveBook(rawBook, { newThemeNames = [], firstReading = null } = {}) {
  const book = normalizeBook(rawBook);
  const isNew = book.id === null;
  const [authors, themes, readings] = await Promise.all([store.getAuthors(), store.getThemes(), store.getReadings()]);

  const names = newThemeNames.map((n) => n.trim()).filter(Boolean);
  const errors = validateBook(book, { authors, themes, readings });
  names.forEach((n, i) => errors.push(...validateThemeName(n, themes, names.slice(0, i))));

  let reading = null;
  if (firstReading && isNew) {
    reading = normalizeReading({ ...firstReading, bookId: null });
    const readingErrors = validateReading(reading, { book: { publicationYear: book.publicationYear } });
    errors.push(...readingErrors.map((e) => ({ ...e, field: `firstReading.${e.field}` })));
  }
  assertValid(errors);

  const created = { themes: [], book: null, reading: null };
  try {
    for (const name of names) {
      const theme = await store.saveTheme({ name });
      created.themes.push(theme);
      book.themeIds.push(theme.id);
    }
    const saved = await store.saveBook(book);
    if (isNew) created.book = saved;
    if (reading) created.reading = await store.saveReading({ ...reading, bookId: saved.id });
    return { book: saved, reading: created.reading, newThemes: created.themes };
  } catch (err) {
    if (created.reading) await store.deleteReading(created.reading.id).catch(() => {});
    if (created.book) await store.deleteBook(created.book.id).catch(() => {});
    for (const t of created.themes) await store.deleteTheme(t.id).catch(() => {});
    throw err;
  }
}

export const deleteBook = (id) => store.deleteBook(id);

export function buildBookRows(data, query = '') {
  const authors = new Map(data.authors.map((a) => [a.id, a.name]));
  const themes = new Map(data.themes.map((t) => [t.id, t.name]));
  const q = normalizeSearch(query);
  return data.books
    .filter((b) => !q || normalizeSearch(b.title).includes(q))
    .map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authorIds.map((id) => authors.get(id)).filter(Boolean),
      publicationYear: b.publicationYear,
      form: b.form,
      mode: b.mode,
      content: b.content,
      themes: b.themeIds.map((id) => themes.get(id)).filter(Boolean),
      readingCount: data.readings.filter((r) => r.bookId === b.id).length,
    }))
    .sort((a, b) => byText(a.title, b.title));
}
