'use strict';

const express = require('express');
const { getFullState } = require('../state');

module.exports = function stateRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(getFullState(db));
  });

  return router;
};
