/* =========================================================
   19. Botones de la UI e inicialización
   ========================================================= */
import { $, esc } from './core/utils.js';
import { viewport } from './core/dom.js';
import { S, persist, setSaveStatus, nodeById, bootstrap } from './core/state.js';
import { openLobby, closeLobby } from './views/lobby.js';
import { history } from './core/history.js';
import { closePopover } from './ui/popover.js';
import { editorDialog } from './ui/card-editor.js';
import { undo, redo, updateUndoButtons } from './core/history.js';
import { measureViewport, applyCamera, zoomStep, setZoom, fitToScreen } from './canvas/camera.js';
import { renderAll, clearSelection } from './canvas/selection.js';
import { setTool } from './canvas/pointer-gestures.js';
import { showNewMenu } from './ui/popover.js';
import { adminPanel, toggleAdmin, applySettingsUI, enablePageTab } from './ui/page-settings.js';
import { openAdminView, closeAdminView, adminTabsFor } from './views/admin-view.js';
import { openVersionsPanel } from './views/versions-panel.js';
import * as api from './core/api.js';
import { showSetup, showLogin, showInvite, hideAuth, ROLE_LABEL } from './views/auth-views.js';
import { applyReadonly, canEdit } from './core/readonly.js';
import { toast } from './ui/theme.js';
import { computeLayout, autoLayout } from './canvas/layout.js';
import { applyTheme, openShortcuts } from './ui/theme.js';
import { openMyAssignments, goToNode } from './views/me.js';
import { refreshCells } from './views/cells.js';
import './canvas/keyboard.js'; // solo efectos (listeners)
$('#btnNew').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); showNewMenu(r.left, r.bottom + 4); });
$('#btnLayout').addEventListener('click', autoLayout);
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnHelp').addEventListener('click', openShortcuts);
$('#toolSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(b.dataset.tool); });
$('#zoomIn').addEventListener('click', () => zoomStep(1.25));
$('#zoomOut').addEventListener('click', () => zoomStep(1 / 1.25));
$('#zoomFit').addEventListener('click', () => fitToScreen());
$('#zoomLabel').addEventListener('click', () => setZoom(1));
viewport.addEventListener('pointerdown', () => { if (innerWidth <= 720 && adminPanel.classList.contains('open')) toggleAdmin(false); });

/* --- F2: router mínimo por hash (#/login, #/setup, #/invite/<token>) + sesión --- */
const route = () => { const m = location.hash.match(/^#\/(login|setup|invite|me|n|p|lobby|admin)(?:\/([^/]+))?(?:\/n\/([^/]+))?/); return m ? { name: m[1], arg: m[2], node: m[3] } : null; };
/** Resuelve S.session (o null sin servidor). Muestra setup/login/invitación cuando hace falta. */
async function authenticate() {
  const r = route();
  if (r && r.name === 'invite' && r.arg) { if (await showInvite(decodeURIComponent(r.arg))) { location.hash = ''; return authenticate(); } return new Promise(() => {}); }
  try { return await api.getMe(); } catch (err) {
    if (err.status === 401) {
      const needsSetup = err.data?.setup ?? (r && r.name === 'setup');
      await (needsSetup ? showSetup() : showLogin(r && r.name === 'setup' ? 'La instalación ya está configurada.' : ''));
      location.hash = ''; return authenticate();
    }
    if (err.status) { toast('El servidor respondió ' + err.status + ': ' + err.message, 'error', 8000); return null; }
    return null; // sin servidor: bootstrap() entra en modo local
  }
}
function renderUserChip() {
  if (!S.session || $('#userChip')) return;
  const chip = document.createElement('span'); chip.className = 'user-chip'; chip.id = 'userChip';
  chip.innerHTML = `<b>${esc(S.session.user.name || S.session.user.email)}</b><span class="role">${esc(ROLE_LABEL[S.session.role] || S.session.role)}</span>`;
  const out = document.createElement('button'); out.className = 'btn'; out.id = 'btnLogout'; out.title = 'Cerrar sesión'; out.textContent = 'Salir';
  out.addEventListener('click', async () => { await api.logout().catch(() => {}); location.hash = '#/login'; location.reload(); });
  const me = document.createElement('button'); me.className = 'btn'; me.id = 'btnMe'; me.title = 'Mis asignaciones'; me.textContent = '★ Mías'; // F3
  me.addEventListener('click', () => { location.hash = '#/me'; });
  const ver = document.createElement('button'); ver.className = 'btn'; ver.id = 'btnVersions'; ver.title = 'Historial de versiones'; ver.textContent = '⟲ Historial'; ver.addEventListener('click', openVersionsPanel); // F6a
  const org = adminTabsFor().length ? document.createElement('button') : null; // F4b
  if (org) { org.className = 'btn'; org.id = 'btnOrg'; org.title = 'Administración (usuarios, células, audit)'; org.textContent = '⚑ Admin'; org.addEventListener('click', () => { location.hash = '#/admin'; }); }
  $('#btnAdmin').before(chip, me, ver, ...(org ? [org] : []), out);
  $('#btnAdmin').innerHTML = '⚙ <span class="hide-sm">Página</span>'; $('#btnAdmin').title = 'Ajustes de la página';
}
/** F4a: botón de página actual → lobby (inyectado tras la marca). */
function renderPageButton() {
  let b = $('#btnLobby');
  if (!b) { b = document.createElement('button'); b.className = 'btn'; b.id = 'btnLobby'; b.title = 'Páginas (lobby)'; b.addEventListener('click', () => { location.hash = '#/lobby'; }); $('.topbar .brand').after(b); }
  b.innerHTML = `⌂ <b>${esc(S.state?.page?.name || 'Páginas')}</b>`;
}
/** F4a: cambio de página sin fugas: bootstrap(pageId) + reset de historial/selección/popover/diálogos. */
async function loadPage(pid) {
  try { await bootstrap(pid); } catch (err) { if (err.noPage || err.status === 403 || err.status === 404) { toast(err.message, 'error', 5000); if (!S.pageId) return openLobby(); if (location.hash !== '#/lobby') location.hash = '#/lobby'; return; } throw err; }
  history.past.length = 0; history.future.length = 0; updateUndoButtons();
  closePopover(); if (editorDialog.open) editorDialog.close(); toggleAdmin(false);
  document.dispatchEvent(new CustomEvent('destree:reload'));
  closeLobby(); renderPageButton();
  setSaveStatus(S.offline ? 'Sin conexión' : S.readonly ? 'Solo lectura' : 'Guardado');
}
/** F3: carga células (admin/head: todas; designer: las suyas) y directorio (admin/head). */
async function loadTeamData() {
  if (!S.session) return;
  if (S.session.permissions.includes('cells.read')) await refreshCells(); else S.cellList = S.session.cells || [];
  if (S.session.permissions.includes('directory.read')) { try { S.userDir = await api.directory(); } catch { S.userDir = []; } }
}
/** F3: rutas de app (#/me, #/n/<id>) tras cargar el documento. */
async function appRoute() {
  const r = route(); if (!r || !S.state) return;
  if (r.name === 'admin') { closeLobby(); return openAdminView(r.arg); }
  closeAdminView();
  if (r.name === 'lobby') return openLobby();
  if (r.name === 'p' && r.arg) {
    const pid = decodeURIComponent(r.arg);
    if (pid !== S.pageId) await loadPage(pid);
    if (pid !== S.pageId) return; // no se pudo cargar
    closeLobby();
    if (r.node && !goToNode(decodeURIComponent(r.node))) toast('Esa card no existe o no es visible para ti.', 'error', 5000);
    return;
  }
  closeLobby();
  if (r.name === 'me') openMyAssignments();
  else if (r.name === 'n' && r.arg && !goToNode(decodeURIComponent(r.arg))) toast('Esa card no existe o no es visible para ti.', 'error', 5000);
}
document.addEventListener('destree:unauthorized', () => { if (!$('#authView').hidden) return; showLogin('Tu sesión ha caducado. Vuelve a entrar.').then(() => location.reload()); });
window.addEventListener('hashchange', () => { const r = route(); if (r && r.name === 'invite' && S.session) location.reload(); else appRoute(); });

export async function init() {
  S.session = await authenticate();
  hideAuth();
  renderUserChip();
  enablePageTab();
  if (!canEdit()) applyReadonly();
  await loadTeamData();
  measureViewport(); // F0b: antes era eager en camera.js (S.vpRect); debe preceder a applyTheme → drawMinimap
  const r0 = route();
  try { await bootstrap(r0 && r0.name === 'p' && r0.arg ? decodeURIComponent(r0.arg) : null); } // F1/F4a: documento desde la API (o localStorage si no hay servidor)
  catch (err) { if (!err.noPage && err.status !== 403 && err.status !== 404) throw err; toast(err.message, 'error', 5000); if (!S.pageList.length) { applyTheme(); openLobby(); return; } await bootstrap(); }
  renderPageButton();
  applyTheme();
  applySettingsUI();
  renderAll();
  updateUndoButtons();
  if (S.firstRun) {
    // Primera carga: acomodar el ejemplo y encuadrarlo
    const target = computeLayout();
    for (const [id, p] of target) { const n = nodeById(id); n.x = p.x; n.y = p.y; }
    renderAll();
    fitToScreen(null, false);
    persist();
  } else applyCamera();
  setSaveStatus(S.offline ? 'Sin conexión' : S.readonly ? 'Solo lectura' : 'Guardado');
  appRoute();
}
// F1: tras un 409 state.js recarga el documento del servidor y avisa aquí para repintar.
document.addEventListener('destree:reload', () => { clearSelection(); applyTheme(); applySettingsUI(); renderAll(); applyCamera(); renderPageButton(); });
document.addEventListener('destree:page-meta', renderPageButton); // F4b
document.addEventListener('destree:load-page', e => loadPage(e.detail.pageId)); // F6a: recarga tras restaurar una versión
init();


if (['localhost', '127.0.0.1'].includes(location.hostname)) window.S = S; // solo depuración en dev