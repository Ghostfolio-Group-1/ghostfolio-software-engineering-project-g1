import { RedisCacheService } from '@ghostfolio/api/app/redis-cache/redis-cache.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';

import {
  DatedPrice,
  alignPrices,
  annualizedCovariance,
  computeDatedDailyReturns,
  portfolioVolatilityFromMatrix
} from './covariance.model';
import { VolatilityInput } from './risk-evaluation.service';
import { DEFAULT_VOLATILITY_WINDOW_DAYS } from './volatility.model';

const CACHE_KEY = 'risk-volatility-matrix';
const CACHE_TTL_MS = 25 * 60 * 60 * 1000; // 25h: outlives one missed nightly run, not two.
const MINIMUM_HISTORY_DAYS = 20;
// DEFAULT_VOLATILITY_WINDOW_DAYS (90) counts TRADING days, not calendar
// days. Fetching only 90 + a small buffer of calendar days was a bug found
// in review: after weekends alone (~2/7 of all days) that leaves roughly
// 65-75 trading days, never the intended 90, and the later slice(-90) can't
// recover history that was never fetched. 90 trading days needs at least
// 90 * 7/5 = 126 calendar days just to clear weekends; the holiday buffer on
// top covers a typical market-holiday calendar so 90 trading days are
// reliably inside the fetched window whenever that much history exists.
const TRADING_TO_CALENDAR_DAY_RATIO = 7 / 5;
const HOLIDAY_BUFFER_DAYS = 15;
const LOOKBACK_CALENDAR_DAYS =
  Math.ceil(DEFAULT_VOLATILITY_WINDOW_DAYS * TRADING_TO_CALENDAR_DAY_RATIO) +
  HOLIDAY_BUFFER_DAYS;

interface CachedSymbolVolatility {
  historyDays: number;
}

interface VolatilityMatrixCachePayload {
  calculatedAt: string;
  covariances: Record<string, Record<string, number>>;
  symbols: Record<string, CachedSymbolVolatility>;
}

// Spec: docs/sesha-notes/04-volatility-cash-allocation-spec.md, Section 2.5 -
// issue #43 / parent #20. Moves the O(n^2) covariance calculation out of the
// request path: a nightly job (refreshVolatilityCache) computes one global
// symbol-by-symbol covariance matrix and caches it in Redis via the existing
// RedisCacheService; getPortfolioVolatility() (read side, called per
// request) combines the cached matrix with a specific portfolio's current
// weights - cheap, since the expensive part (pulling price history and
// computing covariances) already happened overnight.
@Injectable()
export class VolatilityCacheService {
  private readonly logger = new Logger(VolatilityCacheService.name);

