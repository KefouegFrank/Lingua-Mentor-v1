// Thin fetch wrapper for api-gateway REST/SSE routes.
// Base URL from NEXT_PUBLIC_API_BASE_URL.
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function health() {
	const res = await fetch(`${BASE}/health`);
	if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
	return res.json();
}

export async function get(path: string) {
	const res = await fetch(`${BASE}${path}`);
	if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
	return res.json();
}
