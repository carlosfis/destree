# Handoff F0a — Legacy + split en scripts clásicos + paridad   [✅ completa]
Commit: 1d63855 · Tag: f0a (se crea en F0b junto con f0b; F0a solo commit local)
## Hecho
- `arbol.html` → `legacy/arbol.html` (intacto). Split con `sed -n` por rangos: 10 css + 20 js + `client/index.html` (`<link>`/`<script src>` clásicos en orden original, sin `type=module`).
- `package.json` (scripts fijos dev/start/test/migrate/backup/lint; sin dependencias), `scripts/dev-server.js` (estático, puerto 5173), stubs `migrate.js`/`backup.js`, `lint.js` (`node --check`), `.gitignore`, `.env.example`, `docs/DECISIONS.md`.
- `tests/split.test.js`: mapa sección→archivo→rango y diff de concatenación css/js vs legacy.
- `export-actual.json` en disco (11 nodos, 9 aristas, v2) — gitignored.
## Verificado
- `npm test` → 4/4 pass (concatenación css 9-501 y js 590-2542 idénticas al legacy; orden de scripts en index.html).
- `npm run lint` → OK. `npm run dev` → 200 html/css/js, 404 path traversal.
- Chrome headless (`--dump-dom`, perfil temporal) split vs legacy → 10 nodos, topbar, 3 dialogs, 0 errores de consola en ambos.
- Checklist de paridad 10 puntos (manual en navegador, pendiente de confirmación del usuario): crear · anidar · conectar · undo/redo · auto-layout · exportar · importar `export-actual.json` · tema · minimapa · atajos. localStorage sigue en `systree:v2` (código sin cambios, L602).
## Pendiente / deuda
- `brew`/`gh` no instalados (requieren instalación interactiva): antes de F0b ejecutar `brew install gh && gh auth login`.
- Checklist manual de paridad en navegador real (ver arriba).
- Archivos >190 líneas heredados: `pointer-gestures.js` 232, `state.js` 216, `pointer-drag.js` 193, `admin.js` 188 (partir solo al tocarlos).
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (5 líneas F0a).
## Archivos clave
- `tests/split.test.js` — mapa sección→archivo→rango (fuente de verdad del split).
- `client/index.html` — orden de carga: utils, state, history, camera, render-nodes, render-edges, selection, minimap, pointer-gestures, pointer-drag, keyboard, popover, connections, dialogs, card-editor, node-actions, admin, layout, theme, main.
- `scripts/dev-server.js` — servidor estático F0a; lo sustituye Fastify en F1.
## Contexto para F0b
- Bindings top-level reasignados (candidatos a `S.x`): `state`, `cam`, `ptr`, `spaceDown`, `altDown`, `rafPending`, `popoverOpen`, `vpRect`… → `grep -n -E '^(let|var) ' client/js -r` y `grep -n -E '^\s*(state|cam|ptr|…) = '`.
- `'use strict';` de línea 1 sobra en ESM (módulos son strict): quitarla y ajustar/retirar `split.test.js`.
- `package.json` es `commonjs` para los scripts; F0b decide si pasa a `"type": "module"` (Fastify ESM en F1 lo requerirá).