  public constructor(
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly marketDataService: MarketDataService,
    private readonly prismaService: PrismaService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  public async refreshVolatilityCache(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.logger.error(
        'Volatility cache refresh failed',
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  public async refresh(): Promise<void> {
    const identifiers = await this.prismaService.symbolProfile.findMany({
      select: { dataSource: true, symbol: true }
    });

    if (identifiers.length === 0) {
      return;
    }

    const cutoff = subDays(new Date(), LOOKBACK_CALENDAR_DAYS);
    const marketData = await this.marketDataService.getRange({
      assetProfileIdentifiers: identifiers,
      dateQuery: { gte: cutoff }
    });

    const pricesBySymbol = new Map<string, DatedPrice[]>();

    for (const item of marketData) {
      const key = this.symbolKey(item);
      const prices = pricesBySymbol.get(key) ?? [];

      prices.push({
        date: item.date.toISOString().slice(0, 10),
        price: item.marketPrice
      });
      pricesBySymbol.set(key, prices);
    }

    const symbolKeys = [...pricesBySymbol.keys()];
    const symbols: Record<string, CachedSymbolVolatility> = {};

    for (const key of symbolKeys) {
      // A symbol's own history depth is independent of any other symbol -
      // no alignment needed against itself.
      const ownReturns = computeDatedDailyReturns(
        pricesBySymbol.get(key)
      ).slice(-DEFAULT_VOLATILITY_WINDOW_DAYS);

      symbols[key] = { historyDays: ownReturns.length };
    }

    const covariances: Record<string, Record<string, number>> = {};

    for (const rowKey of symbolKeys) {
      covariances[rowKey] = {};

      for (const columnKey of symbolKeys) {
        // Align at the price level (not by matching returns on their end
        // date) so every paired return covers the exact same two calendar
        // dates for both symbols - see alignPrices()'s own comment for why
        // that distinction matters.
        const { a: pricesA, b: pricesB } = alignPrices(
          pricesBySymbol.get(rowKey),
          pricesBySymbol.get(columnKey)
        );
        const returnsA = computeDatedDailyReturns(pricesA)
          .slice(-DEFAULT_VOLATILITY_WINDOW_DAYS)
          .map((entry) => entry.value);
        const returnsB = computeDatedDailyReturns(pricesB)
          .slice(-DEFAULT_VOLATILITY_WINDOW_DAYS)
          .map((entry) => entry.value);

        covariances[rowKey][columnKey] = annualizedCovariance(
          returnsA,
          returnsB
        );
      }
    }

    const payload: VolatilityMatrixCachePayload = {
      covariances,
      symbols,
      calculatedAt: new Date().toISOString()
    };

    await this.redisCacheService.set(
      CACHE_KEY,
      JSON.stringify(payload),
      CACHE_TTL_MS
    );
  }

  // Read side: combines the cached matrix with this specific portfolio's
  // current weights. Degrades to NO_DATA (annualizedVolatility: null) - never
  // a misleadingly precise number - when the cache is missing/corrupt, the
  // portfolio has no value, or any held symbol has under
  // MINIMUM_HISTORY_DAYS of cached history (including a symbol that isn't in
  // the cache at all, e.g. newly added and not yet covered by a nightly run).
  public async getPortfolioVolatility({
    baseCurrency,
    holdings
  }: {
    baseCurrency: string;
    holdings: PortfolioPosition[];
  }): Promise<VolatilityInput> {
    const payload = await this.readCache();

    if (!payload) {
      return { annualizedVolatility: null, historyDays: 0 };
    }

    const totalValue = holdings.reduce((sum, holding) => {
      return (
        sum +
        this.exchangeRateDataService.toCurrency(
          holding.quantity * (holding.marketPrice ?? 0),
          holding.assetProfile.currency ?? baseCurrency,
          baseCurrency
        )
      );
    }, 0);

    if (totalValue <= 0) {
      return { annualizedVolatility: null, historyDays: 0 };
    }

    const weights: Record<string, number> = {};
    let minHistoryDays = Infinity;

    for (const holding of holdings) {
      const key = this.symbolKey(holding.assetProfile);
      const value = this.exchangeRateDataService.toCurrency(
        holding.quantity * (holding.marketPrice ?? 0),
        holding.assetProfile.currency ?? baseCurrency,
        baseCurrency
      );

      weights[key] = (weights[key] ?? 0) + value / totalValue;
      minHistoryDays = Math.min(
        minHistoryDays,
        payload.symbols[key]?.historyDays ?? 0
      );
    }

    const historyDays = Number.isFinite(minHistoryDays) ? minHistoryDays : 0;

    if (historyDays < MINIMUM_HISTORY_DAYS) {
      return { annualizedVolatility: null, historyDays };
    }

    return {
      historyDays,
      annualizedVolatility: portfolioVolatilityFromMatrix({
        weights,
        matrix: payload.covariances
      })
    };
  }

  private async readCache(): Promise<VolatilityMatrixCachePayload | null> {
    const cached = await this.redisCacheService.get(CACHE_KEY);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as VolatilityMatrixCachePayload;
    } catch {
      return null;
    }
  }

  private symbolKey({
    dataSource,
    symbol
  }: {
    dataSource: string;
    symbol: string;
  }): string {
    return `${dataSource}:${symbol}`;
  }
}
