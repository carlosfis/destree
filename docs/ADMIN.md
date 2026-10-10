# Administración

## Checklist operativa (quien cuida el servidor)
| Cuándo | Qué | Cómo |
|---|---|---|
| Diario (automático) | Respaldo programado | `BACKUP_CRON="30 3 * * *"` y `BACKUP_KEEP=10` en `.env`; comprueba en `#/admin → Respaldos` que aparecen con estado `ok`. |
| Semanal | Copia fuera del host | Sincroniza `data/backups/` a S3/Drive/NAS (rclone, cron). Un respaldo que solo vive en el servidor no es un respaldo. |
| Semanal | Salud | `curl -s https://tu.dominio/api/health` → `ok:true`, `db:"ok"`. Ideal: Uptime Kuma / Better Uptime con aviso. |
| Al publicar una versión | Actualizar | 1) respaldo manual (`#/admin → Respaldos → Crear` o `npm run backup`); 2) `docker compose pull && docker compose up -d` (sin Docker: `git pull && npm ci && npm start`); 3) revisa `CHANGELOG.md`; las migraciones se aplican solas. |
| Una vez al trimestre | Simulacro de restauración | En una máquina limpia: `docker compose run --rm destree node scripts/restore.js /data/backups/<archivo>` con el servicio parado (o `node scripts/restore.js <archivo>`), arranca y entra. Lo anterior queda en `data/restore-prev-<fecha>/`. |
| Cuando entra alguien | Invitar | `⌂ → Organización → Invitar` (Admin/Ops) o `#/admin → Usuarios` (Head/Lead): rol por debajo del propio + células. Si hay SMTP configurado el correo sale solo; si no, copia el enlace (7 días). |
| Cuando alguien se va | Desactivar | `⌂ → Organización → Desactivar` (cierra sus sesiones; no borra nada). Reasigna sus cards desde el lienzo si hace falta. |
| Contraseña olvidada | Restablecer | 🔑 en su fila de `⌂ → Organización` (temporal, mostrada una vez) o «¿Olvidaste tu contraseña?» en el login si hay correo. |
| Ante una duda | Auditar | `#/admin → Audit log`, filtra por `user.`, `page.`, `cell.`, `version.`, `backup.`. |
| Al exponer a Internet | Seguridad | TLS (`--profile https` o tu proxy) + `TRUST_PROXY=1`; `curl -I` para ver las cabeceras; lee `docs/SECURITY.md`. |

## Primer arranque
`/` muestra el asistente: nombre de la organización + correo/contraseña del primer admin. Solo ocurre una vez (`GET /api/setup` → `needed:false` después).

## Datos demo (opcional)
Para probar DesTree con contenido realista antes de cargar el tuyo. Todo es ficticio (Grupo Ambar, personas inventadas, dominios `grupo.demo`) y se borra como cualquier página.
```
node scripts/seed-demo.js --password=<contraseña>                          # sin Docker; el servidor puede estar corriendo
docker compose exec destree node scripts/seed-demo.js --password=<contraseña>
```
- Requiere haber completado el asistente (existe un Admin). Sin `--password` (o `SEED_PASSWORD`) genera una contraseña aleatoria por cuenta y la imprime una sola vez.
- Idempotente: cuentas y células existentes se conservan y las páginas no se duplican. `--reset` borra y recrea las dos páginas demo (las cuentas se mantienen).
- Si la instalación ya tiene datos propios, antes `npm run backup`.

Crea cuatro células (Retail Digital, Banca Digital, Cobranza, Ingeniería de Plataforma), siete cuentas y dos páginas. Entra con cada cuenta para ver qué cambia por nivel:
| Rol | Cuenta | Qué ve y qué puede hacer |
|---|---|---|
| Ops | `ximena.prado@grupo.demo` | Todo: plantilla, respaldos, audit log, crear y borrar páginas. Miembro de las cuatro células. |
| Head | `emilio.cordero@grupo.demo` | Todas las páginas y raíces; visibilidad y versiones. Responsable de Ambar.mx, App Ambar, Ambar DS y Cobalto DS. |
| Lead | `renata.villasenor@grupo.demo` | Lead de Retail Digital y Cobranza. «Ecosistema Ambar» salvo Backoffice Crédito; en «Plataforma Tecnológica» solo Portal de Desarrolladores (asignada). |
| Lead | `ivan.robles@grupo.demo` | Lead de Ingeniería de Plataforma. «Plataforma Tecnológica» completa y, en Ambar, Backoffice Crédito (responsable). |
| Lead | `camila.ibarra@grupo.demo` | Lead de Banca Digital. Responsable de Banco Cobalto App y Remesas; ve App Campo y Backoffice Crédito por su célula. |
| Viewer | `mateo.arriaga@grupo.demo` | Solo lectura (Cobranza). Asignado a «Asignación de investigaciones»: edita esa card con el editor acotado y toda su página de proyecto. |
| Viewer | `gael.montes@grupo.demo` | Solo lectura (Plataforma). Responsable de Aurora DS y Aurora Web Kit, asignado en Pagos Core y Portal de Desarrolladores: edita esas cards y sus proyectos. |

