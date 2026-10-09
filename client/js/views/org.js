/* =========================================================
   P10. Lobby → Organización (nivel ≥4): datos de la organización, niveles y roles (etiquetas + tabla de capacidades),
   correo, plantilla, invitaciones y zona de peligro (eliminar organización; solo Admin).
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmDialog } from '../ui/dialogs.js';
import { roleLabel, has } from '../core/roles.js';
import { ROLES, ROLE_LEVEL, ROLE_DEFAULT_LABEL, FIXED_LABEL_ROLES, CAPABILITIES, GROUPS, LABEL_MAX, can } from '../core/permissions.js';
import { inviteHTML, bindInvite, renderStaff } from './users.js';
import { refreshCells } from './cells.js';

const lev = r => `Lev${ROLE_LEVEL[r]}`;
const capsTable = () => `<table class="caps-table"><thead><tr><th>Capacidad</th>${ROLES.map(r => `<th><span class="lvl">${lev(r)}</span>${esc(roleLabel(r))}</th>`).join('')}</tr></thead><tbody>
  ${GROUPS.map(g => `<tr class="group"><th colspan="${ROLES.length + 1}">${esc(g)}</th></tr>` + CAPABILITIES.filter(c => c.group === g).map(c => `<tr><td>${esc(c.label)}</td>${ROLES.map(r => `<td class="${can({ role: r }, c.action) ? 'yes' : 'no'}">${can({ role: r }, c.action) ? '✓' : '—'}</td>`).join('')}</tr>`).join('')).join('')}
</tbody></table>`;

export async function renderOrgTab(body) {
  const admin = has('org.settings'), mail = !!S.session.mail;
  body.innerHTML = `<section class="org-section"><h3>Organización</h3>
      <form id="orgForm" class="row"><label class="count" for="orgName">Nombre</label><input id="orgName" name="name" class="grow" maxlength="120" required value="${esc(S.session.org?.name || '')}" ${admin ? '' : 'disabled'}>${admin ? '<button class="btn primary" type="submit">Guardar</button>' : ''}</form>
      ${admin ? '' : `<p class="hint">Solo ${esc(roleLabel('admin'))} (Lev5) modifica o elimina la organización.</p>`}</section>
    <section class="org-section"><h3>Niveles y roles</h3>
      <p class="hint">Cinco niveles fijos: cada nivel incluye todo lo del inferior. El código no cambia; el nombre visible sí (salvo ${esc(roleLabel('admin'))}).</p>
      <form id="rolesForm"><table class="roles-table"><thead><tr><th>Nivel</th><th>Código</th><th>Nombre visible</th><th>Resumen</th></tr></thead><tbody>
        ${ROLES.map(r => `<tr><td><b>${lev(r)}</b></td><td><code>${r}</code></td><td>${FIXED_LABEL_ROLES.includes(r) || !admin ? `<b>${esc(roleLabel(r))}</b>${FIXED_LABEL_ROLES.includes(r) ? ' <span class="count">(fijo)</span>' : ''}` : `<input name="${r}" maxlength="${LABEL_MAX}" value="${esc(roleLabel(r))}" placeholder="${ROLE_DEFAULT_LABEL[r]}" aria-label="Nombre visible de ${lev(r)}">`}</td><td class="count">${esc(SUMMARY[r])}</td></tr>`).join('')}
      </tbody></table>${admin ? '<div class="inline-actions"><button class="btn primary" type="submit">Guardar nombres</button><button class="btn" type="button" id="rolesReset">Restablecer nombres</button></div>' : ''}</form>
      <h4>Capacidades por rol</h4>${capsTable()}</section>
    ${has('users.manage') ? `<section class="org-section"><h3>Correo</h3><p class="mail-status">${mail ? 'SMTP configurado: las invitaciones y la recuperación de contraseña se envían por correo.' : 'Sin SMTP: las invitaciones se comparten copiando el enlace y no hay recuperación de contraseña por correo. Configura <code>SMTP_URL</code> y <code>MAIL_FROM</code> en <code>.env</code>.'}${mail && admin ? ' <button class="btn" type="button" id="mailTest">Probar envío</button>' : ''}</p></section>` : ''}
    <section class="org-section"><h3>Plantilla</h3><p class="hint">Rol, células y cards asignadas de cada persona. Solo puedes cambiar cuentas de tu nivel o inferior${has('users.manage') ? '' : ' (tu nivel no gestiona usuarios)'}.</p><div id="staffRows"><div class="empty">Cargando…</div></div></section>
    <section class="org-section">${inviteHTML()}</section>
    ${has('org.delete') ? '<section class="org-section danger"><h3>Zona de peligro</h3><p>Eliminar la organización borra páginas, versiones, células, usuarios, invitaciones, imágenes y el audit log, y vuelve al asistente inicial. Los respaldos en disco se conservan.</p><div class="inline-actions"><button class="btn danger" type="button" id="orgDelete">Eliminar organización…</button></div></section>' : ''}`;
  const saveOrg = async (body2, msg) => {
    try { const org = await api.patchOrg(body2); S.session.org = org; document.dispatchEvent(new CustomEvent('destree:account')); toast(msg); renderOrgTab(body); $('.lobby-head .brand b')?.replaceChildren(org.name); } catch (err) { toast(err.message, 'error', 6000); }
  };
  $('#orgForm', body).addEventListener('submit', e => { e.preventDefault(); saveOrg({ name: e.currentTarget.name.value.trim() }, 'Organización guardada'); });
  $('#rolesForm', body).addEventListener('submit', e => { e.preventDefault(); const f = e.currentTarget; saveOrg({ roleLabels: Object.fromEntries(ROLES.filter(r => f[r]).map(r => [r, f[r].value.trim()])) }, 'Nombres de rol guardados'); });
  $('#rolesReset', body)?.addEventListener('click', () => saveOrg({ roleLabels: {} }, 'Nombres por defecto'));
  $('#mailTest', body)?.addEventListener('click', async e => { // P7
    e.currentTarget.disabled = true;
    try { const r = await api.mailTest(); toast(`Correo de prueba enviado a ${r.to}`); } catch (err) { toast(err.message, 'error', 8000); }
    e.currentTarget.disabled = false;
  });
  $('#orgDelete', body)?.addEventListener('click', deleteOrgDialog);
  bindInvite(body);
  await refreshCells(); // nombres de células al día para la plantilla
  renderStaff($('#staffRows', body));
}
const SUMMARY = {
  admin: 'Todo, incluido modificar y eliminar la organización.',
  ops: 'Todo lo operativo: páginas, plantilla, roles, respaldos, audit; no toca la organización ni a los Admin.',
  head: 'Ve todo; invita, asigna, gestiona células y la visibilidad de páginas y raíces; edita el interior; no crea ni borra páginas.',
  lead: 'Solo ve sus páginas (sus células o asignadas); edita su interior, asigna e invita Viewers a sus células.',
  viewer: 'Solo ve sus páginas y edita las cards donde es responsable o está asignado.',
};

/** Diálogo de borrado: nombre exacto + contraseña → DELETE /api/org → vuelve al asistente. */
function deleteOrgDialog() {
  const name = S.session.org?.name || '';
  confirmDialog.innerHTML = `<div class="dialog-inner account-dialog"><header><h2>Eliminar organización</h2><button type="button" class="icon-btn" data-cancel aria-label="Cerrar">✕</button></header>
    <form id="orgDeleteForm" class="dialog-body account-form">
      <p>Se borrará <b>todo</b> el contenido de <b>${esc(name)}</b> y la instalación volverá al asistente inicial. Esta acción no se puede deshacer (los respaldos en disco se conservan).</p>
      <div class="field"><label for="od_name">Escribe el nombre de la organización</label><input id="od_name" name="confirmName" required autocomplete="off" placeholder="${esc(name)}"></div>
      <div class="field"><label for="od_pw">Tu contraseña</label><input id="od_pw" name="password" type="password" required autocomplete="current-password"></div>
      <div class="form-error"></div>
      <div class="inline-actions"><button class="btn danger" type="submit">Eliminar definitivamente</button><button class="btn" type="button" data-cancel>Cancelar</button></div>
    </form></div>`;
  confirmDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => confirmDialog.close()));
  confirmDialog.oncancel = ev => { ev.preventDefault(); confirmDialog.close(); };
  const f = $('#orgDeleteForm', confirmDialog), err = $('.form-error', f);
  f.addEventListener('submit', async e => {
    e.preventDefault(); err.textContent = '';
    const d = Object.fromEntries(new FormData(f));
    if (d.confirmName.trim() !== name) { err.textContent = 'El nombre no coincide.'; return; }
    f.querySelector('button[type=submit]').disabled = true;
    try { await api.deleteOrg({ password: d.password, confirmName: d.confirmName.trim() }); confirmDialog.close(); toast('Organización eliminada'); location.hash = ''; setTimeout(() => location.reload(), 300); }
    catch (ex) { err.textContent = ex.message || 'Error'; f.querySelector('button[type=submit]').disabled = false; }
  });
  confirmDialog.showModal();
  $('#od_name', confirmDialog).focus();
}
