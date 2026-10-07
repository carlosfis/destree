# API (F1)

Base `/api`. JSON. Sin auth hasta F2 (entonces `guard('action')` en cada ruta). Errores: `{ error, message, errors? }`.
Validación: JSON Schema de `/schema` vía Ajv (`strict:false`, `allErrors`, ajv-formats). 400 → `errors: [{ path, message, keyword, params }]`.

| Método | Ruta | Cuerpo / cabeceras | Respuesta |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, version, db, pages, time }` |
| GET | `/api/pages` | — | `{ pages: [{ id, name, description, visibility, status, version, updatedAt, nodeCount }] }` |
| POST | `/api/pages` | `{ name, description? }` | 201 + page-document (versión 1), `ETag` |
| GET | `/api/pages/:id` | — | page-document v3 (`schema/page-document.schema.json`); `ETag: "<version>"` |
| PUT | `/api/pages/:id` | page-document v3 · `If-Match: "<version>"` | `{ version, nodes, edges, updatedAt }` + `ETag`. 400 schema · 409 `{ error:'conflict', version }` · 428 sin If-Match |
| POST | `/api/import?pageId=` | JSON v1/v2/v3 (`nodes[]`, `edges[]`) | `{ pageId, version, nodes, edges, updatedAt }`. Sin If-Match: sustituye el contenido |

Notas
- PUT reemplaza el contenido completo en una transacción (tags, branch_types, nodes, node_tags, edges) y `version += 1`.
- El servidor normaliza (`server/lib/normalize.js`) tras validar; `page.name/description/visibility` solo cambian si vienen en `page`.
- `settings` persiste `{ snap, grid, minimap }`; `theme`/`tool` son preferencias del navegador.
- Límite de cuerpo 32 MB. `/` sirve `client/`; `/js/core/normalize.js` es el mismo módulo que usa el servidor.
