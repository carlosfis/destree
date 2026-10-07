# Mapa del repositorio (F4b)

Una línea por archivo. Actualizar al crear/mover archivos (protocolo de handoff §6).

## Raíz
- `CLAUDE.md` — instrucciones del proyecto (≤60 líneas). `PLAN.md` — fases, prompts, handoff. `PENDIENTE.md` — lo que requiere al usuario (F3+). `README.md` — stub público. `LICENSE` — MIT.
- `package.json` — `"type": "module"`; deps fastify, @fastify/static, ajv-formats; scripts dev/start/test/migrate/import/backup/lint.
- `.env.example` — variables (sin secretos; `TRUST_PROXY` desde F2). `.gitignore` — `data/`, `.env`, `export-actual.json`.
- `export-actual.json` — datos reales del usuario (gitignored; importados en `data/destree.db`; fixture `tests/fixtures/legacy-v2.json`).

## schema/ (JSON Schema draft-07, fuente de verdad del modelo)
- `page-document.schema.json` — `{version:3, page, nodes, edges, tags, branchTypes, settings, camera}`; cuerpo de GET/PUT e import.
- `page.schema.json`, `node.schema.json` (F3: `notes`, `docs[]`, `visibility`, `cellIds`, `assigneeIds`, `ownerUserId`, `status`, `hasExternalRefs`), `edge.schema.json`, `tag.schema.json`, `branch-type.schema.json` — entidades (`$id` relativo, `additionalProperties:false`).

## server/ (Fastify 5, ESM)
- `index.js` — `buildApp({dbPath, logger})` (+`app.deletedDir` F4a): Ajv strict:false + ajv-formats, addSchema de `/schema`, error handler (400/401/403/404/409/410/428/429), plugins session/guard/origin → rutas, static `client/`; listen si es el main.
- `config.js` — `.env` mínimo; `port` 3000, `host`, `dbPath`, `clientDir`, `schemaDir`, `trustProxy`, `logLevel`.
- `db/sqlite.js` — `node:sqlite`: `openDb` (WAL, FK), `migrate`, `seed` (org/página por defecto + tags/branch types), `transaction(db, fn)` (reentrante, SAVEPOINT), `openReady`.
- `db/migrations/001_core.sql` — orgs, pages, tags, branch_types, nodes (+`image_legacy` hasta F5), node_tags, edges.
- `db/migrations/002_auth.sql` — users, memberships, sessions (id = sha256 del token), invites (token_hash), audit_log.
- `db/migrations/003_cells.sql` — cells, cell_members, page_cells, node_cells (raíces `cells`), node_assignees.
- `db/migrations/004_pages.sql` — F4a: `pages.archived_at`, `pages.deleted_by`.
- `lib/normalize.js` — normalización v1/v2/v3 → v3 compartida con el cliente (sin imports; F3: `docUrl` legado → `docs[0]`, `cellIds`/`assigneeIds`). `lib/ids.js` — ULID, `nowIso`.
- `lib/pages.js` — `listPages(db, org, ctx, status)`, `getDocument(db, id, ctx)` (+`refs`, filtro designer), `saveDocument` (transacción, If-Match → 409, 409 si no activa, node_cells/node_assignees), `patchNode`, `createPage` (visibilidad, células, contenido), F4a: `updatePageMeta`, `setPageStatus`, `deletePage` (soft + JSON), `duplicatePage`, `importDocument`, `HttpError`.
- `lib/visibility.js` — F3: `pageVisibleFor` (regla 2), `filterDocumentForUser` (reglas 3/4/6, `hasExternalRefs`), `needsFilter`.
- `lib/cells.js` — F3: células CRUD, `setCellMembers`, `addCellMembers`, `userCellIds`, `canManageCell` (head: lead o miembro), `visibilityCtx(req)`.
- `lib/schemas.js` — `loadSchemas`, `createValidator` (Ajv independiente para tests/scripts), `formatErrors`.
- `lib/permissions.js` — matriz acción → roles (PLAN §3); `can(ctx, action)`, `permissionsFor(role)`, `ACTIONS`, `ROLES`. F3: `cells.members`, `directory.read`.
- `lib/auth.js` — scrypt (`hashPassword`/`verifyPassword`), usuarios (`createUser`, `getUser`, `listUsers`, `adminCount`), sesiones (`createSession`/`resolveSession`/`deleteSession`), invitaciones (`createInvite`, `getInviteByToken` 404/410, `acceptInvite`), `rateLimit` en memoria.
- `lib/audit.js` — `audit(db, { orgId, userId, action, entity, entityId, meta })`; F4b: `listAudit(db, orgId, { limit, before, action })`.
- `plugins/session.js` — cookie `destree_sid` → `req.user/role/orgId/sessionToken` (onRequest global, skip-override); `parseCookies`, `sessionCookie`.
- `plugins/guard.js` — `app.guard('action')` → hook onRequest: 401 (con `setup`) / 403.
- `plugins/origin-check.js` — mutaciones `/api/*`: Origin/Referer debe coincidir con Host; `config.skipOriginCheck` exime.
- `routes/health.js` — `GET /api/health` (pública). `routes/pages.js` — `/api/pages` (GET ?status, POST), `/api/pages/:id` (GET/PUT/PATCH/DELETE), `archive|unarchive|restore-deleted|duplicate`, `/api/import`; guard + audit.
- `routes/auth.js` — `/api/setup` (GET/POST), `/api/auth/login|logout`, `/api/me` (+`cellIds`, `cells`). `routes/invites.js` — `/api/invites` (POST con `cellIds`/GET/DELETE), `/api/invites/:token`, `/api/invites/accept` (hereda células). `routes/users.js` — `/api/users` CRUD (admin).
- `routes/cells.js` — F3: `/api/cells` CRUD + `PUT /:id/members`, `GET /api/users/directory`. `routes/audit.js` — F4b: `GET /api/audit` (admin). `routes/nodes.js` — F3: `PATCH /api/pages/:pageId/nodes/:nodeId/visibility|owner`, `PUT …/assignees`; F4a: `GET /api/me/assignments`.

