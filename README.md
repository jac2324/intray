# Intray

[![Docker build](https://github.com/jac2324/intray/actions/workflows/docker-build.yml/badge.svg)](https://github.com/jac2324/intray/actions/workflows/docker-build.yml)

A self-hosted, single-user implementation of David Allen's *Getting Things
Done* (GTD) methodology — Inbox, clarify flow, Next Actions, Projects,
Waiting For, Someday/Maybe, and a Weekly Review, all backed by your own
encrypted SQLite database on your own hardware. No cloud account, no
subscription, no third party ever sees your data.

One process, one port: an Express server serves both the REST API and the
built React frontend, backed by a single encrypted SQLite file.

> **Setting up your own instance, separate from someone else's?** See
> [NEW_USER_SETUP.md](NEW_USER_SETUP.md) for the condensed version of the
> steps below, aimed at "someone showed me this, I want my own."

<br>

## Contents

- [Quick start — Docker Compose (recommended)](#quick-start--docker-compose-recommended)
- [Quick start — plain Node](#quick-start--plain-node)
- [The database encryption key](#the-database-encryption-key)
- [Backing up and restoring your data](#backing-up-and-restoring-your-data)
- [Password protection (`AUTH_PASSWORD`)](#password-protection-auth_password)
- [Reaching Intray from your phone](#reaching-intray-from-your-phone)
- [Installing as a PWA (home screen app)](#installing-as-a-pwa-home-screen-app)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Design decisions worth knowing about](#design-decisions-worth-knowing-about)
- [Non-goals](#non-goals)

<br>

## Quick start — Docker Compose (recommended)

Requires Docker and Docker Compose.

```bash
cp .env.example .env
```

Edit `.env` and set `DB_ENCRYPTION_KEY` (see [below](#the-database-encryption-key)
for how to generate one — this one is required). Leave `AUTH_PASSWORD` blank
for now if this will only run on your home LAN.

```bash
docker compose up -d
```

Open `http://localhost:3000` (or `http://<your-server-ip>:3000` from another
device on the same network). Your data lives in `./data/intray.db` on the
host, mounted into the container — it survives `docker compose down`,
container restarts, and image rebuilds.

To stop it: `docker compose down` (this does **not** delete `./data`).
To upgrade: pull/rebuild the image and `docker compose up -d --build` — your
data directory is untouched.

A [GitHub Actions workflow](.github/workflows/docker-build.yml) builds the
image on every push and publishes it to GHCR from `main`, so you can also
skip the local build and pull directly:
`docker pull ghcr.io/jac2324/intray:latest` — point `docker-compose.yml`'s
`build: .` at `image: ghcr.io/jac2324/intray:latest` instead if you'd rather
not build locally at all.

<br>

## Quick start — plain Node

Requires Node.js 22+ (required by the `better-sqlite3-multiple-ciphers` native module).

```bash
cp .env.example .env
# edit .env and set DB_ENCRYPTION_KEY

npm install
npm run build
npm start
```

Open `http://localhost:3000`. Data is written to `./data/intray.db` by
default (configurable via `DATA_DIR`).

For local development with hot-reload on the frontend, run
`npm run dev` instead of `build`/`start` — it starts the Express API on
`PORT` (default 3000) and the Vite dev server on `5173` with the two wired
together via proxy; use the `5173` URL while developing.

> **Native module note:** the database layer uses
> `better-sqlite3-multiple-ciphers`, a native (compiled) module. Its
> published prebuilt binaries cover essentially all common platforms, so
> `npm install` should just work. If your platform has no prebuild
> available, npm will try to compile it from source, which requires Python
> 3 and a C++ toolchain (see the [node-gyp docs](https://github.com/nodejs/node-gyp#installation)
> if you hit this) — the Docker path sidesteps this entirely.

<br>

## The database encryption key

Intray encrypts the SQLite database file itself, not just the login. On
startup, the server opens `data/intray.db` with
`PRAGMA key = <DB_ENCRYPTION_KEY>` (via SQLCipher-compatible encryption,
through `better-sqlite3-multiple-ciphers`) before running any other query.
Without the correct key, the `.db` file on disk is unreadable — opening it
with a plain `sqlite3` client, or copying it somewhere else and inspecting
it, shows encrypted bytes, not your tasks and projects.

**Generate one once, before first run:**

```bash
openssl rand -hex 32
```

Paste the output into `.env` as `DB_ENCRYPTION_KEY`. It must be exactly 64
hex characters.

**What this protects against:** someone getting hold of the raw `.db` file
without also having the key — a stolen disk or backup drive, a leaked
backup, someone with filesystem access to the host who isn't you, an old
drive you're recycling.

**What this does *not* protect against:** anyone with live access to the
already-running server process. While Intray is running, it holds a
decrypted connection to the database in memory — that's simply what
"running" means for any encrypted-at-rest database. Restricting *who can
reach the running app* is what [`AUTH_PASSWORD`](#password-protection-auth_password)
and [Tailscale](#reaching-intray-from-your-phone) are for.

**There is no password reset and no recovery.** `DB_ENCRYPTION_KEY` is not
derived from anything else and is not stored anywhere but your `.env` file.
If you lose it, the data in `intray.db` is permanently unreadable — by
design; this is the same trade-off any at-rest encryption makes. Practical
implications:

- Store `.env` somewhere you'll actually keep (a password manager works
  well for the key itself).
- **Do not** back up `DB_ENCRYPTION_KEY` in the same place as
  `intray.db` — if you lose that location, you lose both the data and the
  only key that could ever unlock it. Keep them in genuinely separate places.
- Once you've generated a key and started using it, don't regenerate it —
  a new key can't open a database encrypted under the old one.

<br>

## Backing up and restoring your data

The entire database is one file: `data/intray.db` (WAL mode also produces
transient `intray.db-wal` / `intray.db-shm` files alongside it — for a clean
backup, either stop the app first or use SQLite's online backup semantics;
simplest is to stop the container/process briefly).

**Back up:**

```bash
docker compose stop        # or: stop the plain-Node process
cp data/intray.db backups/intray-$(date +%Y%m%d).db
docker compose start
```

**Restore:** stop the app, replace `data/intray.db` with the backup file,
start the app again. You'll need the *same* `DB_ENCRYPTION_KEY` that was
active when that backup was made — if you've ever rotated the key, keep
track of which key belongs to which backup.

Because the file is encrypted at rest, it's reasonably safe to sync
`data/intray.db` to a cloud backup target (Backblaze, an encrypted cloud
drive, etc.) — the file is meaningless without `DB_ENCRYPTION_KEY`, which
you keep separately and never in that same backup destination.

<br>

## Password protection (`AUTH_PASSWORD`)

Intray is single-user. If you set `AUTH_PASSWORD` in `.env`, every API
request and every page load requires a session-cookie login with that
password first — you'll see a plain login screen before anything else
loads. If you leave it unset, the app has **no authentication at all**.

- **Unset `AUTH_PASSWORD` is fine** if Intray is only reachable on your
  trusted home LAN, or only over a personal VPN like Tailscale (see below).
- **Always set `AUTH_PASSWORD`** — and put the app behind HTTPS — before
  exposing it to the wider internet. Never run it on the open internet with
  no password.

The session cookie is signed with a secret stored in `data/.session-secret`,
generated once on first boot and reused after that — so logging in once is
enough; you won't be asked again just because the container restarted or the
host rebooted. Sessions last 180 days from last use before they need a fresh
login. Deleting `data/.session-secret` invalidates all sessions immediately
(everyone just logs in again) — that's a quick way to force a re-login on
every device if you ever want one.

<br>

## Reaching Intray from your phone

The app itself doesn't know or care what kind of device is connecting — it's
one server, and any device with a browser on the same network reaches it at
`http://<server-ip>:<port>`. That covers desktop and phone automatically as
long as both are on the same Wi-Fi/LAN as the server.

For when your phone is *not* on the home network, there are two options:

### Option 1 (recommended): a personal mesh VPN — Tailscale or WireGuard

Install [Tailscale](https://tailscale.com) (or plain WireGuard) on the
server and on your phone. Your phone then reaches the server by its VPN
address (e.g. `http://intray-server.your-tailnet.ts.net:3000` or a
`100.x.x.x` address) from anywhere in the world — no ports opened to the
public internet, and no `AUTH_PASSWORD` or reverse proxy required, because
the VPN itself is already restricting who can even reach the server. This is
the simplest and safest option for a single person and is the default
recommendation here.

### Option 2 (fallback): expose it directly to the internet

Only do this if you'd rather not install a VPN. It requires both of:

1. **`AUTH_PASSWORD` set** in `.env` (see above).
2. **HTTPS via a reverse proxy** — Intray itself only speaks plain HTTP.
   Put [Caddy](https://caddyserver.com/), [Nginx](https://nginx.org/), or
   [Traefik](https://traefik.io/) in front of it to terminate TLS and
   forward to `http://localhost:<port>`. Caddy is the least effort — a
   two-line Caddyfile gets you automatic HTTPS via Let's Encrypt for a
   domain you point at your server.

   ```
   intray.example.com {
     reverse_proxy localhost:3000
   }
   ```

**This is genuinely riskier** than the VPN option: your login page and API
are reachable by anyone on the internet, protected only by
`AUTH_PASSWORD`. Use a strong, unique password, and prefer Option 1 if at
all possible.

<br>

## Installing as a PWA (home screen app)

Open Intray in your phone's browser and use "Add to Home Screen" (Safari)
or "Install app" (Chrome). It'll launch full-screen like a native app, using
the icon and name from `client/public/manifest.json`.

**If the server's address ever changes** — you move from a LAN IP to a
Tailscale hostname, you change ports, you switch networks — the installed
home-screen icon still points at the old address. Remove it and redo "Add
to Home Screen" against the new address.

<br>

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `3000` | Port the server listens on. |
| `DATA_DIR` | no | `./data` | Directory holding `intray.db`. In Docker this is fixed to `/data` (the volume mount point) regardless of this value. |
| `DB_ENCRYPTION_KEY` | **yes** | — | 64-char hex key encrypting the database at rest. Generate with `openssl rand -hex 32`. No default — the server refuses to start without one. |
| `AUTH_PASSWORD` | no | *(unset)* | If set, requires this password before any API/UI access. If unset, no authentication. |

<br>

## Project structure

```
GTD/
├── server/               Express API + SQLite (single deployable process)
│   └── src/
│       ├── index.js      entry point, wires everything together
│       ├── db.js         opens & encrypts the SQLite database
│       ├── auth.js       session-cookie auth gate + login page
│       ├── state.js      builds the full-state JSON bundle
│       ├── schema.sql    table definitions
│       └── routes/       one file per resource (inbox, actions, …)
├── client/                React + Vite frontend, built to static assets
│   ├── public/            manifest.json, icons, service worker
│   └── src/
│       ├── App.jsx
│       ├── api.js         fetch wrapper for the REST API
│       ├── hooks/useGtdData.js   central state + optimistic capture
│       └── components/    one file per view/widget
├── data/                  SQLite file lives here (gitignored, volume-mounted in Docker)
├── Dockerfile              multi-stage: build client, then runtime image
├── docker-compose.yml
├── .env.example
└── intray-gtd.jsx          the original browser-storage prototype this app
                             was adapted from (kept for reference only — not
                             part of the running app)
```

<br>

## Design decisions worth knowing about

A few calls made while building this, in case any surprise you:

- **IDs are plain auto-incrementing integers**, not UUIDs — simpler schema,
  and fine for a single-user local app with no sync/merge concerns.
- **Fonts fall back to close system equivalents** (Georgia-family serif,
  system sans, system monospace) instead of loading Zilla Slab / Karla /
  IBM Plex Mono from Google Fonts, to keep the app's runtime fully offline
  with zero external network calls (per the no-cloud-dependency
  requirement). If you want the exact typefaces, drop `.woff2` files for
  them into `client/public/fonts/` and add matching `@font-face` rules to
  `client/src/styles.css` — the CSS custom properties (`--font-display`,
  `--font-body`, `--font-mono`) are already wired up to prefer them first.
- **Every mutating API endpoint returns the full, fresh state bundle**
  (`{ state: {...} }`) rather than just the changed record. This keeps the
  frontend simple (one `setState` per action, no partial-update bookkeeping)
  at the cost of slightly more bytes per response — a non-issue at
  single-user, local-network scale.
- **The capture bar's "instant" feel is optimistic UI**: the item appears in
  the Inbox immediately on submit, before the server confirms it; if the
  request fails, it's quietly removed and an error toast appears.
- **Sessions are stateless, signed cookies**, with the signing secret
  persisted to `data/.session-secret` (generated once on first boot, reused
  after that) — logging in survives container restarts and redeploys, not
  just page reloads. Sessions last 180 days from last use. Delete that file
  to force every device to log in again.
- **The container runs as root** inside Docker for simplicity with bind-mount
  permissions across different host/NAS setups (a common trade-off for small
  self-hosted single-purpose containers). If you'd prefer a non-root user,
  add a `USER` directive to the `Dockerfile` and make sure the mounted
  `./data` directory is writable by that UID.
- **Next Actions can nest sub-actions**, arbitrarily deep — a deliberate
  departure from strict GTD (where a "next action" is supposed to already be
  a single atomic step). A sub-action is just another action whose
  `parentActionId` points at its parent: it gets its own context (which can
  differ from its parent's) but always inherits its parent's project, and
  nothing about parent/child completion cascades automatically in either
  direction. Deleting an action deletes its whole subtree — the UI warns
  first if it has any descendants. Actions also carry an optional free-text
  `notes` field, edited alongside everything else in the same edit form.
- **Due dates on projects and actions** are set via the edit form only (not
  at creation) to keep quick-add fast — add one right after capturing
  something if you want it, via the same pencil/edit control. Stored as a
  plain `YYYY-MM-DD` date, not a timestamp, specifically to avoid timezone
  off-by-one bugs; a date chip turns rust-colored once it's past due (and
  the item/project isn't done yet).

<br>

## Non-goals

No multi-user/team features, no native mobile app (a responsive installable
PWA instead), no calendar sync or push notifications, no third-party
integrations, no cloud dependency of any kind.
