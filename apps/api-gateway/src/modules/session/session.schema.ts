// Request validation for the session module.
import { z } from "zod";

export const lessonStartSchema = z.object({
	topic: z.string().trim().min(1).max(200).optional(),
});

export const lessonIdParamSchema = z.object({
	lesson_session_id: z.string().uuid(),
});

export const lessonMessageSchema = z.object({
	// Capped so one turn can't burn an unbounded number of tokens.
	message: z.string().trim().min(1).max(4000),
});
