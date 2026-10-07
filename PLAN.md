# DesTree — Plan de desarrollo

Fuente única de verdad para agencias: árbol de software, DS, UI Kits, responsables, documentación y métricas Figma. Autoalojado, multi-página, con roles.

## 0. Decisiones (stack, por qué en una línea cada una)

| Pieza | Decisión | Por qué |
|---|---|---|
| Runtime | Node 22 LTS | Node 20 EOL abril 2026 |
| Backend | Fastify 5 (JS ESM, sin TS) + Ajv nativo con `ajv: { customOptions: { strict: false, allErrors: true }, plugins: [ajvFormats] }` | Los JSON Schema de `/schema` validan rutas; strict por defecto rechaza `$schema` draft-07/`format` sin ajv-formats |
| Validación | JSON Schema draft-07 en `/schema` + `ajv-formats` | Requisito del usuario; fuente de verdad única para API, import/export y tests |
| DB | SQLite vía `node:sqlite` (WAL) + migraciones SQL numeradas (F1: better-sqlite3 descartado por crash en Node 24) | Un archivo = backup/restore trivial; sin binario nativo |
| Binarios nativos | Aceptado: sharp (prebuilds glibc+musl; imagen multi-arch con buildx) | Rendimiento y validación real de imágenes; se compila en stage de build |
| Frontend | Vanilla JS + CSS, sin bundler ni framework | Conserva el 100% del canvas actual; split por secciones; sin build |
| Módulos | F0a: scripts clásicos en orden (`<script src>`, globales compartidas) · F0b: ESM con objeto mutable `S` (`S.state`, `S.cam`, `S.ptr`…) | Las secciones reasignan bindings top-level (`state`, `cam`, `ptr`, `vpRect`, `popoverOpen`…); imports ESM son solo lectura |
| Router | Hash (`#/login`, `#/lobby`, `#/p/:id`, `#/admin`, `#/me`) | Sin servidor de SPA, sirve estático |
| Auth | Sesiones propias (cookie httpOnly+SameSite), bcryptjs (JS puro), invitaciones por token hasheado | Sin IdP externo; sin dependencia nativa extra para auth |
| Imágenes | @fastify/multipart + sharp (magic bytes, re-encode webp, thumb 320px) | Nunca dataURL en DB; validación real del tipo |
| Email | nodemailer, SMTP opcional; sin SMTP = enlace copiable | Funciona en instalaciones sin correo |
| Jobs | node-cron en el mismo proceso | Backups y polling Figma sin Redis |
| Figma | PAT cifrado AES-256-GCM + REST solo lectura + webhooks v2 + plugin companion | La API no crea/borra/comparte archivos; workaround honesto |
| Figma plan_tier | Configuración manual en admin (`starter|pro|org|enterprise`); actualización oportunista si llega `X-Figma-Plan-Tier` en un 429 | El header solo aparece en respuestas 429 |
| CORS | Solo `POST /api/figma/report` (`@fastify/cors` scoped; origin `null`/`https://www.figma.com`); excluido del Origin-check y de CSP | El plugin corre en iframe de Figma |
| Deploy | Docker multi-stage `node:22-bookworm-slim` (alpine opcional) + compose con volumen `/data`; Caddy opcional | `git clone && cp .env.example .env && docker compose up -d` |
| CI/CD | GitHub Actions: ci.yml (lint+test), release.yml (tag v* → GHCR multi-arch amd64/arm64 + Release; `permissions: contents: write, packages: write`) | Cualquiera descarga una versión estable |
| Tests | node:test + fixtures pequeñas + mocks HTTP Figma | Sin frameworks; `npm test` como única verificación |
| Concurrencia | PUT de documento con `If-Match: version` → 409 | Evita pisadas head/admin |
| Feature flag | Sin PAT la app funciona completa | Figma es opcional |
| Secretos | `SERVER_SECRET` obligatorio; PAT nunca en respuestas/logs (test) | Seguridad autoalojada |
| Borrado | Archivar ≠ borrar; borrar = soft delete solo admin con snapshot final conservado | Req 3: historial siempre consultable |

Registro continuo: `docs/DECISIONS.md` (append-only, 1 línea por decisión).

## 1. Estructura del repositorio (árbol)

```
destree/
  CLAUDE.md                 ≤60 líneas: qué es, comandos, mapa, reglas, "Estado actual" (3 líneas)
  PLAN.md                   este plan
  README.md  LICENSE(MIT)  CHANGELOG.md  CONTRIBUTING.md  .env.example  .gitignore
  Dockerfile  docker-compose.yml  Caddyfile  package.json
  .github/workflows/ci.yml  release.yml   .github/ISSUE_TEMPLATE/
  schema/                   FUENTE DE VERDAD (JSON Schema draft-07)
    page-document.schema.json  node.schema.json  edge.schema.json  tag.schema.json
    branch-type.schema.json  page.schema.json  org-export.schema.json  figma-report.schema.json
    figma-webhook-event.schema.json
  server/
    index.js  config.js
    db/sqlite.js  db/migrations/001_core.sql … 011_plugin.sql
    lib/permissions.js  lib/visibility.js  lib/crypto.js  lib/mailer.js  lib/backup.js  lib/audit.js
    lib/normalize.js (compartido con cliente)
    lib/figma/client.js  sync.js  webhooks.js  invites.js  projects.js  url.js
    plugins/session.js  plugins/guard.js  plugins/origin-check.js
    routes/auth.js  setup.js  users.js  invites.js  cells.js  pages.js  nodes.js  images.js
           versions.js  backups.js  figma.js  figma-webhook.js  figma-report.js  health.js
  client/
    index.html
    css/01-theme.css … 10-responsive.css  lobby.css  admin.css  views.css
    js/main.js (router)
    js/core/{api.js,state.js,history.js,normalize.js,readonly.js}
    js/canvas/{camera.js,render-nodes.js,render-edges.js,selection.js,minimap.js,pointer.js,keyboard.js,layout.js}
    js/ui/{popover.js,dialogs.js,card-editor.js,page-settings.js,toasts.js,theme.js,connections.js,uploader.js}
    js/views/{setup.js,login.js,invite.js,lobby.js,admin.js,my-assignments.js,figma-panel.js,versions-panel.js}
  figma-plugin/             DesTree Companion: manifest.json  code.js  ui.html  README.md
  docs/
    MAP.md (1 línea por archivo)  DECISIONS.md  INSTALL.md  ADMIN.md  USER.md  FIGMA.md  API.md  SECURITY.md
    handoff/TEMPLATE.md  F0a.md  F0b.md  F1.md … F11b.md
  scripts/migrate.js  create-admin.js  backup.js  restore.js  gen-api-docs.js
  tests/  schema.test.js  permissions.test.js  visibility.test.js  images.test.js  versions.test.js
          figma.test.js  webhook.test.js  api.test.js
          fixtures/{legacy-v2.json,five-nodes.json,figma-file-meta.json,figma-webhook-file-update.json}
  legacy/arbol.html         original intacto; NUNCA leerlo entero
  data/                     gitignored: destree.db  uploads/  backups/
```

## 2. Modelo de datos (entidades + campos)

