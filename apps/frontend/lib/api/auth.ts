import type { LoginBody, RegisterBody } from "@lingumentor/shared-schemas";

import { apiFetch } from "@/lib/api/client";
import type { AuthSession } from "@/lib/api/types";

// Plain apiFetch: none of these carry a bearer token, and authenticatedFetch
// would recurse through this module.
//
// Refresh has no wrapper here on purpose — use client.ts's refreshSession(),
// which dedupes concurrent callers of the single-use token.

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
