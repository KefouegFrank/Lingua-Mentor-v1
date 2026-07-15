import type { LoginBody, RegisterBody } from "@lingumentor/shared-schemas";

import { apiFetch } from "@/lib/api/client";
import type { AuthSession } from "@/lib/api/types";

// None of these carry a bearer token — register/login mint one, logout only
// needs the cookie too. Plain apiFetch, not authenticatedFetch (which would
// recurse through this module).
//
// Refresh deliberately has no plain wrapper here: the refresh token is
// single-use (server-side GETDEL rotation), so any caller invoking
// POST /auth/refresh directly — bypassing the in-flight-request dedup —
// risks a second concurrent call losing the rotation race for no reason.
// Use client.ts's exported refreshSession() instead, always.

export function register(body: RegisterBody): Promise<AuthSession> {
	return apiFetch<AuthSession>("/api/v1/auth/register", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function login(body: LoginBody): Promise<AuthSession> {
	return apiFetch<AuthSession>("/api/v1/auth/login", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function logout(): Promise<void> {
	return apiFetch<void>("/api/v1/auth/logout", { method: "POST" });
}
