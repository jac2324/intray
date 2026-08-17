'use strict';

const express = require('express');
const { getFullState, mapProject } = require('../state');

module.exports = function projectsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all();
    res.json(rows.map(mapProject));
  });

  router.post('/', (req, res) => {
    const { name, outcome } = req.body || {};
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'name is required' });
    db.prepare(
      'INSERT INTO projects (name, outcome, status, created_at) VALUES (?, ?, ?, ?)'
    ).run(trimmed, (outcome || '').trim(), 'active', Date.now());
    res.status(201).json({ state: getFullState(db) });
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'project not found' });
    const { name, outcome } = req.body || {};
    db.prepare('UPDATE projects SET name = ?, outcome = ? WHERE id = ?').run(
      name !== undefined ? name : existing.name,
      outcome !== undefined ? outcome : existing.outcome,
      id
    );
    res.json({ state: getFullState(db) });
  });

  router.post('/:id/complete', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'project not found' });
    db.prepare("UPDATE projects SET status = 'completed', completed_at = ? WHERE id = ?").run(Date.now(), id);
    res.json({ state: getFullState(db) });
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  return router;
};
