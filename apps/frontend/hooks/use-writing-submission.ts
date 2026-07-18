import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { SubmitBody } from "@lingumentor/shared-schemas";

import { getWritingResult, submitWriting } from "@/lib/api/writing";
import type { WritingResult, WritingSessionStatus } from "@/lib/api/types";

const TERMINAL: WritingSessionStatus[] = ["scored", "failed", "awaiting_calibration"];
// Scoring targets < 6s P95 (§62); well past that means a stalled pipeline, not a
// slow one — surface it rather than spin forever (e.g. the worker is down).
const POLL_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1500;

function isTerminal(status?: WritingSessionStatus): boolean {
	return status != null && TERMINAL.includes(status);
}

/** Submit an essay, then poll the result until the worker reaches a terminal
 * state (§21.2 pipeline is async — submit returns before scoring runs). */
export function useWritingSubmission() {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [timedOut, setTimedOut] = useState(false);

	const submit = useMutation({
		mutationFn: (body: SubmitBody) => submitWriting(body),
		onSuccess: (res) => {
			setTimedOut(false);
			setSessionId(res.session_id);
		},
	});

	const settled = timedOut;
	const result = useQuery<WritingResult>({
		queryKey: ["writing-result", sessionId],
		queryFn: () => getWritingResult(sessionId as string),
		enabled: sessionId != null && !settled,
		// Stop polling once the status can't change again.
		refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : POLL_INTERVAL_MS),
	});

	const status = result.data?.status;
	const reachedTerminal = isTerminal(status);

	// One-shot deadline from submit; the deps keep it from restarting on an
	// unchanged status, so a session stuck "pending" still times out on schedule.
	useEffect(() => {
		if (sessionId == null || reachedTerminal) return;
		const timer = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [sessionId, reachedTerminal]);

	function reset() {
		setSessionId(null);
		setTimedOut(false);
		submit.reset();
	}

	return {
		submit,
		result,
		sessionId,
		timedOut,
		isPolling: sessionId != null && !reachedTerminal && !timedOut,
		reset,
	};
}
