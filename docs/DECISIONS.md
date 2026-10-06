# Decisiones (append-only, 1 línea por decisión)
- 2026-10-06 F0a: `pointer` (sección JS 9) partido en `pointer-gestures.js` (down/move/up, L1305-1535) + `pointer-drag.js` (arrastre/guías/marquee/rueda/menú, L1536-1727) por corte limpio en comentario; ambos siguen como excepción >190 líneas.
- 2026-10-06 F0a: cada `.js` del split lleva `'use strict';` en línea 1 (el monolito era strict global); el test de paridad lo descuenta.
- 2026-10-06 F0a: sección 15 (eliminar/duplicar) → `ui/node-actions.js`; sección 18 (tema+toasts+atajos) → `ui/theme.js`; se separan en `toasts.js` solo cuando se toquen.
- 2026-10-06 F0a: `export-actual.json` (datos reales) queda gitignored; F1 deriva de él la fixture anonimizada `legacy-v2.json`.
- 2026-10-06 F0a: `npm test` incluye `tests/split.test.js` (diff de concatenación js/css vs legacy); se retira cuando F0b migre a ESM.
