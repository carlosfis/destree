-- F6a: versiones por página (snapshot page-document v3 gzip). Retención: VERSIONS_KEEP auto; manual/restore/import/archive/delete ilimitadas.
CREATE TABLE page_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL CHECK (reason IN ('auto','manual','restore','import','archive','delete')),
  snapshot_gz BLOB NOT NULL,
  hash TEXT NOT NULL,                         -- sha256 del JSON sin comprimir
  size INTEGER NOT NULL,                      -- bytes del JSON sin comprimir
  image_ids_json TEXT NOT NULL DEFAULT '[]',  -- imágenes referenciadas (purgeOrphans las respeta)
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (page_id, number)
);
CREATE INDEX page_versions_page ON page_versions(page_id, created_at);
