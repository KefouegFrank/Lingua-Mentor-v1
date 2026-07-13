"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageSpinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-session";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isHydrated } = useSession();
	const router = useRouter();

	useEffect(() => {
		// Wait for the silent-refresh bootstrap before deciding — otherwise a
		// returning logged-in user briefly sees the login form flash before
		// being bounced to the dashboard.
		if (isHydrated && isAuthenticated) router.replace("/dashboard");
	}, [isHydrated, isAuthenticated, router]);

	// Both branches below are brief (a refresh round-trip, then an instant
	// redirect) — a spinner, never a blank flash, is what should ever be
	// visible on the server-rendered first paint.
	if (!isHydrated || isAuthenticated) return <PageSpinner />;

	return <>{children}</>;
}
