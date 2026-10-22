import { AccountService } from '@ghostfolio/api/app/account/account.service';
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
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Query
} from '@nestjs/common';

import { RunWhatIfDto } from './dtos/run-what-if.dto';
import { ExposureService } from './exposure.service';
import { RiskConcentrationResponse } from './interfaces/risk-concentration-response.interface';
import { WhatIfResult } from './interfaces/what-if.interface';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from './risk-concentration.mapper';
import { WhatIfService } from './what-if.service';

@Controller('risk')
export class RiskController {
  public constructor(
    private readonly accountService: AccountService,
    private readonly exposureService: ExposureService,
    private readonly portfolioService: PortfolioService,
    private readonly whatIfService: WhatIfService
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

    const summary = this.exposureService.getRiskSummary(
      holdings,
      userSettings.baseCurrency
    );

    return createSuccessResponse(
      toRiskConcentrationResponse({ holdings, limit, summary })
    );
  }

  @Post('what-if')
  @HttpCode(HttpStatus.OK)
  @RequiresScope(scopes.portfolioRead)
  public async postWhatIf(
    @Impersonation() { userId, userSettings }: ImpersonationContext,
    @Body() { dataSource, dropPercentage, symbol }: RunWhatIfDto
  ): Promise<ApiResponse<WhatIfResult>> {
    const [holdings, cashDetails] = await Promise.all([
      this.portfolioService.getHoldings({ userId, dateRange: 'max' }),
      this.accountService.getCashDetails({
        userId,
        currency: userSettings.baseCurrency
      })
    ]);

    try {
      const result = this.whatIfService.calculateWhatIf({
        holdings,
        baseCurrency: userSettings.baseCurrency,
        cashBalance: cashDetails.balanceInBaseCurrency,
        scenario: { dataSource, dropPercentage, symbol },
        targetAllocation: userSettings.targetAllocation,
        // No nightly volatility cache is wired up yet, so PortfolioVolatility
        // reports NO_DATA until that pipeline exists - see this PR's
        // known-gap note.
        volatility: undefined
      });

      return createSuccessResponse(result);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          createErrorResponse('RISK_WHATIF_INVALID_DROP', error.message),
          HttpStatus.BAD_REQUEST
        );
      }

      if (error instanceof NotFoundException) {
        throw new HttpException(
          createErrorResponse('RISK_WHATIF_HOLDING_NOT_FOUND', error.message),
          HttpStatus.NOT_FOUND
        );
      }

      throw error;
    }
  }
}
