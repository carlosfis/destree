# Seguridad: modelo de amenazas y medidas

Resumen operativo para quien expone DesTree a Internet. Cómo reportar una vulnerabilidad: `SECURITY.md` en la raíz del repo.

## Qué protege y de quién
- **Activos**: el árbol de software con sus responsables, documentación, imágenes y versiones; las cuentas (correo, hash de contraseña); el audit log; los respaldos.
- **Actores**: usuarios autenticados con tres roles (admin / head / designer); anónimos que llegan a la URL pública; un atacante con un navegador en la misma red o con un enlace malicioso.
- **Fuera de alcance**: compromiso del host o del volumen `./data` (quien lee el disco lee la BD), ataques al proxy TLS, fuerza bruta distribuida desde muchas IP (el rate-limit es por IP y en memoria).

## Medidas por capa
| Riesgo | Medida |
|---|---|
| Acceso sin cuenta | Toda `/api/*` y `/uploads/*` exige cookie de sesión (`destree_sid`, HttpOnly, SameSite=Lax, `Secure` con `TRUST_PROXY=1`). Solo son públicas `GET /api/health`, `GET/POST /api/setup` (hasta el primer usuario), `POST /api/auth/login`, `GET /api/invites/:token`, `POST /api/invites/accept`. |
| Escalada entre roles | Permisos **solo en servidor**: cada ruta lleva `app.guard('acción')` (matriz en `server/lib/permissions.js`); el cliente solo oculta botones. Visibilidad por células aplicada al documento, a las versiones y a las imágenes (`lib/visibility.js`, `lib/images.js`). |
| CSRF | Mutaciones `/api/*` exigen que `Origin`/`Referer` coincida con `Host` (`plugins/origin-check.js`); cookie SameSite=Lax. |
| XSS | CSP estricta sin `unsafe-inline` (`script-src 'self'`, `style-src 'self'`); todo texto de usuario pasa por `esc()`; el markdown propio escapa antes de marcar y solo admite enlaces `http(s)`; sin HTML crudo. Los estilos dinámicos van por CSSOM (`data-style` → `applyDataStyles`). |
| Clickjacking / fugas | `frame-ancestors 'none'` + `X-Frame-Options: DENY`; `Referrer-Policy: same-origin`; `Permissions-Policy` sin cámara/micrófono/geolocalización; `Cross-Origin-Opener-Policy: same-origin`; `X-Content-Type-Options: nosniff` en todas las respuestas. |
| Fuerza bruta | Rate-limit por IP: cupo `auth` (setup, login, aceptar invitación, `PATCH /api/me`) 10 intentos / 15 min; cupo `images` (`POST /api/images`) 60 / min. 429 al superarlo. |
| Contraseñas | scrypt (N=16384, sal de 16 bytes). Cambio propio exige la actual y cierra las demás sesiones; el restablecimiento por admin fija una temporal que nunca viaja al servidor como texto registrado. El servidor jamás devuelve ni registra hashes ni contraseñas (audit incluido). |
| Sesiones | Token aleatorio de 32 bytes; en BD solo su SHA-256; 30 días; las caducadas se purgan al arrancar y al usarse. Cambiar rol, desactivar o restablecer contraseña cierra las sesiones del usuario. «Cerrar las demás sesiones» disponible en Mi cuenta. |
| Invitaciones | Token aleatorio (hash en BD), 7 días, un solo uso, revocable. El token nunca aparece en los logs (`lib/log.js` enmascara la URL). |
| Subida de archivos | Tipo real por magic bytes (PNG/JPEG/WebP/SVG), ≤5 MB, re-codificación a WebP con `sharp` (el SVG se rasteriza: no se sirve SVG de usuario); servidas con control de acceso y `nosniff`. |
| Inyección SQL | Consultas preparadas con `node:sqlite`; validación de cuerpos con JSON Schema (`additionalProperties:false`). |
| Logs | Sin cuerpos, cookies, tokens ni contraseñas: el serializador de request solo registra método, URL enmascarada e IP; `redact` para `cookie`/`authorization`/`set-cookie`. |
| Disponibilidad | Límite de cuerpo 32 MB (512 MB solo en import de organización, admin); cierre ordenado con SIGTERM/SIGINT (cierra SQLite y suelta `.server.lock`); `HEALTHCHECK` en la imagen. |
| Secretos | Solo en `.env` (gitignored). La app no necesita claves externas. |

## Cabeceras aplicadas
Respuestas HTML, estáticos y `/uploads/*`:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Frame-Options: DENY
Referrer-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
X-Content-Type-Options: nosniff
```
`/api/*` recibe solo `X-Content-Type-Options` y `Referrer-Policy` (es JSON; la CSP no aplica). HSTS lo añade el proxy TLS (Caddy lo hace por defecto).

Comprobación:
```
curl -I https://tu.dominio/            # debe mostrar las cabeceras de arriba
curl -I https://tu.dominio/api/health  # sin Content-Security-Policy
```

## Recomendaciones de despliegue
- Siempre detrás de TLS (`docker compose --profile https` o tu proxy) con `TRUST_PROXY=1`.
- Respaldos fuera del host (`BACKUP_CRON` + copia externa) y un simulacro de restauración.
- Mantén pocos admins; usa head para la operación diaria y designer para lectura.
- Actualiza con `docker compose pull && docker compose up -d` tras leer `CHANGELOG.md`.
