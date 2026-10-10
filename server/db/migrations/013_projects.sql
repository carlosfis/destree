-- Página de proyecto por card (Overview · Cronograma · Actividades Kanban). Documentación del modelo = este SQL + schema/project.schema.json.
-- Sin FK a nodes: el PUT del documento borra y reinserta `nodes`; los datos de proyecto sobreviven y vuelven a verse si la card reaparece (undo, restaurar versión).
CREATE TABLE projects (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}', -- { tagline, sprintWeeks, sprintOffset }
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (page_id, node_id)
);
-- Overview: secciones ordenadas; `kind` decide la forma de `data_json` (lib/project-template.js).
CREATE TABLE project_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (page_id, node_id) REFERENCES projects(page_id, node_id) ON DELETE CASCADE
);
CREATE INDEX project_sections_node ON project_sections(page_id, node_id, position);
-- Cronograma: fases (filas) con color propio.
CREATE TABLE project_phases (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (page_id, node_id) REFERENCES projects(page_id, node_id) ON DELETE CASCADE
);
CREATE INDEX project_phases_node ON project_phases(page_id, node_id, position);
-- Actividades: con fase y fecha de inicio aparecen en el cronograma; todas aparecen en el kanban (status). Canceladas no se borran.
CREATE TABLE project_activities (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  phase_id TEXT REFERENCES project_phases(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',       -- siglas en el círculo (UX, UI, PD, CL…)
  assignee TEXT NOT NULL DEFAULT '',  -- @usuario (texto libre, como staff) o @Todos
  start_date TEXT,                    -- YYYY-MM-DD
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (page_id, node_id) REFERENCES projects(page_id, node_id) ON DELETE CASCADE
);
CREATE INDEX project_activities_node ON project_activities(page_id, node_id, position);
