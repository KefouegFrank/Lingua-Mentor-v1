import Fastify from "fastify";

export function buildApp() {
	const app = Fastify({ logger: true });

	// Basic health endpoint used by the frontend and infra checks
	app.get("/health", async (_request, _reply) => {
		return { status: "ok", uptime: process.uptime() };
	});

	// Mount additional modules here (routes, plugins)
	// e.g. app.register(import('./modules/yourModule'))

	return app;
}