JSON Schema vive en `/schema`; las migraciones SQL en `server/db/migrations`. Esta tabla es resumen, no duplicado. IDs texto (ULID), timestamps ISO.

| Entidad | Campos clave |
|---|---|
| orgs | id, name, slug, settings_json{locale, figma_template_url}, created_at |
| users | id, email UNIQUE, name, password_hash, is_active, last_login_at, created_at |
| memberships | user_id, org_id, role `admin\|head\|designer` · PK(user_id, org_id) |
| sessions | id, user_id, expires_at, ua, ip |
| invites | id, org_id, email, role, cell_ids_json, token_hash, invited_by, expires_at, used_at |
| cells | id, org_id, name, color, description, lead_user_id |
| cell_members | cell_id, user_id · PK |
| pages | id, org_id, name, description, visibility `org\|cells`, status `active\|archived\|deleted`, deleted_at, cover_image_id, settings_json{snap,grid,minimap}, camera_json, version (optimista), created_by, updated_at |
| page_cells | page_id, cell_id · PK |
| tags | id, page_id, name, color |
| branch_types | id, page_id, name, color (= edgeTypes actuales) |
| nodes | id, page_id, type `software\|ds\|uikit`, name, description ≤140, notes (markdown ≤4000), docs_json `[{label,url}]` (≤20), image_id, owner_user_id, owner_label (legado "@ana"), parent_id (NULL = raíz), branch_type_id, x, y, w, h, demo, visibility `org\|cells\|inherit` (raíz: org/cells; hijos: inherit), status `active\|draft\|deprecated\|archived`, updated_at |
| node_cells | node_id, cell_id · PK (solo raíces visibility=cells) |
| node_assignees | node_id, user_id · PK |
| node_tags | node_id, tag_id · PK |
| edges | id, page_id, kind `ds\|source`, from_node_id, to_node_id, demo · UNIQUE(page_id, kind, from, to) |
| images | id, org_id, kind `node\|page\|figma-thumb`, filename, mime, width, height, bytes, sha256, created_by · archivo `/data/uploads/<org>/<id>.webp` + `<id>.thumb.webp` |
| page_versions | id, page_id, number, label, reason `auto\|manual\|restore\|import\|archive\|delete`, snapshot_gz (page-document), hash, size, created_by, created_at |
| backups | id, org_id (NULL = global), filename, bytes, sha256, kind `manual\|scheduled`, status, created_by, created_at |
| audit_log | id, org_id, user_id, action, entity, entity_id, meta_json, created_at |
| figma_connections | org_id PK, pat_encrypted, team_id, plan_tier `starter\|pro\|org\|enterprise` (manual; oportunista en 429), seat_type `view\|collab\|dev\|full` (manual), is_team_admin (manual), plugin_token_hash, smtp_json, last_ok_at, last_error |
| figma_projects | id, org_id, figma_project_id, name, linked_cell_id, linked_node_id, synced_at |
| figma_files | id, node_id UNIQUE, org_id, file_key UNIQUE, figma_project_id, name, editor_type `design\|figjam`, thumbnail_image_id, last_modified, version, link_access, components_local, component_sets_local, components_published, component_sets_published, variables_count, variable_collections_count, counts_source `rest\|plugin\|null`, counts_synced_at, status `pending\|linked\|deleted_in_figma\|archived\|error`, sync_error, created_by |
| figma_invitations | id, figma_file_id, emails_json, sent_at, sent_by, status `pending\|sent\|confirmed\|failed`, note |
| figma_webhooks | id, org_id, figma_webhook_id, context `team\|project\|file`, context_id, event_type, passcode_hash, status |
| figma_events | id, org_id, event_type, file_key, payload_json, received_at, processed_at |

`page-document.schema.json` = `{ version:3, page, nodes[], edges[], tags[], branchTypes[] }`: mismo shape que el state actual + campos nuevos opcionales. Es lo que viaja en GET/PUT, import/export y snapshots. `normalizeState` migra v1/v2 → v3. `org-export.schema.json` = `{ version:3, org, cells, users(sin hash), pages[], images(manifest) }`.

Reglas de borrado: archivar página/raíz = cambio de status, reversible, sin tocar versiones. Borrar página = solo admin, soft delete (`status=deleted`) con snapshot final `reason=delete`; versiones se conservan; admin restaura desde `#/admin` → Páginas borradas. Retención auto nunca purga versiones manuales, `archive`, `delete` ni versiones de páginas archived/deleted. Purga física solo vía script explícito.

## 3. Modelo de permisos

Rol por org (`memberships.role`). Matriz única en `server/lib/permissions.js` → `can(ctx, action, resource)`; `guard('action')` como preHandler en toda ruta. Cliente solo oculta UI según `GET /api/me`. Toda mutación escribe `audit_log`.

| Acción | admin (Ops) | head | designer |
|---|---|---|---|
| Usuarios, roles, activar/desactivar | ✓ | ✗ | ✗ |
| Invitar | cualquier rol | solo designer a sus células | ✗ |
| Células CRUD + miembros | ✓ | ver; miembros de sus células | ✗ |
| Settings org, conexión Figma (PAT, webhooks, SMTP) | ✓ | ✗ | ✗ |
| Backups / restore / export org | ✓ | ✗ | ✗ |
| Pages crear/editar/archivar/visibilidad | ✓ | ✓ | ✗ |
| Pages borrar (soft) / restaurar borrada | ✓ | ✗ | ✗ |
| Nodos, aristas, tags, tipos de rama, layout, import | ✓ | ✓ | ✗ |
| Documentación de nodo (notes, docs[]) | ✓ | ✓ | ✗ (lee) |
| Visibilidad de raíz, células, asignados, responsable | ✓ | ✓ | ✗ |
| Vincular Figma, resync, enviar invitaciones, crear/archivar | ✓ | ✓ | ✗ |
| Versiones: ver | ✓ | ✓ | ✓ (lo visible) |
| Versiones: crear manual / restaurar | ✓ | ✓ | ✗ |
| Export JSON de página | completo | completo | solo lo visible, sin imágenes originales |
| Ver canvas / métricas Figma / docs | todo | todo | solo visible, modo lectura |
| Audit log | ✓ | ✗ | ✗ |

Reglas: último admin no se degrada; invitado hereda rol y células de la invitación; usuario puede estar en varias orgs con rol distinto; designer recibe 403 en cualquier mutación.

**Visibilidad (server-side, `lib/visibility.js`, aplicada al construir el documento):**
1. admin/head ven todo en su org.
2. Página visible para designer si `visibility=org` ∨ `page_cells ∩ cells(user) ≠ ∅` ∨ está asignado a algún nodo de la página.
3. Raíz visible para designer si `visibility=org` ∨ `node_cells ∩ cells(user) ≠ ∅` ∨ asignado/responsable en la raíz o cualquier descendiente. Hijos heredan (`inherit`); hijo de raíz oculta nunca se envía.
4. Aristas solo si ambos extremos visibles; nodo con aristas omitidas lleva `hasExternalRefs=true`.
5. `GET /uploads/:id` valida que el usuario vea el nodo/página dueño de la imagen (403).
6. Un solo recorrido: calcular visibilidad por raíz, propagar a descendientes, filtrar aristas.

