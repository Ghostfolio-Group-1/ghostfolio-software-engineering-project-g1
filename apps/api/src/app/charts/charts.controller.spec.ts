import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { SymbolProfileService } from '@ghostfolio/api/services/symbol-profile/symbol-profile.service';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';

import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';
import { benchmarkComparisonResponseSchema } from './contracts/benchmark-comparison.schema';
import {
  chartSeriesResponseSchema,
  chartsErrorResponseSchema
} from './contracts/chart-series.schema';
import { drawdownResponseSchema } from './contracts/drawdown.schema';

const history = [
  {
    date: '2026-03-01',
    netWorth: 1000,
    totalInvestment: 900,
    netPerformanceInPercentageWithCurrencyEffect: 0
  },
  {
    date: '2026-03-02',
    netWorth: 1100,
    totalInvestment: 900,
    netPerformanceInPercentageWithCurrencyEffect: 0.1
  },
  {
    date: '2026-03-03',
    netWorth: 1050,
    totalInvestment: 950,
    netPerformanceInPercentageWithCurrencyEffect: 0.05
  }
];

describe('ChartsController contract: GET /charts/series', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(chartSeriesResponseSchema);
  const validateError = ajv.compile(chartsErrorResponseSchema);
  const context = { userId: 'user-1' } as unknown as ImpersonationContext;

  let controller: ChartsController;
  let getPerformance: jest.Mock;

  beforeEach(async () => {
    getPerformance = jest.fn().mockResolvedValue({
      chart: history,
      dateOfFirstActivity: new Date(2026, 2, 1)
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        ChartsApi,
        { provide: ImpersonationService, useValue: {} },
        { provide: MarketDataService, useValue: { getRange: jest.fn() } },
        { provide: PortfolioService, useValue: { getPerformance } },
        {
          provide: SymbolProfileService,
          useValue: { getSymbolProfiles: jest.fn() }
        }
      ]
    }).compile();

    controller = moduleRef.get(ChartsController);
  });

  it('is routed at /charts/series', () => {
    expect(Reflect.getMetadata('path', ChartsController)).toBe('charts');
    expect(
      Reflect.getMetadata('path', ChartsController.prototype.getSeries)
    ).toBe('series');
  });

  it('loads the full history for the token user on the server', async () => {
    await controller.getSeries(
      context,
      '2026-03-03',
      undefined,
      undefined,
      '2026-03-01'
    );

    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: 'user-1'
    });
  });

  it('returns real portfolio values in the contract envelope', async () => {
    const response = await controller.getSeries(
      context,
      '2026-03-03',
      undefined,
      undefined,
      '2026-03-01'
    );

    validateResponse(response);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(response.data).toEqual({
      endDate: '2026-03-03',
      granularity: 'daily',
      kind: 'portfolioValue',
      points: [
        { date: '2026-03-01', value: 1000 },
        { date: '2026-03-02', value: 1100 },
        { date: '2026-03-03', value: 1050 }
      ],
      startDate: '2026-03-01'
    });
  });

  it('returns invested capital when kind=investedCapital', async () => {
    const { data } = await controller.getSeries(
      context,
      '2026-03-03',
      'investedCapital',
      undefined,
      '2026-03-01'
    );

    expect(data.points.map(({ value }) => value)).toEqual([900, 900, 950]);
  });

  it('returns an empty series for an empty portfolio', async () => {
    getPerformance.mockResolvedValue({
      chart: [],
      dateOfFirstActivity: undefined
    });

    const response = await controller.getSeries(
      context,
      undefined,
      undefined,
      '1y'
    );

    expect(validateResponse(response)).toBe(true);
    expect(response.data.points).toEqual([]);
  });

  it('rejects range together with a custom range as CHARTS_INVALID_QUERY', async () => {
    const exception = await controller
      .getSeries(context, '2026-03-03', undefined, '1y', '2026-03-01')
      .then(
        () => {
          throw new Error('Expected the request to be rejected');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(validateError(exception.getResponse())).toBe(true);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'CHARTS_INVALID_QUERY' }
    });
  });

  it('fails validation when a point breaks the contract', () => {
    expect(
      validateResponse({
        data: {
          endDate: '2026-03-03',
          granularity: 'daily',
          kind: 'portfolioValue',
          points: [{ date: '2026-03-01', value: '1000' }],
          startDate: '2026-03-01'
        },
        error: null,
        meta: {}
      })
    ).toBe(false);
  });
});

