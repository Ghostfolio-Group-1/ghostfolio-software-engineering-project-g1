// Spec: docs/sesha-notes/07-warning-threshold-rules.md, Section 3.
// Invariant: a rule's EvaluationResult.value is false if and only if its
// Severity is YELLOW or RED. NO_DATA is a fourth state so a rule that could
// not be checked is never shown as a fake green.
export type Severity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';
