import { useQuery } from "@tanstack/react-query";

import { listExams } from "@/lib/api/writing";

/** Shared across the registration exam picker and the writing practice
 * submission form — one query key, one cache entry, no duplicate fetches
 * when both mount in the same session. */
export function useExams() {
	return useQuery({
		queryKey: ["exams"],
		queryFn: listExams,
		// Rubric config changes roughly never at runtime — cache aggressively.
		staleTime: 10 * 60_000,
	});
}
