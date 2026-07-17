// Recording fakes for the injected deps, so tests assert on SQL params, job
// payloads and cache writes. JwtStrategy is real — signing is under test.
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { buildApp, type AppOptions } from "../src/app";
import type {
	AiServiceClient,
	CefrProfileDto,
	EvaluatePlacementInput,
	DailySessionDto,
	ExamPreview,
	LessonSessionDto,
	PersonaDto,
	PlacementTaskDto,
	SrsScheduleDto,
} from "../src/clients/ai-service";
import type { DbClient, Queryable } from "../src/db/client";
import { type AccessTokenClaims, JwtStrategy } from "../src/modules/auth/jwt.strategy";
import type {
	AppealEvalJobData,
	AppealEvalQueue,
	WritingEvalJobData,
	WritingEvalQueue,
} from "../src/queue/bullmq-client";
import type { RedisKv } from "../src/redis/client";

export interface RecordedQuery {
	text: string;
	params?: unknown[];
}

export interface FakeDb extends DbClient {
	calls: RecordedQuery[];
}

/** Routes queries by substring match, first match wins, unmatched returns zero
 * rows. A handler can `throw` to simulate a driver error (e.g. code "23505"). */
export function makeFakeDb(
	handlers: Array<{ match: string; rows?: Record<string, unknown>[]; throws?: unknown }> = [],
): FakeDb {
	const calls: RecordedQuery[] = [];
	const query = async (text: string, params?: unknown[]) => {
		calls.push({ text, params });
		const handler = handlers.find((h) => text.includes(h.match));
		if (handler?.throws) throw handler.throws;
		return { rows: handler?.rows ?? [] };
	};
	return {
		calls,
		query,
		// No real BEGIN/COMMIT — tests only care which statements were issued.
		async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
			return fn({ query });
		},
	};
}

export interface RecordedJob {
	name: string;
	data: WritingEvalJobData;
	opts: { jobId: string };
}

export interface FakeQueue extends WritingEvalQueue {
	jobs: RecordedJob[];
}

export function makeFakeQueue(opts: { failWith?: Error } = {}): FakeQueue {
	const jobs: RecordedJob[] = [];
	return {
		jobs,
		async add(name, data, jobOpts) {
			if (opts.failWith) throw opts.failWith;
			jobs.push({ name, data, opts: jobOpts });
			return { id: jobOpts.jobId };
		},
	};
}

export interface RecordedAppealJob {
	name: string;
	data: AppealEvalJobData;
	opts: { jobId: string };
}

export interface FakeAppealQueue extends AppealEvalQueue {
	jobs: RecordedAppealJob[];
}

export function makeFakeAppealQueue(opts: { failWith?: Error } = {}): FakeAppealQueue {
	const jobs: RecordedAppealJob[] = [];
	return {
		jobs,
		async add(name, data, jobOpts) {
			if (opts.failWith) throw opts.failWith;
			jobs.push({ name, data, opts: jobOpts });
			return { id: jobOpts.jobId };
		},
	};
}

export interface FakeRedis extends RedisKv {
	store: Map<string, string>;
	ttls: Map<string, number>;
}

export function makeFakeRedis(): FakeRedis {
	const store = new Map<string, string>();
	const ttls = new Map<string, number>();
	return {
		store,
		ttls,
		async setex(key, ttlSeconds, value) {
			store.set(key, value);
			ttls.set(key, ttlSeconds);
		},
		async get(key) {
			return store.get(key) ?? null;
		},
		async getdel(key) {
			const value = store.get(key) ?? null;
			store.delete(key);
			ttls.delete(key);
			return value;
		},
		async del(key) {
			store.delete(key);
			ttls.delete(key);
		},
	};
}

export interface FakeAiService extends AiServiceClient {
	calls: Array<{ method: string; args: unknown }>;
}

const DEFAULT_EXAMS: ExamPreview[] = [
	{
		exam_id: "ielts_academic",
		display_name: "IELTS Academic",
		language: "en",
		task_name: "Task 2 (Essay)",
		categories: [
			{ key: "task_response", name: "Task Response", weight: "0.250" },
			{ key: "coherence_cohesion", name: "Coherence & Cohesion", weight: "0.250" },
			{ key: "lexical_resource", name: "Lexical Resource", weight: "0.250" },
			{ key: "grammatical_range_accuracy", name: "Grammatical Range & Accuracy", weight: "0.250" },
		],
	},
];

