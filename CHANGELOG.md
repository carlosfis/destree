# Changelog

## Sin publicar
- Dependencias: `@fastify/static` 8 → 10.1.5 y `sharp` 0.33 → 0.35.5 (avisos GHSA de path traversal en static y de libvips/libheif/librsvg en sharp). `npm audit --omit=dev` (2026-10-07): 0 vulnerabilidades.
- Comunidad (P4): `README.en.md`, capturas en `docs/img/` (`scripts/screenshots.js`), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`.
- Hardening (P6): CSP estricta sin inline (`data-style` → CSSOM), `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP y `nosniff`; logs sin cookies ni tokens (URL de invitación enmascarada); rate-limit por cupos (`auth`, `images` 60/min); purga de sesiones caducadas al arrancar; `DELETE /api/me/sessions` y botón «Cerrar las demás sesiones»; cierre ordenado con SIGTERM/SIGINT (suelta `.server.lock`); `tests/e2e.test.js`; `docs/SECURITY.md` y `SECURITY.md`.
- Contraseñas (P3): cada usuario cambia nombre y contraseña desde el chip de usuario (`PATCH /api/me`, exige la actual y cierra las demás sesiones); el admin restablece la de otro usuario desde Administración → Usuarios (temporal mostrada una vez). Rate-limit en `PATCH /api/me`.
- UI: estado vacío del lienzo con guía y botón «Nueva Main instance»; «Cargando…» al cambiar de página; Escape cierra lobby y administración; foco inicial en pestañas; `aria-label` en botones de icono; `<title>` y marca «DesTree» (título con el nombre de la página).
- Responsive ≥360 px: topbar compacta, lobby y administración sin desborde horizontal (cabecera, formularios, tabla de audit), filas de staff y documentación apiladas en el sidebar.
- Smoke: pasos nuevos para estado vacío + Escape y viewport 360×740.
- Limpieza del repo: fuera el plan por fases, los handoffs, el prototipo original y toda referencia a Figma; `PENDIENTE.md` como único seguimiento.

## 0.1.0 — 2026-10-06
Primer release autoalojable.
- Lienzo de árbol de software (contenedores anidados, DS / UI Kits, conexiones, etiquetas, tipos de ramificación, auto-layout, minimapa, undo/redo), migrado del prototipo a ESM + Fastify 5 + SQLite (`node:sqlite`).
- Documento validado con JSON Schema; PUT optimista con `If-Match`.
- Auth propia (scrypt, cookie de sesión), roles admin/head/designer, invitaciones por enlace, audit log.
- Células: visibilidad de raíces y páginas por célula, asignados y responsable, modo lectura para designer; documentación por card (enlaces + notas markdown).
- Multipágina: lobby, archivar/borrar (soft)/restaurar/duplicar, `#/admin` (usuarios, células, borradas, respaldos, audit).
- Imágenes seguras (magic bytes, WebP + miniatura, control de acceso en `/uploads`).
- Versiones por página (auto/manual, diff, restaurar) y respaldos tar.gz (manual, programado, restore) + export/import de organización.
- Docker (`node:22-bookworm-slim`, multi-arch), CI y release automatizados.
