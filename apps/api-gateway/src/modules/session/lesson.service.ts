// Lesson chat (PRD §35.3, ADR 0010). The mentor turn is streamed, so this
// forwards ai-service's SSE rather than buffering and re-emitting it.
import type { AiServiceClient, LessonSessionDto } from "../../clients/ai-service";

export interface LessonDeps {
	aiService: AiServiceClient;
}

export function startLesson(
	deps: LessonDeps,
	learnerProfileId: string,
	topic?: string,
): Promise<LessonSessionDto> {
	return deps.aiService.startLesson(learnerProfileId, topic);
}

export function streamLessonChat(
	deps: LessonDeps,
	learnerProfileId: string,
	lessonSessionId: string,
	message: string,
): Promise<ReadableStream<Uint8Array>> {
	return deps.aiService.streamChat(learnerProfileId, lessonSessionId, message);
}
