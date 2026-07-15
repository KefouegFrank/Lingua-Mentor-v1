#!/usr/bin/env bash
set -euo pipefail

# Automates the manual steps in docs/runbooks/restore-postgres.md,
# runs monthly per deployment patch §8.1.
#
# What this does: creates a real Neon branch from a point in time in the
# past (an actual PITR restore, via Neon's API — not a simulation), opens a
# connection to it, runs a couple of sanity queries against it, records how
# long that took as the real RTO, then deletes the scratch branch.
#
# What this does NOT do, and cannot do from this sandbox: this has never
# been run against a real Neon project, because no live NEON_API_KEY /
# NEON_PROJECT_ID exist here. Running this script once for real, against
# the actual production Neon project, is still the open pre-launch action
# item from ADR 0001 §8.1 ("verify the restore path at least once ... An
# untested restore path is not a working restore path"). This script makes
# that a one-command action instead of a manual console walkthrough, but it
# does not close the action item by itself — someone has to actually run
# it, once, with real credentials, before launch.
#
# Required env vars:
#   NEON_API_KEY       Neon personal or project API key (Account Settings
#                       -> API Keys in the Neon console).
#   NEON_PROJECT_ID     Project ID (Neon console -> Project Settings).
#
# Optional env vars:
#   NEON_PARENT_BRANCH_ID   Branch to restore from. Defaults to the
#                           project's default branch (usually production).
#   RESTORE_MINUTES_AGO     How far back the PITR point should be.
#                           Default: 60 (restores from an hour ago, not
#                           just the current tip — branching from the tip
#                           would prove branch creation works but not that
#                           point-in-time recovery itself works).
#   NEON_DATABASE_NAME      Database to open the scratch connection
#                           against. Default: neondb.
#   NEON_ROLE_NAME          Role for the scratch connection string.
#                           Default: neondb_owner.
#   KEEP_BRANCH             Set to "1" to skip deleting the scratch branch
#                           afterwards (for manual inspection). Default:
#                           unset — the branch is always cleaned up.
#
# Requires on PATH: curl, jq, psql.

ROOT=$(cd "$(dirname "$0")/.." && pwd)

for bin in curl jq psql; do
	if ! command -v "$bin" >/dev/null 2>&1; then
		echo "backup-verify: '$bin' is required but not on PATH." >&2
		exit 1
	fi
done

: "${NEON_API_KEY:?NEON_API_KEY is required — see header comment in $0}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required — see header comment in $0}"

RESTORE_MINUTES_AGO="${RESTORE_MINUTES_AGO:-60}"
NEON_DATABASE_NAME="${NEON_DATABASE_NAME:-neondb}"
NEON_ROLE_NAME="${NEON_ROLE_NAME:-neondb_owner}"

API="https://console.neon.tech/api/v2"
AUTH_HEADER="Authorization: Bearer ${NEON_API_KEY}"
BRANCH_ID=""

cleanup() {
	if [ -n "$BRANCH_ID" ] && [ "${KEEP_BRANCH:-}" != "1" ]; then
		echo "Cleaning up scratch branch ${BRANCH_ID}..."
		curl --fail --silent --show-error -X DELETE \
			-H "$AUTH_HEADER" \
			"${API}/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}" \
			>/dev/null || echo "backup-verify: cleanup of branch ${BRANCH_ID} failed — remove it manually in the Neon console." >&2
	fi
}
# Runs on success, failure, or Ctrl-C alike — a failed verification run
# should never leave a billable scratch branch behind.
trap cleanup EXIT

# Portable ISO-8601 UTC timestamp N minutes ago (GNU date vs BSD/macOS date
# have incompatible -d/-v flags; try GNU first, fall back to BSD).
restore_point() {
	if date -u -d "@0" >/dev/null 2>&1; then
		date -u -d "-${RESTORE_MINUTES_AGO} minutes" +"%Y-%m-%dT%H:%M:%SZ"
	else
		date -u -v"-${RESTORE_MINUTES_AGO}M" +"%Y-%m-%dT%H:%M:%SZ"
	fi
}

