'use strict';

const express = require('express');
const { getFullState, mapAction } = require('../state');

module.exports = function actionsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM actions ORDER BY created_at ASC').all();
    res.json(rows.map(mapAction));
  });

  // Quick-add: create a Next Action directly, bypassing the inbox.
  router.post('/', (req, res) => {
    const { text, context, projectId } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'text is required' });
    db.prepare(
      'INSERT INTO actions (text, context, project_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(trimmed, context || null, projectId || null, 'next', Date.now());
    res.status(201).json({ state: getFullState(db) });
  });

  // Covers: complete (status -> done), undo (status -> next), and editing
  // text/context/project.
  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'action not found' });

    const { status, text, context, projectId } = req.body || {};
    const next = {
      text: text !== undefined ? text : existing.text,
      context: context !== undefined ? context : existing.context,
      project_id: projectId !== undefined ? projectId : existing.project_id,
      status: status !== undefined ? status : existing.status,
      completed_at: existing.completed_at,
    };
    if (status === 'done' && existing.status !== 'done') next.completed_at = Date.now();
    if (status === 'next' && existing.status === 'done') next.completed_at = null;

    db.prepare(
      'UPDATE actions SET text = ?, context = ?, project_id = ?, status = ?, completed_at = ? WHERE id = ?'
    ).run(next.text, next.context, next.project_id, next.status, next.completed_at, id);

    res.json({ state: getFullState(db) });
  });

  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM actions WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  return router;
};
