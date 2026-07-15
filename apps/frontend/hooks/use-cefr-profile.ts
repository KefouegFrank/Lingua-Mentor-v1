import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCefrProfile } from "@/lib/api/user";
import { useSession } from "@/hooks/use-session";

export const CEFR_PROFILE_QUERY_KEY = ["cefr-profile"] as const;

export function useCefrProfile() {
	const { isAuthenticated, isHydrated } = useSession();
	return useQuery({
		queryKey: CEFR_PROFILE_QUERY_KEY,
		queryFn: getCefrProfile,
		enabled: isHydrated && isAuthenticated,
		staleTime: 30_000,
	});
}

/** Placement (and, later, exam/voice sessions) change the profile server-side
 * — callers invalidate this after a mutation succeeds so the dashboard radar
 * reflects it on next render instead of showing a stale cached profile. */
export function useInvalidateCefrProfile() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: CEFR_PROFILE_QUERY_KEY });
}