## 4. Estrategia Figma

Principio: honesto con la REST API (solo lectura de archivos/proyectos). Todo detrás de feature flag: sin PAT la app funciona completa.

| Requisito | API | Qué hace DesTree |
|---|---|---|
| Crear archivo | ✗ (no hay POST /files ni duplicar) | Nodo con `figma_files.status=pending` + botón "Crear en Figma" → deep-link `https://www.figma.com/new` o plantilla de org (`figma_template_url`, instrucción Duplicar) → usuario pega URL → `lib/figma/url.js` regex `/(file|design)\/([A-Za-z0-9]+)/` (FigJam `board` rechazado con mensaje) → file_key → sync |
| Crear/eliminar proyecto | ✗ (solo GET teams/:id/projects; no OAuth público) | Deep-link `https://www.figma.com/files/team/:team_id` + instrucción; sync de proyectos (PAT) y vínculo proyecto ↔ raíz/célula; "Importar archivos no vinculados" desde `GET /v1/projects/:id/files` crea nodos DS/UIKit |
| Eliminar archivo | ✗ | "Archivar" interno + deep-link para borrar; webhook `FILE_DELETE` → `deleted_in_figma` |
| Invitar editores por correo | ✗ (sin API de sharing; SCIM solo provisiona usuarios) | Correo propio SMTP con deep-link + instrucciones + botón "copiar correos" para pegar en Share; estado pending/sent/confirmed manual; recomendar proyecto "anyone in team can edit" |
| Thumbnail + metadata | ✓ `GET /v1/files/:key/meta` (Tier 3, `file_metadata:read`) → name, lastModified, thumbnailUrl (firmada, expira) | Fuente principal de name/lastModified/thumbnail; descargar a `images` kind=figma-thumb; nunca guardar la URL; refresco por webhook/polling |
| Componentes | ✓ `GET /v1/files/:key?depth=1` (Tier 1) → `components/componentSets` locales · `/v1/files/:key/components`, `/component_sets` (publicados, `library_content:read`) | `/v1/files` SOLO para conteo local (bajo demanda o tras evento); publicados como métrica oficial; refresco por `LIBRARY_PUBLISH` |
| Variables | Enterprise + Full seat (`file_variables:read`) | Si `plan_tier=enterprise`: REST `/variables/local`; universal: plugin Companion (`figma.variables.getLocalVariablesAsync`, `getLocalVariableCollectionsAsync`, `teamLibrary`) → `POST /api/figma/report` (CORS scoped); UI muestra fuente y fecha |
| Webhooks v2 | ✓ Professional+ (team: 20, solo team admin; excluye folders invite-only · project: 5 · file: 3) | Estrategia: `is_team_admin` → 1 webhook contexto team; si no o 403 → webhooks por project vinculado (máx 5); fallback file (máx 3) para archivos en folders invite-only. Eventos `FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`, `LIBRARY_PUBLISH`; passcode aleatorio hasheado, `timingSafeEqual`, responder 200 y encolar; debounce 2 min por archivo |
| Starter | sin webhooks | Polling `FIGMA_POLL_CRON` con `/meta` (Tier 3) comparando lastModified/version |
| Auth | PAT (X-Figma-Token) | PAT de admin Ops con seat Dev/Full (View/Collab = 20 GET file/mes → aviso UI y sync masiva deshabilitada para `/v1/files`), cifrado AES-256-GCM con `SERVER_SECRET`; scopes si OAuth privada: file_content:read, file_metadata:read, folders:read, library_content:read, team_library_content:read, webhooks:read/write (+file_variables:read) |
| Rate limits (2025-11-17) | Tier 1/2/3 por seat y plan | Cola serial por org, backoff con `Retry-After`, log de `X-Figma-Plan-Tier` / `X-Figma-Rate-Limit-Type` (solo en 429; actualiza plan_tier), preferir `/meta`, `depth=1` solo para componentes, todo cacheado en DB, sync por eventos |
| Plugin | Plugin API: no crea archivos; sí páginas/frames/variables | DesTree Companion: token de plugin por org, scaffold páginas/frames (Starter máx 3 páginas, mensaje claro), reporte de counts, `setSharedPluginData('destree', nodeId)`, `networkAccess.allowedDomains=[PUBLIC_URL]`; backend con CORS en `/api/figma/report`; en Pro/Starter se usa como plugin de desarrollo |

`docs/FIGMA.md` mantiene tabla capacidad | soportado | plan | workaround con fuentes.

## 5. Fases

Cada fase cierra con handoff + commit + tag y encadena la siguiente en la misma sesión (desde F3). Regla de corte: si se alarga, handoff ⚠️ parcial antes de agotar contexto.

### Paso previo (manual, antes de pegar el prompt F0a)
- [x] `PLAN.md`, `CLAUDE.md` y `docs/handoff/TEMPLATE.md` ya están en disco
- [x] `gh auth status` OK · `node -v` ≥ 22 · `git --version`
- [x] Abrir `arbol.html` en navegador → Exportar JSON → guardar como `/Users/carlosalfredofisherchavarria/Desktop/DesTree/export-actual.json` (respaldo de `localStorage systree:v2`; fixture `legacy-v2.json` en F1 e import de datos reales)

### F0a — Legacy + split en scripts clásicos + paridad ✅
- **Objetivo:** Dejar de ser un HTML; mismo comportamiento; sin ESM aún.
- **Entregables:**
  - [x] `legacy/arbol.html` (mover, intacto)
  - [x] `client/index.html` + `css/01..10` + `js/` archivos 1:1 con las 19 secciones (split con `sed -n` por rangos; `<script src>` clásicos en el orden original; sin `type=module`; globales compartidas sin tocar). `pointer.js` (423 líneas) se parte en `pointer-drag.js` + `pointer-gestures.js` solo si hay un corte limpio por comentario; si no, queda como excepción en MAP.md
  - [x] `package.json` (Node 22; scripts fijos: `dev` (servidor estático), `start`, `test`, `migrate`, `backup`, `lint`), `.gitignore`, `.env.example`
  - [x] `docs/handoff/F0a.md` (usar `TEMPLATE.md` existente) con checklist de paridad y mapa sección → archivo
- **Aceptación:** `npm run dev` sirve el canvas con paridad (crear/anidar/conectar/undo/layout/export/import/tema/minimap/atajos), checklist de 10 puntos · localStorage sigue en `systree:v2`; import de `export-actual.json` carga · `diff` de concatenación de los js vs sección original = vacío (salvo líneas de separación).
- **Riesgos:** orden de scripts → respetar orden de secciones; mover bloques, no refactorizar.
- **Handoff:** `docs/handoff/F0a.md`.
- **Verificación:** `npm run dev` + checklist manual; `cat client/js/*.js | diff - <(sed -n A,Bp legacy/arbol.html)` por bloque.

