// Conventional commits, narrowed: extends config-conventional (bodies stay
// optional) and restricts `type`/`scope` to what this repo actually uses.
module.exports = {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"header-max-length": [2, "always", 100],
		"type-enum": [
			2,
			"always",
			[
				// feat/fix/docs are in use; the rest are standard types kept available.
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
				// Per-domain request boundary: gateway modules + ai-service routers.
				"auth",
				"users",
				"placement",
				"writing",
				"appeal",
				"voice",
				"exam-simulation",
				"billing",
				// Whole-service scopes — a commit touching a service, not one module.
				"gateway",
				"frontend",
				"worker",
				"ai-service",
				// ai-service/worker subsystems with no 1:1 gateway route.
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
