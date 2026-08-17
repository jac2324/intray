'use strict';

const express = require('express');
const { getFullState } = require('../state');

module.exports = function contextsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT name FROM contexts ORDER BY sort_order ASC').all();
    res.json(rows.map((r) => r.name));
  });

  // Contexts are user-extensible everywhere a context picker appears.
  // Adding one that already exists is a no-op (idempotent upsert).
  router.post('/', (req, res) => {
    const name = (req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM contexts').get();
    const nextOrder = (maxOrder && maxOrder.m !== null ? maxOrder.m : -1) + 1;
    db.prepare('INSERT OR IGNORE INTO contexts (name, sort_order) VALUES (?, ?)').run(name, nextOrder);
    res.status(201).json({ state: getFullState(db) });
  });

  router.delete('/:name', (req, res) => {
    db.prepare('DELETE FROM contexts WHERE name = ?').run(req.params.name);
    res.json({ state: getFullState(db) });
  });

  return router;
};
