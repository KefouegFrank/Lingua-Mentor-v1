import path from "node:path";

import { defineConfig } from "vitest/config";

// Minimal config: the current suite is pure-function/schema tests with no
// DOM, so the default "node" environment is enough — no jsdom/happy-dom
// dependency until a component-render test actually needs one. The "@/*"
// alias mirrors tsconfig.json's paths entry so specs can import app code
// the same way the app itself does.
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
