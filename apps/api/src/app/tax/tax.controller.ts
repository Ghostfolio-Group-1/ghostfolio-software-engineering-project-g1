import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import type { ApiResponse } from '@ghostfolio/common/api-conventions';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query
} from '@nestjs/common';

import { GetRealizedGainsDto } from './get-realized-gains.dto';
import type { TaxLotsResponse } from './interfaces/tax-lots-response.interface';
import type { TaxRealizedGainsResponse } from './interfaces/tax-realized-gains-response.interface';
import { TaxService } from './tax.service';

@Controller('tax')
export class TaxController {
  public constructor(private readonly taxService: TaxService) {}

  @Get('realized-gains')
  @RequiresScope(scopes.portfolioRead)
  public async getRealizedGains(
    @Impersonation() { userId }: ImpersonationContext,
    @Query() query: GetRealizedGainsDto
  ): Promise<ApiResponse<TaxRealizedGainsResponse>> {
    try {
      const result = await this.taxService.getRealizedGains(
        userId,
        query.method ?? 'FIFO'
      );

      return createSuccessResponse(result);
    } catch (error) {
      throw new HttpException(
        createErrorResponse(
          'TAX_REALIZED_GAINS_FAILED',
          error instanceof Error
            ? error.message
            : 'Unable to calculate realized gains'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }

  @Get('lots')
  @RequiresScope(scopes.portfolioRead)
  public async getTaxLots(
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<ApiResponse<TaxLotsResponse>> {
    try {
      const result = await this.taxService.getTaxLots(userId);

      return createSuccessResponse(result);
    } catch (error) {
      throw new HttpException(
        createErrorResponse(
          'TAX_LOTS_FAILED',
          error instanceof Error ? error.message : 'Unable to derive tax lots'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }
}