### F0b — ESM + scaffolding docs + GitHub ✅
- **Objetivo:** Módulos ESM reales; repo público.
- **Entregables:**
  - [x] `core/state.js` exporta un único objeto mutable `S` (`S.state`, `S.cam`, `S.ptr`, `S.vpRect`, `S.popoverOpen`, `S.adminTab`, `S.firstRun`, …); `grep -nE "^(let|var) " client/js/*.js` lista todos los top-level; cada reasignación `x = …` entre módulos → `S.x = …` (`sed -i` por símbolo + revisión por grep de resultado 0)
  - [x] `<script type="module" src="js/main.js">`; imports explícitos; sin globales `window.*` salvo `S` en dev para depurar
  - [x] Actualizar `CLAUDE.md` (ya existe; mantener ≤60 líneas: comandos, mapa, reglas, estado actual), `docs/MAP.md`, `docs/DECISIONS.md`, LICENSE MIT, README stub, `PLAN.md` ya en disco
  - [x] `git init`, commit `F0a: …` (estado F0a) y `F0b: …`, `gh repo create destree --public --source=. --push`, tags `f0a`, `f0b`
- **Aceptación:** misma checklist de paridad de F0a en ESM · consola sin `ReferenceError`/`TypeError` tras recorrer la checklist · `gh repo view` muestra repo público.
- **Riesgos:** reasignaciones olvidadas → test manual con consola abierta; `grep -n "= " ` de cada símbolo listado.
- **Handoff:** `F0b.md` con lista de símbolos migrados a `S`.
- **Verificación:** `npm run dev` + checklist; `git log --oneline -3`.

### F1 — JSON Schema + backend core + persistencia ✅
- **Objetivo:** Modelo en `/schema`; la página se guarda en SQLite vía API.
- **Entregables:**
  - [x] `schema/page-document|node|edge|tag|branch-type|page.schema.json` derivados de `normalizeState`
  - [x] `server/index.js` Fastify 5 (Ajv `strict:false` + ajv-formats) + static client + `db/sqlite.js` + `001_core.sql` (orgs, pages, nodes, edges, tags, branch_types, node_tags) + seed org/página por defecto
  - [x] `GET/PUT /api/pages/:id` (documento completo, Ajv, transacción, `If-Match: version` → 409), `GET /api/pages`, `POST /api/pages`, `POST /api/import` (v1/v2/v3), `GET /api/health`
  - [x] `server/lib/normalize.js` compartido (cliente lo importa)
  - [x] `client/js/core/api.js` + `state.js`: guardado debounced 800 ms, recarga en 409, fallback localStorage solo offline
  - [x] `scripts/migrate.js`; `tests/fixtures/legacy-v2.json` (derivado de `export-actual.json`, recortado ≤40 nodos); `tests/schema.test.js` (fixture valida tras normalizar; nodo inválido falla)
  - [x] Importar `export-actual.json` en la página por defecto (datos reales del usuario)
- **Aceptación:** `npm start` en :3000 y el canvas carga/guarda desde SQLite tras reiniciar · PUT inválido → 400 con errores Ajv · PUT con version vieja → 409 · importar JSON legacy persiste · datos de `export-actual.json` visibles.
- **Riesgos:** normalización duplicada → un solo `normalize.js`; Ajv strict → opción fijada en `server/index.js`.
- **Handoff:** `F1.md` + `docs/API.md` iniciado.
- **Verificación:** `npm test && curl -s localhost:3000/api/health`.

### F2 — Auth + roles + invitaciones ✅
- **Objetivo:** Setup inicial, login, sesiones, roles aplicados en servidor, invitaciones con enlace copiable.
- **Entregables:**
  - [x] `002_auth.sql` (users, memberships, sessions, invites, audit_log)
  - [x] `POST /api/setup` (solo sin usuarios: org + admin), `/api/auth/login|logout`, `GET /api/me` (user, role, permissions, cellIds), `POST /api/invites` (devuelve enlace; email si SMTP), `POST /api/invites/accept`, `/api/users` CRUD + rol (admin)
  - [x] `lib/permissions.js` + `plugins/guard.js` en todas las rutas de F1; `plugins/origin-check.js` en mutaciones con exclusión por `routeConfig.skipOriginCheck` (lo usará `/api/figma/report` y `/api/figma/hook`); rate-limit en /auth; cookie secure si `TRUST_PROXY`
  - [x] `lib/audit.js` en escrituras
  - [x] Vistas `setup.js`, `login.js`, `invite.js`; topbar con usuario/rol/logout; `core/readonly.js` desactiva pointer/keyboard/editor para designer
  - [x] `tests/permissions.test.js` (tabla ruta × rol → 200/403)
- **Aceptación:** primer arranque pide org+admin; sin sesión `/api/*` → 401 y la web redirige · designer: 403 en PUT y sin botones de edición · invitación por token crea usuario con rol; token expirado → 410 · enlace copiable sin SMTP.
- **Riesgos:** rutas sin guard → test negativo obligatorio por ruta.
- **Handoff:** `F2.md` con matriz aplicada y rutas.
- **Verificación:** `npm test`.

### F3 — Células + visibilidad de raíces + asignaciones + documentación ✅
- **Objetivo:** Raíces públicas para la org o solo células; designer ve solo lo asignado; documentación real por nodo.
- **Entregables:**
  - [x] `003_cells.sql` (cells, cell_members, node_cells, node_assignees; nodes.visibility, owner_user_id, status, notes, docs_json)
  - [x] `/api/cells` CRUD + miembros; `PATCH /api/pages/:pageId/nodes/:nodeId/visibility {visibility, cellIds}`, `PUT …/assignees`, `PATCH …/owner`
  - [x] `lib/visibility.js` (`filterDocumentForUser`, reglas 1–6) aplicado en GET página
  - [x] Schema node actualizado (visibility, cellIds, assigneeIds, ownerId, status, `docs: [{label,url}]` ≤20, `notes` markdown ≤4000); `normalize` migra `doc_url` legado → `docs[0]`
  - [x] UI: selector visibilidad en editor de raíz, chips célula/asignados/responsable, badge en canvas; `card-editor`: lista de enlaces (label+url, añadir/quitar) + textarea notas con render markdown mínimo (títulos, listas, enlaces, código) en modo lectura; vista `#/me` "Mis asignaciones" con deep-link al nodo centrado
  - [x] `tests/visibility.test.js`
- **Aceptación:** designer de célula A no recibe raíz solo-célula-B ni hijos ni aristas cruzadas (test) · head asigna diseñador a feature → ve la raíz completa · `hasExternalRefs` presente · nodo con 3 enlaces + notas se guarda, valida contra schema y designer lo lee sin editar.
- **Riesgos:** rendimiento → un recorrido por raíz; XSS en notas → render markdown propio sin HTML crudo (escape total).
- **Handoff:** `F3.md`.
- **Verificación:** `npm test`.

### F4a — Pages API + router + lobby ✅
- **Objetivo:** Múltiples canvas con lobby.
- **Entregables:**
  - [x] `004_pages.sql` (archived_at, deleted_by; el resto existía desde 001/003)
  - [x] Pages API: crear/renombrar/archivar/desarchivar/duplicar, `PATCH visibility`, `DELETE` soft (admin; snapshot final `reason=delete` cuando exista F6a; hasta entonces exporta JSON a `/data/deleted/`), `POST /api/pages/:id/restore-deleted` (admin), filtro en `GET /api/pages` (status, visibilidad)
  - [x] Router hash completo; `bootstrap(pageId)` + `loadPage` resetean cámara/historial/selección/popovers
  - [x] `#/lobby`: grid (nombre, descripción, nº raíces, visibilidad, última edición), buscador, crear/archivar (head/admin), filtro archivadas, pestaña "Mis asignaciones" para designer
