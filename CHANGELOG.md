# Changelog

## Sin publicar
- Página de proyecto por card (P11): desde el menú contextual o el botón **▤ Proyecto** de la ficha/editor, cada Main/Child instance, Design System o UI Kit abre `#/p/<página>/n/<card>/project/<overview|cronograma|kanban>` con tres pestañas: **Overview** (banner de marca, frase y secciones numeradas con plantilla inicial de 9 secciones; ocho tipos de sección editables, reordenables y eliminables), **Cronograma** (fases × semanas ISO generadas desde las fechas, primera columna fija y scroll horizontal, círculo con siglas en el color de la fase, línea hasta la fecha de fin, marcador de hoy, sprints configurables) y **Actividades Kanban** (To Do · Doing · Done · Cancelled, arrastrar entre columnas o cambiar el estado en el modal; las actividades del cronograma y las sueltas). Editan quienes editan la página y, en cualquier nivel, el responsable y los asignados de la card (`projects.edit`). Migración `013_projects.sql`, `schema/project.schema.json`, API `…/project` (+ `sections`, `phases`, `activities`), proyectos incluidos en duplicar página y en export/import de organización; `tests/projects.test.js`; paso de smoke.
- Roles por nivel y Organización (P10): cinco niveles (Admin, Ops, Head, Lead, Viewer; `designer` → `viewer`, migración `012_roles.sql`), nombres visibles configurables (salvo Admin), pestaña **Lobby → Organización** (datos, niveles y roles, tabla de capacidades, plantilla con células y asignaciones, invitar, 🔑, eliminar organización), Lead con visibilidad parcial que no pierde lo oculto al guardar, Viewer que edita sus propias cards con un editor acotado (`PATCH /api/pages/:p/nodes/:n`), `GET/PATCH/DELETE /api/org`, reglas de asignación por nivel en usuarios e invitaciones. Campos `email`/`password` con el mismo estilo que el resto.
- Thumbnail para Figma (P9): sección «Thumbnail» en la pestaña General del editor (geografía con bandera, icono propio, vista previa en vivo) con «Copiar thumbnail» (PNG 1920×1080 al portapapeles) y «Descargar PNG»; los mismos botones en la ficha de lectura. Migración `011_thumbnail.sql` (`nodes.geo`, `nodes.thumb_icon_id`); el icono cuenta como uso de la imagen.

## 1.0.0 — 2026-10-07
Primera versión estable para uso diario: contraseñas, correo, hardening y material de comunidad sobre la base de 0.1.0.
- Correo SMTP (P7): cliente SMTP propio sin dependencias (`SMTP_URL`, `MAIL_FROM`, `PUBLIC_URL`); las invitaciones se envían por correo (estado enviada/pendiente) y el login ofrece «¿Olvidaste tu contraseña?» (`POST /api/auth/forgot` siempre 204, `POST /api/auth/reset` con token de un solo uso, 1 h); «Probar envío» en Administración → Usuarios; perfil `dev` de compose con Mailpit; migración `010_mail.sql`.
- Docs (P5): recorrido de 10 minutos para designers y heads en `docs/USER.md`; checklist operativa (respaldo, actualización, restauración, invitar, desactivar, auditar) en `docs/ADMIN.md`.
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
