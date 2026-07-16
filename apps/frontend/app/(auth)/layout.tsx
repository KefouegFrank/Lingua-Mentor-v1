"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageSpinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-session";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isHydrated } = useSession();
	const router = useRouter();

	useEffect(() => {
		// Wait for the bootstrap first, or a returning user sees the login form
		// flash before being bounced to the dashboard.
		if (isHydrated && isAuthenticated) router.replace("/dashboard");
	}, [isHydrated, isAuthenticated, router]);

	// Both branches are brief, so show a spinner rather than a blank flash.
	if (!isHydrated || isAuthenticated) return <PageSpinner />;

	return <>{children}</>;
}