- **Aceptación:** admin crea 2 páginas con visibilidad distinta; designer ve solo la suya en lobby · cambiar de página sin fugas de estado (undo vacío, selección vacía) · archivar oculta del lobby por defecto y es reversible · borrar solo admin y restaurable.
- **Riesgos:** fugas de estado → `state.load` único punto de entrada.
- **Handoff:** `F4a.md`.
- **Verificación:** `npm test`.

### F4b — Panel de administración + page-settings ✅
- **Objetivo:** Gestión de usuarios/células/permisos en UI.
- **Entregables:**
  - [x] `#/admin` (admin; head solo células propias e invitaciones designer): usuarios, roles, invitaciones pendientes/revocar, células y miembros, páginas borradas (restaurar), audit log paginado
  - [x] Drawer actual → `ui/page-settings.js` (tags, tipos de rama, datos, ajustes, visibilidad de página, células)
  - [x] `14-admin.css` reutilizando estilos del drawer/lobby; tablas simples
- **Aceptación:** cambiar rol/célula desde UI aplica sin reiniciar · head no ve pestañas de admin global · audit log muestra las acciones anteriores.
- **Riesgos:** scope creep → tablas simples, sin filtros avanzados.
- **Handoff:** `F4b.md`.
- **Verificación:** `npm test`.

### F5 — Imágenes (upload seguro) ✅
- **Objetivo:** Thumbnails en disco con control de acceso, sin dataURL en el documento.
- **Entregables:**
  - [x] `005_images.sql`; nodes.image_id, pages.cover_image_id
  - [x] `POST /api/images` (cuerpo binario ≤5 MB; magic bytes png/jpg/webp/svg; SVG rasterizado; sharp re-encode webp original ≤1600 + thumb 320; sha256 dedupe)
  - [x] `GET /uploads/:id(/thumb)` con check de visibilidad + cache headers; `DELETE` con comprobación de uso; purga de huérfanas al arrancar
  - [x] `ui/uploader.js`: drag&drop/pegar en card-editor; migración automática dataURL → archivo en import/guardado
  - [x] Export con flag `embedImages` para portabilidad
  - [x] `tests/images.test.js`
- **Aceptación:** PNG 3 MB → nodo muestra webp; documento guarda solo imageId · `.exe` renombrado `.png` → 415 · designer sin acceso → 403 en `/uploads/:id` · import legacy con dataURLs crea archivos.
- **Riesgos:** sharp en alpine → base `bookworm-slim` por defecto.
- **Handoff:** `F5.md`.
- **Verificación:** `npm test`.

### F6a — Versiones e historial ✅
- **Objetivo:** Consultar/restaurar versiones por página.
- **Entregables:**
  - [x] `006_versions.sql` (page_versions)
  - [x] Snapshot auto en PUT si hash cambia (coalescer 5 min), manual con etiqueta, reason restore/import/archive/delete; gzip; retención `VERSIONS_KEEP` (default 50 auto; manuales/archive/delete ilimitadas; páginas archived/deleted excluidas de la purga)
  - [x] `GET /api/pages/:id/versions`, `GET …/:n`, `GET …/:a/diff/:b` (nodos +/−/~), `POST …/:n/restore`, `POST …/versions`
  - [x] `DELETE /api/pages/:id` ahora genera snapshot `reason=delete`; restore de página borrada repone la última versión
  - [x] `views/versions-panel.js`: lista, preview solo lectura, diff resumido, restaurar
  - [x] `tests/versions.test.js`
- **Aceptación:** editar 3 veces → versiones; restaurar la 1ª reproduce el canvas exacto (test) · archivar y borrar página conservan versiones; restaurar página borrada devuelve el canvas (test).
- **Riesgos:** crecimiento → gzip + retención.
- **Handoff:** `F6a.md`.
- **Verificación:** `npm test`.

### F6b — Respaldos + export/import org ✅
- **Objetivo:** Backups programados y restore documentado.
- **Entregables:**
  - [x] `backups` en `007_backups.sql`
  - [x] `lib/backup.js`: `db.backup()` + tar.gz uploads → `/data/backups`, `BACKUP_CRON`, retención N; `POST/GET /api/backups`, descarga (admin); `scripts/backup.js`, `scripts/restore.js`
  - [x] Export/import org completo (`org-export.schema.json`) con manifest de imágenes
  - [x] Tests en `backup.test.js` (backup crea archivo válido; restore en dir vacío; export/import org)
- **Aceptación:** backup manual descargable; restore en `/data` limpio recupera datos e imágenes · export org → import en instancia limpia reproduce páginas y versiones.
- **Riesgos:** restore con DB abierta → script exige servidor parado.
- **Handoff:** `F6b.md` con procedimiento de restore.
- **Verificación:** `npm test && npm run backup`.

### F7 — Docker + docs + release v0.1.0 ✅ (verificación Docker/GHCR pendiente del usuario: `PENDIENTE.md`)
- **Objetivo:** Instalación en 3 comandos; primer release en GitHub.
- **Entregables:**
  - [x] Dockerfile multi-stage `node:22-bookworm-slim` (stage build con python3/make/g++ para nativos; runtime sin toolchain; usuario no root; HEALTHCHECK `/api/health`; chown `/data`), `docker-compose.yml` (volumen `./data`, perfil `https` Caddy, perfil `dev` Mailpit), `.env.example` comentado
  - [x] Arranque valida permisos de `/data` (y avisa de `SERVER_SECRET` si hay PAT), migra automáticamente
  - [x] README completo (qué es, instalación docker/sin docker, actualización, backup/restore, roles), `docs/INSTALL.md`, `ADMIN.md`, `USER.md`
  - [x] `ci.yml` (lint+test en ubuntu, Node 22); `release.yml` (tag v* → `permissions: {contents: write, packages: write}`, `docker/setup-qemu-action` + `setup-buildx-action` + `build-push-action` `platforms: linux/amd64,linux/arm64` → GHCR `:X.Y.Z` + `:latest`, Release con zip)
  - [x] `CHANGELOG.md`, `CONTRIBUTING.md`, issue templates
  - [x] `git tag v0.1.0` (release la crea `release.yml`; comprobar en GitHub)
- **Aceptación:** máquina limpia: `git clone && cp .env.example .env && docker compose up -d` → setup en :3000 · `down && up` conserva datos · CI verde; `ghcr.io/<user>/destree:0.1.0` existe para amd64 y arm64 (`docker manifest inspect`).
- **Riesgos:** sharp/better-sqlite3 en arm64 vía QEMU lento → usar prebuilds (`npm ci` descarga binarios por plataforma) y cache de buildx.
- **Handoff:** `F7.md`.
- **Verificación:** `docker compose up -d --build && curl -s localhost:3000/api/health`.

