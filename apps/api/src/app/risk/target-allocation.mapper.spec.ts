import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import {
  toTargetAllocationResponse,
  validateTargetAllocationInput
} from './target-allocation.mapper';
import { ThresholdEngineService } from './threshold-engine.service';

function holding({
  assetClass = 'EQUITY',
  assetSubClass = 'STOCK',
  symbol,
  value
}: {
  assetClass?: string;
  assetSubClass?: string;
  symbol: string;
  value: number;
}): PortfolioPosition {
  return {
    assetProfile: {
      assetClass,
      assetSubClass,
      currency: 'USD',
      symbol
    },
    quantity: value,
    marketPrice: 1
  } as unknown as PortfolioPosition;
}

const exchangeRateDataServiceMock = {
  toCurrency: (value: number) => value
} as any;

// Gap-fill (issue #224): the route-level spec covers duplicate keys, the
// sum-to-1 check and invalid assetClass keys, but never an individual
// percentage outside [0, 1] - validateTargetAllocationInput's other branch,
// uncovered until now.
describe('validateTargetAllocationInput', () => {
  it('rejects a negative percentage, independent of the sum check', () => {
    expect(
      validateTargetAllocationInput({
        groupBy: 'assetClass',
        targets: [
          { key: 'EQUITY', percentage: -0.2 },
          { key: 'CASH', percentage: 1.2 }
        ]
      })
    ).toEqual({
      code: 'RISK_TARGET_INVALID_SUM',
      message: 'percentage for "EQUITY" must be between 0 and 1 (got -0.2).'
    });
  });

  it('rejects a percentage above 1, even if the set still sums to 1', () => {
    expect(
      validateTargetAllocationInput({
        groupBy: 'assetClass',
        targets: [
          { key: 'EQUITY', percentage: 1.5 },
          { key: 'CASH', percentage: -0.5 }
        ]
      })
    ).toEqual({
      code: 'RISK_TARGET_INVALID_SUM',
      message: 'percentage for "EQUITY" must be between 0 and 1 (got 1.5).'
    });
  });

  it('accepts a percentage exactly at the 0 and 1 boundaries', () => {
    expect(
      validateTargetAllocationInput({
        groupBy: 'assetClass',
        targets: [
          { key: 'EQUITY', percentage: 1 },
          { key: 'CASH', percentage: 0 }
        ]
      })
    ).toBeNull();
  });
});

// Issue #323 (Tharun's review on PR #362): GET/PUT /risk/target-allocation
// builds its own TargetDeviation directly from PortfolioService's raw
// holdings, a separate code path from RiskEvaluationService.evaluate() -
// fixing the cash double-count there did not fix it here. Confirmed live
// against the demo-risk-concentrated-style scenario below: before this fix,
// a synthetic CASH-subclass holding both inflated totalValue AND grouped
// into its own stray "LIQUIDITY" assetClass bucket, alongside the separate
// "CASH" bucket TargetDeviation injects from cashBalance directly - two
// cash-like buckets instead of one, against an inflated total.
describe('toTargetAllocationResponse', () => {
  const thresholdEngineService = new ThresholdEngineService();

  it('excludes a synthetic CASH holding from totalValue and does not create a stray bucket for it', () => {
    const holdingsWithSyntheticCash = [
      holding({ symbol: 'AAPL', value: 9000 }),
      holding({ symbol: 'MSFT', value: 640 }),
      holding({
        assetClass: 'LIQUIDITY',
        assetSubClass: 'CASH',
        symbol: 'USD',
        value: 500
      })
    ];

    const response = toTargetAllocationResponse({
      baseCurrency: 'USD',
      cashBalance: 500,
      exchangeRateDataService: exchangeRateDataServiceMock,
      holdings: holdingsWithSyntheticCash,
      targetAllocation: {
        groupBy: 'assetClass',
        isActive: true,
        targets: [
          { key: 'EQUITY', percentage: 0.95 },
          { key: 'CASH', percentage: 0.05 }
        ]
      },
      thresholdEngineService
    });

    expect(response.buckets.find((bucket) => bucket.key === 'LIQUIDITY')).toBe(
      undefined
    );

    const equity = response.buckets.find((bucket) => bucket.key === 'EQUITY');
    const cash = response.buckets.find((bucket) => bucket.key === 'CASH');

    // totalValue is 9640 (holdings) + 500 (cashBalance) = 10140, not 10640.
    expect(equity.actual).toBeCloseTo(9640 / 10140, 4);
    expect(cash.actual).toBeCloseTo(500 / 10140, 4);
  });
});
