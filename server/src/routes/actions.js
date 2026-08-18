'use strict';

const express = require('express');
const { getFullState, mapAction } = require('../state');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Accepts null/undefined/'' (clearing the due date) or a plain 'YYYY-MM-DD'
// string. Returns { ok, value } rather than throwing, so callers can 400
// with a clear message instead of a generic 500.
function normalizeDueDate(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === '') return { ok: true, value: null };
  if (typeof value === 'string' && DATE_RE.test(value)) return { ok: true, value };
  return { ok: false };
}

module.exports = function actionsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM actions ORDER BY created_at ASC').all();
    res.json(rows.map(mapAction));
  });

  // Quick-add: create a Next Action directly, bypassing the inbox. Also
  // used to create a sub-action when parentActionId is given — in that
  // case the project is always inherited from the parent (not settable
  // independently), only context is the child's own.
  router.post('/', (req, res) => {
    const { text, context, projectId, parentActionId, notes, dueDate } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'text is required' });

    const due = normalizeDueDate(dueDate);
    if (!due.ok) return res.status(400).json({ error: 'dueDate must be YYYY-MM-DD or null' });

    let finalProjectId = projectId || null;
    let finalParentId = null;
    if (parentActionId) {
      const parent = db.prepare('SELECT * FROM actions WHERE id = ?').get(parentActionId);
      if (!parent) return res.status(404).json({ error: 'parent action not found' });
      finalParentId = parent.id;
      finalProjectId = parent.project_id; // always inherited, ignore any client-supplied projectId
    }

    const info = db
      .prepare(
        'INSERT INTO actions (text, context, project_id, status, created_at, parent_action_id, notes, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(trimmed, context || null, finalProjectId, 'next', Date.now(), finalParentId, (notes || '').trim(), due.value || null);

    res.status(201).json({ id: info.lastInsertRowid, state: getFullState(db) });
  });

  // Covers: complete (status -> done), undo (status -> next), and editing
  // text/context/project/notes. Project is intentionally not re-derived
  // from the parent here — the edit form never offers it for sub-actions,
  // and a top-level action's project is meant to be directly editable.
  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'action not found' });

    const { status, text, context, projectId, notes, dueDate } = req.body || {};
    const due = normalizeDueDate(dueDate);
    if (!due.ok) return res.status(400).json({ error: 'dueDate must be YYYY-MM-DD or null' });

    const next = {
      text: text !== undefined ? text : existing.text,
      context: context !== undefined ? context : existing.context,
      project_id: projectId !== undefined ? projectId : existing.project_id,
      status: status !== undefined ? status : existing.status,
      completed_at: existing.completed_at,
      notes: notes !== undefined ? notes : existing.notes,
      due_date: due.value !== undefined ? due.value : existing.due_date,
    };
    if (status === 'done' && existing.status !== 'done') next.completed_at = Date.now();
    if (status === 'next' && existing.status === 'done') next.completed_at = null;

    db.prepare(
      'UPDATE actions SET text = ?, context = ?, project_id = ?, status = ?, completed_at = ?, notes = ?, due_date = ? WHERE id = ?'
    ).run(next.text, next.context, next.project_id, next.status, next.completed_at, next.notes, next.due_date, id);

    res.json({ state: getFullState(db) });
  });

  // Cascades to the whole subtree at the database level (ON DELETE CASCADE,
  // foreign_keys pragma is on) — deleting a parent silently takes its
  // sub-actions with it. The frontend warns before calling this if the
  // action being deleted has any descendants.
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM actions WHERE id = ?').run(req.params.id);
    res.json({ state: getFullState(db) });
  });

  return router;
};
