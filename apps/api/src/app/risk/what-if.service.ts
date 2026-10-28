import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioPosition } from '@ghostfolio/common/interfaces';

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Big } from 'big.js';

import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { HealthScore } from './interfaces/health-score.interface';
import { RiskWarning } from './interfaces/risk-warning.interface';
import { Severity } from './interfaces/severity.type';
import {
  WhatIfCategoryScore,
  WhatIfRequest,
  WhatIfResult,
  WhatIfRuleChange
} from './interfaces/what-if.interface';
import { RiskEvaluationService } from './risk-evaluation.service';
import {
  ThresholdEngineInput,
  ThresholdEngineService
} from './threshold-engine.service';

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.11.
//
// Per Tharun's review on the first version of this PR: this now builds the
// shocked holdings copy itself (without mutating the real holdings) and
// runs the same RiskEvaluationService pipeline GET /risk/summary and
// /warnings use on both the before and shocked states, rather than trusting
// a caller-supplied before/after pair. Portfolio value includes the
// (unchanged) cash balance; holding value/allocation stays relative to the
// holdings total, matching the worked example in Section 6.11.
@Injectable()
export class WhatIfService {
  public constructor(
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly healthScoreCalculatorService: HealthScoreCalculatorService,
    private readonly riskEvaluationService: RiskEvaluationService,
    private readonly thresholdEngineService: ThresholdEngineService
  ) {}

  public calculateWhatIf(request: WhatIfRequest): WhatIfResult {
    const { scenario } = request;

    if (!(scenario.dropPercentage > 0) || scenario.dropPercentage > 1) {
      throw new BadRequestException(
        `dropPercentage must be greater than 0 and at most 1, got ${scenario.dropPercentage}`
      );
    }

    const matchesScenario = (holding: PortfolioPosition) =>
      holding.assetProfile.symbol === scenario.symbol &&
      holding.assetProfile.dataSource === scenario.dataSource;

    const matchedHolding = request.holdings.find(matchesScenario);

    if (!matchedHolding) {
      throw new NotFoundException(
        `No open holding found for ${scenario.dataSource}:${scenario.symbol}`
      );
    }

    const shockedHoldings = request.holdings.map((holding) => {
      if (!matchesScenario(holding)) {
        return holding;
      }

      return {
        ...holding,
        marketPrice: (holding.marketPrice ?? 0) * (1 - scenario.dropPercentage)
      };
    });

    const evaluationBefore = this.riskEvaluationService.evaluate({
      baseCurrency: request.baseCurrency,
      cashBalance: request.cashBalance,
      holdings: request.holdings,
      targetAllocation: request.targetAllocation,
      volatility: request.volatility
    });
    const evaluationAfter = this.riskEvaluationService.evaluate({
      baseCurrency: request.baseCurrency,
      cashBalance: request.cashBalance,
      holdings: shockedHoldings,
      targetAllocation: request.targetAllocation,
      volatility: request.volatility
    });

    const holdingValueBefore = this.calculateHoldingValue(
      request.holdings,
      matchesScenario,
      request.baseCurrency
    );
    const holdingValueAfter = new Big(holdingValueBefore)
      .mul(1 - scenario.dropPercentage)
      .toNumber();

    const scoreBefore = this.healthScoreCalculatorService.calculateHealthScore(
      evaluationBefore.ruleResults
    );
    const scoreAfter = this.healthScoreCalculatorService.calculateHealthScore(
      evaluationAfter.ruleResults
    );

    const warningsBefore =
      this.riskEvaluationService.calculateWarnings(evaluationBefore);
    const warningsAfter =
      this.riskEvaluationService.calculateWarnings(evaluationAfter);

    return {
      calculatedAt: new Date(),
      categories: this.calculateCategoryChanges(scoreBefore, scoreAfter),
      changedWarnings: this.calculateChangedWarnings(
        warningsBefore,
        warningsAfter
      ),
      holding: {
        allocationAfter: this.safeRatio(
          holdingValueAfter,
          evaluationAfter.holdingsValue
        ),
        allocationBefore: this.safeRatio(
          holdingValueBefore,
          evaluationBefore.holdingsValue
        ),
        valueAfter: {
          amount: holdingValueAfter,
          currency: request.baseCurrency
        },
        valueBefore: {
          amount: holdingValueBefore,
          currency: request.baseCurrency
        }
      },
      newWarnings: this.calculateAddedWarnings(warningsBefore, warningsAfter),
      portfolio: {
        change: {
          amount:
            evaluationAfter.portfolioValue - evaluationBefore.portfolioValue,
          currency: request.baseCurrency
        },
        changePercentage: this.safeRatio(
          evaluationAfter.portfolioValue - evaluationBefore.portfolioValue,
          evaluationBefore.portfolioValue
        ),
        valueAfter: {
          amount: evaluationAfter.portfolioValue,
          currency: request.baseCurrency
        },
        valueBefore: {
          amount: evaluationBefore.portfolioValue,
          currency: request.baseCurrency
        }
      },
      resolvedWarnings: this.calculateAddedWarnings(
        warningsAfter,
        warningsBefore
      ),
      ruleChanges: this.calculateRuleChanges(
        evaluationBefore.thresholdInputs,
        evaluationAfter.thresholdInputs
      ),
      score: {
        after: scoreAfter.score,
        before: scoreBefore.score,
        change:
          scoreAfter.score === null || scoreBefore.score === null
            ? null
            : scoreAfter.score - scoreBefore.score
      },
      scenario: { ...scenario, name: matchedHolding.assetProfile.name },
      // skippedRules is whichever rules RiskEvaluationService itself could
      // not evaluate (e.g. no target allocation configured).
      skippedRules: evaluationAfter.skippedRuleKeys
    };
  }

