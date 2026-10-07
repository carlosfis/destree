// F3: visibilidad server-side (PLAN §3). admin/head ven todo; designer solo raíces org, de sus células o donde está asignado/responsable.
// Un solo recorrido: visibilidad por raíz → propagación a descendientes → filtrado de aristas (hasExternalRefs).

/** ctx = { role, userId, cellIds:[] }. ¿Aplica filtro? */
export const needsFilter = ctx => !!ctx && ctx.role === 'designer';

/** Regla 2: página visible para designer si visibility=org ∨ page_cells ∩ cells(user) ∨ asignado a algún nodo de la página. */
export function pageVisibleFor(db, page, ctx) {
  if (!needsFilter(ctx)) return true;
  if (page.visibility !== 'cells') return true;
  const cells = new Set(ctx.cellIds || []);
  for (const r of db.prepare('SELECT cell_id FROM page_cells WHERE page_id = ?').all(page.id)) if (cells.has(r.cell_id)) return true;
  if (db.prepare('SELECT 1 FROM node_assignees WHERE page_id = ? AND user_id = ? LIMIT 1').get(page.id, ctx.userId)) return true;
  if (db.prepare('SELECT 1 FROM nodes WHERE page_id = ? AND owner_user_id = ? LIMIT 1').get(page.id, ctx.userId)) return true;
  return false;
}

/** Reglas 3, 4 y 6 sobre un page-document v3 (nodos con cellIds/assigneeIds/ownerUserId). Devuelve un documento nuevo. */
export function filterDocumentForUser(doc, ctx) {
  if (!needsFilter(ctx)) return doc;
  const cells = new Set(ctx.cellIds || []), me = ctx.userId;
  const byId = new Map(doc.nodes.map(n => [n.id, n]));
  const rootOf = new Map();
  const findRoot = n => {
    if (rootOf.has(n.id)) return rootOf.get(n.id);
    const chain = []; let cur = n, g = 0;
    while (cur && cur.parentId && byId.has(cur.parentId) && g++ < 1000 && !rootOf.has(cur.id)) { chain.push(cur); cur = byId.get(cur.parentId); }
    const root = rootOf.get(cur.id) || cur.id;
    rootOf.set(cur.id, root); for (const c of chain) rootOf.set(c.id, root);
    return root;
  };
  const involved = n => (n.assigneeIds || []).includes(me) || n.ownerUserId === me;
  const visibleRoots = new Set();
  for (const n of doc.nodes) { // una pasada: raíz org/células propias, o cualquier nodo del subárbol con el usuario
    const root = findRoot(n);
    if (visibleRoots.has(root)) continue;
    const r = byId.get(root);
    if (r.visibility !== 'cells' || (r.cellIds || []).some(c => cells.has(c)) || involved(n)) visibleRoots.add(root);
  }
  const nodes = doc.nodes.filter(n => visibleRoots.has(rootOf.get(n.id))).map(n => ({ ...n, hasExternalRefs: false }));
  const keep = new Map(nodes.map(n => [n.id, n]));
  const edges = [];
  for (const e of doc.edges) {
    const a = keep.get(e.from), b = keep.get(e.to);
    if (a && b) edges.push(e);
    else { if (a) a.hasExternalRefs = true; if (b) b.hasExternalRefs = true; }
  }
  return { ...doc, nodes, edges };
}
