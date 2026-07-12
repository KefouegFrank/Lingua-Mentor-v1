// Synchronous HTTP client for the Python evaluation service. The writing flow
// reaches ai-service asynchronously through BullMQ; placement is a one-shot
// onboarding call, so it goes over HTTP and the caller waits for the profile.
import { AppError } from "../plugins/error-envelope";

export interface CefrDimension {
	level: string | null;
	source: string; // "assessed" | "proxy" | "pending"
	note: string | null;
}

export interface CefrProfileDto {
	learner_profile_id: string;
	placement_completed: boolean;
	speaking: CefrDimension;
	listening: CefrDimension;
	reading: CefrDimension;
	writing: CefrDimension;
}

export interface EvaluatePlacementInput {
	learnerProfileId: string;
	examType: string;
	promptText: string;
	essayText: string;
}

export interface AiServiceClient {
	evaluatePlacement(input: EvaluatePlacementInput): Promise<CefrProfileDto>;
	getCefrProfile(learnerProfileId: string): Promise<CefrProfileDto>;
}

export function createAiServiceClient(baseUrl: string): AiServiceClient {
	const base = baseUrl.replace(/\/$/, "");

	async function toProfile(res: Response): Promise<CefrProfileDto> {
		if (res.ok) return (await res.json()) as CefrProfileDto;
		// ai-service speaks the same {error:{code,message}} envelope — re-raise it
		// as our AppError so the gateway emits one consistent error shape.
		let code = "UPSTREAM_ERROR";
		let message = `ai-service responded ${res.status}`;
		try {
			const body = (await res.json()) as { error?: { code?: string; message?: string } };
			if (body.error?.code) code = body.error.code;
			if (body.error?.message) message = body.error.message;
		} catch {
			// non-JSON error body — keep the defaults
		}
		// A 5xx upstream is a bad gateway from the client's side; a 4xx passes
		// through as-is (the caller's input, e.g. an unknown exam, is the fault).
		throw new AppError(res.status >= 500 ? 502 : res.status, code, message);
	}

	async function call(path: string, init: RequestInit): Promise<CefrProfileDto> {
		let res: Response;
		try {
			res = await fetch(`${base}${path}`, {
				...init,
				headers: { "content-type": "application/json", ...(init.headers ?? {}) },
			});
		} catch {
			// DNS/connection/timeout — the service is down, not a client error.
			throw new AppError(502, "AI_SERVICE_UNREACHABLE", "evaluation service is unavailable");
		}
		return toProfile(res);
	}

	return {
		evaluatePlacement(input) {
			return call("/api/v1/placement/evaluate", {
				method: "POST",
				body: JSON.stringify({
					learner_profile_id: input.learnerProfileId,
					exam_type: input.examType,
					prompt_text: input.promptText,
					essay_text: input.essayText,
				}),
			});
		},
		getCefrProfile(learnerProfileId) {
			return call(`/api/v1/placement/profile/${learnerProfileId}`, { method: "GET" });
		},
	};
}
