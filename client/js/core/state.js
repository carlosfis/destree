'use strict';
/* =========================================================
   2. Modelo de datos y persistencia
   ---------------------------------------------------------
   state = {
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
     edgeTypes: [{ id, name, color }]     // tipos de ramificación (anidamiento)
     settings:  { theme, snap, minimap, grid, tool }
     camera:    { x, y, z }
   }
   La ramificación padre → hijo ya no es una línea: es el anidamiento del contenedor.
   ========================================================= */
function defaultState() {
  return {
    version: 2,
    nodes: [],
    edges: [],
    tags: [
      { id: 't_core', name: 'Core', color: 'blue' },
      { id: 't_web', name: 'Web', color: 'purple' },
      { id: 't_mobile', name: 'Mobile', color: 'green' },
      { id: 't_legacy', name: 'Legacy', color: 'brown' },
      { id: 't_interno', name: 'Interno', color: 'gray' },
      { id: 't_pagos', name: 'Pagos', color: 'yellow' },
    ],
    edgeTypes: [
      { id: 'et_feature', name: 'Feature', color: 'blue' },
      { id: 'et_fork', name: 'Fork', color: 'gray' },
      { id: 'et_mobile', name: 'Versión mobile', color: 'green' },
      { id: 'et_desktop', name: 'Versión desktop', color: 'purple' },
      { id: 'et_geo', name: 'Geografía/Región', color: 'orange' },
      { id: 'et_parent', name: 'Software padre/hijo', color: 'brown' },
    ],
    settings: { theme: null, snap: true, minimap: true, grid: true, tool: 'select' },
    camera: { x: 80, y: 60, z: 0.9 },
  };
}

