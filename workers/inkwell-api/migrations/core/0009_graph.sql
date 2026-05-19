-- Knowledge graph tables for MDX wiki-link engine
CREATE TABLE IF NOT EXISTS graph_nodes (
  slug TEXT NOT NULL,
  tenant TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'page',
  tags TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'public',
  author TEXT,
  date TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, tenant)
);

CREATE TABLE IF NOT EXISTS graph_edges (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'wikilink',
  tenant TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, target, type, tenant)
);

CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges (target);
CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges (source);
CREATE INDEX IF NOT EXISTS idx_nodes_tenant ON graph_nodes (tenant);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON graph_nodes (type);
CREATE INDEX IF NOT EXISTS idx_nodes_visibility ON graph_nodes (visibility);
