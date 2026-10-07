# Handoff F0b — ESM + scaffolding docs + GitHub   [✅ completa]
Commit: <hash> · Tag: f0b (f0a → f677074)
## Hecho
- Cliente a ESM: 21 módulos con `import`/`export` explícitos; `client/index.html` con un único `<script type="module" src="js/main.js">`; sin `'use strict'`.
- `core/state.js` exporta `S` con 13 claves migradas desde `let` top-level: `firstRun`, `state`, `cam` (state.js) · `vpRect`, `camRaf` (camera) · `mmScale` (minimap) · `ptr`, `spaceDown`, `altDown`, `rafPending` (pointer-gestures) · `nudgeTimer` (keyboard) · `popoverOpen` (popover) · `adminTab` (admin). Toda reasignación/lectura → `S.x` (incl. spread `...S.state`).
- Nuevo `core/dom.js` (hoja): `viewport`, `world`, `nodesLayer`, `edgeLayer`, `guidesSvg`. `measureViewport()` primera línea de `init()`.
- `window.S` solo en localhost. `keyboard.js` importado por efectos desde `main.js`.
- `package.json` `"type": "module"`; `scripts/*.js` en ESM; `dev-server.js` responde 204 a `/favicon.ico`.
- `tests/client.test.js` sustituye a `split.test.js` (paridad CSS + estructura ESM). `scripts/smoke.js`: checklist en Chrome headless vía CDP.
- Docs: `CLAUDE.md` (41 líneas), `docs/MAP.md`, `docs/DECISIONS.md` (+6), `LICENSE` MIT, `README.md`. `PLAN.md` F0b ✅.
- GitHub: `carlosfis/destree` público; tags `f0a`, `f0b`.
## Verificado
- `npm test` → 6/6 pass · `npm run lint` → OK.
- `node scripts/smoke.js` → 13/13 ✔ (carga demo · crear · anidar · conectar · undo/redo · auto-layout · exportar · importar `export-actual.json` · tema · minimapa · atajos · arrastre/marquee/zoom · recarga) · 0 excepciones / 0 console.error.
- `gh repo view carlosfis/destree` → público; `git log --oneline -3` con tags.
## Pendiente / deuda
- Ninguna crítica. Archivos >190 líneas heredados: `pointer-gestures.js` 240, `state.js` 235, `pointer-drag.js` 201, `admin.js` 203 (partir solo al tocarlos).
- `gh` no está en PATH (`/opt/homebrew/bin/gh`).
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (6 líneas F0b): S sin asignaciones top-level fuera de state.js, `core/dom.js`, orden `measureViewport` → `applyTheme`, smoke fuera de `npm test`.
## Archivos clave
- `client/js/core/state.js` — `S` (L27-41) + modelo/persistencia.
- `client/js/core/dom.js` — nodos DOM compartidos.
- `client/js/main.js` — entrada única, `init()`, `window.S` dev.
- `tests/client.test.js` — estructura ESM; `scripts/smoke.js` — paridad en navegador.
## Contexto para F1
- `state.js` L173-194: `loadState`/`persist` sobre `localStorage` (`STORAGE_KEY` en utils.js); F1 añade `core/api.js` y deja localStorage solo offline.
- `normalizeState` (state.js L82-152) es la base de `server/lib/normalize.js` y de los JSON Schema.
- Import v1/v2 en `views/admin.js` L167+ (`legacy = kind === 'branch'`).
- `scripts/dev-server.js` se sustituye por Fastify static; `scripts/smoke.js` usa `PORT=5174` propio: adaptarlo a `npm start` (:3000).
- `export-actual.json` (11 nodos, 9 aristas, v2) en disco, gitignored → fixture `tests/fixtures/legacy-v2.json`.
