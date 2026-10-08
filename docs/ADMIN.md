# Administración

## Checklist operativa (quien cuida el servidor)
| Cuándo | Qué | Cómo |
|---|---|---|
| Diario (automático) | Respaldo programado | `BACKUP_CRON="30 3 * * *"` y `BACKUP_KEEP=10` en `.env`; comprueba en `#/admin → Respaldos` que aparecen con estado `ok`. |
| Semanal | Copia fuera del host | Sincroniza `data/backups/` a S3/Drive/NAS (rclone, cron). Un respaldo que solo vive en el servidor no es un respaldo. |
| Semanal | Salud | `curl -s https://tu.dominio/api/health` → `ok:true`, `db:"ok"`. Ideal: Uptime Kuma / Better Uptime con aviso. |
| Al publicar una versión | Actualizar | 1) respaldo manual (`#/admin → Respaldos → Crear` o `npm run backup`); 2) `docker compose pull && docker compose up -d` (sin Docker: `git pull && npm ci && npm start`); 3) revisa `CHANGELOG.md`; las migraciones se aplican solas. |
| Una vez al trimestre | Simulacro de restauración | En una máquina limpia: `docker compose run --rm destree node scripts/restore.js /data/backups/<archivo>` con el servicio parado (o `node scripts/restore.js <archivo>`), arranca y entra. Lo anterior queda en `data/restore-prev-<fecha>/`. |
| Cuando entra alguien | Invitar | `#/admin → Usuarios → Invitar` (rol + células). Si hay SMTP configurado el correo sale solo; si no, copia el enlace (7 días). |
| Cuando alguien se va | Desactivar | `#/admin → Usuarios → Desactivar` (cierra sus sesiones; no borra nada). Reasigna sus cards desde el lienzo si hace falta. |
| Contraseña olvidada | Restablecer | 🔑 en su fila (temporal, mostrada una vez) o «¿Olvidaste tu contraseña?» en el login si hay correo. |
| Ante una duda | Auditar | `#/admin → Audit log`, filtra por `user.`, `page.`, `cell.`, `version.`, `backup.`. |
| Al exponer a Internet | Seguridad | TLS (`--profile https` o tu proxy) + `TRUST_PROXY=1`; `curl -I` para ver las cabeceras; lee `docs/SECURITY.md`. |

## Primer arranque
`/` muestra el asistente: nombre de la organización + correo/contraseña del primer admin. Solo ocurre una vez (`GET /api/setup` → `needed:false` después).

## Invitar y gestionar usuarios (`#/admin → Usuarios`)
- Invitar genera un **enlace** (7 días). Con SMTP configurado (`SMTP_URL`, `MAIL_FROM`) el correo sale solo y la invitación aparece como «enviada»; sin SMTP, o si el envío falla, copias el enlace y lo compartes tú («pendiente»). El invitado crea su contraseña y entra con el rol y las células de la invitación. «Probar envío» (admin) manda un correo de prueba a tu propia dirección.
- Admin: cambia rol, desactiva/activa (desactivar cierra sesiones). Head: solo invita designers a sus células.
- Contraseña olvidada: con SMTP, la persona usa «¿Olvidaste tu contraseña?» en el login (enlace de un solo uso, 1 h, cierra sus sesiones). Sin SMTP, un admin pulsa 🔑 **Restablecer contraseña** en la fila del usuario: se genera una temporal, se muestra **una sola vez** para copiarla y se cierran las sesiones de esa persona; pásala por un canal seguro. La persona la cambia después desde su chip de usuario (**Mi cuenta**).
- Cada usuario cambia su propia contraseña y su nombre desde el chip de usuario (arriba a la derecha → **Mi cuenta**); cambiarla cierra sus demás sesiones.

## Células (`#/admin → Células`)
Equipos. Admin crea/renombra/colorea/elimina y fija un lead; admin y head (lead o miembro) gestionan miembros. Una raíz o página "solo células" la ven los miembros de esas células, además de asignados/responsables.

## Páginas
- Lobby (`⌂` o `#/lobby`): crear, renombrar, duplicar, archivar (reversible), borrar (admin; suave) y restaurar.
- Ajustes de página (`⚙ Página`): nombre, descripción, visibilidad + células, etiquetas, tipos de ramificación, datos (export/import JSON), ajustes del lienzo.
- `#/admin → Páginas borradas`: restaurar.

## Versiones (`⟲ Historial`)
Automáticas al guardar (fusionadas por usuario en 5 min; se conservan las últimas `VERSIONS_KEEP`), manuales con etiqueta, diff contra la actual, restaurar (crea una versión de restauración, nada se pierde). Archivar/borrar crean un snapshot.

## Respaldos (`#/admin → Respaldos`)
Crear/descargar/borrar tar.gz (BD + imágenes). Programación con `BACKUP_CRON`. Exportar/importar organización completa (JSON con imágenes): el import es aditivo y conserva ids; los usuarios importados no traen contraseña (restablécela desde Usuarios → 🔑).

## Audit log (`#/admin → Audit log`)
Toda escritura deja rastro (usuario, acción, entidad, detalle). Filtra por prefijo (`page.`, `user.`, `cell.`, `version.`, `backup.`).

## Imágenes
Se re-codifican a WebP (≤1600 px) con miniatura; SVG se rasteriza. Servidas solo a usuarios con acceso a la card. Las no usadas se purgan a las 24 h.
