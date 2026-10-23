import { chartSeriesResponseSchema } from '@ghostfolio/api/app/charts/contracts/chart-series.schema';
import { fifoActivitiesSchema } from '@ghostfolio/api/app/tax/contracts/fifo-activity.schema';
import { consumeFifoTaxLots } from '@ghostfolio/api/app/tax/fifo-tax-lot';
import { createSuccessResponse } from '@ghostfolio/common/api-conventions';
import { toChartSeriesResponse } from '@ghostfolio/common/chart-series';

import Ajv from 'ajv';

import {
  FIXTURE_SYMBOL_PROFILE_IDS,
  dividendFixture,
  expectedFifoRemainingFixture,
  fifoActivitiesFrom,
  holdingsFixture,
  ordersFixture,
  performanceHistoryFixture
} from './portfolio.fixtures';

describe('shared portfolio fixtures', () => {
  const ajv = new Ajv({ allErrors: true });
  const fifoActivities = fifoActivitiesFrom(ordersFixture);

  it('selects only non-draft BUY and SELL orders for FIFO', () => {
    expect(fifoActivities.map(({ id }) => id)).toEqual([
      'fixture-order-01',
      'fixture-order-02',
      'fixture-order-03',
      'fixture-order-04',
      'fixture-order-06'
    ]);
  });

  it('matches the tax data contract', () => {
    const validate = ajv.compile(fifoActivitiesSchema);

    validate(JSON.parse(JSON.stringify(fifoActivities)));

    expect(validate.errors ?? []).toEqual([]);
  });

  it('produces the expected FIFO remaining quantities', () => {
    const { lots } = consumeFifoTaxLots(fifoActivities);
    const remaining = Object.fromEntries(
      lots.map(({ lotId, remainingQuantity }) => [
        lotId,
        remainingQuantity.toNumber()
      ])
    );

    expect(remaining).toEqual(expectedFifoRemainingFixture);
  });

  it('has holdings that match the FIFO remaining quantity per symbol', () => {
    const { lots } = consumeFifoTaxLots(fifoActivities);

    for (const { assetProfile, quantity } of holdingsFixture) {
      const symbolProfileId =
        FIXTURE_SYMBOL_PROFILE_IDS[
          assetProfile.symbol as keyof typeof FIXTURE_SYMBOL_PROFILE_IDS
        ];
      const fromLots = lots
        .filter(({ scope }) => scope.symbolProfileId === symbolProfileId)
        .reduce(
          (sum, { remainingQuantity }) => sum + remainingQuantity.toNumber(),
          0
        );

      expect(fromLots).toBe(quantity);
    }
  });

  it('has consistent dividend amounts', () => {
    const dividend = ordersFixture.find(
      ({ id }) => id === dividendFixture.orderId
    );

    expect(dividend.quantity * dividend.unitPrice).toBeCloseTo(
      dividendFixture.gross
    );
    expect(dividend.withholdingTax).toBe(dividendFixture.withholdingTax);
    expect(dividendFixture.gross - dividendFixture.withholdingTax).toBeCloseTo(
      dividendFixture.net
    );
  });

  it('produces a valid charts contract response', () => {
    const validate = ajv.compile(chartSeriesResponseSchema);
    const response = createSuccessResponse(
      toChartSeriesResponse({
        endDate: '2026-04-01',
        history: performanceHistoryFixture,
        startDate: '2026-01-05'
      })
    );

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
    expect(response.data.points.map(({ value }) => value)).toEqual([
      3000, 3950, 3970, 4100
    ]);
  });
});