  // Mirrors RiskEvaluationService's own value calculation (same FX handling)
  // for just the matched holding(s), since that service only returns
  // portfolio-wide totals, not a single holding's value.
  private calculateHoldingValue(
    holdings: PortfolioPosition[],
    matches: (holding: PortfolioPosition) => boolean,
    baseCurrency: string
  ): number {
    return holdings.filter(matches).reduce((sum, holding) => {
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

  private safeRatio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateCategoryChanges(
    scoreBefore: HealthScore,
    scoreAfter: HealthScore
  ): WhatIfCategoryScore[] {
    const keys = new Set([
      ...scoreBefore.categories.map((category) => category.key),
      ...scoreAfter.categories.map((category) => category.key)
    ]);

    return Array.from(keys).map((key) => ({
      key,
      scoreAfter:
        scoreAfter.categories.find((category) => category.key === key)?.score ??
        null,
      scoreBefore:
        scoreBefore.categories.find((category) => category.key === key)
          ?.score ?? null
    }));
  }

  private warningKey(warning: RiskWarning): string {
    return `${warning.ruleKey}::${warning.subject.type}::${warning.subject.value}`;
  }

  private calculateAddedWarnings(
    before: RiskWarning[],
    after: RiskWarning[]
  ): RiskWarning[] {
    const beforeKeys = new Set(
      before.map((warning) => this.warningKey(warning))
    );

    return after.filter((warning) => !beforeKeys.has(this.warningKey(warning)));
  }

  private calculateChangedWarnings(
    before: RiskWarning[],
    after: RiskWarning[]
  ): RiskWarning[] {
    const beforeByKey = new Map(
      before.map((warning) => [this.warningKey(warning), warning])
    );

    return after.filter((warning) => {
      const prior = beforeByKey.get(this.warningKey(warning));

      return (
        prior !== undefined &&
        (prior.severity !== warning.severity || prior.actual !== warning.actual)
      );
    });
  }

  // Unlike the first version of this service, ruleChanges is now derived
  // from the full before/after ThresholdEngineInput[] (every rule, not just
  // the ones that produced a YELLOW/RED warning), so a rule that is GREEN on
  // one side reports its real actual value instead of a null placeholder.
  private calculateRuleChanges(
    before: ThresholdEngineInput[],
    after: ThresholdEngineInput[]
  ): WhatIfRuleChange[] {
    const ruleKeys = new Set([
      ...before.map((input) => input.ruleKey),
      ...after.map((input) => input.ruleKey)
    ]);
    const changes: WhatIfRuleChange[] = [];

    for (const ruleKey of ruleKeys) {
      const worstBefore = this.worstInput(before, ruleKey);
      const worstAfter = this.worstInput(after, ruleKey);

      if (
        worstBefore.severity !== worstAfter.severity ||
        worstBefore.actual !== worstAfter.actual
      ) {
        changes.push({
          actualAfter: worstAfter.actual,
          actualBefore: worstBefore.actual,
          ruleKey,
          severityAfter: worstAfter.severity,
          severityBefore: worstBefore.severity
        });
      }
    }

    return changes;
  }

  // RiskEvaluationService already picks the single worst subject per rule
  // key, so there is at most one ThresholdEngineInput per ruleKey here; this
  // just finds it and asks ThresholdEngineService for its real severity
  // (GREEN included, not just the YELLOW/RED warnings).
  private worstInput(
    inputs: ThresholdEngineInput[],
    ruleKey: string
  ): { actual: number | null; severity: Severity } {
    const input = inputs.find((candidate) => candidate.ruleKey === ruleKey);

    if (!input) {
      return { actual: null, severity: 'NO_DATA' };
    }

    return {
      actual: input.actual,
      severity: this.thresholdEngineService.calculateSeverity(input)
    };
  }
}
