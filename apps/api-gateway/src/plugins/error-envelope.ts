// Global error envelope (Master PRD §34.1): every error response, from any
// route, is {"error": {"code", "message", "field"?}} — mirrored by
// ai-service's app/core/errors.py so clients parse one shape platform-wide.
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodIssue } from "zod";

export class AppError extends Error {
	constructor(
		public readonly statusCode: number,
		public readonly code: string,
		message: string,
		public readonly field?: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

interface ErrorEnvelope {
	error: { code: string; message: string; field?: string };
}

function envelope(code: string, message: string, field?: string): ErrorEnvelope {
	return { error: { code, message, ...(field ? { field } : {}) } };
}

/**
 * Structural check instead of `instanceof ZodError`. Schemas built in
 * @lingumentor/shared-schemas and schemas built directly in this app both
 * throw zod's error class, but they don't reliably share the exact same
 * class reference — the workspace package boundary (and, separately,
 * Vitest's per-file module graph) can load zod as two distinct module
 * instances even though both resolve to the same installed version.
 * `instanceof` breaks in exactly that situation; checking `name` + `issues`
 * doesn't, because it doesn't care which zod instance produced the error.
 */
function isZodError(err: unknown): err is { name: "ZodError"; issues: ZodIssue[] } {
	return (
		typeof err === "object" &&
		err !== null &&
		(err as { name?: unknown }).name === "ZodError" &&
		Array.isArray((err as { issues?: unknown }).issues)
	);
}

/**
 * A Fastify-generated error that blames the request, not the server — it
 * carries both an `FST_*` code and its own 4xx status. Checked structurally
 * (like isZodError above) rather than with `instanceof`, for the same
 * module-duplication reasons.
 */
function isClientFastifyError(err: unknown): err is FastifyError & { statusCode: number } {
	if (typeof err !== "object" || err === null) return false;
	const { code, statusCode } = err as { code?: unknown; statusCode?: unknown };
	return (
		typeof code === "string" &&
		code.startsWith("FST_") &&
		typeof statusCode === "number" &&
		statusCode >= 400 &&
		statusCode < 500
	);
}

/**
 * Called directly from buildApp rather than via app.register: Fastify v5
 * encapsulates setErrorHandler/setNotFoundHandler to the registering plugin's
 * scope, and this envelope must apply to every route in the app.
 */
export function registerErrorEnvelope(app: FastifyInstance): void {
	app.setErrorHandler((err: unknown, request: FastifyRequest, reply: FastifyReply) => {
		if (err instanceof AppError) {
			return reply.status(err.statusCode).send(envelope(err.code, err.message, err.field));
		}
		if (isZodError(err)) {
			const issue = err.issues[0];
			const field = issue?.path.join(".") || undefined;
			return reply
				.status(400)
				.send(envelope("VALIDATION_ERROR", issue?.message ?? "invalid request", field));
		}
		if (err instanceof Error && "validation" in err && (err as FastifyError).validation) {
			return reply.status(400).send(envelope("VALIDATION_ERROR", err.message));
		}
		// Fastify's own request-level errors — malformed JSON, a JSON
		// content-type with an empty body, payload too large — already carry an
		// accurate 4xx status and a machine-readable FST_* code. They describe a
		// bad request, not a server fault, so they must not fall through to the
		// 500 branch below: reporting a client mistake as "internal server
		// error" sends whoever is debugging it in exactly the wrong direction.
		// 5xx FST_* codes are genuine server faults and deliberately fall through.
		if (isClientFastifyError(err)) {
			return reply.status(err.statusCode).send(envelope(err.code, err.message));
		}
		// Unknown error: log the real thing, never leak internals to the client.
		request.log.error({ err }, "unhandled error");
		return reply.status(500).send(envelope("INTERNAL_ERROR", "internal server error"));
	});

	app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
		reply
			.status(404)
			.send(envelope("NOT_FOUND", `route ${request.method} ${request.url} not found`));
	});
}
