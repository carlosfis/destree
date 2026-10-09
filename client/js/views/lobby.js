/* =========================================================
   F4a. Lobby (#/lobby[/<tab>]): grid de páginas, buscador, crear/renombrar/archivar/borrar/restaurar, Mis asignaciones; P10: pestaña Organización (nivel ≥4)
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox, promptBox } from '../ui/dialogs.js';
import { roleLabel, has } from '../core/roles.js'; // P10
import { assignmentItems, assignmentHTML } from './me.js';
import { renderOrgTab } from './org.js'; // P10
const fmt = s => (s ? new Date(s).toLocaleString() : '—');
const view = () => { let v = $('#lobbyView'); if (!v) { v = document.createElement('div'); v.id = 'lobbyView'; v.hidden = true; document.body.appendChild(v); } return v; };
export const isLobbyOpen = () => !!$('#lobbyView') && !$('#lobbyView').hidden;
export function closeLobby() { const v = $('#lobbyView'); if (v) { v.hidden = true; v.innerHTML = ''; } }

/** Abre el lobby. `tab`: 'active' | 'archived' | 'deleted' | 'me' | 'org' (P10: Organización, nivel ≥4). */
export async function openLobby(tab = S.lobbyTab || 'active') {
  const tabs = [['active', 'Páginas'], ['archived', 'Archivadas'], ...(has('pages.delete') ? [['deleted', 'Borradas']] : []), ['me', 'Mis asignaciones'], ...(has('users.read') ? [['org', 'Organización']] : [])];
  if (!tabs.some(t => t[0] === tab)) tab = 'active';
  S.lobbyTab = tab;
  const v = view(); v.hidden = false;
  v.innerHTML = `<div class="lobby"><header class="lobby-head"><div class="brand">DesTree · <b>${esc(S.session?.org?.name || 'Lobby')}</b></div>
      <span class="spacer"></span>${S.session ? `<span class="user-chip"><b>${esc(S.session.user.name || S.session.user.email)}</b><span class="role">${esc(roleLabel(S.session.role))}</span></span>` : ''}
      ${S.pageId ? '<button class="btn" id="lobbyBack">← Volver al lienzo</button>' : ''}</header>
    <nav class="tabs" id="lobbyTabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</nav>
    <div class="lobby-bar" ${tab === 'me' || tab === 'org' ? 'hidden' : ''}><input type="search" id="lobbySearch" placeholder="Buscar página…">${has('pages.create') && tab === 'active' ? '<button class="btn primary" id="lobbyNew">＋ Nueva página</button>' : ''}</div>
    <div class="lobby-body" id="lobbyBody"><div class="empty">Cargando…</div></div></div>`;
  $('#lobbyTabs', v).addEventListener('click', e => { const b = e.target.closest('button'); if (b) openLobby(b.dataset.tab); });
  $('#lobbyBack', v)?.addEventListener('click', () => { location.hash = `#/p/${encodeURIComponent(S.pageId)}`; });
  $('#lobbyNew', v)?.addEventListener('click', async () => {
    const name = await promptBox({ title: 'Nueva página', label: 'Nombre', okLabel: 'Crear' }); if (!name) return;
    try { const doc = await api.createPage({ name }); toast('Página creada'); location.hash = `#/p/${encodeURIComponent(doc.page.id)}`; } catch (err) { toast(err.message, 'error', 5000); }
  });
  $('#lobbySearch', v)?.addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); v.querySelectorAll('.page-card').forEach(c => { c.hidden = !!q && !c.dataset.q.includes(q); }); });
  const body = $('#lobbyBody', v);
  $('#lobbyTabs .active', v)?.focus();
  if (tab === 'org') return renderOrgTab(body); // P10
  if (tab === 'me') { body.innerHTML = assignmentHTML(await assignmentItems()); body.addEventListener('click', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); location.hash = a.getAttribute('href'); } }); return; }
  let pages = [];
  try { pages = await api.listPages(tab); if (tab === 'active') S.pageList = pages; } catch (err) { body.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  body.innerHTML = pages.length ? '<div class="page-grid"></div>' : `<div class="empty">${tab === 'active' ? 'No hay páginas visibles.' : tab === 'archived' ? 'No hay páginas archivadas.' : 'No hay páginas borradas.'}</div>`;
  for (const p of pages) $('.page-grid', body)?.appendChild(pageCard(p, tab));
}

