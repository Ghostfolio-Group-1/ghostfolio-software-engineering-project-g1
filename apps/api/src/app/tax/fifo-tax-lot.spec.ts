import { Type as ActivityType } from '@prisma/client';

import {
  consumeFifoTaxLots,
  createFifoTaxLots,
  deriveFifoTaxLots,
  FifoTaxActivitySource,
  listOpenFifoTaxLots,
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

  it('reports cost basis as quantity times acquisition price in the activity currency', () => {
    const [lot] = createFifoTaxLots([
      createActivity({
        currency: 'USD',
        id: 'buy-10-at-50',
        quantity: 10,
        unitPrice: 50
      })
    ]);

    expect(lot.unitPrice.toString()).toBe('50');
    expect(lot.costBasis.toString()).toBe('500');
    expect(lot.currency).toBe('USD');
  });
});

describe('consumeFifoTaxLots', () => {
  it('partially consumes the oldest lot and leaves the correct remainder', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-4',
        quantity: 4,
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].lotId).toBe('buy-10');
    expect(result.consumptions[0].buyActivityId).toBe('buy-10');
    expect(result.consumptions[0].sellActivityId).toBe('sell-4');
    expect(result.consumptions[0].matchedQuantity.toString()).toBe('4');

    expect(result.lots).toHaveLength(1);
    expect(result.lots[0].initialQuantity.toString()).toBe('10');
    expect(result.lots[0].remainingQuantity.toString()).toBe('6');
  });

  it('consumes multiple lots in FIFO order for one sell', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-100',
        quantity: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-50',
        quantity: 50
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-120',
        quantity: 120,
        type: ActivityType.SELL
      })
    ]);

    expect(
      result.consumptions.map((consumption) => ({
        buyActivityId: consumption.buyActivityId,
        sellActivityId: consumption.sellActivityId,
        matchedQuantity: consumption.matchedQuantity.toString()
      }))
    ).toEqual([
      {
        buyActivityId: 'buy-100',
        sellActivityId: 'sell-120',
        matchedQuantity: '100'
      },
      {
        buyActivityId: 'buy-50',
        sellActivityId: 'sell-120',
        matchedQuantity: '20'
      }
    ]);

    expect(result.lots[0].remainingQuantity.toString()).toBe('0');
    expect(result.lots[1].remainingQuantity.toString()).toBe('30');
  });

  it('does not consume a fully closed lot again', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-first',
        quantity: 5
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-close-first',
        quantity: 5,
        type: ActivityType.SELL
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'buy-second',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-01-04T10:00:00.000Z'),
        id: 'sell-after-close',
        quantity: 4,
        type: ActivityType.SELL
      })
    ]);

    expect(
      result.consumptions.map((consumption) => ({
        buyActivityId: consumption.buyActivityId,
        matchedQuantity: consumption.matchedQuantity.toString()
      }))
    ).toEqual([
      {
        buyActivityId: 'buy-first',
        matchedQuantity: '5'
      },
      {
        buyActivityId: 'buy-second',
        matchedQuantity: '4'
      }
    ]);

    expect(result.lots[0].remainingQuantity.toString()).toBe('0');
    expect(result.lots[1].remainingQuantity.toString()).toBe('6');
  });

  it('preserves fractional quantities during partial consumption', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'fractional-buy',
        quantity: 1.2345
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'fractional-sell',
        quantity: 0.2345,
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions[0].matchedQuantity.toString()).toBe('0.2345');
    expect(result.lots[0].remainingQuantity.toString()).toBe('1');
  });

  it('keeps FIFO consumption inside the user/account/asset scope', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-account-1',
        quantity: 5
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-01T11:00:00.000Z'),
        id: 'buy-account-2',
        quantity: 7
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-account-2',
        quantity: 3,
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].buyActivityId).toBe('buy-account-2');
    expect(result.consumptions[0].matchedQuantity.toString()).toBe('3');
    expect(result.lots[0].remainingQuantity.toString()).toBe('5');
    expect(result.lots[1].remainingQuantity.toString()).toBe('4');
  });

  it('throws when a SELL exceeds available holdings after a partial match', () => {
    expect(() =>
      consumeFifoTaxLots([
        createActivity({
          date: new Date('2026-01-01T10:00:00.000Z'),
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
    ).toThrow('FIFO SELL sell-7 exceeds available holdings by 2.');
  });

  it('throws when a SELL has no matching open lot', () => {
    expect(() =>
      consumeFifoTaxLots([
        createActivity({
          id: 'sell-unmatched',
          quantity: 3,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('FIFO SELL sell-unmatched exceeds available holdings by 3.');
  });

  it('rejects zero or negative SELL quantities', () => {
    expect(() =>
      consumeFifoTaxLots([
        createActivity({
          id: 'sell-zero',
          quantity: 0,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('FIFO SELL quantity must be greater than zero.');

    expect(() =>
      consumeFifoTaxLots([
        createActivity({
          id: 'sell-negative',
          quantity: -1,
          type: ActivityType.SELL
        })
      ])
    ).toThrow('FIFO SELL quantity must be greater than zero.');
  });

  it('matches a same-timestamp SELL when the BUY id sorts first', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    const result = consumeFifoTaxLots([
      createActivity({
        date,
        id: 'a-buy',
        quantity: 5
      }),
      createActivity({
        date,
        id: 'b-sell',
        quantity: 2,
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].buyActivityId).toBe('a-buy');
    expect(result.consumptions[0].sellActivityId).toBe('b-sell');
    expect(result.consumptions[0].matchedQuantity.toString()).toBe('2');
    expect(result.lots[0].remainingQuantity.toString()).toBe('3');
  });

  it('throws for a same-timestamp SELL when the SELL id sorts first', () => {
    const date = new Date('2026-01-01T10:00:00.000Z');

    expect(() =>
      consumeFifoTaxLots([
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
    ).toThrow('FIFO SELL a-sell exceeds available holdings by 2.');
  });

  it('does not consume lots from another asset', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-asset-1',
        quantity: 5,
        symbolProfileId: 'asset-1'
      }),
      createActivity({
        date: new Date('2026-01-01T11:00:00.000Z'),
        id: 'buy-asset-2',
        quantity: 4,
        symbolProfileId: 'asset-2'
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-asset-2',
        quantity: 2,
        symbolProfileId: 'asset-2',
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].buyActivityId).toBe('buy-asset-2');
    expect(result.lots[0].remainingQuantity.toString()).toBe('5');
    expect(result.lots[1].remainingQuantity.toString()).toBe('2');
  });

  it('keeps null-account activity inside the null-account scope', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-account',
        quantity: 5
      }),
      createActivity({
        accountId: null,
        date: new Date('2026-01-01T11:00:00.000Z'),
        id: 'buy-null-account',
        quantity: 4
      }),
      createActivity({
        accountId: null,
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-null-account',
        quantity: 3,
        type: ActivityType.SELL
      })
    ]);

    expect(result.consumptions).toHaveLength(1);
    expect(result.consumptions[0].buyActivityId).toBe('buy-null-account');
    expect(result.lots[0].remainingQuantity.toString()).toBe('5');
    expect(result.lots[1].remainingQuantity.toString()).toBe('1');
  });

  it('produces the same lot and consumption state on repeated execution', () => {
    const activities = [
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-c',
        quantity: 6,
        type: ActivityType.SELL
      }),
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-a',
        quantity: 4
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-b',
        quantity: 5
      })
    ];

    const firstRun = summarizeConsumptionResult(consumeFifoTaxLots(activities));
    const secondRun = summarizeConsumptionResult(
      consumeFifoTaxLots(activities)
    );

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toEqual({
      lots: [
        {
          sourceActivityId: 'buy-a',
          remainingQuantity: '0'
        },
        {
          sourceActivityId: 'buy-b',
          remainingQuantity: '3'
        }
      ],
      consumptions: [
        {
          buyActivityId: 'buy-a',
          sellActivityId: 'sell-c',
          matchedQuantity: '4'
        },
        {
          buyActivityId: 'buy-b',
          sellActivityId: 'sell-c',
          matchedQuantity: '2'
        }
      ]
    });
  });

  it('keeps the cost basis of the remaining shares after a partial sale', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        currency: 'EUR',
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10,
        unitPrice: 50
      }),
      createActivity({
        currency: 'EUR',
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-4',
        quantity: 4,
        type: ActivityType.SELL,
        unitPrice: 80
      })
    ]);

    expect(result.lots[0].remainingQuantity.toString()).toBe('6');
    expect(result.lots[0].unitPrice.toString()).toBe('50');
    expect(result.lots[0].costBasis.toString()).toBe('300');
    expect(result.lots[0].currency).toBe('EUR');
  });

  it('uses each lot acquisition price for the shares that remain', () => {
    const result = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10,
        unitPrice: 50
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-5',
        quantity: 5,
        unitPrice: 80
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-12',
        quantity: 12,
        type: ActivityType.SELL,
        unitPrice: 90
      })
    ]);

    expect(result.lots[0].remainingQuantity.toString()).toBe('0');
    expect(result.lots[0].costBasis.toString()).toBe('0');
    expect(result.lots[1].remainingQuantity.toString()).toBe('3');
    expect(result.lots[1].costBasis.toString()).toBe('240');
  });
});

