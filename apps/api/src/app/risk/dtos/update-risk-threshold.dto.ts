import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  ValidateNested
} from 'class-validator';

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.9.
// Both fields are optional on the DTO; the "at least one must be present"
// rule and the range/order checks run in risk-threshold.mapper.ts via
// validateThresholds() (warning-threshold.model.ts) so they produce the
// RISK_THRESHOLD_* envelope instead of a generic validation error.
export class UpdateRiskThresholdThresholdsDto {
  @IsNumber()
  @IsOptional()
  max?: number;

  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  redMax?: number;

  @IsNumber()
  @IsOptional()
  redMin?: number;
}

export class UpdateRiskThresholdDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @Type(() => UpdateRiskThresholdThresholdsDto)
  @ValidateNested()
  thresholds?: UpdateRiskThresholdThresholdsDto;
}
