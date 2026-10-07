/* Normalización del documento de página (v1/v2/v3 → v3). Compartido servidor/cliente:
   sin imports, sin DOM, sin Node. El cliente lo importa vía symlink client/js/core/normalize.js. */
export const TYPES = ['software', 'ds', 'uikit'];
export const EDGE_KINDS = ['ds', 'source'];
export const TAG_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const NODE_STATUS = ['active', 'draft', 'deprecated', 'archived'];
export const PAD = 16;              // margen interno de los contenedores
export const HEAD_H = 90;           // alto mínimo de cabecera al migrar v1
export const MIN_Z = 0.1, MAX_Z = 4;
export const DOC_VERSION = 3;

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const str = (v, max, d = '') => String(v ?? d).slice(0, max);

export function defaultTags() {
  return [
    { id: 't_core', name: 'Core', color: 'blue' }, { id: 't_web', name: 'Web', color: 'purple' },
    { id: 't_mobile', name: 'Mobile', color: 'green' }, { id: 't_legacy', name: 'Legacy', color: 'brown' },
    { id: 't_interno', name: 'Interno', color: 'gray' }, { id: 't_pagos', name: 'Pagos', color: 'yellow' },
  ];
}
export function defaultBranchTypes() {
  return [
    { id: 'et_feature', name: 'Feature', color: 'blue' }, { id: 'et_fork', name: 'Fork', color: 'gray' },
    { id: 'et_mobile', name: 'Versión mobile', color: 'green' }, { id: 'et_desktop', name: 'Versión desktop', color: 'purple' },
    { id: 'et_geo', name: 'Geografía/Región', color: 'orange' }, { id: 'et_parent', name: 'Software padre/hijo', color: 'brown' },
  ];
}
export function defaultPage(page = {}) {
  return { id: str(page.id, 64, 'p_default'), name: str(page.name, 120, 'Árbol principal') || 'Árbol principal', description: str(page.description, 500), visibility: page.visibility === 'cells' ? 'cells' : 'org', status: ['archived', 'deleted'].includes(page.status) ? page.status : 'active', version: Math.max(0, Math.trunc(num(page.version))) };
}
/** Documento vacío v3 (mismo shape que el estado del cliente). */
export function defaultDocument(page) {
  return {
    version: DOC_VERSION, page: defaultPage(page), nodes: [], edges: [], tags: defaultTags(), branchTypes: defaultBranchTypes(),
    settings: { theme: null, snap: true, minimap: true, grid: true, tool: 'select' },
    camera: { x: 80, y: 60, z: 0.9 },
  };
}
/** ¿Respaldo v1 (ramificaciones como aristas `branch`)? */
export const isLegacyV1 = raw => !!raw && Array.isArray(raw.edges) && raw.edges.some(e => e && e.kind === 'branch');

const idList = (v, max = 50) => (Array.isArray(v) ? [...new Set(v.filter(x => x != null && x !== '').map(x => String(x).slice(0, 64)))].slice(0, max) : []);
function normalizeNode(n) {
  let docs = Array.isArray(n.docs) ? n.docs.filter(d => d && typeof d.url === 'string' && d.url.trim()).slice(0, 20).map(d => ({ label: str(d.label, 80), url: str(d.url.trim(), 2048) })) : [];
  const legacyUrl = n.docUrl ?? n.doc_url; // F3: campo legado → docs[0]
  if (!docs.length && typeof legacyUrl === 'string' && legacyUrl.trim()) docs = [{ label: 'Documentación', url: str(legacyUrl.trim(), 2048) }];
  return {
    id: String(n.id), type: TYPES.includes(n.type) ? n.type : 'software', name: str(n.name, 120, 'Sin nombre') || 'Sin nombre',
    description: str(n.description, 140), image: typeof n.image === 'string' && n.image.startsWith('data:image') ? n.image : null, imageId: n.imageId ? String(n.imageId) : null,
    tags: Array.isArray(n.tags) ? n.tags.map(String).slice(0, 50) : [], owner: str(n.owner, 80), ownerUserId: n.ownerUserId ? String(n.ownerUserId) : null,
    parentId: n.parentId ? String(n.parentId) : null, branchTypeId: n.branchTypeId ? String(n.branchTypeId) : null,
    x: num(n.x), y: num(n.y), w: Math.max(0, num(n.w)), h: Math.max(0, num(n.h)), demo: !!n.demo,
    notes: str(n.notes, 4000), docs, visibility: ['org', 'cells'].includes(n.visibility) ? n.visibility : 'inherit',
    status: NODE_STATUS.includes(n.status) ? n.status : 'active',
    cellIds: idList(n.cellIds), assigneeIds: idList(n.assigneeIds),
  };
}
const normalizeColorList = (list, fallback, cycle) => (Array.isArray(list) && list.length
  ? list.filter(t => t && t.id).map((t, i) => ({ id: String(t.id), name: str(t.name, 60), color: TAG_COLORS.includes(t.color) ? t.color : (cycle ? TAG_COLORS[i % TAG_COLORS.length] : 'gray') }))
  : fallback);

