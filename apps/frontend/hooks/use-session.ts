"use client";

import { useEffect } from "react";

import { refreshSession as fetchRefreshedSession } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

/**
 * Restores a session on first load: the access token is memory-only, so a hard
 * refresh loses it and the httpOnly cookie has to buy a new one before any
 * route guard renders. Goes through client.ts's deduped refreshSession() so
 * Strict Mode's double-invoked effect can't race itself for a single-use token.
 */
export function useSessionBootstrap(): void {
	const isHydrated = useAuthStore((s) => s.isHydrated);
	const setSession = useAuthStore((s) => s.setSession);

	useEffect(() => {
		if (isHydrated) return;
		let cancelled = false;

		fetchRefreshedSession()
			.then((session) => {
				if (!cancelled) setSession(session.access_token, session.user);
			})
			.catch(() => {
				// No valid cookie — the expected path for a first-time visitor.
			})
			.finally(() => {
				if (!cancelled) useAuthStore.getState().setHydrated();
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}

/** Selector for route guards / nav — waits on hydration so a logged-in user
 * isn't flashed a login redirect on page load. */
export function useSession() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const user = useAuthStore((s) => s.user);
	const isHydrated = useAuthStore((s) => s.isHydrated);
	return { user, isAuthenticated: Boolean(accessToken), isHydrated };
}
