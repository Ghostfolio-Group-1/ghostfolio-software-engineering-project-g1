// Spec: docs/sesha-notes/07-warning-threshold-rules.md, Sections 5-6.
export type ThresholdShape = 'band' | 'ceiling';

export interface WarningThresholds {
  redThresholdMax?: number;
  redThresholdMin?: number;
  thresholdMax?: number;
  thresholdMin?: number;
}

export interface WarningThresholdDefault {
  defaults: WarningThresholds;
  ruleKey: string;
  shape: ThresholdShape;
}

export const WARNING_THRESHOLD_DEFAULTS: WarningThresholdDefault[] = [
  {
    ruleKey: 'SingleStockConcentration',
    shape: 'ceiling',
    defaults: { redThresholdMax: 0.25, thresholdMax: 0.1 }
  },
  {
    ruleKey: 'SectorConcentration',
    shape: 'ceiling',
    defaults: { redThresholdMax: 0.5, thresholdMax: 0.3 }
  },
  {
    ruleKey: 'CountryConcentration',
    shape: 'ceiling',
    defaults: { redThresholdMax: 0.75, thresholdMax: 0.5 }
  },
  {
    ruleKey: 'CurrencyClusterRiskCurrentInvestment',
    shape: 'ceiling',
    defaults: { redThresholdMax: 0.75, thresholdMax: 0.5 }
  },
  {
    ruleKey: 'TargetAllocationDeviation',
    shape: 'ceiling',
    defaults: { redThresholdMax: 0.1, thresholdMax: 0.05 }
  },
  {
    ruleKey: 'PortfolioVolatility',
    shape: 'band',
    defaults: {
      redThresholdMax: 0.35,
      redThresholdMin: 0.05,
      thresholdMax: 0.25,
      thresholdMin: 0.1
    }
  },
  {
    ruleKey: 'CashAllocation',
    shape: 'band',
    defaults: {
      redThresholdMax: 0.3,
      redThresholdMin: 0.005,
      thresholdMax: 0.15,
      thresholdMin: 0.02
    }
  }
];

export function getThresholdDefault(
  ruleKey: string
): WarningThresholdDefault | undefined {
  return WARNING_THRESHOLD_DEFAULTS.find((entry) => entry.ruleKey === ruleKey);
}

// Field-by-field fallback, not an object spread: a caller's `overrides` can
// have all 4 keys present with some explicitly `undefined` (e.g. a partial
// PUT body, or a ThresholdEngineInput built from a RuleSettings override
// that only customizes one field) - `{ ...defaults, ...overrides }` would
// copy that explicit `undefined` over the default instead of falling back
// to it, silently breaking any partial override. Every place that merges a
// rule's defaults with a possibly-partial override (validation, severity,
// and warning generation) must go through this, not re-spread inline.
export function mergeThresholds(
  defaults: WarningThresholds,
  overrides?: WarningThresholds
): WarningThresholds {
  return {
    redThresholdMax: overrides?.redThresholdMax ?? defaults.redThresholdMax,
    redThresholdMin: overrides?.redThresholdMin ?? defaults.redThresholdMin,
    thresholdMax: overrides?.thresholdMax ?? defaults.thresholdMax,
    thresholdMin: overrides?.thresholdMin ?? defaults.thresholdMin
  };
}

export interface ThresholdValidationError {
  message: string;
}

// Validates a (possibly partial) user override against its rule's shape.
// Any field left undefined falls back to the default before being checked,
// so a partial override can never produce an internally-inconsistent set.
export function validateThresholds({
  overrides,
  ruleKey
}: {
  overrides: WarningThresholds;
  ruleKey: string;
}): ThresholdValidationError | null {
  const definition = getThresholdDefault(ruleKey);

  if (!definition) {
    return { message: `Unknown risk rule: ${ruleKey}.` };
  }

  // See mergeThresholds's comment. Fixes #233.
  const effective: WarningThresholds = mergeThresholds(
    definition.defaults,
    overrides
  );

  for (const [field, value] of Object.entries(effective)) {
    if (value !== undefined && (value < 0 || value > 1)) {
      return { message: `${field} must be between 0 and 1 (got ${value}).` };
    }
  }

  if (definition.shape === 'ceiling') {
    if (effective.thresholdMax >= effective.redThresholdMax) {
      return {
        message: `thresholdMax (${effective.thresholdMax}) must be less than redThresholdMax (${effective.redThresholdMax}).`
      };
    }
  } else {
    const { redThresholdMax, redThresholdMin, thresholdMax, thresholdMin } =
      effective;

    if (!(
      redThresholdMin < thresholdMin &&
      thresholdMin < thresholdMax &&
      thresholdMax < redThresholdMax
    )) {
      return {
        message: `Band thresholds must satisfy redThresholdMin < thresholdMin < thresholdMax < redThresholdMax (got ${redThresholdMin} < ${thresholdMin} < ${thresholdMax} < ${redThresholdMax}).`
      };
    }
  }

  return null;
}
