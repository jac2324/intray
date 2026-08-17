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
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  text             TEXT NOT NULL,
  context          TEXT,
  project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'next', -- next | done
  created_at       INTEGER NOT NULL,
  completed_at     INTEGER,
  -- Self-referencing: a sub-action is just an action whose parent is
  -- another action. Arbitrary nesting depth falls out of this for free —
  -- no separate table needed. Deleting a parent deletes its whole subtree.
  parent_action_id INTEGER REFERENCES actions(id) ON DELETE CASCADE,
  notes            TEXT NOT NULL DEFAULT ''
);

-- NOTE: the idx_actions_parent index is created in db.js's migration step,
-- not here. On an existing database, CREATE TABLE IF NOT EXISTS above is a
-- no-op (the table already exists without parent_action_id), so an index
-- statement referencing that column here would fail immediately, before
-- the migration ever gets a chance to ALTER it in.

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
