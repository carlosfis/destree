/* =========================================================
   P3. Mi cuenta: nombre y cambio de contraseña propio (diálogo desde el chip de usuario)
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmDialog } from '../ui/dialogs.js';
import { ROLE_LABEL } from './auth-views.js';

const field = (name, label, type, extra = '') => `<div class="field"><label for="acc_${name}">${label}</label><input id="acc_${name}" name="${name}" type="${type}" ${extra}></div>`;

/** Abre el diálogo «Mi cuenta». Resuelve al cerrarse. */
export function openAccountDialog() {
  if (!S.session) return Promise.resolve();
  const u = S.session.user;
  return new Promise(resolve => {
    confirmDialog.innerHTML = `<div class="dialog-inner account-dialog"><header><h2>Mi cuenta</h2><button type="button" class="icon-btn" data-cancel aria-label="Cerrar">✕</button></header>
      <div class="dialog-body">
        <p class="hint">${esc(u.email)} · ${esc(ROLE_LABEL[S.session.role] || S.session.role)}</p>
        <form id="accName" class="account-form">
          ${field('name', 'Nombre', 'text', `value="${esc(u.name || '')}" required maxlength="120" autocomplete="name"`)}
          <div class="form-error"></div>
          <div class="inline-actions"><button class="btn" type="submit">Guardar nombre</button></div>
        </form>
        <h3>Cambiar contraseña</h3>
        <form id="accPassword" class="account-form">
          ${field('currentPassword', 'Contraseña actual', 'password', 'required autocomplete="current-password"')}
          ${field('newPassword', 'Nueva contraseña (mín. 8)', 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}
          ${field('repeatPassword', 'Repite la nueva contraseña', 'password', 'required minlength="8" maxlength="200" autocomplete="new-password"')}
          <p class="hint">Al cambiarla se cierran tus demás sesiones (otros navegadores o dispositivos).</p>
          <div class="form-error"></div>
          <div class="inline-actions"><button class="btn primary" type="submit">Cambiar contraseña</button></div>
        </form>
      </div>
      <footer><button type="button" class="btn" data-cancel>Cerrar</button></footer></div>`;
    const done = () => { confirmDialog.close(); resolve(); };
    confirmDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', done));
    confirmDialog.oncancel = ev => { ev.preventDefault(); done(); };
    bindForm($('#accName', confirmDialog), async d => {
      const r = await api.patchMe({ name: d.name.trim() });
      S.session.user.name = r.user.name; document.dispatchEvent(new CustomEvent('destree:account'));
      toast('Nombre actualizado');
    });
    bindForm($('#accPassword', confirmDialog), async (d, f) => {
      if (d.newPassword !== d.repeatPassword) throw new Error('Las contraseñas no coinciden');
      if (d.newPassword === d.currentPassword) throw new Error('La nueva contraseña debe ser distinta de la actual');
      const r = await api.patchMe({ currentPassword: d.currentPassword, newPassword: d.newPassword });
      f.reset();
      toast(r.sessionsClosed ? `Contraseña actualizada; ${r.sessionsClosed} sesión(es) cerrada(s)` : 'Contraseña actualizada');
    });
    confirmDialog.showModal();
    $('#acc_name', confirmDialog).focus();
  });
}

function bindForm(f, submit) {
  const err = $('.form-error', f), btn = $('button[type=submit]', f);
  f.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    try { await submit(Object.fromEntries(new FormData(f)), f); } catch (ex) { err.textContent = ex.message || 'Error'; }
    btn.disabled = false;
  });
}

/** P3 (admin): contraseña temporal aleatoria legible (sin caracteres ambiguos), 14 caracteres. */
export function tempPassword(len = 14) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}
