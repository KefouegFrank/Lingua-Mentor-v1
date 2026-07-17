import type { SubmitBody } from "@lingumentor/shared-schemas";

import { authenticatedFetch } from "@/lib/api/client";
import type {
	AppealResult,
	CalibrationMetadata,
	ExamPreview,
	WritingResult,
} from "@/lib/api/types";

export function listExams(): Promise<ExamPreview[]> {
	return authenticatedFetch<ExamPreview[]>("/api/v1/writing/exams");
}

export function getCalibration(): Promise<CalibrationMetadata> {
	return authenticatedFetch<CalibrationMetadata>("/api/v1/writing/calibration");
}

export function submitWriting(body: SubmitBody): Promise<{ session_id: string; status: string }> {
	return authenticatedFetch("/api/v1/writing/submit", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function getWritingResult(sessionId: string): Promise<WritingResult> {
	return authenticatedFetch<WritingResult>(`/api/v1/writing/result/${sessionId}`);
}

export function submitAppeal(
	sessionId: string,
	appealReason?: string,
): Promise<{ appeal_id: string; status: string }> {
	return authenticatedFetch(`/api/v1/writing/appeal/${sessionId}`, {
		method: "POST",
		body: JSON.stringify(appealReason ? { appeal_reason: appealReason } : {}),
	});
}

export function getAppeal(appealId: string): Promise<AppealResult> {
	return authenticatedFetch<AppealResult>(`/api/v1/writing/appeal/${appealId}`);
}
