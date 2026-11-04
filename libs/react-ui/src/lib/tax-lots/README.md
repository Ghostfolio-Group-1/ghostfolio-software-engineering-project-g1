# Tax-lots data hook (Iteration 3, #194)

`useTaxLots(authenticatedRequest)` fetches `GET /api/v1/tax/lots`. The hook never computes tax amounts and never converts decimal-string quantities into JavaScript numbers.

## Authentication boundary

**An authenticated fetch adapter is required.** This is intentional: the existing Ghostfolio Angular `AuthInterceptor` adds authentication via `TokenStorageService`, impersonation via `ImpersonationStorageService`, and timezone headers. Native `fetch` does **not** pass through Angular's `HttpClient` interceptor. `credentials: 'same-origin'` alone does not add Ghostfolio's bearer token.

For the Nov 4 host-screen integration, coordinate with Raniya to supply a stable `TaxLotsFetch` adapter from the app/feature integration layer. It should use the current token and impersonation identity from the existing host services and the `HEADER_KEY_TOKEN`, `HEADER_KEY_IMPERSONATION`, and `HEADER_KEY_TIMEZONE` constants in `@ghostfolio/common/config`. If there is no token, the host should show a login state rather than sending an unauthenticated request. Do not put token storage or Angular service access inside `libs/react-ui`.

A host adapter (pseudocode showing the data flow; **not** a new shared service) can be constructed as follows after injecting the existing Angular services:

```ts
const authenticatedRequest: TaxLotsFetch = (input, init) => {
  const token = tokenStorageService.getToken();
  if (token === null) {
    return Promise.reject(new Error('Sign in required'));
  }
  const headers = new Headers(init?.headers);
  headers.set(HEADER_KEY_TOKEN, `Bearer ${token}`);
  headers.set(
    HEADER_KEY_TIMEZONE,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const impersonationId = impersonationStorageService.getId();
  if (impersonationId !== null) {
    headers.set(HEADER_KEY_IMPERSONATION, impersonationId);
  }
  return fetch(input, { ...init, headers });
};
```

The adapter is supplied as `useTaxLots(authenticatedRequest)`. Call the hook's `reload()` method when login or impersonation identity changes; changing only the callback reference is intentionally not a refetch trigger.

## State and errors

The hook returns `status`, `data`, `error`, `diagnostics`, `isComplete`, and `reload`. `isComplete` is `null` while loading/error, `true` when the API omits it, and `false` when the backend reports incomplete history. Incomplete results with no lots use `ready` rather than a misleading normal `empty` state, so the screen can show the diagnostic warning.

HTTP failures yield `TaxLotsApiError` with `status` and `code`. The screen can use `status === 401` for a login prompt and a generic, safe error message for other failures. Backend error text is not presented directly.

## Ownership

This folder is Tax-owned, but `libs/react-ui` is shared and Raniya owns its architecture. **Raniya must confirm this placement before PR #195 merges.** Moving the hook to another feature/data library requires her approval; do not move it unilaterally.
