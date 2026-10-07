-- F1: núcleo. Documentación del modelo = este SQL + /schema (no duplicar en prosa).
CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'org' CHECK (visibility IN ('org','cells')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  deleted_at TEXT,
  cover_image_id TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',   -- {snap, grid, minimap}
  camera_json TEXT NOT NULL DEFAULT '{}',     -- {x, y, z}
  version INTEGER NOT NULL DEFAULT 0,         -- optimista: If-Match / ETag
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX pages_org ON pages(org_id, status);
CREATE TABLE tags (
  id TEXT NOT NULL,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'gray',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, id)
);
CREATE TABLE branch_types (
  id TEXT NOT NULL,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'gray',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, id)
);
CREATE TABLE nodes (
  id TEXT NOT NULL,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('software','ds','uikit')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  docs_json TEXT NOT NULL DEFAULT '[]',
  image_id TEXT,                              -- F5: images.id
  image_legacy TEXT,                          -- dataURL heredado; F5 lo migra a images y elimina la columna
  owner_user_id TEXT,
  owner_label TEXT NOT NULL DEFAULT '',       -- legado "@ana"
  parent_id TEXT,                             -- NULL = raíz
  branch_type_id TEXT,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  w REAL NOT NULL DEFAULT 0,
  h REAL NOT NULL DEFAULT 0,
  demo INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'inherit' CHECK (visibility IN ('org','cells','inherit')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','deprecated','archived')),
  position INTEGER NOT NULL DEFAULT 0,        -- orden del documento
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (page_id, id)
);
CREATE INDEX nodes_parent ON nodes(page_id, parent_id);
CREATE TABLE node_tags (
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, node_id, tag_id),
  FOREIGN KEY (page_id, node_id) REFERENCES nodes(page_id, id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, tag_id) REFERENCES tags(page_id, id) ON DELETE CASCADE
);
CREATE TABLE edges (
  id TEXT NOT NULL,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ds','source')),
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, id),
  UNIQUE (page_id, kind, from_node_id, to_node_id),
  FOREIGN KEY (page_id, from_node_id) REFERENCES nodes(page_id, id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, to_node_id) REFERENCES nodes(page_id, id) ON DELETE CASCADE
);
