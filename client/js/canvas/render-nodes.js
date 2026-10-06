'use strict';
/* =========================================================
   5. Renderizado: nodos (contenedores anidados y hojas)
   ---------------------------------------------------------
   El DOM refleja la jerarquía: el elemento de un hijo vive dentro del
   elemento de su contenedor, así que su transform es relativo al padre.
   El tamaño de cada contenedor se calcula de abajo hacia arriba para
   envolver siempre a su contenido (nunca recorta).
   ========================================================= */
const sel = { nodes: new Set(), edge: null };
const sizes = new Map();     // id -> { w, h, headH? } tamaño efectivo
const measured = new Map();  // id -> alto medido: card hoja completa o cabecera de contenedor
const nodeEls = new Map();   // id -> elemento .node
const edgeEls = new Map();   // id -> <g class="edge">

/** Rectángulo de mundo de un nodo. */
function nodeRect(n) {
  const p = worldPos(n), s = sizes.get(n.id) || { w: isContainer(n) ? CTR_MIN_W : CARD_W, h: 120 };
  return { x: p.x, y: p.y, w: s.w, h: s.h, cx: p.x + s.w / 2, cy: p.y + s.h / 2 };
}
/** Rectángulo al que se anclan las aristas: la cabecera en contenedores, la card completa en hojas. */
function anchorRect(n) {
  const r = nodeRect(n);
  if (!isContainer(n)) return r;
  const hh = (sizes.get(n.id) || {}).headH || 60;
  return { x: r.x, y: r.y, w: r.w, h: hh, cx: r.cx, cy: r.y + hh / 2 };
}

function commonHTML(n) {
  const tags = n.tags.map(tagById).filter(Boolean);
  let foot = '';
  if (n.owner) foot += `<span class="owner">${esc(n.owner)}</span>`;
  if (n.type === 'software') {
    const ds = state.edges.filter(e => e.kind === 'ds' && e.from === n.id).map(e => ({ n: nodeById(e.to), ext: isExternalDs(e) })).filter(x => x.n);
    foot += ds.length
      ? ds.map(x => `<span class="ds-ref ${x.ext ? 'ext' : ''}" title="${x.ext ? 'Usa un DS de otro software' : 'Usa su propio DS'}">${esc(x.n.name)}</span>`).join('')
      : `<span class="ds-ref none">Sin DS</span>`;
    const kids = childrenOf(n.id).length;
    if (kids) foot += `<span class="count-ref">${kids} elemento${kids > 1 ? 's' : ''}</span>`;
  }
  if (n.type !== 'software') {
    const ext = state.edges.filter(e => e.kind === 'ds' && e.to === n.id && isExternalDs(e)).map(e => nodeById(e.from)).filter(Boolean);
    if (ext.length) foot += `<span class="ext-ref" title="Este ${n.type === 'ds' ? 'DS' : 'UI Kit'} nació en una feature y lo consume otro aplicativo">⇢ ${esc(ext.map(x => x.name).join(', '))}</span>`;
  }
  if (n.type === 'uikit') {
    const se = sourceEdgeOf(n.id); const src = se && nodeById(se.to);
    foot += src ? `<span class="src-ref" title="Fuente">↗ ${esc(src.name)}</span>` : `<span class="src-ref none">⚠ Sin fuente</span>`;
  }
  return {
    name: `<div class="card-name">${esc(n.name)}</div>`,
    desc: n.description ? `<div class="card-desc">${esc(n.description)}</div>` : '',
    tags: tags.length ? `<div class="card-tags">${tags.map(t => `<span class="chip tag-${t.color}">${esc(t.name)}</span>`).join('')}</div>` : '',
    foot: foot ? `<div class="card-foot">${foot}</div>` : '',
  };
}
const PORTS = `<div class="port port-t" data-port="t"></div><div class="port port-r" data-port="r"></div><div class="port port-b" data-port="b"></div><div class="port port-l" data-port="l"></div>`;

function leafHTML(n) {
  const c = commonHTML(n);
  return `${n.image ? `<div class="card-img"><img src="${n.image}" alt="" draggable="false"></div>` : ''}
    <div class="card-body">
      <div class="card-head"><span class="type-badge">${TYPE_META[n.type].label}</span><button class="icon-btn card-menu" data-action="menu" title="Opciones">⋯</button></div>
      ${c.name}${c.desc}${c.tags}${c.foot}
    </div>${PORTS}`;
}
function headHTML(n) {
  const c = commonHTML(n);
  const bt = n.parentId ? edgeTypeById(n.branchTypeId) : null;
  return `<div class="head-top">
      <span class="type-badge">${n.parentId ? 'Software' : 'Software · Raíz'}</span>
      ${bt ? `<span class="chip tag-${bt.color}" title="Tipo de ramificación">↳ ${esc(bt.name)}</span>` : (n.parentId ? '<span class="chip tag-gray">↳ sin tipo</span>' : '')}
      <span class="spacer"></span>
      <span class="head-actions"><button class="icon-btn" data-action="add" title="Agregar dentro">＋</button><button class="icon-btn" data-action="menu" title="Opciones">⋯</button></span>
    </div>
    <div class="head-main">${n.image ? `<img class="thumb" src="${n.image}" alt="" draggable="false">` : ''}<div class="texts">${c.name}${c.desc}</div></div>
    ${c.tags}${c.foot}${PORTS}`;
}

