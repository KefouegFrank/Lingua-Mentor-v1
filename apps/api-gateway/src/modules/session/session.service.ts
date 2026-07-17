// Session/adaptive reads (PRD §35.3). SRS ranking itself lives in ai-service's
// adaptive engine; this caches it so a dashboard poll isn't a round trip.
import { SRS_STATE_KEY_PREFIX, SRS_STATE_TTL_SECONDS } from "../../config/constants";
import type { AiServiceClient, SrsScheduleDto } from "../../clients/ai-service";
import type { RedisKv } from "../../redis/client";

export interface SessionDeps {
	aiService: AiServiceClient;
	redis: RedisKv;
}

export async function getSrsSchedule(
	deps: SessionDeps,
	learnerProfileId: string,
): Promise<SrsScheduleDto> {
	const key = `${SRS_STATE_KEY_PREFIX}${learnerProfileId}`;

	try {
		const cached = await deps.redis.get(key);
		if (cached) return JSON.parse(cached) as SrsScheduleDto;
	} catch {
		// A cache miss and a broken cache should look the same to the learner.
	}

	const schedule = await deps.aiService.getSrsSchedule(learnerProfileId);

	try {
		await deps.redis.setex(key, SRS_STATE_TTL_SECONDS, JSON.stringify(schedule));
	} catch {
		// Redis down is not a reason to withhold a schedule we already computed.
	}
	return schedule;
}
