"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/dashboard/app-shell";
import { PageSpinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/use-session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isHydrated } = useSession();
	const router = useRouter();

	useEffect(() => {
		// Mirror of (auth)/layout.tsx's guard, inverted: no session once
		// hydration resolves means back to login, not a broken dashboard call.
		if (isHydrated && !isAuthenticated) router.replace("/login");
	}, [isHydrated, isAuthenticated, router]);

	if (!isHydrated || !isAuthenticated) return <PageSpinner />;

	return <AppShell>{children}</AppShell>;
}
