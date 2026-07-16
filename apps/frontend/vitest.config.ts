import path from "node:path";

import { defineConfig } from "vitest/config";

// "node" environment: the suite is pure-function/schema tests, no DOM yet. The
// "@/*" alias mirrors tsconfig so specs import app code the way the app does.
export default defineConfig({
	test: {
		environment: "node",
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
