-- F5: imágenes en disco (/data/uploads/<org>/<id>.webp + <id>.thumb.webp). nodes.image_id y pages.cover_image_id existen desde 001.
-- nodes.image_legacy (dataURL) se vacía en JS al arrancar (lib/images.js#migrateLegacyImages); la columna se elimina en una migración posterior.
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'node' CHECK (kind IN ('node','page','figma-thumb')),
  filename TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'image/webp',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,                       -- del archivo original subido (dedupe por org)
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX images_org_sha ON images(org_id, sha256);
CREATE INDEX nodes_image ON nodes(image_id);