describe('listOpenFifoTaxLots', () => {
  it('starts a lot with its full buy quantity open', () => {
    const lots = createFifoTaxLots([
      createActivity({
        id: 'buy-10',
        quantity: 10
      })
    ]);

    expect(lots[0].remainingQuantity.toString()).toBe('10');
    expect(listOpenFifoTaxLots(lots).map((lot) => lot.lotId)).toEqual([
      'buy-10'
    ]);
  });

  it('reports the remainder as the open quantity after a partial sale', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-4',
        quantity: 4,
        type: ActivityType.SELL
      })
    ]);

    const [openLot] = listOpenFifoTaxLots(lots);

    expect(lots[0].remainingQuantity.toString()).toBe('6');
    expect(openLot.lotId).toBe('buy-10');
    expect(openLot.remainingQuantity.toString()).toBe('6');
  });

  it('reports zero for a fully sold lot and omits it from the open list', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-5',
        quantity: 5
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-10',
        quantity: 10,
        type: ActivityType.SELL
      })
    ]);

    expect(lots[0].remainingQuantity.toString()).toBe('0');
    expect(listOpenFifoTaxLots(lots).map((lot) => lot.lotId)).toEqual([
      'buy-5'
    ]);
    expect(listOpenFifoTaxLots(lots)[0].remainingQuantity.toString()).toBe('5');
  });

  it('shows one open row for each buy of the same symbol', () => {
    const openLots = listOpenFifoTaxLots(
      createFifoTaxLots([
        createActivity({
          date: new Date('2026-01-01T10:00:00.000Z'),
          id: 'buy-jan',
          quantity: 10,
          symbolProfileId: 'asset-aapl',
          unitPrice: 50
        }),
        createActivity({
          date: new Date('2026-02-01T10:00:00.000Z'),
          id: 'buy-feb',
          quantity: 4,
          symbolProfileId: 'asset-aapl',
          unitPrice: 80
        })
      ])
    );

    expect(openLots.map((lot) => lot.lotId)).toEqual(['buy-jan', 'buy-feb']);
    expect(openLots[0].remainingQuantity.toString()).toBe('10');
    expect(openLots[0].costBasis.toString()).toBe('500');
    expect(openLots[1].remainingQuantity.toString()).toBe('4');
    expect(openLots[1].costBasis.toString()).toBe('320');
  });

  it('reduces one open row on a partial sale and leaves the other intact', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-jan',
        quantity: 10,
        symbolProfileId: 'asset-aapl',
        unitPrice: 50
      }),
      createActivity({
        date: new Date('2026-02-01T10:00:00.000Z'),
        id: 'buy-feb',
        quantity: 4,
        symbolProfileId: 'asset-aapl',
        unitPrice: 80
      }),
      createActivity({
        date: new Date('2026-03-01T10:00:00.000Z'),
        id: 'sell-3',
        quantity: 3,
        symbolProfileId: 'asset-aapl',
        type: ActivityType.SELL,
        unitPrice: 90
      })
    ]);

    const openLots = listOpenFifoTaxLots(lots);

    expect(openLots.map((lot) => lot.lotId)).toEqual(['buy-jan', 'buy-feb']);
    expect(openLots[0].remainingQuantity.toString()).toBe('7');
    expect(openLots[0].costBasis.toString()).toBe('350');
    expect(openLots[1].remainingQuantity.toString()).toBe('4');
    expect(openLots[1].costBasis.toString()).toBe('320');
  });

  it('returns an empty list when the user has no buys', () => {
    expect(listOpenFifoTaxLots(createFifoTaxLots([]))).toEqual([]);
    expect(listOpenFifoTaxLots(consumeFifoTaxLots([]).lots)).toEqual([]);
  });

  it('returns an empty list after the entire position is sold', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-4',
        quantity: 4
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-all',
        quantity: 14,
        type: ActivityType.SELL
      })
    ]);

    expect(lots.map((lot) => lot.remainingQuantity.toString())).toEqual([
      '0',
      '0'
    ]);
    expect(listOpenFifoTaxLots(lots)).toEqual([]);
  });

  it('carries the BUY account on each lot', () => {
    const [lot] = createFifoTaxLots([
      createActivity({
        accountId: 'account-brokerage',
        id: 'buy-brokerage'
      })
    ]);

    expect(lot.scope.accountId).toBe('account-brokerage');
  });

  it('lists the same symbol in two accounts as separate lots', () => {
    const openLots = listOpenFifoTaxLots(
      createFifoTaxLots([
        createActivity({
          accountId: 'account-1',
          id: 'buy-account-1',
          quantity: 10,
          symbolProfileId: 'asset-aapl',
          unitPrice: 50
        }),
        createActivity({
          accountId: 'account-2',
          date: new Date('2026-01-02T10:00:00.000Z'),
          id: 'buy-account-2',
          quantity: 4,
          symbolProfileId: 'asset-aapl',
          unitPrice: 80
        })
      ])
    );

    expect(openLots).toHaveLength(2);
    expect(openLots[0].scope.accountId).toBe('account-1');
    expect(openLots[0].scope.symbolProfileId).toBe('asset-aapl');
    expect(openLots[0].remainingQuantity.toString()).toBe('10');
    expect(openLots[0].costBasis.toString()).toBe('500');

    expect(openLots[1].scope.accountId).toBe('account-2');
    expect(openLots[1].scope.symbolProfileId).toBe('asset-aapl');
    expect(openLots[1].remainingQuantity.toString()).toBe('4');
    expect(openLots[1].costBasis.toString()).toBe('320');
  });

  it('does not change the other account when one account is sold', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-account-1',
        quantity: 10,
        symbolProfileId: 'asset-aapl',
        unitPrice: 50
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-account-2',
        quantity: 4,
        symbolProfileId: 'asset-aapl',
        unitPrice: 80
      }),
      createActivity({
        accountId: 'account-2',
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-account-2',
        quantity: 1,
        symbolProfileId: 'asset-aapl',
        type: ActivityType.SELL,
        unitPrice: 90
      })
    ]);

    const openLots = listOpenFifoTaxLots(lots);

    const account1 = openLots.find(
      (lot) => lot.scope.accountId === 'account-1'
    );

    const account2 = openLots.find(
      (lot) => lot.scope.accountId === 'account-2'
    );

    expect(openLots).toHaveLength(2);

    expect(account1?.remainingQuantity.toString()).toBe('10');
    expect(account1?.costBasis.toString()).toBe('500');
    expect(account1?.scope.symbolProfileId).toBe('asset-aapl');

    expect(account2?.remainingQuantity.toString()).toBe('3');
    expect(account2?.costBasis.toString()).toBe('240');
    expect(account2?.scope.symbolProfileId).toBe('asset-aapl');
  });

  it('carries the BUY user id on each lot', () => {
    const [lot] = createFifoTaxLots([
      createActivity({
        id: 'buy-user-a',
        userId: 'user-a'
      })
    ]);

    expect(lot.scope.userId).toBe('user-a');
  });

  it('lists two users holding the same symbol as separate lots', () => {
    const openLots = listOpenFifoTaxLots(
      createFifoTaxLots([
        createActivity({
          accountId: 'account-1',
          id: 'buy-user-a',
          quantity: 10,
          symbolProfileId: 'asset-aapl',
          unitPrice: 50,
          userId: 'user-a'
        }),
        createActivity({
          accountId: 'account-1',
          date: new Date('2026-01-02T10:00:00.000Z'),
          id: 'buy-user-b',
          quantity: 4,
          symbolProfileId: 'asset-aapl',
          unitPrice: 80,
          userId: 'user-b'
        })
      ])
    );

    expect(openLots).toHaveLength(2);
    expect(openLots[0].scope.userId).toBe('user-a');
    expect(openLots[0].scope.accountId).toBe('account-1');
    expect(openLots[0].scope.symbolProfileId).toBe('asset-aapl');
    expect(openLots[0].remainingQuantity.toString()).toBe('10');
    expect(openLots[0].costBasis.toString()).toBe('500');
    expect(openLots[1].scope.userId).toBe('user-b');
    expect(openLots[1].scope.accountId).toBe('account-1');
    expect(openLots[1].scope.symbolProfileId).toBe('asset-aapl');
    expect(openLots[1].remainingQuantity.toString()).toBe('4');
    expect(openLots[1].costBasis.toString()).toBe('320');
  });

  it('does not reduce the other user when one user sells', () => {
    const { lots } = consumeFifoTaxLots([
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-user-b',
        quantity: 10,
        symbolProfileId: 'asset-aapl',
        unitPrice: 50,
        userId: 'user-b'
      }),
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-user-a',
        quantity: 4,
        symbolProfileId: 'asset-aapl',
        unitPrice: 80,
        userId: 'user-a'
      }),
      createActivity({
        accountId: 'account-1',
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'sell-user-a',
        quantity: 1,
        symbolProfileId: 'asset-aapl',
        type: ActivityType.SELL,
        unitPrice: 90,
        userId: 'user-a'
      })
    ]);

    const openLots = listOpenFifoTaxLots(lots);
    const userB = openLots.find((lot) => lot.scope.userId === 'user-b');
    const userA = openLots.find((lot) => lot.scope.userId === 'user-a');

    expect(openLots).toHaveLength(2);
    expect(userB?.remainingQuantity.toString()).toBe('10');
    expect(userB?.costBasis.toString()).toBe('500');
    expect(userA?.remainingQuantity.toString()).toBe('3');
    expect(userA?.costBasis.toString()).toBe('240');
  });
});

