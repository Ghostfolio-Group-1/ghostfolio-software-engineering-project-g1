import { validateThresholdUpdateInput } from './risk-threshold.mapper';

// Gap-fill (issue #224): risk.controller.routes.spec.ts exercises most of
// this mapper's validation through the PUT route (unknown rule key,
// out-of-order overrides, ...), but never a PUT body with neither isActive
// nor thresholds set, nor one that only toggles isActive without touching
// thresholds - both real, documented (Section 6.9) branches with no
// coverage anywhere in the module.
describe('validateThresholdUpdateInput', () => {
  it('rejects a PUT body with neither isActive nor thresholds', () => {
    expect(
      validateThresholdUpdateInput('SingleStockConcentration', {})
    ).toEqual({
      code: 'RISK_THRESHOLD_OUT_OF_RANGE',
      message: 'At least one of isActive or thresholds must be present.'
    });
  });

  it('accepts a PUT that only toggles isActive, without touching thresholds', () => {
    expect(
      validateThresholdUpdateInput('SingleStockConcentration', {
        isActive: false
      })
    ).toBeNull();
  });
});
