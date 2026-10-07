# API (F2)

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
| GET | `/api/me` | pages.read | — | `{ user{id,email,name}, org{id,name,slug}, role, permissions[], cellIds[] }` |
| POST | `/api/invites` | invite (head: solo designer) | `{ email, role, cellIds? }` | 201 `{ id, email, role, expiresAt, link, emailSent:false }` · 409 si el correo ya tiene cuenta |
| GET | `/api/invites` | invite | — | `{ invites: [{ id, email, role, cellIds, invitedBy, expiresAt, createdAt }] }` (pendientes) |
| DELETE | `/api/invites/:id` | invite | — | 204 · 404 |
| GET | `/api/invites/:token` | pública | — | `{ email, role, orgName, expiresAt }` · 404 · 410 caducada/usada |
| POST | `/api/invites/accept` | pública | `{ token, name?, password≥8 }` | 201 `{ user, invite }` + cookie · 410 |
| GET | `/api/users` | users.manage | — | `{ users: [{ id, email, name, role, isActive, lastLoginAt, createdAt }] }` |
| POST | `/api/users` | users.manage | `{ email, name?, password, role }` | 201 user · 409 correo repetido |
| PATCH | `/api/users/:id` | users.manage | `{ name?, role?, isActive? }` | user · 409 último admin / propia cuenta. Cambiar rol o desactivar cierra sus sesiones |
| DELETE | `/api/users/:id` | users.manage | — | 204 (desactiva; no borra) |
| GET | `/api/pages` | pages.read | — | `{ pages: [{ id, name, description, visibility, status, version, updatedAt, nodeCount }] }` |
| POST | `/api/pages` | pages.create | `{ name, description? }` | 201 + page-document (versión 1), `ETag` |
| GET | `/api/pages/:id` | pages.read | — | page-document v3 (`schema/page-document.schema.json`); `ETag: "<version>"` |
| PUT | `/api/pages/:id` | pages.edit | page-document v3 · `If-Match: "<version>"` | `{ version, nodes, edges, updatedAt }` + `ETag`. 400 schema · 409 `{ error:'conflict', version }` · 428 sin If-Match |
| POST | `/api/import?pageId=` | pages.import | JSON v1/v2/v3 (`nodes[]`, `edges[]`) | `{ pageId, version, nodes, edges, updatedAt }`. Sin If-Match: sustituye el contenido |

Notas
- PUT reemplaza el contenido completo en una transacción (tags, branch_types, nodes, node_tags, edges) y `version += 1`.
- El servidor normaliza (`server/lib/normalize.js`) tras validar; `page.name/description/visibility` solo cambian si vienen en `page`.
- `settings` persiste `{ snap, grid, minimap }`; `theme`/`tool` son preferencias del navegador.
- Límite de cuerpo 32 MB. `/` sirve `client/`; `/js/core/normalize.js` es el mismo módulo que usa el servidor.
