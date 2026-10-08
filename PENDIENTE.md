# PENDIENTE — seguimiento por fases

Único registro del trabajo restante de DesTree. Cada fase tiene objetivo, quién la ejecuta, entregables con casillas y criterio de aceptación. **«usuario»** marca lo que solo puede hacer el dueño del repo (Carlos); el resto lo ejecuta el agente sin esperar prompt. Al cerrar una fase: casillas marcadas, verificación verde, commit, push, y una línea en `docs/DECISIONS.md` si hubo decisión nueva.

## Cómo retomar (para otro agente)
1. Leer `CLAUDE.md` (reglas) y este archivo entero.
2. Tomar la primera fase abierta cuyas tareas de agente no dependan de una tarea «usuario» sin hacer. Orden recomendado: P1 → P3 → P6 → P4 (parte agente) → P7 → P8. P2 y P5 son del usuario y pueden avanzar en paralelo.
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

## P2 — Verificar Docker y desplegar una instancia de prueba (usuario) — instalación verificada 2026-10-07; falta el despliegue real
**Objetivo:** confirmar que la instalación documentada funciona antes de regalar o anunciar nada.
- [x] Docker Desktop 4.94 instalado por el usuario (2026-10-07). El agente verificó en clone limpio: `cp .env.example .env` → `docker compose up -d --build` (build OK, `sharp` resuelto sin compilar) → `/api/health` 200 → `POST /api/setup` 201.
- [x] `docker compose down && docker compose up -d` conserva `./data` (login 200 tras reiniciar). Observado: `.server.lock` queda en `./data` tras `down` porque el proceso no atiende SIGTERM → lo resuelve el cierre ordenado de P6.
- [x] GHCR público: manifiesto 0.1.0 accesible sin login (amd64 + arm64) y `docker compose pull` real OK (2026-10-07, arm64).
- [ ] «usuario» Despliegue real: VPS (1 CPU / 512 MB basta) o máquina interna, dominio apuntando, puertos 80/443, `.env` con `DOMAIN` y `TRUST_PROXY=1`, `docker compose --profile https up -d`. Alternativa sin dominio: red local o Tailscale.
- [ ] Agente, tras el informe del despliegue real del usuario: corregir lo que falle y actualizar `docs/INSTALL.md`.
**Aceptación:** una instancia accesible por HTTPS con el asistente completado y un segundo usuario invitado que entra.

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
- [ ] «usuario» Descripción del repo (aún dice «métricas Figma»), topics y Discussions. El agente no tiene permiso para escribir en GitHub; ejecutar:
  `gh repo edit carlosfis/destree --description "Fuente única de verdad para agencias: árbol de software, Design Systems, UI Kits, responsables y documentación. Autoalojado (Node 22 + SQLite), roles admin/head/designer." --add-topic design-systems --add-topic design-ops --add-topic self-hosted --add-topic fastify --add-topic sqlite --add-topic agency --enable-discussions`
