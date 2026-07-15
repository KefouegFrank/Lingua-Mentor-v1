import { buildApp } from "./app";

async function main() {
	const app = buildApp();
	const port = Number(process.env.PORT || 3000);

	// Finish in-flight requests, close the queue connection and pg pool
	// (onClose hook in app.ts) before the process exits. The handler itself
	// must stay non-async — Node's signal listener type is void-returning,
	// so an async listener here would turn a rejected close() into an
	// unhandled rejection instead of the clean, logged non-zero exit below.
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
	// A synchronous throw inside main() before its own try/catch is set up
	// (e.g. loadEnv() rejecting on missing config) would otherwise reject
	// main()'s promise with nothing attached to observe it.
	main().catch((err: unknown) => {
		console.error(err);
		process.exit(1);
	});
}

export default main;
