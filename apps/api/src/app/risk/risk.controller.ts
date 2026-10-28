import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  ApiResponse,
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query
} from '@nestjs/common';

import { ExposureService } from './exposure.service';
import { RiskConcentrationResponse } from './interfaces/risk-concentration-response.interface';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from './risk-concentration.mapper';

@Controller('risk')
export class RiskController {
  public constructor(
    private readonly exposureService: ExposureService,
    private readonly portfolioService: PortfolioService
  ) {}

  @Get('concentration')
  @RequiresScope(scopes.portfolioRead)
  public async getConcentration(
    @Impersonation() { userId, userSettings }: ImpersonationContext,
    @Query('limit') limitParam?: string
  ): Promise<ApiResponse<RiskConcentrationResponse>> {
    const limit = parseConcentrationLimit(limitParam);

    if (limit === null) {
      throw new HttpException(
        createErrorResponse(
          'RISK_INVALID_QUERY',
          'limit must be an integer between 1 and 20'
        ),
        HttpStatus.BAD_REQUEST
      );
    }

    const holdings = await this.portfolioService.getHoldings({
      userId,
      dateRange: 'max'
    });

    const summary = this.exposureService.buildRiskSummary(
      holdings,
      userSettings.baseCurrency
    );

    return createSuccessResponse(
      toRiskConcentrationResponse({ holdings, limit, summary })
    );
  }
}
