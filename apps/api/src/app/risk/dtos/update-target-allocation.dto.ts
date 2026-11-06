import { TargetAllocationGroupBy } from '@ghostfolio/common/interfaces';

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  ValidateNested
} from 'class-validator';

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.6.
//
// Only shape/type is enforced by decorators here. The sum-to-1, duplicate
// key and valid-key-for-groupBy business rules run in
// target-allocation.mapper.ts's validateTargetAllocationInput() instead, so
// they can produce the feature-specific RISK_TARGET_* envelope rather than
// Nest's generic validation-error shape - the same split RunWhatIfDto uses
// for dropPercentage.
export const TARGET_ALLOCATION_GROUP_BY_VALUES: TargetAllocationGroupBy[] = [
  'assetClass',
  'country',
  'currency',
  'sector',
  'symbol'
];

export class TargetAllocationEntryDto {
  @IsString()
  key: string;

  @IsNumber()
  percentage: number;
}

export class UpdateTargetAllocationDto {
  @IsIn(TARGET_ALLOCATION_GROUP_BY_VALUES)
  groupBy: TargetAllocationGroupBy;

  @ArrayMinSize(1)
  @IsArray()
  @Type(() => TargetAllocationEntryDto)
  @ValidateNested({ each: true })
  targets: TargetAllocationEntryDto[];
}
