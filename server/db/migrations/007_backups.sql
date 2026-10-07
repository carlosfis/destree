-- F6b: respaldos (tar.gz con destree.db + uploads/) en data/backups. org_id NULL = global.
CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  filename TEXT NOT NULL UNIQUE,
  bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','scheduled')),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('pending','ok','error')),
  error TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX backups_time ON backups(created_at);
