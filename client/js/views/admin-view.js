/* =========================================================
   F4b. Administración (#/admin): invitaciones (P10: la plantilla vive en Lobby → Organización), células, páginas borradas, respaldos, audit log
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { roleLabel } from '../core/roles.js'; // P10
import { renderUsersTab } from './users.js';
import { renderCellsTab } from './cells.js';
import { t } from '../core/i18n.js'; // P15

const has = p => !!S.session && S.session.permissions.includes(p);
const fmt = s => (s ? new Date(s).toLocaleString() : '—');
const TABS = [['users', 'Usuarios', 'invite'], ['cells', 'Células', 'cells.read'], ['deleted', 'Páginas borradas', 'pages.delete'], ['backups', 'Respaldos', 'backups'], ['audit', 'Audit log', 'audit.read']];
export const adminTabsFor = () => TABS.filter(([, , perm]) => has(perm));
const view = () => { let v = $('#adminView'); if (!v) { v = document.createElement('div'); v.id = 'adminView'; v.hidden = true; document.body.appendChild(v); } return v; };
export function closeAdminView() { const v = $('#adminView'); if (v) { v.hidden = true; v.innerHTML = ''; } }

export async function openAdminView(tab) {
  const tabs = adminTabsFor();
  if (!tabs.length) { toast(t('Sin permisos de administración'), 'error'); location.hash = ''; return; }
  tab = tabs.some(t => t[0] === tab) ? tab : (tabs.some(t => t[0] === S.orgTab) ? S.orgTab : tabs[0][0]); S.orgTab = tab;
  const v = view(); v.hidden = false;
  v.innerHTML = `<div class="lobby"><header class="lobby-head"><div class="brand">DesTree · <b>${t('Administración')}</b> · ${esc(S.session.org?.name || '')}</div><span class="spacer"></span>
      <span class="user-chip"><b>${esc(S.session.user.name || S.session.user.email)}</b><span class="role">${esc(roleLabel(S.session.role))}</span></span>
      <button class="btn" id="adminBack">${t('← Volver')}</button></header>
    <nav class="tabs" id="orgTabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${t(l)}</button>`).join('')}</nav>
    <div class="lobby-body panel-body admin-body" id="orgBody"><div class="empty">${t('Cargando…')}</div></div></div>`;
  $('#orgTabs', v).addEventListener('click', e => { const b = e.target.closest('button'); if (b) openAdminView(b.dataset.tab); });
  $('#adminBack', v).addEventListener('click', () => { location.hash = S.pageId ? `#/p/${encodeURIComponent(S.pageId)}` : '#/lobby'; });
  const body = $('#orgBody', v);
  $('#orgTabs .active', v)?.focus();
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
  body.innerHTML = `<h3>${t('Respaldos')} (${r.backups.length})</h3><p>${t('Copia consistente de la base de datos + imágenes en <code>{dir}</code>. Restaurar: con el servidor parado, <code>node scripts/restore.js &lt;archivo&gt;</code>.', { dir: esc(r.dir) })}</p>
    <div class="inline-actions"><button class="btn primary" id="bkCreate">${t('＋ Crear respaldo')}</button><a class="btn" href="/api/org/export?images=embed" download>${t('⤓ Exportar organización (JSON)')}</a><label class="btn">${t('⤒ Importar organización')}<input type="file" accept="application/json,.json" hidden id="bkImport"></label></div>
    <div id="bkRows"></div>`;
  const rows = $('#bkRows', body); if (!r.backups.length) rows.innerHTML = `<div class="empty">${t('Sin respaldos todavía.')}</div>`;
  for (const b of r.backups) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow"><b>${esc(b.filename)}</b><br><span class="count">${esc(b.kind)} · ${esc(b.status)} · ${kb(b.bytes)} · ${fmt(b.createdAt)}${b.error ? ' · ' + esc(b.error) : ''}</span></span>${b.status === 'ok' ? `<a class="btn" href="/api/backups/${b.id}/download" download>${t('Descargar')}</a>` : ''}<button class="icon-btn" title="${t('Eliminar')}" aria-label="${t('Eliminar')}">🗑</button>`;
    row.querySelector('.icon-btn').addEventListener('click', async () => { try { await api.deleteBackup(b.id); renderBackups(body); } catch (err) { toast(err.message, 'error'); } });
    rows.appendChild(row);
  }
  $('#bkCreate', body).addEventListener('click', async e => { e.currentTarget.disabled = true; try { await api.createBackup(); toast(t('Respaldo creado')); } catch (err) { toast(err.message, 'error', 6000); } renderBackups(body); });
  $('#bkImport', body).addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const data = JSON.parse(await f.text()); const st = await api.importOrg(data); toast(t('Importado: {pages} páginas, {versions} versiones, {users} usuarios nuevos, {images} imágenes', st), 'info', 8000); } catch (err) { toast(t('Importación fallida: {msg}', { msg: err.message }), 'error', 8000); }
  });
}

async function renderDeleted(body) {
  let pages = [];
  try { pages = await api.listPages('deleted'); } catch (err) { body.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  body.innerHTML = `<h3>${t('Páginas borradas')} (${pages.length})</h3><p>${t('Borrado suave: el contenido se conserva y se exportó un JSON en <code>data/deleted/</code>. Restaurar la devuelve a activa.')}</p><div id="deletedRows"></div>`;
  const rows = $('#deletedRows', body); if (!pages.length) rows.innerHTML = `<div class="empty">${t('No hay páginas borradas.')}</div>`;
  for (const p of pages) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="grow"><b>${esc(p.name)}</b><br><span class="count">${t('{n} cards', { n: p.nodeCount })} · ${t('borrada {d}', { d: fmt(p.deletedAt) })}</span></span><button class="btn primary">${t('Restaurar')}</button>`;
    row.querySelector('.btn').addEventListener('click', async () => { try { await api.restorePage(p.id); toast(t('Página restaurada')); renderDeleted(body); } catch (err) { toast(err.message, 'error', 5000); } });
    rows.appendChild(row);
  }
}

async function renderAudit(body, cur = { before: null, action: '' }) {
  body.innerHTML = `<h3>${t('Audit log')}</h3><div class="row"><input class="grow" id="auditFilter" placeholder="${t('Filtrar por acción (p. ej. page., user., cell.)')}" value="${esc(cur.action)}"></div>
    <table class="audit-table"><thead><tr><th>${t('Fecha')}</th><th>${t('Usuario')}</th><th>${t('Acción')}</th><th>${t('Entidad')}</th><th>${t('Detalle')}</th></tr></thead><tbody id="auditRows"></tbody></table>
    <div class="inline-actions"><button class="btn" id="auditMore" hidden>${t('Cargar más')}</button></div>`;
  const tbody = $('#auditRows', body), more = $('#auditMore', body);
  const load = async () => {
    let r; try { r = await api.listAudit({ limit: 50, before: cur.before, action: cur.action }); } catch (err) { toast(err.message, 'error'); return; }
    if (!r.items.length && !cur.before) tbody.innerHTML = `<tr><td colspan="5" class="empty">${t('Sin entradas.')}</td></tr>`;
    for (const i of r.items) tbody.insertAdjacentHTML('beforeend', `<tr><td>${esc(fmt(i.createdAt))}</td><td>${esc(i.userName || '—')}</td><td><code>${esc(i.action)}</code></td><td>${esc(i.entity)}${i.entityId ? ` <span class="count">${esc(i.entityId.slice(0, 12))}</span>` : ''}</td><td class="meta">${esc(Object.entries(i.meta || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</td></tr>`);
    cur.before = r.next; more.hidden = !r.next;
  };
  more.addEventListener('click', load);
  let timer; $('#auditFilter', body).addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => renderAudit(body, { before: null, action: e.target.value.trim() }), 300); });
  await load();
}