/** Sanea un documento importado/leído (v1, v2 o v3) y devuelve un v3 íntegro. `page` sobreescribe metadatos. */
export function normalizeDocument(raw, page) {
  const d = defaultDocument(page);
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = { ...d, page: defaultPage({ ...(r.page || {}), ...(page || {}) }) };
  s.nodes = Array.isArray(r.nodes) ? r.nodes.filter(n => n && n.id).map(normalizeNode) : [];
  const byId = id => s.nodes.find(n => n.id === id);
  s.tags = normalizeColorList(r.tags, d.tags, false);
  s.branchTypes = normalizeColorList(r.branchTypes ?? r.edgeTypes, d.branchTypes, true);
  if (!s.branchTypes.length) s.branchTypes = d.branchTypes;
  const rawEdges = Array.isArray(r.edges) ? r.edges.filter(e => e && e.id && e.from !== e.to) : [];

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
      if (!host) { host = normalizeNode({ id: uid(), type: 'software', name: 'Organización', description: 'Contenedor creado al migrar.' }); s.nodes.unshift(host); worldOld.set(host.id, { x: 0, y: 0 }); }
      n.parentId = host.id;
    }
    const worldOf = id => worldOld.get(id) || { x: 0, y: 0 };
    for (const n of s.nodes) if (n.parentId && worldOld.has(n.id)) { const pw = worldOf(n.parentId), w = worldOf(n.id); n.x = Math.max(PAD, w.x - pw.x); n.y = Math.max(HEAD_H, w.y - pw.y); }
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
  const etIds = new Set(s.branchTypes.map(t => t.id));
  for (const n of s.nodes) {
    if (n.parentId && n.type === 'software' && !etIds.has(n.branchTypeId)) n.branchTypeId = s.branchTypes[0].id;
    n.visibility = n.parentId ? 'inherit' : (n.visibility === 'cells' ? 'cells' : 'org');
    if (n.visibility !== 'cells') n.cellIds = [];
  }

  const ids2 = new Set(s.nodes.map(n => n.id));
  const seenEdge = new Set();
  s.edges = rawEdges.filter(e => EDGE_KINDS.includes(e.kind) && ids2.has(e.from) && ids2.has(e.to))
    .filter(e => e.kind === 'ds' ? byId(e.from).type === 'software' && byId(e.to).type !== 'software' : byId(e.from).type === 'uikit')
    .filter(e => { const k = `${e.kind}|${e.from}|${e.to}`; if (seenEdge.has(k)) return false; seenEdge.add(k); return true; })
    .map(e => ({ id: String(e.id), kind: e.kind, from: String(e.from), to: String(e.to), demo: !!e.demo }));
  const tagIds = new Set(s.tags.map(t => t.id));
  s.nodes.forEach(n => { n.tags = n.tags.filter(t => tagIds.has(t)); });
  const st = r.settings || {};
  s.settings = { theme: ['light', 'dark'].includes(st.theme) ? st.theme : null, snap: st.snap !== false, minimap: st.minimap !== false, grid: st.grid !== false, tool: st.tool === 'hand' ? 'hand' : 'select' };
  const c = r.camera || {};
  s.camera = { x: num(c.x, d.camera.x), y: num(c.y, d.camera.y), z: clamp(num(c.z, 1), MIN_Z, MAX_Z) };
  return s;
}
