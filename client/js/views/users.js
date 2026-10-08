/* =========================================================
   F2. Pestaña Usuarios del panel admin: invitaciones (enlace copiable) y usuarios/roles
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox, secretBox } from '../ui/dialogs.js';
import { tempPassword } from './account.js'; // P3
import { ROLE_LABEL } from './auth-views.js';

const has = p => !!S.session && S.session.permissions.includes(p);
/** F3: células que este usuario puede asignar al invitar (admin: todas; head: las suyas). */
const manageable = () => S.session.role === 'admin' ? S.cellList : S.cellList.filter(c => c.leadUserId === S.session.user.id || (c.memberIds || []).includes(S.session.user.id));
const fmtDate = s => s ? new Date(s).toLocaleDateString() : '—';
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch { window.prompt('Copia el enlace de invitación:', text); }
}

export async function renderUsersTab(body) {
  const roles = S.session.role === 'admin' ? ['designer', 'head', 'admin'] : ['designer'];
  const mail = !!S.session.mail; // P7
  body.innerHTML = `${has('users.manage') ? `<h3>Correo</h3><p class="mail-status">${mail ? 'SMTP configurado: las invitaciones y la recuperación de contraseña se envían por correo.' : 'Sin SMTP: las invitaciones se comparten copiando el enlace y no hay recuperación de contraseña por correo. Configura <code>SMTP_URL</code> y <code>MAIL_FROM</code> en <code>.env</code>.'}${mail ? ' <button class="btn" type="button" id="mailTest">Probar envío</button>' : ''}</p>` : ''}
    <h3>Invitar</h3><p>${mail ? 'Se envía un correo con el enlace (válido 7 días); también puedes copiarlo.' : 'Se genera un enlace para compartir (válido 7 días).'} ${S.session.role === 'head' ? 'Como head solo puedes invitar designers.' : ''}</p>
    <form id="inviteForm" class="row"><input type="email" name="email" placeholder="correo@ejemplo.com" required class="grow"><select name="role">${roles.map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}</select><button class="btn primary" type="submit">Invitar</button></form>
    ${manageable().length ? `<div class="chips-select" id="inviteCells">${manageable().map(c => `<span class="chip tag-${esc(c.color)}" data-id="${c.id}">${esc(c.name)}</span>`).join('')}<span class="hint">Células del invitado</span></div>` : ''}
    <div id="inviteResult"></div>
    <h3>Invitaciones pendientes</h3><div id="inviteRows"><div class="empty">Cargando…</div></div>
    ${has('users.manage') ? '<h3>Usuarios</h3><div id="userRows"><div class="empty">Cargando…</div></div>' : ''}`;
  $('#inviteCells', body)?.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); });
  $('#inviteForm', body).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, data = Object.fromEntries(new FormData(f));
    const cellIds = [...body.querySelectorAll('#inviteCells .chip.on')].map(c => c.dataset.id);
    try {
      const inv = await api.createInvite({ email: data.email, role: data.role, cellIds });
      f.reset();
      $('#inviteResult', body).innerHTML = `<div class="invite-link"><input type="text" value="${esc(inv.link)}" disabled><button class="btn" type="button">Copiar</button></div><p class="hint">${inv.emailSent ? `Correo enviado a ${esc(inv.email)} (${esc(ROLE_LABEL[inv.role])}). Si no le llega, cópiale el enlace.` : `Enlace para ${esc(inv.email)} (${esc(ROLE_LABEL[inv.role])}). ${inv.mailError ? 'El correo falló (' + esc(inv.mailError) + '): ' : 'No se envía correo: '}cópialo y compártelo.`}</p>`;
      $('#inviteResult .btn', body).addEventListener('click', () => copyText(inv.link));
      if (!inv.emailSent) copyText(inv.link); else toast('Invitación enviada por correo');
      renderInvites(body);
    } catch (err) { toast('No se pudo invitar: ' + err.message, 'error', 6000); }
  });
  $('#mailTest', body)?.addEventListener('click', async e => { // P7
    e.currentTarget.disabled = true;
    try { const r = await api.mailTest(); toast(`Correo de prueba enviado a ${r.to}`); } catch (err) { toast(err.message, 'error', 8000); }
    e.currentTarget.disabled = false;
  });
  renderInvites(body);
  if (has('users.manage')) renderUsers(body);
}

