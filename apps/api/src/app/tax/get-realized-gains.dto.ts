import { IsIn, IsOptional } from 'class-validator';

import {
  TAX_CALCULATION_METHODS,
  type TaxCalculationMethod
} from './tax-calculator';

export class GetRealizedGainsDto {
  @IsIn(TAX_CALCULATION_METHODS)
  @IsOptional()
  method?: TaxCalculationMethod;
}
