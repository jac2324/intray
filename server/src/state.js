'use strict';

// Builds the full application state bundle, shaped to match what the
// frontend expects (and, not coincidentally, close to the shape the original
// browser-storage prototype used). Every mutating route returns this after
// making its change, so the frontend can just replace its local state with
// the response instead of tracking partial updates.

function mapInbox(row) {
  return { id: row.id, text: row.text, createdAt: row.created_at };
}

function mapAction(row) {
  return {
    id: row.id,
    text: row.text,
    context: row.context,
    projectId: row.project_id,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    parentActionId: row.parent_action_id,
    notes: row.notes || '',
  };
}

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    outcome: row.outcome,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapWaiting(row) {
  return { id: row.id, text: row.text, who: row.who, createdAt: row.created_at };
}

function mapSomeday(row) {
  return { id: row.id, text: row.text, createdAt: row.created_at };
}

function getFullState(db) {
  const inbox = db.prepare('SELECT * FROM inbox_items ORDER BY created_at ASC').all().map(mapInbox);
  const actions = db.prepare('SELECT * FROM actions ORDER BY created_at ASC').all().map(mapAction);
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all().map(mapProject);
  const waiting = db.prepare('SELECT * FROM waiting_items ORDER BY created_at ASC').all().map(mapWaiting);
  const someday = db.prepare('SELECT * FROM someday_items ORDER BY created_at ASC').all().map(mapSomeday);
  const contexts = db.prepare('SELECT name FROM contexts ORDER BY sort_order ASC').all().map((r) => r.name);
  const review = db.prepare('SELECT last_review, checks FROM review_state WHERE id = 1').get();

  return {
    inbox,
    actions,
    projects,
    waiting,
    someday,
    contexts,
    lastReview: review ? review.last_review : null,
    reviewChecks: review ? JSON.parse(review.checks || '{}') : {},
  };
}

module.exports = {
  getFullState,
  mapInbox,
  mapAction,
  mapProject,
  mapWaiting,
  mapSomeday,
};
