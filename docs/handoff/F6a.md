# Handoff F6a — Versiones e historial   [✅ completa]
Commit: (hash en el commit siguiente) · Tag: f6a (f5 → 2be35ea)
## Hecho
- `006_versions.sql`: `page_versions` (snapshot gzip del page-document, hash sha256 del JSON canónico sin `version/updatedAt/createdBy`, `image_ids_json`, reason auto|manual|restore|import|archive|delete, UNIQUE(page, number)).
- `lib/versions.js`: `createVersion` (auto: omite si el hash no cambia; coalesce con la última auto del mismo usuario en `VERSIONS_COALESCE_MIN` = 5), `applyRetention` (`VERSIONS_KEEP` = 50 autos; manual/restore/import/archive/delete ilimitadas; páginas no activas intactas), `listVersions`, `getVersion` (filtrado por visibilidad), `diffDocuments`/`diffVersions` (nodos +/−/~ por campos sin posición, movidos, aristas, tags, tipos; `current`), `restoreVersion` (contenido, metadatos intactos, crea `restore`), `restoreLatestIfDiverged` (restore-deleted).
- Hooks: PUT → auto; import → import; archive → archive (antes del cambio de estado); DELETE → delete (sustituye el export JSON de F4a; `app.deletedDir` eliminado); restore-deleted repone la última versión si el contenido divergió (`restoredFromVersion`). `purgeOrphans` respeta imágenes referenciadas por versiones.
- Rutas `routes/versions.js`: `GET /api/pages/:id/versions`, `POST` (manual, label), `GET /:n`, `GET /:a/diff/:b` (`current`), `POST /:n/restore` (409 si la página no está activa). Designer: lee (filtrado), 403 en escritura.
- Cliente: `views/versions-panel.js` (botón ⟲ Historial en topbar para todos; lista con autor/fecha/tamaño, Ver = árbol solo lectura, Cambios = diff vs actual, Restaurar con confirmación → `destree:load-page`, versión manual con etiqueta). `api.js` +5.
- Tests: `versions.test.js` (3 ediciones → 3 autos; restaurar la 1ª reproduce nodos/aristas/posiciones exactos; diff; manual; retención keep=3; coalescencia; designer filtrado/403; archive/delete conservan; restore-deleted repone; diff unidad). `pages.test.js` adaptado (snapshot `delete`). Smoke +1.
## Verificado
- `npm test` → 23/23 · `npm run lint` → OK · `node scripts/smoke.js` → 24/24, consola limpia · `npm run migrate` → 006 aplicada.
## Pendiente / deuda
- Sin vista previa en canvas (solo árbol textual). Sin "comparar dos versiones cualesquiera" en UI (la API sí: `/:a/diff/:b`).
- Retención por número, no por antigüedad. Snapshots incluyen `imageId` (no la imagen); si la imagen se borra manualmente (409 en uso no cubre versiones… sí: `purgeOrphans` las respeta, `DELETE /api/images` solo mira nodos/páginas).
## Decisiones no visibles en código
- Ver `docs/DECISIONS.md` (F6a): hash sin campos volátiles; coalescencia por usuario; snapshot antes de archivar/borrar; restore conserva metadatos de página.
## Archivos clave
- `server/lib/versions.js`, `server/routes/versions.js`, `client/js/views/versions-panel.js`, `tests/versions.test.js`.
## Contexto para F6b
- `db.backup()` existe en `node:sqlite` (`DatabaseSync.prototype.backup` → `backup(db, path)` async en Node ≥23); uploads en `app.uploadsDir`; versiones en BD. `scripts/backup.js` es stub. `org-export.schema.json` por crear (`{ version:3, org, cells, users(sin hash), pages[{document, versions}], images(manifest) }`).
