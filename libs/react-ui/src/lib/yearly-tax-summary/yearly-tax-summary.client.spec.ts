import type { AuthenticatedFetch } from '../data/api-request';
import { ApiRequestError } from '../data/api-request';
import type { YearlyCostBasisMethod } from './yearly-tax-summary.client';
import {
  createYearlyTaxSummaryLoader,
  parseYearlyTaxSummary
} from './yearly-tax-summary.client';

const summary = {
  baseCurrency: 'USD',
  calculatedAt: '2026-11-09T12:00:00.000Z',
  currencySummaries: [
    {
      allocatedFees: '0.25',
      currency: 'USD',
      grossCostBasis: '5.1',
      grossProceeds: '10.1',
      grossRealizedGain: '5',
      realizedGainAfterActivityFees: '4.75',
      totalGrossDividends: '0.000000000000000001',
      totalNetDividends: null,
      totalWithholdingTax: null
    }
  ],
  dividendCount: 1,
  dividendRecords: [],
  disposalCount: 1,
  errors: [],
  grossCostBasisBaseCurrency: '5.1',
  grossDividendsBaseCurrency: '0.000000000000000001',
  grossProceedsBaseCurrency: '10.1',
  grossRealizedGainBaseCurrency: '5',
  isComplete: false,
  method: 'FIFO',
  netDividendsBaseCurrency: null,
  realizedGainAfterActivityFeesBaseCurrency: '4.75',
  realizedGains: [],
  totalActivityFeesBaseCurrency: '0.25',
  totalWithholdingTaxBaseCurrency: null,
  warnings: [
    {
      code: 'UNKNOWN_DIVIDEND_WITHHOLDING',
      message: 'Withholding tax is unknown.',
      sourceActivityIds: ['div-1']
    }
  ],
  year: 2026
};

describe('Yearly Tax summary API boundary', () => {
  it('preserves exact decimal strings, nullable fields and warning IDs', () => {
    const parsed = parseYearlyTaxSummary(summary, 2026, 'FIFO');
    expect(parsed.grossDividendsBaseCurrency).toBe('0.000000000000000001');
    expect(parsed.totalWithholdingTaxBaseCurrency).toBeNull();
    expect(parsed.currencySummaries[0].totalNetDividends).toBeNull();
    expect(parsed.warnings[0].sourceActivityIds).toEqual(['div-1']);
  });

  it.each([
    { ...summary, grossRealizedGainBaseCurrency: 5 },
    { ...summary, totalWithholdingTaxBaseCurrency: 0 },
    { ...summary, grossProceedsBaseCurrency: '1e-8' },
    { ...summary, year: 2025 },
    { ...summary, method: 'AVERAGE_COST' },
    { ...summary, dividendCount: -1 },
    {
      ...summary,
      currencySummaries: [
        { ...summary.currencySummaries[0], allocatedFees: 1.5 }
      ]
    },
    {
      ...summary,
      warnings: [{ code: 'BAD', message: 'x', sourceActivityIds: [23] }]
    },
    { ...summary, errors: null }
  ])('rejects invalid or stale API payloads', (payload) => {
    expect(() => parseYearlyTaxSummary(payload, 2026, 'FIFO')).toThrow(
      ApiRequestError
    );
  });

  it('accepts a genuinely complete empty year without inventing totals', () => {
    const empty = {
      ...summary,
      currencySummaries: [],
      dividendCount: 0,
      disposalCount: 0,
      isComplete: true,
      warnings: [],
      grossCostBasisBaseCurrency: '0',
      grossDividendsBaseCurrency: '0',
      grossProceedsBaseCurrency: '0',
      grossRealizedGainBaseCurrency: '0',
      netDividendsBaseCurrency: '0',
      realizedGainAfterActivityFeesBaseCurrency: '0',
      totalActivityFeesBaseCurrency: '0',
      totalWithholdingTaxBaseCurrency: '0'
    };
    expect(parseYearlyTaxSummary(empty, 2026, 'FIFO')).toMatchObject({
      currencySummaries: [],
      dividendCount: 0,
      disposalCount: 0,
      isComplete: true
    });
  });

  it('lets the authenticated host supply the exact agreed route and abort signal', async () => {
    const response = {
      json: jest
        .fn()
        .mockResolvedValue({ data: summary, error: null, meta: {} }),
      ok: true,
      status: 200
    } as unknown as Response;
    const request = jest.fn().mockResolvedValue(response);
    const buildPath = jest.fn(
      ({ year, method }: { year: number; method: YearlyCostBasisMethod }) =>
        `/test-fixture-only?year=${year}&method=${method}`
    );
    const loader = createYearlyTaxSummaryLoader(
      request as unknown as AuthenticatedFetch,
      buildPath
    );
    const signal = new AbortController().signal;

    expect(await loader({ method: 'FIFO', signal, year: 2026 })).toEqual(
      summary
    );
    expect(buildPath).toHaveBeenCalledWith({ method: 'FIFO', year: 2026 });
    expect(request).toHaveBeenCalledWith(
      '/test-fixture-only?year=2026&method=FIFO',
      expect.objectContaining({ method: 'GET', signal })
    );
  });
});
