-- Project-scoped authored pages and graph identity.
-- Identical slugs stay distinct across projects. Withdrawing a page keeps the row.

CREATE TABLE IF NOT EXISTS authored_pages (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  author_principal TEXT NOT NULL,
  projection_status TEXT NOT NULL DEFAULT 'pending',
  projection_error TEXT,
  accepted_revision INTEGER,
  receipt_id TEXT,
  withdrawn INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, project_id, slug)
);

CREATE TABLE IF NOT EXISTS authored_page_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_revocations (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, project_id, principal_id)
);

CREATE TABLE IF NOT EXISTS graph_nodes_project (
  slug TEXT NOT NULL,
  tenant TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'page',
  tags TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'public',
  author TEXT,
  date TEXT,
  url TEXT,
  withdrawn INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, tenant, project)
);

INSERT INTO graph_nodes_project (slug, tenant, project, title, type, tags, visibility, author, date, url, created_at, updated_at, withdrawn)
SELECT slug, tenant, '', title, type, tags, visibility, author, date, url, created_at, updated_at, 0
FROM graph_nodes;

DROP TABLE graph_nodes;
ALTER TABLE graph_nodes_project RENAME TO graph_nodes;

CREATE INDEX IF NOT EXISTS idx_nodes_tenant ON graph_nodes (tenant);
CREATE INDEX IF NOT EXISTS idx_nodes_project ON graph_nodes (tenant, project);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON graph_nodes (type);
CREATE INDEX IF NOT EXISTS idx_nodes_visibility ON graph_nodes (visibility);

CREATE TABLE IF NOT EXISTS graph_edges_project (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'wikilink',
  tenant TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, target, type, tenant, project)
);

INSERT INTO graph_edges_project (source, target, type, tenant, project, weight, created_at)
SELECT source, target, type, tenant, '', weight, created_at FROM graph_edges;

DROP TABLE graph_edges;
ALTER TABLE graph_edges_project RENAME TO graph_edges;

CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges (target);
CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges (source);
CREATE INDEX IF NOT EXISTS idx_edges_project ON graph_edges (tenant, project);
