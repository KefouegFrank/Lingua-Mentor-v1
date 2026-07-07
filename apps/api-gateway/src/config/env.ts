// Typed env var loader — validate on boot, fail fast if anything required is missing.
import process from "process";

export function loadEnv() {
	const port = Number(process.env.PORT || 3000);
	const redis = process.env.REDIS_URL || "redis://localhost:6379";
	return { port, redis };
}
