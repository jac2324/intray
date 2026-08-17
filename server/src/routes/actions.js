'use strict';

const express = require('express');
const { getFullState, mapAction } = require('../state');

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
    const { text, context, projectId, parentActionId, notes } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'text is required' });

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
        'INSERT INTO actions (text, context, project_id, status, created_at, parent_action_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(trimmed, context || null, finalProjectId, 'next', Date.now(), finalParentId, (notes || '').trim());

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

    const { status, text, context, projectId, notes } = req.body || {};
    const next = {
      text: text !== undefined ? text : existing.text,
      context: context !== undefined ? context : existing.context,
      project_id: projectId !== undefined ? projectId : existing.project_id,
      status: status !== undefined ? status : existing.status,
      completed_at: existing.completed_at,
      notes: notes !== undefined ? notes : existing.notes,
    };
    if (status === 'done' && existing.status !== 'done') next.completed_at = Date.now();
    if (status === 'next' && existing.status === 'done') next.completed_at = null;

    db.prepare(
      'UPDATE actions SET text = ?, context = ?, project_id = ?, status = ?, completed_at = ?, notes = ? WHERE id = ?'
    ).run(next.text, next.context, next.project_id, next.status, next.completed_at, next.notes, id);

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
