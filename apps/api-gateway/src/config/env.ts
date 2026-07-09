// Typed env var loader — validate on boot, fail fast if anything required is missing.
import process from "process";

export interface Env {
	port: number;
	redisUrl: string;
	databaseUrl: string;
	jwtPrivateKeyPath: string;
	jwtPublicKeyPath: string;
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
	};
}
