# worker

Python / arq background job consumer, backed by Redis. Handles long-running
work that shouldn't block a request/response cycle or a voice turn: essay
scoring pipeline, appeal re-evaluation, nightly SRS batch generation,
calibration recompute.

Queue names should match what api-gateway and ai-service enqueue against —
keep `app/tasks/` filenames aligned 1:1 with queue names for easy tracing.
