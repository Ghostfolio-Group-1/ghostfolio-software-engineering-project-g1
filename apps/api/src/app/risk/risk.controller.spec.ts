import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
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
import { riskScoreResponseSchema } from './contracts/risk-score.schema';
import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskEvaluationService } from './risk-evaluation.service';
import { RiskController } from './risk.controller';
import { ThresholdEngineService } from './threshold-engine.service';
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

describe('RiskController contract: GET /risk/concentration', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(riskConcentrationResponseSchema);
  const validateError = ajv.compile(riskErrorResponseSchema);
  const context = {
    scopes: [scopes.portfolioRead, scopes.portfolioReadValues],
    userId: 'user-1',
    userSettings: { baseCurrency: 'USD' }
  } as unknown as ImpersonationContext;
  const fullAccessRequest = {
    user: {
      settings: { settings: { isRestrictedView: false } },
      subscription: { type: 'Premium' }
    }
  };
  const fullAccessConfigurationService = {
    get: jest.fn().mockReturnValue(false)
  };

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
        HealthScoreCalculatorService,
        RiskEvaluationService,
        ThresholdEngineService,
        { provide: AccountService, useValue: { getCashDetails: jest.fn() } },
        {
          provide: ConfigurationService,
          useValue: fullAccessConfigurationService
        },
        { provide: ExchangeRateDataService, useValue: {} },
        { provide: ImpersonationService, useValue: {} },
        { provide: PortfolioService, useValue: { getHoldings } },
        { provide: REQUEST, useValue: fullAccessRequest },
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
          HealthScoreCalculatorService,
          RiskEvaluationService,
          ThresholdEngineService,
          { provide: AccountService, useValue: { getCashDetails } },
          {
            provide: ConfigurationService,
            useValue: fullAccessConfigurationService
          },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          { provide: REQUEST, useValue: fullAccessRequest },
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
          HealthScoreCalculatorService,
          RiskEvaluationService,
          ThresholdEngineService,
          {
            provide: AccountService,
            useValue: {
              getCashDetails: jest
                .fn()
                .mockResolvedValue({ balanceInBaseCurrency: 0 })
            }
          },
          {
            provide: ConfigurationService,
            useValue: fullAccessConfigurationService
          },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          { provide: REQUEST, useValue: fullAccessRequest },
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
          HealthScoreCalculatorService,
          RiskEvaluationService,
          ThresholdEngineService,
          {
            provide: AccountService,
            useValue: {
              getCashDetails: jest
                .fn()
                .mockResolvedValue({ balanceInBaseCurrency: 0 })
            }
          },
          {
            provide: ConfigurationService,
            useValue: fullAccessConfigurationService
          },
          { provide: ExchangeRateDataService, useValue: {} },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          { provide: REQUEST, useValue: fullAccessRequest },
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

  describe('GET /risk/score', () => {
    const validateScoreResponse = ajv.compile(riskScoreResponseSchema);

    async function createScoreController({
      configurationService = fullAccessConfigurationService,
      getCashDetails = jest
        .fn()
        .mockResolvedValue({ balanceInBaseCurrency: 0 }),
      getPortfolioVolatility = jest
        .fn()
        .mockResolvedValue({ annualizedVolatility: null, historyDays: 0 }),
      request = fullAccessRequest
    } = {}) {
      const moduleRef = await Test.createTestingModule({
        controllers: [RiskController],
        providers: [
          ExposureCalculatorService,
          ExposureService,
          HealthScoreCalculatorService,
          RiskEvaluationService,
          ThresholdEngineService,
          { provide: AccountService, useValue: { getCashDetails } },
          { provide: ConfigurationService, useValue: configurationService },
          {
            provide: ExchangeRateDataService,
            useValue: { toCurrency: (value: number) => value }
          },
          { provide: ImpersonationService, useValue: {} },
          { provide: PortfolioService, useValue: { getHoldings } },
          { provide: REQUEST, useValue: request },
          {
            provide: VolatilityCacheService,
            useValue: { getPortfolioVolatility }
          },
          { provide: WhatIfService, useValue: { calculateWhatIf: jest.fn() } }
        ]
      }).compile();

      return moduleRef.get(RiskController);
    }

    it('is routed at /risk/score', () => {
      expect(
        Reflect.getMetadata('path', RiskController.prototype.getScore)
      ).toBe('score');
    });

    it('matches the contract schema', async () => {
      jest
        .spyOn(ExposureService.prototype, 'getRiskSummary')
        .mockReturnValue(riskSummaryFixture);
      const scoreController = await createScoreController();

      const response = await scoreController.getScore(context);

      validateScoreResponse(response);

      expect(validateScoreResponse.errors ?? []).toEqual([]);
    });

    // Reproduces the SingleStockConcentration worked example from
    // docs/sesha-notes/10-risk-api-contract.md, Section 6.2: the fixture
    // portfolio's AAPL holding is 33.3% of the total, above the 25% red
    // limit, so the rule (and its concentration category) must come back RED.
    it('flags SingleStockConcentration as RED for a concentrated portfolio', async () => {
      getHoldings.mockResolvedValue(holdingsFixture);
      jest
        .spyOn(ExposureService.prototype, 'getRiskSummary')
        .mockReturnValue(riskSummaryFixture);
      const scoreController = await createScoreController();

      const { data } = await scoreController.getScore(context);

      const concentration = data.categories.find(
        (category) => category.key === 'concentration'
      );
      const singleStock = concentration?.rules?.find(
        (rule) => rule.key === 'SingleStockConcentration'
      );

      expect(singleStock?.severity).toBe('RED');
      expect(singleStock?.actual).toBe(0.333);
      expect(singleStock?.passed).toBe(false);
      expect(concentration?.severity).toBe('RED');
    });

    // Mirrors PortfolioController#getReport's X-Ray rule-hiding - Section 4
    // of docs/sesha-notes/10-risk-api-contract.md proposes the risk API
    // does the same: rules hidden, score/severity/weight still shown.
    it.each([
      {
        getContext: () => ({ ...context, scopes: [scopes.portfolioRead] }),
        getRequest: () => fullAccessRequest,
        name: 'lacks the portfolio:read:values scope'
      },
      {
        getContext: () => context,
        getRequest: () => ({
          user: {
            settings: { settings: { isRestrictedView: true } },
            subscription: { type: 'Premium' }
          }
        }),
        name: 'has isRestrictedView set'
      }
    ])(
      'hides rule-level detail when the caller $name',
      async ({ getContext, getRequest }) => {
        getHoldings.mockResolvedValue(holdingsFixture);
        jest
          .spyOn(ExposureService.prototype, 'getRiskSummary')
          .mockReturnValue(riskSummaryFixture);
        const scoreController = await createScoreController({
          request: getRequest()
        });

        const { data } = await scoreController.getScore(getContext());

        expect(data.categories.length).toBeGreaterThan(0);
        expect(
          data.categories.every((category) => category.rules === null)
        ).toBe(true);
        // Score, severity and weight are not gated - only the per-rule detail.
        expect(data.score).not.toBeNull();
      }
    );

    it('hides rule-level detail for a Basic subscriber when the subscription feature is enabled', async () => {
      getHoldings.mockResolvedValue(holdingsFixture);
      jest
        .spyOn(ExposureService.prototype, 'getRiskSummary')
        .mockReturnValue(riskSummaryFixture);
      const scoreController = await createScoreController({
        configurationService: { get: jest.fn().mockReturnValue(true) },
        request: {
          user: {
            settings: { settings: { isRestrictedView: false } },
            subscription: { type: 'Basic' }
          }
        }
      });

      const { data } = await scoreController.getScore(context);

      expect(data.categories.length).toBeGreaterThan(0);
      expect(data.categories.every((category) => category.rules === null)).toBe(
        true
      );
    });

    it('returns no valid-looking score for an empty portfolio with zero cash', async () => {
      // No holdings and no cash (createScoreController's default
      // getCashDetails already resolves to balanceInBaseCurrency: 0), and
      // VolatilityCacheService resolves to a null annualizedVolatility by
      // default here - every rule that depends on portfolio data is
      // NO_DATA, so every category is excluded and the top-level score must
      // be null, never a fake green or a fake fail.
      getHoldings.mockResolvedValue([]);
      jest.spyOn(ExposureService.prototype, 'getRiskSummary').mockReturnValue({
        concentration: { country: [], currency: [], sector: [], stock: [] },
        exposure: { assetClass: [], currency: [] },
        totalValue: 0
      });
      const scoreController = await createScoreController();

      const { data } = await scoreController.getScore(context);

      expect(data.categories).toEqual([]);
      expect(data.score).toBeNull();
      expect(data.grade).toBeNull();
      expect(data.excluded.map((excluded) => excluded.key).sort()).toEqual([
        'cash',
        'concentration',
        'volatility'
      ]);
    });
  });
});
