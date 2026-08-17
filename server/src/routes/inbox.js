'use strict';

const express = require('express');
const { getFullState, mapInbox } = require('../state');

module.exports = function inboxRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM inbox_items ORDER BY created_at ASC').all();
    res.json(rows.map(mapInbox));
  });

  router.post('/', (req, res) => {
    const text = (req.body && req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });
    const info = db
      .prepare('INSERT INTO inbox_items (text, created_at) VALUES (?, ?)')
      .run(text, Date.now());
    res.status(201).json({ item: mapInbox({ id: info.lastInsertRowid, text, created_at: Date.now() }), state: getFullState(db) });
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM inbox_items WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  // The clarify flow: given an inbox item and a resolution describing where
  // it should land, atomically remove it from the inbox and create whatever
  // downstream record the resolution implies.
  router.post('/:id/process', (req, res) => {
    const id = Number(req.params.id);
    const item = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'inbox item not found' });

    const resolution = (req.body && req.body.resolution) || {};
    const now = Date.now();

    const run = db.transaction(() => {
      db.prepare('DELETE FROM inbox_items WHERE id = ?').run(id);

      switch (resolution.type) {
        case 'trash':
        case 'done':
          // No further record needed — trashed, or done in under two minutes.
          break;

        case 'someday':
          db.prepare('INSERT INTO someday_items (text, created_at) VALUES (?, ?)').run(item.text, now);
          break;

        case 'waiting': {
          const who = (resolution.who || '').trim();
          if (!who) throw Object.assign(new Error('who is required for delegation'), { status: 400 });
          db.prepare('INSERT INTO waiting_items (text, who, created_at) VALUES (?, ?, ?)').run(item.text, who, now);
          break;
        }

        case 'action': {
          const text = (resolution.text || item.text || '').trim();
          if (!text) throw Object.assign(new Error('text is required'), { status: 400 });

          // Attaching to an existing action as a sub-step takes priority
          // over the project fields — project is always inherited from
          // the parent in that case, same rule as POST /api/actions.
          if (resolution.parentActionId) {
            const parent = db.prepare('SELECT * FROM actions WHERE id = ?').get(resolution.parentActionId);
            if (!parent) throw Object.assign(new Error('parent action not found'), { status: 404 });
            db.prepare(
              'INSERT INTO actions (text, context, project_id, status, created_at, parent_action_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(text, resolution.context || null, parent.project_id, 'next', now, parent.id);
            break;
          }

          let projectId = resolution.projectId || null;
          const newProjectName = (resolution.newProjectName || '').trim();
          if (newProjectName) {
            const info = db
              .prepare('INSERT INTO projects (name, outcome, status, created_at) VALUES (?, ?, ?, ?)')
              .run(newProjectName, '', 'active', now);
            projectId = info.lastInsertRowid;
          }
          db.prepare(
            'INSERT INTO actions (text, context, project_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
          ).run(text, resolution.context || null, projectId, 'next', now);
          break;
        }

        default:
          throw Object.assign(new Error('unknown resolution type'), { status: 400 });
      }
    });

    try {
      run();
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }

    res.json({ state: getFullState(db) });
  });

  return router;
};
