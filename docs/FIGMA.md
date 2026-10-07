# Figma

**Estado: no implementado.** DesTree funciona completo sin Figma (decisión del MVP, ver `PLAN.md` §5 F8a). Esta tabla documenta lo que la REST API permite y cómo se abordaría, para no inventar capacidades.

| Capacidad | REST API | Soportado en DesTree | Workaround previsto |
|---|---|---|---|
| Crear archivo | ✗ (no hay POST /files) | — | Deep-link a `figma.com/new` o plantilla de org; el usuario pega la URL |
| Crear/eliminar proyecto | ✗ | — | Deep-link al equipo + instrucción |
| Eliminar archivo | ✗ | — | "Archivar" interno + deep-link |
| Invitar editores | ✗ (sin API de sharing) | — | Correo propio con instrucciones (SMTP, F9b) |
| Thumbnail + metadata | ✓ `GET /v1/files/:key/meta` | — | Descargar thumbnail a `images` (kind `figma-thumb`) |
| Componentes (locales/publicados) | ✓ `GET /v1/files/:key?depth=1`, `/components` | — | Conteo bajo demanda; publicados como métrica |
| Variables | Enterprise + Full seat | — | Plugin Companion (`figma-plugin/`) |
| Webhooks v2 | ✓ Professional+ | — | Por team/proyecto/archivo según plan |
| Auth | PAT (`X-Figma-Token`) | — | Cifrado AES-256-GCM con `SERVER_SECRET` |

Fuentes: documentación oficial de la REST API y Plugin API de Figma (2025).
