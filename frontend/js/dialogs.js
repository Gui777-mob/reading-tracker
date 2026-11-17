// Dialogs and toasts (UI only). Uses the native <dialog> element.
import { h, clear } from './dom.js';
import { T } from './strings.js';

const $ = (id) => document.getElementById(id);

export function toast(message, { type = 'success', timeout = 4500 } = {}) {
  const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  $('toast-host').append(el);
  setTimeout(() => el.remove(), timeout);
}

function openSmall(content, { onClose }) {
  const dlg = $('confirm-dialog');
  clear(dlg);
  dlg.append(content);
  dlg.returnValue = '';
  dlg.addEventListener('close', () => onClose(dlg.returnValue), { once: true });
  dlg.showModal();
}

// Resolves to true when the user confirms.
export function confirmDialog({ title, message, details = [], confirmLabel = T.common.confirm, danger = false }) {
  return new Promise((resolve) => {
    const cancel = h('button', { class: 'btn btn-secondary', value: 'cancel', autofocus: danger }, T.common.cancel);
    const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'confirm', autofocus: !danger }, confirmLabel);
    const content = h('form', { method: 'dialog', class: 'dialog-body', 'aria-labelledby': 'confirm-title' },
      h('h2', { id: 'confirm-title' }, title),
      h('p', {}, message),
      details.length ? h('ul', { class: 'detail-list' }, details.map((d) => h('li', {}, d))) : null,
      h('div', { class: 'dialog-actions' }, cancel, ok));
    openSmall(content, { onClose: (v) => resolve(v === 'confirm') });
  });
}

export function noticeDialog({ title, message, items = [] }) {
  return new Promise((resolve) => {
    const content = h('form', { method: 'dialog', class: 'dialog-body', 'aria-labelledby': 'confirm-title' },
      h('h2', { id: 'confirm-title' }, title),
      h('p', {}, message),
      items.length ? h('ul', { class: 'detail-list' }, items.map((d) => h('li', {}, d))) : null,
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', value: 'close', autofocus: true }, T.common.close)));
    openSmall(content, { onClose: () => resolve() });
  });
}

export function showFormDialog(content) {
  const dlg = $('form-dialog');
  clear(dlg);
  dlg.append(content);
  if (!dlg.open) dlg.showModal();
}
export function closeFormDialog() {
  const dlg = $('form-dialog');
  if (dlg.open) dlg.close();
}
