# Mapa del repositorio

Una línea por archivo. Actualizar al crear/mover archivos.

## Raíz
- `README.en.md` — traducción fiel del README (enlace cruzado en ambas cabeceras). `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 en español. `SECURITY.md` — política de reporte de vulnerabilidades y versiones soportadas (P4/P6). `CLAUDE.md` — instrucciones del proyecto (≤60 líneas). `PENDIENTE.md` — fases pendientes y seguimiento (único registro del trabajo restante). `README.md` — presentación, instalación, roles, roadmap. `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE` (MIT).
- `Dockerfile` (multi-stage, usuario node, healthcheck), `.dockerignore`, `docker-compose.yml` (volumen `./data`; perfil `https` con Caddy; perfil `dev` con Mailpit), `docker/Caddyfile`.
- `.github/workflows/ci.yml` (lint+test), `release.yml` (tag v* → GHCR multi-arch + Release), `.github/ISSUE_TEMPLATE/`.
- `package.json` — `"type": "module"`; deps fastify 5, @fastify/static 10, ajv-formats, sharp 0.35 (nativa); scripts dev/start/test/migrate/import/backup/lint.
- `.env.example` — variables (sin secretos; `TRUST_PROXY`; `SMTP_URL`/`MAIL_FROM`/`PUBLIC_URL`; `UPLOADS_DIR`; `VERSIONS_KEEP`/`VERSIONS_COALESCE_MIN`; `BACKUP_CRON`/`BACKUP_KEEP`/`BACKUPS_DIR`). `.gitignore` — `data/`, `.env`, `export-actual.json`.
- `export-actual.json` — datos reales del usuario (gitignored; importados en `data/destree.db`; fixture `tests/fixtures/legacy-v2.json`).

## schema/ (JSON Schema draft-07, fuente de verdad del modelo)
- `org-export.schema.json` — `{ version:3, exportedAt, org, cells[], users[] (sin hash), pages[{ document, status, versions[] }], images[] (+data/thumb base64 si embed) }`.
- `page-document.schema.json` — `{version:3, page, nodes, edges, tags, branchTypes, settings, camera}`; cuerpo de GET/PUT e import.
- `page.schema.json`, `node.schema.json` (`notes`, `docs[]`, `visibility`, `cellIds`, `assigneeIds`, `ownerUserId`, `status`, `hasExternalRefs`), `edge.schema.json`, `tag.schema.json`, `branch-type.schema.json` — entidades (`$id` relativo, `additionalProperties:false`).

## server/ (Fastify 5, ESM)
- `index.js` — `buildApp({dbPath, logger})` (+`app.uploadsDir` + `migrateLegacyImages` + purga de huérfanas; `app.backupsDir`, lock `.server.lock`, cron de respaldos; `checkEnvironment()` y reintento de `migrate()` tras vaciar `image_legacy`): Ajv strict:false + ajv-formats, addSchema de `/schema`, error handler (400/401/403/404/409/410/428/429), plugins session/guard/origin/security-headers → rutas, static `client/`; purga de sesiones caducadas al arrancar; listen si es el main + cierre ordenado SIGTERM/SIGINT (P6).
- `config.js` — `.env` mínimo; `port` 3000, `host`, `dbPath`, `clientDir`, `schemaDir`, `trustProxy`, `logLevel`, `uploadsDir`, `versionsKeep`, `versionsCoalesceMs`, `backupsDir`, `backupKeep`, `backupCron`, `smtpUrl`, `mailFrom`, `publicUrl` (P7).
- `db/sqlite.js` — `node:sqlite`: `openDb` (WAL, FK), `migrate`, `seed` (org/página por defecto + tags/branch types), `transaction(db, fn)` (reentrante, SAVEPOINT), `openReady`; `GUARDS` por migración, `hasColumn`.
- `db/migrations/001_core.sql` — orgs, pages, tags, branch_types, nodes (+`image_legacy`), node_tags, edges.
- `db/migrations/002_auth.sql` — users, memberships, sessions (id = sha256 del token), invites (token_hash), audit_log.
- `db/migrations/003_cells.sql` — cells, cell_members, page_cells, node_cells (raíces `cells`), node_assignees.
- `db/migrations/004_pages.sql` — `pages.archived_at`, `pages.deleted_by`.
- `db/migrations/005_images.sql` — `images` (sha256 único por org), índice `nodes_image`.
- `db/migrations/006_versions.sql` — `page_versions` (snapshot gzip, hash, reason, image_ids_json).
- `db/migrations/007_backups.sql` — `backups`.
- `db/migrations/008_drop_image_legacy.sql` — elimina `nodes.image_legacy` (guarda: solo con la columna vacía).
- `db/migrations/009_staff.sql` — `nodes.staff_json`. `db/migrations/010_mail.sql` — P7: `invites.email_sent_at`; `password_resets` (token_hash único, expires_at, used_at).
- `lib/normalize.js` — normalización v1/v2/v3 → v3 compartida con el cliente (sin imports; `docUrl` legado → `docs[0]`, `cellIds`/`assigneeIds`). `lib/ids.js` — ULID, `nowIso`.
- `lib/pages.js` — `listPages(db, org, ctx, status)`, `getDocument(db, id, ctx)` (+`refs`, filtro designer), `saveDocument` (transacción, If-Match → 409, 409 si no activa, node_cells/node_assignees), `patchNode`, `createPage` (visibilidad, células, contenido), `updatePageMeta`, `setPageStatus`, `deletePage` (soft; la ruta crea antes la versión `delete`), `duplicatePage`, `importDocument`, `HttpError`.
- `lib/visibility.js` — `pageVisibleFor` (regla 2), `filterDocumentForUser` (reglas 3/4/6, `hasExternalRefs`), `needsFilter`.
- `lib/backup.js` — `createBackup` (sqlite backup + tar.gz), `applyBackupRetention`, `listBackups`/`getBackup`/`deleteBackup`, `cronMatches`/`scheduleBackups`, `acquireLock`/`serverRunning`, `restoreBackup`.
- `lib/org-export.js` — `exportOrg(db, uploadsDir, { images })`, `importOrg(db, uploadsDir, data)` (aditivo, ids conservados).
- `lib/versions.js` — `snapshotOf`, `createVersion` (auto/coalesce), `applyRetention`, `listVersions`, `getVersion`, `diffDocuments`/`diffVersions`, `restoreVersion`, `restoreLatestIfDiverged`.
- `lib/images.js` — `sniff`, `storeImage` (sharp → webp + thumb, dedupe), `imageVisibleFor` (regla 5), `deleteImage`, `purgeOrphans`, `ingestDataUrls`, `migrateLegacyImages`, `embedImages`, `filesOf`.
- `lib/cells.js` — células CRUD, `setCellMembers`, `addCellMembers`, `userCellIds`, `canManageCell` (head: lead o miembro), `visibilityCtx(req)`.
- `lib/schemas.js` — `loadSchemas`, `createValidator` (Ajv independiente para tests/scripts), `formatErrors`.
- `lib/permissions.js` — matriz acción → roles (PLAN §3); `can(ctx, action)`, `permissionsFor(role)`, `ACTIONS`, `ROLES`. `cells.members`, `directory.read`.
- `lib/auth.js` — scrypt (`hashPassword`/`verifyPassword`), usuarios (`createUser`, `getUser`, `listUsers`, `adminCount`), sesiones (`createSession`/`resolveSession`/`deleteSession`/`deleteUserSessions`/`deleteOtherSessions`, `setPassword`), `createPasswordReset`/`consumePasswordReset` (P7), invitaciones (`createInvite`, `getInviteByToken` 404/410, `acceptInvite`), `rateLimit(ip, { max, windowMs, bucket })` en memoria (cupos `auth`/`images`), `purgeExpiredSessions`.
- `lib/audit.js` — `audit(db, { orgId, userId, action, entity, entityId, meta })`; `listAudit(db, orgId, { limit, before, action })`.
- `plugins/session.js` — cookie `destree_sid` → `req.user/role/orgId/sessionToken` (onRequest global para `/api/*` y `/uploads/*`, skip-override); `parseCookies`, `sessionCookie`.
- `plugins/guard.js` — `app.guard('action')` → hook onRequest: 401 (con `setup`) / 403.
- `plugins/origin-check.js` — mutaciones `/api/*`: Origin/Referer debe coincidir con Host; `config.skipOriginCheck` exime.
- `plugins/security-headers.js` — P6: `CSP` estricta (sin inline), `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP en HTML/estáticos/uploads; nosniff en todo; `/api/*` sin CSP.
- `lib/mailer.js` — P7: `parseSmtpUrl`, `mailConfigured`, `publicBase(req)`, `sendMail({ to, subject, text })` (SMTP propio: EHLO, STARTTLS, AUTH PLAIN/LOGIN, base64), plantillas `inviteMail`/`resetMail`/`testMail`.
- `lib/log.js` — P6: `redactUrl` (token de invitación y `?token=` enmascarados), `loggerOptions(level)` (serializadores sin cookies ni cuerpos, `redact`).
- `routes/health.js` — `GET /api/health` (pública). `routes/pages.js` — `/api/pages` (GET ?status, POST), `/api/pages/:id` (GET ?embedImages/PUT/PATCH/DELETE; PUT e import ingieren dataURLs y crean versión), `archive|unarchive|restore-deleted|duplicate`, `/api/import`; guard + audit.
- `routes/auth.js` — `/api/setup` (GET/POST), `/api/auth/login|logout`, `/api/me` GET (+`cellIds`, `cells`) y PATCH (P3: `name`, `currentPassword`+`newPassword` → cierra las demás sesiones), `DELETE /api/me/sessions` (P6). `routes/invites.js` — `/api/invites` (POST con `cellIds`, envía correo si hay SMTP → `emailSent`/`email_sent_at`; GET/DELETE), `/api/invites/:token`, `/api/invites/accept` (hereda células). `routes/mail.js` — P7: `POST /api/mail/test` (admin), `POST /api/auth/forgot` (siempre 204, envío asíncrono), `POST /api/auth/reset` (token de un solo uso). `routes/users.js` — `/api/users` CRUD (admin; PATCH `password`).
- `routes/cells.js` — `/api/cells` CRUD + `PUT /:id/members`, `GET /api/users/directory`. `routes/audit.js` — `GET /api/audit` (admin). `routes/backups.js` — `/api/backups` (GET/POST/DELETE, `/:id/download`), `/api/org/export`, `/api/org/import`. `routes/versions.js` — `/api/pages/:id/versions` (GET/POST), `/:n`, `/:a/diff/:b`, `/:n/restore`. `routes/images.js` — `POST /api/images` (binario), `DELETE /api/images/:id`, `GET /uploads/:id[/thumb]`. `routes/nodes.js` — `PATCH /api/pages/:pageId/nodes/:nodeId/visibility|owner`, `PUT …/assignees`; `GET /api/me/assignments`.

## client/ (vanilla JS ESM + CSS, sin bundler)
- `index.html` — topbar, lienzo, `#adminPanel` (ajustes de página), diálogos, `#nodeDrawer`, `#emptyHint` (estado vacío), `#authView` + `<link>` css/01..16 + único `<script type="module" src="js/main.js">`.
- `css/01-theme … 10-responsive.css` — estilos base heredados del prototipo original. `css/11-auth.css` — overlay de acceso, chip de usuario, `body.viewer` (modo lectura). `css/12-cells.css` — chips de células/asignados, pestaña Células, ficha de lectura, enlaces y markdown. `css/13-lobby.css` — lobby y botón de página. `css/14-admin.css` — `#/admin`, tabla de audit, formulario Página. `css/15-overrides.css` — overrides de variables del tema legacy (contenedores opacos) + hero de imagen en cards/contenedores. `css/16-drawer.css` — sidebar de instancia (`#nodeDrawer`: pestañas, staff, ficha).
- `js/main.js` — entrada: botones topbar, router por hash (`#/login`, `#/setup`, `#/invite/<token>`, `#/forgot`, `#/reset/<token>` (P7), `#/me`, `#/n/<id>`, `#/lobby`, `#/p/<id>[/n/<nodeId>]`, `#/admin[/<tab>]` → `appRoute()`), `authenticate()` → `S.session`, `loadTeamData()`, `loadPage()` (cambio sin fugas), `renderPageButton()` (⌂ página), chip usuario (botón → Mi cuenta) + ★ Mías + ⟲ Historial + ⚑ Admin + logout (inyectados por JS; `#btnAdmin` → "⚙ Página"), `init()`, `window.S` solo en localhost.
- `js/core/utils.js` — `$`, `$$`, `uid`, `clamp`, `esc`, `applyDataStyles` (P6: `data-style` → CSSOM, sin `style=` inline por la CSP), `debounce`, constantes (`STORAGE_KEY`, `PREFS_KEY`, `CARD_W`, `GRID`…; PAD/MIN_Z/MAX_Z/TAG_COLORS desde normalize.js), `TYPE_META`, `KIND_LABEL`.
- `js/core/api.js` — fetch JSON: páginas (`listPages`, `getPage`, `putPage` If-Match, `importDocument`, `health`) + auth (`setup`, `login`, `logout`, `getMe`, `patchMe`, `getInvite`, `acceptInvite`, `createInvite`, `listInvites`, `revokeInvite`, `listUsers`, `createUser`, `updateUser`) + células (`listCells`, `createCell`, `updateCell`, `deleteCell`, `setCellMembers`, `directory`) + páginas (`listPages(status)`, `createPage`, `patchPage`, `archivePage`, `unarchivePage`, `deletePage`, `restorePage`, `duplicatePage`, `myAssignments`) + imágenes (`uploadImage`, `deleteImage`) + versiones (`listVersions`, `createVersion`, `getVersion`, `diffVersions`, `restoreVersion`) + audit (`listAudit`) + respaldos (`listBackups`, `createBackup`, `deleteBackup`, `importOrg`); errores con `status`; 401 fuera de auth → evento `destree:unauthorized`.
- `js/core/readonly.js` — `canEdit()`, `applyReadonly()`: designer → oculta botones, fuerza mano, bloquea menús/editor/teclado de edición (captura); doble clic / Enter abren la ficha (`openNodeView`); `persist()` no envía PUT.
- `js/core/normalize.js` — symlink → `server/lib/normalize.js`.
- `js/core/dom.js` — nodos DOM compartidos: `viewport`, `world`, `nodesLayer`, `edgeLayer`, `guidesSvg` (módulo hoja).
- `js/core/state.js` — `S` (estado mutable: `state`, `cam`, `ptr`, `pageId`, `version`, `offline`, `session`, `readonly`, `cellList`, `userDir`, `docRefs`, `pageList`, `lobbyTab`…), `userName`, `cellById`, `myNodes`, `lastPageId`, `bootstrap(wantedId)`, `defaultState`/`normalizeState` (= normalize.js), `demoData`, `bootstrap` (API → localStorage/demo), `toDocument`, `persist`/`save` (PUT debounced, 409 → recarga + `destree:reload`), selectores (`nodeById`, `childrenOf`, `roots`…).
- `js/core/history.js` — undo/redo (`pushHistory`, `undo`, `redo`, `updateUndoButtons`).
- `js/canvas/camera.js` — pan/zoom, `measureViewport`, `toWorld`/`toScreen`, `fitToScreen`, `animateCamera`.
- `js/canvas/render-nodes.js` — `sel`, mapas de tamaños/elementos, `renderNodes`, `computeSizes`, `freeSpot`; chips ◐ células (`visibilityChip`), asignados, responsable, ⎘ docs, ⇢ ocultas.
- `js/canvas/render-edges.js` — geometría y SVG de aristas, `updateEdgePaths`.
- `js/canvas/selection.js` — selección, `updateStatus`, `renderEmptyHint` (guía de página vacía), `renderAll`.
- `js/canvas/minimap.js` — `drawMinimap` + arrastre en minimapa.
- `js/canvas/pointer-gestures.js` — down/move/up: drag, pan, marquee, pinch, conexión, resize.
- `js/canvas/pointer-drag.js` — arrastre/guías/marquee/rueda/menú contextual; listeners del viewport.
- `js/canvas/keyboard.js` — atajos de teclado (solo efectos; lo importa `main.js`).
- `js/canvas/layout.js` — `computeLayout`, `autoLayout`, `animateNodesTo`.
- `js/ui/popover.js` — popover y menús (`showNewMenu`, `showNodeMenu`, `showEdgePopover`).
- `js/ui/connections.js` — reglas de conexión/anidamiento (`wouldCycle`, `proposeConnection`, `addEdge`).
- `js/ui/dialogs.js` — `confirmBox`, `promptBox`, `secretBox` (valor sensible mostrado una vez, con Copiar). `js/ui/node-drawer.js` — sidebar `#nodeDrawer` (`openDrawer`/`closeDrawer`/`showTab`, `instanceLabel`: Main/Child instance). `js/ui/card-editor.js` — `openEditor` (formulario por pestañas General · Staff · Documentación · Notas en el sidebar; integra las secciones de `card-editor-docs.js`; imagen vía uploader → `imageId`, `processImage` solo sin servidor).
- `js/ui/card-editor-docs.js` — `docsSection` (enlaces ≤20 + notas), `staffSection` (usuario/rol → `staff[]`, `owner` = staff[0]), `teamSection` (responsable, asignados), `visibilitySection` (raíz: org | células).
- `js/ui/uploader.js` — `uploadImage(file)`, `bindDropZone(el, onFile)` (drag&drop + pegar), `imageSrc(n, variant)`, `canUpload()`.
- `js/ui/markdown.js` — `renderMarkdown` (escape total; títulos, listas, enlaces http(s), código, negrita). `js/ui/node-view.js` — `openNodeView` ficha de lectura en el sidebar (mismas pestañas).
- `js/ui/node-actions.js` — eliminar/duplicar. `js/ui/theme.js` — tema, `toast`, `openShortcuts`.
- `js/ui/page-settings.js` (pestaña Tipos: `renderTypesTab`, `applyTypeNames` → `settings.typeNames`) — drawer de ajustes de página (antes `views/admin.js`): etiquetas, ramificaciones, responsables, datos import/export, ajustes; `renderPageTab` (nombre, descripción, visibilidad + células → PATCH, archivar), `enablePageTab()`, `colorPicker`.
- `js/views/admin-view.js` — `#/admin` overlay: Usuarios, Células, Páginas borradas (restaurar), Respaldos (crear/descargar/borrar, export/import org), Audit log paginado con filtro; `adminTabsFor()` por permisos.
- `js/views/users.js` — pestaña Usuarios: invitar (enlace copiable, sin correo; chips de células del invitado), invitaciones pendientes/revocar, usuarios con rol/activar y 🔑 restablecer contraseña (temporal generada en cliente, `secretBox`) (admin); P7: estado del correo + «Probar envío» (admin), chip enviada/pendiente por invitación.
- `js/views/account.js` — P3: `openAccountDialog()` (chip de usuario → Mi cuenta: nombre + cambio de contraseña vía `PATCH /api/me`), `tempPassword()`.
- `js/views/cells.js` — pestaña Células (admin: CRUD/color/lead; admin o head de la célula: miembros), `refreshCells()` → `S.cellList`.
- `js/views/me.js` — `openMyAssignments()` (`#/me`; multipágina vía `assignmentItems()`/`assignmentHTML()`), `goToNode(id)` (selecciona, centra, abre ficha).
- `js/views/versions-panel.js` — `openVersionsPanel()`: lista, Ver (árbol), Cambios (diff vs actual), Restaurar (→ `destree:load-page`), versión manual.
- `js/views/lobby.js` — `openLobby(tab)`/`closeLobby()`/`isLobbyOpen()`: grid de páginas, buscador, pestañas (Páginas, Archivadas, Borradas admin, Mis asignaciones), acciones por permiso.
- `js/views/auth-views.js` — `showSetup`, `showLogin({ mail })` (resuelve `'forgot'` al pulsar «¿Olvidaste tu contraseña?»), `showForgot`, `showReset(token)` (P7), `showInvite`, `hideAuth` sobre `#authView`; `ROLE_LABEL`.

## scripts/
- `lint.js` — `node --check` de todos los .js. `migrate.js` — aplica migraciones + seed. `import.js` — `node scripts/import.js archivo.json [pageId]` (ingiere dataURLs).
- `screenshots.js` — capturas `docs/img/{canvas,drawer,lobby}.png` para el README (Chrome headless + CDP, servidor con BD temporal y datos de ejemplo; `SCALE=2` para retina).
- `backup.js` — respaldo manual sin API. `restore.js` — restaura un tar.gz con el servidor parado. `smoke.js` — checklist en Chrome headless vía CDP sobre Fastify con DB temporal (setup, lienzo, célula/editor/ficha/#/me, lobby/cambio de página, #/admin + pestaña Página, upload/ingesta, historial, respaldos, estado vacío + Escape, viewport 360×740 sin desborde, invitación→designer readonly + ficha, P3 Mi cuenta (cambio de contraseña) y 🔑 restablecer, P7 estado de correo e invitación pendiente, logout/login; consola limpia).

## tests/
- `client.test.js` — index.html (estilos en orden, único módulo, sin inline), estructura ESM (sin `let` top-level, claves de `S`, imports↔exports, symlink normalize, alcance desde `main.js`).
- `schema.test.js` — fixture v2 valida tras normalizar; mutaciones inválidas fallan; migración v1. `api.test.js` — rutas con BD temporal (sesión admin), 200/409/428/400, import, reapertura.
- `mail.test.js` — P7: servidor SMTP falso en memoria; mailer (AUTH PLAIN, UTF-8, base64), invitación con/sin SMTP (`emailSent`, `emailSentAt`, `mailError`), forgot/reset (204 siempre, un solo uso, caducado, desactivado), `POST /api/mail/test`.
- `e2e.test.js` — P6: recorrido completo en una BD temporal (3 roles, página, visibilidad por célula, imagen, versiones, respaldo, cerrar sesiones), cabeceras de seguridad, logs sin secretos, SIGTERM en proceso real.
- `account.test.js` — P3: `PATCH /api/me` (403 actual incorrecta, 400, cierra las demás sesiones, name, audit sin contraseña, rate-limit) y restablecimiento por admin.
- `permissions.test.js` — matriz permisos, tabla ruta × rol (admin/head/designer/anónimo), origin-check + `skipOriginCheck`, invitaciones (410/404/revocar), último admin, sesiones invalidadas, rate-limit, audit_log. `helpers/auth.js` — `setupAdmin`, `login`, `inviteAndAccept`.
- `backup.test.js` — cron, tar válido, API, retención, restore (lib + CLI), lock, export/import org en instancia limpia, idempotencia.
- `versions.test.js` — autos/coalescencia/retención, diff, restore exacto, manual, designer, archive/delete/restore-deleted.
- `images.test.js` — sniff, upload → webp/thumb, 415/413, SVG rasterizado, documento solo imageId, `/uploads` 401/403/200/304, dedupe, 409 en uso, huérfanas, import legacy, embed, migración al arrancar.
- `pages.test.js` — visibilidad de página por célula en listado, PATCH meta, archivar/desarchivar, borrar (admin, export JSON) y restaurar, duplicar, asignaciones, 409 en PUT archivada.
- `visibility.test.js` — `filterDocumentForUser` (unidad) + API células/miembros/invitación con células, designer filtrado, `hasExternalRefs`, parches de nodo, docs+notes contra schema, 403/400.
- `fixtures/legacy-v2.json` — `export-actual.json` anonimizado (11 nodos, 9 aristas, v2).

## docs/
- `img/` — capturas del README (`canvas.png`, `drawer.png`, `lobby.png`), generadas por `scripts/screenshots.js`.
- `MAP.md` — este archivo. `DECISIONS.md` — append-only. `API.md` — endpoints. `SECURITY.md` — modelo de amenazas, medidas y cabeceras (P6). `INSTALL.md` (instalación, variables, actualización), `ADMIN.md` (administración), `USER.md` (uso del lienzo), 

## promo/ (motion graphics)
- `index.html` + `motion.css` + `timeline.js` (GSAP 3.12 desde cdnjs, línea de tiempo pausada/seekable) + `player.js` (escala 1920×1080 al viewport, play/scrub, `?render=1` expone `__seek`/`__duration`). `render.js` — vídeo 1080p vía Chrome headless (CDP, JPEG por fotograma): `.mp4` (por defecto) H.264 codificado dentro de Chrome con `encoder.js` (WebCodecs + mp4-muxer@5.2.2 desde jsdelivr, sin ffmpeg); `.webm` VP8 con el ffmpeg de Playwright (`~/Library/Caches/ms-playwright/ffmpeg-*`; `FFMPEG=` para otro binario). Env `BITRATE`, `MAX_SECONDS`. Salidas `promo/*.mp4|webm` gitignored.
