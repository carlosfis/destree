# PENDIENTE — seguimiento por fases

Único registro del trabajo restante de DesTree. Cada fase tiene objetivo, quién la ejecuta, entregables con casillas y criterio de aceptación. **«usuario»** marca lo que solo puede hacer el dueño del repo (Carlos); el resto lo ejecuta el agente sin esperar prompt. Al cerrar una fase: casillas marcadas, verificación verde, commit, push, y una línea en `docs/DECISIONS.md` si hubo decisión nueva.

## Cómo retomar (para otro agente)
1. Leer `CLAUDE.md` (reglas) y este archivo entero.
2. Estado al 2026-10-10: todas las fases de agente cerradas (P1, P3–P15); **v1.1.0 publicada**; UI en inglés (P15) en `main` sin release (CHANGELOG «Sin publicar»). Sin pendientes «usuario». Siguiente fase cuando Carlos la pida (p. ej. release 1.2.0 con la UI en inglés). Regla vigente: la UI nueva se enseña y aprueba antes de subir a `main`.
3. Verificación antes de cerrar: `npm test` · `npm run lint` · `node scripts/smoke.js` (si hubo UI). Actualizar `docs/MAP.md` si se crean o mueven archivos, `docs/API.md` si cambian endpoints, `CHANGELOG.md` en cada release.
4. Lo que surja y no pueda resolverse solo se añade aquí como casilla «usuario», nunca bloquea.

---

## P1 — UI acotada (agente) ✅ 2026-10-07
**Objetivo:** que un designer o head pueda usar la app sin tropiezos en pantalla pequeña y sin estados ambiguos.
- [x] Estado vacío del lienzo: página sin cards muestra una guía centrada (crear Main instance para editores; aviso de solo lectura para designer) que desaparece al crear la primera card.
- [x] Indicador de carga al cambiar de página (barra de estado «Cargando…») y estados vacíos/errores ya existentes en lobby, admin, historial y asignaciones revisados.
- [x] Responsive ≥360 px: topbar sin desbordes (textos ocultos, chip compacto), lobby y `#/admin` sin scroll horizontal (cabecera, pestañas, formularios, tabla de audit), drawer e inputs de staff/documentación apilados.
- [x] Teclado y foco: Escape cierra lobby/admin y vuelve al lienzo; foco inicial en cada diálogo y overlay; botones de icono con `aria-label`.
- [x] Marca coherente: `<title>` y marca de la topbar dicen «DesTree».
- [x] Smoke: pasos nuevos para estado vacío, Escape en lobby y viewport 360×740 sin scroll horizontal.
**Aceptación:** `npm test`, `npm run lint` y `node scripts/smoke.js` verdes; smoke incluye los tres pasos nuevos. Cumplida: 24 tests, lint OK, smoke 27/27 (los dos pasos P1 cubren estado vacío + Escape y viewport 360×740).

## P2 — Verificar Docker y desplegar una instancia de prueba (usuario) ✅ 2026-10-07 (despliegue de referencia descartado 2026-10-09)
**Objetivo:** confirmar que la instalación documentada funciona antes de regalar o anunciar nada.
- [x] Docker Desktop 4.94 instalado por el usuario (2026-10-07). El agente verificó en clone limpio: `cp .env.example .env` → `docker compose up -d --build` (build OK, `sharp` resuelto sin compilar) → `/api/health` 200 → `POST /api/setup` 201.
- [x] `docker compose down && docker compose up -d` conserva `./data` (login 200 tras reiniciar). Observado: `.server.lock` queda en `./data` tras `down` porque el proceso no atiende SIGTERM → lo resuelve el cierre ordenado de P6.
- [x] GHCR público: manifiesto 0.1.0 accesible sin login (amd64 + arm64) y `docker compose pull` real OK (2026-10-07, arm64).
- [x] Despliegue de referencia: descartado por Carlos (2026-10-09); cada instalación sigue `docs/INSTALL.md`.
**Aceptación:** instalación documentada verificada en clone limpio (cumplida).

