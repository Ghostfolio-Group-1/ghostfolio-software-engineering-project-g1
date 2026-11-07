import { ApiRequestError } from '../data/api-request';
import type { AuthenticatedFetch } from '../data/api-request';
import {
  fetchDividendWithholding,
  isValidDividendYear
} from './dividend-withholding.client';

const dividend = {
  accountId: 'account-1',
  activityFee: '0.125000000000000000001',
  date: '2026-01-01T00:30:00.000Z',
  grossDividend: '10.123456789012345678901',
  netDividend: null,
  sourceActivityId: 'dividend-1',
  symbolProfileId: 'asset-1',
  transactionCurrency: 'USD',
  withholdingTax: null
};

function response(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function mockRequest(body: unknown, status = 200) {
  const mock = jest.fn().mockResolvedValue(response(body, status));
  return { mock, request: mock as unknown as AuthenticatedFetch };
}

describe('fetchDividendWithholding', () => {
  it('calls the authenticated endpoint with the selected year and signal', async () => {
    const { mock, request } = mockRequest({
      data: { records: [dividend] },
      error: null,
      meta: {}
    });
    const abort = new AbortController();

    await expect(
      fetchDividendWithholding(request, 2026, abort.signal)
    ).resolves.toEqual({ records: [dividend] });

    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/dividends?year=2026',
      expect.objectContaining({
        method: 'GET',
        signal: abort.signal
      })
    );
  });

  it('preserves decimal precision, nulls, currency and UTC date verbatim', async () => {
    const records = [
      dividend,
      {
        ...dividend,
        activityFee: '0',
        grossDividend: '0.000000000000000001',
        netDividend: '0',
        sourceActivityId: 'dividend-2',
        transactionCurrency: 'EUR',
        withholdingTax: '0'
      }
    ];
    const { request } = mockRequest({
      data: { records },
      error: null,
      meta: {}
    });

    expect((await fetchDividendWithholding(request, 2026)).records).toEqual(
      records
    );
  });

  it.each([1970, 2100])('accepts boundary dividend year %s', (year) => {
    expect(isValidDividendYear(year)).toBe(true);
  });

  it('accepts empty results without manufacturing data', async () => {
    const { request } = mockRequest({
      data: { records: [] },
      error: null,
      meta: {}
    });
    await expect(fetchDividendWithholding(request, 2026)).resolves.toEqual({
      records: []
    });
  });

  it.each([100, 0, 1969, 2101, 10000, 2026.5, Number.NaN])(
    'rejects invalid year %s before making a request',
    async (year) => {
      const { mock, request } = mockRequest({});
      expect(isValidDividendYear(year)).toBe(false);
      await expect(fetchDividendWithholding(request, year)).rejects.toThrow(
        'integer UTC calendar year between 1970 and 2100'
      );
      expect(mock).not.toHaveBeenCalled();
    }
  );

  it.each([
    { data: null, error: null, meta: {} },
    { data: { records: null }, error: null, meta: {} },
    {
      data: { records: [{ ...dividend, grossDividend: 1.25 }] },
      error: null,
      meta: {}
    },
    {
      data: { records: [{ ...dividend, withholdingTax: 0 }] },
      error: null,
      meta: {}
    },
    {
      data: { records: [{ ...dividend, netDividend: 0 }] },
      error: null,
      meta: {}
    },
    {
      data: { records: [{ ...dividend, date: '2026-01-01' }] },
      error: null,
      meta: {}
    }
  ])('rejects malformed response data', async (body) => {
    const { request } = mockRequest(body);
    await expect(fetchDividendWithholding(request, 2026)).rejects.toMatchObject(
      {
        code: 'INVALID_RESPONSE'
      }
    );
  });

  it.each([401, 403, 422, 500])(
    'preserves HTTP %s and Tax error code without leaking server text',
    async (status) => {
      const { request } = mockRequest(
        {
          data: null,
          error: { code: 'TAX_DIVIDENDS_FAILED', message: 'secret detail' },
          meta: {}
        },
        status
      );
      const error = await fetchDividendWithholding(request, 2026).catch(
        (failure: unknown) => failure
      );
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({ code: 'TAX_DIVIDENDS_FAILED', status });
      expect((error as Error).message).not.toContain('secret detail');
    }
  );
});
