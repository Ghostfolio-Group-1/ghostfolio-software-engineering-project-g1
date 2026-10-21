import { IsOptional, IsString } from 'class-validator';

export class GetRealizedGainsDto {
  @IsOptional()
  @IsString()
  method?: string;
}
