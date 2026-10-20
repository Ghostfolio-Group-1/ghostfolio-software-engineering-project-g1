import { Type as ActivityType } from '@prisma/client';

import {
  averageCostTaxCalculator,
  fifoTaxCalculator,
  getTaxCalculator,
  type TaxCalculationMethod,
  type TaxRealizedGainActivitySource
} from './tax-calculator';

describe('TaxCalculator', () => {
  it('selects the FIFO calculator', () => {
    expect(getTaxCalculator('FIFO')).toBe(fifoTaxCalculator);
  });

  it('selects the average-cost calculator', () => {
    expect(getTaxCalculator('AVERAGE_COST')).toBe(averageCostTaxCalculator);
  });

  it('rejects an unsupported calculation method', () => {
    expect(() => getTaxCalculator('INVALID' as TaxCalculationMethod)).toThrow(
      'Unsupported tax calculation method: INVALID'
    );
  });

  it('produces numeric parity for FIFO and average cost on a single-lot sale', () => {
    const activities: TaxRealizedGainActivitySource[] = [
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2026-01-01T10:00:00.000Z'),
        fee: 10,
        id: 'buy-1',
        quantity: 10,
        symbolProfileId: 'asset-1',
        type: ActivityType.BUY,
        unitPrice: 100,
        userId: 'user-1'
      },
      {
        accountId: 'account-1',
        currency: 'USD',
        date: new Date('2026-01-02T10:00:00.000Z'),
        fee: 4,
        id: 'sell-1',
        quantity: 4,
        symbolProfileId: 'asset-1',
        type: ActivityType.SELL,
        unitPrice: 150,
        userId: 'user-1'
      }
    ];

    const fifoResult = fifoTaxCalculator.calculate(activities);

    const averageCostResult = averageCostTaxCalculator.calculate(activities);

    expect(fifoResult.sales).toHaveLength(1);
    expect(averageCostResult.sales).toHaveLength(1);

    const [fifoSale] = fifoResult.sales;
    const [averageCostSale] = averageCostResult.sales;

    expect(fifoSale.grossProceeds.toString()).toBe('600');
    expect(averageCostSale.grossProceeds.toString()).toBe('600');

    expect(fifoSale.grossCostBasis.toString()).toBe('400');
    expect(averageCostSale.grossCostBasis.toString()).toBe('400');

    expect(fifoSale.grossRealizedGain.toString()).toBe('200');
    expect(averageCostSale.grossRealizedGain.toString()).toBe('200');

    expect(fifoSale.allocatedBuyFees.toString()).toBe('4');
    expect(averageCostSale.allocatedAcquisitionFees.toString()).toBe('4');

    expect(fifoSale.sellFee.toString()).toBe('4');
    expect(averageCostSale.sellFee.toString()).toBe('4');

    expect(fifoSale.allocatedSellFee.toString()).toBe('4');

    expect(fifoSale.realizedGainAfterActivityFees.toString()).toBe('192');

    expect(averageCostSale.realizedGainAfterActivityFees.toString()).toBe(
      '192'
    );

    expect(fifoSale.realizedGainAfterActivityFees.toString()).toBe(
      averageCostSale.realizedGainAfterActivityFees.toString()
    );
  });
});
