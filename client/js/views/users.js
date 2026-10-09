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

/** F3: células que este usuario puede asignar al invitar (`cells.manage`: todas; lead: las suyas). */
const manageable = () => (has('cells.manage') ? S.cellList : S.cellList.filter(c => c.leadUserId === S.session.user.id || (c.memberIds || []).includes(S.session.user.id)));
const fmtDate = s => (s ? new Date(s).toLocaleDateString() : '—');
const roleOpt = (r, cur) => `<option value="${r}" ${r === cur ? 'selected' : ''}>${esc(roleLabel(r))} · nivel ${levelOf(r)}</option>`;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch { window.prompt('Copia el enlace de invitación:', text); }
}

/** Pestaña Usuarios de #/admin: invitar + pendientes. Nivel ≥4: enlace a Organización (plantilla completa). */
export async function renderUsersTab(body) {
  body.innerHTML = `${has('users.read') ? '<p class="hint">La plantilla completa (roles, correos, células, asignaciones, contraseñas) y los datos de la organización están en <a href="#/lobby/org">Lobby → Organización</a>.</p>' : ''}${inviteHTML()}`;
  bindInvite(body);
}

/** Sección «Invitar» + «Invitaciones pendientes» (markup). */
export function inviteHTML() {
  const roles = assignableRoles(S.session.role), mail = !!S.session.mail; // P7
  return `<h3>Invitar</h3><p>${mail ? 'Se envía un correo con el enlace (válido 7 días); también puedes copiarlo.' : 'Se genera un enlace para compartir (válido 7 días).'} Solo puedes invitar roles por debajo del tuyo${has('users.manage') ? ' (o de tu mismo nivel)' : ''}.</p>
    <form id="inviteForm" class="row"><input type="email" name="email" placeholder="correo@ejemplo.com" required class="grow"><select name="role">${roles.map(r => roleOpt(r, roles[roles.length - 1])).join('')}</select><button class="btn primary" type="submit">Invitar</button></form>
    ${manageable().length ? `<div class="chips-select" id="inviteCells">${manageable().map(c => `<span class="chip tag-${esc(c.color)}" data-id="${c.id}">${esc(c.name)}</span>`).join('')}<span class="hint">Células del invitado</span></div>` : ''}
    <div id="inviteResult"></div>
    <h3>Invitaciones pendientes</h3><div id="inviteRows"><div class="empty">Cargando…</div></div>`;
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
      $('#inviteResult', body).innerHTML = `<div class="invite-link"><input type="text" value="${esc(inv.link)}" disabled><button class="btn" type="button">Copiar</button></div><p class="hint">${inv.emailSent ? `Correo enviado a ${esc(inv.email)} (${esc(roleLabel(inv.role))}). Si no le llega, cópiale el enlace.` : `Enlace para ${esc(inv.email)} (${esc(roleLabel(inv.role))}). ${inv.mailError ? 'El correo falló (' + esc(inv.mailError) + '): ' : 'No se envía correo: '}cópialo y compártelo.`}</p>`;
      $('#inviteResult .btn', body).addEventListener('click', () => copyText(inv.link));
      if (!inv.emailSent) copyText(inv.link); else toast('Invitación enviada por correo');
      renderInvites(body);
    } catch (err) { toast('No se pudo invitar: ' + err.message, 'error', 6000); }
  });
  renderInvites(body);
}

