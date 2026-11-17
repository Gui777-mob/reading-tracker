import * as store from './store.js';
import { validateAuthor, assertValid } from './validation.js';
import { toText, toNumberOrNull, normalizeSearch, byText } from './utils.js';
import { conflict, notFound } from './errors.js';
import { T } from './strings.js';

export function normalizeAuthor(raw) {
  return {
    id: raw.id ?? null,
    name: (raw.name ?? '').trim(),
    countryId: toNumberOrNull(raw.countryId),
    birthDate: toText(raw.birthDate),
    deathDate: toText(raw.deathDate),
  };
}

export async function saveAuthor(raw) {
  const author = normalizeAuthor(raw);
  const [authors, countries] = await Promise.all([store.getAuthors(), store.getCountries()]);
  assertValid(validateAuthor(author, { authors, countries }));
  return store.saveAuthor(author);
}

export const findLinkedBooks = (authorId, books) => books.filter((b) => b.authorIds.includes(authorId));

export async function deleteAuthor(id) {
  const [authors, books] = await Promise.all([store.getAuthors(), store.getBooks()]);
  const author = authors.find((a) => a.id === id);
  if (!author) throw notFound(T.errors.notFound('Author', id));
  const linked = findLinkedBooks(id, books);
  if (linked.length) {
    const message = T.errors.authorLinked(author.name, linked.map((b) => b.title));
    throw conflict(message, [{ field: 'id', message }]);
  }
  return store.deleteAuthor(id);
}

export function buildAuthorRows(data, query = '') {
  const countries = new Map(data.countries.map((c) => [c.id, c.name]));
  const q = normalizeSearch(query);
  return data.authors
    .filter((a) => !q || normalizeSearch(a.name).includes(q))
    .map((a) => ({
      id: a.id,
      name: a.name,
      country: a.countryId == null ? null : countries.get(a.countryId) ?? null,
      birthDate: a.birthDate,
      deathDate: a.deathDate,
      bookCount: data.books.filter((b) => b.authorIds.includes(a.id)).length,
    }))
    .sort((a, b) => byText(a.name, b.name));
}
