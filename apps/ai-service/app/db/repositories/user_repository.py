"""asyncpg queries for users/learner_profiles — runtime data-access path.

User *writes* (register, login bookkeeping) belong to api-gateway's auth
module; this service only reads identity/profile state it needs for
evaluation context (accent target, exam target, CEFR profile).
"""

from uuid import UUID

import asyncpg


async def get_learner_profile(
    conn: asyncpg.Connection, learner_profile_id: UUID
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, user_id, target_language, target_exam, target_band_score,
               exam_date, accent_target, default_persona, active_track,
               cefr_speaking, cefr_listening, cefr_reading, cefr_writing,
               placement_completed_at, voice_consent_given,
               onboarding_completed, weakness_tags
        FROM learner_profiles
        WHERE id = $1
        """,
        learner_profile_id,
    )


async def get_learner_profile_by_user(
    conn: asyncpg.Connection, user_id: UUID
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        "SELECT * FROM learner_profiles WHERE user_id = $1", user_id
    )
