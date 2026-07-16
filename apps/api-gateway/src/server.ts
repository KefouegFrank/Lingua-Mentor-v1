import { buildApp } from "./app";

async function main() {
	const app = buildApp();
	const port = Number(process.env.PORT || 3000);

	// Drain in-flight requests, then close queue/pool (onClose in app.ts). Keep
	// non-async: Node types the listener void, so a rejected close() would escape.
	for (const signal of ["SIGTERM", "SIGINT"] as const) {
		process.once(signal, () => {
			app.log.info({ signal }, "shutting down");
			app.close().then(
				() => process.exit(0),
				(err: unknown) => {
					app.log.error(err);
					process.exit(1);
				},
			);
		});
	}

	try {
		await app.listen({ port, host: "0.0.0.0" });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

if (require.main === module) {
	// main() can throw before its own try/catch exists (loadEnv on bad config).
	main().catch((err: unknown) => {
		console.error(err);
		process.exit(1);
	});
}

export default main;