## P3 — Contraseñas (agente) ✅ 2026-10-07
**Objetivo:** quitar la fricción número uno del uso diario: hoy no hay cambio de contraseña propio y el reset del admin es solo por API.
- [x] `PATCH /api/me` con `{ currentPassword, newPassword }` (verifica la actual, invalida las demás sesiones, audit `user.password`); test en `tests/permissions.test.js` o nuevo `tests/account.test.js`.
- [x] UI: «Cambiar contraseña» accesible desde el chip de usuario (diálogo con actual / nueva / repetir, mín. 8).
- [x] UI admin (Administrar → Usuarios): acción «Restablecer contraseña» que fija una temporal y la muestra una sola vez para copiar (usa el `PATCH /api/users/:id` existente).
- [x] Opcional: `PATCH /api/me` también permite cambiar `name`.
- [x] Docs: `docs/ADMIN.md` (quitar la mención a curl), `docs/API.md`, `docs/USER.md`.
**Aceptación:** un designer cambia su contraseña y vuelve a entrar; un admin restablece la de otro usuario desde la UI; tests verdes. Cumplida: 26 tests (`tests/account.test.js` nuevo), lint OK, smoke 29/29 con dos pasos P3 (designer cambia contraseña desde el chip; admin restablece y la temporal entra).

## P4 — Publicación a la comunidad (mixto) — parte del agente hecha 2026-10-07
**Objetivo:** que alguien que llega al repo entienda qué es, lo vea y lo instale sin ayuda.
- [x] Repo público (comprobado 2026-10-07).
- [x] «usuario» Descripción del repo, topics y Discussions (hecho por Carlos 2026-10-09; verificado con `gh repo view`). Comando usado:
  `gh repo edit carlosfis/destree --description "Fuente única de verdad para agencias: árbol de software, Design Systems, UI Kits, responsables y documentación. Autoalojado (Node 22 + SQLite), cinco niveles de rol (Admin · Ops · Head · Lead · Viewer)." --add-topic design-systems --add-topic design-ops --add-topic self-hosted --add-topic fastify --add-topic sqlite --add-topic agency --enable-discussions`
- [x] Vídeo promo descartado por Carlos (2026-10-09): `promo/` eliminado del repo y del README; sin vídeo en el roadmap.
- [x] Agente: capturas `docs/img/{canvas,drawer,lobby}.png` (`node scripts/screenshots.js`) enlazadas en README y README.en; el vídeo se descartó después.
- [x] Agente: `README.en.md` (traducción fiel del README) y enlace cruzado en la cabecera de ambos.
- [x] Agente: `SECURITY.md` (hecho en P6) y `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 en español, contacto = correo del mantenedor).
- [x] Agente: `npm audit --omit=dev` → había 2 high (`@fastify/static` ≤10.1.1, `sharp` <0.35.5); actualizados a 10.1.5 y 0.35.5, 0 vulnerabilidades; tests/smoke verdes; anotado en `CHANGELOG.md`.
- [x] Idioma de la UI: Carlos decide (2026-10-09) que haya versión en inglés → **P15**. Tags de fases (`f0a`…`f7`) borrados por Carlos el 2026-10-10 (el agente no puede ejecutar `git push --delete`).
**Aceptación:** README con capturas, versión en inglés, archivos de comunidad presentes, paquete e imagen descargables sin login.

## P5 — Operación diaria para Design Ops ✅ guías del agente hechas 2026-10-07; puntos «usuario» omitidos por Carlos 2026-10-09
**Objetivo:** que el equipo pueda vivir con la herramienta sin depender de quien la construyó.
- [x] ~~«usuario» Nombrar a una persona dueña del servidor (actualiza con `docker compose pull && up -d` tras `npm run backup`, revisa `/api/health`).~~ Omitido por Carlos (2026-10-09): la checklist de `docs/ADMIN.md` queda como referencia para quien instale.
- [x] ~~«usuario» Respaldos fuera del host: `BACKUP_CRON` activo + copia de `data/backups` a S3/Drive/NAS (rclone o cron). Hacer **un simulacro de restauración** con `node scripts/restore.js` en una máquina limpia.~~ Omitido por Carlos (2026-10-09): la checklist de `docs/ADMIN.md` queda como referencia para quien instale.
- [x] ~~«usuario» Monitorización: `/api/health` en Uptime Kuma, Better Uptime o similar, con aviso al dueño.~~ Omitido por Carlos (2026-10-09): la checklist de `docs/ADMIN.md` queda como referencia para quien instale.
- [x] ~~«usuario» Convenciones del equipo: una página por cliente o área, nombres de tipo por página (Administrar → Tipos), células = squads, roles de Staff (`@usuario / rol`). Escribirlas en la descripción de cada página o en una página «Guía».~~ Omitido por Carlos (2026-10-09): la checklist de `docs/ADMIN.md` queda como referencia para quien instale.
- [x] Agente: `docs/USER.md` ampliado con un recorrido de 10 minutos para designers (entrar, encontrar sus cards en ★ Mías, leer una ficha) y para heads (crear página, Main instance, anidar, conectar DS, Staff, documentación, historial).
- [x] Agente: `docs/ADMIN.md` con la checklist operativa (respaldo, actualización, restauración, invitar, desactivar, auditar).
**Aceptación:** guías publicadas (cumplida).

## P6 — Hardening (agente) ✅ 2026-10-07
**Objetivo:** exponer la instancia a Internet con garantías razonables.
- [x] Cabeceras en respuestas HTML y estáticos: `Content-Security-Policy` (sin inline; `img-src 'self' data: blob:`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`. `/api/*` sin CSP.
- [x] Cierre ordenado: SIGTERM/SIGINT → `app.close()` (cierra SQLite y suelta `.server.lock`).
- [x] Rate-limit también en `PATCH /api/me` (P3) y en `POST /api/images`.
- [x] Logs sin secretos (revisar que nunca se registre `password`, cookies ni tokens de invitación).
- [x] Sesiones: purga de sesiones caducadas al arrancar; «cerrar las demás sesiones» en el diálogo de contraseña.
- [x] `tests/e2e.test.js`: setup → login 3 roles → página → visibilidad → imagen → versión → respaldo, en una sola BD temporal.
- [x] `docs/SECURITY.md` con el modelo de amenazas resumido y las cabeceras aplicadas; `curl -I` documentado en `docs/INSTALL.md`.
**Aceptación:** `curl -I` muestra las cabeceras; la app funciona con CSP activa (smoke verde); tests verdes. Cumplida: 30 tests (e2e incluye SIGTERM en proceso real y logs sin secretos), lint OK, smoke 29/29 sin violaciones de CSP en consola.

