"""lesson chat state — lesson_sessions + lesson_messages (ADR 0010 s2.1)

PRD s35.3 specifies starting, completing and listing lesson sessions, and s19.4
Layer 7 wants conversation history, but the s29 ERD never drew a table for any
of it. These two are that table.

Revision ID: c3d9a71e5f28
Revises: 8f21c6b4de07
Create Date: 2026-07-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d9a71e5f28'
down_revision: Union[str, None] = '8f21c6b4de07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lesson_sessions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('learner_profile_id', sa.UUID(), nullable=False),
        sa.Column('topic', sa.String(length=200), nullable=True),
        sa.Column('skill_targeted', sa.String(length=30), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['learner_profile_id'], ['learner_profiles.id'],
            name=op.f('fk_lesson_sessions_learner_profile_id_learner_profiles'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_lesson_sessions')),
    )
    # GET /session/history (s35.3) pages newest-first per learner.
    op.create_index(
        'ix_lesson_sessions_learner_started', 'lesson_sessions',
        ['learner_profile_id', 'started_at'], unique=False,
    )

    op.create_table(
        'lesson_messages',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('lesson_session_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        # Null on learner turns; RESTRICT mirrors writing_score_breakdowns —
        # an inference's audit row outlives what it produced (ADR 0007 s2.3).
        sa.Column('ai_model_run_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['lesson_session_id'], ['lesson_sessions.id'],
            name=op.f('fk_lesson_messages_lesson_session_id_lesson_sessions'), ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['ai_model_run_id'], ['ai_model_runs.id'],
            name=op.f('fk_lesson_messages_ai_model_run_id_ai_model_runs'), ondelete='RESTRICT',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_lesson_messages')),
        sa.CheckConstraint("role IN ('learner', 'mentor')", name=op.f('ck_lesson_messages_role')),
    )
    # Layer 7 reads the last N turns of one session, oldest last.
    op.create_index(
        'ix_lesson_messages_session_created', 'lesson_messages',
        ['lesson_session_id', 'created_at'], unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_lesson_messages_session_created', table_name='lesson_messages')
    op.drop_table('lesson_messages')
    op.drop_index('ix_lesson_sessions_learner_started', table_name='lesson_sessions')
    op.drop_table('lesson_sessions')
