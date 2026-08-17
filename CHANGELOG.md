# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This is a single-user personal app rather than a published library, so
versioning here is a convenience for tracking history, not a strict semver
compatibility contract.

## [Unreleased]

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
