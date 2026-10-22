import { TargetDeviation } from '@ghostfolio/api/models/rules/target-deviation/target-deviation';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import {
  PortfolioPosition,
  TargetAllocationSettings
} from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';

import { ExposureBucket } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { WeightedRuleResult } from './interfaces/health-score.interface';
import { RiskWarning } from './interfaces/risk-warning.interface';
import {
  ThresholdEngineInput,
  ThresholdEngineService
} from './threshold-engine.service';

export interface VolatilityInput {
  annualizedVolatility: number | null;
  historyDays: number;
}

export interface RiskEvaluationRequest {
  baseCurrency: string;
  cashBalance: number;
  holdings: PortfolioPosition[];
  targetAllocation?: TargetAllocationSettings;
  volatility?: VolatilityInput;
}

export interface RiskEvaluation {
  cashBalance: number;
  holdingsValue: number;
  portfolioValue: number;
  ruleResults: WeightedRuleResult[];
  skippedRuleKeys: string[];
  // One entry per rule: the worst subject, used for health-score pass/fail
  // and for ruleChanges ("the rule's worst bucket before and after" per
  // Section 6.11).
  thresholdInputs: ThresholdEngineInput[];
  // Every breaching-eligible subject per rule (every stock/sector/bucket,
  // not just the worst), used to generate the actual per-subject warnings.
  // A rule with one worst subject can still have other subjects breaching
  // independently - e.g. a shock can push one stock down through YELLOW
  // while pushing another up through RED, and both need their own warning,
  // not just whichever is worst overall.
  warningInputs: ThresholdEngineInput[];
}

interface RiskRuleEvaluation {
  ruleResult: WeightedRuleResult;
  thresholdInput: ThresholdEngineInput;
  warningInputs: ThresholdEngineInput[];
}

// Groups the 7 rule keys in warning-threshold.model.ts into provisional
// categories for the health score. docs/sesha-notes/02-health-score-data-
// model.md's category/weight table is written against Ghostfolio's older
// 8-category X-Ray rule catalog (Fees, Emergency Fund, Buying Power, ...),
// not this 7-rule set - the two docs were never reconciled. Until the team
// does that, every rule gets equal weight within its category rather than
// inventing precision that doesn't exist yet.
const RULE_CATEGORIES: Record<string, { key: string; name: string }> = {
  CashAllocation: { key: 'cash', name: 'Cash Allocation' },
  CountryConcentration: { key: 'concentration', name: 'Concentration' },
  CurrencyClusterRiskCurrentInvestment: {
    key: 'concentration',
    name: 'Concentration'
  },
  PortfolioVolatility: { key: 'volatility', name: 'Volatility' },
  SectorConcentration: { key: 'concentration', name: 'Concentration' },
  SingleStockConcentration: { key: 'concentration', name: 'Concentration' },
  TargetAllocationDeviation: {
    key: 'targetAllocation',
    name: 'Target Allocation'
  }
};
const CATEGORY_RULE_COUNT: Record<string, number> = {
  cash: 1,
  concentration: 4,
  targetAllocation: 1,
  volatility: 1
};

// Runs the 7 risk rules from warning-threshold.model.ts against a holdings
// set and turns each result into the two generic shapes the rest of the
// risk module already consumes: WeightedRuleResult (HealthScoreCalculator-
// Service) and ThresholdEngineInput (ThresholdEngineService). This is the
// connective layer that was missing between "the rules and the two
// calculators exist" and "the risk API actually computes something real" -
// see deviations.md D-12.
//
// isActive / per-rule threshold overrides from UserSettings.xRayRules are
// intentionally out of scope here (that's a bigger feature of its own);
// every rule defaults to active except TargetAllocationDeviation, which
// only runs when a target allocation is actually configured - matching
// TargetDeviation's own getSettings().
@Injectable()
export class RiskEvaluationService {
  public constructor(
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly exposureService: ExposureService,
    private readonly thresholdEngineService: ThresholdEngineService
  ) {}

