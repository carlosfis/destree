# DesTree

Fuente única de verdad para agencias: árbol de software → Design Systems / UI Kits, responsables y documentación. Autoalojado, multi-página, roles admin/head/designer. **Sin Figma**: decisión cerrada, el producto no depende de ninguna función de Figma (solo enlaces manuales en Documentación).

## Estado
- v0.1.0 publicada (Docker multi-arch, CI + release, docs). El trabajo restante vive en `PENDIENTE.md`, por fases P1…P8 con casillas; es el único registro de seguimiento.
- Verificación: `npm test` + `npm run lint` + `node scripts/smoke.js` (Chrome headless, consola limpia).

## Comandos
```
npm run dev      # Fastify con --watch en :3000 (npm start sin watch)
npm test         # tests (node --test)
npm run lint     # node --check de todos los .js
npm run migrate  # migraciones SQLite (server/db/migrations) + seed
npm run import -- archivo.json [pageId]  # importa JSON v1/v2/v3 en una página
npm run backup   # respaldo tar.gz (db + uploads) a data/backups · restore: node scripts/restore.js <tar.gz> (servidor parado)
node scripts/smoke.js  # checklist de UI en Chrome headless (requiere Chrome)
```

## Mapa (detalle en docs/MAP.md)
- `PENDIENTE.md` — fases pendientes, aceptación y quién las hace (agente o usuario). Leer siempre al empezar.
- `schema/` — JSON Schema draft-07. Fuente de verdad del modelo; valida API, import/export y tests.
- `server/` — Fastify 5 (JS ESM), SQLite vía `node:sqlite` (`db/sqlite.js`; `sharp` es la única dep nativa), `lib/normalize.js` (compartido: symlink en `client/js/core/`), `lib/pages.js`, `lib/{auth,permissions,audit}.js`, `plugins/{session,guard,origin-check}.js`, `lib/visibility.js` + `lib/cells.js`, `lib/images.js`, `lib/versions.js`, `lib/backup.js` + `lib/org-export.js`.
- `client/` — vanilla JS ESM + CSS sin bundler. `js/core/state.js` exporta `S` (estado mutable compartido), `bootstrap()`/`persist()` vía `core/api.js`; `js/core/dom.js` nodos DOM; `js/canvas` lienzo; `js/ui` (drawer de instancia, `page-settings.js`); `js/views` (`lobby`, `admin-view`, `users`, `cells`, `me`, `auth-views`, `versions-panel`); `js/main.js` entrada única.
- `Dockerfile`, `docker-compose.yml`, `docker/Caddyfile`, `.github/workflows/{ci,release}.yml`.
- `promo/` — pieza de motion graphics (HTML+CSS+GSAP) y render a vídeo con Chrome headless; los vídeos no se versionan.
- `docs/DECISIONS.md` — append-only. `docs/MAP.md` — mapa de archivos. `docs/{INSTALL,ADMIN,USER,API}.md` — documentación de producto.

## Reglas
1. Seguimiento solo en `PENDIENTE.md`: tomar la primera fase abierta que no dependa de una acción del usuario; al cerrarla marcar casillas, pasar verificación, commit y push. Lo que requiera al usuario se marca «usuario» y no bloquea.
2. Modo terso: sin explicaciones, resúmenes ni narrativa. Solo acciones y resultados.
3. Lecturas parciales (`grep -n`, `sed -n`, offset/limit). Nunca `cat` de archivos >200 líneas. Nunca reimprimir código leído.
4. Ningún archivo nuevo >300 líneas. Preferir Edit a reescrituras.
5. JSON Schema y migraciones SQL son la documentación del modelo. No duplicar en prosa. Nunca editar una migración aplicada.
6. Permisos siempre server-side (`app.guard('action')` como hook `onRequest` en cada ruta; mutaciones pasan origin-check salvo `config.skipOriginCheck`). El cliente solo oculta UI.
7. Secretos solo en `.env`. Nunca en logs ni respuestas.
8. Commits pequeños `feat: …`, `fix: …`, `docs: …`, `chore: …`; push a `main`. `gh` está en `/opt/homebrew/bin/gh` (no en PATH).
9. `npm test` y `npm run lint` deben pasar antes de cerrar una fase; `node scripts/smoke.js` si hubo cambios de UI.
10. Idioma: UI y docs en español; código e identificadores en inglés. Términos de producto fijos: Main instance, Child instance, Design System, UI Kit, Staff.
11. Decisión nueva → una línea en `docs/DECISIONS.md`. No rediscutir decisiones registradas.
12. Cliente ESM: estado reasignable solo en `S.x` (nunca `let` top-level); sin `window.*` salvo `window.S` en dev; nunca usar `S.x` en el nivel superior de un módulo (ciclos de import).
