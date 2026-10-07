/* =========================================================
   F3. Pestaña Células del panel admin: CRUD (admin) y miembros (admin; head en sus células)
   ========================================================= */
import { $, esc, TAG_COLORS } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox } from '../ui/dialogs.js';
import { colorPicker } from '../ui/page-settings.js';
import { renderAll } from '../canvas/selection.js';

const isAdmin = () => S.session?.role === 'admin';
const canManage = c => isAdmin() || c.leadUserId === S.session.user.id || (c.memberIds || []).includes(S.session.user.id);
const nameOf = id => (S.userDir.find(u => u.id === id) || {}).name || '—';

/** Recarga S.cellList desde la API (admin/head). */
export async function refreshCells() {
  try { S.cellList = await api.listCells(); } catch (err) { if (err.status !== 403) toast('No se pudieron cargar las células: ' + err.message, 'error'); }
  return S.cellList;
}

export async function renderCellsTab(body) {
  body.innerHTML = `<h3>Células (${S.cellList.length})</h3><p>Equipos de trabajo. Una raíz "solo células" la ven únicamente los miembros de esas células (y los asignados).</p><div id="cellRows"><div class="empty">Cargando…</div></div>
    ${isAdmin() ? '<h3>Nueva célula</h3><form class="row" id="newCellForm"><input class="grow" placeholder="Nombre de la célula" required maxlength="80"><button class="btn primary" type="submit">Agregar</button></form>' : ''}`;
  $('#newCellForm', body)?.addEventListener('submit', async e => {
    e.preventDefault(); const name = e.target.querySelector('input').value.trim(); if (!name) return;
    try { await api.createCell({ name, color: TAG_COLORS[S.cellList.length % TAG_COLORS.length] }); await refreshCells(); renderCellsTab(body); toast('Célula creada'); } catch (err) { toast(err.message, 'error', 5000); }
  });
  await refreshCells();
  const rows = $('#cellRows', body); rows.innerHTML = S.cellList.length ? '' : '<div class="empty">No hay células.</div>';
  for (const c of S.cellList) rows.appendChild(cellRow(c, body));
}

function cellRow(c, body) {
  const row = document.createElement('div'); row.className = 'cell-row';
  const members = (c.memberIds || []).map(nameOf);
  row.innerHTML = `<div class="row"><button class="swatch tag-${esc(c.color)}" title="Cambiar color" ${isAdmin() ? '' : 'disabled'}></button><input class="inline grow" value="${esc(c.name)}" maxlength="80" ${isAdmin() ? '' : 'disabled'}>
      <span class="count">${members.length} miembro${members.length === 1 ? '' : 's'}</span>${canManage(c) ? '<button class="btn" data-members>Miembros</button>' : ''}${isAdmin() ? '<button class="icon-btn" data-del title="Eliminar">🗑</button>' : ''}</div>
    <div class="cell-meta">${c.leadUserId ? `Lead: <b>${esc(nameOf(c.leadUserId))}</b> · ` : ''}${members.length ? esc(members.join(', ')) : '<i>sin miembros</i>'}</div>
    <div class="cell-members" hidden></div>`;
  const [sw, inp] = row.querySelector('.row').children;
  if (isAdmin()) {
    sw.addEventListener('click', e => colorPicker(e.clientX, e.clientY, c.color, async col => { try { await api.updateCell(c.id, { color: col }); await refreshCells(); renderCellsTab(body); renderAll(); } catch (err) { toast(err.message, 'error'); } }));
    inp.addEventListener('change', async () => { const v = inp.value.trim(); if (!v) { inp.value = c.name; return; } try { await api.updateCell(c.id, { name: v }); await refreshCells(); renderAll(); toast('Célula renombrada'); } catch (err) { toast(err.message, 'error'); } });
    row.querySelector('[data-del]').addEventListener('click', async () => {
      const ok = await confirmBox({ title: 'Eliminar célula', message: `"${c.name}" se quitará de sus miembros y de las raíces que la usen. Las raíces solo-células sin células quedan visibles solo para asignados.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Eliminar', value: 'ok', kind: 'danger' }] });
      if (!ok) return;
      try { await api.deleteCell(c.id); await refreshCells(); renderCellsTab(body); renderAll(); toast('Célula eliminada'); } catch (err) { toast(err.message, 'error'); }
    });
  }
  row.querySelector('[data-members]')?.addEventListener('click', () => {
    const box = row.querySelector('.cell-members'); box.hidden = !box.hidden; if (!box.hidden) renderMembers(box, c, body);
  });
  return row;
}

function renderMembers(box, c, body) {
  const users = S.userDir;
  box.innerHTML = `<div class="check-list">${users.map(u => `<label><input type="checkbox" value="${u.id}" ${(c.memberIds || []).includes(u.id) ? 'checked' : ''} ${u.id === c.leadUserId ? 'disabled' : ''}>${esc(u.name)}<span class="where">${esc(u.role)}</span></label>`).join('') || '<div class="empty">Sin usuarios.</div>'}</div>
    ${isAdmin() ? `<div class="row"><label class="count">Lead</label><select class="grow" data-lead><option value="">— Sin lead —</option>${users.map(u => `<option value="${u.id}" ${u.id === c.leadUserId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>` : ''}
    <div class="inline-actions"><button class="btn primary" data-save>Guardar miembros</button></div>`;
  box.querySelector('[data-lead]')?.addEventListener('change', async e => { try { await api.updateCell(c.id, { leadUserId: e.target.value || null }); await refreshCells(); renderCellsTab(body); } catch (err) { toast(err.message, 'error'); } });
  box.querySelector('[data-save]').addEventListener('click', async () => {
    const ids = [...box.querySelectorAll('input:checked')].map(i => i.value);
    try { await api.setCellMembers(c.id, ids); await refreshCells(); renderCellsTab(body); renderAll(); toast('Miembros guardados'); } catch (err) { toast(err.message, 'error', 5000); }
  });
}
