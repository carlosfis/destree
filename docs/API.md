# API

Base `/api`. JSON. Errores: `{ error, message, errors?, version?, setup? }` con `error` ∈ `validation|unauthorized|forbidden|not_found|conflict|gone|rate_limited|error`.
Auth: cookie `destree_sid` (HttpOnly, SameSite=Lax, `Secure` si `TRUST_PROXY`), 30 días. Sin sesión → 401 (`setup:true` si aún no hay usuarios). Rol sin la acción → 403. P10: roles por nivel (`admin` 5 · `ops` 4 · `head` 3 · `lead` 2 · `viewer` 1); cada acción tiene un nivel mínimo (matriz en `server/lib/permissions.js`, compartida con el cliente); el antiguo `designer` es `viewer`.
Cada ruta lleva `app.guard('action')` (hook onRequest; matriz en `server/lib/permissions.js`). Mutaciones (`POST/PUT/PATCH/DELETE`) pasan por origin-check: `Origin`/`Referer` debe coincidir con `Host`; rutas con `config.skipOriginCheck` exentas.
Rate-limit por IP → 429: cupo `auth` (10/15 min) en `/setup`, `/auth/login`, `/auth/forgot`, `/auth/reset`, `/invites/accept`, `PATCH /me`, `DELETE /org`; cupo `images` (60/min) en `POST /api/images`.
Cabeceras (P6): `X-Content-Type-Options: nosniff` y `Referrer-Policy` en todo; HTML/estáticos/uploads además con CSP estricta, `X-Frame-Options`, `Permissions-Policy` (ver `docs/SECURITY.md`). Los logs enmascaran el token de `GET /api/invites/:token` y nunca incluyen cookies ni cuerpos. Toda escritura deja fila en `audit_log`.
Validación: JSON Schema de `/schema` vía Ajv (`strict:false`, `allErrors`, ajv-formats). 400 → `errors: [{ path, message, keyword, params }]`.

