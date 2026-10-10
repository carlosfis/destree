/* =========================================================
   15. Eliminar y duplicar
   ========================================================= */
import { $, uid } from '../core/utils.js';
import {
  S, save, nodeById, isContainer, childrenOf, parentOf, descendantsOf, worldPos, typeName } from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { sel, clampInside } from '../canvas/render-nodes.js';
import { topLevelSelection, renderAll } from '../canvas/selection.js';
import { deleteEdge } from './connections.js';
import { confirmBox } from './dialogs.js';
import { toast } from './theme.js';
import { t } from '../core/i18n.js'; // P15
export async function deleteNodes(ids) {
  ids = ids.filter(nodeById); if (!ids.length) return;
  const set = new Set(ids);
  const inside = new Set(); ids.forEach(id => descendantsOf(id).forEach(d => { if (!set.has(d)) inside.add(d); }));
  const all = new Set([...set, ...inside]);
  const connected = S.state.edges.filter(e => all.has(e.from) || all.has(e.to));
  const orphanKits = S.state.nodes.filter(n => n.type === 'uikit' && !all.has(n.id) && S.state.edges.some(e => e.kind === 'source' && e.from === n.id && all.has(e.to)));
  // Opción de conservar el contenido: solo con una card, si tiene hijos y estos pueden vivir en el nuevo lugar
  let keep = null;
  if (ids.length === 1) {
    const n = nodeById(ids[0]); const kids = childrenOf(n.id);
    if (kids.length && (n.parentId || kids.every(isContainer))) keep = { node: n, kids };
  }
  const TN = { software: typeName('software'), ds: typeName('ds'), uikit: typeName('uikit') };
  const names = ids.length === 1 ? `"${nodeById(ids[0]).name}"` : t('{n} cards', { n: ids.length });
  let message = t('Vas a eliminar {names}.', { names });
  if (inside.size) message += '\n' + t(inside.size > 1 ? 'Contiene {n} elementos ({software}, {ds} o {uikit}).' : 'Contiene {n} elemento ({software}, {ds} o {uikit}).', { n: inside.size, ...TN });
  message += '\n' + (connected.length ? t(connected.length > 1 ? 'Hay {n} conexiones involucradas.' : 'Hay {n} conexión involucrada.', { n: connected.length }) : t('No hay conexiones involucradas.'));
  if (keep) message += '\n' + t('Puedes conservar su contenido moviéndolo a {where}.', { where: keep.node.parentId ? `"${parentOf(keep.node).name}"` : t('la raíz') });
  if (orphanKits.length) message += '\n⚠ ' + t(orphanKits.length > 1 ? '{n} {uikit} ({names}) quedarán sin fuente.' : '{n} {uikit} ({names}) quedará sin fuente.', { n: orphanKits.length, uikit: TN.uikit, names: orphanKits.map(k => k.name).join(', ') });
  const buttons = [{ label: t('Cancelar'), value: '' }];
  if (keep) buttons.push({ label: t('Eliminar y conservar contenido'), value: 'keep' });
  buttons.push({ label: inside.size ? t('Eliminar con todo su contenido') : connected.length ? t('Eliminar con sus conexiones') : t('Eliminar'), value: 'all', kind: 'danger' });
  const choice = await confirmBox({ title: t('Eliminar card'), message, buttons });
  if (!choice) return;
  pushHistory();
  let toDelete = all;
  if (choice === 'keep') {
    const n = keep.node; const newParent = n.parentId || null; const base = newParent ? worldPos(nodeById(newParent)) : { x: 0, y: 0 };
    for (const k of keep.kids) { const w = worldPos(k); k.parentId = newParent; k.x = w.x - base.x; k.y = w.y - base.y; if (!newParent) k.branchTypeId = null; else clampInside(k); }
    toDelete = set;
  }
  S.state.nodes = S.state.nodes.filter(n => !toDelete.has(n.id));
  S.state.edges = S.state.edges.filter(e => !toDelete.has(e.from) && !toDelete.has(e.to));
  toDelete.forEach(id => sel.nodes.delete(id));
  renderAll(); save();
  toast(t(ids.length === 1 ? '{names} eliminada' : '{names} eliminadas', { names: names.replace(/"/g, '') }));
}
export function deleteSelection() {
  if (sel.edge) return deleteEdge(sel.edge);
  if (sel.nodes.size) deleteNodes(topLevelSelection());
}
export function duplicateSelection() {
  const tops = topLevelSelection(); if (!tops.length) return;
  pushHistory();
  const map = new Map(); const copies = [];
  const cloneTree = (n, parentId) => {
    const c = { ...n, id: uid(), tags: [...n.tags], parentId, demo: false }; map.set(n.id, c.id); copies.push(c);
    childrenOf(n.id).forEach(k => cloneTree(k, c.id));
  };
  for (const id of tops) { const n = nodeById(id); cloneTree(n, n.parentId || null); const c = copies.find(x => x.id === map.get(id)); c.x += 24; c.y += 24; }
  S.state.nodes.push(...copies);
  for (const e of [...S.state.edges]) {
    const f = map.get(e.from), t = map.get(e.to);
    if (f && t) S.state.edges.push({ ...e, id: uid(), from: f, to: t, demo: false });
    else if (f) S.state.edges.push({ ...e, id: uid(), from: f, demo: false });
  }
  sel.nodes = new Set(tops.map(id => map.get(id))); sel.edge = null;
  renderAll(); save();
  toast(t(copies.length > 1 ? '{n} cards duplicadas' : '{n} card duplicada', { n: copies.length }));
}

