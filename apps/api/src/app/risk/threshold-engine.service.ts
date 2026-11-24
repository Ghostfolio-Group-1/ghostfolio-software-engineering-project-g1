import { Injectable } from '@nestjs/common';

import { RiskWarning } from './interfaces/risk-warning.interface';
import { Severity } from './interfaces/severity.type';
import {
  getThresholdDefault,
  mergeThresholds,
  WarningThresholds
} from './warning-threshold.model';

export interface ThresholdEngineInput {
  actual: number | null; // null -> NO_DATA
  overrides?: WarningThresholds;
  ruleKey: string;
  subject: RiskWarning['subject'];
  // QA R-04 (Mon 11/23, issue #343): TargetAllocationDeviation's `actual` is
  // the bucket's deviation (how far off target), not its real holding
  // percentage - buildMessage() used to treat it as the latter, producing
  // "FIXED_INCOME is 50.0% of your portfolio" for a bucket the user holds
  // 0% of (its deviation from a 50% target). Present only for
  // TargetAllocationDeviation inputs; carries the two numbers the design's
  // dedicated message template needs that a single `actual` can't.
  targetAllocationDetail?: {
    actualAllocation: number;
    deviation: number;
    targetAllocation: number;
  };
}

// Spec: docs/sesha-notes/07-warning-threshold-rules.md, Sections 4 and 7.
@Injectable()
export class ThresholdEngineService {
  public calculateSeverity(input: ThresholdEngineInput): Severity {
    const definition = getThresholdDefault(input.ruleKey);

    // Unlike validateThresholds() (warning-threshold.model.ts), which errors
    // loudly on an unknown rule key because it runs at configuration time
    // against a single override a human just typed, this runs at evaluation
    // time over a whole batch of rule results. One renamed/retired rule key
    // should degrade that one entry to NO_DATA, not fail the whole batch -
    // consistent with "never show a fake green" rather than "never show
    // anything at all".
    if (!definition || input.actual === null) {
      return 'NO_DATA';
    }

    // Fixes #233 (same bug as validateThresholds, surfaced here too since
    // RiskEvaluationService builds `overrides` with all 4 keys present,
    // some explicitly `undefined`, for a rule with only a partial
    // RuleSettings override): a blind spread would clobber an un-overridden
    // default with that explicit `undefined`, letting an actual well past
    // the real (default) threshold compute as GREEN.
    const thresholds = mergeThresholds(definition.defaults, input.overrides);
    const { actual } = input;

    if (definition.shape === 'ceiling') {
      if (actual > thresholds.redThresholdMax) return 'RED';
      if (actual > thresholds.thresholdMax) return 'YELLOW';
      return 'GREEN';
    }

    // band
    if (
      actual >= thresholds.thresholdMin &&
      actual <= thresholds.thresholdMax
    ) {
      return 'GREEN';
    }

    if (
      actual >= thresholds.redThresholdMin &&
      actual <= thresholds.redThresholdMax
    ) {
      return 'YELLOW';
    }

    return 'RED';
  }

  public calculateWarnings(inputs: ThresholdEngineInput[]): RiskWarning[] {
    const warnings: RiskWarning[] = [];

    for (const input of inputs) {
      const severity = this.calculateSeverity(input);

      if (severity !== 'YELLOW' && severity !== 'RED') {
        continue;
      }

      const definition = getThresholdDefault(input.ruleKey);
      const thresholds = mergeThresholds(definition.defaults, input.overrides);
      const threshold =
        definition.shape === 'ceiling'
          ? severity === 'RED'
            ? thresholds.redThresholdMax
            : thresholds.thresholdMax
          : input.actual < thresholds.thresholdMin
            ? severity === 'RED'
              ? thresholds.redThresholdMin
              : thresholds.thresholdMin
            : severity === 'RED'
              ? thresholds.redThresholdMax
              : thresholds.thresholdMax;

      warnings.push({
        severity,
        threshold,
        actual: input.actual,
        message: this.buildMessage(input, severity, threshold),
        ruleKey: input.ruleKey,
        subject: input.subject
      });
    }

    return this.sortWarnings(warnings);
  }

  // Message templates per docs/sesha-notes/07-warning-threshold-rules.md,
  // Section 7: one per threshold shape. A warning's own actual/threshold
  // tells us the breach direction directly: for a ceiling rule actual is
  // always above threshold; for a band rule, actual < threshold means the
  // low-side (min) line was crossed, actual > threshold means the high-side
  // (max) line was crossed - no separate shape lookup needed for direction.
  //
  // TargetAllocationDeviation is modeled as a 'ceiling' shape (so severity
  // computation is correct), but its `actual` is the bucket's deviation,
  // not a holding percentage - the design's dedicated third template (fixed
  // Tue 11/24, issue #343) needs targetAllocationDetail instead and is
  // built before either of the two generic templates below run.
  private buildMessage(
    input: ThresholdEngineInput,
    severity: Severity,
    threshold: number
  ): string {
    if (input.targetAllocationDetail) {
      const { actualAllocation, deviation, targetAllocation } =
        input.targetAllocationDetail;
      const actualPercentage = (actualAllocation * 100).toFixed(1);
      const targetPercentage = (targetAllocation * 100).toFixed(1);
      const points = (Math.abs(deviation) * 100).toFixed(1);
      const direction = deviation >= 0 ? 'above' : 'below';

      return `${input.subject.value} is ${actualPercentage}% of your portfolio, ${points} points ${direction} your ${targetPercentage}% target.`;
    }

    const definition = getThresholdDefault(input.ruleKey);
    const level = severity === 'RED' ? 'red' : 'yellow';
    const actualPercentage = (input.actual * 100).toFixed(1);
    const thresholdPercentage = (threshold * 100).toFixed(1);
    const direction = input.actual < threshold ? 'below' : 'above';

    if (definition?.shape === 'band') {
      return `Your portfolio ${input.subject.value} is ${actualPercentage}%, ${direction} the ${thresholdPercentage}% ${level} limit.`;
    }

    return `${input.subject.value} is ${actualPercentage}% of your portfolio, ${direction} the ${thresholdPercentage}% ${level} limit.`;
  }

  // RED before YELLOW; within a level, biggest overshoot first; ties broken
  // alphabetically for a stable order between refreshes. Overshoot is
  // direction-aware: for a high-side breach (actual > threshold, the normal
  // ceiling case) actual/threshold grows with severity; for a low-side band
  // breach (actual < threshold, e.g. volatility or cash too low) it is
  // inverted (threshold/actual) so that "further below the line" still
  // produces a larger, worse-first value instead of sorting last.
  private sortWarnings(warnings: RiskWarning[]): RiskWarning[] {
    const severityRank: Record<string, number> = { RED: 0, YELLOW: 1 };
    const overshoot = (warning: RiskWarning): number => {
      return warning.actual < warning.threshold
        ? warning.threshold / warning.actual
        : warning.actual / warning.threshold;
    };

    return [...warnings].sort((a, b) => {
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity];
      }

      const overshootA = overshoot(a);
      const overshootB = overshoot(b);

      if (overshootA !== overshootB) {
        return overshootB - overshootA;
      }

      return a.subject.value.localeCompare(b.subject.value);
    });
  }
}
