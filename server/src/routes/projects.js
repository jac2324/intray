'use strict';

const express = require('express');
const { getFullState, mapProject } = require('../state');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeDueDate(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  if (typeof value === 'string' && DATE_RE.test(value)) return { ok: true, value };
  return { ok: false };
}

module.exports = function projectsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all();
    res.json(rows.map(mapProject));
  });

  router.post('/', (req, res) => {
    const { name, outcome, dueDate } = req.body || {};
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'name is required' });
    const due = normalizeDueDate(dueDate);
    if (!due.ok) return res.status(400).json({ error: 'dueDate must be YYYY-MM-DD or null' });
    db.prepare(
      'INSERT INTO projects (name, outcome, status, created_at, due_date) VALUES (?, ?, ?, ?, ?)'
    ).run(trimmed, (outcome || '').trim(), 'active', Date.now(), due.value || null);
    res.status(201).json({ state: getFullState(db) });
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'project not found' });
    const { name, outcome, dueDate } = req.body || {};
    const due = normalizeDueDate(dueDate);
    if (!due.ok) return res.status(400).json({ error: 'dueDate must be YYYY-MM-DD or null' });
    db.prepare('UPDATE projects SET name = ?, outcome = ?, due_date = ? WHERE id = ?').run(
      name !== undefined ? name : existing.name,
      outcome !== undefined ? outcome : existing.outcome,
      due.value !== undefined ? due.value : existing.due_date,
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
