import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@qc/api-client";

/** Retry only what can plausibly succeed on a second try, and never more than twice. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  return error instanceof ApiClientError ? error.retryable : false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
