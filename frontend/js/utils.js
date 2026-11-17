import { MISSING } from './constants.js';

export const toText = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
export const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? v : n; // keep invalid input so validation can report it
};
export const normalizeSearch = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso) {
  if (!iso) return MISSING;
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
export const formatYear = (y) => (y === null || y === undefined ? MISSING : y < 0 ? `${Math.abs(y)} BC` : String(y));
export const formatGrade = (g) => (g === null || g === undefined ? MISSING : Number(g).toFixed(1));
export const statusSlug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');
export const byText = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