  public evaluate(request: RiskEvaluationRequest): RiskEvaluation {
    const holdingsValue = this.calculateTotalValue(
      request.holdings,
      request.baseCurrency
    );
    const portfolioValue = holdingsValue + request.cashBalance;
    const summary = this.exposureService.getRiskSummary(
      request.holdings,
      request.baseCurrency
    );
    const skippedRuleKeys: string[] = [];

    const evaluations: RiskRuleEvaluation[] = [
      this.evaluateConcentration(
        'SingleStockConcentration',
        'stock',
        summary.concentration.stock
      ),
      this.evaluateConcentration(
        'SectorConcentration',
        'sector',
        summary.concentration.sector
      ),
      this.evaluateConcentration(
        'CountryConcentration',
        'country',
        summary.concentration.country
      ),
      this.evaluateConcentration(
        'CurrencyClusterRiskCurrentInvestment',
        'currency',
        summary.concentration.currency
      ),
      this.evaluateCashAllocation(request.cashBalance, portfolioValue),
      this.evaluateVolatility(request.volatility)
    ];

    const targetEvaluation = this.evaluateTargetAllocation(
      request.holdings,
      request.baseCurrency,
      request.targetAllocation
    );

    if (targetEvaluation) {
      evaluations.push(targetEvaluation);
    } else {
      skippedRuleKeys.push('TargetAllocationDeviation');
    }

    // Any rule that came back NO_DATA (isActive: false) is also reported as
    // skipped - e.g. PortfolioVolatility when no nightly volatility figure
    // is available, which is the case for every request today since no
    // volatility cache is wired up yet (RiskController always passes
    // volatility: undefined).
    for (const evaluation of evaluations) {
      if (!evaluation.ruleResult.isActive) {
        skippedRuleKeys.push(evaluation.ruleResult.key);
      }
    }

    return {
      holdingsValue,
      portfolioValue,
      skippedRuleKeys,
      cashBalance: request.cashBalance,
      ruleResults: evaluations.map((evaluation) => evaluation.ruleResult),
      thresholdInputs: evaluations.map(
        (evaluation) => evaluation.thresholdInput
      ),
      warningInputs: evaluations.flatMap(
        (evaluation) => evaluation.warningInputs
      )
    };
  }

  // Convenience for WhatIfService: the warnings a caller would get from
  // GET /risk/warnings for this same evaluation - one per breaching subject,
  // not just the worst per rule.
  public calculateWarnings(evaluation: RiskEvaluation): RiskWarning[] {
    return this.thresholdEngineService.calculateWarnings(
      evaluation.warningInputs
    );
  }

  private calculateTotalValue(
    holdings: PortfolioPosition[],
    baseCurrency: string
  ): number {
    return holdings.reduce((sum, holding) => {
      return (
        sum +
        this.exchangeRateDataService.toCurrency(
          holding.quantity * (holding.marketPrice ?? 0),
          holding.assetProfile.currency ?? baseCurrency,
          baseCurrency
        )
      );
    }, 0);
  }

  private evaluateConcentration(
    ruleKey: string,
    subjectType: RiskWarning['subject']['type'],
    buckets: ExposureBucket[]
  ): RiskRuleEvaluation {
    const worst = buckets.reduce<ExposureBucket | null>((max, bucket) => {
      return !max || bucket.percentage > max.percentage ? bucket : max;
    }, null);

    const thresholdInput: ThresholdEngineInput = {
      ruleKey,
      actual: worst?.percentage ?? 0,
      subject: { type: subjectType, value: worst?.key ?? 'n/a' }
    };

    const warningInputs: ThresholdEngineInput[] =
      buckets.length > 0
        ? buckets.map((bucket) => ({
            ruleKey,
            actual: bucket.percentage,
            subject: { type: subjectType, value: bucket.key }
          }))
        : [thresholdInput];

    return this.toRuleEvaluation(thresholdInput, warningInputs);
  }

  private evaluateCashAllocation(
    cashBalance: number,
    portfolioValue: number
  ): RiskRuleEvaluation {
    const actual = portfolioValue > 0 ? cashBalance / portfolioValue : 0;
    const thresholdInput: ThresholdEngineInput = {
      actual,
      ruleKey: 'CashAllocation',
      subject: { type: 'bucket', value: 'cash' }
    };

    return this.toRuleEvaluation(thresholdInput, [thresholdInput]);
  }

