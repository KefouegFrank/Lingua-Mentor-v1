import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/api/user";
import { useSession } from "@/hooks/use-session";

/** The full profile, unlike the lighter PublicUser in the auth store. Gated on
 * hydration so it can't fire before the token is restored. */
export function useMe() {
	const { isAuthenticated, isHydrated } = useSession();
	return useQuery({
		queryKey: ["me"],
		queryFn: getMe,
		enabled: isHydrated && isAuthenticated,
		staleTime: 60_000,
	});
}
