import { Big } from 'big.js';

import {
  carryForwardMarketPricesToEndDate,
  getLatestMarketPriceOnOrBefore
} from './carry-forward-market-prices';

describe('carry-forward-market-prices', () => {
  const aapl = 'YAHOO-AAPL';
  const msft = 'YAHOO-MSFT';

  it('returns the latest price on or before the end date', () => {
    const marketSymbolMap = {
      '2026-11-10': { [aapl]: new Big(340) },
      '2026-11-11': { [aapl]: new Big(348.51) },
      '2026-11-13': { [aapl]: new Big(999) }
    };

    expect(
      getLatestMarketPriceOnOrBefore({
        assetProfileIdentifier: aapl,
        endDateString: '2026-11-12',
        marketSymbolMap
      })?.price.toNumber()
    ).toBe(348.51);
  });

  it('fills a missing end-date bar from the prior close and reports it', () => {
    const marketSymbolMap = {
      '2026-11-11': {
        [aapl]: new Big(348.51),
        [msft]: new Big(533.16)
      }
    };

    const carriedForward = carryForwardMarketPricesToEndDate({
      assetProfileIdentifiers: [aapl, msft, 'YAHOO-MISSING'],
      endDateString: '2026-11-12',
      marketSymbolMap
    });

    expect(marketSymbolMap['2026-11-12'][aapl].toNumber()).toBe(348.51);
    expect(marketSymbolMap['2026-11-12'][msft].toNumber()).toBe(533.16);
    expect(marketSymbolMap['2026-11-12']['YAHOO-MISSING']).toBeUndefined();
    expect(carriedForward).toEqual([
      {
        assetProfileIdentifier: aapl,
        fromDate: '2026-11-11',
        toDate: '2026-11-12'
      },
      {
        assetProfileIdentifier: msft,
        fromDate: '2026-11-11',
        toDate: '2026-11-12'
      }
    ]);
  });

  it('does not overwrite an existing end-date bar or flag it as stale', () => {
    const marketSymbolMap = {
      '2026-11-11': { [aapl]: new Big(348.51) },
      '2026-11-12': { [aapl]: new Big(350) }
    };

    const carriedForward = carryForwardMarketPricesToEndDate({
      assetProfileIdentifiers: [aapl],
      endDateString: '2026-11-12',
      marketSymbolMap
    });

    expect(marketSymbolMap['2026-11-12'][aapl].toNumber()).toBe(350);
    expect(carriedForward).toEqual([]);
  });
});
