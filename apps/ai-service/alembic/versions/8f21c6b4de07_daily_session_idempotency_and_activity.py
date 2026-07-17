"""daily session idempotency + last_active_at (ADR 0009 s2.3, s2.4)

Two gaps the daily micro-session needs closed.

`daily_sessions` had only a non-unique index on (learner_profile_id,
session_date), so the 2AM batch and an on-demand request could each write a row
for the same learner and day. The UNIQUE constraint is what makes the endpoint
idempotent; prose in an ADR is not.

`users.last_active_at` exists because `last_login_at` cannot answer "did this
learner open the app recently" — opening it runs the silent refresh, which never
touched that column, and refresh tokens rotate indefinitely.

Revision ID: 8f21c6b4de07
Revises: 2c94f9f4d576
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8f21c6b4de07'
down_revision: Union[str, None] = '2c94f9f4d576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))
    # Backfill from the only prior signal; NULL where a user never logged in.
    op.execute("UPDATE users SET last_active_at = last_login_at WHERE last_login_at IS NOT NULL")

    # Collapse any pre-existing duplicates before the constraint can reject them.
    # Keeps the earliest row per learner-day: it owns the ai_model_run the
    # learner's session actually ran under.
    op.execute(
        """
        DELETE FROM daily_sessions ds
        USING daily_sessions keep
        WHERE ds.learner_profile_id = keep.learner_profile_id
          AND ds.session_date = keep.session_date
          AND ds.created_at > keep.created_at
        """
    )
    op.create_unique_constraint(
        'uq_daily_sessions_learner_date', 'daily_sessions', ['learner_profile_id', 'session_date']
    )


def downgrade() -> None:
    op.drop_constraint('uq_daily_sessions_learner_date', 'daily_sessions', type_='unique')
    op.drop_column('users', 'last_active_at')
