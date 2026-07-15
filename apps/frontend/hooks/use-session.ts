"use client";

import { useEffect } from "react";

import { refreshSession as fetchRefreshedSession } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

/**
 * Restores a session on first load. The access token lives only in memory
 * (store/auth-store.ts), so a hard page refresh loses it — this silently
 * exchanges the httpOnly refresh cookie (if one is still valid) for a fresh
 * access token before the app renders any route guard. Runs exactly once —
 * or would, if React 18 Strict Mode didn't double-invoke mount effects in
 * dev. Routing through client.ts's deduped refreshSession() (not a direct
 * POST /auth/refresh call) means the second invocation reuses the first
 * call's in-flight promise instead of racing it: the refresh token is
 * single-use, so two real network calls here always produced one clean
 * success and one 401 for the loser — annoying, and a needless failure
 * mode to leave lying around when the fix is "don't send two."
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
				// No valid refresh cookie (never logged in, or it expired) — this
				// is the expected path for a first-time visitor, not an error.
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

/** Convenience selector for route guards / nav — waits for hydration so a
 * logged-in user is never flashed a login redirect on page load. */
export function useSession() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const user = useAuthStore((s) => s.user);
	const isHydrated = useAuthStore((s) => s.isHydrated);
	return { user, isAuthenticated: Boolean(accessToken), isHydrated };
}
