import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate
} from 'class-validator';

// Matches the real Ghostfolio DateRange type exactly
// (libs/common/src/lib/types/date-range.type.ts), including '1d' for
// what the UI labels "Today". Do not add a separate 'today' value here,
// it does not exist in the real type and would silently diverge from it.
export type DateRangePreset =
  '1d' | 'wtd' | 'mtd' | 'ytd' | '1y' | '5y' | 'max';

const DATE_RANGE_PRESETS: DateRangePreset[] = [
  '1d',
  'wtd',
  'mtd',
  'ytd',
  '1y',
  '5y',
  'max'
];

/**
 * Enforces the rules from the zoom/pan time-range spec:
 * - exactly one of `range` (preset) or the `startDate`/`endDate` pair
 *   (custom) must be present, never both, never neither
 * - `startDate` and `endDate` must both be present if either is
 * - `endDate` must not be before `startDate`
 *
 * Clamping rules (endDate beyond today, startDate before the account's
 * earliest activity) are intentionally NOT enforced here. Those depend
 * on account data the DTO has no access to, they belong in the service
 * layer, not in request validation.
 */
@ValidatorConstraint({ name: 'IsValidTimeRangeSelection', async: false })
class IsValidTimeRangeSelectionConstraint implements ValidatorConstraintInterface {
  private lastError = 'Invalid time range selection.';

  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as TimeRangeSelectionDto;

    const hasRange = dto.range !== undefined && dto.range !== null;
    const hasStartDate = dto.startDate !== undefined && dto.startDate !== null;
    const hasEndDate = dto.endDate !== undefined && dto.endDate !== null;
    const hasCustom = hasStartDate || hasEndDate;

    if (hasRange && hasCustom) {
      this.lastError =
        '"range" and "startDate"/"endDate" are mutually exclusive, provide one or the other, not both.';
      return false;
    }

    if (!hasRange && !hasCustom) {
      this.lastError =
        'Provide either "range" (a preset) or both "startDate" and "endDate" (a custom range).';
      return false;
    }

    if (hasCustom && (!hasStartDate || !hasEndDate)) {
      this.lastError =
        '"startDate" and "endDate" must both be provided for a custom range.';
      return false;
    }

    if (hasStartDate && hasEndDate) {
      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);

      if (end.getTime() < start.getTime()) {
        this.lastError = '"endDate" must not be before "startDate".';
        return false;
      }
    }

    return true;
  }

  defaultMessage(): string {
    return this.lastError;
  }
}

export class TimeRangeSelectionDto {
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS, {
    message: `range must be one of: ${DATE_RANGE_PRESETS.join(', ')}`
  })
  range?: DateRangePreset;

  @IsOptional()
  @Type(() => String)
  @IsISO8601(
    { strict: true },
    { message: 'startDate must be an ISO-8601 date, e.g. 2026-03-01' }
  )
  startDate?: string;

  @IsOptional()
  @Type(() => String)
  @IsISO8601(
    { strict: true },
    { message: 'endDate must be an ISO-8601 date, e.g. 2026-03-21' }
  )
  endDate?: string;

  // Not a real request field. @IsOptional() on the properties above makes
  // class-validator skip their validators entirely when the property is
  // undefined, which is exactly the case we need to check (e.g. range
  // absent because a custom range was given instead). This field has no
  // @IsOptional(), so class-validator always runs its validator,
  // regardless of which fields were actually provided. Its value is never
  // read, the constraint inspects the whole DTO via args.object.
  @Validate(IsValidTimeRangeSelectionConstraint)
  private readonly _crossFieldCheck?: true;
}
