import { ApiRequestError } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import {
  fetchRiskScore,
  fetchTopConcentration,
  loadRiskDashboardSummary
} from './risk-dashboard.client';

function mockFetch(body: unknown, status = 200) {
  const response = {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;

  return jest.fn().mockResolvedValue(response) as unknown as AuthenticatedFetch;
}

function okEnvelope(data: unknown) {
  return { data, error: null, meta: {} };
}

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the request to be rejected');
    },
    (error: ApiRequestError) => error
  );
}

describe('fetchRiskScore', () => {
  it('maps the GET /risk/score envelope onto the dashboard card shape', async () => {
    const request = mockFetch(
      okEnvelope({
        activeWeight: 100,
        calculatedAt: '2026-09-26T09:14:00Z',
        categories: [
          {
            key: 'concentration',
            name: 'Concentration',
            score: 45,
            severity: 'RED'
          }
        ],
        excluded: [],
        grade: 'C',
        score: 72,
        severity: 'YELLOW',
        unavailableReason: null
      })
    );

    const result = await fetchRiskScore(request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/score',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual({
      categories: [
        {
          key: 'concentration',
          name: 'Concentration',
          score: 45,
          severity: 'RED'
        }
      ],
      grade: 'C',
      score: 72,
      severity: 'YELLOW',
      unavailableReason: null
    });
  });

  it('throws an ApiRequestError from an error envelope', async () => {
    const request = mockFetch({
      data: null,
      error: { code: 'RISK_CALC_FAILED', message: 'boom' },
      meta: {}
    });

    const error = await rejection(fetchRiskScore(request));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe('RISK_CALC_FAILED');
  });

  it('throws an ApiRequestError when the response has no data', async () => {
    const request = mockFetch(okEnvelope(null));

    const error = await rejection(fetchRiskScore(request));

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe('INVALID_RESPONSE');
  });
});

describe('fetchTopConcentration', () => {
  // risk-concentration.mapper.ts#toGroup hardcodes every bucket's severity
  // to NO_DATA until the threshold engine lands - this reflects that actual
  // current behavior, not an arbitrary RED/GREEN fixture.
  it('returns the largest stock bucket from GET /risk/concentration, severity NO_DATA today', async () => {
    const request = mockFetch(
      okEnvelope({
        country: { buckets: [], thresholds: null },
        currency: { buckets: [], thresholds: null },
        sector: { buckets: [], thresholds: null },
        stock: {
          buckets: [
            {
              name: 'Apple Inc.',
              percentage: 0.333,
              severity: 'NO_DATA',
              value: 'AAPL'
            }
          ],
          thresholds: null
        }
      })
    );

    const result = await fetchTopConcentration(request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/concentration',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual({
      name: 'Apple Inc.',
      percentage: 0.333,
      severity: 'NO_DATA'
    });
  });

  it('returns null when there are no stock buckets', async () => {
    const request = mockFetch(
      okEnvelope({
        country: { buckets: [], thresholds: null },
        currency: { buckets: [], thresholds: null },
        sector: { buckets: [], thresholds: null },
        stock: { buckets: [], thresholds: null }
      })
    );

    expect(await fetchTopConcentration(request)).toBeNull();
  });
});

describe('loadRiskDashboardSummary', () => {
  it('combines score and concentration into one summary', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      const body =
        url === '/api/v1/risk/score'
          ? okEnvelope({
              categories: [],
              grade: 'A',
              score: 100,
              severity: 'GREEN',
              unavailableReason: null
            })
          : okEnvelope({
              country: { buckets: [], thresholds: null },
              currency: { buckets: [], thresholds: null },
              sector: { buckets: [], thresholds: null },
              stock: {
                buckets: [
                  {
                    name: 'Apple Inc.',
                    percentage: 0.1,
                    severity: 'NO_DATA',
                    value: 'AAPL'
                  }
                ],
                thresholds: null
              }
            });

      return Promise.resolve({
        json: jest.fn().mockResolvedValue(body),
        ok: true,
        status: 200
      } as unknown as Response);
    }) as unknown as AuthenticatedFetch;

    const result = await loadRiskDashboardSummary(request);

    expect(result).toEqual({
      categories: [],
      grade: 'A',
      score: 100,
      severity: 'GREEN',
      unavailableReason: null,
      topConcentration: {
        name: 'Apple Inc.',
        percentage: 0.1,
        severity: 'NO_DATA'
      }
    });
  });

  it('propagates an error from either call', async () => {
    const request = mockFetch({
      data: null,
      error: { code: 'RISK_CALC_FAILED', message: 'down' },
      meta: {}
    });

    const error = await rejection(loadRiskDashboardSummary(request));

    expect(error).toBeInstanceOf(ApiRequestError);
  });
});
