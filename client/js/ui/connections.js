/* =========================================================
   12. Conexiones y anidamiento: opciones, validación y alta
   ========================================================= */
import { $, uid, esc } from '../core/utils.js';
import {
  S, save, nodeById, isContainer, sourceEdgeOf, defaultBranchType, rootOf, isAncestor, worldPos,
  isExternalDs, typeName, kindLabel } from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { sel, nodeRect, freeSpot } from '../canvas/render-nodes.js';
import { renderAll } from '../canvas/selection.js';
import { openPopover, closePopover } from './popover.js';
import { toast } from './theme.js';
import { t } from '../core/i18n.js'; // P15
/** ¿Agregar la arista `kind` from→to crearía un ciclo? */
export function wouldCycle(kind, from, to, ignoreId) {
  const stack = [to], seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === from) return true;
    for (const e of S.state.edges) if (e.kind === kind && e.from === id && e.id !== ignoreId && !seen.has(e.to)) { seen.add(e.to); stack.push(e.to); }
  }
  return false;
}
export const canNest = (childId, parentId) => childId !== parentId && isContainer(nodeById(parentId)) && !isAncestor(childId, parentId) && nodeById(childId).parentId !== parentId;

export function connectionOptions(aId, bId) {
  const a = nodeById(aId), b = nodeById(bId); const opts = [];
  const dsish = t => t === 'ds' || t === 'uikit';
  if (a.type === 'software' && b.type === 'software') {
    if (canNest(b.id, a.id)) opts.push({ kind: 'nest', child: b.id, parent: a.id, label: t('Anidar {child} dentro de {parent}', { child: b.name, parent: a.name }) });
    if (canNest(a.id, b.id)) opts.push({ kind: 'nest', child: a.id, parent: b.id, label: t('Anidar {child} dentro de {parent}', { child: a.name, parent: b.name }) });
  }
  if (a.type === 'software' && dsish(b.type)) opts.push({ kind: 'ds', from: a.id, to: b.id, label: t('{a} usa {b}', { a: a.name, b: b.name }) });
  if (dsish(a.type) && b.type === 'software') opts.push({ kind: 'ds', from: b.id, to: a.id, label: t('{a} usa {b}', { a: b.name, b: a.name }) });
  if (a.type === 'uikit') opts.push({ kind: 'source', from: a.id, to: b.id, label: t('{a} deriva de {b} (fuente)', { a: a.name, b: b.name }) });
  if (b.type === 'uikit') opts.push({ kind: 'source', from: b.id, to: a.id, label: t('{a} deriva de {b} (fuente)', { a: b.name, b: a.name }) });
  return opts;
}
export function proposeConnection(aId, bId, x, y) {
  const opts = connectionOptions(aId, bId);
  if (!opts.length) return toast(t('Dos {ds} no se conectan directamente: usa {uikit} como puente.', { ds: typeName('ds'), uikit: typeName('uikit') }), 'error', 4000);
  if (opts.length === 1 && opts[0].kind !== 'nest') return addEdge(opts[0]);
  openPopover(x, y, el => {
    el.innerHTML = `<div class="menu-title">${t('¿Qué relación creamos?')}</div>`;
    let typeSel = null;
    if (opts.some(o => o.kind === 'nest')) {
      const f = document.createElement('div'); f.className = 'menu-field';
      f.innerHTML = `<label>${t('Tipo de ramificación (al anidar)')}</label><select>${S.state.branchTypes.map(t => `<option value="${t.id}" ${t.id === defaultBranchType() ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
      typeSel = f.querySelector('select'); el.appendChild(f);
    }
    for (const o of opts) {
      const b = document.createElement('button'); b.className = 'menu-item';
      const ico = o.kind === 'nest' ? '⊂' : o.kind === 'ds' ? '◈' : '⋯';
      b.innerHTML = `<span class="ico">${ico}</span><span>${esc(o.label)}</span>`;
      b.addEventListener('click', () => { closePopover(); o.kind === 'nest' ? nestNode(o.child, o.parent, typeSel ? typeSel.value : null) : addEdge(o); });
      el.appendChild(b);
    }
  });
}
/** Anida un software dentro de otro, colocándolo en un hueco libre. */
export function nestNode(childId, parentId, typeId) {
  if (!canNest(childId, parentId)) return toast(t('No se puede anidar ahí: crearía un ciclo'), 'error');
  pushHistory();
  const n = nodeById(childId); const spot = freeSpot(parentId);
  n.parentId = parentId; n.x = spot.x; n.y = spot.y; n.branchTypeId = typeId || n.branchTypeId || defaultBranchType();
  renderAll(); save();
  toast(t('{name} ahora vive dentro de {parent}', { name: n.name, parent: nodeById(parentId).name }));
}
export function moveToRoot(id) {
  const n = nodeById(id); if (!n || !n.parentId) return;
  if (!isContainer(n)) return toast(t('{ds} y {uikit} deben vivir dentro de {software}', { ds: typeName('ds'), uikit: typeName('uikit'), software: typeName('software') }), 'error');
  pushHistory();
  const w = worldPos(n); const pr = nodeRect(rootOf(n));
  n.parentId = null; n.branchTypeId = null; n.x = pr.x + pr.w + 80; n.y = w.y;
  renderAll(); save(); toast(t('{name} ahora es {software} raíz (Main instance)', { name: n.name, software: typeName('software') }));
}
/** Alta de arista con validaciones. Devuelve true si se agregó. */
export function addEdge({ kind, from, to }, silent) {
  if (from === to) return false;
  if (S.state.edges.some(e => e.kind === kind && e.from === from && e.to === to)) { if (!silent) toast(t('Esa conexión ya existe')); return false; }
  if (kind === 'source' && wouldCycle(kind, from, to)) { toast(t('No se permite: crearía un ciclo de fuentes'), 'error'); return false; }
  pushHistory();
  let note = '';
  if (kind === 'source') { const prev = sourceEdgeOf(from); if (prev) { S.state.edges = S.state.edges.filter(e => e !== prev); note = t(' (se reemplazó la fuente anterior)'); } }
  const e = { id: uid(), kind, from, to, demo: false };
  S.state.edges.push(e);
  renderAll(); save();
  if (!silent) toast((kind === 'ds' && isExternalDs(e) ? t('Dependencia externa creada: {ds} viene de otro {software}', { ds: typeName('ds'), software: typeName('software') }) : t('{kind} creada', { kind: t(kindLabel(kind)) })) + note);
  return true;
}
export function deleteEdge(id) {
  const e = S.state.edges.find(x => x.id === id); if (!e) return;
  pushHistory();
  S.state.edges = S.state.edges.filter(x => x.id !== id);
  if (sel.edge === id) sel.edge = null;
  renderAll(); save();
  if (e.kind === 'source') toast(t('{uikit} quedó sin fuente: asígnale una desde su editor.', { uikit: typeName('uikit') }), 'error', 4000);
}

