import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import type { ApiResponse } from '@ghostfolio/common/api-conventions';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import type { TaxRealizedGainsResponse } from './interfaces/tax-realized-gains-response.interface';
import { TaxService } from './tax.service';

@Controller('tax')
export class TaxController {
  public constructor(private readonly taxService: TaxService) {}

  @Get('realized-gains')
  @RequiresScope(scopes.portfolioRead)
  public async getRealizedGains(
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<ApiResponse<TaxRealizedGainsResponse>> {
    try {
      const result = await this.taxService.getFifoRealizedGains(userId);

      return createSuccessResponse(result);
    } catch (error) {
      throw new HttpException(
        createErrorResponse(
          'TAX_REALIZED_GAINS_FAILED',
          error instanceof Error
            ? error.message
            : 'Unable to calculate FIFO realized gains'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }
}
