// Typed env var loader — validate on boot, fail fast if anything required is missing.
import process from "process";

export interface Env {
	port: number;
	redisUrl: string;
	databaseUrl: string;
	jwtPrivateKeyPath: string;
	jwtPublicKeyPath: string;
	enforceCalibrationGate: boolean;
	aiServiceUrl: string;
	// Comma-separated allowlist of browser origins allowed to call this API
	// with credentials (the refresh cookie). Wildcard "*" is rejected by the
	// CORS spec once credentials are involved, so this must be explicit.
	corsOrigins: string[];
}

export function loadEnv(): Env {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required (Neon connection string — see .env.example)");
	}
	const jwtPrivateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
	const jwtPublicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
	if (!jwtPrivateKeyPath || !jwtPublicKeyPath) {
		throw new Error(
			"JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH are required — run scripts/generate-jwt-keys.sh",
		);
	}
	return {
		port: Number(process.env.PORT || 3000),
		redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
		databaseUrl,
		jwtPrivateKeyPath,
		jwtPublicKeyPath,
		// Phase 0 gate (Calibration Brief §9): withhold AI band scores produced
		// without an active calibration baseline. Fail-closed — a safety gate
		// that defaulted off would ship the exact thing it exists to prevent.
		// Dev sets ENFORCE_CALIBRATION_GATE=false to see provisional scores.
		enforceCalibrationGate: process.env.ENFORCE_CALIBRATION_GATE !== "false",
		// Synchronous calls to the Python evaluation service (placement scoring).
		// Same var the worker uses; :8000 is the ai-service container's port.
		aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
		// Default matches the frontend's local dev port (next dev -p 3001) —
		// see apps/frontend/package.json. Production sets this explicitly.
		corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3001")
			.split(",")
			.map((o) => o.trim())
			.filter(Boolean),
	};
}
