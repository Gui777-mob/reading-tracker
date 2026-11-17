// Configuration and controlled values (US English).
export const STORAGE_KEY = 'readingTracker.data.v1';
export const SEED_URL = 'data/seed.json';
export const COLLECTIONS = ['countries', 'authors', 'themes', 'books', 'readings'];

export const FORMS = ['Novel', 'Novella', 'Short Story', 'Short Story Collection', 'Play', 'Essay', 'Treatise', 'Diary', 'Graphic Novel'];
export const MODES = ['Prose', 'Drama', 'Poetry', 'Sequential Art'];
export const CONTENTS = ['Fiction', 'Non-fiction'];
export const STATUS = Object.freeze({
  WANT_TO_READ: 'Want to read',
  READING: 'Reading',
  PAUSED: 'Paused',
  READ: 'Read',
  ABANDONED: 'Abandoned',
});
export const STATUSES = Object.values(STATUS);
export const PRIORITIES = ['Low', 'Medium', 'High'];

// Which optional reading fields each status allows.
export const STATUS_RULES = Object.freeze({
  [STATUS.WANT_TO_READ]: { year: false, grade: false, priority: true },
  [STATUS.READING]: { year: false, grade: false, priority: false },
  [STATUS.PAUSED]: { year: false, grade: false, priority: false },
  [STATUS.READ]: { year: true, grade: true, priority: false },
  [STATUS.ABANDONED]: { year: true, grade: true, priority: false },
});

export const GRADE = Object.freeze({ MIN: 0, MAX: 10, STEP: 0.5 });
export const MISSING = '-';
export const ROUTES = ['dashboard', 'books', 'authors', 'reading-log', 'settings'];
export const DEFAULT_ROUTE = 'dashboard';
export const DEFAULT_LOG_SORT = Object.freeze({ key: 'yearRead', dir: 'desc' });
