'use strict';

// Builds the full application state bundle, shaped to match what the
// frontend expects (and, not coincidentally, close to the shape the original
// browser-storage prototype used). Every mutating route returns this after
// making its change, so the frontend can just replace its local state with
// the response instead of tracking partial updates.

// voiceNoteId / audioDurationMs come from the LEFT JOIN in selectInbox (never
// the audio blob itself — that's streamed separately, so the state bundle
// stays small). Rows from a plain text capture have neither.
function mapInbox(row) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    voiceNoteId: row.voice_note_id || null,
    audioDurationMs: row.audio_duration_ms || null,
  };
}

function selectInbox(db) {
  return db
    .prepare(
      `SELECT i.*, v.id AS voice_note_id, v.duration_ms AS audio_duration_ms
         FROM inbox_items i
         LEFT JOIN voice_notes v ON v.inbox_item_id = i.id
        ORDER BY i.created_at ASC`
    )
    .all()
    .map(mapInbox);
}

function mapSavedRecording(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    durationMs: row.duration_ms || null,
    keptLabel: row.kept_label || 'Voice note',
  };
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
    dueDate: row.due_date || null,
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
    dueDate: row.due_date || null,
  };
}

function mapWaiting(row) {
  return { id: row.id, text: row.text, who: row.who, createdAt: row.created_at };
}

function mapSomeday(row) {
  return { id: row.id, text: row.text, createdAt: row.created_at };
}

function getFullState(db) {
  const inbox = selectInbox(db);
  const actions = db.prepare('SELECT * FROM actions ORDER BY created_at ASC').all().map(mapAction);
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all().map(mapProject);
  const waiting = db.prepare('SELECT * FROM waiting_items ORDER BY created_at ASC').all().map(mapWaiting);
  const someday = db.prepare('SELECT * FROM someday_items ORDER BY created_at ASC').all().map(mapSomeday);
  const contexts = db.prepare('SELECT name FROM contexts ORDER BY sort_order ASC').all().map((r) => r.name);
  const review = db.prepare('SELECT last_review, checks FROM review_state WHERE id = 1').get();
  const savedRecordings = db
    .prepare('SELECT id, created_at, duration_ms, kept_label FROM voice_notes WHERE archived = 1 ORDER BY created_at DESC')
    .all()
    .map(mapSavedRecording);

  return {
    inbox,
    savedRecordings,
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
  selectInbox,
  mapInbox,
  mapAction,
  mapProject,
  mapWaiting,
  mapSomeday,
};
