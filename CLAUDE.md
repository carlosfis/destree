# DesTree

Fuente única de verdad para agencias: árbol de software → Design Systems / UI Kits, responsables, documentación y métricas Figma. Autoalojado, multi-página, roles admin/head/designer.

## Estado actual
- Fase hecha: F0a (legacy + split clásico + paridad; `docs/handoff/F0a.md`).
- Próxima: F0b (ESM + docs + GitHub; prompt en `PLAN.md` §8). Antes: `brew install gh && gh auth login`.
- Deuda crítica: checklist manual de paridad en navegador pendiente de confirmación.

## Comandos (fijos desde F0a)
```
npm run dev      # servidor local
npm test         # única verificación
npm run migrate  # migraciones SQLite
npm run backup   # respaldo a data/backups
```

## Mapa (detalle en docs/MAP.md desde F0b)
- `PLAN.md` — plan por fases, prompts y protocolo de handoff. Leer solo la sección de la fase activa.
- `schema/` — JSON Schema draft-07. Fuente de verdad del modelo; valida API, import/export y tests.
- `server/` — Fastify 5 (JS ESM), SQLite, `lib/permissions.js`, `lib/visibility.js`, `lib/figma/`.
- `client/` — vanilla JS + CSS sin bundler; `js/core` estado, `js/canvas` lienzo, `js/ui`, `js/views`.
- `figma-plugin/` — DesTree Companion (scaffold de páginas, reporte de variables/componentes).
- `legacy/arbol.html` — original. NUNCA leerlo entero: `grep -n` + `sed -n A,Bp`.
- `docs/handoff/F<N>.md` — handoff por fase. `docs/DECISIONS.md` — append-only.

## Reglas
1. Un chat = una fase. Al terminar: protocolo de handoff (`PLAN.md` §6) e imprimir el prompt siguiente.
2. Modo terso: sin explicaciones, resúmenes ni narrativa. Solo acciones y resultados.
3. Lecturas parciales (`grep -n`, `sed -n`, offset/limit). Nunca `cat` de archivos >200 líneas. Nunca reimprimir código leído.
4. Ningún archivo nuevo >300 líneas. Preferir Edit a reescrituras.
5. JSON Schema y migraciones SQL son la documentación del modelo. No duplicar en prosa.
6. Permisos siempre server-side (`guard('action')` en cada ruta). El cliente solo oculta UI.
7. Figma: la REST API no crea, borra ni comparte archivos. No inventar capacidades; ver `PLAN.md` §4 y `docs/FIGMA.md`.
8. Secretos solo en `.env`. PAT de Figma cifrado; nunca en logs ni respuestas.
9. Commits pequeños `F<N>: …`, tag `f<N>`, push a `main` (desde F0b).
10. `npm test` debe pasar antes de cerrar una fase. Si la fase se alarga: handoff ⚠️ parcial.
11. Idioma: UI y docs en español; código e identificadores en inglés.
12. Decisión nueva → una línea en `docs/DECISIONS.md`. No rediscutir decisiones registradas.
