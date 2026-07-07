# ai-service

Python / FastAPI. Hosts the five AI engines (voice agent, writing evaluation,
exam simulation, adaptive learning, readiness prediction) plus the calibration
pipeline (Phase 0, already built — see `app/calibration/`).

## DB access pattern — read this before adding a query

- `app/db/models/` — SQLAlchemy ORM models. These exist ONLY as the source
  Alembic reads to autogenerate migrations. Do not query through them at runtime.
- `app/db/repositories/` — asyncpg raw queries. This is the actual runtime
  data-access path. All scores are stored as NUMERIC(4,2); match that in
  every query that touches a score column.

## Providers

`app/providers/` wraps every external LLM/STT/TTS vendor behind a common
interface (`base.py` in each subfolder) so a provider swap (e.g. Groq → another
LLM vendor, gTTS → ElevenLabs in Phase 2) never touches engine code.
