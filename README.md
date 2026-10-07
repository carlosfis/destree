# DesTree

Fuente única de verdad para agencias y equipos de producto: un lienzo con el **árbol de software** (aplicaciones → features → variantes), sus **Design Systems y UI Kits**, responsables, equipos (células), documentación y versiones. Autoalojado, multi-página, con roles admin / head / designer.

- **Lienzo**: contenedores anidados (ramificaciones), DS y UI Kits dentro de cada software, conexiones "usa DS" y "deriva de", etiquetas, auto-layout, minimapa, undo/redo.
- **Equipo**: células con miembros; raíces y páginas visibles para toda la organización o solo para ciertas células; asignados y responsable por card; los designers ven solo lo suyo, en modo lectura.
- **Documentación**: enlaces (Figma, Notion, repos…) y notas en markdown por card; imágenes seguras (WebP + miniatura).
- **Historial**: versiones automáticas y manuales por página, diff y restauración; respaldos tar.gz programables; export/import de la organización.
- **Sin dependencias pesadas**: Node 22 + Fastify 5 + SQLite (`node:sqlite`), cliente vanilla ESM sin bundler. Única dependencia nativa: `sharp`.

> Figma (métricas, thumbnails, webhooks) queda fuera del producto: la app es completa sin ello; los enlaces a archivos de Figma se añaden a mano en Documentación.

## Instalación rápida (Docker)
```
git clone https://github.com/carlosfis/destree.git && cd destree
cp .env.example .env            # ajusta PORT/DOMAIN si hace falta
docker compose up -d            # http://localhost:3000 → asistente de instalación (organización + admin)
```
`./data` guarda la base de datos, imágenes y respaldos. `docker compose down && docker compose up -d` conserva todo. HTTPS automático: `DOMAIN=tu.dominio` en `.env` y `docker compose --profile https up -d`.

## Sin Docker
```
npm ci && cp .env.example .env
npm run migrate      # crea data/destree.db
npm start            # http://localhost:3000
```
Requiere Node ≥ 22.13. Detrás de un proxy TLS: `TRUST_PROXY=1`.

## Actualizar
Docker: `docker compose pull && docker compose up -d` (o `--build` si clonaste). Sin Docker: `git pull && npm ci && npm start`. Las migraciones se aplican solas al arrancar; haz un respaldo antes (`npm run backup` o `#/admin → Respaldos`).

## Respaldo y restauración
- Manual: `#/admin → Respaldos → Crear` (descargable) o `npm run backup`. Programado: `BACKUP_CRON="30 3 * * *"` en `.env` (`BACKUP_KEEP` conserva los últimos N).
- Restaurar: con el servidor parado, `node scripts/restore.js data/backups/destree-<fecha>.tar.gz` (en Docker: `docker compose run --rm destree node scripts/restore.js /data/backups/<archivo>` con el servicio detenido). Lo anterior queda en `data/restore-prev-<fecha>/`.
- Alternativa lógica: exportar/importar la organización en JSON desde `#/admin → Respaldos`.

## Roles
| | admin | head | designer |
|---|---|---|---|
| Lienzo, documentación, páginas | editar | editar | solo lectura (lo visible) |
| Usuarios y roles | ✓ | — | — |
| Invitar | cualquier rol | designers a sus células | — |
| Células | crear/editar | miembros de las suyas | — |
| Visibilidad de raíces/páginas, asignados | ✓ | ✓ | — |
| Versiones | ver/crear/restaurar | ver/crear/restaurar | ver |
| Borrar/restaurar páginas, respaldos, audit log | ✓ | — | — |

## Documentación
`docs/INSTALL.md` (instalación y variables) · `docs/ADMIN.md` (administración) · `docs/USER.md` (uso del lienzo) · `docs/API.md` · `docs/MAP.md` (mapa del código) · `docs/DECISIONS.md` · `CONTRIBUTING.md` · `CHANGELOG.md` · `PENDIENTE.md` (roadmap detallado por fases).

## Roadmap
Orden previsto (detalle y estado en `PENDIENTE.md`): cambio de contraseña propio y restablecimiento desde Administración · correo SMTP para invitaciones y recuperación · cabeceras de seguridad y CSP · README en inglés, capturas y vídeo · v1.0.0. Fuera de alcance por ahora: integración con Figma, SSO/OAuth.

## Licencia
MIT — ver `LICENSE`.
