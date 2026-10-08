# Administración

## Primer arranque
`/` muestra el asistente: nombre de la organización + correo/contraseña del primer admin. Solo ocurre una vez (`GET /api/setup` → `needed:false` después).

## Invitar y gestionar usuarios (`#/admin → Usuarios`)
- Invitar genera un **enlace** (7 días) que copias y envías tú (no hay correo). El invitado crea su contraseña y entra con el rol y las células de la invitación.
- Admin: cambia rol, desactiva/activa (desactivar cierra sesiones). Head: solo invita designers a sus células.
- Contraseña olvidada: no hay recuperación por correo. Un admin pulsa 🔑 **Restablecer contraseña** en la fila del usuario: se genera una temporal, se muestra **una sola vez** para copiarla y se cierran las sesiones de esa persona; pásala por un canal seguro. La persona la cambia después desde su chip de usuario (**Mi cuenta**).
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