### F8a — Figma I: conexión, vínculo, thumbnail, componentes (¡IMPORTANTE! No continuar con nada de Figma, el MVP se quedará sin esa función, mantenerlo funcional sin depender en absoluto de ninguna función relacionada a Figma, avisame cuando llegues hasta aquí y detente.)
- **Objetivo:** Cada nodo se vincula a un archivo Figma con thumbnail y conteos reales.
- **Entregables:**
  - [ ] `008_figma.sql` (figma_connections, figma_files)
  - [ ] Admin → Figma: PAT cifrado (`lib/crypto.js`), team_id, plantilla, `plan_tier` y `seat_type` manuales (select), "probar conexión" (`GET /v1/me` → nombre/email), aviso si `seat_type` View/Collab (sync de componentes limitada a 20/mes; sync masiva solo `/meta`)
  - [ ] `lib/figma/client.js`: cola serial, backoff `Retry-After`/429, actualiza `plan_tier` si llega `X-Figma-Plan-Tier`; `lib/figma/url.js` regex `/(file|design)\/([A-Za-z0-9]+)/`, `board` → 422 "FigJam no soportado"
  - [ ] `POST /api/figma/files {nodeId, url}` → file_key → sync: `/meta` (name, lastModified, thumbnail → images) + publicados (`/components`, `/component_sets`); conteo local (`/v1/files?depth=1`, Tier 1) bajo demanda con botón separado; `POST …/resync`; sync masiva por página usa solo `/meta` + publicados
  - [ ] `views/figma-panel.js` en el nodo (thumbnail, counts con fuente, estado, abrir, resync, "contar locales")
  - [ ] `tests/figma.test.js` con mock HTTP + `fixtures/figma-file-meta.json`: parse URL (file/design/board), sync, 429 con Retry-After, PAT ausente en respuestas/logs
- **Aceptación:** URL real → thumbnail cacheado y nº componentes publicados en <10 s · 429 simulado reintenta sin tumbar · seat View/Collab → aviso y botón de locales deshabilitado · sin PAT la app funciona igual.
- **Riesgos:** URLs firmadas expiradas → siempre descargar en sync.
- **Handoff:** `F8a.md`.
- **Verificación:** `npm test`.

### F8b — Figma I bis: creación guiada, archivar, proyectos
- **Objetivo:** Flujo honesto de crear/archivar; proyectos sincronizados y vinculados.
- **Entregables:**
  - [ ] `009_figma_projects.sql` (figma_projects)
  - [ ] Flujo "Crear en Figma": nodo `pending` + deep-link `figma.com/new` o plantilla con instrucción Duplicar; al pegar URL → vincula; "Archivar" (status interno) + deep-link para borrar en Figma
  - [ ] Sync de proyectos (`GET /v1/teams/:id/projects`, PAT) + vínculo proyecto ↔ raíz/célula; "crear proyecto" deep-link al team; estado "pendiente de crear en Figma"
  - [ ] `docs/FIGMA.md` tabla sí/no con fuentes; tests de proyectos con mock
- **Aceptación:** "Crear en Figma" deja pending y al pegar URL vincula · lista de proyectos sincroniza y se vincula a raíz · archivar no borra en Figma y lo dice.
- **Riesgos:** proyectos no disponibles con OAuth público → solo PAT (documentado).
- **Handoff:** `F8b.md`.
- **Verificación:** `npm test`.

### F9a — Figma II: webhooks + polling
- **Objetivo:** Actualización automática.
- **Entregables:**
  - [ ] `010_figma_events.sql` (figma_webhooks, figma_events)
  - [ ] `POST /api/figma/webhooks` (crea en Figma `POST /v2/webhooks`: contexto team si `is_team_admin`; si no o 403 → por project vinculado (máx 5) → fallback file (máx 3); eventos FILE_UPDATE, FILE_VERSION_UPDATE, FILE_DELETE, LIBRARY_PUBLISH; passcode hasheado), listar/eliminar; receptor `POST /api/figma/hook` (`skipOriginCheck`, `timingSafeEqual`, 200 inmediato, encola; `figma-webhook-event.schema.json`)
  - [ ] Procesador: UPDATE/PUBLISH → resync (debounce 2 min/archivo); DELETE → `deleted_in_figma`
  - [ ] Polling `FIGMA_POLL_CRON` con `/meta` (Starter o sin webhook)
  - [ ] `tests/webhook.test.js` con `fixtures/figma-webhook-file-update.json`: passcode válido → 200 + evento; inválido → 401; procesador llama resync (mock); debounce
  - [ ] `docs/FIGMA.md`: verificación real = túnel https (cloudflared/ngrok) o Caddy público; procedimiento manual con `GET /v2/webhooks/:id/requests`
- **Aceptación:** tests verdes con fixture · passcode inválido → 401 · con PAT no admin se crean webhooks por proyecto (mock) · polling actualiza thumbnail/counts en el siguiente ciclo · verificación con túnel documentada como manual (no bloquea).
- **Riesgos:** webhooks requieren https público y Pro+ → polling siempre disponible.
- **Handoff:** `F9a.md`.
- **Verificación:** `npm test`.

### F9b — Figma II bis: correo, invitaciones, importar proyectos, dashboard
- **Objetivo:** Invitaciones desde DesTree; proyectos importables; eventos visibles.
- **Entregables:**
  - [ ] `011_figma_invites.sql` (figma_invitations)
  - [ ] `lib/mailer.js` (SMTP de org o env, prueba de envío); `POST /api/figma/files/:id/invite` → correo con deep-link + instrucciones; botón "copiar correos"; estado manual pending/sent/confirmed; prefill con asignados
  - [ ] "Importar archivos no vinculados" (`GET /v1/projects/:id/files`) → nodos DS/UIKit en raíz elegida
  - [ ] Dashboard por proyecto (archivos, counts, último sync); historial de eventos en admin
- **Aceptación:** invitación llega (Mailpit) y queda `sent` · importar proyecto crea nodos vinculados · dashboard lista archivos con counts.
- **Riesgos:** SMTP ausente → enlace + correos copiables.
- **Handoff:** `F9b.md`.
- **Verificación:** `npm test` + Mailpit manual.

### F10 — Plugin companion + variables
- **Objetivo:** Variables/colecciones por archivo sin Enterprise; scaffolding desde Figma.
- **Entregables:**
  - [ ] `012_plugin.sql` (plugin_token_hash en figma_connections); `POST /api/figma/plugin-token` (admin)
  - [ ] `POST /api/figma/report` (`figma-report.schema.json`, Bearer plugin token, `skipOriginCheck`, `@fastify/cors` scoped a esta ruta: origin `null` y `https://www.figma.com`, methods POST/OPTIONS, headers Authorization+Content-Type, preflight OK); test de preflight
  - [ ] `figma-plugin/` (manifest con `networkAccess.allowedDomains=[PUBLIC_URL]`, `teamlibrary`; ui.html; code.js): login por URL + token; selecciona nodo DesTree; "Reportar métricas" (variables, colecciones, componentes, sets, librerías); "Scaffold" páginas/frames convencionales (Starter máx 3 → mensaje); `setSharedPluginData('destree', nodeId)`; fileKey pegado o sharedPluginData
  - [ ] Ruta Enterprise: si `plan_tier=enterprise` → `GET /v1/files/:key/variables/local`
  - [ ] UI: counts con fuente (rest|plugin) y fecha; aviso "abre el plugin para actualizar variables"
  - [ ] `docs/FIGMA.md` sección plugin (instalación como plugin de desarrollo); `figma-plugin/README.md`
