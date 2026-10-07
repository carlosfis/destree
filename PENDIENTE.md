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

## P2 — Verificar Docker y desplegar una instancia de prueba (usuario)
**Objetivo:** confirmar que la instalación documentada funciona antes de regalar o anunciar nada.
- [ ] «usuario» En una máquina con Docker: `git clone … && cp .env.example .env && docker compose up -d --build && curl -s localhost:3000/api/health`. Completar el asistente en :3000. Si `sharp` falla en el build, pegar el log en una issue.
- [ ] «usuario» `docker compose down && docker compose up -d` conserva `./data` (login sigue funcionando).
- [ ] «usuario» GHCR: hacer público el paquete `ghcr.io/carlosfis/destree` (GitHub → Packages → destree → Package settings → Change visibility). Comprobar `docker manifest inspect ghcr.io/carlosfis/destree:0.1.0` (amd64 + arm64) y `docker compose pull` sin login.
- [ ] «usuario» Despliegue real: VPS (1 CPU / 512 MB basta) o máquina interna, dominio apuntando, puertos 80/443, `.env` con `DOMAIN` y `TRUST_PROXY=1`, `docker compose --profile https up -d`. Alternativa sin dominio: red local o Tailscale.
- [ ] Agente, tras el informe del usuario: corregir lo que falle y actualizar `docs/INSTALL.md`.
**Aceptación:** una instancia accesible por HTTPS con el asistente completado y un segundo usuario invitado que entra.

## P3 — Contraseñas (agente)
**Objetivo:** quitar la fricción número uno del uso diario: hoy no hay cambio de contraseña propio y el reset del admin es solo por API.
- [ ] `PATCH /api/me` con `{ currentPassword, newPassword }` (verifica la actual, invalida las demás sesiones, audit `user.password`); test en `tests/permissions.test.js` o nuevo `tests/account.test.js`.
- [ ] UI: «Cambiar contraseña» accesible desde el chip de usuario (diálogo con actual / nueva / repetir, mín. 8).
- [ ] UI admin (Administrar → Usuarios): acción «Restablecer contraseña» que fija una temporal y la muestra una sola vez para copiar (usa el `PATCH /api/users/:id` existente).
- [ ] Opcional: `PATCH /api/me` también permite cambiar `name`.
- [ ] Docs: `docs/ADMIN.md` (quitar la mención a curl), `docs/API.md`, `docs/USER.md`.
**Aceptación:** un designer cambia su contraseña y vuelve a entrar; un admin restablece la de otro usuario desde la UI; tests verdes.

## P4 — Publicación a la comunidad (mixto)
**Objetivo:** que alguien que llega al repo entienda qué es, lo vea y lo instale sin ayuda.
- [ ] «usuario» Repo público; descripción, topics (`design-systems`, `design-ops`, `self-hosted`, `fastify`, `sqlite`) y Discussions activadas. Si GitHub no responde desde la red del agente, estas comprobaciones las hace el usuario.
- [ ] «usuario» Subir el vídeo promo (`node promo/render.js` → `promo/destree-motion.mp4`) a YouTube/Vimeo o como asset de la release y pasar el enlace.
- [ ] Agente: 2–3 capturas (lienzo, drawer, lobby) en `docs/img/` tomadas con el smoke o Chrome headless, enlazadas en el README junto al vídeo.
- [ ] Agente: `README.en.md` (traducción fiel del README) y enlace cruzado en la cabecera de ambos.
- [ ] Agente: `SECURITY.md` (cómo reportar vulnerabilidades, versiones soportadas) y `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 en español).
- [ ] Agente: `npm audit --omit=dev` sin high/critical (requiere red); anotar resultado en `CHANGELOG.md`.
- [ ] «usuario» Decidir idioma de la UI a futuro (solo español hoy; i18n sería una fase propia) y si se borran los tags remotos `f5`, `f6a`, `f6b`, `f7` (rastro de fases; no afectan a nada).
**Aceptación:** README con imagen y vídeo, versión en inglés, archivos de comunidad presentes, paquete e imagen descargables sin login.

## P5 — Operación diaria para Design Ops (usuario, con apoyo del agente)
**Objetivo:** que el equipo pueda vivir con la herramienta sin depender de quien la construyó.
- [ ] «usuario» Nombrar a una persona dueña del servidor (actualiza con `docker compose pull && up -d` tras `npm run backup`, revisa `/api/health`).
- [ ] «usuario» Respaldos fuera del host: `BACKUP_CRON` activo + copia de `data/backups` a S3/Drive/NAS (rclone o cron). Hacer **un simulacro de restauración** con `node scripts/restore.js` en una máquina limpia.
- [ ] «usuario» Monitorización: `/api/health` en Uptime Kuma, Better Uptime o similar, con aviso al dueño.
- [ ] «usuario» Convenciones del equipo: una página por cliente o área, nombres de tipo por página (Administrar → Tipos), células = squads, roles de Staff (`@usuario / rol`). Escribirlas en la descripción de cada página o en una página «Guía».
- [ ] Agente: `docs/USER.md` ampliado con un recorrido de 10 minutos para designers (entrar, encontrar sus cards en ★ Mías, leer una ficha) y para heads (crear página, Main instance, anidar, conectar DS, Staff, documentación, historial).
- [ ] Agente: `docs/ADMIN.md` con la checklist operativa (respaldo, actualización, restauración, invitar, desactivar, auditar).
**Aceptación:** restauración probada una vez, alerta de caída recibida en una prueba, guías publicadas.

## P6 — Hardening (agente)
**Objetivo:** exponer la instancia a Internet con garantías razonables.
- [ ] Cabeceras en respuestas HTML y estáticos: `Content-Security-Policy` (sin inline; `img-src 'self' data: blob:`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`. `/api/*` sin CSP.
- [ ] Cierre ordenado: SIGTERM/SIGINT → `app.close()` (cierra SQLite y suelta `.server.lock`).
- [ ] Rate-limit también en `PATCH /api/me` (P3) y en `POST /api/images`.
- [ ] Logs sin secretos (revisar que nunca se registre `password`, cookies ni tokens de invitación).
- [ ] Sesiones: purga de sesiones caducadas al arrancar; «cerrar las demás sesiones» en el diálogo de contraseña.
- [ ] `tests/e2e.test.js`: setup → login 3 roles → página → visibilidad → imagen → versión → respaldo, en una sola BD temporal.
- [ ] `docs/SECURITY.md` con el modelo de amenazas resumido y las cabeceras aplicadas; `curl -I` documentado en `docs/INSTALL.md`.
**Aceptación:** `curl -I` muestra las cabeceras; la app funciona con CSP activa (smoke verde); tests verdes.

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
- 2026-10-07 P1 UI acotada: estado vacío del lienzo, «Cargando…», Escape en overlays, foco en pestañas, aria-labels, marca «DesTree», responsive ≥360 px, dos pasos nuevos en el smoke.
- 2026-10-07 P0 Limpieza: fuera `PLAN.md`, `docs/handoff/`, `legacy/`, `docs/FIGMA.md`, restos de Figma en código/config/docs y el perfil Mailpit; `PENDIENTE.md` reorganizado en fases; `CLAUDE.md` reescrito; tests sin dependencia del prototipo. Trabajo promo commiteado.
- 2026-10-07 CI (`ci.yml`) verde en main; release `v0.1.0` creada por `release.yml` (imagen multi-arch + zip). Nota: GitHub no dispara workflows al subir >3 tags a la vez.
