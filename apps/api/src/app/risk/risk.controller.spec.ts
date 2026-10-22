import { AccountService } from '@ghostfolio/api/app/account/account.service';
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
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

describe('RiskController contract: GET /risk/concentration', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(riskConcentrationResponseSchema);
  const validateError = ajv.compile(riskErrorResponseSchema);
  const context = {
    userId: 'user-1',
    userSettings: { baseCurrency: 'USD' }
  } as unknown as ImpersonationContext;

  let getRiskSummary: jest.SpyInstance;
  let controller: RiskController;
  let getHoldings: jest.Mock;

  beforeEach(async () => {
    getHoldings = jest.fn().mockResolvedValue(holdingsFixture);

    const moduleRef = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [
        ExposureCalculatorService,
        ExposureService,
        { provide: AccountService, useValue: { getCashDetails: jest.fn() } },
        { provide: ExchangeRateDataService, useValue: {} },
        { provide: ImpersonationService, useValue: {} },
        { provide: PortfolioService, useValue: { getHoldings } },
        {
          provide: VolatilityCacheService,
          useValue: { getPortfolioVolatility: jest.fn() }
        },
        { provide: WhatIfService, useValue: { calculateWhatIf: jest.fn() } }
      ]
    }).compile();

    controller = moduleRef.get(RiskController);
    getRiskSummary = jest
      .spyOn(moduleRef.get(ExposureService), 'getRiskSummary')
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
    expect(getRiskSummary).toHaveBeenCalledWith(holdingsFixture, 'USD');
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

  describe('POST /risk/what-if', () => {
    it('is routed at /risk/what-if', () => {
      expect(
        Reflect.getMetadata('path', RiskController.prototype.postWhatIf)
      ).toBe('what-if');
    });

    it('loads holdings and cash details, then delegates to WhatIfService', async () => {
      const calculateWhatIf = jest.fn().mockReturnValue({ scenario: {} });
      const getCashDetails = jest
        .fn()
        .mockResolvedValue({ balanceInBaseCurrency: 5000 });
      const getPortfolioVolatility = jest
        .fn()
        .mockResolvedValue({ annualizedVolatility: 0.25, historyDays: 45 });
      const moduleRef = await Test.createTestingModule({
        controllers: [RiskController],
        providers: [
          ExposureCalculatorService,
          ExposureService,
          { provide: AccountService, useValue: { getCashDetails } },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          {
            provide: VolatilityCacheService,
            useValue: { getPortfolioVolatility }
          },
          { provide: WhatIfService, useValue: { calculateWhatIf } }
        ]
      }).compile();
      const whatIfController = moduleRef.get(RiskController);

      await whatIfController.postWhatIf(context, {
        dataSource: 'YAHOO',
        dropPercentage: 0.4,
        symbol: 'AAPL'
      });

      expect(getHoldings).toHaveBeenCalledWith({
        dateRange: 'max',
        userId: 'user-1'
      });
      expect(getCashDetails).toHaveBeenCalledWith({
        userId: 'user-1',
        currency: 'USD'
      });
      expect(getPortfolioVolatility).toHaveBeenCalledWith({
        baseCurrency: 'USD',
        holdings: holdingsFixture
      });
      // Proves the real VolatilityCacheService result actually reaches
      // WhatIfService - previously this was hardcoded to `undefined`.
      expect(calculateWhatIf).toHaveBeenCalledWith(
        expect.objectContaining({
          baseCurrency: 'USD',
          cashBalance: 5000,
          holdings: holdingsFixture,
          scenario: {
            dataSource: 'YAHOO',
            dropPercentage: 0.4,
            symbol: 'AAPL'
          },
          volatility: { annualizedVolatility: 0.25, historyDays: 45 }
        })
      );
    });

    it('maps a BadRequestException from WhatIfService to RISK_WHATIF_INVALID_DROP', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      const calculateWhatIf = jest.fn().mockImplementation(() => {
        throw new BadRequestException('dropPercentage must be greater than 0');
      });
      const moduleRef = await Test.createTestingModule({
        controllers: [RiskController],
        providers: [
          ExposureCalculatorService,
          ExposureService,
          {
            provide: AccountService,
            useValue: {
              getCashDetails: jest
                .fn()
                .mockResolvedValue({ balanceInBaseCurrency: 0 })
            }
          },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          {
            provide: VolatilityCacheService,
            useValue: { getPortfolioVolatility: jest.fn() }
          },
          { provide: WhatIfService, useValue: { calculateWhatIf } }
        ]
      }).compile();
      const whatIfController = moduleRef.get(RiskController);

      const exception = await whatIfController
        .postWhatIf(context, {
          dataSource: 'YAHOO',
          dropPercentage: 0,
          symbol: 'AAPL'
        })
        .then(
          () => {
            throw new Error('Expected the request to be rejected');
          },
          (error: HttpException) => error
        );

      expect(exception.getStatus()).toBe(400);
      expect(exception.getResponse()).toMatchObject({
        error: { code: 'RISK_WHATIF_INVALID_DROP' }
      });
    });

    it('maps a NotFoundException from WhatIfService to RISK_WHATIF_HOLDING_NOT_FOUND', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      const calculateWhatIf = jest.fn().mockImplementation(() => {
        throw new NotFoundException('No open holding found for YAHOO:TSLA');
      });
      const moduleRef = await Test.createTestingModule({
        controllers: [RiskController],
        providers: [
          ExposureCalculatorService,
          ExposureService,
          {
            provide: AccountService,
            useValue: {
              getCashDetails: jest
                .fn()
                .mockResolvedValue({ balanceInBaseCurrency: 0 })
            }
          },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          {
            provide: VolatilityCacheService,
            useValue: { getPortfolioVolatility: jest.fn() }
          },
          { provide: WhatIfService, useValue: { calculateWhatIf } }
        ]
      }).compile();
      const whatIfController = moduleRef.get(RiskController);

      const exception = await whatIfController
        .postWhatIf(context, {
          dataSource: 'YAHOO',
          dropPercentage: 0.4,
          symbol: 'TSLA'
        })
        .then(
          () => {
            throw new Error('Expected the request to be rejected');
          },
          (error: HttpException) => error
        );

      expect(exception.getStatus()).toBe(404);
      expect(exception.getResponse()).toMatchObject({
        error: { code: 'RISK_WHATIF_HOLDING_NOT_FOUND' }
      });
    });
  });

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
