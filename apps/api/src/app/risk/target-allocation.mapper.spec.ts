import { validateTargetAllocationInput } from './target-allocation.mapper';

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
