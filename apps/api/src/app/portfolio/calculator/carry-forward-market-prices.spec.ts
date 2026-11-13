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
      })?.toNumber()
    ).toBe(348.51);
  });

  it('fills a missing end-date bar from the prior close', () => {
    const marketSymbolMap = {
      '2026-11-11': {
        [aapl]: new Big(348.51),
        [msft]: new Big(533.16)
      }
    };

    carryForwardMarketPricesToEndDate({
      assetProfileIdentifiers: [aapl, msft, 'YAHOO-MISSING'],
      endDateString: '2026-11-12',
      marketSymbolMap
    });

    expect(marketSymbolMap['2026-11-12'][aapl].toNumber()).toBe(348.51);
    expect(marketSymbolMap['2026-11-12'][msft].toNumber()).toBe(533.16);
    expect(marketSymbolMap['2026-11-12']['YAHOO-MISSING']).toBeUndefined();
  });

  it('does not overwrite an existing end-date bar', () => {
    const marketSymbolMap = {
      '2026-11-11': { [aapl]: new Big(348.51) },
      '2026-11-12': { [aapl]: new Big(350) }
    };

    carryForwardMarketPricesToEndDate({
      assetProfileIdentifiers: [aapl],
      endDateString: '2026-11-12',
      marketSymbolMap
    });

    expect(marketSymbolMap['2026-11-12'][aapl].toNumber()).toBe(350);
  });
});
