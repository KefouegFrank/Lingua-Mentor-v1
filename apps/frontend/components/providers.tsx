"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

import { ApiError } from "@/lib/api/client";
import { useSessionBootstrap } from "@/hooks/use-session";

function SessionBootstrap() {
	useSessionBootstrap();
	return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						// A 4xx (bad input, not-found, validation) will never succeed on
						// retry — only retry transient network/5xx failures, and cap it
						// so a dead backend doesn't spin a query for a minute.
						retry: (failureCount, error) => {
							if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
								return false;
							}
							return failureCount < 2;
						},
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<SessionBootstrap />
			{children}
			<Toaster position="top-right" richColors closeButton />
		</QueryClientProvider>
	);
}
