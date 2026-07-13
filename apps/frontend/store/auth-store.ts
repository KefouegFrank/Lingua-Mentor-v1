import { create } from "zustand";

import type { PublicUser } from "@/lib/api/types";

interface AuthState {
	/** In-memory only — deliberately never persisted to localStorage/sessionStorage.
	 * The access token is a 15-minute bearer credential (PRD §37.1); keeping it
	 * out of any Web Storage removes it from the XSS-exfiltration surface
	 * entirely. Long-lived session continuity comes from the httpOnly refresh
	 * cookie instead, restored via a silent refresh on app load — see
	 * hooks/use-session.ts. */
	accessToken: string | null;
	user: PublicUser | null;
	/** False until the initial silent-refresh attempt on app load has
	 * resolved (success or failure) — route guards wait on this so a
	 * logged-in user isn't flashed a login screen on every hard refresh. */
	isHydrated: boolean;
	setSession: (accessToken: string, user: PublicUser) => void;
	setHydrated: () => void;
	clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	accessToken: null,
	user: null,
	isHydrated: false,
	setSession: (accessToken, user) => set({ accessToken, user }),
	setHydrated: () => set({ isHydrated: true }),
	clearSession: () => set({ accessToken: null, user: null, isHydrated: true }),
}));
