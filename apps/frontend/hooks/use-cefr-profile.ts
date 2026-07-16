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

/** Placement (later, exam/voice too) changes the profile server-side — call
 * this after a mutation so the dashboard radar doesn't render a stale one. */
export function useInvalidateCefrProfile() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: CEFR_PROFILE_QUERY_KEY });
}
