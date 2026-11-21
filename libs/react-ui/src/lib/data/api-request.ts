import type { ApiResponse } from '@ghostfolio/common/api-conventions';

/**
 * The host's authenticated fetch. React code never reads tokens or the
 * impersonation identity itself: the Angular host builds this adapter from its
 * existing auth services (see project-docs/iteration-3/architecture-3-tier-soa.md)
 * and passes it down. Tests pass a mock.
 */
export type AuthenticatedFetch = typeof fetch;

/** Carries the HTTP status and the backend error code, never raw server text. */
export class ApiRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * GET a route that answers with the shared { data, error, meta } envelope and
 * return `data`. Throws ApiRequestError on HTTP failure, an error envelope, a
 * body that is not JSON, or a missing `data` field.
 */
export async function requestApi<T>(
  request: AuthenticatedFetch,
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await request(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    method: 'GET',
    signal
  });

  let body: ApiResponse<T> | undefined;

  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      response.status,
      'INVALID_RESPONSE',
      'Could not read the response'
    );
  }

  if (!response.ok || body?.error) {
    throw new ApiRequestError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      response.status === 401 ? 'Please sign in' : 'Unable to load data'
    );
  }

  if (body?.data === null || body?.data === undefined) {
    throw new ApiRequestError(
      response.status,
      'INVALID_RESPONSE',
      'The response contained no data'
    );
  }

  return body.data;
}
