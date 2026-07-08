// Global error envelope (Master PRD §34.1): every error response, from any
// route, is {"error": {"code", "message", "field"?}} — mirrored by
// ai-service's app/core/errors.py so clients parse one shape platform-wide.
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

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
 * Called directly from buildApp rather than via app.register: Fastify v5
 * encapsulates setErrorHandler/setNotFoundHandler to the registering plugin's
 * scope, and this envelope must apply to every route in the app.
 */
export function registerErrorEnvelope(app: FastifyInstance): void {
	app.setErrorHandler(
		(err: FastifyError | AppError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
			if (err instanceof AppError) {
				return reply.status(err.statusCode).send(envelope(err.code, err.message, err.field));
			}
			if (err instanceof ZodError) {
				const issue = err.issues[0];
				const field = issue?.path.join(".") || undefined;
				return reply
					.status(400)
					.send(envelope("VALIDATION_ERROR", issue?.message ?? "invalid request", field));
			}
			if ("validation" in err && err.validation) {
				return reply.status(400).send(envelope("VALIDATION_ERROR", err.message));
			}
			// Unknown error: log the real thing, never leak internals to the client.
			request.log.error({ err }, "unhandled error");
			return reply.status(500).send(envelope("INTERNAL_ERROR", "internal server error"));
		},
	);

	app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
		reply
			.status(404)
			.send(envelope("NOT_FOUND", `route ${request.method} ${request.url} not found`));
	});
}
