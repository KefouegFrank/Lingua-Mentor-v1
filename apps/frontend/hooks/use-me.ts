import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/api/user";
import { useSession } from "@/hooks/use-session";

/** The full profile (target exam, accent, persona, tier) — distinct from
 * the lighter PublicUser already held in the auth store, which only carries
 * what register/login return. Gated on session hydration so it never fires
 * a request with a token that hasn't been restored yet. */
export function useMe() {
	const { isAuthenticated, isHydrated } = useSession();
	return useQuery({
		queryKey: ["me"],
		queryFn: getMe,
		enabled: isHydrated && isAuthenticated,
		staleTime: 60_000,
	});
}
