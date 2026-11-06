import { RuleSettings } from '@ghostfolio/common/interfaces/x-ray-rules-settings.interface';

import { UpdateRiskThresholdDto } from './dtos/update-risk-threshold.dto';
import { RiskThresholdItem } from './interfaces/risk-threshold-response.interface';
import { toRiskThresholds } from './risk-score.mapper';
import {
  getThresholdDefault,
  validateThresholds,
  WARNING_THRESHOLD_DEFAULTS,
  WarningThresholds
} from './warning-threshold.model';

// Spec: docs/sesha-notes/10-risk-api-contract.md, Sections 6.8-6.10.
const RULE_NAMES: Record<string, string> = {
  CashAllocation: 'Cash allocation',
  CountryConcentration: 'Country concentration',
  CurrencyClusterRiskCurrentInvestment: 'Currency cluster risk',
  PortfolioVolatility: 'Volatility estimate',
  SectorConcentration: 'Sector concentration',
  SingleStockConcentration: 'Single stock concentration',
  TargetAllocationDeviation: 'Target allocation deviation'
};

export interface RiskThresholdValidationError {
  code:
    | 'RISK_RULE_NOT_FOUND'
    | 'RISK_THRESHOLD_INVALID_ORDER'
    | 'RISK_THRESHOLD_OUT_OF_RANGE';
  message: string;
}

export function isKnownRiskRuleKey(ruleKey: string): boolean {
  return getThresholdDefault(ruleKey) !== undefined;
}

export function toRiskThresholdItem(
  ruleKey: string,
  override?: RuleSettings
): RiskThresholdItem | null {
  const definition = getThresholdDefault(ruleKey);

  if (!definition) {
    return null;
  }

  const overrideThresholds: WarningThresholds = override
    ? {
        redThresholdMax: override.redThresholdMax,
        redThresholdMin: override.redThresholdMin,
        thresholdMax: override.thresholdMax,
        thresholdMin: override.thresholdMin
      }
    : {};
  const isCustomized = Object.values(overrideThresholds).some(
    (value) => value !== undefined
  );
  // Field-by-field fallback, not an object spread: a spread would copy
  // `undefined` for every threshold the override didn't set, clobbering
  // the corresponding default instead of falling back to it.
  const effectiveThresholds: WarningThresholds = {
    redThresholdMax:
      overrideThresholds.redThresholdMax ?? definition.defaults.redThresholdMax,
    redThresholdMin:
      overrideThresholds.redThresholdMin ?? definition.defaults.redThresholdMin,
    thresholdMax:
      overrideThresholds.thresholdMax ?? definition.defaults.thresholdMax,
    thresholdMin:
      overrideThresholds.thresholdMin ?? definition.defaults.thresholdMin
  };

  return {
    ruleKey,
    defaults: toRiskThresholds(definition.defaults),
    isActive: override?.isActive ?? true,
    isCustomized,
    name: RULE_NAMES[ruleKey] ?? ruleKey,
    shape: definition.shape,
    thresholds: toRiskThresholds(effectiveThresholds)
  };
}

export function toRiskThresholdsList(
  xRayRules?: Record<string, RuleSettings>
): RiskThresholdItem[] {
  return WARNING_THRESHOLD_DEFAULTS.map((definition) =>
    toRiskThresholdItem(definition.ruleKey, xRayRules?.[definition.ruleKey])
  ).filter((item): item is RiskThresholdItem => item !== null);
}

// Validates a PUT body (Section 6.9). "At least one field must be present"
// and the ceiling/band ordering + 0-1 range checks (delegated to
// validateThresholds, which already encodes both shapes' rules).
export function validateThresholdUpdateInput(
  ruleKey: string,
  dto: UpdateRiskThresholdDto
): RiskThresholdValidationError | null {
  if (!isKnownRiskRuleKey(ruleKey)) {
    return {
      code: 'RISK_RULE_NOT_FOUND',
      message: `"${ruleKey}" is not one of the risk module's rules.`
    };
  }

  if (dto.isActive === undefined && dto.thresholds === undefined) {
    return {
      code: 'RISK_THRESHOLD_OUT_OF_RANGE',
      message: 'At least one of isActive or thresholds must be present.'
    };
  }

  if (!dto.thresholds) {
    return null;
  }

  const overrides: WarningThresholds = {
    redThresholdMax: dto.thresholds.redMax,
    redThresholdMin: dto.thresholds.redMin,
    thresholdMax: dto.thresholds.max,
    thresholdMin: dto.thresholds.min
  };
  const error = validateThresholds({ overrides, ruleKey });

  if (!error) {
    return null;
  }

  const isOrderError =
    error.message.includes('must be less than') ||
    error.message.includes('must satisfy');

  return {
    code: isOrderError
      ? 'RISK_THRESHOLD_INVALID_ORDER'
      : 'RISK_THRESHOLD_OUT_OF_RANGE',
    message: error.message
  };
}

// Merges a validated PUT body onto the rule's current override, keeping
// anything left out of `thresholds` at its current value (Section 6.9).
export function buildUpdatedRuleSettings(
  current: RuleSettings | undefined,
  dto: UpdateRiskThresholdDto
): RuleSettings {
  return {
    isActive: dto.isActive ?? current?.isActive ?? true,
    redThresholdMax: dto.thresholds?.redMax ?? current?.redThresholdMax,
    redThresholdMin: dto.thresholds?.redMin ?? current?.redThresholdMin,
    thresholdMax: dto.thresholds?.max ?? current?.thresholdMax,
    thresholdMin: dto.thresholds?.min ?? current?.thresholdMin
  };
}
