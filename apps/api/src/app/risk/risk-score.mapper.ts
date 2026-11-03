import { CategoryScore } from './interfaces/category-score.interface';
import { HealthScore } from './interfaces/health-score.interface';
import { RiskThresholds } from './interfaces/risk-concentration-response.interface';
import {
  RiskScoreCategory,
  RiskScoreResponse,
  RiskScoreRuleResult
} from './interfaces/risk-score-response.interface';
import { Severity } from './interfaces/severity.type';
import { RiskEvaluation } from './risk-evaluation.service';
import {
  ThresholdEngineInput,
  ThresholdEngineService
} from './threshold-engine.service';
import {
  getThresholdDefault,
  WarningThresholds
} from './warning-threshold.model';

// RED is worst, GREEN is best, NO_DATA never wins a "worst of" comparison -
// a category with a mix of NO_DATA and GREEN rules is GREEN overall, matching
// HealthScoreCalculatorService's own treatment of inactive/NO_DATA rules as
// invisible to the score rather than a silent fail.
const SEVERITY_RANK: Record<Severity, number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
  NO_DATA: 3
};

// Section 6.2: score >= 80 is GREEN, >= 60 is YELLOW, otherwise RED. A null
// score (no active rules) is NO_DATA.
export function getOverallSeverity(score: number | null): Severity {
  if (score === null) {
    return 'NO_DATA';
  }

  if (score >= 80) {
    return 'GREEN';
  }

  if (score >= 60) {
    return 'YELLOW';
  }

  return 'RED';
}

// Worst-of, skipping NO_DATA unless every rule is NO_DATA.
function worstSeverity(severities: Severity[]): Severity {
  const withData = severities.filter((severity) => severity !== 'NO_DATA');

  if (withData.length === 0) {
    return 'NO_DATA';
  }

  return withData.reduce((worst, severity) => {
    return SEVERITY_RANK[severity] < SEVERITY_RANK[worst] ? severity : worst;
  }, 'GREEN' as Severity);
}

export function toRiskScoreResponse({
  evaluation,
  healthScore,
  thresholdEngineService
}: {
  evaluation: RiskEvaluation;
  healthScore: HealthScore;
  thresholdEngineService: ThresholdEngineService;
}): RiskScoreResponse {
  const thresholdInputByRuleKey = new Map<string, ThresholdEngineInput>(
    evaluation.thresholdInputs.map((input) => [input.ruleKey, input])
  );

  const categories = healthScore.categories
    .map((category) =>
      toRiskScoreCategory(
        category,
        thresholdInputByRuleKey,
        thresholdEngineService
      )
    )
    .sort((left, right) => {
      if (SEVERITY_RANK[left.severity] !== SEVERITY_RANK[right.severity]) {
        return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
      }

      return right.weight - left.weight;
    });

  const excluded = Array.from(
    new Set(evaluation.ruleResults.map((result) => result.categoryKey))
  )
    .filter(
      (categoryKey) =>
        !categories.some((category) => category.key === categoryKey)
    )
    .map((key) => ({ key, reason: 'NO_ACTIVE_RULES' }));

  return {
    categories,
    excluded,
    activeWeight: healthScore.activeWeight,
    calculatedAt: healthScore.calculatedAt,
    grade: healthScore.grade,
    score: healthScore.score,
    severity: getOverallSeverity(healthScore.score),
    unavailableReason: healthScore.unavailableReason
  };
}

// Only includes the fields the threshold shape actually defines, so a
// ceiling rule's response never carries a stray `min`/`redMin` key set to
// `undefined` (which would fail the schema's `type: number` check on that
// property once JSON.stringify-ed and parsed back, or when validated
// in-process before serialization).
export function toRiskThresholds(defaults: WarningThresholds): RiskThresholds {
  const thresholds: RiskThresholds = {};

  if (defaults.thresholdMax !== undefined) {
    thresholds.max = defaults.thresholdMax;
  }

  if (defaults.thresholdMin !== undefined) {
    thresholds.min = defaults.thresholdMin;
  }

  if (defaults.redThresholdMax !== undefined) {
    thresholds.redMax = defaults.redThresholdMax;
  }

  if (defaults.redThresholdMin !== undefined) {
    thresholds.redMin = defaults.redThresholdMin;
  }

  return thresholds;
}

function toRiskScoreCategory(
  category: CategoryScore,
  thresholdInputByRuleKey: Map<string, ThresholdEngineInput>,
  thresholdEngineService: ThresholdEngineService
): RiskScoreCategory {
  const rules: RiskScoreRuleResult[] = category.rules.map((rule) => {
    const thresholdInput = thresholdInputByRuleKey.get(rule.key);
    const severity = thresholdInput
      ? thresholdEngineService.calculateSeverity(thresholdInput)
      : 'NO_DATA';
    const definition = getThresholdDefault(rule.key);

    return {
      severity,
      actual: thresholdInput?.actual ?? null,
      isActive: rule.isActive,
      key: rule.key,
      message: rule.message,
      name: rule.name,
      passed: rule.passed,
      thresholds: definition ? toRiskThresholds(definition.defaults) : null,
      weight: rule.weight
    };
  });

  return {
    rules,
    key: category.key,
    name: category.name,
    score: category.score,
    severity: worstSeverity(rules.map((rule) => rule.severity)),
    weight: category.weight
  };
}
