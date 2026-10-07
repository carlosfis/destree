/* =========================================================
   2. Modelo de datos y persistencia
   ---------------------------------------------------------
   state = page-document v3 (schema/page-document.schema.json) = {
     nodes: [{ id, type:'software'|'ds'|'uikit', name, description, image, tags:[tagId], owner,
               parentId,        // software contenedor (null = raíz / maestro). Obligatorio para ds y uikit
               branchTypeId,    // tipo de ramificación (solo software anidado)
               x, y,            // posición LOCAL respecto al contenedor padre (mundo si es raíz)
               w, h,            // tamaño mínimo manual del contenedor (0 = automático)
               demo }]
     edges: [{ id, kind:'ds'|'source', from, to, demo }]
             ds:     from = software, to = DS/UI Kit que usa. Si viven en raíces distintas se dibuja discontinua
             source: from = UI Kit, to = fuente (DS o software) de la que deriva
     tags:      [{ id, name, color }]
     branchTypes: [{ id, name, color }]   // tipos de ramificación (anidamiento; antes edgeTypes)
     page:      { id, name, description, visibility, status, version }   // F1: metadatos (servidor)
     settings:  { theme, snap, minimap, grid, tool }
     camera:    { x, y, z }
   }
   La ramificación padre → hijo ya no es una línea: es el anidamiento del contenedor.
   ========================================================= */
import { $, debounce, STORAGE_KEY, LEGACY_KEY, PREFS_KEY } from './utils.js';
import { normalizeDocument, defaultDocument } from './normalize.js';
import * as api from './api.js';
import { toast } from '../ui/theme.js';

// Estado mutable compartido (F0b): los módulos leen/escriben S.x porque los imports ESM son de solo lectura.
export const S = {
  firstRun: false,       // state
  state: null,           // state: documento v3 (page, nodes, edges, tags, branchTypes, settings, camera); bootstrap()
  cam: null,             // state: cámara activa { x, y, z }
  vpRect: null,          // camera: rect del viewport; lo fija measureViewport() en init()
  camRaf: 0,             // camera
  mmScale: null,         // minimap
  ptr: null,             // pointer-gestures: gesto en curso
  spaceDown: false,      // pointer-gestures
  altDown: false,        // pointer-gestures
  rafPending: 0,         // pointer-gestures
  nudgeTimer: null,      // keyboard
  popoverOpen: false,    // popover
  adminTab: 'tags',      // admin
  pageId: null,          // state (F1): página cargada desde la API
  version: 0,            // state (F1): versión optimista (If-Match)
  offline: false,        // state (F1): sin servidor → localStorage
  saving: false,         // state (F1): PUT en vuelo
  dirty: false,          // state (F1): cambios pendientes mientras hay PUT en vuelo
};
// normalize.js (compartido con el servidor) es la única fuente de saneado y defaults.
export const defaultState = defaultDocument;
export const normalizeState = normalizeDocument;
/** Datos de ejemplo (demo:true). Las posiciones las define el auto-layout en la primera carga. */
export function demoData() {
  const N = (id, type, name, description, parentId, branchTypeId, tags, owner) =>
    ({ id, type, name, description, image: null, tags, owner, parentId, branchTypeId, x: 0, y: 0, w: 0, h: 0, demo: true });
  const nodes = [
    // Raíz 1: Portal Web, con su propio DS (Nova), una feature (Checkout) que creó su propio DS, y una variante regional
    N('d_portal', 'software', 'Portal Web', 'Sitio público principal de la organización.', null, null, ['t_web', 't_core'], '@mariana'),
    N('d_nova', 'ds', 'Nova DS', 'Sistema de diseño principal: tokens, componentes y guías.', 'd_portal', null, ['t_core'], '@ana'),
    N('d_checkout', 'software', 'Checkout', 'Flujo de pago y confirmación de pedidos.', 'd_portal', 'et_feature', ['t_web', 't_pagos'], '@mariana'),
    N('d_checkds', 'ds', 'Checkout DS', 'DS nacido dentro de Checkout para componentes de pago.', 'd_checkout', null, ['t_pagos'], '@lucia'),
    N('d_gt', 'software', 'Portal Web Guatemala', 'Variante regional con catálogo y moneda locales.', 'd_portal', 'et_geo', ['t_web'], '@jorge'),
    // Raíz 2: App Móvil con un UI Kit derivado de Nova
    N('d_app', 'software', 'App Móvil', 'App nativa para iOS y Android.', null, null, ['t_mobile', 't_core'], '@sofia'),
    N('d_novakit', 'uikit', 'Nova Mobile Kit', 'Kit de UI para iOS/Android derivado de Nova DS.', 'd_app', null, ['t_mobile'], '@ana'),
    // Raíz 3: aplicativo nuevo que adoptó el DS creado en la feature Checkout
    N('d_pagos', 'software', 'Pagos Empresariales', 'Nuevo aplicativo B2B que adoptó Checkout DS como su sistema de diseño.', null, null, ['t_pagos'], '@raul'),
    // Raíz 4: Backoffice con su DS legacy
    N('d_backoffice', 'software', 'Backoffice Admin', 'Panel interno de operación y soporte.', null, null, ['t_interno', 't_legacy'], '@raul'),
    N('d_atlas', 'ds', 'Atlas DS (legacy)', 'Sistema de diseño heredado, en proceso de retiro.', 'd_backoffice', null, ['t_legacy'], '@raul'),
  ];
  const E = (id, kind, from, to) => ({ id, kind, from, to, demo: true });
  const edges = [
    E('de1', 'ds', 'd_portal', 'd_nova'),          // interna (misma raíz)
    E('de2', 'ds', 'd_gt', 'd_nova'),              // interna
    E('de3', 'ds', 'd_checkout', 'd_checkds'),     // interna
    E('de4', 'ds', 'd_app', 'd_novakit'),          // interna
    E('de5', 'source', 'd_novakit', 'd_nova'),     // UI Kit deriva de (punteada)
    E('de6', 'ds', 'd_pagos', 'd_checkds'),        // EXTERNA: otro aplicativo consume el DS nacido en una feature (discontinua)
    E('de7', 'ds', 'd_backoffice', 'd_atlas'),     // interna
  ];
  return { nodes, edges };
}


