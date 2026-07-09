# api-gateway

Node.js / Fastify. Handles REST, SSE, and voice-WebSocket traffic.

Voice-session handling lives entirely in `src/modules/voice/` so that the
future REST/voice-WS process split (deployment patch §2.2, §6.2) is a
process-launch config change, not a refactor. Do not import voice-module
code from other modules' hot paths.

## Auth

RS256 JWTs (PRD §10.4): a 15-minute access token carried as a `Bearer` header,
and a 7-day refresh token in an httpOnly cookie, scoped to `/api/v1/auth` so
it's never sent on unrelated requests. One keypair signs both token kinds,
so every token carries a `token_use` claim and every verify call checks it —
otherwise a leaked access token would double as a valid refresh token.

Refresh tokens rotate: each one carries a `jti`, and Redis holds a
`refresh:{jti}` marker for as long as that token is redeemable. Redeeming a
refresh token is an atomic Redis `GETDEL` — the marker is consumed the
instant it's read, so the same cookie value can never succeed twice.
Replaying an already-rotated cookie (a stolen cookie, a browser
back-button race) fails with `401 INVALID_REFRESH_TOKEN` instead of quietly
minting a second session. There's no `refresh_tokens` table — losing Redis
just forces everyone to log in again, which ADR 0001 §3.3 already accepts
as the cost of self-hosting Redis in Phase 1.

Generate a local dev keypair once (idempotent, safe to re-run):

```bash
bash ../../scripts/generate-jwt-keys.sh
```

This writes `keys/jwt_{private,public}.pem` here and mirrors the public key
to `apps/ai-service/keys/` (ai-service only ever verifies tokens — it never
signs one, per ADR 0001 §5's topology).

Endpoints, all under `/api/v1/auth`:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | public | Creates `users` + `learner_profiles` in one transaction. 409 `EMAIL_TAKEN` on a duplicate email. |
| POST | `/login` | public | Unknown email, wrong password, and a deactivated account all return the identical `401 INVALID_CREDENTIALS` — telling them apart would hand an attacker a free account-enumeration tool. |
| POST | `/refresh` | refresh cookie | Rotates the pair; issues a new access token and a new refresh cookie. |
| POST | `/logout` | refresh cookie (optional) | Revokes the token if present; always returns 204 — logout is idempotent. |

`GET /api/v1/user/me` (in `src/modules/users/`) returns the current user's
profile, including the 4D CEFR fields (PRD §22); it requires a valid access
token like every other non-auth route.

**Deferred, with `TODO` markers at the call site:**
- Rate limiting on register/login (`TODO(slice-6)`) — rides with the
  per-user AI-quota Redis token bucket once that infrastructure exists, so
  brute-force login attempts and AI-endpoint abuse share one mitigation
  instead of two separately-built ones.
- Password reset (`TODO(phase-2)`) — needs a transactional email provider,
  which isn't part of the Phase 1 infra ADR 0001 specifies.

## Shared request schemas

Request bodies that both the frontend and this gateway validate (register,
login, essay submission) live in `packages/shared-schemas`, not here —
see `docs/architecture/project-structure-and-conventions.md` §1 for why.
That package builds to its own `dist/`, so after changing a shared schema,
rebuild it before the gateway picks up the change:

```bash
pnpm --filter @lingumentor/shared-schemas build
```

(`pnpm -r build` from the repo root rebuilds every workspace package in the
right order, if you'd rather not track this by hand.)

## Docker build

The Dockerfile's build context is the **repo root**, not this directory —
`api-gateway` depends on the `@lingumentor/shared-schemas` workspace
package, so the build needs to see the whole monorepo to resolve it. Build
with `docker build -f apps/api-gateway/Dockerfile .` from the repo root (or
`docker compose -f infra/docker-compose.yml up api-gateway`, which already
points at the right context). It publishes a self-contained runtime image
via `pnpm deploy --prod`, which resolves the workspace dependency into a
real copy rather than a symlink back into `packages/` — the final image
carries nothing from the rest of the monorepo.
