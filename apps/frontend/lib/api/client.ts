// Base HTTP layer for every api-gateway call. Two entry points:
//
//   apiFetch            — no auth header, no retry. Used by the handful of
//                          calls that don't carry a bearer token (register,
//                          login, refresh, logout — the refresh token rides
//                          in the httpOnly cookie instead).
//   authenticatedFetch   — injects the current access token and, on a 401,
//                          attempts exactly one silent refresh before
//                          retrying the original call once. This is the
//                          entry point every other api/*.ts module uses.
//
// Both always send `credentials: "include"` — the refresh cookie has to
// travel on every request for the browser to keep it alive, not just on
// /auth/refresh itself.
import type { AuthSession, ErrorEnvelope } from "@/lib/api/types";
import { useAuthStore } from "@/store/auth-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly field?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function parseError(res: Response): Promise<ApiError> {
	try {
		const body = (await res.json()) as ErrorEnvelope;
		return new ApiError(res.status, body.error.code, body.error.message, body.error.field);
	} catch {
		return new ApiError(res.status, "UNKNOWN_ERROR", `Request failed with status ${res.status}`);
	}
}

/** Low-level JSON fetch — no auth header, no retry, throws ApiError on any
 * non-2xx response. `path` is relative to the gateway's base URL. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${BASE_URL}${path}`, {
			...init,
			credentials: "include",
			headers: { "content-type": "application/json", ...(init.headers ?? {}) },
		});
	} catch {
		// DNS/connection failure/CORS block — the gateway is unreachable, not
		// a 4xx the caller did anything wrong to deserve.
		throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
	}

	if (res.status === 204) return undefined as T;
	if (!res.ok) throw await parseError(res);
	return (await res.json()) as T;
}

let refreshInFlight: Promise<AuthSession> | null = null;

/** Refreshes the access token using the httpOnly refresh cookie. Concurrent
 * callers (e.g. three widgets 401-ing at once on an expired token) share one
 * in-flight refresh instead of each rotating the refresh token and
 * invalidating each other's attempt. */
function refreshSession(): Promise<AuthSession> {
	if (!refreshInFlight) {
		refreshInFlight = apiFetch<AuthSession>("/api/v1/auth/refresh", { method: "POST" }).finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}

/** The entry point for every authenticated call. Injects the current bearer
 * token; on a 401 (access token expired mid-session) it attempts one silent
 * refresh and retries the original request once. If the refresh itself
 * fails, the session is cleared and the original 401 propagates — the
 * caller's route guard is what redirects to login, not this layer. */
export async function authenticatedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	const withToken = (token: string | null): RequestInit => ({
		...init,
		headers: { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
	});

	const token = useAuthStore.getState().accessToken;
	try {
		return await apiFetch<T>(path, withToken(token));
	} catch (err) {
		if (!(err instanceof ApiError) || err.status !== 401) throw err;

		try {
			const session = await refreshSession();
			useAuthStore.getState().setSession(session.access_token, session.user);
			return await apiFetch<T>(path, withToken(session.access_token));
		} catch {
			useAuthStore.getState().clearSession();
			throw err; // surface the original 401, not the refresh failure
		}
	}
}