- **Aceptación:** plugin en archivo vinculado → DesTree muestra variables/colecciones en <5 s (CORS OK desde iframe) · scaffold no falla en Starter · token inválido → 401 (test) · OPTIONS preflight → 204 (test).
- **Riesgos:** `figma.fileKey` solo privado → pegar URL; CSP de F11 no debe tocar `/api/figma/report`.
- **Handoff:** `F10.md`.
- **Verificación:** `npm test`.

### F11a — Hardening + e2e + API docs
- **Objetivo:** Seguridad y pruebas de extremo a extremo. Nada nuevo.
- **Entregables:**
  - [ ] Headers de seguridad, CSP solo en respuestas HTML (no en `/api/*`; `/api/figma/report` y `/hook` fuera del Origin-check), límites de body, rate-limit login/invites/report/hook, logs sin secretos, graceful shutdown, `npm audit` sin high
  - [ ] `tests/api.test.js` e2e (setup → login 3 roles → página → visibilidad → imagen → versión → backup → figma report)
  - [ ] `scripts/gen-api-docs.js` → `docs/API.md`; `docs/SECURITY.md`
- **Aceptación:** `npm test` y CI verdes · headers verificados con curl · plugin sigue reportando con CSP activa (test preflight).
- **Riesgos:** CSP rompe inline → mover inline a archivos.
- **Handoff:** `F11a.md`.
- **Verificación:** `npm test`.

### F11b — Docs, UI acotado y release v1.0.0
- **Objetivo:** Producto documentado y publicado.
- **Entregables:**
  - [ ] Revisión README/ADMIN/USER/FIGMA/INSTALL; CHANGELOG 1.0.0
  - [ ] UI acotado (lista cerrada): estados vacíos en lobby/admin/figma-panel; mensajes de error de API visibles como toast; loading en lobby y figma-panel; i18n es de textos de views/ (grep de literales en inglés = 0); lobby/admin responsive ≥360px; foco inicial y Escape en diálogos
  - [ ] Checklist de los 12 requisitos marcado en PLAN.md; roadmap post-v1 (OAuth Figma por usuario, deltas, comentarios, SSO)
  - [ ] `git tag v1.0.0` + release + GHCR `:1.0.0` y `:latest`
- **Aceptación:** instalación limpia desde release cumple `docs/INSTALL.md` · checklist 100 % · lista UI cerrada completa.
- **Riesgos:** scope creep → solo la lista cerrada.
- **Handoff:** `F11b.md` (final).
- **Verificación:** `npm test && gh release view v1.0.0`.

## 6. Protocolo de handoff

Al cerrar cada fase, en la misma sesión y en este orden:
1. Verificación: comando de la fase; resultado en 1 línea.
2. Escribir `docs/handoff/F<N>.md` con `TEMPLATE.md` (<40 líneas).
3. Actualizar `docs/MAP.md` (archivos nuevos/movidos), `docs/DECISIONS.md` (1 línea por decisión), `docs/API.md` si hubo endpoints, bloque "Estado actual" de `CLAUDE.md` (3 líneas: fase hecha, próxima, deuda crítica), marcar fase ✅ en `PLAN.md`.
4. `git add -A && git commit -m "F<N>: <resumen>" && git tag f<N> && git push --tags origin main` (desde F0b; F0a solo commit local).
5. Imprimir el prompt de la fase siguiente (§8) como último mensaje.

Reglas: desde F3 las fases se encadenan en la misma sesión (handoff + commit + tag entre fases; lo que requiera intervención del usuario se anota en `PENDIENTE.md` y no bloquea); fase parcial → handoff ⚠️ con pendientes y el prompt siguiente empieza por "Termina F<N> (pendientes en handoff) y luego F<N+1>"; toda memoria vive en repo (CLAUDE.md, PLAN.md, handoffs, schema, migraciones, tests), nunca en el chat.

Plantilla `docs/handoff/TEMPLATE.md`:
```
# Handoff F<N> — <nombre>   [✅ completa | ⚠️ parcial]
Commit: <hash> · Tag: f<N>
## Hecho
- …
## Verificado
- <comando> → <resultado 1 línea>
## Pendiente / deuda
- …
## Decisiones no visibles en código
- …
## Archivos clave
- ruta — 1 línea
## Contexto para F<N+1>
- …
```

## 7. Métodos de ahorro de tokens

- Un chat por fase; prompt de inicio ≤12 líneas que apunta a `CLAUDE.md`, `docs/handoff/F<N-1>.md` y solo la sección F<N> de `PLAN.md`.
- `CLAUDE.md` ≤60 líneas: comandos, mapa, reglas, estado actual; sin narrativa.
- `docs/MAP.md` (1 línea por archivo) se lee en vez de explorar el árbol.
- Prohibido leer `legacy/arbol.html` entero: `grep -n` + `sed -n A,Bp`; en F0a el split se hace con `sed` por rangos, no copiando por el modelo.
- Ningún archivo nuevo >300 líneas; excepción: módulos heredados del split (p. ej. `pointer.js`, `07-nodes.css`, `10-responsive.css`) marcados como deuda en MAP.md y partidos solo cuando se toquen. Lecturas con `offset/limit`; nunca `cat` de archivos >200 líneas.
- Handoff <40 líneas con plantilla fija; cita hash y tag; la siguiente sesión usa `git show --stat f<N>` en vez de releer.
- `docs/DECISIONS.md` append-only para no rediscutir.
- Migraciones SQL + JSON Schema son la documentación del modelo; `docs/API.md` se genera por script.
- `npm test` como única verificación; salida con `| tail -30`.
- Commits pequeños `F<N>: …`; `git log --oneline -10` sustituye a releer código.
- Fixtures pequeñas (`five-nodes.json`, `legacy-v2.json` ≤40 nodos, payloads Figma); mocks HTTP para Figma.
- Preferir Edit a reescrituras; no re-imprimir código leído; sin resúmenes ni explicaciones (regla en CLAUDE.md).
- Scripts fijos desde F0a (`dev`, `start`, `test`, `migrate`, `backup`); versiones fijadas en `package.json`.
- Regla de corte: si una fase se alarga, handoff ⚠️ parcial antes de agotar contexto.
- Al cerrar fase, Claude imprime el prompt siguiente listo para pegar.

## 8. Prompts por fase

### F0a
```
Proyecto DesTree en /Users/carlosalfredofisherchavarria/Desktop/DesTree. PLAN.md ya está en disco; export-actual.json existe.
Lee SOLO PLAN.md (§0, §1, §5 F0a) y arbol.html SOLO con grep -n de títulos de sección y sed -n por rangos; nunca entero.
Ejecuta F0a completa: mover a legacy/, split en archivos js/css con sed por rangos cargados como <script src> clásicos en orden (sin type=module, sin tocar globales), package.json con scripts fijos, .gitignore, .env.example. Actualiza el bloque Estado actual de CLAUDE.md.
Cumple la aceptación de F0a (checklist de paridad de 10 puntos + diff de concatenación vacío) y escribe docs/handoff/F0a.md.
git init + commit "F0a: …" (sin push). Dame el prompt de F0b.
Modo terso: sin explicaciones, solo acciones y resultados.
```