| Método | Ruta | Acción | Cuerpo / cabeceras | Respuesta |
|---|---|---|---|---|
| GET | `/api/health` | pública | — | `{ ok, version, db, pages, time }` |
| GET | `/api/setup` | pública | — | `{ needed, mail }` (`needed` true si no hay usuarios; `mail` true si hay SMTP → el login ofrece recuperar contraseña) |
| POST | `/api/auth/forgot` | pública | `{ email }` | siempre 204 (si la cuenta existe, está activa y hay SMTP, envía un enlace `#/reset/<token>` válido 1 h; el envío es asíncrono) |
| POST | `/api/auth/reset` | pública | `{ token, password≥8 }` | `{ ok }`; cambia la contraseña, cierra todas las sesiones y consume el token · 404 token desconocido · 410 usado/caducado/cuenta desactivada |
| POST | `/api/mail/test` | org.settings (admin) | — | `{ sent, to }` (correo de prueba al admin) · 409 sin SMTP · 502 si el servidor SMTP falla |
| POST | `/api/setup` | pública (solo sin usuarios) | `{ orgName, name?, email, password≥8 }` | 201 + me, cookie · 409 si ya configurado |
| POST | `/api/auth/login` | pública | `{ email, password }` | me + cookie · 401 credenciales · 403 cuenta desactivada |
| POST | `/api/auth/logout` | sesión | — | 204, borra cookie |
| GET | `/api/me` | pages.read | — | `{ user{id,email,name}, org{id,name,slug,roleLabels{admin,ops,head,lead,viewer}}, role, permissions[], cellIds[], cells[{id,name,color}], mail }` |
| PATCH | `/api/me` | pages.read (cualquier rol) | `{ name? }` y/o `{ currentPassword, newPassword≥8 }` | me + `sessionsClosed` · 400 falta la actual o la nueva · 403 actual incorrecta. Cambiar la contraseña cierra las demás sesiones (la actual sigue); audit `user.password` (sin la contraseña) |
| DELETE | `/api/me/sessions` | pages.read | — | `{ sessionsClosed }` (cierra las demás sesiones del usuario; la actual sigue); audit `user.sessions` |
| GET | `/api/org` | users.read (nivel ≥4) | — | `{ id, name, slug, roleLabels }` (etiquetas fusionadas con las de defecto) |
| PATCH | `/api/org` | org.settings (admin) | `{ name?, roleLabels?{ ops, head, lead, viewer } (≤24) }` | org; etiquetas vacías o iguales al defecto no se guardan, Admin no se renombra; audit `org.update` |
| DELETE | `/api/org` | org.delete (admin) + rate-limit | `{ password, confirmName }` | 204 y borra la cookie: elimina páginas, versiones, células, usuarios, sesiones, invitaciones, imágenes y audit; vuelve al asistente (`GET /api/setup` → `needed:true`); los respaldos se conservan · 400 nombre distinto · 403 contraseña |
| POST | `/api/invites` | invite (nivel ≥2; solo roles asignables: por debajo del propio, nivel ≥4 también el suyo → si no 403; Lead solo a sus células) | `{ email, role, cellIds? }` | 201 `{ id, email, role, cellIds, expiresAt, link, emailSent, mailError? }` (con SMTP se envía el correo y `emailSent:true`; si falla, 201 con `emailSent:false` y `mailError`) · 409 correo con cuenta · 400 célula desconocida. Al aceptar, el usuario entra en `cell_members` |
| GET | `/api/invites` | invite | — | `{ invites: [{ id, email, role, cellIds, invitedBy, expiresAt, emailSentAt, createdAt }] }` (pendientes; sin `users.manage` solo las creadas por uno) |
| DELETE | `/api/invites/:id` | invite (sin `users.manage` solo las propias) | — | 204 · 404 |
| GET | `/api/invites/:token` | pública | — | `{ email, role, roleLabel, orgName, expiresAt }` · 404 · 410 caducada/usada |
| POST | `/api/invites/accept` | pública | `{ token, name?, password≥8 }` | 201 `{ user, invite }` + cookie · 410 |
| GET | `/api/users` | users.read (nivel ≥4) | — | `{ users: [{ id, email, name, role, isActive, lastLoginAt, createdAt, cellIds[], assignments[{ pageId, pageName, nodeId, name, type, isRoot, kind:'owner'\|'assignee' }] }] }` |
| POST | `/api/users` | users.manage (rol asignable) | `{ email, name?, password, role }` | 201 user · 403 rol por encima del propio · 409 correo repetido |
| PATCH | `/api/users/:id` | users.manage (cuenta de nivel ≤ propio; rol asignable) | `{ name?, role?, isActive?, password? }` | user · 403 nivel superior · 409 último admin / propia cuenta / propio rol. Cambiar rol, desactivar o fijar contraseña cierra sus sesiones |
| DELETE | `/api/users/:id` | users.manage (nivel ≤ propio) | — | 204 (desactiva; no borra) |
| GET | `/api/users/directory` | directory.read (nivel ≥2) | — | `{ users: [{ id, name, email, role }] }` (activos) |
| GET | `/api/cells` | cells.read (nivel ≥2) | — | `{ cells: [{ id, name, color, description, leadUserId, memberIds[], createdAt }] }` |
| POST | `/api/cells` | cells.manage (nivel ≥3) | `{ name, color?, description?, leadUserId? }` | 201 cell |
| PATCH | `/api/cells/:id` | cells.manage | `{ name?, color?, description?, leadUserId? }` | cell · 404 |
| DELETE | `/api/cells/:id` | cells.manage | — | 204 (cascada: miembros, node_cells, page_cells) |
| PUT | `/api/cells/:id/members` | cells.members (nivel ≥3 cualquier célula; Lead si es lead/miembro → si no 403) | `{ userIds[] }` | cell (ids ajenos ignorados; el lead siempre queda) |
| PATCH | `/api/pages/:pageId/nodes/:nodeId/visibility` | pages.visibility (nivel ≥3) | `{ visibility:'org'\|'cells', cellIds? }` | `{ version, node, updatedAt }` · 400 si no es raíz · 404 |
| PUT | `/api/pages/:pageId/nodes/:nodeId/assignees` | nodes.assign (nivel ≥2; nodo visible para quien asigna → si no 404) | `{ assigneeIds[] }` | `{ version, node, updatedAt }` |
| PATCH | `/api/pages/:pageId/nodes/:nodeId/owner` | nodes.assign (nodo visible) | `{ ownerUserId\|null }` | `{ version, node, updatedAt }` · 400 usuario desconocido |
| PATCH | `/api/pages/:pageId/nodes/:nodeId` | nodes.own (todos; sin `pages.edit` solo si es responsable o asignado → si no 403) | `{ name?, description?, notes?, docs?, staff?, imageId?, tags?, geo?, thumbIconId?, status? }` | `{ version, node, updatedAt }` (normaliza como el PUT; otros campos se descartan); audit `node.update` · 404 · 409 página no activa |
| POST | `/api/images?kind=node\|page&filename=` | nodes.own (cualquier rol) | cuerpo binario `image/png\|jpeg\|webp\|svg+xml` ≤5 MB (tipo real por magic bytes) | 201 `{ id, kind, filename, mime:'image/webp', width, height, bytes, sha256, url, thumbUrl }` · 413 · 415 |
| DELETE | `/api/images/:id` | pages.edit | — | 204 · 409 en uso |
| GET | `/uploads/:id` · `/uploads/:id/thumb` | sesión + visibilidad (regla 5) | `If-None-Match` | `image/webp`, `Cache-Control: private, max-age=86400`, ETag · 304 · 401 · 403 · 404 |
| GET | `/api/pages/:id/versions` | versions.read | — | `{ versions: [{ id, number, label, reason, hash, size, createdBy, createdByName, createdAt }] }` (desc) |
| POST | `/api/pages/:id/versions` | versions.write | `{ label? }` | 201 version (reason manual) |
| GET | `/api/pages/:id/versions/:n` | versions.read | — | `{ version, document }` (lead/viewer: filtrado) · 404 |
| GET | `/api/pages/:id/versions/:a/diff/:b` | versions.read | `a`,`b` número o `current` | `{ from, to, diff: { nodes:{added,removed,changed[{id,name,fields}],moved}, edges:{added,removed}, tags, branchTypes, same } }` |
| POST | `/api/pages/:id/versions/:n/restore` | versions.write | — | `{ version, nodes, edges, updatedAt, restoredFrom, snapshot }` + `ETag` · 409 página no activa |
| GET | `/api/backups` | backups (nivel ≥4) | — | `{ backups: [{ id, filename, bytes, sha256, kind, status, error, createdBy, createdAt }], dir }` |
| POST | `/api/backups` | backups | — | 201 backup (tar.gz: destree.db + uploads/ + MANIFEST.json) |
| GET | `/api/backups/:id/download` | backups | — | `application/gzip` attachment · 404 |
| DELETE | `/api/backups/:id` | backups | — | 204 |
| GET | `/api/org/export?images=manifest\|embed` | backups | — | `org-export.schema.json` (attachment JSON) |
| POST | `/api/org/import` | org.import (solo admin) | org-export (≤512 MB; `role:'designer'` → viewer; `org.settings.roleLabels` saneadas) | `{ cells, users, pages, versions, images, skippedImages }` · 400 schema |
| GET | `/api/audit?limit&before&action` | audit.read (nivel ≥4) | `limit` 1–200 (defecto 50), `before` id, `action` prefijo | `{ items: [{ id, userId, userName, action, entity, entityId, meta, createdAt }], next }` (más recientes primero) |
| GET | `/api/me/assignments` | pages.read | — | `{ items: [{ pageId, pageName, pageStatus, nodeId, name, type, isRoot, role:'owner'\|'assignee' }] }` en páginas visibles (no borradas) |
| GET | `/api/pages/:pageId/nodes/:nodeId/project` | pages.read (card visible → si no 404) | — | P11 `project.schema.json` + `canEdit`: `{ settings{ tagline, sprintWeeks, sprintOffset }, sections[{ id, position, kind, title, data }], phases[{ id, position, name, color }], activities[{ id, position, phaseId, title, description, tag, assignee, startDate, endDate, status }], updatedAt, canEdit }`. La primera lectura crea la plantilla del Overview (9 secciones con los enlaces, descripción y staff de la card) |
| PATCH | `/api/pages/:pageId/nodes/:nodeId/project` | projects.edit (todos; sin `pages.edit` solo responsable/asignado → si no 403) | `{ tagline?≤300, sprintWeeks? 1–8, sprintOffset? }` | settings · 409 página no activa; audit `project.settings` |
| POST | `…/project/sections` | projects.edit (misma regla) | `{ kind: links\|text\|timeline\|cards\|quote\|goals\|checklist\|people, title?≤80, data?, position? }` | 201 section (`data` saneado según el tipo: claves ajenas fuera, ≤50 ítems, enlaces solo http(s)); máx. 40 |
| PATCH | `…/project/sections/:id` | projects.edit | `{ title?, data?, position? }` | section (`kind` no cambia; `position` reordena) · 404 |
| DELETE | `…/project/sections/:id` | projects.edit | — | 204 · 404 |
| POST | `…/project/phases` | projects.edit | `{ name, color? #rrggbb, position? }` | 201 phase (color de la paleta si no se indica); máx. 30 |
| PATCH | `…/project/phases/:id` | projects.edit | `{ name?, color?, position? }` | phase · 404 |
| DELETE | `…/project/phases/:id` | projects.edit | — | 204; sus actividades quedan sin fase (solo kanban) |
| POST | `…/project/activities` | projects.edit | `{ title≤120, description?≤600, tag?≤4 (mayúsculas), assignee?≤80 (`@` automático), phaseId?, startDate? YYYY-MM-DD, endDate?, status? todo\|doing\|done\|cancelled, position? }` | 201 activity · 400 fecha inválida, fin < inicio, fase desconocida; máx. 500. Con fase + inicio aparece en el cronograma |
| PATCH | `…/project/activities/:id` | projects.edit | mismos campos (`status` = mover en el kanban) | activity · 404 |
| DELETE | `…/project/activities/:id` | projects.edit | — | 204 (las canceladas se conservan con `status:'cancelled'`; borrar es explícito) |
| GET | `/api/pages?status=` | pages.read | `status` active (defecto) \| archived \| deleted (nivel ≥4) \| all | `{ pages: [{ id, name, description, visibility, cellIds, status, version, createdAt, updatedAt, archivedAt, deletedAt, nodeCount, rootCount }] }` (designer: solo visibles, regla 2) |
| PATCH | `/api/pages/:id` | pages.visibility (nivel ≥3); `name`/`description` exigen pages.meta (nivel ≥4) → si no 403 | `{ name?, description?, visibility?, cellIds? }` | page meta (+`cellIds`), `ETag`; version += 1 · 409 borrada |
| POST | `/api/pages/:id/archive` · `/unarchive` | pages.archive | — | page meta · 409 estado repetido / borrada |
| DELETE | `/api/pages/:id` | pages.delete (nivel ≥4) | — | page meta (antes crea versión `delete`) · 409 única activa |
| POST | `/api/pages/:id/restore-deleted` | pages.delete (nivel ≥4) | — | page meta (status active; `restoredFromVersion` si repuso la última versión) |
| POST | `/api/pages/:id/duplicate` | pages.create | `{ name? }` \| null | 201 page-document nuevo (copia contenido, células, asignados) |
| POST | `/api/pages` | pages.create | `{ name, description?, visibility?, cellIds? }` | 201 + page-document (versión 1), `ETag` |
| GET | `/api/pages/:id?embedImages=1` | pages.read | `embedImages` incrusta `image` como dataURL webp (export portable) | page-document v3 + `refs { users[{id,name}], cells[{id,name,color}] }`; `ETag: "<version>"`. Lead/Viewer: filtrado por `lib/visibility.js` (raíces org / de sus células / donde está asignado o es responsable; aristas solo con ambos extremos; `hasExternalRefs`); 403 si la página es solo-células ajena |
| PUT | `/api/pages/:id` | pages.edit (nivel ≥2; la página debe ser visible → si no 403) | page-document v3 · `If-Match: "<version>"` | `{ version, nodes, edges, updatedAt }` + `ETag`. 400 schema · 409 `{ error:'conflict', version }` o página archivada/borrada · 428 sin If-Match |
| POST | `/api/import?pageId=` | pages.import | JSON v1/v2/v3 (`nodes[]`, `edges[]`) | `{ pageId, version, nodes, edges, updatedAt }`. Sin If-Match: sustituye el contenido |