describe('ChartsController contract: GET /charts/benchmark-comparison', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(benchmarkComparisonResponseSchema);
  const validateError = ajv.compile(chartsErrorResponseSchema);
  const context = { userId: 'user-1' } as unknown as ImpersonationContext;

  let controller: ChartsController;
  let getPerformance: jest.Mock;
  let getRange: jest.Mock;
  let getSymbolProfiles: jest.Mock;

  beforeEach(async () => {
    getPerformance = jest.fn().mockResolvedValue({
      chart: history,
      dateOfFirstActivity: new Date(2026, 2, 1)
    });
    getRange = jest.fn().mockResolvedValue([
      { date: new Date(2026, 2, 1), marketPrice: 100 },
      { date: new Date(2026, 2, 2), marketPrice: 110 },
      { date: new Date(2026, 2, 3), marketPrice: 105 }
    ]);
    getSymbolProfiles = jest
      .fn()
      .mockResolvedValue([{ symbol: 'SPY', dataSource: 'YAHOO' }]);

    const moduleRef = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        ChartsApi,
        { provide: ImpersonationService, useValue: {} },
        { provide: MarketDataService, useValue: { getRange } },
        { provide: PortfolioService, useValue: { getPerformance } },
        {
          provide: SymbolProfileService,
          useValue: { getSymbolProfiles }
        }
      ]
    }).compile();

    controller = moduleRef.get(ChartsController);
  });

  it('is routed at /charts/benchmark-comparison', () => {
    expect(
      Reflect.getMetadata(
        'path',
        ChartsController.prototype.getBenchmarkComparison
      )
    ).toBe('benchmark-comparison');
  });

  it('returns indexed portfolio and benchmark series in the contract envelope', async () => {
    const response = await controller.getBenchmarkComparison(
      context,
      'SPY',
      undefined,
      '2026-03-03',
      undefined,
      '2026-03-01'
    );

    validateResponse(response);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getSymbolProfiles).toHaveBeenCalledWith([
      { dataSource: 'YAHOO', symbol: 'SPY' }
    ]);
    expect(response.data).toEqual({
      benchmarkAvailableFrom: '2026-03-01',
      benchmarkSymbol: 'SPY',
      endDate: '2026-03-03',
      granularity: 'daily',
      startDate: '2026-03-01',
      points: [
        {
          date: '2026-03-01',
          portfolioReturn: 100,
          benchmarkReturn: 100
        },
        {
          date: '2026-03-02',
          portfolioReturn: (1100 / 1000) * 100,
          benchmarkReturn: (110 / 100) * 100
        },
        {
          date: '2026-03-03',
          portfolioReturn: (1050 / 1000) * 100,
          benchmarkReturn: (105 / 100) * 100
        }
      ]
    });
  });

  it('rejects a missing benchmark as CHARTS_INVALID_QUERY', async () => {
    const exception = await controller
      .getBenchmarkComparison(
        context,
        undefined,
        undefined,
        '2026-03-03',
        undefined,
        '2026-03-01'
      )
      .then(
        () => {
          throw new Error('Expected the request to be rejected');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(validateError(exception.getResponse())).toBe(true);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'CHARTS_INVALID_QUERY' }
    });
  });

  it('returns 404 CHARTS_BENCHMARK_NOT_FOUND when the symbol is unknown', async () => {
    getSymbolProfiles.mockResolvedValue([]);

    const exception = await controller
      .getBenchmarkComparison(
        context,
        'MISSING',
        undefined,
        '2026-03-03',
        undefined,
        '2026-03-01'
      )
      .then(
        () => {
          throw new Error('Expected the request to be rejected');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(404);
    expect(validateError(exception.getResponse())).toBe(true);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'CHARTS_BENCHMARK_NOT_FOUND' }
    });
  });
});

describe('ChartsController contract: GET /charts/drawdown', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateResponse = ajv.compile(drawdownResponseSchema);
  const validateError = ajv.compile(chartsErrorResponseSchema);
  const context = { userId: 'user-1' } as unknown as ImpersonationContext;

  let controller: ChartsController;
  let getPerformance: jest.Mock;

  beforeEach(async () => {
    getPerformance = jest.fn().mockResolvedValue({
      chart: history,
      dateOfFirstActivity: new Date(2026, 2, 1)
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        ChartsApi,
        { provide: ImpersonationService, useValue: {} },
        { provide: MarketDataService, useValue: { getRange: jest.fn() } },
        { provide: PortfolioService, useValue: { getPerformance } },
        {
          provide: SymbolProfileService,
          useValue: { getSymbolProfiles: jest.fn() }
        }
      ]
    }).compile();

    controller = moduleRef.get(ChartsController);
  });

  it('is routed at /charts/drawdown', () => {
    expect(
      Reflect.getMetadata('path', ChartsController.prototype.getDrawdown)
    ).toBe('drawdown');
  });

  it('returns drawdown points and maxDrawdown in the contract envelope', async () => {
    const response = await controller.getDrawdown(
      context,
      '2026-03-03',
      undefined,
      '2026-03-01'
    );

    validateResponse(response);

    expect(validateResponse.errors ?? []).toEqual([]);
    expect(getPerformance).toHaveBeenCalledWith({
      dateRange: 'max',
      userId: 'user-1'
    });
    const peak = 100 * (1 + 0.1);
    const trough = 100 * (1 + 0.05);
    const expectedDrawdown = (trough - peak) / peak;

    expect(response.data).toEqual({
      endDate: '2026-03-03',
      granularity: 'daily',
      maxDrawdown: expectedDrawdown,
      maxDrawdownDate: '2026-03-03',
      startDate: '2026-03-01',
      points: [
        { date: '2026-03-01', drawdown: 0, isNewPeak: true },
        { date: '2026-03-02', drawdown: 0, isNewPeak: true },
        {
          date: '2026-03-03',
          drawdown: expectedDrawdown,
          isNewPeak: false
        }
      ]
    });
  });

  it('rejects an invalid range as CHARTS_INVALID_QUERY', async () => {
    const exception = await controller
      .getDrawdown(context, '2026-03-01', undefined, '2026-03-03')
      .then(
        () => {
          throw new Error('Expected the request to be rejected');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(validateError(exception.getResponse())).toBe(true);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'CHARTS_INVALID_QUERY' }
    });
  });
});
