import type { AuthenticatedFetch } from '../src/lib/data/api-request';
import fixture from './fixtures/portfolio.json';

export const INTEGRATION_API_URL = process.env['INTEGRATION_API_URL'];

export { fixture };

/** Activities and prices to import; defaults to the shared fixture portfolio. */
export interface PortfolioFixture {
  activities: (typeof fixture)['activities'];
  marketData: Record<string, { date: string; marketPrice: number }[]>;
}

export interface IntegrationSession {
  /** Same contract as the Angular host's adapter: relative /api paths, auth added. */
  request: AuthenticatedFetch;
}

async function post(
  url: string,
  body: unknown,
  authToken?: string
): Promise<unknown> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with HTTP ${response.status}`);
  }

  return (await response.json()) as unknown;
}

/**
 * Signs up a fresh user on the running API, imports the given portfolio
 * (the shared fixture by default) and its prices, and returns an
 * authenticated fetch for the React screens. Each run gets its own user and
 * its own MANUAL symbols (a user may only price asset profiles it created), so
 * runs never share data.
 */
export async function createIntegrationSession(
  baseUrl: string,
  portfolio: PortfolioFixture = fixture
): Promise<IntegrationSession> {
  const runId = Date.now().toString(36).toUpperCase();
  const symbolFor = (symbol: string) => `${symbol}_${runId}`;

  const { authToken } = (await post(`${baseUrl}/api/v1/user`, {})) as {
    authToken: string;
  };

  await post(
    `${baseUrl}/api/v1/import`,
    {
      activities: portfolio.activities.map((activity) => ({
        ...activity,
        symbol: symbolFor(activity.symbol)
      }))
    },
    authToken
  );

  for (const [symbol, marketData] of Object.entries(portfolio.marketData)) {
    await post(
      `${baseUrl}/api/v1/market-data/MANUAL/${symbolFor(symbol)}`,
      { marketData },
      authToken
    );
  }

  const request = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    headers.set('Authorization', `Bearer ${authToken}`);

    // jsdom's AbortSignal is not Node's, so it cannot be passed to Node's
    // fetch. The harness never aborts mid-request, so the signal is dropped.
    const forwarded: RequestInit = { ...init, headers };

    delete forwarded.signal;

    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return fetch(`${baseUrl}${path}`, forwarded);
  }) as AuthenticatedFetch;

  return { request };
}
