import { buildApp } from "./app";

async function main() {
	const app = buildApp();
	const port = Number(process.env.PORT || 3000);

	// Finish in-flight requests, close the queue connection and pg pool
	// (onClose hook in app.ts) before the process exits.
	for (const signal of ["SIGTERM", "SIGINT"] as const) {
		process.once(signal, async () => {
			app.log.info({ signal }, "shutting down");
			await app.close();
			process.exit(0);
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
	main();
}

export default main;
