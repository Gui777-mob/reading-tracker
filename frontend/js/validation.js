// Every business rule is checked here. Functions return [{ field, message }].
import { FORMS, MODES, CONTENTS, STATUSES, STATUS_RULES, PRIORITIES, GRADE } from './constants.js';
import { T } from './strings.js';
import { badRequest } from './errors.js';
import { formatYear } from './utils.js';

const V = T.validation;
export const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const pad = (n) => String(n).padStart(2, '0');
export const todayISO = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const currentYear = (now = new Date()) => now.getFullYear();

function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function assertValid(errors) {
  if (errors.length) throw badRequest(errors);
}

export function validateAuthor(author, { authors = [], countries = [], today = todayISO() } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const name = (author.name ?? '').trim();
  if (!name) add('name', V.author.nameRequired);
  else if (authors.some((a) => a.id !== author.id && a.name.trim().toLowerCase() === name.toLowerCase())) {
    add('name', V.author.nameDuplicate(name));
  }
  if (!isBlank(author.countryId) && !countries.some((c) => c.id === author.countryId)) add('countryId', V.author.countryInvalid);

  const birthReal = !isBlank(author.birthDate) && isRealDate(author.birthDate);
  const deathReal = !isBlank(author.deathDate) && isRealDate(author.deathDate);
  if (!isBlank(author.birthDate)) {
    if (!birthReal) add('birthDate', V.date.invalid);
    else if (author.birthDate > today) add('birthDate', V.author.birthFuture);
  }
  if (!isBlank(author.deathDate)) {
    if (!deathReal) add('deathDate', V.date.invalid);
    else if (birthReal && author.deathDate <= author.birthDate) add('deathDate', V.author.deathBeforeBirth);
  }
  return errors;
}

export function validateThemeName(name, themes = [], pendingNames = [], field = 'themes') {
  const n = (name ?? '').trim();
  if (!n) return [{ field, message: V.theme.required }];
  const lower = n.toLowerCase();
  const taken = themes.some((t) => t.name.trim().toLowerCase() === lower) || pendingNames.some((p) => p.trim().toLowerCase() === lower);
  return taken ? [{ field, message: V.theme.duplicate(n) }] : [];
}

export function validateBook(book, { authors = [], themes = [], readings = [], year = currentYear() } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (isBlank(book.title)) add('title', V.book.titleRequired);
  if ((book.authorIds ?? []).some((id) => !authors.some((a) => a.id === id))) add('authorIds', V.book.authorUnknown);

  const py = book.publicationYear;
  if (!isBlank(py)) {
    if (!Number.isInteger(py)) add('publicationYear', V.book.yearInteger);
    else if (py === 0) add('publicationYear', V.book.yearZero);
    else if (py > year) add('publicationYear', V.book.yearFuture(year));
    else {
      const years = readings.filter((r) => r.bookId === book.id && Number.isInteger(r.yearRead) && r.yearRead < py).map((r) => r.yearRead);
      if (years.length) add('publicationYear', V.book.yearAfterReading(Math.min(...years)));
    }
  }
  if (!isBlank(book.form) && !FORMS.includes(book.form)) add('form', V.book.formInvalid);
  if (!isBlank(book.mode) && !MODES.includes(book.mode)) add('mode', V.book.modeInvalid);
  if (!isBlank(book.content) && !CONTENTS.includes(book.content)) add('content', V.book.contentInvalid);
  if ((book.themeIds ?? []).some((id) => !themes.some((t) => t.id === id))) add('themes', V.book.themeUnknown);
  return errors;
}

// `book` is the book object the reading belongs to (only publicationYear is needed).
export function validateReading(reading, { book, year = currentYear() } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!book) add('bookId', T.validation.reading.bookRequired);

  const status = reading.status;
  if (isBlank(status)) { add('status', V.reading.statusRequired); return errors; }
  if (!STATUSES.includes(status)) { add('status', V.reading.statusInvalid); return errors; }
  const rules = STATUS_RULES[status];

  const y = reading.yearRead;
  if (!isBlank(y)) {
    if (!rules.year) add('yearRead', V.reading.yearNotAllowed(status));
    else if (!Number.isInteger(y)) add('yearRead', V.reading.yearInteger);
    else if (y > year) add('yearRead', V.reading.yearFuture(year));
    else if (book && Number.isInteger(book.publicationYear) && y < book.publicationYear) {
      add('yearRead', V.reading.yearBeforePublication(formatYear(book.publicationYear)));
    }
  } else if (status === 'Read') add('yearRead', V.reading.yearRequired);

  const g = reading.grade;
  if (!isBlank(g)) {
    if (!rules.grade) add('grade', V.reading.gradeNotAllowed(status));
    else if (typeof g !== 'number' || Number.isNaN(g)) add('grade', V.reading.gradeInvalid);
    else if (g < GRADE.MIN || g > GRADE.MAX) add('grade', V.reading.gradeRange);
    else if (!Number.isInteger(g / GRADE.STEP)) add('grade', V.reading.gradeStep);
  }

  if (!isBlank(reading.priority)) {
    if (!rules.priority) add('priority', V.reading.priorityNotAllowed(status));
    else if (!PRIORITIES.includes(reading.priority)) add('priority', V.reading.priorityInvalid);
  }
  return errors;
}
