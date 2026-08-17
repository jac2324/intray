'use strict';

const express = require('express');
const { getFullState, mapWaiting } = require('../state');

module.exports = function waitingRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM waiting_items ORDER BY created_at ASC').all();
    res.json(rows.map(mapWaiting));
  });

  router.post('/', (req, res) => {
    const { text, who } = req.body || {};
    const trimmedText = (text || '').trim();
    const trimmedWho = (who || '').trim();
    if (!trimmedText || !trimmedWho) return res.status(400).json({ error: 'text and who are required' });
    db.prepare('INSERT INTO waiting_items (text, who, created_at) VALUES (?, ?, ?)').run(
      trimmedText,
      trimmedWho,
      Date.now()
    );
    res.status(201).json({ state: getFullState(db) });
  });

  // "Heard back" — converts a waiting item into a Next Action.
  router.post('/:id/convert', (req, res) => {
    const id = Number(req.params.id);
    const item = db.prepare('SELECT * FROM waiting_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'waiting item not found' });

    const { text, context, projectId } = req.body || {};
    const trimmed = (text || item.text || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'text is required' });

    const run = db.transaction(() => {
      db.prepare('DELETE FROM waiting_items WHERE id = ?').run(id);
      db.prepare(
        'INSERT INTO actions (text, context, project_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(trimmed, context || null, projectId || null, 'next', Date.now());
    });
    run();

    res.json({ state: getFullState(db) });
  });

  // Resolve/done — removes it outright (the thing being waited on is settled).
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM waiting_items WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  return router;
};
