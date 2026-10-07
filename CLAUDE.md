# DesTree

Fuente única de verdad para agencias: árbol de software → Design Systems / UI Kits, responsables, documentación y métricas Figma. Autoalojado, multi-página, roles admin/head/designer.

## Estado actual
- Fase hecha: F1 (schema/, Fastify 5 + Ajv, SQLite `node:sqlite`, PUT If-Match, normalize compartido; `docs/handoff/F1.md`).
- Próxima: F2 (auth + roles + invitaciones; prompt en `PLAN.md` §8).
- Deuda crítica: ninguna. `npm test` 12/12; `node scripts/smoke.js` 13/13 (Chrome headless, consola limpia).

## Comandos (fijos desde F0a)
```
npm run dev      # Fastify con --watch en :3000 (npm start sin watch)
npm test         # única verificación
npm run migrate  # migraciones SQLite (server/db/migrations) + seed
npm run import -- archivo.json [pageId]  # importa JSON v1/v2/v3 en una página
npm run backup   # respaldo a data/backups
node scripts/smoke.js  # checklist de paridad en Chrome headless (requiere Chrome)
```

## Mapa (detalle en docs/MAP.md)
- `PLAN.md` — plan por fases, prompts y protocolo de handoff. Leer solo la sección de la fase activa.
- `schema/` — JSON Schema draft-07 (desde F1). Fuente de verdad del modelo; valida API, import/export y tests.
- `server/` — Fastify 5 (JS ESM), SQLite vía `node:sqlite` (`db/sqlite.js`, sin binarios), `lib/normalize.js` (compartido: symlink en `client/js/core/`), `lib/pages.js`; `lib/permissions.js`, `lib/visibility.js`, `lib/figma/` (fases siguientes).
- `client/` — vanilla JS ESM + CSS sin bundler. `js/core/state.js` exporta `S` (estado mutable compartido), `bootstrap()`/`persist()` vía `core/api.js`; `js/core/dom.js` nodos DOM; `js/canvas` lienzo; `js/ui`; `js/views`; `js/main.js` entrada única.
- `figma-plugin/` — DesTree Companion (desde F10).
- `legacy/arbol.html` — original. NUNCA leerlo entero: `grep -n` + `sed -n A,Bp`.
- `docs/handoff/F<N>.md` — handoff por fase. `docs/DECISIONS.md` — append-only. `docs/MAP.md` — mapa de archivos.

## Reglas
1. Un chat = una fase. Al terminar: protocolo de handoff (`PLAN.md` §6) e imprimir el prompt siguiente.
2. Modo terso: sin explicaciones, resúmenes ni narrativa. Solo acciones y resultados.
3. Lecturas parciales (`grep -n`, `sed -n`, offset/limit). Nunca `cat` de archivos >200 líneas. Nunca reimprimir código leído.
4. Ningún archivo nuevo >300 líneas. Preferir Edit a reescrituras.
5. JSON Schema y migraciones SQL son la documentación del modelo. No duplicar en prosa.
6. Permisos siempre server-side (`guard('action')` en cada ruta). El cliente solo oculta UI.
7. Figma: la REST API no crea, borra ni comparte archivos. No inventar capacidades; ver `PLAN.md` §4 y `docs/FIGMA.md`.
8. Secretos solo en `.env`. PAT de Figma cifrado; nunca en logs ni respuestas.
9. Commits pequeños `F<N>: …`, tag `f<N>`, push a `main`. `gh` está en `/opt/homebrew/bin/gh` (no en PATH).
10. `npm test` debe pasar antes de cerrar una fase. Si la fase se alarga: handoff ⚠️ parcial.
11. Idioma: UI y docs en español; código e identificadores en inglés.
12. Decisión nueva → una línea en `docs/DECISIONS.md`. No rediscutir decisiones registradas.
13. Cliente ESM: estado reasignable solo en `S.x` (nunca `let` top-level); sin `window.*` salvo `window.S` en dev; nunca usar `S.x` en el nivel superior de un módulo (ciclos de import).
