#!/usr/bin/env bash
set -euo pipefail

# Generates the RS256 keypair the gateway signs JWTs with and ai-service
# verifies them with. Idempotent — safe to re-run; skips if keys already
# exist so a fresh `pnpm install` never clobbers a dev's existing session.
#
# PKCS#8 is deliberate, not incidental: `openssl genrsa` emits PKCS#1, which
# jose's importPKCS8() rejects outright. genpkey -traditional would give us
# PKCS#1 too — plain `genpkey` is what actually writes PKCS#8.

ROOT=$(cd "$(dirname "$0")/.." && pwd)
GATEWAY_KEYS="$ROOT/apps/api-gateway/keys"
AI_SERVICE_KEYS="$ROOT/apps/ai-service/keys"

PRIVATE_KEY="$GATEWAY_KEYS/jwt_private.pem"
PUBLIC_KEY="$GATEWAY_KEYS/jwt_public.pem"

if [ -f "$PRIVATE_KEY" ] && [ -f "$PUBLIC_KEY" ]; then
	echo "JWT keys already exist at $GATEWAY_KEYS — skipping generation."
else
	mkdir -p "$GATEWAY_KEYS"
	echo "Generating RS256 keypair (PKCS#8) at $GATEWAY_KEYS..."
	openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$PRIVATE_KEY"
	openssl rsa -pubout -in "$PRIVATE_KEY" -out "$PUBLIC_KEY"
	chmod 600 "$PRIVATE_KEY"
fi

# ai-service only ever verifies tokens (ADR 0001 §5 topology) — it needs the
# public key alone, never the private one.
mkdir -p "$AI_SERVICE_KEYS"
cp "$PUBLIC_KEY" "$AI_SERVICE_KEYS/jwt_public.pem"

echo "Done. Public key mirrored to $AI_SERVICE_KEYS/jwt_public.pem"
