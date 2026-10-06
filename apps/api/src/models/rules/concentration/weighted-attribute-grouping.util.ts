import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import { Big } from 'big.js';

// A holding's sectors/countries are arrays of { ..., weight }, because a
// single holding (e.g. a diversified ETF) can span several buckets at once.
// Each holding's value must be split proportionally across its buckets
// before grouping, not assigned to a single bucket.
// Spec: docs/sesha-notes/03-concentration-formula-spec.md, Section 4.
const UNCATEGORIZED = 'UNKNOWN';

export interface WeightedBucket {
  key: string;
  value: number;
}

export function groupHoldingsByWeightedAttribute({
  baseCurrency,
  exchangeRateDataService,
  getBuckets,
  holdings
}: {
  baseCurrency: string;
  exchangeRateDataService: ExchangeRateDataService;
  getBuckets: (
    holding: PortfolioPosition
  ) => { key: string; weight: number }[] | undefined;
  holdings: PortfolioPosition[];
}): { buckets: WeightedBucket[]; totalValue: number } {
  const totalsByKey = new Map<string, number>();
  let totalValue = 0;

  for (const holding of holdings) {
    const holdingValue = exchangeRateDataService.toCurrency(
      new Big(holding.quantity).mul(holding.marketPrice ?? 0).toNumber(),
      holding.assetProfile.currency ?? baseCurrency,
      baseCurrency
    );

    totalValue += holdingValue;

    const buckets = getBuckets(holding);

    if (!buckets || buckets.length === 0) {
      totalsByKey.set(
        UNCATEGORIZED,
        (totalsByKey.get(UNCATEGORIZED) ?? 0) + holdingValue
      );
      continue;
    }

    for (const { key, weight } of buckets) {
      const allocatedValue = holdingValue * weight;
      totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + allocatedValue);
    }
  }

  const buckets = Array.from(totalsByKey.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);

  return { buckets, totalValue };
}
