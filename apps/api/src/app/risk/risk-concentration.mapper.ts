import { PortfolioPosition } from '@ghostfolio/common/interfaces';
import { RuleSettings } from '@ghostfolio/common/interfaces/x-ray-rules-settings.interface';

import { ExposureBucket } from './exposure-calculator.service';
import {
  RiskConcentrationBucket,
  RiskConcentrationGroup,
  RiskConcentrationResponse
} from './interfaces/risk-concentration-response.interface';
import { RiskSummary } from './interfaces/risk-summary.interface';
import { toRiskThresholds } from './risk-score.mapper';
import { ThresholdEngineService } from './threshold-engine.service';
import {
  getThresholdDefault,
  WarningThresholds
} from './warning-threshold.model';

export const DEFAULT_CONCENTRATION_LIMIT = 5;
export const MAX_CONCENTRATION_LIMIT = 20;

export function parseConcentrationLimit(value?: string): number | null {
  if (value === undefined) {
    return DEFAULT_CONCENTRATION_LIMIT;
  }

  const limit = Number(value);

  return Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= MAX_CONCENTRATION_LIMIT
    ? limit
    : null;
}

// #240: same rule keys and subject types RiskEvaluationService.evaluate()
// runs for /risk/score, so a bucket here gets the exact same severity a
// user would see there for that rule.
const GROUP_RULES: Record<
  keyof RiskConcentrationResponse,
  { ruleKey: string; subjectType: 'country' | 'currency' | 'sector' | 'stock' }
> = {
  country: { ruleKey: 'CountryConcentration', subjectType: 'country' },
  currency: {
    ruleKey: 'CurrencyClusterRiskCurrentInvestment',
    subjectType: 'currency'
  },
  sector: { ruleKey: 'SectorConcentration', subjectType: 'sector' },
  stock: { ruleKey: 'SingleStockConcentration', subjectType: 'stock' }
};

export function toRiskConcentrationResponse({
  holdings,
  limit,
  summary,
  thresholdEngineService,
  xRayRules
}: {
  holdings: PortfolioPosition[];
  limit: number;
  summary: RiskSummary;
  thresholdEngineService: ThresholdEngineService;
  xRayRules?: Record<string, RuleSettings>;
}): RiskConcentrationResponse {
  const stockNames = new Map<string, string>();

  for (const { assetProfile } of holdings) {
    if (assetProfile?.symbol) {
      stockNames.set(
        assetProfile.symbol,
        assetProfile.name ? assetProfile.name : assetProfile.symbol
      );
    }
  }

  return {
    country: toGroup({
      buckets: summary.concentration.country,
      group: 'country',
      limit,
      thresholdEngineService,
      xRayRules
    }),
    currency: toGroup({
      buckets: summary.concentration.currency,
      group: 'currency',
      limit,
      thresholdEngineService,
      xRayRules
    }),
    sector: toGroup({
      buckets: summary.concentration.sector,
      group: 'sector',
      limit,
      thresholdEngineService,
      xRayRules
    }),
    stock: toGroup({
      buckets: summary.concentration.stock,
      group: 'stock',
      limit,
      names: stockNames,
      thresholdEngineService,
      xRayRules
    })
  };
}

// #240: severity/thresholds now come from the threshold engine, same as
// /risk/score - a bucket's severity reflects the rule's real thresholds
// (overridable per-user via xRayRules), not a hardcoded NO_DATA placeholder.
function toGroup({
  buckets,
  group,
  limit,
  names,
  thresholdEngineService,
  xRayRules
}: {
  buckets: ExposureBucket[];
  group: keyof RiskConcentrationResponse;
  limit: number;
  names?: Map<string, string>;
  thresholdEngineService: ThresholdEngineService;
  xRayRules?: Record<string, RuleSettings>;
}): RiskConcentrationGroup {
  const { ruleKey, subjectType } = GROUP_RULES[group];
  const ruleSettings = xRayRules?.[ruleKey];
  // Same "disabled rule reads as NO_DATA" treatment as
  // RiskEvaluationService.toRuleEvaluation - a rule the user turned off
  // shouldn't show a computed severity here either.
  const isDisabled = ruleSettings?.isActive === false;
  const overrides: WarningThresholds | undefined = ruleSettings
    ? {
        redThresholdMax: ruleSettings.redThresholdMax,
        redThresholdMin: ruleSettings.redThresholdMin,
        thresholdMax: ruleSettings.thresholdMax,
        thresholdMin: ruleSettings.thresholdMin
      }
    : undefined;
  const definition = getThresholdDefault(ruleKey);

  return {
    buckets: [...buckets]
      .sort((left, right) => right.percentage - left.percentage)
      .slice(0, limit)
      .map(({ key, percentage }): RiskConcentrationBucket => {
        const severity = thresholdEngineService.calculateSeverity({
          overrides,
          ruleKey,
          actual: isDisabled ? null : percentage,
          subject: { type: subjectType, value: key }
        });

        return {
          percentage,
          severity,
          name: names?.get(key) ?? key,
          value: key
        };
      }),
    thresholds: definition ? toRiskThresholds(definition.defaults) : null
  };
}
