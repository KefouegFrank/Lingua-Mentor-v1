// ESLint 9 flat config for the Fastify/Node gateway.
//
// Type-aware rules (no-floating-promises, no-misused-promises) are the
// actual point of this config — this service is all async route handlers,
// queue producers and DB calls, and a dropped promise here is a silently
// unhandled rejection in production, not a lint nitpick. Everything else is
// deliberately lightweight (early-stage codebase, no house style enforced
// yet beyond what the compiler already demands via tsconfig's `strict`).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		// Build output and dependency trees never get linted.
		ignores: ["dist/**", "node_modules/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Unused vars are almost always a leftover from a refactor, not
			// intentional — but a leading underscore stays legal for the
			// Fastify handler params this codebase declines to use
			// (see `_request, _reply` in app.ts's /health route).
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			// The real payoff of type-aware linting for this service — an
			// un-awaited query or queue.add() fails silently instead of
			// surfacing as a rejected response or a stalled job.
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
			// Early-stage service, still finding its shape: these
			// type-checked-strictness rules fire on patterns that are
			// deliberate here (e.g. `unknown` DB rows narrowed manually in
			// repositories) rather than bugs. Revisit once the data layer
			// settles instead of fighting the linter on every query today.
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			// Every repository converts Postgres rows (typed loosely as
			// Record<string, unknown> — see db/client.ts's Queryable) to DTOs
			// via `String(row.some_column)` after a null check. The values are
			// always primitives at runtime (Postgres has no method that would
			// produce '[object Object]'); the rule can't see that through
			// `unknown`, so it fires on this convention everywhere it's used.
			"@typescript-eslint/no-base-to-string": "off",
			// `interface X extends Y {}` shows up in this codebase purely to
			// carry a doc comment on an otherwise-identical alias (see
			// FakeDb-style test fakes) — not the empty-interface footgun the
			// rule exists to catch.
			"@typescript-eslint/no-empty-object-type": "off",
			// Fastify plugin functions (FastifyPluginAsync) and preHandler
			// hooks are conventionally `async` by framework contract even
			// when a given route/hook body has no internal `await` — see
			// auth.routes.ts, users.routes.ts, writing.routes.ts,
			// placement.routes.ts, and requireRoleHook in authenticate.ts.
			"@typescript-eslint/require-await": "off",
		},
	},
	{
		// Test files get the same type-aware rules minus the promise-safety
		// ones that fight vitest's fire-and-forget helpers and `expect()`
		// chains too often to be worth it.
		files: ["test/**/*.ts"],
		rules: {
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-misused-promises": "off",
		},
	},
);