### F0b
```
Proyecto DesTree. Lee SOLO: docs/handoff/F0a.md y la sección F0b de PLAN.md (+ §0 fila Módulos).
No leas legacy/ ni archivos enteros; usa grep -n y sed -n.
Ejecuta F0b completa: grep de bindings top-level, objeto S en core/state.js, reasignaciones → S.x, type=module, actualizar CLAUDE.md (≤60 líneas), docs/MAP.md, DECISIONS.md, LICENSE, README stub, gh repo create destree --public --source=. --push, tags f0a y f0b.
Cumple la aceptación de F0b (paridad sin errores de consola).
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F1.
Modo terso: sin explicaciones.
```

### F1
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F0b.md y la sección F1 de PLAN.md (sed -n por rango).
No leas legacy/arbol.html ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F1 completa hasta cumplir su aceptación (schema/, Fastify 5 con Ajv strict:false + ajv-formats, SQLite, PUT con If-Match 409, normalize.js compartido, fixture legacy-v2 desde export-actual.json, import de datos reales, tests).
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F2.
Modo terso: sin explicaciones.
```

### F2
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F1.md y la sección F2 de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n; git show --stat f1 si necesitas contexto.
Ejecuta F2 completa (setup, login, sesiones, guard en todas las rutas, origin-check con skipOriginCheck, invitaciones con enlace copiable, readonly para designer, tests/permissions.test.js) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F3.
Modo terso: sin explicaciones.
```

### F3
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F2.md y la sección F3 de PLAN.md (+ §3 permisos/visibilidad).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F3 completa (células, visibilidad de raíces, asignados, docs[]+notes en schema y card-editor con markdown escapado, lib/visibility.js, Mis asignaciones, tests/visibility.test.js) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F4a.
Modo terso: sin explicaciones.
```

### F4a
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F3.md y la sección F4a de PLAN.md (+ §2 reglas de borrado).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F4a completa (pages API con archivar/soft delete/restaurar, router hash, state.load reset, lobby) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F4b.
Modo terso: sin explicaciones.
```

### F4b
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F4a.md y la sección F4b de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F4b completa (#/admin: usuarios, roles, invitaciones, células, páginas borradas, audit log; page-settings) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F5.
Modo terso: sin explicaciones.
```

### F5
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F4b.md y la sección F5 de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F5 completa (upload con magic bytes + sharp, /uploads con visibilidad, uploader en card-editor, migración dataURL→archivo, tests/images.test.js) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F6a.
Modo terso: sin explicaciones.
```

### F6a
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F5.md y la sección F6a de PLAN.md (+ §2 reglas de borrado).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F6a completa (page_versions gzip, retención que excluye manual/archive/delete, diff, restore, snapshot al borrar, versions-panel, tests/versions.test.js) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F6b.
Modo terso: sin explicaciones.
```

### F6b
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F6a.md y la sección F6b de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F6b completa (lib/backup.js + cron + API + scripts backup/restore, export/import org con org-export.schema.json, tests) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F7.
Modo terso: sin explicaciones.
```

### F7
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F6b.md y la sección F7 de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F7 completa (Dockerfile bookworm-slim multi-stage, compose con perfiles https/dev, .env.example, README/INSTALL/ADMIN/USER, ci.yml, release.yml con permissions packages:write + QEMU/buildx amd64+arm64, CHANGELOG, tag v0.1.0 + release) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F8a.
Modo terso: sin explicaciones.
```

### F8a
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F7.md y la sección F8a de PLAN.md (+ §4 Figma).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F8a completa (008_figma, PAT cifrado, plan_tier/seat_type manuales, client.js con cola y Retry-After, url.js sin board, vincular URL → /meta thumbnail + publicados, locales bajo demanda, aviso View/Collab, figma-panel, tests/figma.test.js con mocks) hasta cumplir su aceptación.
Sin PAT la app debe funcionar igual; el PAT nunca aparece en respuestas ni logs.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F8b.
Modo terso: sin explicaciones.
```

### F8b
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F8a.md y la sección F8b de PLAN.md (+ §4 filas Crear archivo/proyecto/Eliminar).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F8b completa (flujo "Crear en Figma" pending, archivar + deep-link, sync de proyectos + vínculo raíz/célula, docs/FIGMA.md, tests) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F9a.
Modo terso: sin explicaciones.
```

### F9a
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F8b.md y la sección F9a de PLAN.md (+ §4 filas Webhooks/Starter).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F9a completa (webhooks v2 con estrategia team→project→file, passcode timingSafeEqual, receptor con skipOriginCheck, procesador con debounce, polling Starter, fixture de payload + tests/webhook.test.js, FIGMA.md con verificación manual por túnel) hasta cumplir su aceptación.
No intentes probar webhooks reales sin https público; documenta el procedimiento.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F9b.
Modo terso: sin explicaciones.
```

### F9b
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F9a.md y la sección F9b de PLAN.md (+ §4 fila Invitar).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F9b completa (mailer + invitaciones con copiar correos, importar archivos no vinculados, dashboard por proyecto, historial de eventos) hasta cumplir su aceptación.
Prueba correos con el perfil dev de compose (Mailpit).
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F10.
Modo terso: sin explicaciones.
```

### F10
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F9b.md y la sección F10 de PLAN.md (+ §4 filas Variables/Plugin, §0 fila CORS).
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F10 completa (figma-plugin/ Companion, plugin token, POST /api/figma/report con CORS scoped + skipOriginCheck + figma-report.schema.json, scaffold con límite Starter, ruta Enterprise opcional, UI con fuente/fecha, tests de preflight y token, docs) hasta cumplir su aceptación.
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F11a.
Modo terso: sin explicaciones.
```

### F11a
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F10.md y la sección F11a de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F11a completa (hardening: headers, CSP solo HTML, rate-limit, shutdown; tests/api.test.js e2e; gen-api-docs; SECURITY.md). Nada nuevo. /api/figma/report y /hook deben seguir funcionando (tests).
Al terminar aplica el protocolo de handoff (PLAN.md §6) y dame el prompt de F11b.
Modo terso: sin explicaciones.
```

### F11b
```
Proyecto DesTree. Lee SOLO: CLAUDE.md, docs/handoff/F11a.md y la sección F11b de PLAN.md.
No leas legacy/ ni archivos enteros; usa docs/MAP.md, grep -n y sed -n.
Ejecuta F11b completa (revisión de docs, lista UI cerrada, checklist de 12 requisitos en PLAN.md, roadmap, tag v1.0.0 + release + GHCR). Solo la lista cerrada: nada nuevo.
Al terminar aplica el protocolo de handoff (PLAN.md §6) con docs/handoff/F11b.md final y marca PLAN.md completo.
Modo terso: sin explicaciones.
```