Notas
- P10: si quien guarda tiene visibilidad parcial (Lead), el servidor reinyecta antes de guardar los nodos y aristas que no ve (`reconcileForEditor`), así nada se pierde; sin `pages.visibility` las raíces conservan la visibilidad/células que tenían en BD.
- F6a: PUT crea versión `auto` si cambia el hash (coalescencia 5 min por usuario); import → `import`; archive → `archive`; delete → `delete`. Retención `VERSIONS_KEEP` (50) solo sobre autos.
- F5: PUT e import convierten `nodes[].image` (dataURL) en archivos (`imageId`); el servidor nunca persiste dataURL; `imageId` desconocido se descarta.
- P9: `nodes[].geo` (ISO 3166-1 alfa-2 en mayúsculas o `''`) y `nodes[].thumbIconId` (icono del thumbnail, `images.id`; desconocido → `null`). Una imagen referenciada solo como `thumbIconId` cuenta como en uso (no se purga; `DELETE /api/images/:id` → 409). El thumbnail se genera en el cliente; no hay endpoint.
- PUT reemplaza el contenido completo en una transacción (tags, branch_types, nodes, node_tags, edges, node_cells, node_assignees) y `version += 1`. `cellIds` solo cuenta en raíces `visibility:'cells'`; ids de célula/usuario desconocidos se descartan.
- El servidor normaliza (`server/lib/normalize.js`) tras validar; `page.name/description/visibility` solo cambian si vienen en `page`.
- `settings` persiste `{ snap, grid, minimap }`; `theme`/`tool` son preferencias del navegador.
- Enlaces de invitación y de reset usan `PUBLIC_URL` si está definida; si no, protocolo y host de la petición (`X-Forwarded-*` detrás de proxy).
- Límite de cuerpo 32 MB. `/` sirve `client/`; `/js/core/normalize.js` es el mismo módulo que usa el servidor.
