'use strict';

const express = require('express');
const { getFullState, mapSomeday } = require('../state');

module.exports = function somedayRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM someday_items ORDER BY created_at ASC').all();
    res.json(rows.map(mapSomeday));
  });

  router.post('/', (req, res) => {
    const text = (req.body && req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });
    db.prepare('INSERT INTO someday_items (text, created_at) VALUES (?, ?)').run(text, Date.now());
    res.status(201).json({ state: getFullState(db) });
  });

  // "Activate" — promotes a someday/maybe idea into a new Project.
  router.post('/:id/activate', (req, res) => {
    const id = Number(req.params.id);
    const item = db.prepare('SELECT * FROM someday_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'someday item not found' });

    const outcome = ((req.body && req.body.outcome) || '').trim();

    const run = db.transaction(() => {
      db.prepare('DELETE FROM someday_items WHERE id = ?').run(id);
      db.prepare(
        'INSERT INTO projects (name, outcome, status, created_at) VALUES (?, ?, ?, ?)'
      ).run(item.text, outcome, 'active', Date.now());
    });
    run();

    res.json({ state: getFullState(db) });
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM someday_items WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  return router;
};
