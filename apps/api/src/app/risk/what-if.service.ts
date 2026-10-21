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

const SEVERITY_RANK: Record<Severity, number> = {
  GREEN: 0,
  NO_DATA: -1,
  YELLOW: 1,
  RED: 2
};

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.11.
//
// Known gap: this service diffs a before/after pair it is given - it does
// not itself re-run the seven risk rules against a shocked copy of the
// holdings. That pipeline (real holdings -> WeightedRuleResult[]/
// RiskWarning[]) isn't wired anywhere in the codebase yet - risk.module.ts
// still only provides ExposureService/ExposureCalculatorService, not
// HealthScoreCalculatorService or ThresholdEngineService. Until that wiring
// lands (see deviations.md D-12), callers must compute both the before and
// after rule results themselves and pass them in; this service only owns
// the portfolio/holding value shock and the before/after comparison.
@Injectable()
export class WhatIfService {
  public constructor(
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly healthScoreCalculatorService: HealthScoreCalculatorService
  ) {}

  public calculateWhatIf(request: WhatIfRequest): WhatIfResult {
    const { scenario } = request;

    if (!(scenario.dropPercentage > 0) || scenario.dropPercentage > 1) {
      throw new BadRequestException(
        `dropPercentage must be greater than 0 and at most 1, got ${scenario.dropPercentage}`
      );
    }

    const matchingHoldings = request.holdings.filter(
      (holding) =>
        holding.assetProfile.symbol === scenario.symbol &&
        holding.assetProfile.dataSource === scenario.dataSource
    );

    if (matchingHoldings.length === 0) {
      throw new NotFoundException(
        `No open holding found for ${scenario.dataSource}:${scenario.symbol}`
      );
    }

    const portfolioValueBefore = this.calculateTotalValue(
      request.holdings,
      request.baseCurrency
    );
    const holdingValueBefore = this.calculateTotalValue(
      matchingHoldings,
      request.baseCurrency
    );
    const holdingValueAfter = new Big(holdingValueBefore)
      .mul(1 - scenario.dropPercentage)
      .toNumber();
    const portfolioValueAfter =
      portfolioValueBefore - (holdingValueBefore - holdingValueAfter);

    const scoreBefore = this.healthScoreCalculatorService.calculateHealthScore(
      request.ruleResultsBefore
    );
    const scoreAfter = this.healthScoreCalculatorService.calculateHealthScore(
      request.ruleResultsAfter
    );

    return {
      calculatedAt: new Date(),
      categories: this.calculateCategoryChanges(scoreBefore, scoreAfter),
      changedWarnings: this.calculateChangedWarnings(
        request.warningsBefore,
        request.warningsAfter
      ),
      holding: {
        allocationAfter: this.safeRatio(holdingValueAfter, portfolioValueAfter),
        allocationBefore: this.safeRatio(
          holdingValueBefore,
          portfolioValueBefore
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
      newWarnings: this.calculateAddedWarnings(
        request.warningsBefore,
        request.warningsAfter
      ),
      portfolio: {
        change: {
          amount: portfolioValueAfter - portfolioValueBefore,
          currency: request.baseCurrency
        },
        changePercentage: this.safeRatio(
          portfolioValueAfter - portfolioValueBefore,
          portfolioValueBefore
        ),
        valueAfter: {
          amount: portfolioValueAfter,
          currency: request.baseCurrency
        },
        valueBefore: {
          amount: portfolioValueBefore,
          currency: request.baseCurrency
        }
      },
      resolvedWarnings: this.calculateAddedWarnings(
        request.warningsAfter,
        request.warningsBefore
      ),
      ruleChanges: this.calculateRuleChanges(
        request.warningsBefore,
        request.warningsAfter
      ),
      score: {
        after: scoreAfter.score,
        before: scoreBefore.score,
        change:
          scoreAfter.score === null || scoreBefore.score === null
            ? null
            : scoreAfter.score - scoreBefore.score
      },
      scenario,
      skippedRules: request.skippedRuleKeys ?? []
    };
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

  // Entries present in `after` whose (ruleKey, subject) is absent from
  // `before`. Called a second time with the arguments swapped to get the
  // entries that dropped out instead (resolvedWarnings).
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

  private calculateRuleChanges(
    before: RiskWarning[],
    after: RiskWarning[]
  ): WhatIfRuleChange[] {
    const ruleKeys = new Set([
      ...before.map((warning) => warning.ruleKey),
      ...after.map((warning) => warning.ruleKey)
    ]);
    const changes: WhatIfRuleChange[] = [];

    for (const ruleKey of ruleKeys) {
      const worstBefore = this.worstWarning(before, ruleKey);
      const worstAfter = this.worstWarning(after, ruleKey);

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

  // Approximation: only YELLOW/RED warnings are available here (GREEN/NO_DATA
  // results are filtered out upstream by ThresholdEngineService.
  // calculateWarnings()), so a rule with no warning on a given side is
  // reported as GREEN with actual: null instead of its true actual value.
  // This never understates severity - RED/YELLOW always win over the GREEN
  // placeholder - it can only fail to show the exact number for a side where
  // the rule was fully green.
  private worstWarning(
    warnings: RiskWarning[],
    ruleKey: string
  ): { actual: number | null; severity: Severity } {
    const matches = warnings.filter((warning) => warning.ruleKey === ruleKey);

    if (matches.length === 0) {
      return { actual: null, severity: 'GREEN' };
    }

    return matches.reduce((worst, warning) => {
      return SEVERITY_RANK[warning.severity] > SEVERITY_RANK[worst.severity]
        ? warning
        : worst;
    });
  }
}