## P7 — Correo SMTP (agente) ✅ 2026-10-07
**Objetivo:** invitaciones y recuperación de contraseña sin copiar enlaces a mano.
- [x] `server/lib/mailer.js` sin dependencias pesadas (SMTP con `node:net`/`node:tls` + AUTH LOGIN/PLAIN, o una dependencia pequeña si se decide y se anota en `docs/DECISIONS.md`); config `SMTP_URL`, `MAIL_FROM`, `PUBLIC_URL` en `.env.example` y `docs/INSTALL.md`.
- [x] Botón «Probar envío» en Administración (admin) y perfil `dev` de compose con Mailpit (`:8025`) para pruebas locales.
- [x] Invitación: si hay SMTP, se envía el correo con el enlace además de mostrarlo; estado `sent`/`pending` visible.
- [x] «Olvidé mi contraseña»: `POST /api/auth/forgot` (siempre 204, rate-limit) + `POST /api/auth/reset` con token de un solo uso (hash en BD, 1 h); pantalla en `auth-views.js`.
- [x] Tests con un servidor SMTP falso en memoria.
**Aceptación:** invitación llega a Mailpit y el enlace funciona; reset completo de contraseña sin intervención del admin. Cumplida con el servidor SMTP falso de `tests/mail.test.js` (34 tests, lint OK, smoke 30/30); la prueba real con Mailpit (`docker compose --profile dev up -d`) queda para el usuario al desplegar («usuario», no bloquea).

## P8 — Release v1.0.0 (agente; publicación «usuario») — etiquetada 2026-10-07
- [x] Revisión final de README/INSTALL/ADMIN/USER/API (hecha fase a fase); `CHANGELOG.md` 1.0.0. Verificación Docker de `main` antes de etiquetar: build con `sharp` 0.35, cabeceras, migración 010, `docker compose stop` libera `.server.lock`, login tras reinicio.
- [x] `package.json` 1.0.0; `git tag v1.0.0` + push → `release.yml` publica imagen `:1.0.0` y `:latest` y el zip (resultado del workflow anotado en Resueltos).
- [x] Comprobar la release: hecho por el agente en v1.0.0 y v1.1.0. «Anunciar» = difusión opcional (compartir el enlace de la release donde quieras: LinkedIn, comunidades de Design Ops, Discussions). Sin tarea técnica pendiente.
**Aceptación:** instalación limpia desde la release cumple `docs/INSTALL.md` (el agente lo comprueba con `docker compose pull` de `:1.0.0` cuando el workflow termina).