/* --- Carga y persistencia (F1): API + fallback localStorage solo offline --- */
const localRaw = () => { try { return localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY); } catch { return null; } };
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } };
/** theme y tool son preferencias del navegador, no del documento. */
function applyPrefs(s) { const p = readPrefs(); s.settings.theme = ['light', 'dark'].includes(p.theme) ? p.theme : null; s.settings.tool = p.tool === 'hand' ? 'hand' : 'select'; return s; }
function writePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: S.state.settings.theme, tool: S.state.settings.tool })); } catch { /* sin localStorage */ } }
function withDemo(s) { const demo = demoData(); s.nodes = demo.nodes; s.edges = demo.edges; S.firstRun = true; return s; }

/** Estado local (offline): localStorage o demo. */
export function loadState() {
  try {
    const raw = localRaw();
    return applyPrefs(raw ? normalizeState(JSON.parse(raw)) : withDemo(defaultState()));
  } catch (err) {
    setTimeout(() => toast('No se pudo leer localStorage: ' + err.message, 'error', 6000), 300);
    return withDemo(defaultState());
  }
}
/** Carga la página desde la API. Página virgen → migra localStorage o carga la demo. Sin servidor → loadState(). */
export async function bootstrap() {
  try {
    const page = (await api.listPages())[0];
    if (!page) throw new Error('El servidor no tiene páginas');
    const doc = await api.getPage(page.id);
    S.pageId = doc.page.id; S.version = doc.page.version; S.offline = false;
    let s = normalizeState(doc);
    if (!s.nodes.length && doc.page.version === 0) {
      const raw = localRaw();
      if (raw) { try { s = normalizeState({ ...JSON.parse(raw), page: doc.page }); S.dirty = true; } catch { /* ignorar respaldo corrupto */ } }
      if (!s.nodes.length) s = withDemo(s);
    }
    S.state = applyPrefs(s);
  } catch (err) {
    S.offline = true;
    S.state = loadState();
    setTimeout(() => toast('Sin conexión con el servidor: trabajando en local (' + err.message + ')', 'error', 6000), 300);
  }
  S.cam = { ...S.state.camera };
  if (S.dirty) { S.dirty = false; save(); }
}
S.state = defaultState(); // provisional hasta bootstrap(); ningún módulo lee S.state en su nivel superior
S.cam = { ...S.state.camera };

