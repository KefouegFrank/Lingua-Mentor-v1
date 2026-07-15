// Enforces this repo's established convention — visible across the whole
// git history — of a single-line `type(scope): imperative, lowercase
// description`. @commitlint/config-conventional already doesn't require a
// body (its rules only fire when a body/footer is present), so extending it
// is enough to keep bodies optional; the two customizations below narrow
// `type` and `scope` to what this team actually uses instead of the full
// generic conventional-commits catalogue.
module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"header-max-length": [2, "always", 100],
		"type-enum": [
			2,
			"always",
			[
				// Observed in git log: feat, fix, docs. The rest are the standard
				// conventional-commits types kept available for the kinds of
				// changes this history hasn't needed yet (e.g. this QA pass would
				// have been a "chore" or "test" commit).
				"feat",
				"fix",
				"docs",
				"chore",
				"refactor",
				"test",
				"perf",
				"style",
				"build",
				"ci",
			],
		],
		"scope-enum": [
			2,
			"always",
			[
				// apps/api-gateway/src/modules/* and apps/ai-service's routers —
				// the request-handling boundary for each domain.
				"auth",
				"users",
				"placement",
				"writing",
				"appeal",
				"voice",
				"exam-simulation",
				"billing",
				// Cross-cutting service/app names — commits that touch a whole
				// service rather than one domain module (gateway config, CORS,
				// the Next.js app shell, worker wiring, etc).
				"gateway",
				"frontend",
				"worker",
				"ai-service",
				// AI-service/worker subsystems that aren't 1:1 with a gateway
				// route: calibration harness + Phase 0 gate, the async writing
				// pipeline (BullMQ producer/consumer wiring), adaptive learning,
				// readiness prediction, spaced-repetition scheduling.
				"calibration",
				"pipeline",
				"adaptive-learning",
				"readiness",
				"srs",
				// Shared workspace packages and repo-wide concerns.
				"shared-schemas",
				"infra",
				"deps",
			],
		],
	},
};
