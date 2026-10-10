/* =========================================================
   13. Diálogos genéricos (confirmar / pedir texto / mostrar un secreto una vez)
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { t } from '../core/i18n.js'; // P15
export const confirmDialog = $('#confirmDialog');
export function confirmBox({ title, message, buttons }) {
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<div class="dialog-inner"><header><h2>${esc(title)}</h2><button class="icon-btn" data-v="" aria-label="${t('Cerrar')}">✕</button></header>
      <div class="dialog-body"><div class="confirm-msg">${esc(message)}</div></div>
      <footer>${buttons.map(b => `<button class="btn ${b.kind || ''}" data-v="${esc(b.value ?? '')}">${esc(b.label)}</button>`).join('')}</footer></div>`;
    const done = v => { confirmDialog.close(); resolve(v || null); };
    confirmDialog.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => done(b.dataset.v)));
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(null); };
    confirmDialog.showModal();
    const primary = confirmDialog.querySelector('footer .btn.primary, footer .btn.danger'); if (primary) primary.focus();
  });
}
export function promptBox({ title, label, value = '', okLabel = t('Guardar') }) {
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<form class="dialog-inner"><header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-cancel aria-label="${t('Cerrar')}">✕</button></header>
      <div class="dialog-body"><div class="field"><label>${esc(label)}</label><input name="v" value="${esc(value)}" autocomplete="off"></div></div>
      <footer><button type="button" class="btn" data-cancel>${t('Cancelar')}</button><button type="submit" class="btn primary">${esc(okLabel)}</button></footer></form>`;
    const form = confirmDialog.querySelector('form');
    const done = v => { confirmDialog.close(); resolve(v); };
    form.addEventListener('submit', ev => { ev.preventDefault(); done(form.v.value.trim()); });
    confirmDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => done(null)));
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(null); };
    confirmDialog.showModal();
    form.v.focus(); form.v.select();
  });
}

/** P3: muestra un valor sensible (p. ej. contraseña temporal) una sola vez, con botón Copiar. Resuelve al cerrar. */
export function secretBox({ title, message, secret, okLabel = t('Listo') }) {
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<div class="dialog-inner"><header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="${t('Cerrar')}">✕</button></header>
      <div class="dialog-body"><div class="confirm-msg">${esc(message)}</div><div class="invite-link"><input type="text" value="${esc(secret)}" disabled aria-label="${t('Valor')}"><button class="btn" type="button" data-copy>${t('Copiar')}</button></div></div>
      <footer><button class="btn primary" data-close>${esc(okLabel)}</button></footer></div>`;
    const done = () => { confirmDialog.close(); resolve(); };
    confirmDialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', done));
    confirmDialog.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(secret); confirmDialog.querySelector('[data-copy]').textContent = t('Copiado'); } catch { window.prompt(t('Copia el valor:'), secret); } });
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(); };
    confirmDialog.showModal();
    confirmDialog.querySelector('[data-copy]').focus();
  });
}
