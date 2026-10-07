-- F3: células, miembros, visibilidad de raíces por célula, asignados. Documentación = este SQL + schema/node.schema.json.
CREATE TABLE cells (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  description TEXT NOT NULL DEFAULT '',
  lead_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX cells_org ON cells(org_id);
CREATE TABLE cell_members (
  cell_id TEXT NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (cell_id, user_id)
);
CREATE INDEX cell_members_user ON cell_members(user_id);
-- Páginas solo-células (regla 2 de visibilidad; gestión en F4b)
CREATE TABLE page_cells (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  cell_id TEXT NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, cell_id)
);
-- Solo raíces con visibility='cells'. Se reescribe con cada PUT del documento (nodes se borra y reinserta).
CREATE TABLE node_cells (
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  cell_id TEXT NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, node_id, cell_id),
  FOREIGN KEY (page_id, node_id) REFERENCES nodes(page_id, id) ON DELETE CASCADE
);
CREATE TABLE node_assignees (
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, node_id, user_id),
  FOREIGN KEY (page_id, node_id) REFERENCES nodes(page_id, id) ON DELETE CASCADE
);
CREATE INDEX node_assignees_user ON node_assignees(user_id);
