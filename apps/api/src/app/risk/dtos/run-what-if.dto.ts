import { IsNumber, IsString, Max, Min } from 'class-validator';

// Spec: docs/sesha-notes/10-risk-api-contract.md Section 6.11.
export class RunWhatIfDto {
  @IsString()
  dataSource: string;

  @IsNumber()
  @Max(1)
  @Min(0)
  dropPercentage: number;

  @IsString()
  symbol: string;
}
