// Each app pins its own ESLint major version (api-gateway: 9/flat-config,
// frontend: 8/.eslintrc — see apps/frontend/next.config.js for why) — so
// staged files have to be linted with *that app's own* locally-installed
// `eslint` binary, not a single repo-root one. `pnpm --filter <app> exec`
// resolves node_modules/.bin/eslint inside the right app, which also makes
// each app's config-file lookup (flat config vs .eslintrc) resolve to the
// version that actually understands it.
//
// Scope is deliberately limited to apps/api-gateway and apps/frontend —
// the two packages that have a working ESLint config. packages/* has no
// lint setup yet (out of scope for this pass); adding it here would just
// make every commit touching shared-schemas fail on a missing config.
export default {
	"apps/api-gateway/**/*.{ts,tsx}": (files) =>
		`pnpm --filter api-gateway exec eslint --fix ${files.join(" ")}`,
	"apps/frontend/**/*.{ts,tsx,js,jsx}": (files) =>
		`pnpm --filter frontend exec eslint --fix ${files.join(" ")}`,
};
