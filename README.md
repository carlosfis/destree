# DesTree

Fuente única de verdad para agencias: árbol de software → Design Systems / UI Kits, responsables, documentación y métricas de Figma. Autoalojado, multi-página, roles admin/head/designer.

**Estado:** F1 — cliente vanilla JS (ESM) + Fastify 5 + SQLite (`node:sqlite`); documento validado con JSON Schema (`schema/`). Plan completo en `PLAN.md`.

## Uso
```
npm run migrate # crea data/destree.db
npm start       # http://localhost:3000
npm test        # verificación
```
Requiere Node ≥ 22.13 (`node:sqlite`). Dependencias: fastify, @fastify/static, ajv-formats.

## Documentación
- `docs/MAP.md` — mapa de archivos · `docs/DECISIONS.md` — decisiones · `docs/handoff/` — handoff por fase.

## Licencia
MIT — ver `LICENSE`.
