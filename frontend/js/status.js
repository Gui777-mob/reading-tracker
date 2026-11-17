// Pure status workflow rules (FR-04). No storage, no DOM.
import { STATUS, STATUS_RULES } from './constants.js';

const has = (v) => v !== null && v !== undefined && v !== '';
export const allowedFields = (status) => STATUS_RULES[status] ?? { year: false, grade: false, priority: false };

// Computes the reading after moving to `newStatus`.
// - Priority is cleared whenever the new status is not Want to read.
// - Year read / grade that the new status does not allow are cleared, but only
//   after the user confirms (needsConfirmation). Recommended by and notes stay.
export function applyStatusChange(reading, newStatus) {
  const rules = allowedFields(newStatus);
  const next = { ...reading, status: newStatus };
  const clearedFields = [];
  if (!rules.year && has(reading.yearRead)) { next.yearRead = null; clearedFields.push('yearRead'); }
  if (!rules.grade && has(reading.grade)) { next.grade = null; clearedFields.push('grade'); }
  if (!rules.priority) next.priority = null;
  return {
    reading: next,
    needsConfirmation: clearedFields.length > 0,
    clearedFields,
    requiresYear: newStatus === STATUS.READ && !has(next.yearRead),
  };
}
