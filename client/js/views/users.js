/* =========================================================
   F2/P10. Invitaciones (pestaña Usuarios de #/admin y Lobby → Organización) y plantilla (solo Organización, nivel ≥4):
   roles por nivel (solo se dan roles asignables), células, asignaciones, 🔑 restablecer contraseña, activar/desactivar.
   ========================================================= */
import { $, esc, TYPE_META } from '../core/utils.js';
import { S, cellById } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox, secretBox } from '../ui/dialogs.js';
import { tempPassword } from './account.js'; // P3
import { roleLabel, has, myLevel } from '../core/roles.js';
import { assignableRoles, levelOf } from '../core/permissions.js';
import { t } from '../core/i18n.js'; // P15

/** F3: células que este usuario puede asignar al invitar (`cells.manage`: todas; lead: las suyas). */
const manageable = () => (has('cells.manage') ? S.cellList : S.cellList.filter(c => c.leadUserId === S.session.user.id || (c.memberIds || []).includes(S.session.user.id)));
const fmtDate = s => (s ? new Date(s).toLocaleDateString() : '—');
const roleOpt = (r, cur) => `<option value="${r}" ${r === cur ? 'selected' : ''}>${esc(roleLabel(r))} · ${t('nivel {n}', { n: levelOf(r) })}</option>`;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('Enlace copiado')); } catch { window.prompt(t('Copia el enlace de invitación:'), text); }
}

/** Pestaña Usuarios de #/admin: invitar + pendientes. Nivel ≥4: enlace a Organización (plantilla completa). */
export async function renderUsersTab(body) {
  body.innerHTML = `${has('users.read') ? `<p class="hint">${t('La plantilla completa (roles, correos, células, asignaciones, contraseñas) y los datos de la organización están en <a href="#/lobby/org">Lobby → Organización</a>.')}</p>` : ''}${inviteHTML()}`;
  bindInvite(body);
}

/** Sección «Invitar» + «Invitaciones pendientes» (markup). */
export function inviteHTML() {
  const roles = assignableRoles(S.session.role), mail = !!S.session.mail; // P7
  return `<h3>${t('Invitar')}</h3><p>${mail ? t('Se envía un correo con el enlace (válido 7 días); también puedes copiarlo.') : t('Se genera un enlace para compartir (válido 7 días).')} ${t('Solo puedes invitar roles por debajo del tuyo{extra}.', { extra: has('users.manage') ? t(' (o de tu mismo nivel)') : '' })}</p>
    <form id="inviteForm" class="row"><input type="email" name="email" placeholder="correo@ejemplo.com" required class="grow"><select name="role">${roles.map(r => roleOpt(r, roles[roles.length - 1])).join('')}</select><button class="btn primary" type="submit">${t('Invitar')}</button></form>
    ${manageable().length ? `<div class="chips-select" id="inviteCells">${manageable().map(c => `<span class="chip tag-${esc(c.color)}" data-id="${c.id}">${esc(c.name)}</span>`).join('')}<span class="hint">${t('Células del invitado')}</span></div>` : ''}
    <div id="inviteResult"></div>
    <h3>${t('Invitaciones pendientes')}</h3><div id="inviteRows"><div class="empty">${t('Cargando…')}</div></div>`;
}
export function bindInvite(body) {
  $('#inviteCells', body)?.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); });
  $('#inviteForm', body)?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, data = Object.fromEntries(new FormData(f));
    const cellIds = [...body.querySelectorAll('#inviteCells .chip.on')].map(c => c.dataset.id);
    try {
      const inv = await api.createInvite({ email: data.email, role: data.role, cellIds });
      f.reset();
      $('#inviteResult', body).innerHTML = `<div class="invite-link"><input type="text" value="${esc(inv.link)}" disabled><button class="btn" type="button">${t('Copiar')}</button></div><p class="hint">${inv.emailSent ? t('Correo enviado a {email} ({role}). Si no le llega, cópiale el enlace.', { email: esc(inv.email), role: esc(roleLabel(inv.role)) }) : t('Enlace para {email} ({role}). {why}cópialo y compártelo.', { email: esc(inv.email), role: esc(roleLabel(inv.role)), why: inv.mailError ? t('El correo falló ({err}): ', { err: esc(inv.mailError) }) : t('No se envía correo: ') })}</p>`;
      $('#inviteResult .btn', body).addEventListener('click', () => copyText(inv.link));
      if (!inv.emailSent) copyText(inv.link); else toast(t('Invitación enviada por correo'));
      renderInvites(body);
    } catch (err) { toast(t('No se pudo invitar: {msg}', { msg: err.message }), 'error', 6000); }
  });
  renderInvites(body);
}