/** Datos de ejemplo (demo:true). Las posiciones las define el auto-layout en la primera carga. */
function demoData() {
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

/** Sanea un estado importado o leído de localStorage; migra el formato v1 (ramificaciones como líneas). */
function normalizeState(raw) {
  const d = defaultState();
  const s = { ...d, ...(raw && typeof raw === 'object' ? raw : {}) };
  s.version = 2;
  s.nodes = Array.isArray(s.nodes) ? s.nodes.filter(n => n && n.id).map(n => ({
    id: String(n.id), type: TYPE_META[n.type] ? n.type : 'software', name: String(n.name ?? 'Sin nombre'),
    description: String(n.description ?? '').slice(0, 140), image: typeof n.image === 'string' && n.image.startsWith('data:image') ? n.image : null,
    tags: Array.isArray(n.tags) ? n.tags.map(String) : [], owner: String(n.owner ?? ''),
    parentId: n.parentId ? String(n.parentId) : null, branchTypeId: n.branchTypeId ? String(n.branchTypeId) : null,
    x: Number.isFinite(+n.x) ? +n.x : 0, y: Number.isFinite(+n.y) ? +n.y : 0,
    w: Number.isFinite(+n.w) ? Math.max(0, +n.w) : 0, h: Number.isFinite(+n.h) ? Math.max(0, +n.h) : 0, demo: !!n.demo,
  })) : [];
  const byId = id => s.nodes.find(n => n.id === id);
  s.tags = Array.isArray(s.tags) && s.tags.length ? s.tags.filter(t => t && t.id).map(t => ({ id: String(t.id), name: String(t.name ?? ''), color: TAG_COLORS.includes(t.color) ? t.color : 'gray' })) : d.tags;
  s.edgeTypes = Array.isArray(s.edgeTypes) && s.edgeTypes.length ? s.edgeTypes.filter(t => t && t.id).map((t, i) => ({ id: String(t.id), name: String(t.name ?? ''), color: TAG_COLORS.includes(t.color) ? t.color : TAG_COLORS[i % TAG_COLORS.length] })) : d.edgeTypes;
  const rawEdges = Array.isArray(s.edges) ? s.edges.filter(e => e && e.id && e.from !== e.to) : [];

  // --- Migración v1: líneas de ramificación → anidamiento ---
  const legacyBranch = rawEdges.filter(e => e.kind === 'branch');
  if (legacyBranch.length || s.nodes.some(n => n.type !== 'software' && !n.parentId)) {
    const worldOld = new Map(s.nodes.map(n => [n.id, { x: n.x, y: n.y }])); // en v1 todas las posiciones eran de mundo
    const isAnc = (a, b) => { let n = byId(b); const seen = new Set(); while (n && n.parentId && !seen.has(n.id)) { if (n.parentId === a) return true; seen.add(n.id); n = byId(n.parentId); } return false; };
    for (const e of legacyBranch) {
      const child = byId(e.to), parent = byId(e.from);
      if (child && parent && child.type === 'software' && parent.type === 'software' && !child.parentId && child.id !== parent.id && !isAnc(child.id, parent.id)) {
        child.parentId = parent.id; child.branchTypeId = e.typeId ? String(e.typeId) : null;
      }
    }
    for (const n of s.nodes) {
      if (n.type === 'software' || n.parentId) continue;
      const consumer = rawEdges.find(e => e.kind === 'ds' && e.to === n.id);
      let host = consumer && byId(consumer.from);
      if (!host) { const src = rawEdges.find(e => e.kind === 'source' && e.from === n.id); const sn = src && byId(src.to); host = sn && (sn.type === 'software' ? sn : byId(sn.parentId)); }
      if (!host || host.type !== 'software') host = s.nodes.find(x => x.type === 'software');
      if (!host) { host = { id: uid(), type: 'software', name: 'Organización', description: 'Contenedor creado al migrar.', image: null, tags: [], owner: '', parentId: null, branchTypeId: null, x: 0, y: 0, w: 0, h: 0, demo: false }; s.nodes.unshift(host); worldOld.set(host.id, { x: 0, y: 0 }); }
      n.parentId = host.id;
    }
    // Convertir posiciones de mundo a locales
    const worldOf = id => worldOld.get(id) || { x: 0, y: 0 };
    for (const n of s.nodes) if (n.parentId && worldOld.has(n.id)) { const pw = worldOf(n.parentId), w = worldOf(n.id); n.x = Math.max(PAD, w.x - pw.x); n.y = Math.max(90, w.y - pw.y); }
  }

  // --- Integridad de jerarquía ---
  const ids = new Set(s.nodes.map(n => n.id));
  for (const n of s.nodes) {
    if (n.parentId && (!ids.has(n.parentId) || n.parentId === n.id || byId(n.parentId).type !== 'software')) n.parentId = null;
  }
  for (const n of s.nodes) { // romper ciclos
    const seen = new Set([n.id]); let p = n.parentId;
    while (p) { if (seen.has(p)) { n.parentId = null; break; } seen.add(p); p = byId(p)?.parentId || null; }
  }
  for (const n of s.nodes) {
    if (n.type !== 'software') { n.branchTypeId = null; n.w = 0; n.h = 0; if (!n.parentId) { const host = s.nodes.find(x => x.type === 'software' && x.id !== n.id); if (host) n.parentId = host.id; } }
    if (n.type === 'software' && !n.parentId) n.branchTypeId = null;
  }
  s.nodes = s.nodes.filter(n => n.type === 'software' || n.parentId); // DS/UI Kit sin ningún software posible se descartan
  const etIds = new Set(s.edgeTypes.map(t => t.id));
  for (const n of s.nodes) if (n.parentId && n.type === 'software' && !etIds.has(n.branchTypeId)) n.branchTypeId = s.edgeTypes[0].id;

  const ids2 = new Set(s.nodes.map(n => n.id));
  s.edges = rawEdges.filter(e => KIND_LABEL[e.kind] && ids2.has(e.from) && ids2.has(e.to))
    .filter(e => e.kind === 'ds' ? byId(e.from).type === 'software' && byId(e.to).type !== 'software' : byId(e.from).type === 'uikit')
    .map(e => ({ id: String(e.id), kind: e.kind, from: e.from, to: e.to, demo: !!e.demo }));
  const tagIds = new Set(s.tags.map(t => t.id));
  s.nodes.forEach(n => { n.tags = n.tags.filter(t => tagIds.has(t)); });
  s.settings = { ...d.settings, ...(s.settings || {}) };
  const c = s.camera || {};
  s.camera = { x: Number.isFinite(+c.x) ? +c.x : d.camera.x, y: Number.isFinite(+c.y) ? +c.y : d.camera.y, z: clamp(Number.isFinite(+c.z) ? +c.z : 1, MIN_Z, MAX_Z) };
  delete s.exportedAt;
  return s;
}

let firstRun = false;
function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      firstRun = true;
      const s = defaultState(); const demo = demoData();
      s.nodes = demo.nodes; s.edges = demo.edges;
      return s;
    }
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    setTimeout(() => toast('No se pudo leer localStorage: ' + err.message, 'error', 6000), 300);
    firstRun = true;
    return defaultState();
  }
}

