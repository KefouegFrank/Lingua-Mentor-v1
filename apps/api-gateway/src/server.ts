import { buildApp } from "./app";

async function main() {
	const app = buildApp();
	const port = Number(process.env.PORT || 3000);
	try {
		await app.listen({ port });
		app.log.info(`Server listening on port ${port}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}

export default main;
