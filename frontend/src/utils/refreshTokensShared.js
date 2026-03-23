/**
 * Shared token refresh with promise deduplication.
 * Both the Axios interceptor and isAuthAtom call this.
 * If a refresh is already in flight, all callers await the same promise
 * so only one /token/refresh/ request is ever made at a time.
 */

let refreshPromise = null;

export async function sharedRefreshTokens(doRefreshFn) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefreshFn().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