let state = loadState();
let cam = { ...state.camera };

function persist() {
  try {
    state.camera = { x: cam.x, y: cam.y, z: cam.z };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveStatus('Guardado');
  } catch (err) {
    const full = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    setSaveStatus('Sin guardar');
    toast(full ? 'localStorage está lleno: exporta un respaldo y reduce imágenes.' : 'No se pudo guardar: ' + err.message, 'error', 6000);
  }
}
const save = debounce(persist, 400);
const saveCam = debounce(persist, 900);
function setSaveStatus(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

/* --- Acceso rápido al modelo --- */
const nodeById = id => state.nodes.find(n => n.id === id);
const tagById = id => state.tags.find(t => t.id === id);
const edgeTypeById = id => state.edgeTypes.find(t => t.id === id);
const isContainer = n => !!n && n.type === 'software';
const childrenOf = id => state.nodes.filter(n => n.parentId === id);
const roots = () => state.nodes.filter(n => !n.parentId);
const edgesOf = id => state.edges.filter(e => e.from === id || e.to === id);
const sourceEdgeOf = id => state.edges.find(e => e.kind === 'source' && e.from === id);
const dsOf = id => state.edges.filter(e => e.kind === 'ds' && e.from === id).map(e => nodeById(e.to)).filter(Boolean);
const defaultBranchType = () => (edgeTypeById('et_feature') || state.edgeTypes[0] || {}).id || null;

function parentOf(n) { return n && n.parentId ? nodeById(n.parentId) : null; }
function rootOf(n) { let g = 0; while (n && n.parentId && g++ < 100) { const p = nodeById(n.parentId); if (!p) break; n = p; } return n; }
function depthOf(n) { let d = 0; while (n && n.parentId && d < 100) { n = nodeById(n.parentId); d++; } return d; }
/** ¿`aId` es ancestro de `bId`? */
function isAncestor(aId, bId) { let n = nodeById(bId), g = 0; while (n && n.parentId && g++ < 100) { if (n.parentId === aId) return true; n = nodeById(n.parentId); } return false; }
function ancestorsOf(id) { const out = []; let n = nodeById(id); while (n && n.parentId) { out.push(n.parentId); n = nodeById(n.parentId); if (out.length > 100) break; } return out; }
function descendantsOf(id, acc = []) { for (const c of childrenOf(id)) { acc.push(c.id); descendantsOf(c.id, acc); } return acc; }
/** Posición absoluta (mundo) de un nodo. */
function worldPos(n) { let x = n.x, y = n.y, p = parentOf(n), g = 0; while (p && g++ < 100) { x += p.x; y += p.y; p = parentOf(p); } return { x, y }; }
/** ¿La dependencia de DS cruza entre raíces distintas? */
const isExternalDs = e => { const a = nodeById(e.from), b = nodeById(e.to); return !!a && !!b && rootOf(a).id !== rootOf(b).id; };

