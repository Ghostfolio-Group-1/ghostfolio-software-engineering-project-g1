import { Type as ActivityType } from '@prisma/client';

import {
  AverageCostActivitySource,
  calculateAverageCostPools,
  orderAverageCostActivities
} from './average-cost';

describe('orderAverageCostActivities', () => {
  it('orders activities by date ascending and exact timestamp ties by id', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    const ordered = orderAverageCostActivities([
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'later'
      }),
      createActivity({
        date,
        id: 'buy-b'
      }),
      createActivity({
        date,
        id: 'buy-a'
      })
    ]);

    expect(ordered.map(({ id }) => id)).toEqual(['buy-a', 'buy-b', 'later']);
  });

  it('does not mutate the source activity array', () => {
    const activities = [
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'later'
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'earlier'
      })
    ];

    const originalOrder = activities.map(({ id }) => id);

    orderAverageCostActivities(activities);

    expect(activities.map(({ id }) => id)).toEqual(originalOrder);
  });
});

describe('calculateAverageCostPools', () => {
  it('builds the running quantity, gross-cost and acquisition-fee pool', () => {
    const [pool] = calculateAverageCostPools([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 5,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 3,
        id: 'buy-2',
        quantity: 5,
        unitPrice: 120
      })
    ]);

    expect(pool.quantity.toString()).toBe('15');
    expect(pool.grossCost.toString()).toBe('1600');
    expect(pool.acquisitionFeePool.toString()).toBe('8');
    expect(pool.sourceActivityIds).toEqual(['buy-1', 'buy-2']);

    expect(pool.grossCost.div(pool.quantity).toString()).toBe(
      '106.66666666666666666667'
    );
  });

  it('combines the same user and asset across different accounts', () => {
    const [pool] = calculateAverageCostPools([
      createActivity({
        accountId: 'account-1',
        id: 'buy-account-1',
        quantity: 2,
        unitPrice: 100
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-account-2',
        quantity: 3,
        unitPrice: 120
      })
    ]);

    expect(pool.scope).toEqual({
      userId: 'user-1',
      symbolProfileId: 'asset-1'
    });
    expect(pool.quantity.toString()).toBe('5');
    expect(pool.grossCost.toString()).toBe('560');
  });

  it('keeps different assets in separate pools', () => {
    const pools = calculateAverageCostPools([
      createActivity({
        id: 'asset-1-buy',
        quantity: 2,
        symbolProfileId: 'asset-1',
        unitPrice: 100
      }),
      createActivity({
        id: 'asset-2-buy',
        quantity: 3,
        symbolProfileId: 'asset-2',
        unitPrice: 50
      })
    ]);

    expect(pools).toHaveLength(2);

    const asset1 = pools.find(
      ({ scope }) => scope.symbolProfileId === 'asset-1'
    );
    const asset2 = pools.find(
      ({ scope }) => scope.symbolProfileId === 'asset-2'
    );

    expect(asset1?.quantity.toString()).toBe('2');
    expect(asset1?.grossCost.toString()).toBe('200');

    expect(asset2?.quantity.toString()).toBe('3');
    expect(asset2?.grossCost.toString()).toBe('150');
  });

  it('keeps different users in separate pools', () => {
    const pools = calculateAverageCostPools([
      createActivity({
        id: 'user-1-buy',
        userId: 'user-1'
      }),
      createActivity({
        id: 'user-2-buy',
        userId: 'user-2'
      })
    ]);

    expect(pools).toHaveLength(2);

    expect(pools.map(({ scope }) => scope.userId).sort()).toEqual([
      'user-1',
      'user-2'
    ]);
  });

  it('preserves fractional values without intermediate rounding', () => {
    const [pool] = calculateAverageCostPools([
      createActivity({
        fee: 0.1234,
        id: 'fractional-buy',
        quantity: 1.2345,
        unitPrice: 10.25
      })
    ]);

    expect(pool.quantity.toString()).toBe('1.2345');
    expect(pool.grossCost.toString()).toBe('12.653625');
    expect(pool.acquisitionFeePool.toString()).toBe('0.1234');
  });

  it('reduces quantity, gross cost and acquisition fees proportionally on a partial SELL', () => {
    const [pool] = calculateAverageCostPools([
      createActivity({
        fee: 15,
        id: 'buy-1',
        quantity: 15,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 2,
        id: 'sell-1',
        quantity: 6,
        type: ActivityType.SELL,
        unitPrice: 130
      })
    ]);

    expect(pool.quantity.toString()).toBe('9');
    expect(pool.grossCost.toString()).toBe('900');
    expect(pool.acquisitionFeePool.toString()).toBe('9');
    expect(pool.sourceActivityIds).toEqual(['buy-1', 'sell-1']);

    // The average gross unit cost remains unchanged after a proportional sale.
    expect(pool.grossCost.div(pool.quantity).toString()).toBe('100');
  });

  it('resets cost and acquisition-fee pools exactly to zero after a full SELL', () => {
    const [pool] = calculateAverageCostPools([
      createActivity({
        fee: 5,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-all',
        quantity: 10,
        type: ActivityType.SELL
      })
    ]);

    expect(pool.quantity.toString()).toBe('0');
    expect(pool.grossCost.toString()).toBe('0');
    expect(pool.acquisitionFeePool.toString()).toBe('0');
  });

  it('throws when a SELL exceeds the available average-cost pool', () => {
    expect(() =>
      calculateAverageCostPools([
        createActivity({
          id: 'buy-5',
          quantity: 5
        }),
        createActivity({
          date: new Date('2026-01-02T10:00:00.000Z'),
          id: 'sell-7',
          quantity: 7,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('Average-cost SELL sell-7 exceeds available holdings by 2.');
  });

  it('applies the DR-3 id tie-break before processing a same-timestamp SELL', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    expect(() =>
      calculateAverageCostPools([
        createActivity({
          date,
          id: 'b-buy',
          quantity: 5
        }),
        createActivity({
          date,
          id: 'a-sell',
          quantity: 2,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('Average-cost SELL a-sell exceeds available holdings by 2.');
  });

  it('rejects zero or negative quantities', () => {
    expect(() =>
      calculateAverageCostPools([
        createActivity({
          id: 'zero-buy',
          quantity: 0
        })
      ])
    ).toThrow('Average-cost BUY quantity must be greater than zero.');

    expect(() =>
      calculateAverageCostPools([
        createActivity({
          id: 'negative-sell',
          quantity: -1,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('Average-cost SELL quantity must be greater than zero.');
  });

  it('rejects unsupported activity types', () => {
    expect(() =>
      calculateAverageCostPools([
        createActivity({
          id: 'dividend-1',
          type: ActivityType.DIVIDEND
        })
      ])
    ).toThrow(
      'Average-cost input can only contain eligible BUY and SELL activities.'
    );
  });

  it('rejects a negative activity fee', () => {
    expect(() =>
      calculateAverageCostPools([
        createActivity({
          fee: -1,
          id: 'negative-fee'
        })
      ])
    ).toThrow('Average-cost BUY fee must not be negative.');
  });

  it('produces the same pool values on repeated execution', () => {
    const activities = [
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 3,
        id: 'buy-2',
        quantity: 5,
        unitPrice: 120
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 5,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      })
    ];

    const [first] = calculateAverageCostPools(activities);
    const [second] = calculateAverageCostPools(activities);

    expect({
      quantity: first.quantity.toString(),
      grossCost: first.grossCost.toString(),
      acquisitionFeePool: first.acquisitionFeePool.toString(),
      sourceActivityIds: first.sourceActivityIds
    }).toEqual({
      quantity: second.quantity.toString(),
      grossCost: second.grossCost.toString(),
      acquisitionFeePool: second.acquisitionFeePool.toString(),
      sourceActivityIds: second.sourceActivityIds
    });
  });
});

function createActivity(
  overrides: Partial<AverageCostActivitySource> = {}
): AverageCostActivitySource {
  return {
    accountId: 'account-1',
    date: new Date('2026-01-01T10:00:00.000Z'),
    fee: 0,
    id: 'buy-1',
    quantity: 1,
    symbolProfileId: 'asset-1',
    type: ActivityType.BUY,
    unitPrice: 100,
    userId: 'user-1',
    ...overrides
  };
}
