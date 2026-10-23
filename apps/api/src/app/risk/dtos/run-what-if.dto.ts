import { IsNumber, IsString } from 'class-validator';

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.11.
//
// dropPercentage is deliberately only type-checked here (@IsNumber), not
// range-checked (no @Max/@Min). The global ValidationPipe in main.ts runs
// before the controller, so a range decorator here would reject an
// out-of-range value with Nest's generic validation-error shape instead of
// the feature-specific RISK_WHATIF_INVALID_DROP envelope. The (0, 1] range
// check lives in WhatIfService/RiskController's try/catch instead, where it
// can produce the right envelope - per Tharun's review on PR #138.
export class RunWhatIfDto {
  @IsString()
  dataSource: string;

  @IsNumber()
  dropPercentage: number;

  @IsString()
  symbol: string;
}