const DEFAULT_PERSONAS: PersonaDto[] = [
	{
		persona: "companion",
		display_name: "Companion",
		description: "Warm and encouraging.",
		socratic_enabled: true,
		pro_only: false,
	},
	{
		persona: "coach",
		display_name: "Coach",
		description: "Direct and error-focused.",
		socratic_enabled: true,
		pro_only: true,
	},
	{
		persona: "examiner",
		display_name: "Examiner",
		description: "Formal and clinical.",
		socratic_enabled: false,
		pro_only: true,
	},
];

const DEFAULT_PLACEMENT_TASK: PlacementTaskDto = {
	exam_type: "ielts_academic",
	display_name: "IELTS Academic",
	task_name: "Writing Task 2 (essay)",
	task_id: "ielts_academic_placement_v1",
	prompt_text: "Discuss both views and give your own opinion.",
	word_count_min: 250,
};

export const DEFAULT_DAILY_SESSION: DailySessionDto = {
	session_id: "11111111-2222-4333-8444-555555555555",
	session_date: new Date().toISOString().slice(0, 10),
	skill_targeted: "grammar",
	srs_priority_score: 0.6,
	session_content: {
		type: "grammar_drill",
		prompt: "Rewrite each sentence using the correct verb form.",
		exercises: [{ item: "She go to work yesterday.", focus: "past simple" }],
		estimated_duration_minutes: 5,
	},
	pre_session_score: 0.5,
	generated: true,
};

/** Records calls and returns a canned 4D profile; override the profile or make
 * a method throw to exercise error paths. */
export function makeFakeAiService(
	opts: {
		profile?: CefrProfileDto;
		exams?: ExamPreview[];
		task?: PlacementTaskDto;
		srs?: SrsScheduleDto;
		personas?: PersonaDto[];
		dailySession?: DailySessionDto;
		dailySessionError?: unknown;
		chatChunks?: string[];
		chatError?: unknown;
		evaluateError?: unknown;
		profileError?: unknown;
		taskError?: unknown;
		srsError?: unknown;
	} = {},
): FakeAiService {
	const calls: Array<{ method: string; args: unknown }> = [];
	const defaultProfile: CefrProfileDto = {
		learner_profile_id: LEARNER_PROFILE_ID,
		placement_completed: true,
		writing: { level: "B2", source: "assessed", note: null },
		reading: { level: "B2", source: "proxy", note: "Phase-1 proxy from writing" },
		speaking: { level: null, source: "pending", note: "Voice Agent — Phase 2" },
		listening: { level: null, source: "pending", note: "proxy from speaking — Phase 2" },
	};
	return {
		calls,
		async evaluatePlacement(input: EvaluatePlacementInput) {
			calls.push({ method: "evaluatePlacement", args: input });
			if (opts.evaluateError) throw opts.evaluateError;
			return opts.profile ?? defaultProfile;
		},
		async getCefrProfile(id: string) {
			calls.push({ method: "getCefrProfile", args: id });
			if (opts.profileError) throw opts.profileError;
			return opts.profile ?? defaultProfile;
		},
		async getPlacementTask(examType: string) {
			calls.push({ method: "getPlacementTask", args: examType });
			if (opts.taskError) throw opts.taskError;
			return opts.task ?? DEFAULT_PLACEMENT_TASK;
		},
		async getSrsSchedule(learnerProfileId: string) {
			calls.push({ method: "getSrsSchedule", args: learnerProfileId });
			if (opts.srsError) throw opts.srsError;
			return opts.srs ?? DEFAULT_SRS_SCHEDULE;
		},
		async generateDailySession(learnerProfileId: string) {
			calls.push({ method: "generateDailySession", args: learnerProfileId });
			if (opts.dailySessionError) throw opts.dailySessionError;
			return opts.dailySession ?? DEFAULT_DAILY_SESSION;
		},
		async startLesson(learnerProfileId: string, topic?: string) {
			calls.push({ method: "startLesson", args: { learnerProfileId, topic } });
			return {
				lesson_session_id: LESSON_SESSION_ID,
				topic: topic ?? null,
				started_at: new Date().toISOString(),
			} satisfies LessonSessionDto;
		},
		async streamChat(learnerProfileId: string, lessonSessionId: string, message: string) {
			calls.push({ method: "streamChat", args: { learnerProfileId, lessonSessionId, message } });
			if (opts.chatError) throw opts.chatError;
			const chunks = opts.chatChunks ?? [
				'event: token\ndata: {"delta":"Hi"}\n\n',
				'event: done\ndata: {"first_token_ms":120}\n\n',
			];
			const encoder = new TextEncoder();
			return new ReadableStream<Uint8Array>({
				start(controller) {
					for (const c of chunks) controller.enqueue(encoder.encode(c));
					controller.close();
				},
			});
		},
		async listPersonas() {
			calls.push({ method: "listPersonas", args: undefined });
			return opts.personas ?? DEFAULT_PERSONAS;
		},
		async listExams() {
			calls.push({ method: "listExams", args: undefined });
			return opts.exams ?? DEFAULT_EXAMS;
		},
	};
}

