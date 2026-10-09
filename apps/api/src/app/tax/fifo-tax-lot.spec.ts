import { Type as ActivityType } from '@prisma/client';

import {
  createFifoTaxLots,
  FifoTaxActivitySource,
  orderFifoActivities
} from './fifo-tax-lot';

describe('orderFifoActivities', () => {
  it('orders activities by date ascending', () => {
    const later = createActivity({
      date: new Date('2026-01-03T10:00:00.000Z'),
      id: 'later'
    });
    const earlier = createActivity({
      date: new Date('2026-01-01T10:00:00.000Z'),
      id: 'earlier'
    });

    const ordered = orderFifoActivities([later, earlier]);

    expect(ordered.map((activity) => activity.id)).toEqual([
      'earlier',
      'later'
    ]);
  });

  it('orders exact same-date ties by activity id ascending', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    const ordered = orderFifoActivities([
      createActivity({ date, id: 'buy-b' }),
      createActivity({ date, id: 'buy-a' })
    ]);

    expect(ordered.map((activity) => activity.id)).toEqual(['buy-a', 'buy-b']);
  });

  it('uses the full timestamp before the id tie-breaker', () => {
    const ordered = orderFifoActivities([
      createActivity({
        date: new Date('2026-01-01T12:00:00.000Z'),
        id: 'activity-a'
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'activity-z'
      })
    ]);

    expect(ordered.map((activity) => activity.id)).toEqual([
      'activity-z',
      'activity-a'
    ]);
  });

  it('returns the same ordering on repeated execution without mutating input', () => {
    const activities = [
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-c'
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-b'
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-a'
      })
    ];
    const originalOrder = activities.map((activity) => activity.id);

    const firstRun = orderFifoActivities(activities);
    const secondRun = orderFifoActivities(activities);

    expect(firstRun.map((activity) => activity.id)).toEqual([
      'buy-a',
      'buy-b',
      'buy-c'
    ]);
    expect(secondRun.map((activity) => activity.id)).toEqual(
      firstRun.map((activity) => activity.id)
    );
    expect(activities.map((activity) => activity.id)).toEqual(originalOrder);
  });

  it('rejects non-BUY/SELL activities', () => {
    expect(() =>
      orderFifoActivities([
        createActivity({
          type: ActivityType.DIVIDEND
        })
      ])
    ).toThrow('FIFO input can only contain eligible BUY and SELL activities.');
  });
});

describe('createFifoTaxLots', () => {
  it('creates one deterministic lot for each BUY and does not consume SELLs', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    const lots = createFifoTaxLots([
      createActivity({
        date,
        id: 'buy-b',
        quantity: 2
      }),
      createActivity({
        date,
        id: 'sell-a',
        quantity: 1,
        type: ActivityType.SELL
      }),
      createActivity({
        date,
        id: 'buy-a',
        quantity: 3
      })
    ]);

    expect(lots.map((lot) => lot.sourceActivityId)).toEqual(['buy-a', 'buy-b']);
    expect(lots[0].initialQuantity.toString()).toBe('3');
    expect(lots[0].remainingQuantity.toString()).toBe('3');
    expect(lots[1].initialQuantity.toString()).toBe('2');
    expect(lots[1].remainingQuantity.toString()).toBe('2');
  });

  it('preserves fractional quantity exactly in the derived lot state', () => {
    const [lot] = createFifoTaxLots([
      createActivity({
        id: 'fractional-buy',
        quantity: 1.2345
      })
    ]);

    expect(lot.initialQuantity.toString()).toBe('1.2345');
    expect(lot.remainingQuantity.toString()).toBe('1.2345');
  });

  it('preserves source id, acquisition date, currency and FIFO scope', () => {
    const acquiredAt = new Date('2026-02-03T14:30:00.000Z');

    const [lot] = createFifoTaxLots([
      createActivity({
        accountId: 'account-1',
        currency: 'USD',
        date: acquiredAt,
        id: 'buy-source-1',
        symbolProfileId: 'asset-1',
        userId: 'user-1'
      })
    ]);

    expect(lot.lotId).toBe('buy-source-1');
    expect(lot.sourceActivityId).toBe('buy-source-1');
    expect(lot.acquiredAt).toBe(acquiredAt);
    expect(lot.currency).toBe('USD');
    expect(lot.scope).toEqual({
      userId: 'user-1',
      accountId: 'account-1',
      symbolProfileId: 'asset-1'
    });
  });

  it('preserves a null account as an unassigned FIFO scope', () => {
    const [lot] = createFifoTaxLots([
      createActivity({
        accountId: null,
        id: 'unassigned-buy'
      })
    ]);

    expect(lot.scope.accountId).toBeNull();
  });

  it('rejects zero or negative BUY quantities', () => {
    expect(() =>
      createFifoTaxLots([
        createActivity({
          id: 'zero-buy',
          quantity: 0
        })
      ])
    ).toThrow('FIFO BUY quantity must be greater than zero.');

    expect(() =>
      createFifoTaxLots([
        createActivity({
          id: 'negative-buy',
          quantity: -1
        })
      ])
    ).toThrow('FIFO BUY quantity must be greater than zero.');
  });
});

function createActivity({
  accountId = 'account-1',
  currency = 'USD',
  date = new Date('2026-01-01T10:00:00.000Z'),
  id = 'buy-1',
  quantity = 1,
  symbolProfileId = 'asset-1',
  type = ActivityType.BUY,
  userId = 'user-1'
}: Partial<FifoTaxActivitySource> = {}): FifoTaxActivitySource {
  return {
    accountId,
    currency,
    date,
    id,
    quantity,
    symbolProfileId,
    type,
    userId
  };
}
