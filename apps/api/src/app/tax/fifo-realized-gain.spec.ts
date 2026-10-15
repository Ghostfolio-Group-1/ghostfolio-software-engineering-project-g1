import { Type as ActivityType } from '@prisma/client';
import { Big } from 'big.js';

import {
  calculateFifoRealizedGains,
  FifoRealizedGainActivitySource
} from './fifo-realized-gain';

describe('calculateFifoRealizedGains', () => {
  it('calculates gross and fee-adjusted gain for one complete lot', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 5,
        id: 'buy-1',
        quantity: 10,
        unitPrice: 100
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 2,
        id: 'sell-1',
        quantity: 10,
        type: ActivityType.SELL,
        unitPrice: 130
      })
    ]);

    expect(result.sales).toHaveLength(1);
    expect(result.sales[0].grossCostBasis.toString()).toBe('1000');
    expect(result.sales[0].grossProceeds.toString()).toBe('1300');
    expect(result.sales[0].grossRealizedGain.toString()).toBe('300');
    expect(result.sales[0].allocatedBuyFees.toString()).toBe('5');
    expect(result.sales[0].allocatedSellFee.toString()).toBe('2');
    expect(result.sales[0].realizedGainAfterActivityFees.toString()).toBe(
      '293'
    );
  });

  it('uses only the consumed portion of a BUY for a partial lot sale', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 5,
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
        unitPrice: 130
      })
    ]);

    const [sale] = result.sales;
    const [match] = sale.matches;

    expect(match.matchedQuantity.toString()).toBe('4');
    expect(match.grossAcquisitionValue.toString()).toBe('400');
    expect(match.grossProceeds.toString()).toBe('520');
    expect(match.grossRealizedGain.toString()).toBe('120');
    expect(match.buyFeeAllocated.toString()).toBe('2');
    expect(match.sellFeeAllocated.toString()).toBe('2');
    expect(match.realizedGainAfterActivityFees.toString()).toBe('116');
    expect(result.lots[0].remainingQuantity.toString()).toBe('6');
  });

  it('aggregates one SELL spanning multiple FIFO lots', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 2,
        id: 'buy-1',
        quantity: 100,
        unitPrice: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 1,
        id: 'buy-2',
        quantity: 50,
        unitPrice: 12
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        fee: 3,
        id: 'sell-1',
        quantity: 120,
        type: ActivityType.SELL,
        unitPrice: 15
      })
    ]);

    const [sale] = result.sales;

    expect(sale.matches).toHaveLength(2);
    expect(
      sale.matches.map((match) => ({
        buyActivityId: match.buyActivityId,
        matchedQuantity: match.matchedQuantity.toString(),
        grossAcquisitionValue: match.grossAcquisitionValue.toString(),
        grossProceeds: match.grossProceeds.toString(),
        buyFeeAllocated: match.buyFeeAllocated.toString(),
        sellFeeAllocated: match.sellFeeAllocated.toString()
      }))
    ).toEqual([
      {
        buyActivityId: 'buy-1',
        matchedQuantity: '100',
        grossAcquisitionValue: '1000',
        grossProceeds: '1500',
        buyFeeAllocated: '2',
        sellFeeAllocated: '2.5'
      },
      {
        buyActivityId: 'buy-2',
        matchedQuantity: '20',
        grossAcquisitionValue: '240',
        grossProceeds: '300',
        buyFeeAllocated: '0.4',
        sellFeeAllocated: '0.5'
      }
    ]);

    expect(sale.grossCostBasis.toString()).toBe('1240');
    expect(sale.grossProceeds.toString()).toBe('1800');
    expect(sale.grossRealizedGain.toString()).toBe('560');
    expect(sale.allocatedBuyFees.toString()).toBe('2.4');
    expect(sale.allocatedSellFee.toString()).toBe('3');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('554.6');
    expect(result.lots[0].remainingQuantity.toString()).toBe('0');
    expect(result.lots[1].remainingQuantity.toString()).toBe('30');
  });

  it('keeps realized losses negative', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-loss',
        quantity: 5,
        unitPrice: 20
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'sell-loss',
        quantity: 5,
        type: ActivityType.SELL,
        unitPrice: 15
      })
    ]);

    expect(result.sales[0].grossRealizedGain.toString()).toBe('-25');
    expect(result.sales[0].realizedGainAfterActivityFees.toString()).toBe(
      '-25'
    );
  });

  it('preserves fractional quantities and decimal-safe values', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
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

    expect(sale.grossCostBasis.toString()).toBe('5.1');
    expect(sale.grossProceeds.toString()).toBe('6.2');
    expect(sale.grossRealizedGain.toString()).toBe('1.1');
    expect(sale.allocatedBuyFees.toString()).toBe('0.1');
    expect(sale.allocatedSellFee.toString()).toBe('0.1');
    expect(sale.realizedGainAfterActivityFees.toString()).toBe('0.9');
  });

  it('assigns BUY fee division residual to the final lot consumption', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 1,
        id: 'buy-third',
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
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 11
      }),
      createActivity({
        date: new Date('2026-01-04T10:00:00.000Z'),
        id: 'sell-3',
        quantity: 1,
        type: ActivityType.SELL,
        unitPrice: 11
      })
    ]);

    const allocatedBuyFees = result.sales.flatMap(({ matches }) =>
      matches.map(({ buyFeeAllocated }) => buyFeeAllocated)
    );

    expect(allocatedBuyFees.map((fee) => fee.toString())).toEqual([
      '0.33333333333333333333',
      '0.33333333333333333333',
      '0.33333333333333333334'
    ]);
    expect(
      allocatedBuyFees
        .reduce((total, fee) => total.plus(fee), new Big(0))
        .toString()
    ).toBe('1');
  });

  it('rejects cross-currency gain arithmetic without historical FX conversion', () => {
    expect(() =>
      calculateFifoRealizedGains([
        createActivity({
          currency: 'USD',
          date: new Date('2026-01-01T10:00:00.000Z'),
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
      'FIFO realized gain requires historical FX conversion from USD to EUR for BUY buy-usd and SELL sell-eur.'
    );
  });

  it('rejects realized-gain arithmetic when a transaction currency is unknown', () => {
    expect(() =>
      calculateFifoRealizedGains([
        createActivity({
          currency: null,
          date: new Date('2026-01-01T10:00:00.000Z'),
          id: 'buy-unknown-currency',
          quantity: 1,
          unitPrice: 100
        }),
        createActivity({
          currency: 'USD',
          date: new Date('2026-01-02T10:00:00.000Z'),
          id: 'sell-usd',
          quantity: 1,
          type: ActivityType.SELL,
          unitPrice: 120
        })
      ])
    ).toThrow(
      'FIFO realized gain requires known transaction currencies for BUY buy-unknown-currency and SELL sell-usd.'
    );
  });

  it('assigns SELL fee division residual to the final match', () => {
    const result = calculateFifoRealizedGains([
      createActivity({
        date: new Date('2026-01-01T10:00:00.000Z'),
        id: 'buy-1',
        quantity: 1,
        unitPrice: 10
      }),
      createActivity({
        date: new Date('2026-01-02T10:00:00.000Z'),
        id: 'buy-2',
        quantity: 1,
        unitPrice: 10
      }),
      createActivity({
        date: new Date('2026-01-03T10:00:00.000Z'),
        id: 'buy-3',
        quantity: 1,
        unitPrice: 10
      }),
      createActivity({
        date: new Date('2026-01-04T10:00:00.000Z'),
        fee: 1,
        id: 'sell-3',
        quantity: 3,
        type: ActivityType.SELL,
        unitPrice: 11
      })
    ]);

    const [sale] = result.sales;

    expect(
      sale.matches.map(({ sellFeeAllocated }) => sellFeeAllocated.toString())
    ).toEqual([
      '0.33333333333333333333',
      '0.33333333333333333333',
      '0.33333333333333333334'
    ]);
    expect(sale.allocatedSellFee.toString()).toBe('1');
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
}: Partial<FifoRealizedGainActivitySource> = {}): FifoRealizedGainActivitySource {
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