function pageCard(p, tab) {
  const el = document.createElement('article'); el.className = 'page-card' + (p.id === S.pageId ? ' current' : ''); el.dataset.q = `${p.name} ${p.description}`.toLowerCase();
  const vis = p.visibility === 'cells' ? `<span class="chip vis-cells" title="Solo células">◐ ${p.cellIds.length ? p.cellIds.map(id => esc((S.cellList.find(c => c.id === id) || {}).name || 'célula')).join(', ') : 'Solo células'}</span>` : '<span class="chip tag-gray">Organización</span>';
  const actions = [];
  if (tab === 'active') { actions.push('<button class="btn primary" data-open>Abrir</button>'); if (has('pages.edit')) actions.push('<button class="btn" data-rename>Renombrar</button>'); if (has('pages.create')) actions.push('<button class="btn" data-dup>Duplicar</button>'); if (has('pages.archive')) actions.push('<button class="btn" data-archive>Archivar</button>'); if (has('pages.delete')) actions.push('<button class="btn danger" data-delete>Borrar</button>'); }
  if (tab === 'archived') { actions.push('<button class="btn" data-open>Ver</button>'); if (has('pages.archive')) actions.push('<button class="btn primary" data-unarchive>Restaurar</button>'); if (has('pages.delete')) actions.push('<button class="btn danger" data-delete>Borrar</button>'); }
  if (tab === 'deleted') actions.push('<button class="btn primary" data-restore>Restaurar</button>');
  el.innerHTML = `<h3>${esc(p.name)}</h3><p>${esc(p.description || 'Sin descripción')}</p>
    <div class="page-meta">${vis}<span>${p.rootCount} raíz${p.rootCount === 1 ? '' : 'ces'} · ${p.nodeCount} cards</span><span title="Última edición">${fmt(p.updatedAt)}</span>${p.archivedAt ? `<span>Archivada ${fmt(p.archivedAt)}</span>` : ''}${p.deletedAt ? `<span>Borrada ${fmt(p.deletedAt)}</span>` : ''}</div>
    <div class="page-actions">${actions.join('')}</div>`;
  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); openLobby(tab); } catch (err) { toast(err.message, 'error', 5000); } };
  el.querySelector('[data-open]')?.addEventListener('click', () => { location.hash = `#/p/${encodeURIComponent(p.id)}`; });
  el.querySelector('[data-rename]')?.addEventListener('click', async () => { const name = await promptBox({ title: 'Renombrar página', label: 'Nombre', value: p.name, okLabel: 'Guardar' }); if (name && name !== p.name) act(() => api.patchPage(p.id, { name }), 'Página renombrada'); });
  el.querySelector('[data-dup]')?.addEventListener('click', () => act(() => api.duplicatePage(p.id), 'Página duplicada'));
  el.querySelector('[data-archive]')?.addEventListener('click', () => act(() => api.archivePage(p.id), 'Página archivada'));
  el.querySelector('[data-unarchive]')?.addEventListener('click', () => act(() => api.unarchivePage(p.id), 'Página restaurada'));
  el.querySelector('[data-restore]')?.addEventListener('click', () => act(() => api.restorePage(p.id), 'Página restaurada'));
  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Borrar página', message: `"${p.name}" dejará de estar disponible para todos. Solo un admin puede restaurarla desde la pestaña Borradas.`, buttons: [{ label: 'Cancelar', value: '' }, { label: 'Borrar', value: 'ok', kind: 'danger' }] });
    if (ok) act(() => api.deletePage(p.id), 'Página borrada');
  });
  return el;
}
