import { useQuery } from "@tanstack/react-query";

import { getPlacementTask } from "@/lib/api/placement";
import { useSession } from "@/hooks/use-session";

export const PLACEMENT_TASK_QUERY_KEY = ["placement-task"] as const;

export function usePlacementTask() {
	const { isAuthenticated, isHydrated } = useSession();
	return useQuery({
		queryKey: PLACEMENT_TASK_QUERY_KEY,
		queryFn: getPlacementTask,
		enabled: isHydrated && isAuthenticated,
		// NO_TARGET_EXAM and AWAITING_CALIBRATION are settled answers about this
		// account, not blips — retrying them just delays the page telling the truth.
		retry: false,
	});
}
