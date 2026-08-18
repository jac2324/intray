# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This is a single-user personal app rather than a published library, so
versioning here is a convenience for tracking history, not a strict semver
compatibility contract.

## [Unreleased]

### Added
- Editing project name/outcome, and action text/context/project, in place —
  previously these could only be set at creation time.
- "Recently completed" on the Next Actions view is now uncapped (previously
  the last 10 only), sorted newest-first, and shows each item's completion
  date and project — still collapsible, still with per-item Undo.
- Actions inside an expanded project card can now be completed, edited, and
  deleted directly, not just added.
- **Nested sub-actions**, arbitrarily deep: expand any Next Action to add,
  complete, edit, or delete smaller steps underneath it. A sub-action has
  its own context (independent of its parent's) but always inherits its
  parent's project; deleting a parent warns before cascading to its whole
  subtree. Reachable from the Next Actions list, from within a project
  card, and — via a new "attach to an existing action" picker in the
  clarify flow's final step — directly from Inbox processing, without
  adding a new question to that flow.
  Completed sub-actions move to "Recently completed" like anything else,
  grouped under their parent's full breadcrumb path (e.g.
  "Renovate Bathroom › Get quotes") even if that parent isn't done yet.
- A free-text **notes** field on any action (top-level or nested), edited
  in the same form as text/context/project; a small indicator shows when
  an action has notes without needing to open edit mode.
- `NEW_USER_SETUP.md`: a condensed walkthrough for someone else standing up
  their own separate instance, linked from the top of the README.
- **Due dates** on projects and actions (any depth), set via the edit form.
  Stored as a plain `YYYY-MM-DD` date rather than a timestamp, to avoid
  timezone-related off-by-one display bugs. A due-date chip turns
  rust-colored once it's past due and the item/project is still open.
  Also fixes stalled-project detection along the way: a project whose root
  action is done but still has an open sub-action underneath it is no
  longer considered stalled (previously only checked root-level actions).

### Fixed
- Sessions were invalidated by any server restart (container recreate,
  redeploy, host reboot) because the signing secret was regenerated in
  memory each boot. It's now persisted to `data/.session-secret` and
  session length extended to 180 days — logging in once is enough.
- Mobile bottom tab-bar labels ("Next Actions", "Waiting For", etc.) could
  visually overlap the neighboring tab. Root cause was a CSS source-order
  bug: the `@media (max-width: 767px)` overrides for `.tab-btn` were
  declared *before* the always-on base rule, so the base rule's
  `font-size`/`padding` were silently winning at every width, leaving far
  less room than intended. Reordered the stylesheet so the responsive
  overrides actually apply; all six labels now render in full on one line
  with no truncation, wrapping, or overlap.

## [1.0.0] - 2026-08-17

Initial release — full-stack rebuild of the `intray-gtd.jsx` browser-storage
prototype into a real, deployable app.

### Added
- Express + SQLite backend, database encrypted at rest via
  `better-sqlite3-multiple-ciphers` (`PRAGMA key` set before any other
  query). REST API covering inbox, actions, projects, waiting-for,
  someday/maybe, contexts, and weekly review state.
- React + Vite frontend adapted from the prototype's UI, copy, and "field
  notebook" design tokens, now backed by the API with optimistic capture.
- Mobile-first responsive layout: fixed bottom tab bar under 768px width,
  top row above it, 44px tap targets.
- PWA manifest, generated icon set, and a minimal caching service worker
  for home-screen install.
- Optional session-cookie authentication gated by `AUTH_PASSWORD`, with a
  standalone login page served before any API/UI access when set.
- Multi-stage `Dockerfile` and `docker-compose.yml` mounting `/data` as a
  volume, for a `docker compose up` deployment.
- `README.md` covering both quick-start paths, `DB_ENCRYPTION_KEY`
  generation and loss warnings, backup/restore, `AUTH_PASSWORD` guidance,
  and Tailscale-first / reverse-proxy-fallback options for remote phone
  access.
- MIT `LICENSE`.
- GitHub Actions workflow (`docker-build.yml`) that builds the Docker image
  on every push/PR and publishes it to GHCR from `main`.

### Fixed
- Dockerfile base image bumped from `node:20-slim` to `node:22-slim` after
  discovering `better-sqlite3-multiple-ciphers` requires Node ≥22 — on
  Node 20 the native module loaded a mismatched prebuilt binary and the
  container segfaulted immediately on every start.

### Changed
- Pinned GitHub Actions bumped to their latest major versions
  (`actions/checkout` v7, `docker/setup-buildx-action` v4,
  `docker/login-action` v4, `docker/metadata-action` v6,
  `docker/build-push-action` v7), resolving a Node 20 runner deprecation
  warning from the first CI run.
