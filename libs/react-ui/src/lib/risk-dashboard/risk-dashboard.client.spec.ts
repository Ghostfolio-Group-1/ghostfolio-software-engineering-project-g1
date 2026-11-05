import {
  fetchRiskScore,
  fetchTopConcentration,
  loadRiskDashboardSummary,
  RiskApiError
} from './risk-dashboard.client';

function okResponse(data: unknown) {
  return { data, error: null, meta: {} };
}

function errorResponse(code: string, message: string) {
  return { data: null, error: { code, message }, meta: {} };
}

describe('fetchRiskScore', () => {
  it('maps the GET /risk/score envelope onto the dashboard card shape', async () => {
    const fetchJson = jest.fn().mockResolvedValue(
      okResponse({
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

    const result = await fetchRiskScore(fetchJson);

    expect(fetchJson).toHaveBeenCalledWith('/api/v1/risk/score');
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

  it('throws a RiskApiError carrying the API error message', async () => {
    const fetchJson = jest
      .fn()
      .mockResolvedValue(errorResponse('RISK_CALC_FAILED', 'boom'));

    await expect(fetchRiskScore(fetchJson)).rejects.toThrow(RiskApiError);
    await expect(fetchRiskScore(fetchJson)).rejects.toThrow('boom');
  });
});

describe('fetchTopConcentration', () => {
  it('returns the largest stock bucket from GET /risk/concentration', async () => {
    const fetchJson = jest.fn().mockResolvedValue(
      okResponse({
        country: { buckets: [], thresholds: null },
        currency: { buckets: [], thresholds: null },
        sector: { buckets: [], thresholds: null },
        stock: {
          buckets: [
            {
              name: 'Apple Inc.',
              percentage: 0.333,
              severity: 'RED',
              value: 'AAPL'
            }
          ],
          thresholds: null
        }
      })
    );

    const result = await fetchTopConcentration(fetchJson);

    expect(fetchJson).toHaveBeenCalledWith('/api/v1/risk/concentration');
    expect(result).toEqual({
      name: 'Apple Inc.',
      percentage: 0.333,
      severity: 'RED'
    });
  });

  it('returns null when there are no stock buckets', async () => {
    const fetchJson = jest.fn().mockResolvedValue(
      okResponse({
        country: { buckets: [], thresholds: null },
        currency: { buckets: [], thresholds: null },
        sector: { buckets: [], thresholds: null },
        stock: { buckets: [], thresholds: null }
      })
    );

    expect(await fetchTopConcentration(fetchJson)).toBeNull();
  });
});

describe('loadRiskDashboardSummary', () => {
  it('combines score and concentration into one summary', async () => {
    const fetchJson = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/risk/score') {
        return Promise.resolve(
          okResponse({
            categories: [],
            grade: 'A',
            score: 100,
            severity: 'GREEN'
          })
        );
      }

      return Promise.resolve(
        okResponse({
          country: { buckets: [], thresholds: null },
          currency: { buckets: [], thresholds: null },
          sector: { buckets: [], thresholds: null },
          stock: {
            buckets: [
              {
                name: 'Apple Inc.',
                percentage: 0.1,
                severity: 'GREEN',
                value: 'AAPL'
              }
            ],
            thresholds: null
          }
        })
      );
    });

    const result = await loadRiskDashboardSummary(fetchJson);

    expect(result).toEqual({
      categories: [],
      grade: 'A',
      score: 100,
      severity: 'GREEN',
      topConcentration: {
        name: 'Apple Inc.',
        percentage: 0.1,
        severity: 'GREEN'
      }
    });
  });

  it('propagates an error from either call', async () => {
    const fetchJson = jest
      .fn()
      .mockResolvedValue(errorResponse('RISK_CALC_FAILED', 'down'));

    await expect(loadRiskDashboardSummary(fetchJson)).rejects.toThrow('down');
  });
});