async function renderInvites(body) {
  const box = $('#inviteRows', body); if (!box) return;
  let invites = [];
  try { invites = await api.listInvites(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = invites.length ? '' : `<div class="empty">${t('Sin invitaciones pendientes.')}</div>`;
  for (const inv of invites) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow">${esc(inv.email)}</span><span class="chip tag-gray">${esc(roleLabel(inv.role))}</span><span class="chip ${inv.emailSentAt ? 'tag-green' : 'tag-yellow'}" title="${inv.emailSentAt ? t('Correo enviado el {d}', { d: esc(fmtDate(inv.emailSentAt)) }) : t('Enlace copiado a mano')}">${inv.emailSentAt ? t('enviada') : t('pendiente')}</span><span class="count">${t('caduca {d}', { d: fmtDate(inv.expiresAt) })}</span><button class="btn danger">${t('Revocar')}</button>`;
    row.querySelector('.btn').addEventListener('click', async () => {
      try { await api.revokeInvite(inv.id); toast(t('Invitación revocada')); renderInvites(body); } catch (err) { toast(err.message, 'error'); }
    });
    box.appendChild(row);
  }
}

/** P10: plantilla (Lobby → Organización). `box` = contenedor de filas. */
export async function renderStaff(box) {
  let users = [];
  try { users = await api.listUsers(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = users.length ? '' : `<div class="empty">${t('Sin usuarios.')}</div>`;
  const mine = assignableRoles(S.session.role);
  for (const u of users) box.appendChild(staffRow(u, mine, box));
}
function staffRow(u, mine, box) {
  const self = u.id === S.session.user.id, canTouch = has('users.manage') && !self && levelOf(u.role) <= myLevel();
  const roles = mine.includes(u.role) ? mine : [u.role, ...mine];
  const cells = (u.cellIds || []).map(cellById).filter(Boolean).map(c => `<span class="chip tag-${esc(c.color)}">${esc(c.name)}</span>`).join('');
  const asg = u.assignments || [];
  const row = document.createElement('div'); row.className = 'staff-row' + (u.isActive ? '' : ' inactive');
  row.innerHTML = `<div class="row"><span class="grow"><b>${esc(u.name || u.email)}</b>${self ? ' ' + t('(tú)') : ''}<br><span class="count">${esc(u.email)} · ${u.isActive ? t('último acceso {d}', { d: fmtDate(u.lastLoginAt) }) : t('desactivado')}</span></span>
      <select aria-label="${t('Rol')}" ${canTouch && u.isActive ? '' : 'disabled'}>${roles.map(r => roleOpt(r, u.role)).join('')}</select>
      ${canTouch && u.isActive ? `<button class="icon-btn" data-reset title="${t('Restablecer contraseña')}" aria-label="${t('Restablecer contraseña')}">🔑</button>` : ''}
      ${canTouch ? `<button class="btn ${u.isActive ? 'danger' : ''}" data-active>${u.isActive ? t('Desactivar') : t('Activar')}</button>` : ''}</div>
    <div class="staff-meta"><span class="count">${t('Células:')}</span> ${cells || '<span class="count">—</span>'} <span class="count">${t('· Asignaciones:')}</span> ${asg.length ? `<button class="btn ghost" data-asg>${t(asg.length === 1 ? '{n} card' : '{n} cards', { n: asg.length })}</button>` : `<span class="count">${t('ninguna')}</span>`}</div>
    ${asg.length ? `<ul class="me-list" hidden>${asg.map(a => `<li><a href="#/p/${encodeURIComponent(a.pageId)}/n/${encodeURIComponent(a.nodeId)}"><span class="type-badge">${esc(TYPE_META[a.type]?.label || a.type)}</span><b>${esc(a.name)}</b><span class="url">${esc(a.pageName)}</span><span class="chip tag-gray">${a.kind === 'owner' ? t('responsable') : t('asignado')}</span></a></li>`).join('')}</ul>` : ''}`;
  row.querySelector('select').addEventListener('change', async e => {
    try { await api.updateUser(u.id, { role: e.target.value }); toast(t('Rol de {email}: {role}', { email: u.email, role: roleLabel(e.target.value) })); } catch (err) { toast(err.message, 'error', 5000); }
    renderStaff(box);
  });
  row.querySelector('[data-asg]')?.addEventListener('click', () => { const l = row.querySelector('.me-list'); l.hidden = !l.hidden; });
  row.querySelector('[data-reset]')?.addEventListener('click', async () => { // P3: contraseña temporal, visible una sola vez
    const ok = await confirmBox({ title: t('Restablecer contraseña'), message: t('Se fijará una contraseña temporal para {email} y se cerrarán sus sesiones. Deberás pasársela por un canal seguro.', { email: u.email }), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Restablecer'), value: 'ok', kind: 'primary' }] });
    if (!ok) return;
    const pw = tempPassword();
    try { await api.updateUser(u.id, { password: pw }); } catch (err) { toast(err.message, 'error', 5000); return; }
    await secretBox({ title: t('Contraseña temporal'), message: t('Nueva contraseña de {email}. Se muestra una sola vez: cópiala y compártela; la persona podrá cambiarla desde su chip de usuario.', { email: u.email }), secret: pw });
  });
  row.querySelector('[data-active]')?.addEventListener('click', async () => {
    if (u.isActive) { const ok = await confirmBox({ title: t('Desactivar usuario'), message: t('{email} perderá el acceso y sus sesiones se cerrarán.', { email: u.email }), buttons: [{ label: t('Cancelar'), value: '' }, { label: t('Desactivar'), value: 'ok', kind: 'danger' }] }); if (!ok) return; }
    try { await api.updateUser(u.id, { isActive: !u.isActive }); renderStaff(box); } catch (err) { toast(err.message, 'error', 5000); }
  });
  return row;
}
