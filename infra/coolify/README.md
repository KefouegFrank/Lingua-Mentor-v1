# Coolify deployment notes

This directory holds Coolify-specific configuration/notes only — Coolify itself
manages the reverse proxy, TLS (Let's Encrypt), and git-push deploy hooks, so
there's intentionally no nginx config checked in here. See deployment patch
§2.3 and §4.4 for the full deploy pipeline (GitHub Actions → Docker build →
Coolify webhook).
