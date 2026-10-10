/* =========================================================
   P11. Página de proyecto de una card (#/p/<pid>/n/<nid>/project[/<tab>]): overlay con cabecera, pestañas Overview · Cronograma · Actividades,
   banner de marca y cuerpo por pestaña. Los datos viven en S.projectView.data (GET …/project); tras cada cambio se recargan del servidor.
   ========================================================= */
import { $, $$, esc, applyDataStyles } from '../core/utils.js';
import { S, nodeById, parentOf, tagById, isMyNode, projectHash } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { roleLabel, has } from '../core/roles.js';
import { imageSrc } from '../ui/uploader.js';
import { renderOverview } from './project-overview.js';
import { renderSchedule } from './project-schedule.js';
import { renderKanban } from './project-kanban.js';

export const TABS = [['overview', 'Overview'], ['cronograma', 'Cronograma'], ['kanban', 'Actividades']];
const view = () => { let v = $('#projectPage'); if (!v) { v = document.createElement('div'); v.id = 'projectPage'; v.hidden = true; document.body.appendChild(v); } return v; };
export const isProjectOpen = () => !!$('#projectPage') && !$('#projectPage').hidden;
export function closeProject() { const v = $('#projectPage'); if (v) { v.hidden = true; v.innerHTML = ''; } S.projectView = null; }
export const pathParts = n => { const parts = []; let p = parentOf(n), g = 0; while (p && g++ < 100) { parts.unshift(p.name); p = parentOf(p); } return parts; };

/** Abre (o cambia de pestaña) la página de proyecto de la card `nid` de la página actual. false si la card no existe o no es visible. */
export async function openProject(nid, tab) {
  const n = nodeById(nid); if (!n) return false;
  if (S.offline) { toast('La página de proyecto necesita el servidor.', 'error', 5000); return true; }
  if (!TABS.some(t => t[0] === tab)) tab = S.projectView?.tab || 'overview';
  const same = !!S.projectView && S.projectView.nodeId === nid && !!S.projectView.data;
  S.projectView = { nodeId: nid, tab, data: same ? S.projectView.data : null, canEdit: has('pages.edit') || isMyNode(nid) };
  const v = view(); v.hidden = false;
  if (!same) {
    v.innerHTML = shellHTML(n); bindShell(v, nid);
    try { const d = await api.getProject(S.pageId, nid); if (!S.projectView || S.projectView.nodeId !== nid) return true; S.projectView.data = d; S.projectView.canEdit = !!d.canEdit; }
    catch (err) { if (err.status === 404) { closeProject(); return false; } $('#projectBody', v).innerHTML = `<div class="empty">${esc(err.message)}</div>`; return true; }
  }
  renderTab(); return true;
}
function shellHTML(n) {
  const crumbs = [esc(S.state.page.name), ...pathParts(n).map(esc)].join(' › ');
  return `<div class="lobby project"><header class="lobby-head"><div class="brand">DesTree · <span class="crumbs">${crumbs} › </span><b>${esc(n.name)}</b></div><span class="spacer"></span>
      ${S.session ? `<span class="user-chip"><b>${esc(S.session.user.name || S.session.user.email)}</b><span class="role">${esc(roleLabel(S.session.role))}</span></span>` : ''}
      <button class="btn" id="projectBack">← Volver al lienzo</button></header>
    <nav class="tabs" id="projectTabs">${TABS.map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</nav>
    <div class="project-body" id="projectBody"><div class="empty">Cargando…</div></div></div>`;
}
function bindShell(v, nid) {
  $('#projectTabs', v).addEventListener('click', e => { const b = e.target.closest('button'); if (b) location.hash = projectHash(nid, b.dataset.tab); });
  $('#projectBack', v).addEventListener('click', () => { location.hash = `#/p/${encodeURIComponent(S.pageId)}/n/${encodeURIComponent(nid)}`; });
}
/** Banner de marca: verde con ondas lima, chip, título, meta y hero (imagen de la card) o emoji a la derecha. */
export function bannerHTML({ chip, title, meta = '', image = null, emoji = '', cls = '' }) {
  return `<section class="pj-banner ${cls}">
    <svg class="pj-wave" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M-80,150 C200,160 300,-30 600,10 C820,40 900,200 1280,120"/><path d="M700,260 C900,180 1050,230 1280,190"/></svg>
    <div class="pj-banner-card"><span class="pj-chip">${esc(chip)}</span><h1>${esc(title)}</h1>${meta ? `<div class="pj-banner-meta">${esc(meta)}</div>` : ''}</div>
    ${image ? `<img class="pj-hero" src="${image}" alt="">` : emoji ? `<span class="pj-emoji" aria-hidden="true">${emoji}</span>` : ''}
  </section>`;
}
function tabBanner(tab, n) {
  if (tab === 'cronograma') return bannerHTML({ chip: 'Planeación', title: 'Cronograma de actividades', emoji: '📅' });
  if (tab === 'kanban') return bannerHTML({ chip: 'Actividades', title: 'Actividades Kanban', emoji: '🎯' });
  const meta = [...pathParts(n), n.name, ...(n.tags || []).map(tagById).filter(Boolean).map(t => t.name), String(new Date().getFullYear())].map(s => `[${s}]`).join(' ');
  return bannerHTML({ chip: 'Overview', title: n.name, meta, image: imageSrc(n, 'full'), cls: 'overview' });
}
/** Repinta la pestaña activa con S.projectView.data. */
export function renderTab() {
  const pv = S.projectView; if (!pv || !pv.data) return;
  const n = nodeById(pv.nodeId); if (!n) return closeProject();
  $$('#projectTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === pv.tab));
  document.title = `DesTree · ${n.name} · ${TABS.find(t => t[0] === pv.tab)[1]}`;
  const body = $('#projectBody'); if (!body) return;
  body.innerHTML = tabBanner(pv.tab, n) + '<div class="pj-content"></div>';
  const ctx = { node: n, data: pv.data, canEdit: pv.canEdit, refresh, pid: S.pageId, nid: pv.nodeId };
  const box = $('.pj-content', body);
  if (pv.tab === 'overview') renderOverview(box, ctx); else if (pv.tab === 'cronograma') renderSchedule(box, ctx); else renderKanban(box, ctx);
  applyDataStyles(body);
}
/** Recarga los datos del servidor y repinta (tras cualquier cambio). */
export async function refresh() {
  const pv = S.projectView; if (!pv) return;
  try { pv.data = await api.getProject(S.pageId, pv.nodeId); pv.canEdit = !!pv.data.canEdit; renderTab(); } catch (err) { toast(err.message, 'error', 5000); }
}
