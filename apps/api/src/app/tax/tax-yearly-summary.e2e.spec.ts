import {
  E2E_NO_LOGIN,
  E2E_NO_SCOPES,
  createE2eApp,
  withE2eUser
} from '@ghostfolio/api/testing/e2e/e2e-app';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';
import { Big } from 'big.js';
import request from 'supertest';

import { taxErrorResponseSchema } from './contracts/tax-realized-gains.schema';
import { taxYearlySummaryResponseSchema } from './contracts/tax-yearly-summary.schema';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import type { YearlyTaxSummary } from './yearly-tax-summary';

const tiny = '0.000000000000000001';

const summaryFixture: YearlyTaxSummary = {
  year: 2026,
  method: 'FIFO',
  baseCurrency: 'USD',
  calculatedAt: new Date('2026-11-09T20:00:00.000Z'),
  grossDividendsBaseCurrency: new Big(tiny),
  totalWithholdingTaxBaseCurrency: null,
  netDividendsBaseCurrency: null,
  grossProceedsBaseCurrency: new Big('100.1'),
  grossCostBasisBaseCurrency: new Big('80'),
  grossRealizedGainBaseCurrency: new Big('20.1'),
  totalActivityFeesBaseCurrency: new Big('0.4'),
  realizedGainAfterActivityFeesBaseCurrency: new Big('19.7'),
  dividendCount: 1,
  disposalCount: 1,
  currencySummaries: [
    {
      currency: 'USD',
      totalGrossDividends: new Big(tiny),
      totalWithholdingTax: null,
      totalNetDividends: null,
      grossProceeds: new Big('100.1'),
      grossCostBasis: new Big('80'),
      grossRealizedGain: new Big('20.1'),
      allocatedFees: new Big('0.4'),
      realizedGainAfterActivityFees: new Big('19.7')
    }
  ],
  dividendRecords: [
    {
      sourceActivityId: 'dividend-1',
      accountId: 'account-1',
      symbolProfileId: 'asset-1',
      date: new Date('2026-06-01T00:00:00.000Z'),
      transactionCurrency: 'USD',
      grossDividend: new Big(tiny),
      withholdingTax: null,
      netDividend: null,
      activityFee: new Big('0'),
      baseCurrency: 'USD',
      grossDividendBaseCurrency: new Big(tiny),
      withholdingTaxBaseCurrency: null,
      netDividendBaseCurrency: null,
      activityFeeBaseCurrency: new Big('0')
    }
  ],
  realizedGains: [
    {
      accountId: 'account-1',
      symbolProfileId: 'asset-1',
      sellActivityId: 'sell-1',
      sellDate: new Date('2026-06-02T00:00:00.000Z'),
      transactionCurrency: 'USD',
      sellQuantity: new Big('2'),
      matchedQuantity: new Big('2'),
      grossProceeds: new Big('100.1'),
      grossCostBasis: new Big('80'),
      grossRealizedGain: new Big('20.1'),
      allocatedAcquisitionFees: new Big('0.3'),
      allocatedSellFees: new Big('0.1'),
      realizedGainAfterActivityFees: new Big('19.7'),
      baseCurrency: 'USD',
      totalActivityFees: new Big('0.4'),
      grossProceedsBaseCurrency: new Big('100.1'),
      grossCostBasisBaseCurrency: new Big('80'),
      grossRealizedGainBaseCurrency: new Big('20.1'),
      totalActivityFeesBaseCurrency: new Big('0.4'),
      realizedGainAfterActivityFeesBaseCurrency: new Big('19.7')
    }
  ],
  isComplete: false,
  warnings: [
    {
      code: 'UNKNOWN_DIVIDEND_WITHHOLDING',
      message: 'Withholding is unavailable for this dividend.',
      sourceActivityIds: ['dividend-1']
    }
  ],
  errors: []
};

