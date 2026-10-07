/* =========================================================
   F4b. Administración (#/admin): usuarios e invitaciones, células, páginas borradas (admin), audit log (admin)
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { ROLE_LABEL } from './auth-views.js';
import { renderUsersTab } from './users.js';
import { renderCellsTab } from './cells.js';

const has = p => !!S.session && S.session.permissions.includes(p);
const fmt = s => (s ? new Date(s).toLocaleString() : '—');
const TABS = [['users', 'Usuarios', 'invite'], ['cells', 'Células', 'cells.read'], ['deleted', 'Páginas borradas', 'pages.delete'], ['backups', 'Respaldos', 'backups'], ['audit', 'Audit log', 'audit.read']];
export const adminTabsFor = () => TABS.filter(([, , perm]) => has(perm));
const view = () => { let v = $('#adminView'); if (!v) { v = document.createElement('div'); v.id = 'adminView'; v.hidden = true; document.body.appendChild(v); } return v; };
export function closeAdminView() { const v = $('#adminView'); if (v) { v.hidden = true; v.innerHTML = ''; } }

export async function openAdminView(tab) {
  const tabs = adminTabsFor();
  if (!tabs.length) { toast('Sin permisos de administración', 'error'); location.hash = ''; return; }
  tab = tabs.some(t => t[0] === tab) ? tab : (tabs.some(t => t[0] === S.orgTab) ? S.orgTab : tabs[0][0]); S.orgTab = tab;
  const v = view(); v.hidden = false;
  v.innerHTML = `<div class="lobby"><header class="lobby-head"><div class="brand">DesTree · <b>Administración</b> · ${esc(S.session.org?.name || '')}</div><span class="spacer"></span>
      <span class="user-chip"><b>${esc(S.session.user.name || S.session.user.email)}</b><span class="role">${esc(ROLE_LABEL[S.session.role] || S.session.role)}</span></span>
      <button class="btn" id="adminBack">← Volver</button></header>
    <nav class="tabs" id="orgTabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</nav>
    <div class="lobby-body panel-body admin-body" id="orgBody"><div class="empty">Cargando…</div></div></div>`;
  $('#orgTabs', v).addEventListener('click', e => { const b = e.target.closest('button'); if (b) openAdminView(b.dataset.tab); });
  $('#adminBack', v).addEventListener('click', () => { location.hash = S.pageId ? `#/p/${encodeURIComponent(S.pageId)}` : '#/lobby'; });
  const body = $('#orgBody', v);
  if (tab === 'users') return renderUsersTab(body);
  if (tab === 'cells') return renderCellsTab(body);
  if (tab === 'deleted') return renderDeleted(body);
  if (tab === 'backups') return renderBackups(body);
  return renderAudit(body);
}

/* --- F6b: respaldos + export/import org --- */
const kb = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(1) + ' KB');
async function renderBackups(body) {
  let r; try { r = await api.listBackups(); } catch (err) { body.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  body.innerHTML = `<h3>Respaldos (${r.backups.length})</h3><p>Copia consistente de la base de datos + imágenes en <code>${esc(r.dir)}</code>. Restaurar: con el servidor parado, <code>node scripts/restore.js &lt;archivo&gt;</code>.</p>
    <div class="inline-actions"><button class="btn primary" id="bkCreate">＋ Crear respaldo</button><a class="btn" href="/api/org/export?images=embed" download>⤓ Exportar organización (JSON)</a><label class="btn">⤒ Importar organización<input type="file" accept="application/json,.json" hidden id="bkImport"></label></div>
    <div id="bkRows"></div>`;
  const rows = $('#bkRows', body); if (!r.backups.length) rows.innerHTML = '<div class="empty">Sin respaldos todavía.</div>';
  for (const b of r.backups) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow"><b>${esc(b.filename)}</b><br><span class="count">${esc(b.kind)} · ${esc(b.status)} · ${kb(b.bytes)} · ${fmt(b.createdAt)}${b.error ? ' · ' + esc(b.error) : ''}</span></span>${b.status === 'ok' ? `<a class="btn" href="/api/backups/${b.id}/download" download>Descargar</a>` : ''}<button class="icon-btn" title="Eliminar">🗑</button>`;
    row.querySelector('.icon-btn').addEventListener('click', async () => { try { await api.deleteBackup(b.id); renderBackups(body); } catch (err) { toast(err.message, 'error'); } });
    rows.appendChild(row);
  }
  $('#bkCreate', body).addEventListener('click', async e => { e.currentTarget.disabled = true; try { await api.createBackup(); toast('Respaldo creado'); } catch (err) { toast(err.message, 'error', 6000); } renderBackups(body); });
  $('#bkImport', body).addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const data = JSON.parse(await f.text()); const st = await api.importOrg(data); toast(`Importado: ${st.pages} páginas, ${st.versions} versiones, ${st.users} usuarios nuevos, ${st.images} imágenes`, 'info', 8000); } catch (err) { toast('Importación fallida: ' + err.message, 'error', 8000); }
  });
}

async function renderDeleted(body) {
  let pages = [];
  try { pages = await api.listPages('deleted'); } catch (err) { body.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  body.innerHTML = `<h3>Páginas borradas (${pages.length})</h3><p>Borrado suave: el contenido se conserva y se exportó un JSON en <code>data/deleted/</code>. Restaurar la devuelve a activa.</p><div id="deletedRows"></div>`;
  const rows = $('#deletedRows', body); if (!pages.length) rows.innerHTML = '<div class="empty">No hay páginas borradas.</div>';
  for (const p of pages) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow"><b>${esc(p.name)}</b><br><span class="count">${p.nodeCount} cards · borrada ${fmt(p.deletedAt)}</span></span><button class="btn primary">Restaurar</button>`;
    row.querySelector('.btn').addEventListener('click', async () => { try { await api.restorePage(p.id); toast('Página restaurada'); renderDeleted(body); } catch (err) { toast(err.message, 'error', 5000); } });
    rows.appendChild(row);
  }
}

async function renderAudit(body, cur = { before: null, action: '' }) {
  body.innerHTML = `<h3>Audit log</h3><div class="row"><input class="grow" id="auditFilter" placeholder="Filtrar por acción (p. ej. page., user., cell.)" value="${esc(cur.action)}"></div>
    <table class="audit-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody id="auditRows"></tbody></table>
    <div class="inline-actions"><button class="btn" id="auditMore" hidden>Cargar más</button></div>`;
  const tbody = $('#auditRows', body), more = $('#auditMore', body);
  const load = async () => {
    let r; try { r = await api.listAudit({ limit: 50, before: cur.before, action: cur.action }); } catch (err) { toast(err.message, 'error'); return; }
    if (!r.items.length && !cur.before) tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin entradas.</td></tr>';
    for (const i of r.items) tbody.insertAdjacentHTML('beforeend', `<tr><td>${esc(fmt(i.createdAt))}</td><td>${esc(i.userName || '—')}</td><td><code>${esc(i.action)}</code></td><td>${esc(i.entity)}${i.entityId ? ` <span class="count">${esc(i.entityId.slice(0, 12))}</span>` : ''}</td><td class="meta">${esc(Object.entries(i.meta || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</td></tr>`);
    cur.before = r.next; more.hidden = !r.next;
  };
  more.addEventListener('click', load);
  let t; $('#auditFilter', body).addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => renderAudit(body, { before: null, action: e.target.value.trim() }), 300); });
  await load();
}
