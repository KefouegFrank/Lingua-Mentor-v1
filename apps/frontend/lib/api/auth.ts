import type { LoginBody, RegisterBody } from "@lingumentor/shared-schemas";

import { apiFetch } from "@/lib/api/client";
import type { AuthSession } from "@/lib/api/types";

// None of these carry a bearer token — register/login mint one, refresh
// rotates via the httpOnly cookie, logout only needs the cookie too. Plain
// apiFetch, not authenticatedFetch (which would recurse through this module).

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

export function refresh(): Promise<AuthSession> {
	return apiFetch<AuthSession>("/api/v1/auth/refresh", { method: "POST" });
}

export function logout(): Promise<void> {
	return apiFetch<void>("/api/v1/auth/logout", { method: "POST" });
}
