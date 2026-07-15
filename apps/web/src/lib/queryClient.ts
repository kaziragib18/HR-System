import { QueryClient } from '@tanstack/react-query'

/**
 * A single shared instance (not created inside a component) so that
 * non-component modules — `lib/api/auth.ts`'s `logout()`, `lib/api/client.ts`'s
 * 401 handler — can call `queryClient.clear()` on sign-out. Without this,
 * self-scoped query keys like `['my-dashboard']` or `['leave','applications',
 * 'me']` don't include the user's id, so switching accounts in the same
 * browser tab (logout → log back in as someone else, no hard reload) leaked
 * the previous user's cached "my X" data until each query's own staleTime
 * happened to expire.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})
