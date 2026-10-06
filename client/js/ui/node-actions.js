'use strict';
/* =========================================================
   15. Eliminar y duplicar
   ========================================================= */
async function deleteNodes(ids) {
  ids = ids.filter(nodeById); if (!ids.length) return;
  const set = new Set(ids);
  const inside = new Set(); ids.forEach(id => descendantsOf(id).forEach(d => { if (!set.has(d)) inside.add(d); }));
  const all = new Set([...set, ...inside]);
  const connected = state.edges.filter(e => all.has(e.from) || all.has(e.to));
  const orphanKits = state.nodes.filter(n => n.type === 'uikit' && !all.has(n.id) && state.edges.some(e => e.kind === 'source' && e.from === n.id && all.has(e.to)));
  // Opción de conservar el contenido: solo con una card, si tiene hijos y estos pueden vivir en el nuevo lugar
  let keep = null;
  if (ids.length === 1) {
    const n = nodeById(ids[0]); const kids = childrenOf(n.id);
    if (kids.length && (n.parentId || kids.every(isContainer))) keep = { node: n, kids };
  }
  const names = ids.length === 1 ? `"${nodeById(ids[0]).name}"` : `${ids.length} cards`;
  let message = `Vas a eliminar ${names}.`;
  if (inside.size) message += `\nContiene ${inside.size} elemento${inside.size > 1 ? 's' : ''} (features, DS o UI Kits).`;
  message += connected.length ? `\nHay ${connected.length} ${connected.length > 1 ? 'conexiones' : 'conexión'} involucrada${connected.length > 1 ? 's' : ''}.` : '\nNo hay conexiones involucradas.';
  if (keep) message += `\nPuedes conservar su contenido moviéndolo a ${keep.node.parentId ? `"${parentOf(keep.node).name}"` : 'la raíz'}.`;
  if (orphanKits.length) message += `\n⚠ ${orphanKits.length} UI Kit${orphanKits.length > 1 ? 's' : ''} (${orphanKits.map(k => k.name).join(', ')}) quedará${orphanKits.length > 1 ? 'n' : ''} sin fuente.`;
  const buttons = [{ label: 'Cancelar', value: '' }];
  if (keep) buttons.push({ label: 'Eliminar y conservar contenido', value: 'keep' });
  buttons.push({ label: inside.size ? 'Eliminar con todo su contenido' : connected.length ? 'Eliminar con sus conexiones' : 'Eliminar', value: 'all', kind: 'danger' });
  const choice = await confirmBox({ title: 'Eliminar card', message, buttons });
  if (!choice) return;
  pushHistory();
  let toDelete = all;
  if (choice === 'keep') {
    const n = keep.node; const newParent = n.parentId || null; const base = newParent ? worldPos(nodeById(newParent)) : { x: 0, y: 0 };
    for (const k of keep.kids) { const w = worldPos(k); k.parentId = newParent; k.x = w.x - base.x; k.y = w.y - base.y; if (!newParent) k.branchTypeId = null; else clampInside(k); }
    toDelete = set;
  }
  state.nodes = state.nodes.filter(n => !toDelete.has(n.id));
  state.edges = state.edges.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to));
  toDelete.forEach(id => sel.nodes.delete(id));
  renderAll(); save();
  toast(`${names.replace(/"/g, '')} eliminad${ids.length === 1 ? 'a' : 'as'}`);
}
function deleteSelection() {
  if (sel.edge) return deleteEdge(sel.edge);
  if (sel.nodes.size) deleteNodes(topLevelSelection());
}
function duplicateSelection() {
  const tops = topLevelSelection(); if (!tops.length) return;
  pushHistory();
  const map = new Map(); const copies = [];
  const cloneTree = (n, parentId) => {
    const c = { ...n, id: uid(), tags: [...n.tags], parentId, demo: false }; map.set(n.id, c.id); copies.push(c);
    childrenOf(n.id).forEach(k => cloneTree(k, c.id));
  };
  for (const id of tops) { const n = nodeById(id); cloneTree(n, n.parentId || null); const c = copies.find(x => x.id === map.get(id)); c.x += 24; c.y += 24; }
  state.nodes.push(...copies);
  for (const e of [...state.edges]) {
    const f = map.get(e.from), t = map.get(e.to);
    if (f && t) state.edges.push({ ...e, id: uid(), from: f, to: t, demo: false });
    else if (f) state.edges.push({ ...e, id: uid(), from: f, demo: false });
  }
  sel.nodes = new Set(tops.map(id => map.get(id))); sel.edge = null;
  renderAll(); save();
  toast(`${copies.length} card${copies.length > 1 ? 's' : ''} duplicada${copies.length > 1 ? 's' : ''}`);
}

