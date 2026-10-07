# Handoff F6b — Respaldos + export/import org   [✅ completa]
Commit: (hash en el commit siguiente) · Tag: f6b (f6a → 19186da)
## Hecho
- `007_backups.sql` (`backups`: filename único, bytes, sha256, kind manual|scheduled, status). `lib/backup.js`: `createBackup` (`node:sqlite` `backup()` → copia consistente + `uploads/` + `MANIFEST.json` → `tar -czf`; registro + retención `BACKUP_KEEP`=10 solo programados), `listBackups`/`getBackup`/`deleteBackup`, cron mínimo (`cronMatches`, `scheduleBackups` cada 30 s; `BACKUP_CRON` vacío = off), lock `.server.lock` (onListen/onClose), `restoreBackup` (exige servidor parado; mueve lo actual a `restore-prev-<ts>/`).
- Rutas (`backups`, admin): `GET/POST /api/backups`, `GET /api/backups/:id/download` (stream gzip), `DELETE`. `GET /api/org/export?images=manifest|embed`, `POST /api/org/import` (valida `schema/org-export.schema.json`, ≤512 MB).
- `lib/org-export.js`: `exportOrg` (org, células+miembros, usuarios sin hash, páginas con documento+versiones+status, imágenes con base64 si embed), `importOrg` (ids conservados; usuarios por correo con contraseña aleatoria; páginas existentes se sustituyen; versiones reescritas; imágenes solo si traen `data`; idempotente). `PATCH /api/users/:id { password }` (admin) para activar usuarios importados.
- Scripts: `scripts/backup.js` (sin API), `scripts/restore.js <tar.gz>`. Cliente: pestaña Respaldos en `#/admin` (crear, descargar, borrar, exportar org JSON, importar org).
- Tests: `backup.test.js` (cron; tar válido con db+uploads+manifest; API lista/descarga/borra; retención; restore en carpeta vacía y por CLI; lock; export embed/manifest; import en instancia limpia reproduce páginas/versiones/células/usuarios/imágenes; 400 schema; idempotencia). Smoke +1.
## Verificado
- `npm test` → 25/25 · `npm run lint` → OK · `node scripts/smoke.js` → 25/25, consola limpia · `npm run backup` → archivo en `data/backups` · `npm run migrate` → 007 aplicada.
## Procedimiento de restore
1. Parar el servidor (`.server.lock` debe desaparecer; si quedó huérfano y el pid no vive, el script lo ignora).
2. `node scripts/restore.js data/backups/destree-<ts>.tar.gz` (usa `DATABASE_PATH`/`UPLOADS_DIR` del `.env`). Lo anterior queda en `data/restore-prev-<ts>/`.
3. Arrancar; comprobar lobby e imágenes; borrar `restore-prev-*`.
- Alternativa lógica: `#/admin → Respaldos → Exportar organización` (JSON con imágenes) e `Importar organización` en la instancia nueva (tras `/api/setup`); fijar contraseñas con `PATCH /api/users/:id`.
## Pendiente / deuda
- Respaldos programados viven en el proceso (sin cron del SO); con varias instancias se duplicarían. Sin cifrado ni subida remota (S3) — fuera de alcance.
- Import org no borra páginas/células ausentes en el export (aditivo). Contraseñas no viajan (por diseño); sin correo de "fija tu contraseña" hasta F9b.
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (F6b): `tar` del sistema; cron propio de 5 campos; retención solo de programados; lock por pid; import aditivo por ids/correo.
## Archivos clave
- `server/lib/backup.js`, `server/lib/org-export.js`, `server/routes/backups.js`, `schema/org-export.schema.json`, `scripts/restore.js`, `tests/backup.test.js`.
## Contexto para F7
- Docker: base `node:22-bookworm-slim` (sharp precompilado; `tar` presente). Volumen `/data` (`DATABASE_PATH=/data/destree.db` → uploads/backups/deleted junto a la BD). `HOST=0.0.0.0` en contenedor. Healthcheck `GET /api/health`.
- Falta: `README.md` real, `docs/FIGMA.md` (tabla §4), `nodes.image_legacy` → eliminar con `008` (DROP COLUMN), versión `package.json` 0.1.0, tag `v0.1.0`.