## P9 — Thumbnail para Figma (agente; aprobación «usuario») ✅ 2026-10-09
**Objetivo:** generar desde los datos de la instancia un PNG 1920×1080 para pegar a mano como thumbnail en Figma (sin depender de Figma).
- [x] Modelo: `nodes.geo` (ISO alfa-2) y `nodes.thumb_icon_id` (migración 011), schema + normalize; `imageUsage`/`purgeOrphans`/versiones/export cuentan el icono como uso.
- [x] Cliente: `js/ui/thumbnail.js` (render en canvas: staff como chips con siglas de rol, bandera, tipo, título, subtítulo `[ruta] [nombre] [etiquetas] [año]`, icono) y `js/ui/thumbnail-section.js` (sección en General: geografía, icono, vista previa en vivo, Copiar / Descargar PNG); botones en la ficha de lectura.
- [x] Tests (normalize geo/thumbIconId; icono en uso → no se purga, 409), paso de smoke, docs (USER, API, MAP, DECISIONS, CHANGELOG).
- [x] «usuario» Diseño del thumbnail aprobado por Carlos el 2026-10-09 (commit junto con P10).
**Aceptación:** con un nodo con staff, etiquetas, geografía e icono, «Copiar thumbnail» pega en Figma un PNG 1920×1080 equivalente a la vista previa; sin icono propio usa la imagen de la instancia; tests, lint y smoke en verde.

## P10 — Roles por nivel y pestaña Organización (agente; aprobación «usuario») ✅ 2026-10-09
**Objetivo:** cinco niveles de rol con etiquetas renombrables y un lugar único (Lobby → Organización) para los datos de la organización, la plantilla y las capacidades por rol.
- [x] Modelo: `server/lib/permissions.js` con roles por nivel (admin 5 · ops 4 · head 3 · lead 2 · viewer 1), matriz acción → nivel mínimo, roles asignables, etiquetas; migración `012_roles.sql` (designer → viewer); etiquetas en `orgs.settings_json.roleLabels`; symlink `client/js/core/permissions.js`.
- [x] Servidor: `GET/PATCH/DELETE /api/org` (`lib/org.js`, `routes/org.js`), `GET /api/users` con células y asignaciones, reglas de nivel en usuarios e invitaciones, `pages.meta`/`pages.visibility`/`nodes.assign`/`nodes.own`, PUT del Lead reconciliado (`reconcileForEditor`), `PATCH …/nodes/:id` de campos propios, `/api/me` con `org.roleLabels`, invitación con `roleLabel`, import de exports antiguos.
- [x] Cliente: pestaña **Organización** en el lobby (`views/org.js`: datos, niveles y roles, capacidades, correo, plantilla, invitar, zona de peligro), `users.js` refactorizado, `core/roles.js`, `ROLE_LABEL` sustituido por etiquetas de la organización, editor acotado del viewer (`.own-mode`, «Editar» en la ficha), pestaña Página por permisos, `#/lobby/<tab>`, estilo de inputs email/password.
- [x] Tests (`tests/roles.test.js` nuevo; permisos con tabla de 6 columnas; resto adaptado a viewer), smoke con dos pasos P10, docs (README ES/EN, USER, ADMIN, API, SECURITY, MAP, DECISIONS, CHANGELOG, CLAUDE.md).
- [x] «usuario» Aprobado por Carlos el 2026-10-09 sobre las capturas (Organización admin/ops, editor acotado del viewer, ficha con «Editar», login).
**Aceptación:** admin renombra «Viewer» → «Designer» y el cambio se ve en chips, selects y la tabla de capacidades; ops gestiona la plantilla sin tocar admins; head no crea páginas pero cambia visibilidad; lead guarda sin perder raíces que no ve; viewer edita solo sus cards; «Eliminar organización» vuelve al asistente. Cumplida: 39 tests, lint OK, smoke 33/33 con consola limpia.

