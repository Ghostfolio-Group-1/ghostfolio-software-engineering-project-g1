import type { AuthenticatedFetch } from '../data/api-request';
import { fetchRiskWarnings } from './risk-warnings.client';

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

describe('fetchRiskWarnings', () => {
  it('requests the max page size and returns the warnings array', async () => {
    const warnings = [
      {
        actual: 0.33,
        message: 'AAPL is 33% of your portfolio, above the 25% red limit.',
        ruleKey: 'SingleStockConcentration',
        severity: 'RED',
        subject: { type: 'stock', value: 'AAPL' },
        threshold: 0.25
      }
    ];
    const request = mockFetch(okEnvelope(warnings));

    const result = await fetchRiskWarnings(request);

    expect(result).toEqual(warnings);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/warnings?pageSize=100',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
