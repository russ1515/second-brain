import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fetchWithCache } from './offline';

/**
 * TanStack Query wiring (Sprint 10.1 — Performance).
 *
 * A single shared cache for server data: requests are DEDUPED, results are kept
 * fresh for `staleTime` so navigating away and back doesn't refetch, and stale
 * data is revalidated in the background. This pairs with the API's Redis read
 * cache — the client avoids redundant calls, the server serves the rest fast.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: a dashboard revisit within this window is instant
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Cached GET for a screen: `useApiQuery(['learning-dna'], '/learning-dna')`.
 * Replaces the useEffect + useState + api() boilerplate and gains dedup/caching
 * PLUS offline read fallback (Sprint 10.3): when the network is unreachable it
 * serves the last saved copy instead of failing. Pair with `useOnline()` for an
 * "offline — showing saved data" banner.
 */
export function useApiQuery<T>(key: readonly unknown[], path: string) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => fetchWithCache<T>(path).then((r) => r.data),
  });
}
