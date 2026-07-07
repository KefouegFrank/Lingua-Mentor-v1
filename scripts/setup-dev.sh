#!/usr/bin/env bash
set -euo pipefail
# 1. pnpm install at repo root
# 2. poetry install in apps/ai-service and apps/worker
# 3. copy every .env.example to .env and prompt for values
# 4. docker compose -f infra/docker-compose.yml up -d redis
