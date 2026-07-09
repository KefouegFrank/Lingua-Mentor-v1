// Read-only profile lookup for GET /api/v1/user/me (PRD §35.2). Registration
// and login already return the same shape of data on success, but /me is
// the endpoint the frontend calls to re-hydrate a session on page load.
import type { DbClient } from "../../db/client";

export interface UserProfile {
	id: string;
	email: string;
	displayName: string;
	role: string;
	subscriptionTier: string;
	learnerProfileId: string;
	targetLanguage: string;
	targetExam: string | null;
	accentTarget: string;
	defaultPersona: string;
	activeTrack: string;
	// 4D CEFR profile (PRD §22) — null until the placement test runs, or
	// until the relevant skill dimension has real data behind it.
	cefrSpeaking: string | null;
	cefrListening: string | null;
	cefrReading: string | null;
	cefrWriting: string | null;
}

export async function getUserProfile(db: DbClient, userId: string): Promise<UserProfile | null> {
	const { rows } = await db.query(
		`SELECT u.id, u.email, u.display_name, u.role, u.subscription_tier,
				lp.id AS learner_profile_id, lp.target_language, lp.target_exam,
				lp.accent_target, lp.default_persona, lp.active_track,
				lp.cefr_speaking, lp.cefr_listening, lp.cefr_reading, lp.cefr_writing
		 FROM users u
		 JOIN learner_profiles lp ON lp.user_id = u.id
		 WHERE u.id = $1`,
		[userId],
	);
	const row = rows[0];
	if (!row) return null;

	return {
		id: String(row.id),
		email: String(row.email),
		displayName: String(row.display_name),
		role: String(row.role),
		subscriptionTier: String(row.subscription_tier),
		learnerProfileId: String(row.learner_profile_id),
		targetLanguage: String(row.target_language),
		targetExam: row.target_exam == null ? null : String(row.target_exam),
		accentTarget: String(row.accent_target),
		defaultPersona: String(row.default_persona),
		activeTrack: String(row.active_track),
		cefrSpeaking: row.cefr_speaking == null ? null : String(row.cefr_speaking),
		cefrListening: row.cefr_listening == null ? null : String(row.cefr_listening),
		cefrReading: row.cefr_reading == null ? null : String(row.cefr_reading),
		cefrWriting: row.cefr_writing == null ? null : String(row.cefr_writing),
	};
}
