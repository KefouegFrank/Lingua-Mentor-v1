// WebSocket connection handling for live voice sessions.
// Keep all synchronous/CPU-heavy work OUT of this file's hot path —
// see deployment patch §2.2 and §6.2 for why this module must stay isolated.
