# Contribuir

- Node ≥ 22.13. `npm ci && npm run dev` (http://localhost:3000). `npm test` y `npm run lint` deben pasar; `node scripts/smoke.js` (Chrome) para cambios de UI.
- Estructura y reglas: `CLAUDE.md` (mapa, comandos, reglas), `docs/MAP.md` (un archivo por línea), `docs/DECISIONS.md` (append-only: no rediscutir), `PENDIENTE.md` (fases pendientes y seguimiento).
- Modelo: `schema/*.schema.json` + `server/db/migrations/*.sql` son la documentación; no duplicar en prosa. Migraciones nuevas: `NNN_nombre.sql`, nunca editar una aplicada.
- Permisos siempre en servidor (`app.guard('acción')` en cada ruta, matriz en `server/lib/permissions.js`); el cliente solo oculta UI.
- Cliente sin bundler (ESM vanilla): estado reasignable solo en `S.x`; sin `window.*`; sin archivos nuevos > 300 líneas.
- UI y docs en español; código e identificadores en inglés. Commits pequeños `feat: …`, `fix: …`, `docs: …`.
- PRs contra `main` con CI verde. Para cambios de modelo o permisos, añade tests (`tests/*.test.js`).