async function renderInvites(body) {
  const box = $('#inviteRows', body); if (!box) return;
  let invites = [];
  try { invites = await api.listInvites(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = invites.length ? '' : '<div class="empty">Sin invitaciones pendientes.</div>';
  for (const inv of invites) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow">${esc(inv.email)}</span><span class="chip tag-gray">${esc(roleLabel(inv.role))}</span><span class="chip ${inv.emailSentAt ? 'tag-green' : 'tag-yellow'}" title="${inv.emailSentAt ? 'Correo enviado el ' + esc(fmtDate(inv.emailSentAt)) : 'Enlace copiado a mano'}">${inv.emailSentAt ? 'enviada' : 'pendiente'}</span><span class="count">caduca ${fmtDate(inv.expiresAt)}</span><button class="btn danger">Revocar</button>`;
    row.querySelector('.btn').addEventListener('click', async () => {
      try { await api.revokeInvite(inv.id); toast('Invitación revocada'); renderInvites(body); } catch (err) { toast(err.message, 'error'); }
    });
    box.appendChild(row);
  }
}

/** P10: plantilla (Lobby → Organización). `box` = contenedor de filas. */
export async function renderStaff(box) {
  let users = [];
  try { users = await api.listUsers(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = users.length ? '' : '<div class="empty">Sin usuarios.</div>';
  const mine = assignableRoles(S.session.role);
  for (const u of users) box.appendChild(staffRow(u, mine, box));
}
function staffRow(u, mine, box) {
  const self = u.id === S.session.user.id, canTouch = has('users.manage') && !self && levelOf(u.role) <= myLevel();
  const roles = mine.includes(u.role) ? mine : [u.role, ...mine];
  const cells = (u.cellIds || []).map(cellById).filter(Boolean).map(c => `<span class="chip tag-${esc(c.color)}">${esc(c.name)}</span>`).join('');
  const asg = u.assignments || [];
  const row = document.createElement('div'); row.className = 'staff-row' + (u.isActive ? '' : ' inactive');
  row.innerHTML = `<div class="row"><span class="grow"><b>${esc(u.name || u.email)}</b>${self ? ' (tú)' : ''}<br><span class="count">${esc(u.email)} · ${u.isActive ? 'último acceso ' + fmtDate(u.lastLoginAt) : 'desactivado'}</span></span>
      <select aria-label="Rol" ${canTouch && u.isActive ? '' : 'disabled'}>${roles.map(r => roleOpt(r, u.role)).join('')}</select>
      ${canTouch && u.isActive ? '<button class="icon-btn" data-reset title="Restablecer contraseña" aria-label="Restablecer contraseña">🔑</button>' : ''}
      ${canTouch ? `<button class="btn ${u.isActive ? 'danger' : ''}" data-active>${u.isActive ? 'Desactivar' : 'Activar'}</button>` : ''}</div>
    <div class="staff-meta"><span class="count">Células:</span> ${cells || '<span class="count">—</span>'} <span class="count">· Asignaciones:</span> ${asg.length ? `<button class="btn ghost" data-asg>${asg.length} card${asg.length === 1 ? '' : 's'}</button>` : '<span class="count">ninguna</span>'}</div>
    ${asg.length ? `<ul class="me-list" hidden>${asg.map(a => `<li><a href="#/p/${encodeURIComponent(a.pageId)}/n/${encodeURIComponent(a.nodeId)}"><span class="type-badge">${esc(TYPE_META[a.type]?.label || a.type)}</span><b>${esc(a.name)}</b><span class="url">${esc(a.pageName)}</span><span class="chip tag-gray">${a.kind === 'owner' ? 'responsable' : 'asignado'}</span></a></li>`).join('')}</ul>` : ''}`;
  row.querySelector('select').addEventListener('change', async e => {
    try { await api.updateUser(u.id, { role: e.target.value }); toast(`Rol de ${u.email}: ${roleLabel(e.target.value)}`); } catch (err) { toast(err.message, 'error', 5000); }
    renderStaff(box);
  });
  row.querySelector('[data-asg]')?.addEventListener('click', () => { const l = row.querySelector('.me-list'); l.hidden = !l.hidden; });
  row.querySelector('[data-reset]')?.addEventListener('click', async () => { // P3: contraseña temporal, visible una sola vez
    const ok = await confirmBox({ title: 'Restablecer contraseña', message: `Se fijará una contraseña temporal para ${u.email} y se cerrarán sus sesiones. Deberás pasársela por un canal seguro.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Restablecer', value: 'ok', kind: 'primary' }] });
    if (!ok) return;
    const pw = tempPassword();
    try { await api.updateUser(u.id, { password: pw }); } catch (err) { toast(err.message, 'error', 5000); return; }
    await secretBox({ title: 'Contraseña temporal', message: `Nueva contraseña de ${u.email}. Se muestra una sola vez: cópiala y compártela; la persona podrá cambiarla desde su chip de usuario.`, secret: pw });
  });
  row.querySelector('[data-active]')?.addEventListener('click', async () => {
    if (u.isActive) { const ok = await confirmBox({ title: 'Desactivar usuario', message: `${u.email} perderá el acceso y sus sesiones se cerrarán.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Desactivar', value: 'ok', kind: 'danger' }] }); if (!ok) return; }
    try { await api.updateUser(u.id, { isActive: !u.isActive }); renderStaff(box); } catch (err) { toast(err.message, 'error', 5000); }
  });
  return row;
}