## client/ (vanilla JS ESM + CSS, sin bundler)
- `index.html` — markup original + `<link>` css/01..12 + `#authView` (overlay F2) + único `<script type="module" src="js/main.js">`.
- `css/01-theme … 10-responsive.css` — split 1:1 del `<style>` legacy (líneas 9-501); paridad en `tests/client.test.js`. `css/11-auth.css` — overlay de acceso, chip de usuario, `body.viewer` (modo lectura). `css/12-cells.css` — F3: chips de células/asignados, pestaña Células, ficha de lectura, enlaces y markdown. `css/13-lobby.css` — F4a: lobby y botón de página. `css/14-admin.css` — F4b: `#/admin`, tabla de audit, formulario Página.
- `js/main.js` — entrada: botones topbar, router por hash (`#/login`, `#/setup`, `#/invite/<token>`, `#/me`, `#/n/<id>`, `#/lobby`, `#/p/<id>[/n/<nodeId>]`, F4b: `#/admin[/<tab>]` → `appRoute()`), `authenticate()` → `S.session`, `loadTeamData()`, `loadPage()` (cambio sin fugas), `renderPageButton()` (⌂ página), chip usuario + ★ Mías + ⚑ Admin + logout (inyectados por JS; `#btnAdmin` → "⚙ Página"), `init()`, `window.S` solo en localhost.
- `js/core/utils.js` — `$`, `$$`, `uid`, `clamp`, `esc`, `debounce`, constantes (`STORAGE_KEY`, `PREFS_KEY`, `CARD_W`, `GRID`…; PAD/MIN_Z/MAX_Z/TAG_COLORS desde normalize.js), `TYPE_META`, `KIND_LABEL`.
- `js/core/api.js` — fetch JSON: páginas (`listPages`, `getPage`, `putPage` If-Match, `importDocument`, `health`) + F2 (`setup`, `login`, `logout`, `getMe`, `getInvite`, `acceptInvite`, `createInvite`, `listInvites`, `revokeInvite`, `listUsers`, `createUser`, `updateUser`) + F3 (`listCells`, `createCell`, `updateCell`, `deleteCell`, `setCellMembers`, `directory`) + F4a (`listPages(status)`, `createPage`, `patchPage`, `archivePage`, `unarchivePage`, `deletePage`, `restorePage`, `duplicatePage`, `myAssignments`); errores con `status`; 401 fuera de auth → evento `destree:unauthorized`.
- `js/core/readonly.js` — `canEdit()`, `applyReadonly()`: designer → oculta botones, fuerza mano, bloquea menús/editor/teclado de edición (captura); doble clic / Enter abren la ficha (`openNodeView`); `persist()` no envía PUT.
- `js/core/normalize.js` — symlink → `server/lib/normalize.js`.
- `js/core/dom.js` — nodos DOM compartidos: `viewport`, `world`, `nodesLayer`, `edgeLayer`, `guidesSvg` (módulo hoja).
- `js/core/state.js` — `S` (estado mutable: `state`, `cam`, `ptr`, `pageId`, `version`, `offline`, `session`, `readonly`, F3: `cellList`, `userDir`, `docRefs`, F4a: `pageList`, `lobbyTab`…), F3: `userName`, `cellById`, `myNodes`, F4a: `lastPageId`, `bootstrap(wantedId)`, `defaultState`/`normalizeState` (= normalize.js), `demoData`, `bootstrap` (API → localStorage/demo), `toDocument`, `persist`/`save` (PUT debounced, 409 → recarga + `destree:reload`), selectores (`nodeById`, `childrenOf`, `roots`…).
- `js/core/history.js` — undo/redo (`pushHistory`, `undo`, `redo`, `updateUndoButtons`).
- `js/canvas/camera.js` — pan/zoom, `measureViewport`, `toWorld`/`toScreen`, `fitToScreen`, `animateCamera`.
- `js/canvas/render-nodes.js` — `sel`, mapas de tamaños/elementos, `renderNodes`, `computeSizes`, `freeSpot`; F3: chips ◐ células (`visibilityChip`), asignados, responsable, ⎘ docs, ⇢ ocultas.
- `js/canvas/render-edges.js` — geometría y SVG de aristas, `updateEdgePaths`.
- `js/canvas/selection.js` — selección, `updateStatus`, `renderAll`.
- `js/canvas/minimap.js` — `drawMinimap` + arrastre en minimapa.
- `js/canvas/pointer-gestures.js` — down/move/up: drag, pan, marquee, pinch, conexión, resize.
- `js/canvas/pointer-drag.js` — arrastre/guías/marquee/rueda/menú contextual; listeners del viewport.
- `js/canvas/keyboard.js` — atajos de teclado (solo efectos; lo importa `main.js`).
- `js/canvas/layout.js` — `computeLayout`, `autoLayout`, `animateNodesTo`.
- `js/ui/popover.js` — popover y menús (`showNewMenu`, `showNodeMenu`, `showEdgePopover`).
- `js/ui/connections.js` — reglas de conexión/anidamiento (`wouldCycle`, `proposeConnection`, `addEdge`).
- `js/ui/dialogs.js` — `confirmBox`, `promptBox`. `js/ui/card-editor.js` — `openEditor` (formulario de card; F3 integra las secciones de `card-editor-docs.js`).
- `js/ui/card-editor-docs.js` — F3: `docsSection` (enlaces ≤20 + notas), `teamSection` (responsable, asignados), `visibilitySection` (raíz: org | células).
- `js/ui/markdown.js` — F3: `renderMarkdown` (escape total; títulos, listas, enlaces http(s), código, negrita). `js/ui/node-view.js` — F3: `openNodeView` ficha de lectura en `#editorDialog`.
- `js/ui/node-actions.js` — eliminar/duplicar. `js/ui/theme.js` — tema, `toast`, `openShortcuts`.
- `js/ui/page-settings.js` — drawer de ajustes de página (antes `views/admin.js`): etiquetas, ramificaciones, responsables, datos import/export, ajustes; F4b: `renderPageTab` (nombre, descripción, visibilidad + células → PATCH, archivar), `enablePageTab()`, `colorPicker`.
- `js/views/admin-view.js` — F4b: `#/admin` overlay: Usuarios, Células, Páginas borradas (restaurar), Audit log paginado con filtro; `adminTabsFor()` por permisos.
- `js/views/users.js` — pestaña Usuarios: invitar (enlace copiable, sin correo; F3: chips de células del invitado), invitaciones pendientes/revocar, usuarios con rol/activar (admin).
- `js/views/cells.js` — F3: pestaña Células (admin: CRUD/color/lead; admin o head de la célula: miembros), `refreshCells()` → `S.cellList`.
- `js/views/me.js` — F3: `openMyAssignments()` (`#/me`; F4a multipágina vía `assignmentItems()`/`assignmentHTML()`), `goToNode(id)` (selecciona, centra, abre ficha).
- `js/views/lobby.js` — F4a: `openLobby(tab)`/`closeLobby()`/`isLobbyOpen()`: grid de páginas, buscador, pestañas (Páginas, Archivadas, Borradas admin, Mis asignaciones), acciones por permiso.
- `js/views/auth-views.js` — `showSetup`, `showLogin`, `showInvite`, `hideAuth` sobre `#authView`; `ROLE_LABEL`.