/** Documento v3 tal como viaja en PUT (sin claves ajenas al schema). */
export function toDocument() {
  const { page, nodes, edges, tags, branchTypes, settings, camera } = S.state;
  return { version: 3, page: { ...page, version: S.version }, nodes, edges, tags, branchTypes, settings, camera };
}
function persistLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S.state)); setSaveStatus(S.offline ? 'Guardado (local)' : 'Sin conexión'); } catch (err) {
    const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    setSaveStatus('Sin guardar');
    toast(full ? 'localStorage está lleno: exporta un respaldo y reduce imágenes.' : 'No se pudo guardar: ' + err.message, 'error', 6000);
  }
}
async function reloadFromServer() {
  const doc = await api.getPage(S.pageId);
  S.version = doc.page.version; S.state = applyPrefs(normalizeState(doc)); S.cam = { ...S.state.camera };
  document.dispatchEvent(new CustomEvent('destree:reload'));
}
async function pushRemote(keepalive) {
  if (S.saving) { S.dirty = true; return; }
  S.saving = true; S.dirty = false; setSaveStatus('Guardando…');
  try {
    const res = await api.putPage(S.pageId, toDocument(), S.version, { keepalive });
    S.version = res.version; setSaveStatus('Guardado');
  } catch (err) {
    if (err.status === 409) { setSaveStatus('Conflicto'); await reloadFromServer().catch(() => {}); toast('La página cambió en el servidor: se recargó la última versión.', 'error', 6000); }
    else if (err.status === 400) { setSaveStatus('Sin guardar'); toast('El servidor rechazó el documento: ' + err.message, 'error', 8000); }
    else { persistLocal(); toast('No se pudo guardar en el servidor: ' + err.message, 'error', 6000); }
  } finally { S.saving = false; if (S.dirty) pushRemote(); }
}
export function persist(keepalive = false) {
  S.state.camera = { x: S.cam.x, y: S.cam.y, z: S.cam.z };
  writePrefs();
  if (S.offline || !S.pageId) persistLocal(); else pushRemote(keepalive);
}
export const save = debounce(persist, 800);
export const saveCam = debounce(persist, 900);
export function setSaveStatus(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(true); });
window.addEventListener('pagehide', () => persist(true));

/* --- Acceso rápido al modelo --- */
export const nodeById = id => S.state.nodes.find(n => n.id === id);
export const tagById = id => S.state.tags.find(t => t.id === id);
export const branchTypeById = id => S.state.branchTypes.find(t => t.id === id);
export const isContainer = n => !!n && n.type === 'software';
export const childrenOf = id => S.state.nodes.filter(n => n.parentId === id);
export const roots = () => S.state.nodes.filter(n => !n.parentId);
export const edgesOf = id => S.state.edges.filter(e => e.from === id || e.to === id);
export const sourceEdgeOf = id => S.state.edges.find(e => e.kind === 'source' && e.from === id);
export const dsOf = id => S.state.edges.filter(e => e.kind === 'ds' && e.from === id).map(e => nodeById(e.to)).filter(Boolean);
export const defaultBranchType = () => (branchTypeById('et_feature') || S.state.branchTypes[0] || {}).id || null;

export function parentOf(n) { return n && n.parentId ? nodeById(n.parentId) : null; }
export function rootOf(n) { let g = 0; while (n && n.parentId && g++ < 100) { const p = nodeById(n.parentId); if (!p) break; n = p; } return n; }
export function depthOf(n) { let d = 0; while (n && n.parentId && d < 100) { n = nodeById(n.parentId); d++; } return d; }
/** ¿`aId` es ancestro de `bId`? */
export function isAncestor(aId, bId) { let n = nodeById(bId), g = 0; while (n && n.parentId && g++ < 100) { if (n.parentId === aId) return true; n = nodeById(n.parentId); } return false; }
export function ancestorsOf(id) { const out = []; let n = nodeById(id); while (n && n.parentId) { out.push(n.parentId); n = nodeById(n.parentId); if (out.length > 100) break; } return out; }
export function descendantsOf(id, acc = []) { for (const c of childrenOf(id)) { acc.push(c.id); descendantsOf(c.id, acc); } return acc; }
/** Posición absoluta (mundo) de un nodo. */
export function worldPos(n) { let x = n.x, y = n.y, p = parentOf(n), g = 0; while (p && g++ < 100) { x += p.x; y += p.y; p = parentOf(p); } return { x, y }; }
/** ¿La dependencia de DS cruza entre raíces distintas? */
export const isExternalDs = e => { const a = nodeById(e.from), b = nodeById(e.to); return !!a && !!b && rootOf(a).id !== rootOf(b).id; };

