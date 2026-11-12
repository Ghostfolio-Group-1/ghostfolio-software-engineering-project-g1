import type {
  RiskThresholdValues,
  ThresholdShape
} from './risk-thresholds.client';

export interface ThresholdRowFormValues {
  max: string;
  min: string;
  redMax: string;
  redMin: string;
}

function toPercentageString(value?: number): string {
  return value === undefined ? '' : String(Math.round(value * 1000) / 10);
}

export function createThresholdRowFormValues(
  thresholds: RiskThresholdValues
): ThresholdRowFormValues {
  return {
    max: toPercentageString(thresholds.max),
    min: toPercentageString(thresholds.min),
    redMax: toPercentageString(thresholds.redMax),
    redMin: toPercentageString(thresholds.redMin)
  };
}

// Which fields a shape edits - 'ceiling' rules (concentration, volatility
// deviation) have no lower bound, 'band' rules (volatility, cash
// allocation) have all 4. Mirrors warning-threshold.model.ts's own
// per-shape field set.
export function thresholdFieldsForShape(
  shape: ThresholdShape
): readonly (keyof ThresholdRowFormValues)[] {
  return shape === 'ceiling'
    ? ['max', 'redMax']
    : ['min', 'max', 'redMin', 'redMax'];
}

// Mirrors warning-threshold.model.ts#validateThresholds's two shapes so
// the form can reject an inconsistent edit before it reaches the server -
// same "validate client-side with the server's own rules, fall back to
// the server's own message for anything subtler" split as
// target-allocation-form.model.ts.
export function validateThresholdRowForm(
  shape: ThresholdShape,
  values: ThresholdRowFormValues
): string | undefined {
  const fields = thresholdFieldsForShape(shape);
  const parsed: Record<keyof ThresholdRowFormValues, number> = {
    max: NaN,
    min: NaN,
    redMax: NaN,
    redMin: NaN
  };

  for (const field of fields) {
    const raw = values[field].trim();
    const value = Number(raw);

    if (raw === '' || Number.isNaN(value)) {
      return `${field} must be a number.`;
    }

    if (value < 0 || value > 100) {
      return `${field} must be between 0% and 100%.`;
    }

    parsed[field] = value;
  }

  if (shape === 'ceiling') {
    if (!(parsed.max < parsed.redMax)) {
      return `max (${parsed.max}%) must be less than redMax (${parsed.redMax}%).`;
    }

    return undefined;
  }

  const { max, min, redMax, redMin } = parsed;

  if (!(redMin < min && min < max && max < redMax)) {
    return `Thresholds must satisfy redMin (${redMin}%) < min (${min}%) < max (${max}%) < redMax (${redMax}%).`;
  }

  return undefined;
}

export function toUpdateRiskThresholdThresholds(
  shape: ThresholdShape,
  values: ThresholdRowFormValues
): RiskThresholdValues {
  const toFraction = (raw: string) => Number(raw.trim()) / 100;
  const fields = thresholdFieldsForShape(shape);
  const result: RiskThresholdValues = {};

  for (const field of fields) {
    result[field] = toFraction(values[field]);
  }

  return result;
}
