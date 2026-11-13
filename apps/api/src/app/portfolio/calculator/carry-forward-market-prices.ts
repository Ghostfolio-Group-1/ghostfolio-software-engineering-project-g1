import { Big } from 'big.js';

/**
 * When the valuation end date has no market bar yet (weekend, holiday, or
 * UTC day-roll before the data provider publishes "today"), copy each
 * symbol's latest earlier price onto the end date so Overview / performance
 * do not fall back to a fake price of 1 and zero the portfolio.
 */
export function carryForwardMarketPricesToEndDate({
  assetProfileIdentifiers,
  endDateString,
  marketSymbolMap
}: {
  assetProfileIdentifiers: string[];
  endDateString: string;
  marketSymbolMap: {
    [date: string]: { [assetProfileIdentifier: string]: Big };
  };
}): void {
  for (const assetProfileIdentifier of assetProfileIdentifiers) {
    if (marketSymbolMap[endDateString]?.[assetProfileIdentifier]) {
      continue;
    }

    const latestPrice = getLatestMarketPriceOnOrBefore({
      assetProfileIdentifier,
      endDateString,
      marketSymbolMap
    });

    if (!latestPrice) {
      continue;
    }

    if (!marketSymbolMap[endDateString]) {
      marketSymbolMap[endDateString] = {};
    }

    marketSymbolMap[endDateString][assetProfileIdentifier] = latestPrice;
  }
}

export function getLatestMarketPriceOnOrBefore({
  assetProfileIdentifier,
  endDateString,
  marketSymbolMap
}: {
  assetProfileIdentifier: string;
  endDateString: string;
  marketSymbolMap: {
    [date: string]: { [assetProfileIdentifier: string]: Big };
  };
}): Big | undefined {
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

  return latestPrice;
}