export interface TestJwtMaterial {
	jwt: JwtStrategy;
	privateKeyPem: string;
	publicKeyPem: string;
}

/** Real JwtStrategy on a throwaway RS256 keypair (`extractable: true`, or
 * exportPKCS8 throws). Returns the PEMs too, for tests that hand-craft a token
 * — e.g. an already-expired one — instead of using JwtStrategy's fixed TTLs. */
export async function makeTestJwtMaterial(): Promise<TestJwtMaterial> {
	const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
	const privateKeyPem = await exportPKCS8(privateKey);
	const publicKeyPem = await exportSPKI(publicKey);
	return { jwt: new JwtStrategy(privateKeyPem, publicKeyPem), privateKeyPem, publicKeyPem };
}

export async function makeTestJwt(): Promise<JwtStrategy> {
	return (await makeTestJwtMaterial()).jwt;
}

const DEFAULT_TEST_CLAIMS: AccessTokenClaims = {
	sub: "1c2d3e4f-5555-4666-8777-88889999aaaa",
	role: "learner",
	tier: "free",
	lpid: "7b3e2a10-1111-4222-8333-444455556666",
};

export async function signTestAccessToken(
	jwt: JwtStrategy,
	overrides: Partial<AccessTokenClaims> = {},
): Promise<string> {
	return jwt.signAccessToken({ ...DEFAULT_TEST_CLAIMS, ...overrides });
}

export function bearerHeader(token: string): { authorization: string } {
	return { authorization: `Bearer ${token}` };
}

export interface TestApp {
	app: ReturnType<typeof buildApp>;
	db: FakeDb;
	queue: FakeQueue;
	appealQueue: FakeAppealQueue;
	redis: FakeRedis;
	jwt: JwtStrategy;
	aiService: FakeAiService;
}

/** Builds a fully-wired app with fakes for every injected dependency,
 * generating a fresh test JwtStrategy unless one is supplied. */
export async function buildTestApp(
	opts: Partial<AppOptions> & {
		db?: FakeDb;
		queue?: FakeQueue;
		appealQueue?: FakeAppealQueue;
		redis?: FakeRedis;
		aiService?: FakeAiService;
	} = {},
): Promise<TestApp> {
	const db = opts.db ?? makeFakeDb();
	const queue = opts.queue ?? makeFakeQueue();
	const appealQueue = opts.appealQueue ?? makeFakeAppealQueue();
	const redis = opts.redis ?? makeFakeRedis();
	const jwt = opts.jwt ?? (await makeTestJwt());
	// Inject both so buildApp never falls through to loadEnv() in tests.
	const aiService = opts.aiService ?? makeFakeAiService();
	const corsOrigins = opts.corsOrigins ?? ["http://localhost:3001"];
	// Spread opts first so extras like enforceCalibrationGate flow through; the
	// resolved fakes win over any same-named keys.
	const app = buildApp({ ...opts, db, queue, appealQueue, redis, jwt, aiService, corsOrigins });
	return { app, db, queue, appealQueue, redis, jwt, aiService };
}

export const LEARNER_PROFILE_ID = DEFAULT_TEST_CLAIMS.lpid;
export const SESSION_ID = "0a1b2c3d-aaaa-4bbb-8ccc-ddddeeeeffff";
export const LESSON_SESSION_ID = "9f8e7d6c-bbbb-4ccc-8ddd-eeeeffff0000";

export const DEFAULT_SRS_SCHEDULE: SrsScheduleDto = {
	learner_profile_id: LEARNER_PROFILE_ID,
	language: "en",
	next_dimension: "vocabulary",
	next_priority: 0.72,
	schedule: [
		{
			dimension: "vocabulary",
			priority: 0.72,
			overdue_ratio: 1.0,
			skill_gap: 0.8,
			volatility: 0,
			days_since_practice: null,
			interval_days: 1,
		},
		{
			dimension: "grammar",
			priority: 0.4,
			overdue_ratio: 0.5,
			skill_gap: 0.5,
			volatility: 0,
			days_since_practice: 2,
			interval_days: 4,
		},
	],
};
export const USER_ID = DEFAULT_TEST_CLAIMS.sub;