function renderNodes() {
  const seen = new Set();
  const ordered = [...state.nodes].sort((a, b) => depthOf(a) - depthOf(b)); // padres antes que hijos
  for (const n of ordered) {
    seen.add(n.id);
    let el = nodeEls.get(n.id);
    const ctr = isContainer(n);
    if (el && el._ctr !== ctr) { el.remove(); nodeEls.delete(n.id); el = null; }
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = n.id; el._ctr = ctr;
      if (ctr) {
        const head = document.createElement('div'); head.className = 'ctr-head';
        const empty = document.createElement('div'); empty.className = 'ctr-empty'; empty.textContent = 'Vacío: arrastra aquí una feature, un DS o un UI Kit, o usa ＋';
        const rs = document.createElement('div'); rs.className = 'resize'; rs.title = 'Redimensionar';
        el.append(head, empty, rs); el._head = head; el._empty = empty;
      }
      nodeEls.set(n.id, el);
    }
    const parentEl = (n.parentId && nodeEls.get(n.parentId)) || nodesLayer;
    if (el.parentElement !== parentEl) parentEl.appendChild(el);
    const html = ctr ? headHTML(n) : leafHTML(n);
    if (el._html !== html) { (ctr ? el._head : el).innerHTML = html; el._html = html; }
    if (ctr) el._empty.hidden = childrenOf(n.id).length > 0;
    el.className = ctr ? `node ctr ${n.parentId ? 'nested' : 'root'} type-software` : `node leaf type-${n.type}`;
    el.style.transform = `translate(${n.x}px, ${n.y}px)`;
  }
  for (const [id, el] of nodeEls) if (!seen.has(id)) { el.remove(); nodeEls.delete(id); sizes.delete(id); measured.delete(id); }
  // Dos pasadas: el alto de la cabecera depende del ancho final del contenedor
  measureDOM(); computeSizes(); applySizes();
  measureDOM(); computeSizes(); applySizes();
}
function measureDOM() {
  for (const [id, el] of nodeEls) {
    const n = nodeById(id); if (!n) continue;
    measured.set(id, isContainer(n) ? (el._head.offsetHeight || 60) : (el.offsetHeight || 120));
  }
}
/** Calcula tamaños de abajo hacia arriba. `getPos` permite evaluar posiciones hipotéticas (auto-layout). */
function computeSizes(getPos = n => n, out = sizes) {
  const visit = n => {
    if (!isContainer(n)) { const s = { w: CARD_W, h: measured.get(n.id) || 120 }; out.set(n.id, s); return s; }
    let maxR = 0, maxB = 0;
    for (const k of childrenOf(n.id)) { const s = visit(k), p = getPos(k); maxR = Math.max(maxR, p.x + s.w); maxB = Math.max(maxB, p.y + s.h); }
    const headH = measured.get(n.id) || 60;
    const s = { w: Math.max(CTR_MIN_W, n.w || 0, maxR + PAD), h: Math.max(headH + CTR_MIN_BODY, n.h || 0, maxB + PAD), headH };
    out.set(n.id, s); return s;
  };
  for (const r of roots()) visit(r);
  return out;
}
function applySizes() {
  for (const [id, el] of nodeEls) {
    const n = nodeById(id); if (!isContainer(n)) continue;
    const s = sizes.get(id); if (!s) continue;
    el.style.width = s.w + 'px'; el.style.height = s.h + 'px';
  }
}
/** Tamaño mínimo que exige el contenido actual de un contenedor (para el redimensionado manual). */
function contentMin(n) {
  let maxR = 0, maxB = 0;
  for (const k of childrenOf(n.id)) { const s = sizes.get(k.id) || { w: CARD_W, h: 120 }; maxR = Math.max(maxR, k.x + s.w); maxB = Math.max(maxB, k.y + s.h); }
  const headH = (sizes.get(n.id) || {}).headH || 60;
  return { w: Math.max(CTR_MIN_W, maxR + PAD), h: Math.max(headH + CTR_MIN_BODY, maxB + PAD) };
}
/** Mantiene a un hijo dentro del área útil de su contenedor (el contenedor crece si hace falta). */
function clampInside(n) {
  const p = parentOf(n); if (!p) return;
  const hh = (sizes.get(p.id) || {}).headH || 60;
  n.x = Math.max(PAD, n.x); n.y = Math.max(hh + HEAD_GAP, n.y);
}
/** Lugar libre para un nuevo hijo: debajo del contenido existente. */
function freeSpot(parentId) {
  const p = nodeById(parentId); const hh = (sizes.get(parentId) || {}).headH || 60;
  let y = hh + HEAD_GAP;
  for (const k of childrenOf(parentId)) { const s = sizes.get(k.id) || { h: 120 }; y = Math.max(y, k.y + s.h + GAP); }
  return { x: PAD, y: p ? y : 0 };
}
// Las imágenes pueden cambiar la altura al cargar.
nodesLayer.addEventListener('load', () => { measureDOM(); computeSizes(); applySizes(); updateEdgePaths(); drawMinimap(); }, true);

function updateNodeTransforms(ids) {
  for (const id of ids || nodeEls.keys()) {
    const n = nodeById(id), el = nodeEls.get(id);
    if (n && el) el.style.transform = `translate(${n.x}px, ${n.y}px)`;
  }
}

