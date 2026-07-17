// GET /api/v1/user/me (PRD §35.2) — registered under /api/v1/user in app.ts.
import type { FastifyInstance } from "fastify";

import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../../config/constants";
import { authenticate } from "../../middleware/authenticate";
import { AppError } from "../../plugins/error-envelope";
import { eraseAccount, getUserProfile, type UserProfile } from "./users.service";

function toResponseProfile(profile: UserProfile) {
	return {
		id: profile.id,
		email: profile.email,
		display_name: profile.displayName,
		role: profile.role,
		subscription_tier: profile.subscriptionTier,
		learner_profile_id: profile.learnerProfileId,
		target_language: profile.targetLanguage,
		target_exam: profile.targetExam,
		accent_target: profile.accentTarget,
		default_persona: profile.defaultPersona,
		active_track: profile.activeTrack,
		cefr_speaking: profile.cefrSpeaking,
		cefr_listening: profile.cefrListening,
		cefr_reading: profile.cefrReading,
		cefr_writing: profile.cefrWriting,
	};
}

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — /health and /api/v1/auth/* never see it.
	app.addHook("preHandler", authenticate);

	app.get("/me", async (request) => {
		const profile = await getUserProfile(app.db, request.user!.userId);
		if (!profile) {
			// JWT verified but the account is gone (GDPR erasure / manual delete).
			throw new AppError(404, "NOT_FOUND", "user not found");
		}
		return toResponseProfile(profile);
	});

	// GDPR erasure (ADR 0007). Acts only on the caller's own sub claim, and is
	// irreversible — a second call finds nothing left to erase.
	app.delete("/me", async (request, reply) => {
		const erased = await eraseAccount(app.db, request.user!.userId);
		if (!erased) {
			throw new AppError(404, "NOT_FOUND", "user not found");
		}
		reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
		return reply.status(204).send();
	});

	// Proxied from ai-service so the assessed/proxy/pending source rules live
	// in one place, not re-derived here from /me's raw columns.
	app.get("/cefr-profile", async (request) => {
		return app.aiService.getCefrProfile(request.user!.learnerProfileId);
	});
}
