/* =========================================================
   F6a. Historial de versiones de la página: lista, vista previa (solo lectura), diff resumido, crear manual, restaurar
   ========================================================= */
import { $, esc } from '../core/utils.js';
import { S, typeName } from '../core/state.js';
import * as api from '../core/api.js';
import { toast } from '../ui/theme.js';
import { confirmBox, promptBox } from '../ui/dialogs.js';
import { editorDialog } from '../ui/card-editor.js';

const has = p => !!S.session && S.session.permissions.includes(p);
const fmt = s => (s ? new Date(s).toLocaleString() : '—');
const REASON = { auto: 'auto', manual: 'manual', restore: 'restauración', import: 'importación', archive: 'archivado', delete: 'borrado' };
const kb = n => `${(n / 1024).toFixed(1)} KB`;

export async function openVersionsPanel() {
  if (!S.pageId || S.offline) return toast('El historial requiere servidor', 'error');
  let versions = [];
  try { versions = await api.listVersions(S.pageId); } catch (err) { return toast(err.message, 'error', 5000); }
  editorDialog.innerHTML = `<div class="dialog-inner node-view versions">
    <header><h2>Historial · ${esc(S.state.page.name)}</h2><button type="button" class="icon-btn" data-cancel>✕</button></header>
    <div class="dialog-body">
      <div class="inline-actions">${has('versions.write') ? '<button class="btn primary" id="verManual">＋ Versión manual</button>' : ''}<span class="hint">Versión actual: ${S.version}. Las automáticas se crean al guardar (se funden en 5 min) y se conservan las últimas; manuales, restauraciones, importaciones y archivados no se purgan.</span></div>
      ${versions.length ? `<ul class="ver-list">${versions.map(v => `<li data-n="${v.number}"><div class="ver-head"><b>v${v.number}</b><span class="chip tag-${v.reason === 'auto' ? 'gray' : v.reason === 'manual' ? 'blue' : 'orange'}">${esc(REASON[v.reason] || v.reason)}</span>${v.label ? `<span class="ver-label">${esc(v.label)}</span>` : ''}<span class="url">${esc(v.createdByName || '—')} · ${esc(fmt(v.createdAt))} · ${kb(v.size)}</span>
          <span class="ver-actions"><button class="btn" data-view>Ver</button><button class="btn" data-diff>Cambios</button>${has('versions.write') ? '<button class="btn" data-restore>Restaurar</button>' : ''}</span></div><div class="ver-detail" hidden></div></li>`).join('')}</ul>` : '<div class="empty">Aún no hay versiones: se crean al guardar cambios.</div>'}
    </div>
    <footer><button type="button" class="btn" data-cancel>Cerrar</button></footer></div>`;
  editorDialog.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => editorDialog.close()));
  $('#verManual', editorDialog)?.addEventListener('click', async () => {
    const label = await promptBox({ title: 'Versión manual', label: 'Etiqueta (opcional)', okLabel: 'Crear' }); if (label === null) return;
    try { await api.createVersion(S.pageId, label); toast('Versión creada'); openVersionsPanel(); } catch (err) { toast(err.message, 'error', 5000); }
  });
  $('.ver-list', editorDialog)?.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const li = b.closest('li'), n = Number(li.dataset.n), detail = li.querySelector('.ver-detail');
    if (b.hasAttribute('data-view')) { detail.hidden = false; detail.innerHTML = '<div class="empty">Cargando…</div>'; try { detail.innerHTML = previewHTML((await api.getVersion(S.pageId, n)).document); } catch (err) { detail.innerHTML = `<div class="empty">${esc(err.message)}</div>`; } }
    if (b.hasAttribute('data-diff')) { detail.hidden = false; detail.innerHTML = '<div class="empty">Comparando…</div>'; try { detail.innerHTML = diffHTML((await api.diffVersions(S.pageId, n, 'current')).diff, n); } catch (err) { detail.innerHTML = `<div class="empty">${esc(err.message)}</div>`; } }
    if (b.hasAttribute('data-restore')) {
      const ok = await confirmBox({ title: `Restaurar v${n}`, message: 'El contenido actual se sustituirá por el de esa versión. Antes se conserva una versión de restauración, así que puedes volver atrás.', buttons: [{ label: 'Cancelar', value: '' }, { label: 'Restaurar', value: 'ok', kind: 'primary' }] });
      if (!ok) return;
      try { await api.restoreVersion(S.pageId, n); editorDialog.close(); toast(`Restaurada v${n}`); document.dispatchEvent(new CustomEvent('destree:load-page', { detail: { pageId: S.pageId } })); } catch (err) { toast(err.message, 'error', 5000); }
    }
  });
  editorDialog.showModal();
}
/** Vista previa solo lectura: raíces con sus hijos (sin canvas). */
function previewHTML(doc) {
  const kids = id => doc.nodes.filter(n => n.parentId === id);
  const item = (n, depth) => `<li style="margin-left:${depth * 14}px"><span class="type-badge">${esc(typeName(n.type))}</span> ${esc(n.name)}${n.description ? `<span class="url">${esc(n.description)}</span>` : ''}</li>${kids(n.id).map(k => item(k, depth + 1)).join('')}`;
  const roots = doc.nodes.filter(n => !n.parentId);
  return `<div class="hint">${doc.nodes.length} cards · ${doc.edges.length} conexiones · ${doc.tags.length} etiquetas</div><ul class="ver-tree">${roots.map(r => item(r, 0)).join('') || '<li class="empty">Sin cards.</li>'}</ul>`;
}
function diffHTML(d, n) {
  if (d.same) return `<div class="hint">v${n} es idéntica a la versión actual.</div>`;
  const list = (title, arr, f) => (arr.length ? `<div><b>${title}</b> ${arr.map(f).join(', ')}</div>` : '');
  return `<div class="ver-diff"><div class="hint">De v${n} a la actual:</div>
    ${list(`+${d.nodes.added.length} nuevas:`, d.nodes.added, x => esc(x.name))}${list(`−${d.nodes.removed.length} eliminadas:`, d.nodes.removed, x => esc(x.name))}
    ${list(`~${d.nodes.changed.length} modificadas:`, d.nodes.changed, x => `${esc(x.name)} <span class="url">(${esc(x.fields.join(', '))})</span>`)}
    ${d.nodes.moved ? `<div><b>${d.nodes.moved}</b> solo movidas</div>` : ''}
    ${d.edges.added.length || d.edges.removed.length ? `<div><b>Conexiones:</b> +${d.edges.added.length} / −${d.edges.removed.length}</div>` : ''}
    ${list('Etiquetas nuevas:', d.tags.added, esc)}${list('Etiquetas eliminadas:', d.tags.removed, esc)}</div>`;
}