describe('deriveFifoTaxLots', () => {
  it('reports an untouched BUY lot as open', () => {
    const [lot] = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'buy-open',
        quantity: 10
      })
    ]);

    expect(lot.lotId).toBe('buy-open');
    expect(lot.sourceActivityId).toBe('buy-open');
    expect(lot.originalQuantity.toString()).toBe('10');
    expect(lot.consumedQuantity.toString()).toBe('0');
    expect(lot.remainingQuantity.toString()).toBe('10');
    expect(lot.status).toBe('OPEN');
    expect(lot.relatedSellActivityIds).toEqual([]);
  });

  it('reports a partially consumed lot with the correct quantities and SELL trace', () => {
    const [lot] = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'buy-partial',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-04-02T10:00:00.000Z'),
        id: 'sell-4',
        quantity: 4,
        type: ActivityType.SELL
      })
    ]);

    expect(lot.originalQuantity.toString()).toBe('10');
    expect(lot.consumedQuantity.toString()).toBe('4');
    expect(lot.remainingQuantity.toString()).toBe('6');
    expect(lot.status).toBe('PARTIALLY_CONSUMED');
    expect(lot.relatedSellActivityIds).toEqual(['sell-4']);
  });

  it('reports a fully consumed lot as closed', () => {
    const [lot] = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'buy-closed',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-04-02T10:00:00.000Z'),
        id: 'sell-10',
        quantity: 10,
        type: ActivityType.SELL
      })
    ]);

    expect(lot.originalQuantity.toString()).toBe('10');
    expect(lot.consumedQuantity.toString()).toBe('10');
    expect(lot.remainingQuantity.toString()).toBe('0');
    expect(lot.status).toBe('CLOSED');
    expect(lot.relatedSellActivityIds).toEqual(['sell-10']);
  });

  it('preserves multiple SELL ids for one partially consumed lot', () => {
    const [lot] = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'buy-10',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-04-02T10:00:00.000Z'),
        id: 'sell-3',
        quantity: 3,
        type: ActivityType.SELL
      }),
      createActivity({
        date: new Date('2026-04-03T10:00:00.000Z'),
        id: 'sell-2',
        quantity: 2,
        type: ActivityType.SELL
      })
    ]);

    expect(lot.consumedQuantity.toString()).toBe('5');
    expect(lot.remainingQuantity.toString()).toBe('5');
    expect(lot.status).toBe('PARTIALLY_CONSUMED');
    expect(lot.relatedSellActivityIds).toEqual(['sell-3', 'sell-2']);
  });

  it('preserves fractional quantities without rounding', () => {
    const [lot] = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'fractional-buy',
        quantity: 1.2345
      }),
      createActivity({
        date: new Date('2026-04-02T10:00:00.000Z'),
        id: 'fractional-sell',
        quantity: 0.2345,
        type: ActivityType.SELL
      })
    ]);

    expect(lot.originalQuantity.toString()).toBe('1.2345');
    expect(lot.consumedQuantity.toString()).toBe('0.2345');
    expect(lot.remainingQuantity.toString()).toBe('1');

    expect(lot.consumedQuantity.plus(lot.remainingQuantity).toString()).toBe(
      lot.originalQuantity.toString()
    );
  });

  it('returns an empty list when there are no activities', () => {
    expect(deriveFifoTaxLots([])).toEqual([]);
  });

  it('preserves the BUY source details needed by the tax-lot view', () => {
    const acquiredAt = new Date('2026-04-01T14:30:00.000Z');

    const [lot] = deriveFifoTaxLots([
      createActivity({
        accountId: 'account-7',
        currency: 'USD',
        date: acquiredAt,
        id: 'buy-trace',
        quantity: 8,
        symbolProfileId: 'asset-9',
        userId: 'user-5'
      })
    ]);

    expect(lot.sourceActivityId).toBe('buy-trace');
    expect(lot.acquiredAt).toBe(acquiredAt);
    expect(lot.currency).toBe('USD');

    expect(lot.scope).toEqual({
      userId: 'user-5',
      accountId: 'account-7',
      symbolProfileId: 'asset-9'
    });
  });

  it('keeps lot quantities numerically reconciled after multi-lot FIFO consumption', () => {
    const lots = deriveFifoTaxLots([
      createActivity({
        date: new Date('2026-04-01T10:00:00.000Z'),
        id: 'buy-first',
        quantity: 5
      }),
      createActivity({
        date: new Date('2026-04-02T10:00:00.000Z'),
        id: 'buy-second',
        quantity: 10
      }),
      createActivity({
        date: new Date('2026-04-03T10:00:00.000Z'),
        id: 'sell-8',
        quantity: 8,
        type: ActivityType.SELL
      })
    ]);

    expect(lots).toHaveLength(2);

    expect(lots[0].status).toBe('CLOSED');
    expect(lots[0].consumedQuantity.toString()).toBe('5');
    expect(lots[0].remainingQuantity.toString()).toBe('0');

    expect(lots[1].status).toBe('PARTIALLY_CONSUMED');
    expect(lots[1].consumedQuantity.toString()).toBe('3');
    expect(lots[1].remainingQuantity.toString()).toBe('7');

    for (const lot of lots) {
      expect(lot.consumedQuantity.plus(lot.remainingQuantity).toString()).toBe(
        lot.originalQuantity.toString()
      );
    }
  });
});

function summarizeConsumptionResult(
  result: ReturnType<typeof consumeFifoTaxLots>
) {
  return {
    lots: result.lots.map((lot) => ({
      sourceActivityId: lot.sourceActivityId,
      remainingQuantity: lot.remainingQuantity.toString()
    })),
    consumptions: result.consumptions.map((consumption) => ({
      buyActivityId: consumption.buyActivityId,
      sellActivityId: consumption.sellActivityId,
      matchedQuantity: consumption.matchedQuantity.toString()
    }))
  };
}

function createActivity({
  accountId = 'account-1',
  currency = 'USD',
  date = new Date('2026-01-01T10:00:00.000Z'),
  id = 'buy-1',
  quantity = 1,
  symbolProfileId = 'asset-1',
  type = ActivityType.BUY,
  unitPrice = 1,
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
    unitPrice,
    userId
  };
}
