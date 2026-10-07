# API (F5)

Base `/api`. JSON. Errores: `{ error, message, errors?, version?, setup? }` con `error` ∈ `validation|unauthorized|forbidden|not_found|conflict|gone|rate_limited|error`.
Auth: cookie `destree_sid` (HttpOnly, SameSite=Lax, `Secure` si `TRUST_PROXY`), 30 días. Sin sesión → 401 (`setup:true` si aún no hay usuarios). Rol sin la acción → 403.
Cada ruta lleva `app.guard('action')` (hook onRequest; matriz en `server/lib/permissions.js`). Mutaciones (`POST/PUT/PATCH/DELETE`) pasan por origin-check: `Origin`/`Referer` debe coincidir con `Host`; rutas con `config.skipOriginCheck` exentas.
Rate-limit (10/15 min por IP → 429) en `/setup`, `/auth/login`, `/invites/accept`. Toda escritura deja fila en `audit_log`.
Validación: JSON Schema de `/schema` vía Ajv (`strict:false`, `allErrors`, ajv-formats). 400 → `errors: [{ path, message, keyword, params }]`.

| Método | Ruta | Acción | Cuerpo / cabeceras | Respuesta |
|---|---|---|---|---|
| GET | `/api/health` | pública | — | `{ ok, version, db, pages, time }` |
| GET | `/api/setup` | pública | — | `{ needed }` (true si no hay usuarios) |
| POST | `/api/setup` | pública (solo sin usuarios) | `{ orgName, name?, email, password≥8 }` | 201 + me, cookie · 409 si ya configurado |
| POST | `/api/auth/login` | pública | `{ email, password }` | me + cookie · 401 credenciales · 403 cuenta desactivada |
| POST | `/api/auth/logout` | sesión | — | 204, borra cookie |
| GET | `/api/me` | pages.read | — | `{ user{id,email,name}, org{id,name,slug}, role, permissions[], cellIds[], cells[{id,name,color}] }` |
| POST | `/api/invites` | invite (head: solo designer, solo a sus células) | `{ email, role, cellIds? }` | 201 `{ id, email, role, cellIds, expiresAt, link, emailSent:false }` · 409 correo con cuenta · 400 célula desconocida. Al aceptar, el usuario entra en `cell_members` |
| GET | `/api/invites` | invite | — | `{ invites: [{ id, email, role, cellIds, invitedBy, expiresAt, createdAt }] }` (pendientes) |
| DELETE | `/api/invites/:id` | invite | — | 204 · 404 |
| GET | `/api/invites/:token` | pública | — | `{ email, role, orgName, expiresAt }` · 404 · 410 caducada/usada |
| POST | `/api/invites/accept` | pública | `{ token, name?, password≥8 }` | 201 `{ user, invite }` + cookie · 410 |
| GET | `/api/users` | users.manage | — | `{ users: [{ id, email, name, role, isActive, lastLoginAt, createdAt }] }` |
| POST | `/api/users` | users.manage | `{ email, name?, password, role }` | 201 user · 409 correo repetido |
| PATCH | `/api/users/:id` | users.manage | `{ name?, role?, isActive? }` | user · 409 último admin / propia cuenta. Cambiar rol o desactivar cierra sus sesiones |
| DELETE | `/api/users/:id` | users.manage | — | 204 (desactiva; no borra) |
| GET | `/api/users/directory` | directory.read (admin/head) | — | `{ users: [{ id, name, email, role }] }` (activos) |
| GET | `/api/cells` | cells.read (admin/head) | — | `{ cells: [{ id, name, color, description, leadUserId, memberIds[], createdAt }] }` |
| POST | `/api/cells` | cells.manage | `{ name, color?, description?, leadUserId? }` | 201 cell |
| PATCH | `/api/cells/:id` | cells.manage | `{ name?, color?, description?, leadUserId? }` | cell · 404 |
| DELETE | `/api/cells/:id` | cells.manage | — | 204 (cascada: miembros, node_cells, page_cells) |
| PUT | `/api/cells/:id/members` | cells.members (admin; head si es lead/miembro → si no 403) | `{ userIds[] }` | cell (ids ajenos ignorados; el lead siempre queda) |
| PATCH | `/api/pages/:pageId/nodes/:nodeId/visibility` | pages.edit | `{ visibility:'org'\|'cells', cellIds? }` | `{ version, node, updatedAt }` · 400 si no es raíz · 404 |
| PUT | `/api/pages/:pageId/nodes/:nodeId/assignees` | pages.edit | `{ assigneeIds[] }` | `{ version, node, updatedAt }` |
| PATCH | `/api/pages/:pageId/nodes/:nodeId/owner` | pages.edit | `{ ownerUserId\|null }` | `{ version, node, updatedAt }` · 400 usuario desconocido |
| POST | `/api/images?kind=node\|page&filename=` | pages.edit | cuerpo binario `image/png\|jpeg\|webp\|svg+xml` ≤5 MB (tipo real por magic bytes) | 201 `{ id, kind, filename, mime:'image/webp', width, height, bytes, sha256, url, thumbUrl }` · 413 · 415 |
| DELETE | `/api/images/:id` | pages.edit | — | 204 · 409 en uso |
| GET | `/uploads/:id` · `/uploads/:id/thumb` | sesión + visibilidad (regla 5) | `If-None-Match` | `image/webp`, `Cache-Control: private, max-age=86400`, ETag · 304 · 401 · 403 · 404 |
| GET | `/api/audit?limit&before&action` | audit.read (admin) | `limit` 1–200 (defecto 50), `before` id, `action` prefijo | `{ items: [{ id, userId, userName, action, entity, entityId, meta, createdAt }], next }` (más recientes primero) |
| GET | `/api/me/assignments` | pages.read | — | `{ items: [{ pageId, pageName, pageStatus, nodeId, name, type, isRoot, role:'owner'\|'assignee' }] }` en páginas visibles (no borradas) |
| GET | `/api/pages?status=` | pages.read | `status` active (defecto) \| archived \| deleted (admin) \| all | `{ pages: [{ id, name, description, visibility, cellIds, status, version, createdAt, updatedAt, archivedAt, deletedAt, nodeCount, rootCount }] }` (designer: solo visibles, regla 2) |
| PATCH | `/api/pages/:id` | pages.edit | `{ name?, description?, visibility?, cellIds? }` | page meta (+`cellIds`), `ETag`; version += 1 · 409 borrada |
| POST | `/api/pages/:id/archive` · `/unarchive` | pages.archive | — | page meta · 409 estado repetido / borrada |
| DELETE | `/api/pages/:id` | pages.delete (admin) | — | page meta + `file` (JSON en `data/deleted/`) · 409 única activa |
| POST | `/api/pages/:id/restore-deleted` | pages.delete (admin) | — | page meta (status active) |
| POST | `/api/pages/:id/duplicate` | pages.create | `{ name? }` \| null | 201 page-document nuevo (copia contenido, células, asignados) |
| POST | `/api/pages` | pages.create | `{ name, description?, visibility?, cellIds? }` | 201 + page-document (versión 1), `ETag` |
| GET | `/api/pages/:id?embedImages=1` | pages.read | `embedImages` incrusta `image` como dataURL webp (export portable) | page-document v3 + `refs { users[{id,name}], cells[{id,name,color}] }`; `ETag: "<version>"`. Designer: filtrado por `lib/visibility.js` (raíces org / de sus células / donde está asignado o es responsable; aristas solo con ambos extremos; `hasExternalRefs`); 403 si la página es solo-células ajena |
| PUT | `/api/pages/:id` | pages.edit | page-document v3 · `If-Match: "<version>"` | `{ version, nodes, edges, updatedAt }` + `ETag`. 400 schema · 409 `{ error:'conflict', version }` o página archivada/borrada · 428 sin If-Match |
| POST | `/api/import?pageId=` | pages.import | JSON v1/v2/v3 (`nodes[]`, `edges[]`) | `{ pageId, version, nodes, edges, updatedAt }`. Sin If-Match: sustituye el contenido |

Notas
- F5: PUT e import convierten `nodes[].image` (dataURL) en archivos (`imageId`); el servidor nunca persiste dataURL; `imageId` desconocido se descarta.
- PUT reemplaza el contenido completo en una transacción (tags, branch_types, nodes, node_tags, edges, node_cells, node_assignees) y `version += 1`. `cellIds` solo cuenta en raíces `visibility:'cells'`; ids de célula/usuario desconocidos se descartan.
- El servidor normaliza (`server/lib/normalize.js`) tras validar; `page.name/description/visibility` solo cambian si vienen en `page`.
- `settings` persiste `{ snap, grid, minimap }`; `theme`/`tool` son preferencias del navegador.
- Límite de cuerpo 32 MB. `/` sirve `client/`; `/js/core/normalize.js` es el mismo módulo que usa el servidor.
