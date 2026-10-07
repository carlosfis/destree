# Mapa del repositorio (F0b)

Una línea por archivo. Actualizar al crear/mover archivos (protocolo de handoff §6).

## Raíz
- `CLAUDE.md` — instrucciones del proyecto (≤60 líneas). `PLAN.md` — fases, prompts, handoff. `README.md` — stub público. `LICENSE` — MIT.
- `package.json` — `"type": "module"`, sin dependencias; scripts fijos dev/start/test/migrate/backup/lint.
- `.env.example` — variables (sin secretos). `.gitignore` — `data/`, `.env`, `export-actual.json`.
- `export-actual.json` — datos reales del usuario (gitignored; fixture `legacy-v2.json` en F1).

## client/ (vanilla JS ESM + CSS, sin bundler)
- `index.html` — markup original + `<link>` css/01..10 + único `<script type="module" src="js/main.js">`.
- `css/01-theme … 10-responsive.css` — split 1:1 del `<style>` legacy (líneas 9-501); paridad en `tests/client.test.js`.
- `js/main.js` — entrada: botones topbar, `init()`, `window.S` solo en localhost.
- `js/core/utils.js` — `$`, `$$`, `uid`, `clamp`, `esc`, `debounce`, constantes (`STORAGE_KEY`, `CARD_W`, `GRID`…), `TYPE_META`, `KIND_LABEL`.
- `js/core/dom.js` — nodos DOM compartidos: `viewport`, `world`, `nodesLayer`, `edgeLayer`, `guidesSvg` (módulo hoja).
- `js/core/state.js` — `S` (estado mutable: `state`, `cam`, `ptr`, `vpRect`…), `defaultState`, `demoData`, `normalizeState`, `loadState`, `persist`/`save`, selectores (`nodeById`, `childrenOf`, `roots`…).
- `js/core/history.js` — undo/redo (`pushHistory`, `undo`, `redo`, `updateUndoButtons`).
- `js/canvas/camera.js` — pan/zoom, `measureViewport`, `toWorld`/`toScreen`, `fitToScreen`, `animateCamera`.
- `js/canvas/render-nodes.js` — `sel`, mapas de tamaños/elementos, `renderNodes`, `computeSizes`, `freeSpot`.
- `js/canvas/render-edges.js` — geometría y SVG de aristas, `updateEdgePaths`.
- `js/canvas/selection.js` — selección, `updateStatus`, `renderAll`.
- `js/canvas/minimap.js` — `drawMinimap` + arrastre en minimapa.
- `js/canvas/pointer-gestures.js` — down/move/up: drag, pan, marquee, pinch, conexión, resize.
- `js/canvas/pointer-drag.js` — arrastre/guías/marquee/rueda/menú contextual; listeners del viewport.
- `js/canvas/keyboard.js` — atajos de teclado (solo efectos; lo importa `main.js`).
- `js/canvas/layout.js` — `computeLayout`, `autoLayout`, `animateNodesTo`.
- `js/ui/popover.js` — popover y menús (`showNewMenu`, `showNodeMenu`, `showEdgePopover`).
- `js/ui/connections.js` — reglas de conexión/anidamiento (`wouldCycle`, `proposeConnection`, `addEdge`).
- `js/ui/dialogs.js` — `confirmBox`, `promptBox`. `js/ui/card-editor.js` — `openEditor` (formulario de card).
- `js/ui/node-actions.js` — eliminar/duplicar. `js/ui/theme.js` — tema, `toast`, `openShortcuts`.
- `js/views/admin.js` — panel admin (etiquetas, ramificaciones, responsables, datos import/export, ajustes).

## scripts/
- `dev-server.js` — estático para `client/` en :5173 (F0a-F0b; Fastify en F1). `lint.js` — `node --check` de todos los .js.
- `migrate.js`, `backup.js` — stubs hasta F1/F6b. `smoke.js` — checklist de paridad en Chrome headless vía CDP (13 pasos, consola limpia).

## tests/
- `client.test.js` — paridad CSS vs legacy, estructura ESM (sin `let` top-level, claves de `S`, imports↔exports, alcance desde `main.js`).

## docs/
- `MAP.md` — este archivo. `DECISIONS.md` — append-only. `handoff/TEMPLATE.md`, `handoff/F0a.md`, `handoff/F0b.md`.

## legacy/
- `arbol.html` — monolito original (2545 líneas). Nunca leerlo entero.
