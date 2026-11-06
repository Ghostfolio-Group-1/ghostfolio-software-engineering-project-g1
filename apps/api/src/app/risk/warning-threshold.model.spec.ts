import {
  getThresholdDefault,
  validateThresholds,
  WARNING_THRESHOLD_DEFAULTS
} from './warning-threshold.model';

describe('WARNING_THRESHOLD_DEFAULTS', () => {
  it('reconciles the apparent Sep 17 vs. proposal conflict: 10% is yellow, 25% is red', () => {
    const definition = getThresholdDefault('SingleStockConcentration');

    expect(definition.defaults.thresholdMax).toBe(0.1);
    expect(definition.defaults.redThresholdMax).toBe(0.25);
  });

  it('has exactly the 7 risk rules from docs/sesha-notes/07, Section 5', () => {
    const keys = WARNING_THRESHOLD_DEFAULTS.map((d) => d.ruleKey).sort();

    expect(keys).toEqual(
      [
        'CashAllocation',
        'CountryConcentration',
        'CurrencyClusterRiskCurrentInvestment',
        'PortfolioVolatility',
        'SectorConcentration',
        'SingleStockConcentration',
        'TargetAllocationDeviation'
      ].sort()
    );
  });
});

describe('validateThresholds', () => {
  it('accepts valid defaults unmodified', () => {
    expect(
      validateThresholds({ ruleKey: 'SingleStockConcentration', overrides: {} })
    ).toBeNull();
    expect(
      validateThresholds({ ruleKey: 'PortfolioVolatility', overrides: {} })
    ).toBeNull();
  });

  it('rejects a ceiling rule where thresholdMax is not below redThresholdMax', () => {
    const error = validateThresholds({
      ruleKey: 'SingleStockConcentration',
      overrides: { redThresholdMax: 0.1, thresholdMax: 0.1 }
    });

    expect(error).not.toBeNull();
  });

  it('rejects a band rule with out-of-order thresholds', () => {
    const error = validateThresholds({
      ruleKey: 'PortfolioVolatility',
      overrides: { thresholdMin: 0.3, thresholdMax: 0.2 }
    });

    expect(error).not.toBeNull();
  });

  it('rejects any value outside 0-1', () => {
    const error = validateThresholds({
      ruleKey: 'SingleStockConcentration',
      overrides: { thresholdMax: 1.5 }
    });

    expect(error).not.toBeNull();
  });

  it('rejects an unknown rule key', () => {
    const error = validateThresholds({ ruleKey: 'NotARule', overrides: {} });

    expect(error).not.toBeNull();
  });

  it('accepts a valid custom override', () => {
    const error = validateThresholds({
      ruleKey: 'SingleStockConcentration',
      overrides: { thresholdMax: 0.15, redThresholdMax: 0.3 }
    });

    expect(error).toBeNull();
  });

  // Regression: the real caller (validateThresholdUpdateInput in
  // risk-threshold.mapper.ts) always builds the overrides object with all 4
  // keys present, explicit `undefined` for anything the user didn't set -
  // not simply omitting the key, as the other tests in this file do. A
  // blind `{...defaults, ...overrides}` spread clobbers the default with
  // `undefined` for an explicitly-undefined key, which this test would have
  // caught: PortfolioVolatility's defaults (min 0.1, max 0.25) are
  // perfectly valid, and overriding only min to a still-valid 0.12 should
  // not be rejected just because max/redMax/redMin weren't also set.
  it('falls back to defaults for band fields explicitly left undefined, not just omitted', () => {
    const error = validateThresholds({
      ruleKey: 'PortfolioVolatility',
      overrides: {
        redThresholdMax: undefined,
        redThresholdMin: undefined,
        thresholdMax: undefined,
        thresholdMin: 0.12
      }
    });

    expect(error).toBeNull();
  });
});