---

## P11 — Página de proyecto por card (agente, hecho en DesTree-lab; aprobación «usuario») ✅ 2026-10-09
**Objetivo:** que cada card tenga su espacio de proyecto (Overview · Cronograma · Actividades Kanban) sin tocar el documento de página.
- [x] Migración 013, `schema/project.schema.json`, `lib/projects.js` + `lib/project-template.js`, rutas `…/project/*`, permiso `projects.edit`.
- [x] Vistas `client/js/views/project*.js`; menú contextual y botón ▤ Proyecto en ficha/editor.
- [x] Duplicar página y export/import de organización incluyen proyectos; `tests/projects.test.js`; paso de smoke P11.
- [x] Datos demo `scripts/seed-demo.js` + `scripts/seed/*` (dos páginas, cuatro células, cuentas por nivel); `tests/seed.test.js`.
**Aceptación:** cumplida en el lab y verificada en `main` el 2026-10-09: 43 tests, lint OK, smoke con consola limpia.

## P12 — Color de marca en Main instances (agente, hecho en DesTree-lab; aprobación «usuario») ✅ 2026-10-09
- [x] Migración 014 (`node.gradient`), diez presets en `normalize.js`, clases `.grad-<id>` (sin estilos inline, CSP intacta); selector obligatorio en raíces; banda en card, ficha y encabezados de proyecto.
- [x] `imageId` conservado en modelo y BD, oculto en el cliente; el thumbnail usa solo `thumbIconId`.
**Aceptación:** cumplida (ver P11).

## P13 — Limpieza para publicación (agente; decisiones «usuario») ✅ 2026-10-09
**Objetivo:** que el repo público refleje v1.1.0 (P9–P12) sin textos obsoletos y con capturas actuales.
- [x] Datos demo solo con marcas, productos y personas ficticias (Grupo Ambar: Ambar.mx, Banco Cobalto, Vértiga, Empeño Ágil, Casa Bruma; `scripts/seed/ambar-*.js`); el mantenedor aparece dos veces como DS Lead de Ambar DS. Decidido por Carlos y hecho 2026-10-09.
- [x] README y README.en reescritos (2026-10-09): cinco niveles, funciones P9–P12, «Probar con datos demo», seis capturas, Roadmap 1.1.0; sin vídeo.
- [x] `docs/ADMIN.md` → «Datos demo» (comandos local y Docker, cuentas y qué ve cada nivel, páginas, cómo retirarlos) y pointer en `docs/INSTALL.md` (2026-10-09).
- [x] Capturas nuevas sobre los datos demo (2026-10-09): `scripts/screenshots.js` siembra `seed-demo.js` en la BD temporal y genera `docs/img/{canvas,project,drawer,schedule,org,lobby}.png`.
- [x] Revisión de docs (2026-10-09): USER, ADMIN, API e INSTALL ya reflejaban P9–P12; MAP actualizado (capturas, screenshots, smoke por módulos, sin promo).
- [x] `@fastify/static` 10.1.5 → 10.1.6; `npm audit --omit=dev` en 0 (2026-10-09).
- [x] `scripts/smoke.js` partido (2026-10-09): arranque + helpers en `smoke.js`, pasos en `scripts/smoke/01-canvas.js`, `02-team.js`, `03-pages-admin.js`, `04-roles.js`; misma salida y consola limpia.
**Aceptación:** `grep -ri designer README* docs` sin resultados fuera de CHANGELOG/DECISIONS; capturas de 2026-10; tests, lint y smoke verdes.

