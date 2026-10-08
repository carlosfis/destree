# Política de seguridad

## Versiones con soporte
| Versión | Soporte |
|---|---|
| 1.x (rama `main`) | ✓ correcciones de seguridad |
| 0.1.x | solo hasta la publicación de 1.0.0 |

## Cómo reportar una vulnerabilidad
- **No abras un issue público.** Usa la pestaña *Security → Report a vulnerability* del repositorio en GitHub (aviso privado) o escribe al mantenedor por el correo de su perfil de GitHub.
- Incluye versión (`GET /api/health` → `version`), pasos para reproducir, impacto estimado y, si puedes, una prueba de concepto.
- Recibirás respuesta en un plazo de 7 días. Las correcciones se publican como release con nota en `CHANGELOG.md`; se te acreditará si lo deseas.

## Alcance
Código de este repositorio (servidor Fastify, cliente, scripts, imagen Docker). Quedan fuera los servicios de terceros que elijas para alojarlo.

## Modelo de amenazas y medidas aplicadas
Ver [`docs/SECURITY.md`](docs/SECURITY.md): roles y permisos en servidor, CSP estricta, cabeceras, rate-limit, sesiones, invitaciones, subida de imágenes y logs sin secretos.
