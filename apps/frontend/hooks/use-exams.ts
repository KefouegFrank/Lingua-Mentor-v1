import { useQuery } from "@tanstack/react-query";

import { listExams } from "@/lib/api/writing";

/** One query key across the registration picker and the writing form, so both
 * mounting in a session share a cache entry rather than double-fetching. */
export function useExams() {
	return useQuery({
		queryKey: ["exams"],
		queryFn: listExams,
		// Rubric config changes roughly never at runtime — cache aggressively.
		staleTime: 10 * 60_000,
	});
}
