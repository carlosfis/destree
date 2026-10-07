# Handoff F4b — Panel de administración + page-settings   [✅ completa]
Commit: 7224b70 · Tag: f4b (f4a → 0a578e6)
## Hecho
- `GET /api/audit?limit&before&action` (audit.read, admin): paginación por ULID descendente, `userName`, `meta` parseado; `lib/audit.js#listAudit`.
- `#/admin` (`views/admin-view.js`, overlay reutilizando `.lobby`): pestañas por permiso → Usuarios (`invite`; head solo invita designers a sus células), Células (`cells.read`; head solo gestiona miembros de las suyas), Páginas borradas (`pages.delete`; restaurar), Audit log (`audit.read`; filtro por prefijo de acción, "Cargar más"). Botón `⚑ Admin` en topbar solo si hay alguna pestaña.
- Drawer `views/admin.js` → `ui/page-settings.js`: pestaña **Página** (nombre, descripción, visibilidad org/células + células → `PATCH /api/pages/:id`, actualiza `S.state.page`/`S.version`, evento `destree:page-meta` → botón ⌂; Archivar página). Usuarios/Células salen del drawer. `#btnAdmin` pasa a "⚙ Página".
- `css/14-admin.css`. Tests: tabla ruta × rol ampliada (cells, directory, audit, borradas, archive, delete, assignments) + paginación/filtro del audit. Smoke +1 (pestañas por permiso, audit con acciones previas, borradas, renombrar página desde el drawer).
## Verificado
- `npm test` → 18/18 · `npm run lint` → OK · `node scripts/smoke.js` → 22/22, consola limpia.
## Pendiente / deuda
- Audit log sin filtro por usuario/fecha ni export (a propósito: tablas simples). Sin vista de un usuario individual.
- Cambiar células de un usuario se hace desde Células → Miembros (no desde la fila del usuario).
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (F4b): drawer = ajustes de página; `#/admin` = organización; `limit` del audit como string (Ajv sin coerción).
## Archivos clave
- `client/js/views/admin-view.js` — `#/admin`. `client/js/ui/page-settings.js` — drawer (`renderPageTab`, `enablePageTab`). `server/routes/audit.js`.
## Contexto para F5
- `nodes.image_legacy` (dataURL) sigue vivo; `image_id` y `pages.cover_image_id` existen desde 001. `images` tabla por crear (`005_images.sql`).
- `card-editor.js#processImage` recorta a 320×180 JPEG en el cliente; F5 lo sustituye por upload multipart (`ui/uploader.js`) → `imageId`; `render-nodes.js` usa `n.image` (dataURL) en `leafHTML`/`headHTML`.
- Visibilidad para `GET /uploads/:id`: `pageVisibleFor` + `filterDocumentForUser` en `lib/visibility.js` (regla 5 pendiente). `sharp` no está instalado (dependencia nativa).
