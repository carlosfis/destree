-- F4a: páginas: trazabilidad de archivado/borrado. visibility, status, deleted_at, cover_image_id, camera_json existen desde 001; page_cells desde 003.
ALTER TABLE pages ADD COLUMN archived_at TEXT;
ALTER TABLE pages ADD COLUMN deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL;
