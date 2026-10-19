import { Injectable } from '@nestjs/common';

import { RiskWarning } from './interfaces/risk-warning.interface';
import { Severity } from './interfaces/severity.type';
import {
  getThresholdDefault,
  WarningThresholds
} from './warning-threshold.model';

export interface ThresholdEngineInput {
  actual: number | null; // null -> NO_DATA
  overrides?: WarningThresholds;
  ruleKey: string;
  subject: RiskWarning['subject'];
}

// Spec: docs/sesha-notes/07-warning-threshold-rules.md, Sections 4 and 7.
@Injectable()
export class ThresholdEngineService {
  public computeSeverity(input: ThresholdEngineInput): Severity {
    const definition = getThresholdDefault(input.ruleKey);

    if (!definition || input.actual === null) {
      return 'NO_DATA';
    }

    const thresholds = { ...definition.defaults, ...input.overrides };
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

  public buildWarnings(inputs: ThresholdEngineInput[]): RiskWarning[] {
    const warnings: RiskWarning[] = [];

    for (const input of inputs) {
      const severity = this.computeSeverity(input);

      if (severity !== 'YELLOW' && severity !== 'RED') {
        continue;
      }

      const definition = getThresholdDefault(input.ruleKey);
      const thresholds = { ...definition.defaults, ...input.overrides };
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

  private buildMessage(
    input: ThresholdEngineInput,
    severity: Severity,
    threshold: number
  ): string {
    const level = severity === 'RED' ? 'red' : 'yellow';
    const actualPercentage = (input.actual * 100).toFixed(1);
    const thresholdPercentage = (threshold * 100).toFixed(0);

    return `${input.subject.value} is ${actualPercentage}% of your portfolio, above the ${thresholdPercentage}% ${level} limit.`;
  }

  // RED before YELLOW; within a level, biggest overshoot first; ties broken
  // alphabetically for a stable order between refreshes.
  private sortWarnings(warnings: RiskWarning[]): RiskWarning[] {
    const severityRank: Record<string, number> = { RED: 0, YELLOW: 1 };

    return [...warnings].sort((a, b) => {
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity];
      }

      const overshootA = a.actual / a.threshold;
      const overshootB = b.actual / b.threshold;

      if (overshootA !== overshootB) {
        return overshootB - overshootA;
      }

      return a.subject.value.localeCompare(b.subject.value);
    });
  }
}
