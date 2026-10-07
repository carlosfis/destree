# Mapa del repositorio (F1)

Una línea por archivo. Actualizar al crear/mover archivos (protocolo de handoff §6).

## Raíz
- `CLAUDE.md` — instrucciones del proyecto (≤60 líneas). `PLAN.md` — fases, prompts, handoff. `README.md` — stub público. `LICENSE` — MIT.
- `package.json` — `"type": "module"`; deps fastify, @fastify/static, ajv-formats; scripts dev/start/test/migrate/import/backup/lint.
- `.env.example` — variables (sin secretos). `.gitignore` — `data/`, `.env`, `export-actual.json`.
- `export-actual.json` — datos reales del usuario (gitignored; importados en `data/destree.db`; fixture `tests/fixtures/legacy-v2.json`).

## schema/ (JSON Schema draft-07, fuente de verdad del modelo)
- `page-document.schema.json` — `{version:3, page, nodes, edges, tags, branchTypes, settings, camera}`; cuerpo de GET/PUT e import.
- `page.schema.json`, `node.schema.json`, `edge.schema.json`, `tag.schema.json`, `branch-type.schema.json` — entidades (`$id` relativo, `additionalProperties:false`).

## server/ (Fastify 5, ESM)
- `index.js` — `buildApp({dbPath, logger})`: Ajv strict:false + ajv-formats, addSchema de `/schema`, error handler (400/404/409/428), rutas, static `client/`; listen si es el main.
- `config.js` — `.env` mínimo; `port` 3000, `host`, `dbPath`, `clientDir`, `schemaDir`, `logLevel`.
- `db/sqlite.js` — `node:sqlite`: `openDb` (WAL, FK), `migrate`, `seed` (org/página por defecto + tags/branch types), `transaction(db, fn)`, `openReady`.
- `db/migrations/001_core.sql` — orgs, pages, tags, branch_types, nodes (+`image_legacy` hasta F5), node_tags, edges.
- `lib/normalize.js` — normalización v1/v2/v3 → v3 compartida con el cliente (sin imports). `lib/ids.js` — ULID, `nowIso`.
- `lib/pages.js` — `listPages`, `getDocument`, `saveDocument` (transacción, If-Match → 409), `createPage`, `importDocument`, `HttpError`.
- `lib/schemas.js` — `loadSchemas`, `createValidator` (Ajv independiente para tests/scripts), `formatErrors`.
- `routes/health.js` — `GET /api/health`. `routes/pages.js` — `/api/pages`, `/api/pages/:id` (GET/PUT), `/api/import`.

## client/ (vanilla JS ESM + CSS, sin bundler)
- `index.html` — markup original + `<link>` css/01..10 + único `<script type="module" src="js/main.js">`.
- `css/01-theme … 10-responsive.css` — split 1:1 del `<style>` legacy (líneas 9-501); paridad en `tests/client.test.js`.
- `js/main.js` — entrada: botones topbar, `init()`, `window.S` solo en localhost.
- `js/core/utils.js` — `$`, `$$`, `uid`, `clamp`, `esc`, `debounce`, constantes (`STORAGE_KEY`, `PREFS_KEY`, `CARD_W`, `GRID`…; PAD/MIN_Z/MAX_Z/TAG_COLORS desde normalize.js), `TYPE_META`, `KIND_LABEL`.
- `js/core/api.js` — fetch JSON: `listPages`, `getPage`, `putPage` (If-Match), `importDocument`, `health`; errores con `status`.
- `js/core/normalize.js` — symlink → `server/lib/normalize.js`.
- `js/core/dom.js` — nodos DOM compartidos: `viewport`, `world`, `nodesLayer`, `edgeLayer`, `guidesSvg` (módulo hoja).
- `js/core/state.js` — `S` (estado mutable: `state`, `cam`, `ptr`, `pageId`, `version`, `offline`…), `defaultState`/`normalizeState` (= normalize.js), `demoData`, `bootstrap` (API → localStorage/demo), `toDocument`, `persist`/`save` (PUT debounced, 409 → recarga + `destree:reload`), selectores (`nodeById`, `childrenOf`, `roots`…).
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
- `lint.js` — `node --check` de todos los .js. `migrate.js` — aplica migraciones + seed. `import.js` — `node scripts/import.js archivo.json [pageId]`.
- `backup.js` — stub hasta F6b. `smoke.js` — checklist en Chrome headless vía CDP sobre Fastify con DB temporal (13 pasos, consola limpia).

## tests/
- `client.test.js` — paridad CSS vs legacy, estructura ESM (sin `let` top-level, claves de `S`, imports↔exports, symlink normalize, alcance desde `main.js`).
- `schema.test.js` — fixture v2 valida tras normalizar; mutaciones inválidas fallan; migración v1. `api.test.js` — rutas con BD temporal, 200/409/428/400, import, reapertura.
- `fixtures/legacy-v2.json` — `export-actual.json` anonimizado (11 nodos, 9 aristas, v2).

## docs/
- `MAP.md` — este archivo. `DECISIONS.md` — append-only. `API.md` — endpoints. `handoff/TEMPLATE.md`, `handoff/F0a.md`, `handoff/F0b.md`, `handoff/F1.md`.

## legacy/
- `arbol.html` — monolito original (2545 líneas). Nunca leerlo entero.