## P14 — Release v1.1.0 (agente; publicación «usuario») ✅ 2026-10-09
- [x] `package.json`/`package-lock.json` 1.1.0; CHANGELOG «1.1.0 — 2026-10-09»; Roadmap de README y README.en (2026-10-09).
- [x] Verificación Docker (2026-10-09): imagen construida desde `main` con 1.1.0; sobre el respaldo del 2026-10-07 (migraciones 001–007) el contenedor aplicó 008–014 (roles migrados, `nodes.gradient`, `projects`); asistente, seed demo dentro del contenedor, login Lead/Viewer, permisos de proyecto (asignado 200, ajeno 403), reinicio con sesión y datos intactos, cabeceras 5/5, respaldo por API, `.server.lock` liberado al parar.
- [x] Tag `v1.1.0` creado y subido 2026-10-09 (confirmado por Carlos) → `release.yml` run 38026962153 en verde: release https://github.com/carlosfis/destree/releases/tag/v1.1.0 con `destree-1.1.0.zip`; imagen `ghcr.io/carlosfis/destree:1.1.0` (amd64 + arm64) y `:latest` con el mismo digest; instalación limpia desde la imagen publicada → `/api/health` version 1.1.0, asistente 201 y seed demo dentro del contenedor.
- [x] «usuario» Anunciar: opcional (ver P8).
**Aceptación:** `docker compose pull` de `:1.1.0` → `/api/health` version 1.1.0; los datos demo cargan en la instalación limpia.

## P15 — UI en inglés (agente; aprobación visual «usuario») ✅ 2026-10-10
**Objetivo:** que la interfaz pueda usarse en inglés sin tocar los datos: selector ES/EN persistente por navegador, por defecto según el idioma del navegador; español sigue siendo el idioma de referencia del código, los docs y los datos demo.
- [x] `client/js/core/i18n.js`: `t(texto, vars)` con el texto español como clave y diccionarios `client/js/i18n/en-{ui,views,editor,project}.js` (≈780 entradas); idioma en `<html lang>` + `localStorage destree:lang`; sin `let` top-level (2026-10-10).
- [x] Marcado estático traducido al arrancar (`translateStatic`); botón `#langSwitch` (EN/ES) en la topbar y enlace «English/Español» en las pantallas de acceso; cambiar recarga la página.
- [x] Vistas, UI, lienzo y `main.js` por `t()` (inventario automático sin restos); términos fijos intactos; etiquetas de capacidades, tipos de sección y estados traducidos al pintar.
- [x] Servidor: `req.lang` por `X-Lang` (`plugins/session.js`), error handler traduce (`server/lib/i18n.js`, 100 mensajes + patrones), correos bilingües, plantilla del proyecto por idioma; `tests/i18n.test.js`.
- [x] Chrome con `--lang=es` en smoke y capturas; `scripts/smoke/05-i18n.js` (login en inglés, topbar, lobby, Organización, editor, proyecto, errores del servidor, vuelta a ES); `tests/client.test.js` con 54 módulos y diccionarios fuera del chequeo de claves de `S`.
- [x] Docs: README (idioma) y README.en (capturas en inglés `docs/img/en/`), `docs/USER.md` «Idioma», CHANGELOG «Sin publicar», `docs/MAP.md`, regla 10 de `CLAUDE.md`, `docs/DECISIONS.md`.
- [x] «usuario» Capturas en inglés aprobadas por Carlos (2026-10-10) → push a `main`.
**Aceptación:** con el selector en EN no queda texto de interfaz en español en lienzo, sidebar, lobby, Organización, administración, página de proyecto, diálogos, toasts, correos ni errores del servidor; en ES todo sigue idéntico (smoke 34/34 + paso nuevo).

