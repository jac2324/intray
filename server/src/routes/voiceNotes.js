'use strict';

const express = require('express');
const { getFullState } = require('../state');

module.exports = function voiceNotesRouter(db) {
  const router = express.Router();

  // Boot-time safety net for the table's invariant (every row is attached to
  // a live inbox item, or archived). The routes already keep this true; this
  // just guarantees no orphaned audio can quietly accumulate if one ever
  // slips through (e.g. an inbox row removed by hand).
  db.prepare(
    `DELETE FROM voice_notes
      WHERE archived = 0
        AND (inbox_item_id IS NULL OR inbox_item_id NOT IN (SELECT id FROM inbox_items))`
  ).run();

  // Streams a recording, for both inbox items and archived ones. Supports
  // HTTP Range requests: iOS Safari refuses to play <audio> from a server
  // that doesn't, and it makes scrubbing/replay work everywhere.
  router.get('/:id/audio', (req, res) => {
    const row = db.prepare('SELECT mime, data FROM voice_notes WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'voice note not found' });

    const data = row.data;
    const total = data.length;
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const range = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
    if (range && (range[1] !== '' || range[2] !== '')) {
      let start;
      let end;
      if (range[1] === '') {
        // Suffix form: the last N bytes.
        start = Math.max(total - Number(range[2]), 0);
        end = total - 1;
      } else {
        start = Number(range[1]);
        end = range[2] === '' ? total - 1 : Math.min(Number(range[2]), total - 1);
      }
      if (start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.end(data.subarray(start, end + 1));
    }

    res.setHeader('Content-Length', total);
    res.end(data);
  });

  // Removes a kept recording from the Saved recordings list.
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM voice_notes WHERE id = ? AND archived = 1').run(Number(req.params.id));
    res.json({ state: getFullState(db) });
  });

  return router;
};
