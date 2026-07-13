"""add 'failed' to appeal_status enum (PRD s37.4 appeal error handling)

A secondary evaluation that errors out must surface as a failure the learner
can see and retry — not sit at 'processing' forever. Additive-only, per the
Phase 1 migration rule (PRD s28.2).

Revision ID: d1574d4bd57e
Revises: b93033f9cc0b
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd1574d4bd57e'
down_revision: Union[str, None] = 'b93033f9cc0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PG 12+ allows ADD VALUE inside a transaction as long as the type wasn't
    # created in the same transaction; the value is usable after commit.
    op.execute("ALTER TYPE appeal_status ADD VALUE IF NOT EXISTS 'failed'")


def downgrade() -> None:
    # Postgres cannot drop an enum value. Rows never reach 'failed' again once
    # the app-level enum loses it, so leaving the value in place is harmless.
    pass
