-- Intray database schema.
-- Applied once at startup (CREATE TABLE IF NOT EXISTS, so it's safe to run
-- on every boot). All timestamps are milliseconds since epoch (INTEGER).

CREATE TABLE IF NOT EXISTS contexts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  outcome      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'active', -- active | completed
  created_at   INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  text         TEXT NOT NULL,
  context      TEXT,
  project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'next', -- next | done
  created_at   INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS waiting_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  who        TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS someday_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Single-row table holding weekly review state.
CREATE TABLE IF NOT EXISTS review_state (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  last_review INTEGER,
  checks      TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO review_state (id, last_review, checks) VALUES (1, NULL, '{}');
