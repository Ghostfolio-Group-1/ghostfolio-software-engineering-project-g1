import { Big } from 'big.js';

export interface CarriedForwardMarketPrice {
  assetProfileIdentifier: string;
  fromDate: string;
  toDate: string;
}

interface MarketSymbolMap {
  [date: string]: { [assetProfileIdentifier: string]: Big };
}

/**
 * When the valuation end date has no market bar yet (weekend, holiday, or
 * UTC day-roll before the data provider publishes "today"), copy each
 * symbol's latest earlier price onto the end date so Overview / performance
 * do not fall back to a fake price of 1 and zero the portfolio.
 *
 * The returned entries are the signal that a stale price was used. Callers
 * should log them; a missing end-date bar must not disappear quietly.
 */
export function carryForwardMarketPricesToEndDate({
  assetProfileIdentifiers,
  endDateString,
  marketSymbolMap
}: {
  assetProfileIdentifiers: string[];
  endDateString: string;
  marketSymbolMap: MarketSymbolMap;
}): CarriedForwardMarketPrice[] {
  const carriedForward: CarriedForwardMarketPrice[] = [];

  for (const assetProfileIdentifier of assetProfileIdentifiers) {
    if (marketSymbolMap[endDateString]?.[assetProfileIdentifier]) {
      continue;
    }

    const latest = getLatestMarketPriceOnOrBefore({
      assetProfileIdentifier,
      endDateString,
      marketSymbolMap
    });

    if (!latest) {
      continue;
    }

    if (!marketSymbolMap[endDateString]) {
      marketSymbolMap[endDateString] = {};
    }

    marketSymbolMap[endDateString][assetProfileIdentifier] = latest.price;
    carriedForward.push({
      assetProfileIdentifier,
      fromDate: latest.date,
      toDate: endDateString
    });
  }

  return carriedForward;
}

export function getLatestMarketPriceOnOrBefore({
  assetProfileIdentifier,
  endDateString,
  marketSymbolMap
}: {
  assetProfileIdentifier: string;
  endDateString: string;
  marketSymbolMap: MarketSymbolMap;
}): { date: string; price: Big } | undefined {
  let latestDate: string | undefined;
  let latestPrice: Big | undefined;

  for (const date of Object.keys(marketSymbolMap)) {
    if (date > endDateString) {
      continue;
    }

    const price = marketSymbolMap[date]?.[assetProfileIdentifier];

    if (!price) {
      continue;
    }

    if (!latestDate || date > latestDate) {
      latestDate = date;
      latestPrice = price;
    }
  }

  if (!latestDate || !latestPrice) {
    return undefined;
  }

  return { date: latestDate, price: latestPrice };
}