async function renderInvites(body) {
  const box = $('#inviteRows', body); if (!box) return;
  let invites = [];
  try { invites = await api.listInvites(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = invites.length ? '' : '<div class="empty">Sin invitaciones pendientes.</div>';
  for (const inv of invites) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow">${esc(inv.email)}</span><span class="chip tag-gray">${esc(ROLE_LABEL[inv.role])}</span><span class="chip ${inv.emailSentAt ? 'tag-green' : 'tag-yellow'}" title="${inv.emailSentAt ? 'Correo enviado el ' + esc(fmtDate(inv.emailSentAt)) : 'Enlace copiado a mano'}">${inv.emailSentAt ? 'enviada' : 'pendiente'}</span><span class="count">caduca ${fmtDate(inv.expiresAt)}</span><button class="btn danger">Revocar</button>`;
    row.querySelector('.btn').addEventListener('click', async () => {
      try { await api.revokeInvite(inv.id); toast('Invitación revocada'); renderInvites(body); } catch (err) { toast(err.message, 'error'); }
    });
    box.appendChild(row);
  }
}

async function renderUsers(body) {
  const box = $('#userRows', body); if (!box) return;
  let users = [];
  try { users = await api.listUsers(); } catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  box.innerHTML = '';
  for (const u of users) {
    const self = u.id === S.session.user.id;
    const row = document.createElement('div'); row.className = 'row' + (u.isActive ? '' : ' inactive');
    row.innerHTML = `<span class="grow"><b>${esc(u.name || u.email)}</b>${self ? ' (tú)' : ''}<br><span class="count">${esc(u.email)} · ${u.isActive ? 'último acceso ' + fmtDate(u.lastLoginAt) : 'desactivado'}</span></span>
      <select ${self || !u.isActive ? 'disabled' : ''}>${['designer', 'head', 'admin'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
      ${self || !u.isActive ? '' : '<button class="icon-btn" data-reset title="Restablecer contraseña" aria-label="Restablecer contraseña">🔑</button>'}
      ${self ? '' : `<button class="btn ${u.isActive ? 'danger' : ''}">${u.isActive ? 'Desactivar' : 'Activar'}</button>`}`;
    row.querySelector('select').addEventListener('change', async e => {
      try { await api.updateUser(u.id, { role: e.target.value }); toast(`Rol de ${u.email}: ${ROLE_LABEL[e.target.value]}`); renderUsers(body); } catch (err) { toast(err.message, 'error', 5000); renderUsers(body); }
    });
    row.querySelector('[data-reset]')?.addEventListener('click', async () => { // P3: contraseña temporal, visible una sola vez
      const ok = await confirmBox({ title: 'Restablecer contraseña', message: `Se fijará una contraseña temporal para ${u.email} y se cerrarán sus sesiones. Deberás pasársela por un canal seguro.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Restablecer', value: 'ok', kind: 'primary' }] });
      if (!ok) return;
      const pw = tempPassword();
      try { await api.updateUser(u.id, { password: pw }); } catch (err) { toast(err.message, 'error', 5000); return; }
      await secretBox({ title: 'Contraseña temporal', message: `Nueva contraseña de ${u.email}. Se muestra una sola vez: cópiala y compártela; la persona podrá cambiarla desde su chip de usuario.`, secret: pw });
    });
    const btn = row.querySelector('.btn');
    if (btn) btn.addEventListener('click', async () => {
      if (u.isActive) { const ok = await confirmBox({ title: 'Desactivar usuario', message: `${u.email} perderá el acceso y sus sesiones se cerrarán.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Desactivar', value: 'ok', kind: 'danger' }] }); if (!ok) return; }
      try { await api.updateUser(u.id, { isActive: !u.isActive }); renderUsers(body); } catch (err) { toast(err.message, 'error', 5000); }
    });
    box.appendChild(row);
  }
}
