import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { VolatilityCacheService } from './volatility-cache.service';
import { annualizedVolatility, computeDailyReturns } from './volatility.model';

function redisCacheServiceMock() {
  const store = new Map<string, string>();

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    })
  };
}

function marketDataItem({
  dataSource = 'YAHOO',
  dayOffset,
  marketPrice,
  symbol
}: {
  dataSource?: string;
  dayOffset: number;
  marketPrice: number;
  symbol: string;
}) {
  const date = new Date('2026-04-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return { dataSource, symbol, date, marketPrice };
}

// 25 days of prices, drifting slightly so returns aren't all identical.
function buildPriceSeries(symbol: string, start: number, step: number) {
  return Array.from({ length: 25 }, (_, day) =>
    marketDataItem({
      symbol,
      dayOffset: day,
      marketPrice: start + day * step + (day % 3 === 0 ? step : 0)
    })
  );
}

function holding({
  dataSource = 'YAHOO',
  symbol,
  value
}: {
  dataSource?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: { currency: 'USD', dataSource, symbol },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

describe('VolatilityCacheService', () => {
  describe('refresh()', () => {
    it('writes a cache payload whose per-symbol diagonal variance matches annualizedVolatility squared', async () => {
      const aaplSeries = buildPriceSeries('AAPL', 180, 1);
      const identifiers = [{ dataSource: 'YAHOO', symbol: 'AAPL' }];
      const prismaServiceMock = {
        symbolProfile: { findMany: jest.fn().mockResolvedValue(identifiers) }
      } as any;
      const marketDataServiceMock = {
        getRange: jest.fn().mockResolvedValue(aaplSeries)
      } as any;
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheService as any
      );

      await service.refresh();

      expect(prismaServiceMock.symbolProfile.findMany).toHaveBeenCalled();
      expect(marketDataServiceMock.getRange).toHaveBeenCalledWith(
        expect.objectContaining({ assetProfileIdentifiers: identifiers })
      );

      const [, storedValue] = redisCacheService.set.mock.calls[0];
      const payload = JSON.parse(storedValue);

      expect(payload.symbols['YAHOO:AAPL'].historyDays).toBe(24); // 25 prices -> 24 returns

      const prices = aaplSeries.map((item) => item.marketPrice);
      const expectedVariance =
        annualizedVolatility(computeDailyReturns({ prices, window: 90 })) ** 2;

      expect(payload.covariances['YAHOO:AAPL']['YAHOO:AAPL']).toBeCloseTo(
        expectedVariance,
        8
      );
    });

    it('does nothing when there are no symbol profiles at all', async () => {
      const prismaServiceMock = {
        symbolProfile: { findMany: jest.fn().mockResolvedValue([]) }
      } as any;
      const marketDataServiceMock = { getRange: jest.fn() } as any;
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheService as any
      );

      await service.refresh();

      expect(marketDataServiceMock.getRange).not.toHaveBeenCalled();
      expect(redisCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('getPortfolioVolatility()', () => {
    const buildServiceWithCache = async () => {
      const aaplSeries = buildPriceSeries('AAPL', 180, 1);
      const msftSeries = buildPriceSeries('MSFT', 320, -1);
      const identifiers = [
        { dataSource: 'YAHOO', symbol: 'AAPL' },
        { dataSource: 'YAHOO', symbol: 'MSFT' }
      ];
      const prismaServiceMock = {
        symbolProfile: { findMany: jest.fn().mockResolvedValue(identifiers) }
      } as any;
      const marketDataServiceMock = {
        getRange: jest.fn().mockResolvedValue([...aaplSeries, ...msftSeries])
      } as any;
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheService as any
      );

      await service.refresh();

      return service;
    };

    it('returns NO_DATA when the cache is empty', async () => {
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        {} as any,
        {} as any,
        redisCacheService as any
      );

      const result = await service.getPortfolioVolatility({
        baseCurrency: 'USD',
        holdings: [holding({ symbol: 'AAPL', value: 1 })]
      });

      expect(result).toEqual({ annualizedVolatility: null, historyDays: 0 });
    });

    it('returns a real annualized volatility when every held symbol has enough cached history', async () => {
      const service = await buildServiceWithCache();

      const result = await service.getPortfolioVolatility({
        baseCurrency: 'USD',
        holdings: [
          holding({ symbol: 'AAPL', value: 30000 }),
          holding({ symbol: 'MSFT', value: 60000 })
        ]
      });

      expect(result.historyDays).toBe(24);
      expect(result.annualizedVolatility).not.toBeNull();
      expect(result.annualizedVolatility).toBeGreaterThan(0);
    });

    it('degrades to NO_DATA when a held symbol has no cached history at all', async () => {
      const service = await buildServiceWithCache();

      const result = await service.getPortfolioVolatility({
        baseCurrency: 'USD',
        holdings: [
          holding({ symbol: 'AAPL', value: 30000 }),
          holding({ symbol: 'TSLA', value: 10000 }) // never cached
        ]
      });

      expect(result).toEqual({ annualizedVolatility: null, historyDays: 0 });
    });

    it('returns NO_DATA when the portfolio has no value', async () => {
      const service = await buildServiceWithCache();

      const result = await service.getPortfolioVolatility({
        baseCurrency: 'USD',
        holdings: []
      });

      expect(result).toEqual({ annualizedVolatility: null, historyDays: 0 });
    });
  });
});
