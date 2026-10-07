/* =========================================================
   F2. Pestaña Usuarios del panel admin: invitaciones (enlace copiable) y usuarios/roles
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox } from '../ui/dialogs.js';
import { ROLE_LABEL } from './auth-views.js';

const has = p => !!S.session && S.session.permissions.includes(p);
const fmtDate = s => s ? new Date(s).toLocaleDateString() : '—';
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch { window.prompt('Copia el enlace de invitación:', text); }
}

export async function renderUsersTab(body) {
  const roles = S.session.role === 'admin' ? ['designer', 'head', 'admin'] : ['designer'];
  body.innerHTML = `<h3>Invitar</h3><p>Se genera un enlace para compartir (válido 7 días). ${S.session.role === 'head' ? 'Como head solo puedes invitar designers.' : ''}</p>
    <form id="inviteForm" class="row"><input type="email" name="email" placeholder="correo@ejemplo.com" required class="grow"><select name="role">${roles.map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}</select><button class="btn primary" type="submit">Invitar</button></form>
    <div id="inviteResult"></div>
    <h3>Invitaciones pendientes</h3><div id="inviteRows"><div class="empty">Cargando…</div></div>
    ${has('users.manage') ? '<h3>Usuarios</h3><div id="userRows"><div class="empty">Cargando…</div></div>' : ''}`;
  $('#inviteForm', body).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget, data = Object.fromEntries(new FormData(f));
    try {
      const inv = await api.createInvite({ email: data.email, role: data.role });
      f.reset();
      $('#inviteResult', body).innerHTML = `<div class="invite-link"><input type="text" value="${esc(inv.link)}" disabled><button class="btn" type="button">Copiar</button></div><p class="hint">Enlace para ${esc(inv.email)} (${esc(ROLE_LABEL[inv.role])}). No se envía correo: cópialo y compártelo.</p>`;
      $('#inviteResult .btn', body).addEventListener('click', () => copyText(inv.link));
      copyText(inv.link); renderInvites(body);
    } catch (err) { toast('No se pudo invitar: ' + err.message, 'error', 6000); }
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
    row.innerHTML = `<span class="grow">${esc(inv.email)}</span><span class="chip tag-gray">${esc(ROLE_LABEL[inv.role])}</span><span class="count">caduca ${fmtDate(inv.expiresAt)}</span><button class="btn danger">Revocar</button>`;
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
      ${self ? '' : `<button class="btn ${u.isActive ? 'danger' : ''}">${u.isActive ? 'Desactivar' : 'Activar'}</button>`}`;
    row.querySelector('select').addEventListener('change', async e => {
      try { await api.updateUser(u.id, { role: e.target.value }); toast(`Rol de ${u.email}: ${ROLE_LABEL[e.target.value]}`); renderUsers(body); } catch (err) { toast(err.message, 'error', 5000); renderUsers(body); }
    });
    const btn = row.querySelector('.btn');
    if (btn) btn.addEventListener('click', async () => {
      if (u.isActive) { const ok = await confirmBox({ title: 'Desactivar usuario', message: `${u.email} perderá el acceso y sus sesiones se cerrarán.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Desactivar', value: 'ok', kind: 'danger' }] }); if (!ok) return; }
      try { await api.updateUser(u.id, { isActive: !u.isActive }); renderUsers(body); } catch (err) { toast(err.message, 'error', 5000); }
    });
    box.appendChild(row);
  }
}
