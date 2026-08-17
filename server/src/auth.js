'use strict';

const crypto = require('crypto');

// Session secret is generated fresh every time the process starts and lives
// only in memory. That means a server restart logs the user out (they just
// log back in with AUTH_PASSWORD) — a reasonable trade-off for a single-user
// app, since it avoids persisting yet another secret to disk.
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still do a comparison of equal-length buffers so this doesn't
    // short-circuit on length alone in a way that's meaningfully timing-safe.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const LOGIN_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Intray — Sign in</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #F6F5F0;
    background-image: radial-gradient(rgba(32,36,44,0.07) 1px, transparent 1px);
    background-size: 22px 22px;
    color: #20242C;
    padding: 20px;
  }
  .card {
    background: #FCFBF8; border: 1px solid #E3DFD3; border-radius: 10px;
    padding: 28px 24px; width: 320px; max-width: 100%;
    box-shadow: 0 1px 2px rgba(32,36,44,0.05);
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { font-size: 13px; color: #676F7D; margin: 0 0 18px; }
  input {
    width: 100%; font-size: 15px; padding: 9px 11px; border: 1px solid #E3DFD3;
    border-radius: 7px; margin-bottom: 10px; font-family: inherit; background: #F6F5F0; color: #20242C;
  }
  input:focus-visible { outline: 2px solid #3D5A99; outline-offset: 1px; }
  button {
    width: 100%; font-size: 14px; font-weight: 600; padding: 10px; border: none;
    border-radius: 7px; background: #3D5A99; color: #fff; cursor: pointer;
  }
  button:hover { background: #33497f; }
  button:focus-visible { outline: 2px solid #20242C; outline-offset: 2px; }
  .error { font-size: 12px; color: #B5573C; margin: -4px 0 10px; min-height: 14px; }
</style>
</head>
<body>
  <form class="card" id="f">
    <h1>Intray</h1>
    <p>Enter your password to continue.</p>
    <input type="password" id="pw" name="password" placeholder="Password" autofocus autocomplete="current-password" />
    <div class="error" id="err"></div>
    <button type="submit">Sign in</button>
  </form>
  <script>
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('pw').value;
      const errEl = document.getElementById('err');
      errEl.textContent = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          window.location.href = '/';
        } else {
          errEl.textContent = 'Incorrect password.';
        }
      } catch (err) {
        errEl.textContent = 'Could not reach the server.';
      }
    });
  </script>
</body>
</html>`;

function createAuthGate(authPassword) {
  return function authGate(req, res, next) {
    if (!authPassword) return next();
    if (req.path === '/api/auth/login') return next();
    if (req.path === '/api/auth/status') return next();
    if (req.session && req.session.authed) return next();
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return res.status(200).type('html').send(LOGIN_PAGE_HTML);
  };
}

function createAuthRouter(authPassword) {
  const express = require('express');
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json({ authRequired: !!authPassword, authed: !authPassword || !!(req.session && req.session.authed) });
  });

  router.post('/login', (req, res) => {
    const { password } = req.body || {};
    if (!authPassword) {
      return res.json({ ok: true });
    }
    if (typeof password === 'string' && timingSafeEqual(password, authPassword)) {
      req.session.authed = true;
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'invalid_password' });
  });

  router.post('/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  return router;
}

module.exports = { SESSION_SECRET, createAuthGate, createAuthRouter };
