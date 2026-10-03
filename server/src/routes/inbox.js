'use strict';

const express = require('express');
const { getFullState, selectInbox, mapInbox } = require('../state');

// Placeholder inbox text for a voice note. It's only ever shown as a label —
// the clarify flow makes the user type what the note actually means, and the
// server refuses to turn this placeholder into an action/someday/waiting item.
const VOICE_NOTE_TEXT = 'Voice note';
const MAX_VOICE_BYTES = 10 * 1024 * 1024; // ~2 min of opus is ~1 MB; this is a generous ceiling
const MAX_VOICE_DURATION_MS = 10 * 60 * 1000;

// What a kept recording is labeled with in the Saved recordings list, so you
// can tell later what it turned into.
function keptLabelFor(resolution, text) {
  const t = (text || '').trim();
  switch (resolution.type) {
    case 'action':
      return `${resolution.parentActionId ? 'Sub-action' : 'Next action'}: ${t}`;
    case 'someday':
      return `Someday: ${t}`;
    case 'waiting':
      return `Waiting on ${(resolution.who || '').trim()}: ${t}`;
    case 'done':
      return t ? `Done: ${t}` : 'Done in under 2 minutes';
    case 'trash':
      return t ? `Trashed: ${t}` : 'Trashed voice note';
    default:
      return VOICE_NOTE_TEXT;
  }
}

module.exports = function inboxRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(selectInbox(db));
  });

  router.post('/', (req, res) => {
    const text = (req.body && req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });
    const info = db
      .prepare('INSERT INTO inbox_items (text, created_at) VALUES (?, ?)')
      .run(text, Date.now());
    res.status(201).json({ item: mapInbox({ id: info.lastInsertRowid, text, created_at: Date.now() }), state: getFullState(db) });
  });

  // Voice note capture: the request body is the raw audio (Content-Type
  // audio/*), with the length in X-Duration-Ms and a phone-generated
  // idempotency key in X-Client-Id. express.raw is scoped to just this
  // route, so the app-wide express.json() is untouched.
  router.post('/audio', express.raw({ type: 'audio/*', limit: MAX_VOICE_BYTES }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'audio body is required (Content-Type: audio/*)' });
    }
    const mime = (req.get('content-type') || '').slice(0, 100);
    const clientId = (req.get('x-client-id') || '').slice(0, 100) || null;
    const durationRaw = Number.parseInt(req.get('x-duration-ms') || '', 10);
    const durationMs = Number.isFinite(durationRaw) && durationRaw >= 0 ? Math.min(durationRaw, MAX_VOICE_DURATION_MS) : null;

    // A retry of an upload that already landed (response lost in transit):
    // return the existing item rather than creating a duplicate.
    if (clientId) {
      const existing = db.prepare('SELECT inbox_item_id FROM voice_notes WHERE client_id = ?').get(clientId);
      if (existing) {
        return res.status(200).json({ duplicate: true, state: getFullState(db) });
      }
    }

    const now = Date.now();
    const create = db.transaction(() => {
      const item = db.prepare('INSERT INTO inbox_items (text, created_at) VALUES (?, ?)').run(VOICE_NOTE_TEXT, now);
      db.prepare(
        'INSERT INTO voice_notes (inbox_item_id, client_id, mime, duration_ms, data, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(item.lastInsertRowid, clientId, mime, durationMs, req.body, now);
      return item.lastInsertRowid;
    });
    create();

    res.status(201).json({ state: getFullState(db) });
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    // Trashing via the X button never keeps the audio. The voice note row
    // has to go first: the FK is SET NULL, so deleting the inbox item
    // first would leave an unarchived, unattached row behind.
    db.transaction(() => {
      db.prepare('DELETE FROM voice_notes WHERE inbox_item_id = ? AND archived = 0').run(id);
      db.prepare('DELETE FROM inbox_items WHERE id = ?').run(id);
    })();
    res.json({ state: getFullState(db) });
  });

  // The clarify flow: given an inbox item and a resolution describing where
  // it should land, atomically remove it from the inbox and create whatever
  // downstream record the resolution implies.
  router.post('/:id/process', (req, res) => {
    const id = Number(req.params.id);
    const item = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'inbox item not found' });

    const resolution = (req.body && req.body.resolution) || {};
    const now = Date.now();

    const voiceNote = db.prepare('SELECT id FROM voice_notes WHERE inbox_item_id = ?').get(id);
    const typedText = (resolution.text || '').trim();

    // For a voice note, item.text is just the "Voice note" placeholder, so
    // anything that becomes a real record needs text the user actually typed.
    if (voiceNote && ['action', 'someday', 'waiting'].includes(resolution.type) && !typedText) {
      return res.status(400).json({ error: 'type what this voice note is about first' });
    }
    const recordText = (typedText || item.text || '').trim();

    const run = db.transaction(() => {
      // Keep or delete the recording. Done first, inside the transaction, so
      // a validation failure further down rolls this back too.
      if (voiceNote) {
        if (resolution.keepRecording) {
          db.prepare('UPDATE voice_notes SET archived = 1, inbox_item_id = NULL, kept_label = ? WHERE id = ?').run(
            keptLabelFor(resolution, typedText),
            voiceNote.id
          );
        } else {
          db.prepare('DELETE FROM voice_notes WHERE id = ?').run(voiceNote.id);
        }
      }

      db.prepare('DELETE FROM inbox_items WHERE id = ?').run(id);

      switch (resolution.type) {
        case 'trash':
        case 'done':
          // No further record needed — trashed, or done in under two minutes.
          break;

        case 'someday':
          db.prepare('INSERT INTO someday_items (text, created_at) VALUES (?, ?)').run(recordText, now);
          break;

        case 'waiting': {
          const who = (resolution.who || '').trim();
          if (!who) throw Object.assign(new Error('who is required for delegation'), { status: 400 });
          db.prepare('INSERT INTO waiting_items (text, who, created_at) VALUES (?, ?, ?)').run(recordText, who, now);
          break;
        }

        case 'action': {
          const text = recordText;
          if (!text) throw Object.assign(new Error('text is required'), { status: 400 });

          // Attaching to an existing action as a sub-step takes priority
          // over the project fields — project is always inherited from
          // the parent in that case, same rule as POST /api/actions.
          if (resolution.parentActionId) {
            const parent = db.prepare('SELECT * FROM actions WHERE id = ?').get(resolution.parentActionId);
            if (!parent) throw Object.assign(new Error('parent action not found'), { status: 404 });
            db.prepare(
              'INSERT INTO actions (text, context, project_id, status, created_at, parent_action_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(text, resolution.context || null, parent.project_id, 'next', now, parent.id);
            break;
          }

          let projectId = resolution.projectId || null;
          const newProjectName = (resolution.newProjectName || '').trim();
          if (newProjectName) {
            const info = db
              .prepare('INSERT INTO projects (name, outcome, status, created_at) VALUES (?, ?, ?, ?)')
              .run(newProjectName, '', 'active', now);
            projectId = info.lastInsertRowid;
          }
          db.prepare(
            'INSERT INTO actions (text, context, project_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
          ).run(text, resolution.context || null, projectId, 'next', now);
          break;
        }

        default:
          throw Object.assign(new Error('unknown resolution type'), { status: 400 });
      }
    });

    try {
      run();
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }

    res.json({ state: getFullState(db) });
  });

  return router;
};
