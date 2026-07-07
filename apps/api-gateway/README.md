# api-gateway

Node.js / Fastify. Handles REST, SSE, and voice-WebSocket traffic.

Voice-session handling lives entirely in `src/modules/voice/` so that the
future REST/voice-WS process split (deployment patch §2.2, §6.2) is a
process-launch config change, not a refactor. Do not import voice-module
code from other modules' hot paths.
