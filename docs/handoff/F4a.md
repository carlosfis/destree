# Handoff F4a — Pages API + router + lobby   [✅ completa]
Commit: 9bedc92 · Tag: f4a (f3 → e9deec7)
## Hecho
- `004_pages.sql`: `pages.archived_at`, `pages.deleted_by` (visibility/status/deleted_at/camera_json desde 001; `page_cells` desde 003).
- `lib/pages.js`: `listPages(db, org, ctx, status)` (active|archived|deleted|all, `rootCount`, `cellIds`), `createPage` (visibility+cellIds, contenido opcional), `updatePageMeta`, `setPageStatus`, `deletePage` (soft + JSON en `data/deleted/<id>-<ts>.json`, `app.deletedDir`), `duplicatePage`; PUT en página no activa → 409. `transaction()` reentrante (SAVEPOINT).
- Rutas: `GET /api/pages?status=`, `PATCH /api/pages/:id`, `POST …/archive|unarchive` (pages.archive), `DELETE` + `POST …/restore-deleted` (pages.delete, admin; la única activa no se borra), `POST …/duplicate` (pages.create), `GET /api/me/assignments` (todas las páginas visibles). Borrada → 404 salvo admin.
- Cliente: `bootstrap(wantedId)` único punto de entrada (página pedida → última visitada en prefs → primera visible; `S.pageList`), `loadPage()` en `main.js` resetea historial/selección/popover/diálogos vía `destree:reload`; router `#/lobby`, `#/p/<id>`, `#/p/<id>/n/<nodeId>`; `views/lobby.js` (grid, buscador, pestañas Páginas/Archivadas/Borradas(admin)/Mis asignaciones, crear/renombrar/duplicar/archivar/borrar/restaurar según permisos); botón `⌂ <página>` en topbar; `#/me` multipágina; `css/13-lobby.css`.
- Tests: `pages.test.js` (2 páginas con visibilidad distinta → designer ve solo la suya; PATCH meta; archivar reversible + 409 en PUT; borrar solo admin + export + restaurar; duplicar; asignaciones; audit). Smoke +1 (cambio sin fugas).
## Verificado
- `npm test` → 18/18 · `npm run lint` → OK · `node scripts/smoke.js` → 20/20, consola limpia · `npm run migrate` → 004 aplicada.
## Pendiente / deuda
- Sin UI para cambiar visibilidad/células de página (PATCH existe) → F4b page-settings. Borradas solo en lobby (pestaña admin) hasta `#/admin` F4b.
- Export JSON al borrar es provisional hasta F6a (snapshot `reason=delete`).
- `duplicatePage` copia imágenes legadas (dataURL) tal cual; F5 lo cambia a `imageId`.
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (F4a): `transaction` reentrante; sin ruta por defecto al lobby (última página en prefs); borrado soft exporta JSON; rutas de estado como POST verbos.
## Archivos clave
- `server/lib/pages.js` — todo el ciclo de vida de página. `server/routes/pages.js` — rutas. `client/js/views/lobby.js` — lobby. `client/js/main.js` — `loadPage`, `appRoute`, `renderPageButton`.
## Contexto para F4b
- Drawer actual (`views/admin.js`) = page-settings; falta pestaña "Página" (nombre, descripción, visibilidad + células → `api.patchPage`). `#/admin` nuevo: usuarios (`views/users.js` ya existe), células (`views/cells.js`), páginas borradas (`api.listPages('deleted')` + `restorePage`), audit log (falta `GET /api/audit` con `audit.read`).
- `S.pageList` y `S.cellList` ya cargados; `has(perm)` patrón en `lobby.js`/`users.js`.
