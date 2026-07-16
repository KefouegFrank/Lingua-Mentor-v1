import { create } from "zustand";

import type { PublicUser } from "@/lib/api/types";

interface AuthState {
	/** In-memory only, never Web Storage — that keeps this bearer credential off
	 * the XSS-exfiltration surface. Continuity comes from the refresh cookie. */
	accessToken: string | null;
	user: PublicUser | null;
	/** False until the app-load silent refresh resolves — route guards wait on
	 * it so a logged-in user isn't flashed a login screen. */
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
