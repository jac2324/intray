'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

const { openDatabase } = require('./db');
const { getOrCreateSessionSecret, createAuthGate, createAuthRouter } = require('./auth');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data');
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '';

let db;
try {
  db = openDatabase({ dataDir: DATA_DIR, encryptionKey: DB_ENCRYPTION_KEY });
} catch (err) {
  console.error('\nFailed to open the database:\n  ' + err.message + '\n');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(
  cookieSession({
    name: 'intray.sid',
    // Persisted in /data, not regenerated per boot — see auth.js. Combined
    // with a long maxAge, this means logging in once is enough as long as
    // you open the app at least occasionally (cookie-session resends the
    // cookie, with a refreshed expiry, on every response).
    secret: getOrCreateSessionSecret(DATA_DIR),
    maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days
    sameSite: 'lax',
    httpOnly: true,
  })
);

if (!AUTH_PASSWORD) {
  console.warn(
    '\n[intray] AUTH_PASSWORD is not set — the app is running with NO authentication.\n' +
      '[intray] This is fine on a trusted local/LAN network, but do not expose it to the internet like this.\n'
  );
}

app.use(createAuthGate(AUTH_PASSWORD));
app.use('/api/auth', createAuthRouter(AUTH_PASSWORD));

app.use('/api/state', require('./routes/stateRoute')(db));
app.use('/api/inbox', require('./routes/inbox')(db));
app.use('/api/voice-notes', require('./routes/voiceNotes')(db));
app.use('/api/actions', require('./routes/actions')(db));
app.use('/api/projects', require('./routes/projects')(db));
app.use('/api/waiting', require('./routes/waiting')(db));
app.use('/api/someday', require('./routes/someday')(db));
app.use('/api/contexts', require('./routes/contexts')(db));
app.use('/api/review', require('./routes/review')(db));

// Serve the built frontend (client/dist, produced by `npm run build`).
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Basic JSON error handler for anything that throws in a route.
app.use((err, req, res, next) => {
  // Client errors raised by middleware (e.g. body-parser's 413 for an
  // oversized voice note, or 400 for malformed JSON) keep their status. The
  // client retries queued voice notes on 5xx, so reporting these as 500
  // would make it retry a rejected upload forever.
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.type || 'bad_request' });
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`[intray] listening on http://localhost:${PORT}`);
  console.log(`[intray] data directory: ${DATA_DIR}`);
});

function shutdown() {
  try {
    db.close();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
