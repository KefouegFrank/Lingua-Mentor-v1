import { authenticatedFetch } from "@/lib/api/client";
import type { CefrProfile, UserProfile } from "@/lib/api/types";

export function getMe(): Promise<UserProfile> {
	return authenticatedFetch<UserProfile>("/api/v1/user/me");
}

export function getCefrProfile(): Promise<CefrProfile> {
	return authenticatedFetch<CefrProfile>("/api/v1/user/cefr-profile");
}
