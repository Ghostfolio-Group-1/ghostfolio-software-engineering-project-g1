import { EvaluationResult } from '@ghostfolio/api/models/interfaces/evaluation-result.interface';

// Covariant extension of the base EvaluationResult: still satisfies the
// Rule<T> contract (evaluation + value), but carries the extra numeric and
// NO_DATA context the ThresholdEngine (Oct 16/19) needs to assign severity.
export interface RiskEvaluationResult extends EvaluationResult {
  actual?: number;
  details?: {
    hasSufficientData?: boolean;
    historyDays?: number;
    [key: string]: unknown;
  };
}