- [ ] «usuario» Subir el vídeo promo (`node promo/render.js` → `promo/destree-motion.mp4`) a YouTube/Vimeo o como asset de la release y pasar el enlace; el agente sustituye la línea «pendiente de publicar» en README y README.en.
- [x] Agente: capturas `docs/img/{canvas,drawer,lobby}.png` (`node scripts/screenshots.js`) enlazadas en README y README.en; el vídeo queda como línea «pendiente de publicar» hasta que el usuario pase el enlace.
- [x] Agente: `README.en.md` (traducción fiel del README) y enlace cruzado en la cabecera de ambos.
- [x] Agente: `SECURITY.md` (hecho en P6) y `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 en español, contacto = correo del mantenedor).
- [x] Agente: `npm audit --omit=dev` → había 2 high (`@fastify/static` ≤10.1.1, `sharp` <0.35.5); actualizados a 10.1.5 y 0.35.5, 0 vulnerabilidades; tests/smoke verdes; anotado en `CHANGELOG.md`.
- [ ] «usuario» Decidir idioma de la UI a futuro (solo español hoy; i18n sería una fase propia) y si se borran los tags remotos `f5`, `f6a`, `f6b`, `f7` (rastro de fases; no afectan a nada).
**Aceptación:** README con imagen y vídeo, versión en inglés, archivos de comunidad presentes, paquete e imagen descargables sin login.

## P5 — Operación diaria para Design Ops (usuario, con apoyo del agente) — guías del agente hechas 2026-10-07
**Objetivo:** que el equipo pueda vivir con la herramienta sin depender de quien la construyó.
- [ ] «usuario» Nombrar a una persona dueña del servidor (actualiza con `docker compose pull && up -d` tras `npm run backup`, revisa `/api/health`).
- [ ] «usuario» Respaldos fuera del host: `BACKUP_CRON` activo + copia de `data/backups` a S3/Drive/NAS (rclone o cron). Hacer **un simulacro de restauración** con `node scripts/restore.js` en una máquina limpia.
- [ ] «usuario» Monitorización: `/api/health` en Uptime Kuma, Better Uptime o similar, con aviso al dueño.
- [ ] «usuario» Convenciones del equipo: una página por cliente o área, nombres de tipo por página (Administrar → Tipos), células = squads, roles de Staff (`@usuario / rol`). Escribirlas en la descripción de cada página o en una página «Guía».
- [x] Agente: `docs/USER.md` ampliado con un recorrido de 10 minutos para designers (entrar, encontrar sus cards en ★ Mías, leer una ficha) y para heads (crear página, Main instance, anidar, conectar DS, Staff, documentación, historial).
- [x] Agente: `docs/ADMIN.md` con la checklist operativa (respaldo, actualización, restauración, invitar, desactivar, auditar).
**Aceptación:** restauración probada una vez, alerta de caída recibida en una prueba, guías publicadas.

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

## P7 — Correo SMTP (agente)
**Objetivo:** invitaciones y recuperación de contraseña sin copiar enlaces a mano.
- [ ] `server/lib/mailer.js` sin dependencias pesadas (SMTP con `node:net`/`node:tls` + AUTH LOGIN/PLAIN, o una dependencia pequeña si se decide y se anota en `docs/DECISIONS.md`); config `SMTP_URL`, `MAIL_FROM`, `PUBLIC_URL` en `.env.example` y `docs/INSTALL.md`.
- [ ] Botón «Probar envío» en Administración (admin) y perfil `dev` de compose con Mailpit (`:8025`) para pruebas locales.
- [ ] Invitación: si hay SMTP, se envía el correo con el enlace además de mostrarlo; estado `sent`/`pending` visible.
- [ ] «Olvidé mi contraseña»: `POST /api/auth/forgot` (siempre 204, rate-limit) + `POST /api/auth/reset` con token de un solo uso (hash en BD, 1 h); pantalla en `auth-views.js`.
- [ ] Tests con un servidor SMTP falso en memoria.
**Aceptación:** invitación llega a Mailpit y el enlace funciona; reset completo de contraseña sin intervención del admin.

## P8 — Release v1.0.0 (agente; publicación «usuario»)
- [ ] Revisión final de README/INSTALL/ADMIN/USER/API; `CHANGELOG.md` 1.0.0.
- [ ] `package.json` 1.0.0; `git tag v1.0.0` + push → `release.yml` publica imagen `:1.0.0` y `:latest` y el zip.
- [ ] «usuario» Comprobar la release en GitHub y anunciar (enlace al vídeo y al README).
**Aceptación:** instalación limpia desde la release cumple `docs/INSTALL.md`.

---

## Resueltos
- 2026-10-07 P5 (agente): recorrido de 10 minutos en `docs/USER.md` (designer y head) y checklist operativa en `docs/ADMIN.md`.
- 2026-10-07 P4 (agente): capturas + `scripts/screenshots.js`, `README.en.md`, `CODE_OF_CONDUCT.md`, audit limpio tras actualizar `@fastify/static` y `sharp`.
- 2026-10-07 P6 Hardening: cabeceras + CSP estricta (sin inline), logs sin secretos, rate-limit por cupos, purga de sesiones, cerrar las demás sesiones, cierre ordenado SIGTERM, `tests/e2e.test.js`, `docs/SECURITY.md` + `SECURITY.md`.
- 2026-10-07 P3 Contraseñas: `PATCH /api/me` (name, contraseña con verificación de la actual, cierra las demás sesiones, rate-limit), diálogo «Mi cuenta» desde el chip, 🔑 «Restablecer contraseña» en Administración → Usuarios (temporal mostrada una vez), docs y smoke.
- 2026-10-07 P2 (parte verificable): Docker Desktop instalado; clone limpio + `compose up --build` + health + setup + `down/up` conserva datos + `pull` GHCR, todo OK.
- 2026-10-07 P1 UI acotada: estado vacío del lienzo, «Cargando…», Escape en overlays, foco en pestañas, aria-labels, marca «DesTree», responsive ≥360 px, dos pasos nuevos en el smoke.
- 2026-10-07 P0 Limpieza: fuera `PLAN.md`, `docs/handoff/`, `legacy/`, `docs/FIGMA.md`, restos de Figma en código/config/docs y el perfil Mailpit; `PENDIENTE.md` reorganizado en fases; `CLAUDE.md` reescrito; tests sin dependencia del prototipo. Trabajo promo commiteado.
- 2026-10-07 CI (`ci.yml`) verde en main; release `v0.1.0` creada por `release.yml` (imagen multi-arch + zip). Nota: GitHub no dispara workflows al subir >3 tags a la vez.
