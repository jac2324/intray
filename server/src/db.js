'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3-multiple-ciphers');

const DEFAULT_CONTEXTS = ['Calls', 'Errands', 'Computer', 'Home', 'Office', 'Anywhere'];

const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

function openDatabase({ dataDir, encryptionKey }) {
  if (!encryptionKey) {
    throw new Error(
      'DB_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32`, ' +
        'put it in your .env file, and restart. See README.md for details.'
    );
  }
  if (!HEX_KEY_RE.test(encryptionKey)) {
    throw new Error(
      'DB_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with `openssl rand -hex 32`.'
    );
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'intray.db');
  const isNewFile = !fs.existsSync(dbPath);

  const db = new Database(dbPath);

  // This MUST run before any other query touches the file — it's what makes
  // the on-disk bytes unreadable without the key. Raw hex key format (the
  // `x'...'` syntax) is used so the 64-hex-char output of `openssl rand -hex
  // 32` is consumed directly as the actual 256-bit key, with no additional
  // key-derivation step.
  db.pragma(`cipher='sqlcipher'`);
  db.pragma(`key="x'${encryptionKey}'"`);

  try {
    // Any statement forces SQLite to actually read the file header. If the
    // key is wrong (and this is an existing encrypted file), this throws.
    db.pragma('user_version');
  } catch (err) {
    db.close();
    throw new Error(
      'Could not open the database with the provided DB_ENCRYPTION_KEY. ' +
        'Either the key is wrong, or this file was encrypted with a different key. ' +
        `(underlying error: ${err.message})`
    );
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  if (isNewFile) {
    seedDefaultContexts(db);
  }

  return db;
}

function seedDefaultContexts(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO contexts (name, sort_order) VALUES (?, ?)');
  const seedAll = db.transaction((names) => {
    names.forEach((name, i) => insert.run(name, i));
  });
  seedAll(DEFAULT_CONTEXTS);
}

module.exports = { openDatabase, DEFAULT_CONTEXTS };
