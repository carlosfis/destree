# Changelog

## 0.1.0 — 2026-10-06
Primer release autoalojable (F0–F7).
- Lienzo de árbol de software (contenedores anidados, DS / UI Kits, conexiones, etiquetas, tipos de ramificación, auto-layout, minimapa, undo/redo), migrado del prototipo a ESM + Fastify 5 + SQLite (`node:sqlite`).
- Documento validado con JSON Schema; PUT optimista con `If-Match`.
- Auth propia (scrypt, cookie de sesión), roles admin/head/designer, invitaciones por enlace, audit log.
- Células: visibilidad de raíces y páginas por célula, asignados y responsable, modo lectura para designer; documentación por card (enlaces + notas markdown).
- Multipágina: lobby, archivar/borrar (soft)/restaurar/duplicar, `#/admin` (usuarios, células, borradas, respaldos, audit).
- Imágenes seguras (magic bytes, WebP + miniatura, control de acceso en `/uploads`).
- Versiones por página (auto/manual, diff, restaurar) y respaldos tar.gz (manual, programado, restore) + export/import de organización.
- Docker (`node:22-bookworm-slim`, multi-arch), CI y release automatizados.