## scripts/
- `lint.js` — `node --check` de todos los .js. `migrate.js` — aplica migraciones + seed. `import.js` — `node scripts/import.js archivo.json [pageId]`.
- `backup.js` — stub hasta F6b. `smoke.js` — checklist en Chrome headless vía CDP sobre Fastify con DB temporal (22 pasos: setup, paridad, F3 célula/editor/ficha/#/me, F4a lobby/cambio de página, F4b #/admin + pestaña Página, invitación→designer readonly + ficha, logout/login; consola limpia).

## tests/
- `client.test.js` — paridad CSS vs legacy, estructura ESM (sin `let` top-level, claves de `S`, imports↔exports, symlink normalize, alcance desde `main.js`).
- `schema.test.js` — fixture v2 valida tras normalizar; mutaciones inválidas fallan; migración v1. `api.test.js` — rutas con BD temporal (sesión admin), 200/409/428/400, import, reapertura.
- `permissions.test.js` — matriz permisos, tabla ruta × rol (admin/head/designer/anónimo), origin-check + `skipOriginCheck`, invitaciones (410/404/revocar), último admin, sesiones invalidadas, rate-limit, audit_log. `helpers/auth.js` — `setupAdmin`, `login`, `inviteAndAccept`.
- `pages.test.js` — F4a: visibilidad de página por célula en listado, PATCH meta, archivar/desarchivar, borrar (admin, export JSON) y restaurar, duplicar, asignaciones, 409 en PUT archivada.
- `visibility.test.js` — F3: `filterDocumentForUser` (unidad) + API células/miembros/invitación con células, designer filtrado, `hasExternalRefs`, parches de nodo, docs+notes contra schema, 403/400.
- `fixtures/legacy-v2.json` — `export-actual.json` anonimizado (11 nodos, 9 aristas, v2).

## docs/
- `MAP.md` — este archivo. `DECISIONS.md` — append-only. `API.md` — endpoints. `handoff/TEMPLATE.md`, `handoff/F0a.md`, `handoff/F0b.md`, `handoff/F1.md`, `handoff/F2.md`, `handoff/F3.md`, `handoff/F4a.md`, `handoff/F4b.md`.

## legacy/
- `arbol.html` — monolito original (2545 líneas). Nunca leerlo entero.
