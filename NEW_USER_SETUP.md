# Setting up your own Intray

So someone showed you Intray and you want your own — not access to theirs,
your own separate instance with your own data. This is the quick path.

**Important:** Intray is single-user by design. There's no "sign up" or
accounts — each person runs their own completely separate copy, with its
own server, own database, and own encryption key. If you instead just want
to *view or edit someone else's* Intray from your phone, you don't need any
of this — just ask them for their server's address and open it in your
browser.

<br>

## 1. Get a machine to run it on

Any computer that can stay on: a laptop, a desktop, a NAS, a Raspberry Pi.
It doesn't need to be powerful — this is a small single-process app. It
just needs [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(or Docker Engine on Linux) installed.

## 2. Get the code and configure it

```bash
git clone https://github.com/jac2324/intray.git
cd intray
cp .env.example .env
```

Generate your own encryption key — this is yours alone, don't share it and
don't reuse someone else's:

```bash
openssl rand -hex 32
```

Paste the output into `.env` as `DB_ENCRYPTION_KEY`. Leave `AUTH_PASSWORD`
blank for now if only you (or people you trust) will be on the same Wi-Fi
as this machine — see step 4 below if that's not the case.

## 3. Start it

```bash
docker compose up -d
```

Open `http://localhost:3000` on the same machine to confirm it's running.
This is now your own Intray — separate database, separate everything, from
anyone else's instance.

## 4. Reach it from your phone

1. Find this machine's LAN IP address:
   - Windows: `ipconfig` → look for the Wi-Fi adapter's IPv4 address
   - Mac/Linux: `ifconfig` or `ip addr` → same idea
2. Make sure your phone is on the **same Wi-Fi network** as this machine.
3. Open `http://<that-ip>:3000` in your phone's browser.
4. "Add to Home Screen" (Safari) or "Install app" (Chrome) so it opens
   full-screen like a native app.

**If other people share that Wi-Fi** (roommates, family, an office network)
and you don't want them able to open that address and see or edit your
task list, set `AUTH_PASSWORD` in your `.env`, then
`docker compose up -d` again to apply it. Without it, anyone on the same
network who knows or guesses the address has full access — there's no
per-person login to fall back on.

<br>

## Beyond the same Wi-Fi

If you want to reach your Intray from your phone when you're away from
home too — or want to expose it to the internet — see the main
[README](README.md#reaching-intray-from-your-phone) for both options
(a personal VPN like Tailscale, recommended; or a reverse proxy with HTTPS
as a fallback).

The README also covers backing up your database, what happens if you lose
`DB_ENCRYPTION_KEY` (short version: the data is gone, by design — there's
no recovery), and plain-Node setup if you'd rather not use Docker.
