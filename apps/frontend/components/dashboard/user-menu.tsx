"use client";

import { useMutation } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth-store";

export function UserMenu() {
	const user = useAuthStore((s) => s.user);
	const clearSession = useAuthStore((s) => s.clearSession);
	const router = useRouter();

	const mutation = useMutation({
		mutationFn: logout,
		// Clear and redirect whether or not the call succeeds — a failed logout
		// must never leave the user stuck signed in.
		onSettled: () => {
			clearSession();
			router.push("/login");
		},
	});

	if (!user) return null;

	const initials = user.display_name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<div className="flex items-center gap-3 border-t border-border pt-3">
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
				{initials}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{user.display_name}</p>
				<p className="truncate text-xs text-muted-foreground">{user.email}</p>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => mutation.mutate()}
				isLoading={mutation.isPending}
				aria-label="Sign out"
			>
				{!mutation.isPending && <LogOut className="h-4 w-4" />}
			</Button>
		</div>
	);
}
