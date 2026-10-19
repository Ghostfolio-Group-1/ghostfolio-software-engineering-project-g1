import { Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

import {
  AverageCostRealizedGainActivitySource,
  calculateAverageCostRealizedGains
} from './average-cost-realized-gain';

describe('calculateAverageCostRealizedGains', () => {
  it('calculates the Issue #124 multi-BUY average-cost example exactly', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 10,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 20,
        id: 'buy-2',
        quantity: 10,
        unitPrice: 200
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        fee: 5,
        id: 'sell-1',
        quantity: 5,
        type: ActivityType.SELL,
        unitPrice: 250
      })
    ]);

    expect(result.sales).toHaveLength(1);

    const [sale] = result.sales;

    expect(sale.sellActivityId).toBe('sell-1');
    expect(sale.currency).toBe('USD');
    expect(sale.sellQuantity.toString()).toBe('5');

    expect(sale.grossProceeds.toString()).toBe('1250');
    expect(sale.grossCostBasis.toString()).toBe('750');
    expect(sale.grossRealizedGain.toString()).toBe('500');
    expect(sale.allocatedAcquisitionFees.toString()).toBe('7.5');
    expect(sale.sellFee.toString()).toBe('5');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('487.5');

    expect(sale.poolBefore.quantity.toString()).toBe('20');
    expect(sale.poolBefore.grossCost.toString()).toBe('3000');
    expect(sale.poolBefore.acquisitionFeePool.toString()).toBe('30');

    expect(sale.poolAfter.quantity.toString()).toBe('15');
    expect(sale.poolAfter.grossCost.toString()).toBe('2250');
    expect(sale.poolAfter.acquisitionFeePool.toString()).toBe('22.5');

    expect(result.pools[0].quantity.toString()).toBe('15');
    expect(result.pools[0].grossCost.toString()).toBe('2250');
    expect(result.pools[0].acquisitionFeePool.toString()).toBe('22.5');
  });

  it('updates the running pool between multiple SELL activities', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 10,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 2,
        id: 'sell-1',
        quantity: 4,
        type: ActivityType.SELL,
        unitPrice: 150
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        fee: 1,
        id: 'sell-2',
        quantity: 3,
        type: ActivityType.SELL,
        unitPrice: 80
      })
    ]);

    expect(result.sales).toHaveLength(2);

    const [firstSale, secondSale] = result.sales;

    expect(firstSale.grossProceeds.toString()).toBe('600');
    expect(firstSale.grossCostBasis.toString()).toBe('400');
    expect(firstSale.grossRealizedGain.toString()).toBe('200');
    expect(firstSale.allocatedAcquisitionFees.toString()).toBe('4');
    expect(firstSale.sellFee.toString()).toBe('2');
    expect(firstSale.realizedGainAfterActivityFees.toString()).toBe('194');

    expect(firstSale.poolAfter.quantity.toString()).toBe('6');
    expect(firstSale.poolAfter.grossCost.toString()).toBe('600');
    expect(firstSale.poolAfter.acquisitionFeePool.toString()).toBe('6');

    expect(secondSale.poolBefore.quantity.toString()).toBe('6');
    expect(secondSale.poolBefore.grossCost.toString()).toBe('600');
    expect(secondSale.poolBefore.acquisitionFeePool.toString()).toBe('6');

    expect(secondSale.grossProceeds.toString()).toBe('240');
    expect(secondSale.grossCostBasis.toString()).toBe('300');
    expect(secondSale.grossRealizedGain.toString()).toBe('-60');
    expect(secondSale.allocatedAcquisitionFees.toString()).toBe('3');
    expect(secondSale.sellFee.toString()).toBe('1');
    expect(secondSale.realizedGainAfterActivityFees.toString()).toBe('-64');

    expect(result.pools[0].quantity.toString()).toBe('3');
    expect(result.pools[0].grossCost.toString()).toBe('300');
    expect(result.pools[0].acquisitionFeePool.toString()).toBe('3');
  });

  it('assigns repeating fee-allocation residue to the final liquidation', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 1,
        id: 'buy-3',
        quantity: 3,
        unitPrice: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-1',
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 11
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-2',
        quantity: 2,
        type: ActivityType.SELL,
        unitPrice: 11
      })
    ]);

    expect(result.sales).toHaveLength(2);

    expect(
      result.sales.map(({ allocatedAcquisitionFees }) =>
        allocatedAcquisitionFees.toString()
      )
    ).toEqual(['0.33333333333333333333', '0.66666666666666666667']);

    expect(
      result.sales
        .reduce(
          (total, sale) => total.plus(sale.allocatedAcquisitionFees),
          new Big(0)
        )
        .toString()
    ).toBe('1');

    expect(
      result.sales
        .reduce((total, sale) => total.plus(sale.grossCostBasis), new Big(0))
        .toString()
    ).toBe('30');

    const [pool] = result.pools;

    expect(pool.quantity.toString()).toBe('0');
    expect(pool.grossCost.toString()).toBe('0');
    expect(pool.acquisitionFeePool.toString()).toBe('0');
  });

  it('starts a fresh basis after full liquidation and re-entry', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 2,
        id: 'buy-old',
        quantity: 2,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 1,
        id: 'sell-old',
        quantity: 2,
        type: ActivityType.SELL,
        unitPrice: 120
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        fee: 3,
        id: 'buy-new',
        quantity: 1,
        unitPrice: 300
      }),
      createActivity({
        date: new Date('2026-01-04T10:00:00.000Z'),
        fee: 0.5,
        id: 'sell-new',
        quantity: 0.5,
        type: ActivityType.SELL,
        unitPrice: 400
      })
    ]);

    expect(result.sales).toHaveLength(2);

    const [oldSale, newSale] = result.sales;

    expect(oldSale.grossCostBasis.toString()).toBe('200');
    expect(oldSale.grossProceeds.toString()).toBe('240');
    expect(oldSale.grossRealizedGain.toString()).toBe('40');
    expect(oldSale.allocatedAcquisitionFees.toString()).toBe('2');
    expect(oldSale.sellFee.toString()).toBe('1');
    expect(oldSale.realizedGainAfterActivityFees.toString()).toBe('37');

    expect(oldSale.poolAfter.quantity.toString()).toBe('0');
    expect(oldSale.poolAfter.grossCost.toString()).toBe('0');
    expect(oldSale.poolAfter.acquisitionFeePool.toString()).toBe('0');

    expect(newSale.poolBefore.quantity.toString()).toBe('1');
    expect(newSale.poolBefore.grossCost.toString()).toBe('300');
    expect(newSale.poolBefore.acquisitionFeePool.toString()).toBe('3');

    expect(newSale.grossProceeds.toString()).toBe('200');
    expect(newSale.grossCostBasis.toString()).toBe('150');
    expect(newSale.grossRealizedGain.toString()).toBe('50');
    expect(newSale.allocatedAcquisitionFees.toString()).toBe('1.5');
    expect(newSale.sellFee.toString()).toBe('0.5');
    expect(newSale.realizedGainAfterActivityFees.toString()).toBe('48');

    expect(result.pools[0].quantity.toString()).toBe('0.5');
    expect(result.pools[0].grossCost.toString()).toBe('150');
    expect(result.pools[0].acquisitionFeePool.toString()).toBe('1.5');
  });

  it('supports a cross-account SELL under the DR-5 user-and-asset pool', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        accountId: 'account-1',
        fee: 1,
        id: 'buy-account-1',
        quantity: 4,
        unitPrice: 10
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 0.5,
        id: 'sell-account-2',
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 20
      })
    ]);

    const [sale] = result.sales;

    expect(sale.grossProceeds.toString()).toBe('20');
    expect(sale.grossCostBasis.toString()).toBe('10');
    expect(sale.grossRealizedGain.toString()).toBe('10');
    expect(sale.allocatedAcquisitionFees.toString()).toBe('0.25');
    expect(sale.sellFee.toString()).toBe('0.5');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('9.25');

    expect(result.pools[0].quantity.toString()).toBe('3');
    expect(result.pools[0].grossCost.toString()).toBe('30');
    expect(result.pools[0].acquisitionFeePool.toString()).toBe('0.75');
  });

  it('keeps realized losses negative rather than clamping them to zero', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 1,
        id: 'buy-loss',
        quantity: 5,
        unitPrice: 20
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 2,
        id: 'sell-loss',
        quantity: 5,
        type: ActivityType.SELL,
        unitPrice: 15
      })
    ]);

    const [sale] = result.sales;

    expect(sale.grossProceeds.toString()).toBe('75');
    expect(sale.grossCostBasis.toString()).toBe('100');
    expect(sale.grossRealizedGain.toString()).toBe('-25');
    expect(sale.allocatedAcquisitionFees.toString()).toBe('1');
    expect(sale.sellFee.toString()).toBe('2');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('-28');
  });

  it('preserves fractional quantities and decimal-safe values', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 0.3,
        id: 'buy-fractional',
        quantity: 1.5,
        unitPrice: 10.2
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 0.1,
        id: 'sell-fractional',
        quantity: 0.5,
        type: ActivityType.SELL,
        unitPrice: 12.4
      })
    ]);

    const [sale] = result.sales;

    expect(sale.grossProceeds.toString()).toBe('6.2');
    expect(sale.grossCostBasis.toString()).toBe('5.1');
    expect(sale.grossRealizedGain.toString()).toBe('1.1');
    expect(sale.allocatedAcquisitionFees.toString()).toBe('0.1');
    expect(sale.sellFee.toString()).toBe('0.1');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('0.9');
  });

  it('isolates average-cost realized gain by asset', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        id: 'asset-1-buy',
        quantity: 2,
        symbolProfileId: 'asset-1',
        unitPrice: 100
      }),
      createActivity({
        id: 'asset-2-buy',
        quantity: 2,
        symbolProfileId: 'asset-2',
        unitPrice: 200
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'asset-1-sell',
        quantity: 1,
        symbolProfileId: 'asset-1',
        type: ActivityType.SELL,
        unitPrice: 150
      })
    ]);

    expect(result.sales).toHaveLength(1);

    const [sale] = result.sales;

    expect(sale.grossCostBasis.toString()).toBe('100');
    expect(sale.grossProceeds.toString()).toBe('150');
    expect(sale.grossRealizedGain.toString()).toBe('50');

    const asset1 = result.pools.find(
      ({ scope }) => scope.symbolProfileId === 'asset-1'
    );
    const asset2 = result.pools.find(
      ({ scope }) => scope.symbolProfileId === 'asset-2'
    );

    expect(asset1?.quantity.toString()).toBe('1');
    expect(asset1?.grossCost.toString()).toBe('100');

    expect(asset2?.quantity.toString()).toBe('2');
    expect(asset2?.grossCost.toString()).toBe('400');
  });

  it('isolates average-cost realized gain by user', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        id: 'user-1-buy',
        quantity: 2,
        unitPrice: 100,
        userId: 'user-1'
      }),
      createActivity({
        id: 'user-2-buy',
        quantity: 3,
        unitPrice: 200,
        userId: 'user-2'
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'user-1-sell',
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 150,
        userId: 'user-1'
      })
    ]);

    expect(result.sales).toHaveLength(1);

    const [sale] = result.sales;

    expect(sale.sellActivityId).toBe('user-1-sell');
    expect(sale.grossCostBasis.toString()).toBe('100');
    expect(sale.grossProceeds.toString()).toBe('150');
    expect(sale.grossRealizedGain.toString()).toBe('50');

    const user1Pool = result.pools.find(
      ({ scope }) => scope.userId === 'user-1'
    );
    const user2Pool = result.pools.find(
      ({ scope }) => scope.userId === 'user-2'
    );

    expect(user1Pool?.quantity.toString()).toBe('1');
    expect(user1Pool?.grossCost.toString()).toBe('100');

    expect(user2Pool?.quantity.toString()).toBe('3');
    expect(user2Pool?.grossCost.toString()).toBe('600');
  });

  it('preserves sale traceability through before and after pool snapshots', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        id: 'buy-1',
        quantity: 2,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-2',
        quantity: 1,
        unitPrice: 200
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-1',
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 180
      })
    ]);

    const [sale] = result.sales;

    expect(sale.poolBefore.sourceActivityIds).toEqual(['buy-1', 'buy-2']);

    expect(sale.poolAfter.sourceActivityIds).toEqual([
      'buy-1',
      'buy-2',
      'sell-1'
    ]);

    expect(sale.sellActivityId).toBe('sell-1');
    expect(sale.sellDate).toEqual(new Date('2026-01-03T10:00:00.000Z'));
  });

  it('returns no realized-gain sales when the input contains only BUY activities', () => {
    const result = calculateAverageCostRealizedGains([
      createActivity({
        fee: 2,
        id: 'buy-1',
        quantity: 2,
        unitPrice: 100
      })
    ]);

    expect(result.sales).toEqual([]);
    expect(result.pools).toHaveLength(1);
    expect(result.pools[0].quantity.toString()).toBe('2');
    expect(result.pools[0].grossCost.toString()).toBe('200');
    expect(result.pools[0].acquisitionFeePool.toString()).toBe('2');
  });

  it('rejects mixed currencies instead of performing invented FX conversion', () => {
    expect(() =>
      calculateAverageCostRealizedGains([
        createActivity({
          currency: 'USD',
          id: 'buy-usd',
          quantity: 1,
          unitPrice: 100
        }),
        createActivity({
          currency: 'EUR',
          date: new Date('2026-01-02T10:00:00.000Z'),
          id: 'sell-eur',
          quantity: 1,
          type: ActivityType.SELL,
          unitPrice: 120
        })
      ])
    ).toThrow(
      'Average-cost pool requires historical FX conversion from EUR to USD for activity sell-eur.'
    );
  });

  it('rejects realized-gain input with an unknown transaction currency', () => {
    expect(() =>
      calculateAverageCostRealizedGains([
        createActivity({
          currency: null,
          id: 'buy-unknown-currency'
        })
      ])
    ).toThrow(
      'Average-cost activity buy-unknown-currency requires a known transaction currency.'
    );
  });

  it('inherits the DR-3 exact-timestamp id ordering rule', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    expect(() =>
      calculateAverageCostRealizedGains([
        createActivity({
          date,
          id: 'b-buy',
          quantity: 2,
          unitPrice: 100
        }),
        createActivity({
          date,
          id: 'a-sell',
          quantity: 1,
          type: ActivityType.SELL,
          unitPrice: 120
        })
      ])
    ).toThrow('Average-cost SELL a-sell exceeds available holdings by 1.');
  });
});

function createActivity({
  accountId = 'account-1',
  currency = 'USD',
  date = new Date('2026-01-01T10:00:00.000Z'),
  fee = 0,
  id = 'buy-1',
  quantity = 1,
  symbolProfileId = 'asset-1',
  type = ActivityType.BUY,
  unitPrice = 1,
  userId = 'user-1'
}: Partial<AverageCostRealizedGainActivitySource> = {}): AverageCostRealizedGainActivitySource {
  return {
    accountId,
    currency,
    date,
    fee,
    id,
    quantity,
    symbolProfileId,
    type,
    unitPrice,
    userId
  };
}
