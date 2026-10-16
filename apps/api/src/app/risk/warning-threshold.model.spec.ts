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
});
