import { authenticatedFetch } from "@/lib/api/client";
import type { CefrProfile } from "@/lib/api/types";

export interface SubmitPlacementInput {
	prompt_text: string;
	essay_text: string;
}

export function submitPlacement(input: SubmitPlacementInput): Promise<CefrProfile> {
	return authenticatedFetch<CefrProfile>("/api/v1/placement/submit", {
		method: "POST",
		body: JSON.stringify(input),
	});
}