  private evaluateVolatility(volatility?: VolatilityInput): RiskRuleEvaluation {
    const MINIMUM_HISTORY_DAYS = 20;
    const hasSufficientData =
      volatility !== undefined &&
      volatility.annualizedVolatility !== null &&
      volatility.historyDays >= MINIMUM_HISTORY_DAYS;

    const thresholdInput: ThresholdEngineInput = {
      actual: hasSufficientData ? volatility.annualizedVolatility : null,
      ruleKey: 'PortfolioVolatility',
      subject: { type: 'portfolio', value: 'volatility' }
    };

    return this.toRuleEvaluation(thresholdInput, [thresholdInput]);
  }

  private evaluateTargetAllocation(
    holdings: PortfolioPosition[],
    baseCurrency: string,
    targetAllocation?: TargetAllocationSettings
  ): RiskRuleEvaluation | null {
    if (!targetAllocation?.isActive) {
      return null;
    }

    const rule = new TargetDeviation(
      this.exchangeRateDataService as any,
      holdings
    );
    const { buckets } = rule.evaluate({
      baseCurrency,
      groupBy: targetAllocation.groupBy ?? 'assetClass',
      isActive: true,
      locale: 'en',
      targets: targetAllocation.targets ?? [],
      thresholdMax: 0.05
    });

    const worst = (buckets ?? []).reduce<(typeof buckets)[number] | null>(
      (worstBucket, bucket) => {
        return !worstBucket ||
          Math.abs(bucket.deviation) > Math.abs(worstBucket.deviation)
          ? bucket
          : worstBucket;
      },
      null
    );

    const subjectType = this.subjectTypeForGroupBy(
      targetAllocation.groupBy ?? 'assetClass'
    );
    const thresholdInput: ThresholdEngineInput = {
      actual: worst ? Math.abs(worst.deviation) : 0,
      ruleKey: 'TargetAllocationDeviation',
      subject: { type: subjectType, value: worst?.key ?? 'n/a' }
    };

    const warningInputs: ThresholdEngineInput[] =
      buckets && buckets.length > 0
        ? buckets.map((bucket) => ({
            ruleKey: 'TargetAllocationDeviation',
            actual: Math.abs(bucket.deviation),
            subject: { type: subjectType, value: bucket.key }
          }))
        : [thresholdInput];

    return this.toRuleEvaluation(thresholdInput, warningInputs);
  }

  private subjectTypeForGroupBy(
    groupBy: string
  ): RiskWarning['subject']['type'] {
    switch (groupBy) {
      case 'sector':
        return 'sector';
      case 'country':
        return 'country';
      case 'currency':
        return 'currency';
      case 'symbol':
        return 'stock';
      default:
        return 'bucket';
    }
  }

  private toRuleEvaluation(
    thresholdInput: ThresholdEngineInput,
    warningInputs: ThresholdEngineInput[]
  ): RiskRuleEvaluation {
    const severity =
      this.thresholdEngineService.calculateSeverity(thresholdInput);
    // A rule's pass/fail is false if and only if its severity is YELLOW or
    // RED. NO_DATA is neither a pass nor a fail - per docs/sesha-notes/07,
    // Section 3, and HealthScoreCalculatorService's own "weight renormalizes
    // when a rule is excluded" model, a rule with no data should not count
    // toward the score at all, so it is marked inactive (isActive: false)
    // rather than silently passed. Tharun's review on PR #138 caught an
    // earlier version of this that set isActive: true unconditionally,
    // which let the always-NO_DATA PortfolioVolatility rule (no nightly
    // volatility cache exists yet) inflate every health score with a free
    // pass.
    const isActive = severity !== 'NO_DATA';
    const passed = severity !== 'YELLOW' && severity !== 'RED';
    const category = RULE_CATEGORIES[thresholdInput.ruleKey];

    return {
      thresholdInput,
      warningInputs,
      ruleResult: {
        isActive,
        passed,
        categoryKey: category.key,
        categoryName: category.name,
        categoryWeight: CATEGORY_RULE_COUNT[category.key],
        key: thresholdInput.ruleKey,
        message: !isActive
          ? `${thresholdInput.ruleKey} has no data available.`
          : passed
            ? `${thresholdInput.ruleKey} is within its threshold.`
            : `${thresholdInput.ruleKey} is outside its threshold.`,
        name: thresholdInput.ruleKey,
        weight: 1
      }
    };
  }
}
