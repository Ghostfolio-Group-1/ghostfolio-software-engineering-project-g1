import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';

import {
  holdingsFixture,
  riskSummaryFixture
} from './contracts/risk-concentration.fixtures';
import {
  riskConcentrationResponseSchema,
  riskErrorResponseSchema
} from './contracts/risk-concentration.schema';
import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { RiskController } from './risk.controller';

describe('RiskController contract: GET /risk/concentration', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(riskConcentrationResponseSchema);
  const validateError = ajv.compile(riskErrorResponseSchema);
  const context = {
    userId: 'user-1',
    userSettings: { baseCurrency: 'USD' }
  } as unknown as ImpersonationContext;

  let buildRiskSummary: jest.SpyInstance;
  let controller: RiskController;
  let getHoldings: jest.Mock;

  beforeEach(async () => {
    getHoldings = jest.fn().mockResolvedValue(holdingsFixture);

    const moduleRef = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [
        ExposureCalculatorService,
        ExposureService,
        { provide: ExchangeRateDataService, useValue: {} },
        { provide: ImpersonationService, useValue: {} },
        { provide: PortfolioService, useValue: { getHoldings } }
      ]
    }).compile();

    controller = moduleRef.get(RiskController);
    buildRiskSummary = jest
      .spyOn(moduleRef.get(ExposureService), 'buildRiskSummary')
      .mockReturnValue(riskSummaryFixture);
  });

  it('is routed at /risk/concentration', () => {
    expect(Reflect.getMetadata('path', RiskController)).toBe('risk');
    expect(
      Reflect.getMetadata('path', RiskController.prototype.getConcentration)
    ).toBe('concentration');
  });

  it('matches the contract schema', async () => {
    const response = await controller.getConcentration(context);

    validateResponse(response);

    expect(validateResponse.errors ?? []).toEqual([]);
  });

  it('reads holdings for the token user and uses the base currency', async () => {
    await controller.getConcentration(context);

    expect(getHoldings).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: 'user-1'
    });
    expect(buildRiskSummary).toHaveBeenCalledWith(holdingsFixture, 'USD');
  });

  it('sorts buckets largest first and returns five by default', async () => {
    const { data } = await controller.getConcentration(context);

    expect(data.stock.buckets.map(({ value }) => value)).toEqual([
      'AAPL',
      'MSFT',
      'NVDA',
      'GOOG',
      'AMZN'
    ]);
    expect(data.stock.buckets[0].percentage).toBe(0.333);
    expect(data.country.buckets[0]).toEqual({
      name: 'US',
      percentage: 0.48,
      severity: 'NO_DATA',
      value: 'US'
    });
  });

  it('uses the holding name for stock buckets', async () => {
    const { data } = await controller.getConcentration(context);

    expect(data.stock.buckets[0].name).toBe('Apple Inc.');
    expect(data.stock.buckets[2].name).toBe('NVDA');
  });

  it('applies the limit query parameter', async () => {
    const { data } = await controller.getConcentration(context, '2');

    expect(data.stock.buckets).toHaveLength(2);
    expect(data.sector.buckets.map(({ value }) => value)).toEqual([
      'Technology',
      'UNKNOWN'
    ]);
  });

  it.each(['0', '21', 'abc', '1.5'])(
    'rejects limit=%s with a RISK_INVALID_QUERY envelope',
    async (limit) => {
      const exception = await controller.getConcentration(context, limit).then(
        () => {
          throw new Error('Expected the request to be rejected');
        },
        (error: HttpException) => error
      );

      expect(exception.getStatus()).toBe(400);
      expect(validateError(exception.getResponse())).toBe(true);
      expect(exception.getResponse()).toMatchObject({
        error: { code: 'RISK_INVALID_QUERY' }
      });
      expect(getHoldings).not.toHaveBeenCalled();
    }
  );

  it('fails validation when a bucket breaks the contract', () => {
    const broken = {
      data: {
        country: { buckets: [], thresholds: null },
        currency: { buckets: [], thresholds: null },
        sector: { buckets: [], thresholds: null },
        stock: {
          buckets: [{ name: 'Apple Inc.', percentage: 33.3, value: 'AAPL' }],
          thresholds: null
        }
      },
      error: null,
      meta: {}
    };

    expect(validateResponse(broken)).toBe(false);
  });
});
