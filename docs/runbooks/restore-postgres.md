# Restore runbook — PostgreSQL (Neon)

Per deployment patch §8.1: verify this at least once before launch using
Neon's branch-based instant-restore feature, not just on paper.

1. In the Neon console, create a new branch from a point in time before the
   incident.
2. Point a scratch connection string at the new branch; confirm the data
   looks correct.
3. If confirmed, promote the branch or repoint DATABASE_URL at it.
4. Record the actual time this took — that's your real RTO, not the target.
