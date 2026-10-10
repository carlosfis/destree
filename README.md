# DesTree

🇬🇧 [English version](README.en.md)

Fuente única de verdad para agencias y equipos de producto: un lienzo con el **árbol de software** (aplicaciones → features → variantes), sus **Design Systems y UI Kits**, responsables, equipos (células), documentación, páginas de proyecto y versiones. Autoalojado, multi-página, con cinco niveles de rol (Admin · Ops · Head · Lead · Viewer). Interfaz en español e inglés (selector ES/EN).

- **Lienzo**: contenedores anidados (ramificaciones), DS y UI Kits dentro de cada software, conexiones «usa DS» y «deriva de», etiquetas, color de marca por Main instance, auto-layout, minimapa, undo/redo.
- **Página de proyecto por card**: Overview con secciones editables (ficha, resumen con métricas, antecedentes, usuarios, problemática, objetivos, entregables, equipo), Cronograma por fases y semanas, y tablero Kanban de actividades (To Do · Doing · Done · Cancelled).
- **Equipo**: células con miembros; raíces y páginas visibles para toda la organización o solo para ciertas células; responsable y asignados por card; los Viewers ven lo suyo y editan solo sus cards.
- **Organización**: cinco niveles fijos con nombres visibles configurables, plantilla con roles y asignaciones, tabla de capacidades, invitaciones por enlace o por correo (SMTP opcional), restablecer contraseña, audit log.
- **Documentación**: enlaces (Figma, Notion, repos…) y notas en markdown por card; imágenes seguras (WebP + miniatura); thumbnail PNG 1920×1080 de cada Main instance para usar como portada en Figma.
- **Historial**: versiones automáticas y manuales por página, diff y restauración; respaldos tar.gz programables; export/import de la organización; datos demo con un comando.
- **Idioma**: interfaz en español o inglés por navegador (botón ES/EN en la barra y en el acceso; por defecto, el idioma del navegador); los mensajes del servidor y los correos siguen el idioma elegido.
- **Sin dependencias pesadas**: Node 22 + Fastify 5 + SQLite (`node:sqlite`), cliente vanilla ESM sin bundler. Única dependencia nativa: `sharp`.

> Sin integración con Figma (API, métricas, webhooks): la app es completa sin ello. Los enlaces a archivos de Figma se añaden a mano en Documentación y el thumbnail se copia y se pega.

## Un vistazo
Capturas sobre los datos demo (organización ficticia «Grupo Ambar»); la versión en inglés del README muestra la interfaz en inglés.
| Lienzo | Página de proyecto | Sidebar de instancia |
|---|---|---|
| ![Lienzo con el árbol de software, Design Systems y UI Kits](docs/img/canvas.png) | ![Overview de la página de proyecto de una Main instance](docs/img/project.png) | ![Sidebar de una Main instance: tipo, nombre, color de marca, etiquetas y relaciones](docs/img/drawer.png) |

| Cronograma | Organización | Lobby de páginas |
|---|---|---|
| ![Cronograma por fases y semanas con actividades](docs/img/schedule.png) | ![Lobby → Organización: niveles, capacidades y plantilla](docs/img/org.png) | ![Lobby con varias páginas](docs/img/lobby.png) |

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

## Probar con datos demo
```
node scripts/seed-demo.js --password=<contraseña>
# Docker: docker compose exec destree node scripts/seed-demo.js --password=<contraseña>
```
Tras completar el asistente, carga una organización ficticia: siete cuentas (una por nivel y varias Lead/Viewer), cuatro células y dos páginas completas con conexiones y páginas de proyecto. Entra con cada cuenta para ver qué cambia por nivel; las cuentas y lo que ve cada una están en `docs/ADMIN.md` → «Datos demo». Todo se borra como cualquier página.

## Actualizar
Docker: `docker compose pull && docker compose up -d` (o `--build` si clonaste). Sin Docker: `git pull && npm ci && npm start`. Las migraciones se aplican solas al arrancar; haz un respaldo antes (`npm run backup` o `#/admin → Respaldos`).

## Respaldo y restauración
- Manual: `#/admin → Respaldos → Crear` (descargable) o `npm run backup`. Programado: `BACKUP_CRON="30 3 * * *"` en `.env` (`BACKUP_KEEP` conserva los últimos N).
- Restaurar: con el servidor parado, `node scripts/restore.js data/backups/destree-<fecha>.tar.gz` (en Docker: `docker compose run --rm destree node scripts/restore.js /data/backups/<archivo>` con el servicio detenido). Lo anterior queda en `data/restore-prev-<fecha>/`.
- Alternativa lógica: exportar/importar la organización en JSON desde `#/admin → Respaldos`.

## Roles
Cinco niveles fijos; cada nivel incluye todo lo del inferior. El nombre visible de cada rol (salvo Admin) se cambia en `⌂ → Organización`, donde también está la tabla completa de capacidades.
| | Lev5 Admin | Lev4 Ops | Lev3 Head | Lev2 Lead | Lev1 Viewer |
|---|---|---|---|---|---|
| Modificar / eliminar la organización, importar una organización | ✓ | — | — | — | — |
| Crear, renombrar, archivar, borrar e importar páginas | ✓ | ✓ | — | — | — |
| Plantilla (roles, desactivar, contraseñas), respaldos, audit log | ✓ | ✓ | — | — | — |
| Ver todas las páginas; visibilidad de páginas y raíces; crear células; restaurar versiones | ✓ | ✓ | ✓ | — | — |
| Editar el interior de las páginas visibles, asignar, invitar roles inferiores | ✓ | ✓ | ✓ | ✓ (sus páginas) | — |
| Ver páginas de sus células o asignadas; editar las cards propias y su página de proyecto (responsable o asignado) | ✓ | ✓ | ✓ | ✓ | ✓ |

## Documentación
`docs/INSTALL.md` (instalación y variables) · `docs/ADMIN.md` (administración y datos demo) · `docs/USER.md` (lienzo y página de proyecto) · `docs/API.md` · `docs/SECURITY.md` (modelo de amenazas y cabeceras) · `docs/MAP.md` (mapa del código) · `docs/DECISIONS.md` · `CONTRIBUTING.md` · `CODE_OF_CONDUCT.md` · `SECURITY.md` (reportar vulnerabilidades) · `CHANGELOG.md`.

## Roadmap
Sin publicar: interfaz en inglés (selector ES/EN). v1.1.0 incluye: página de proyecto por card (Overview · Cronograma · Kanban) · color de marca en Main instances · cinco niveles de rol y pestaña Organización · thumbnail para Figma · datos demo. v1.0.0 trajo contraseñas, correo SMTP, hardening (CSP estricta), README en inglés y capturas. Fuera de alcance: integración con Figma, SSO/OAuth.

## Licencia
MIT — ver `LICENSE`.
