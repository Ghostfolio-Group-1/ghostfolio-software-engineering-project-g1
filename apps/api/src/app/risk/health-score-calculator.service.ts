import { Injectable } from '@nestjs/common';

import { CategoryScore } from './interfaces/category-score.interface';
import {
  HealthScore,
  WeightedRuleResult
} from './interfaces/health-score.interface';
import { RuleScore } from './interfaces/rule-score.interface';

// score = (sum of weights of PASSED active rules) / (sum of weights of ALL
// active rules) x 100. Inactive rules are excluded from both sides, so the
// remaining weights auto-renormalize - turning a rule off never costs points.
// Spec: docs/sesha-notes/02-health-score-data-model.md.
//
// Severity bands are explicitly out of scope for this issue (#38 / parent
// #19) - they belong to the separate warning-threshold engine story.
@Injectable()
export class HealthScoreCalculatorService {
  public calculate(results: WeightedRuleResult[]): HealthScore {
    const activeResults = results.filter((result) => result.isActive);
    const activeWeight = activeResults.reduce((sum, r) => sum + r.weight, 0);

    if (activeResults.length === 0 || activeWeight === 0) {
      return {
        activeWeight: 0,
        calculatedAt: new Date(),
        categories: [],
        grade: null,
        score: null,
        unavailableReason: 'NO_ACTIVE_RULES'
      };
    }

    const passedWeight = activeResults
      .filter((result) => result.passed)
      .reduce((sum, result) => sum + result.weight, 0);

    const score = (passedWeight / activeWeight) * 100;
    const categories = this.buildCategoryScores(activeResults);

    return {
      activeWeight,
      categories,
      calculatedAt: new Date(),
      grade: this.getGrade(score),
      score,
      unavailableReason: null
    };
  }

  private buildCategoryScores(
    activeResults: WeightedRuleResult[]
  ): CategoryScore[] {
    const categoryKeys = Array.from(
      new Set(activeResults.map((result) => result.categoryKey))
    );

    return categoryKeys
      .map((categoryKey) => {
        const categoryResults = activeResults.filter(
          (result) => result.categoryKey === categoryKey
        );
        const categoryActiveWeight = categoryResults.reduce(
          (sum, result) => sum + result.weight,
          0
        );
        const categoryPassedWeight = categoryResults
          .filter((result) => result.passed)
          .reduce((sum, result) => sum + result.weight, 0);
        const score =
          categoryActiveWeight > 0
            ? (categoryPassedWeight / categoryActiveWeight) * 100
            : 0;

        const rules: RuleScore[] = categoryResults.map((result) => ({
          actual: null,
          isActive: result.isActive,
          key: result.key,
          message: result.message,
          name: result.name,
          passed: result.passed,
          weight: result.weight
        }));

        return {
          rules,
          score,
          key: categoryKey,
          name: categoryResults[0].categoryName,
          weight: categoryResults[0].categoryWeight
        };
      })
      .sort((a, b) => a.score - b.score);
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