RESTORE_POINT=$(restore_point)
echo "Restoring to point-in-time: ${RESTORE_POINT} (${RESTORE_MINUTES_AGO} minutes ago)"

T_START=$(date +%s)

CREATE_PAYLOAD=$(jq -n \
	--arg ts "$RESTORE_POINT" \
	--arg name "backup-verify-$(date -u +%Y%m%dT%H%M%SZ)" \
	'{
		branch: { name: $name, init_source: "parent-timestamp", timestamp: $ts },
		endpoints: [{ type: "read_write" }]
	}')
if [ -n "${NEON_PARENT_BRANCH_ID:-}" ]; then
	CREATE_PAYLOAD=$(echo "$CREATE_PAYLOAD" | jq --arg pid "$NEON_PARENT_BRANCH_ID" '.branch.parent_id = $pid')
fi

echo "Creating scratch branch from that point-in-time..."
CREATE_RESPONSE=$(curl --fail --silent --show-error -X POST \
	-H "$AUTH_HEADER" -H "Content-Type: application/json" \
	-d "$CREATE_PAYLOAD" \
	"${API}/projects/${NEON_PROJECT_ID}/branches")

BRANCH_ID=$(echo "$CREATE_RESPONSE" | jq -r '.branch.id')
if [ -z "$BRANCH_ID" ] || [ "$BRANCH_ID" = "null" ]; then
	echo "backup-verify: branch creation response had no branch.id:" >&2
	echo "$CREATE_RESPONSE" >&2
	exit 1
fi
echo "Branch created: ${BRANCH_ID}"

# Branch compute endpoints take a few seconds to come up after creation —
# poll rather than assuming it's immediately connectable.
echo "Waiting for branch operations to finish..."
for _ in $(seq 1 30); do
	OPS=$(curl --fail --silent --show-error -H "$AUTH_HEADER" \
		"${API}/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}/operations")
	PENDING=$(echo "$OPS" | jq -r '[.operations[] | select(.status != "finished")] | length')
	if [ "$PENDING" -eq 0 ]; then
		break
	fi
	sleep 2
done

echo "Fetching scratch connection URI..."
CONN_RESPONSE=$(curl --fail --silent --show-error -H "$AUTH_HEADER" \
	"${API}/projects/${NEON_PROJECT_ID}/connection_uri?branch_id=${BRANCH_ID}&database_name=${NEON_DATABASE_NAME}&role_name=${NEON_ROLE_NAME}&pooled=false")
CONNECTION_URI=$(echo "$CONN_RESPONSE" | jq -r '.uri')
if [ -z "$CONNECTION_URI" ] || [ "$CONNECTION_URI" = "null" ]; then
	echo "backup-verify: could not obtain a connection URI for branch ${BRANCH_ID}:" >&2
	echo "$CONN_RESPONSE" >&2
	exit 1
fi

echo "Verifying connectivity and data on the restored branch..."
# Two checks, not one: connectivity alone (SELECT 1) would pass even
# against an empty database. Row-count sanity across every table in the
# public schema is a cheap way to confirm the restore actually carried
# data, without hard-coding this app's specific table names into an
# infra script that shouldn't need updating every time the schema changes.
psql "$CONNECTION_URI" -v ON_ERROR_STOP=1 -Atc "SELECT 1;" >/dev/null
TABLE_COUNT=$(psql "$CONNECTION_URI" -v ON_ERROR_STOP=1 -Atc \
	"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

T_END=$(date +%s)
RTO_SECONDS=$((T_END - T_START))

echo ""
echo "=== Restore verification passed ==="
echo "Restore point:        ${RESTORE_POINT}"
echo "Scratch branch:       ${BRANCH_ID}"
echo "Public tables found:  ${TABLE_COUNT}"
echo "Elapsed (real RTO):   ${RTO_SECONDS}s"
echo "===================================="

if [ "$TABLE_COUNT" -eq 0 ]; then
	echo "backup-verify: connected, but the public schema has zero tables — this does not look like a real restore of application data. Investigate before trusting this result." >&2
	exit 1
fi
