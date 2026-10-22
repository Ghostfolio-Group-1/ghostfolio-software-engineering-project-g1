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

// Weekday-only (Mon-Fri) price points, the same shape real MarketData rows
// actually have: calendar-day fixtures like buildPriceSeries() above never
// exercise the gap weekends (and the lookback window) leave behind.
function weekdayPriceSeries({
  count,
  dataSource = 'YAHOO',
  start = new Date('2026-01-05T00:00:00.000Z'), // a Monday
  step = 1,
  symbol
}: {
  count: number;
  dataSource?: string;
  start?: Date;
  step?: number;
  symbol: string;
}) {
  const items: ReturnType<typeof marketDataItem>[] = [];
  const cursor = new Date(start);
  let price = 100;

  while (items.length < count) {
    const dayOfWeek = cursor.getUTCDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      items.push({
        dataSource,
        symbol,
        date: new Date(cursor),
        marketPrice: price
      });
      price += step;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return items;
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

    // Regression test for a bug caught in review: fetching only
    // DEFAULT_VOLATILITY_WINDOW_DAYS (90) + a small buffer of CALENDAR days
    // leaves roughly 65-75 TRADING days once weekends are excluded, never
    // the intended 90 - and slice(-90) afterwards can't recover history
    // that was never fetched in the first place.
    it('requests enough calendar days to reliably cover 90 trading days, not just ~90 calendar days', async () => {
      const prismaServiceMock = {
        symbolProfile: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ dataSource: 'YAHOO', symbol: 'AAPL' }])
        }
      } as any;
      const marketDataServiceMock = {
        getRange: jest.fn().mockResolvedValue([])
      } as any;
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheServiceMock() as any
      );

      await service.refresh();

      const [{ dateQuery }] = marketDataServiceMock.getRange.mock.calls[0];
      const calendarDaysRequested = Math.round(
        (Date.now() - dateQuery.gte.getTime()) / (24 * 60 * 60 * 1000)
      );

      // 90 trading days needs at least 90 * 7/5 = 126 calendar days just to
      // clear weekends, before any holiday buffer.
      expect(calendarDaysRequested).toBeGreaterThanOrEqual(126);
    });

    it('produces a full 90-return window from realistic weekday-only price history, not a reduced one', async () => {
      const prices = weekdayPriceSeries({ symbol: 'AAPL', count: 130 });
      const prismaServiceMock = {
        symbolProfile: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ dataSource: 'YAHOO', symbol: 'AAPL' }])
        }
      } as any;
      const marketDataServiceMock = {
        getRange: jest.fn().mockResolvedValue(prices)
      } as any;
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheService as any
      );

      await service.refresh();

      const [, storedValue] = redisCacheService.set.mock.calls[0];
      const payload = JSON.parse(storedValue);

      // 130 trading days of history is available - the window should cap
      // at exactly 90, not fall short because of how the data was fetched.
      expect(payload.symbols['YAHOO:AAPL'].historyDays).toBe(90);
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

    // Parent issue #20's acceptance criterion, explicitly locked in: "a
    // newly-added symbol with 5 days of history returns NO_DATA, not a
    // misleadingly precise number."
    it('returns NO_DATA for a newly-added symbol with only 5 days of price history', async () => {
      const prices = weekdayPriceSeries({ symbol: 'NEWCO', count: 5 });
      const prismaServiceMock = {
        symbolProfile: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ dataSource: 'YAHOO', symbol: 'NEWCO' }])
        }
      } as any;
      const marketDataServiceMock = {
        getRange: jest.fn().mockResolvedValue(prices)
      } as any;
      const redisCacheService = redisCacheServiceMock();
      const service = new VolatilityCacheService(
        exchangeRateDataServiceMock,
        marketDataServiceMock,
        prismaServiceMock,
        redisCacheService as any
      );

      await service.refresh();

      const result = await service.getPortfolioVolatility({
        baseCurrency: 'USD',
        holdings: [holding({ symbol: 'NEWCO', value: 1000 })]
      });

      // 5 prices -> 4 returns, well under the 20-day minimum.
      expect(result).toEqual({ annualizedVolatility: null, historyDays: 4 });
    });
  });
});
