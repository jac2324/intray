'use strict';

const express = require('express');
const { getFullState } = require('../state');

function getReviewRow(db) {
  return db.prepare('SELECT last_review, checks FROM review_state WHERE id = 1').get();
}

module.exports = function reviewRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const row = getReviewRow(db);
    res.json({ lastReview: row.last_review, reviewChecks: JSON.parse(row.checks || '{}') });
  });

  router.post('/toggle', (req, res) => {
    const stepId = req.body && req.body.stepId;
    if (!stepId) return res.status(400).json({ error: 'stepId is required' });
    const row = getReviewRow(db);
    const checks = JSON.parse(row.checks || '{}');
    checks[stepId] = !checks[stepId];
    db.prepare('UPDATE review_state SET checks = ? WHERE id = 1').run(JSON.stringify(checks));
    res.json({ state: getFullState(db) });
  });

  router.post('/complete', (req, res) => {
    db.prepare("UPDATE review_state SET last_review = ?, checks = '{}' WHERE id = 1").run(Date.now());
    res.json({ state: getFullState(db) });
  });

  return router;
};
