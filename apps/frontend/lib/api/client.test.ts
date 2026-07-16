import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, refreshSession } from "@/lib/api/client";

// One rule under test: a failed refresh only ends the session when the server
// said the token is invalid — not when it failed to answer at all.

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const SESSION_BODY = {
	access_token: "new-access-token",
	user: { id: "u1", email: "learner@example.com" },
};

const ERROR_BODY = (code: string) => ({ error: { code, message: code } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	// Real timers would make the 600ms/1200ms backoff a real 1.8s wait.
	vi.useFakeTimers();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/** Runs `p` to settle while draining the backoff timers it waits on. */
async function settle<T>(p: Promise<T>): Promise<T> {
	const result = p.then(
		(v) => ({ ok: true as const, v }),
		(e) => ({ ok: false as const, e }),
	);
	await vi.runAllTimersAsync();
	const outcome = await result;
	if (!outcome.ok) throw outcome.e;
	return outcome.v;
}

describe("refreshSession", () => {
	it("retries a 500 and succeeds once the database is awake", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(500, ERROR_BODY("INTERNAL_ERROR")))
			.mockResolvedValueOnce(jsonResponse(200, SESSION_BODY));

		const session = await settle(refreshSession());

		expect(session.access_token).toBe("new-access-token");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries a network failure — the reload-during-cold-start path", async () => {
		fetchMock
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(jsonResponse(200, SESSION_BODY));

		const session = await settle(refreshSession());

		expect(session.access_token).toBe("new-access-token");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry a 401 — a rejected single-use token cannot become valid", async () => {
		fetchMock.mockResolvedValue(jsonResponse(401, ERROR_BODY("INVALID_REFRESH_TOKEN")));

		await expect(settle(refreshSession())).rejects.toMatchObject({
			status: 401,
			code: "INVALID_REFRESH_TOKEN",
		});
		// Exactly one call: retrying here would only delay the login redirect.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("gives up after the retry budget and surfaces the last error", async () => {
		fetchMock.mockResolvedValue(jsonResponse(500, ERROR_BODY("INTERNAL_ERROR")));

		await expect(settle(refreshSession())).rejects.toBeInstanceOf(ApiError);
		// Initial attempt + REFRESH_TRANSIENT_RETRIES(2) — bounded, not infinite.
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("dedupes concurrent callers across the backoff into one attempt sequence", async () => {
		fetchMock
			.mockResolvedValueOnce(jsonResponse(500, ERROR_BODY("INTERNAL_ERROR")))
			.mockResolvedValueOnce(jsonResponse(200, SESSION_BODY));

		// The shape of Strict Mode's double-invoked mount effect: a second caller
		// lands mid-backoff and would otherwise consume the same single-use token.
		const both = Promise.all([refreshSession(), refreshSession()]);
		const [a, b] = await settle(both);

		expect(a.access_token).toBe("new-access-token");
		expect(b).toEqual(a);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
