#!/usr/bin/env bash
set -euo pipefail

# Minimal developer bootstrap script.
# - Install JS deps (pnpm)
# - Install Python deps (poetry) for Python apps
# - Copy .env.example -> .env for each app if .env missing
# - Start local infra (Redis) via docker-compose

ROOT=$(cd "$(dirname "$0")/.." && pwd)
echo "Root: $ROOT"

echo "1) Installing pnpm workspace packages..."
pnpm install

echo "2) Installing Python dependencies for ai-service and worker (if poetry present)..."
for d in "$ROOT"/apps/ai-service "$ROOT"/apps/worker; do
	if [ -f "$d/pyproject.toml" ]; then
		echo " - Installing in $d"
		(cd "$d" && poetry install || true)
	fi
done

echo "3) Copying .env.example to .env where missing"
for ex in "$ROOT"/apps/*/.env.example; do
	dest="$(dirname "$ex")/.env"
	if [ -f "$ex" ] && [ ! -f "$dest" ]; then
		echo " - Copying $ex -> $dest"
		cp "$ex" "$dest"
	fi
done

echo "4) Starting Redis via docker-compose"
docker compose -f "$ROOT/infra/docker-compose.yml" up -d redis || true

echo "Bootstrap complete. Next steps: edit apps/*/.env files as needed and run frontend and api-gateway dev scripts."
