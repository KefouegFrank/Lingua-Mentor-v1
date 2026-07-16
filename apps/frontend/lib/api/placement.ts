import { authenticatedFetch } from "@/lib/api/client";
import type { CefrProfile, PlacementTask } from "@/lib/api/types";

export function getPlacementTask(): Promise<PlacementTask> {
	return authenticatedFetch<PlacementTask>("/api/v1/placement/task");
}

export interface SubmitPlacementInput {
	task_id: string;
	essay_text: string;
}

export function submitPlacement(input: SubmitPlacementInput): Promise<CefrProfile> {
	return authenticatedFetch<CefrProfile>("/api/v1/placement/submit", {
		method: "POST",
		body: JSON.stringify(input),
	});
}
