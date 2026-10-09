-- P10: cinco niveles de rol (admin 5 · ops 4 · head 3 · lead 2 · viewer 1); 'designer' pasa a 'viewer'.
-- SQLite no altera un CHECK: se reconstruyen memberships e invites (nada las referencia por FK). Las etiquetas visibles viven en orgs.settings_json.roleLabels.
CREATE TABLE memberships_new (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','ops','head','lead','viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, org_id)
);
INSERT INTO memberships_new (user_id, org_id, role, created_at)
  SELECT user_id, org_id, CASE role WHEN 'designer' THEN 'viewer' ELSE role END, created_at FROM memberships;
DROP TABLE memberships;
ALTER TABLE memberships_new RENAME TO memberships;
CREATE INDEX memberships_org ON memberships(org_id, role);

CREATE TABLE invites_new (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','ops','head','lead','viewer')),
  cell_ids_json TEXT NOT NULL DEFAULT '[]',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  email_sent_at TEXT
);
INSERT INTO invites_new (id, org_id, email, role, cell_ids_json, token_hash, invited_by, expires_at, used_at, created_at, email_sent_at)
  SELECT id, org_id, email, CASE role WHEN 'designer' THEN 'viewer' ELSE role END, cell_ids_json, token_hash, invited_by, expires_at, used_at, created_at, email_sent_at FROM invites;
DROP TABLE invites;
ALTER TABLE invites_new RENAME TO invites;
CREATE INDEX invites_org ON invites(org_id, used_at);