- **Ecosistema Ambar** (toda la organización): 11 Main instances, 44 cards y 40 conexiones (DS propios, DS de otro software y UI Kits derivados). Páginas de proyecto completas en Asignación de investigaciones, Ambar.mx, Ambar DS y Banco Cobalto App.
- **Plataforma Tecnológica** (solo la célula Ingeniería de Plataforma; vocabulario Servicio · Librería core · SDK): 10 servicios, 39 cards y 46 conexiones. Proyectos en Pagos Core e Identidad (SSO).

Para retirar los datos demo: borrar las dos páginas desde el Lobby (Ops o Admin) y desactivar o borrar las cuentas en Organización; o restaurar el respaldo previo.

## Organización (`⌂ → Organización`, Admin y Ops)
- **Datos**: nombre de la organización (solo Admin).
- **Niveles y roles**: cinco niveles fijos (Admin 5 · Ops 4 · Head 3 · Lead 2 · Viewer 1); cada nivel incluye todo lo del inferior. El código no cambia; el nombre visible sí (Admin lo edita; Admin queda fijo). La tabla **Capacidades por rol** muestra qué puede hacer cada nivel (misma matriz que aplica el servidor).
- **Plantilla**: cada persona con rol, células y cards asignadas (enlace a cada card), 🔑 restablecer contraseña y activar/desactivar. Solo se gestionan cuentas del propio nivel o inferior y solo se dan roles asignables (por debajo del propio; Admin y Ops también su nivel; solo un Admin da Admin). Nadie cambia su propio rol.
- **Zona de peligro** (solo Admin): **Eliminar organización** borra páginas, versiones, células, usuarios, invitaciones, imágenes y audit log y vuelve al asistente inicial; pide el nombre exacto y la contraseña. Los respaldos en disco se conservan.

## Invitar y gestionar usuarios (`⌂ → Organización` o `#/admin → Usuarios`)
- Invitar genera un **enlace** (7 días). Con SMTP configurado (`SMTP_URL`, `MAIL_FROM`) el correo sale solo y la invitación aparece como «enviada»; sin SMTP, o si el envío falla, copias el enlace y lo compartes tú («pendiente»). El invitado crea su contraseña y entra con el rol y las células de la invitación. «Probar envío» (admin) manda un correo de prueba a tu propia dirección.
- Admin y Ops: cambian rol, desactivan/activan (desactivar cierra sesiones) y restablecen contraseñas. Head invita Lead o Viewer; Lead solo invita Viewers a sus células y solo ve/revoca sus propias invitaciones.
- Contraseña olvidada: con SMTP, la persona usa «¿Olvidaste tu contraseña?» en el login (enlace de un solo uso, 1 h, cierra sus sesiones). Sin SMTP, un admin pulsa 🔑 **Restablecer contraseña** en la fila del usuario: se genera una temporal, se muestra **una sola vez** para copiarla y se cierran las sesiones de esa persona; pásala por un canal seguro. La persona la cambia después desde su chip de usuario (**Mi cuenta**).
- Cada usuario cambia su propia contraseña y su nombre desde el chip de usuario (arriba a la derecha → **Mi cuenta**); cambiarla cierra sus demás sesiones.

## Células (`#/admin → Células`)
Equipos. Nivel ≥3 (Head, Ops, Admin) crea/renombra/colorea/elimina y fija un lead; un Lead gestiona los miembros de sus células (si es lead o miembro). Una raíz o página "solo células" la ven los miembros de esas células, además de asignados/responsables.

## Páginas
- Lobby (`⌂` o `#/lobby`): crear, renombrar, duplicar, archivar (reversible), borrar (suave) y restaurar: todo de nivel ≥4 (Ops, Admin). Head cambia la visibilidad y las células de una página; Lead y Viewer solo ven las páginas de sus células o donde están asignados.
- Ajustes de página (`⚙ Página`): nombre, descripción, visibilidad + células, etiquetas, tipos de ramificación, datos (export/import JSON), ajustes del lienzo.
- `#/admin → Páginas borradas`: restaurar.

## Versiones (`⟲ Historial`)
Automáticas al guardar (fusionadas por usuario en 5 min; se conservan las últimas `VERSIONS_KEEP`), manuales con etiqueta, diff contra la actual, restaurar (crea una versión de restauración, nada se pierde). Archivar/borrar crean un snapshot.

## Respaldos (`#/admin → Respaldos`)
Crear/descargar/borrar tar.gz (BD + imágenes). Programación con `BACKUP_CRON`. Exportar (Ops/Admin) e importar (solo Admin) la organización completa (JSON con imágenes): el import es aditivo y conserva ids; los usuarios importados no traen contraseña (restablécela desde Usuarios → 🔑).

## Audit log (`#/admin → Audit log`)
Toda escritura deja rastro (usuario, acción, entidad, detalle). Filtra por prefijo (`page.`, `user.`, `cell.`, `version.`, `backup.`).

## Imágenes
Se re-codifican a WebP (≤1600 px) con miniatura; SVG se rasteriza. Servidas solo a usuarios con acceso a la card. Las no usadas se purgan a las 24 h.
