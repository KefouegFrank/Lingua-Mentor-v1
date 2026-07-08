// Typed env var loader — validate on boot, fail fast if anything required is missing.
import process from "process";

export interface Env {
	port: number;
	redisUrl: string;
	databaseUrl: string;
}

export function loadEnv(): Env {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required (Neon connection string — see .env.example)");
	}
	return {
		port: Number(process.env.PORT || 3000),
		redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
		databaseUrl,
	};
}