describe('GET /api/v1/tax/yearly-summary (end to end)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(taxYearlySummaryResponseSchema);
  const validateError = ajv.compile(taxErrorResponseSchema);
  const getYearlySummary = jest.fn();
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp(
      withE2eUser(
        Test.createTestingModule({
          controllers: [TaxController],
          providers: [
            {
              provide: TaxService,
              useValue: { getYearlySummary }
            }
          ]
        }),
        {
          baseCurrency: FIXTURE_BASE_CURRENCY,
          userId: FIXTURE_USER_ID
        }
      )
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getYearlySummary.mockReset();
    getYearlySummary.mockImplementation(
      async (
        _userId: string,
        year: number,
        method: YearlyTaxSummary['method']
      ) => ({
        ...summaryFixture,
        year,
        method
      })
    );
  });

  it('returns schema-valid FIFO results with exact nested decimals, ISO dates and nulls', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026')
      .expect(200);

    expect(validateResponse(response.body)).toBe(true);
    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getYearlySummary).toHaveBeenCalledWith(
      FIXTURE_USER_ID,
      2026,
      'FIFO'
    );
    expect(response.body.data).toMatchObject({
      year: 2026,
      method: 'FIFO',
      calculatedAt: '2026-11-09T20:00:00.000Z',
      grossDividendsBaseCurrency: tiny,
      totalWithholdingTaxBaseCurrency: null,
      netDividendsBaseCurrency: null,
      dividendRecords: [
        {
          date: '2026-06-01T00:00:00.000Z',
          grossDividend: tiny,
          withholdingTax: null,
          netDividend: null
        }
      ],
      realizedGains: [
        {
          accountId: 'account-1',
          symbolProfileId: 'asset-1',
          sellDate: '2026-06-02T00:00:00.000Z',
          grossRealizedGain: '20.1',
          totalActivityFees: '0.4',
          realizedGainAfterActivityFees: '19.7'
        }
      ],
      isComplete: false
    });
    expect(JSON.stringify(response.body)).not.toContain('1e-18');
  });

  it('supports AVERAGE_COST and echoes the requested method', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026&method=AVERAGE_COST')
      .expect(200);
    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data.method).toBe('AVERAGE_COST');
    expect(getYearlySummary).toHaveBeenCalledWith(
      FIXTURE_USER_ID,
      2026,
      'AVERAGE_COST'
    );
  });

  it.each([1970, 2100])('accepts boundary year %s', async (year) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tax/yearly-summary?year=${year}`)
      .expect(200);
    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data.year).toBe(year);
  });

  it('returns a schema-valid complete empty year', async () => {
    getYearlySummary.mockResolvedValueOnce({
      ...summaryFixture,
      dividendCount: 0,
      disposalCount: 0,
      currencySummaries: [],
      dividendRecords: [],
      realizedGains: [],
      isComplete: true,
      warnings: [],
      errors: [],
      grossDividendsBaseCurrency: new Big('0'),
      totalWithholdingTaxBaseCurrency: new Big('0'),
      netDividendsBaseCurrency: new Big('0'),
      grossProceedsBaseCurrency: new Big('0'),
      grossCostBasisBaseCurrency: new Big('0'),
      grossRealizedGainBaseCurrency: new Big('0'),
      totalActivityFeesBaseCurrency: new Big('0'),
      realizedGainAfterActivityFeesBaseCurrency: new Big('0')
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026')
      .expect(200);
    expect(validateResponse(response.body)).toBe(true);
    expect(response.body.data.dividendCount).toBe(0);
    expect(response.body.data.realizedGains).toEqual([]);
  });

  it.each([
    '',
    '?year=1969',
    '?year=2101',
    '?year=26',
    '?year=2026.5',
    '?year=not-a-year',
    '?year=2026&method=OTHER',
    '?year=2026&method=',
    '?year=2026&method=FIFO&method=AVERAGE_COST',
    '?year=2026&year=2025'
  ])('returns TAX_INVALID_QUERY 400 for invalid query %s', async (query) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tax/yearly-summary${query}`)
      .expect(400);
    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('TAX_INVALID_QUERY');
    expect(getYearlySummary).not.toHaveBeenCalled();
  });

  it('returns a generic 422 error without disclosing internal details', async () => {
    getYearlySummary.mockRejectedValueOnce(
      new Error('secret database contents should not be returned')
    );
    const response = await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026')
      .expect(422);
    expect(validateError(response.body)).toBe(true);
    expect(response.body.error.code).toBe('TAX_YEARLY_SUMMARY_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('secret database');
  });

  it('requires portfolio-read scope', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026')
      .set(E2E_NO_SCOPES)
      .expect(403);
    expect(getYearlySummary).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tax/yearly-summary?year=2026')
      .set(E2E_NO_LOGIN)
      .expect(401);
    expect(getYearlySummary).not.toHaveBeenCalled();
  });
});