## Resueltos
- 2026-10-10 P15 UI en inglés: `t()` + diccionarios, selector ES/EN, `X-Lang` en servidor (errores, correos, plantilla), smoke 05-i18n (35 pasos), `tests/i18n.test.js`, capturas `docs/img/en/`; aprobada por Carlos y en `main`.
- 2026-10-09 P14 Release v1.1.0: bump, CHANGELOG, verificación Docker local (BD antigua migrada 008–014) y de la imagen publicada (multi-arch, latest, instalación limpia); tag confirmado por Carlos.
- 2026-10-09 P13 Limpieza para publicación: datos demo ficticios, sección «Datos demo» en ADMIN/INSTALL, `promo/` eliminado, README y README.en reescritos para 1.1.0, seis capturas sobre datos demo (`scripts/screenshots.js` + seed), MAP al día, `@fastify/static` 10.1.6, `scripts/smoke.js` partido en `scripts/smoke/0*.js` (34 pasos, consola limpia).
- 2026-10-09 P13 Datos demo ficticios: marcas, productos internos, personas, ids (`am_*`, `pg_eco_ambar`), URLs y claves Jira renombrados en `scripts/seed/*`, `tests/seed.test.js`, `tests/projects.test.js`, CHANGELOG y MAP; archivos `ambar-tree.js` / `ambar-projects.js`.
- 2026-10-09 P12 Color de marca (hecho en la copia `DesTree-lab`, traído a `main`): migración 014, diez degradados, banda en cards/ficha/proyecto; `imageId` oculto.
- 2026-10-09 P11 Página de proyecto (`DesTree-lab` → `main`): migración 013, API `…/project/*`, vistas Overview/Cronograma/Kanban, `projects.edit`, datos demo (`scripts/seed-demo.js`), `tests/projects.test.js` + `tests/seed.test.js`; 43 tests, smoke limpio en `main`.
- 2026-10-09 P10 Roles por nivel + Organización: `permissions.js` por niveles (symlink al cliente), migración 012 (designer → viewer), etiquetas por organización, Lobby → Organización (datos, roles, capacidades, plantilla, eliminar organización), reglas de asignación por nivel, Lead con PUT reconciliado, Viewer con editor acotado (`PATCH …/nodes/:id`), `tests/roles.test.js`, 39 tests, smoke 33/33.
- 2026-10-09 P9 Thumbnail para Figma: PNG 1920×1080 dibujado en el cliente (Canvas 2D) con staff, bandera (`geo`), tipo, título, subtítulo e icono (`thumb_icon_id`, migración 011); Copiar / Descargar en editor y ficha.
- 2026-10-07 P8 Release v1.0.0: tag `v1.0.0` → `release.yml` en verde (run 37729916325); release https://github.com/carlosfis/destree/releases/tag/v1.0.0 con `destree-1.0.0.zip`; imagen `ghcr.io/carlosfis/destree:1.0.0` y `:latest` (manifiesto público); instalación limpia con `docker compose pull && up -d` → `/api/health` version 1.0.0 y asistente 201. Queda «usuario»: comprobar y anunciar.
- 2026-10-07 P7 Correo SMTP: `lib/mailer.js` (SMTP propio), invitaciones por correo con estado, «Probar envío», `forgot`/`reset` con token de un solo uso, pantallas `#/forgot` y `#/reset/<token>`, Mailpit en perfil `dev`, migración `010_mail.sql`, `tests/mail.test.js`.
- 2026-10-07 P5 (agente): recorrido de 10 minutos en `docs/USER.md` (designer y head) y checklist operativa en `docs/ADMIN.md`.
- 2026-10-07 P4 (agente): capturas + `scripts/screenshots.js`, `README.en.md`, `CODE_OF_CONDUCT.md`, audit limpio tras actualizar `@fastify/static` y `sharp`.
- 2026-10-07 P6 Hardening: cabeceras + CSP estricta (sin inline), logs sin secretos, rate-limit por cupos, purga de sesiones, cerrar las demás sesiones, cierre ordenado SIGTERM, `tests/e2e.test.js`, `docs/SECURITY.md` + `SECURITY.md`.
- 2026-10-07 P3 Contraseñas: `PATCH /api/me` (name, contraseña con verificación de la actual, cierra las demás sesiones, rate-limit), diálogo «Mi cuenta» desde el chip, 🔑 «Restablecer contraseña» en Administración → Usuarios (temporal mostrada una vez), docs y smoke.
- 2026-10-07 P2 (parte verificable): Docker Desktop instalado; clone limpio + `compose up --build` + health + setup + `down/up` conserva datos + `pull` GHCR, todo OK.
- 2026-10-07 P1 UI acotada: estado vacío del lienzo, «Cargando…», Escape en overlays, foco en pestañas, aria-labels, marca «DesTree», responsive ≥360 px, dos pasos nuevos en el smoke.
- 2026-10-07 P0 Limpieza: fuera `PLAN.md`, `docs/handoff/`, `legacy/`, `docs/FIGMA.md`, restos de Figma en código/config/docs y el perfil Mailpit; `PENDIENTE.md` reorganizado en fases; `CLAUDE.md` reescrito; tests sin dependencia del prototipo. Trabajo promo commiteado.
- 2026-10-07 CI (`ci.yml`) verde en main; release `v0.1.0` creada por `release.yml` (imagen multi-arch + zip). Nota: GitHub no dispara workflows al subir >3 tags a la vez.
