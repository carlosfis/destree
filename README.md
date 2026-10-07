# DesTree

Fuente única de verdad para agencias: árbol de software → Design Systems / UI Kits, responsables, documentación y métricas de Figma. Autoalojado, multi-página, roles admin/head/designer.

**Estado:** F0b — cliente vanilla JS (ESM) con persistencia en `localStorage`. Backend (Fastify 5 + SQLite) a partir de F1. Plan completo en `PLAN.md`.

## Uso
```
npm run dev     # http://localhost:5173
npm test        # verificación
```
Requiere Node ≥ 22. Sin dependencias.

## Documentación
- `docs/MAP.md` — mapa de archivos · `docs/DECISIONS.md` — decisiones · `docs/handoff/` — handoff por fase.

## Licencia
MIT — ver `LICENSE`.
