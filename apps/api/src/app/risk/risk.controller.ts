import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import {
  ApiResponse,
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import { SubscriptionType } from '@ghostfolio/common/enums';
import { isRestrictedView } from '@ghostfolio/common/permissions';
import { hasScope, scopes } from '@ghostfolio/common/scopes';
import type {
  ImpersonationContext,
  RequestWithUser
} from '@ghostfolio/common/types';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Query
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { RunWhatIfDto } from './dtos/run-what-if.dto';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskConcentrationResponse } from './interfaces/risk-concentration-response.interface';
import { RiskScoreResponse } from './interfaces/risk-score-response.interface';
import { WhatIfResult } from './interfaces/what-if.interface';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from './risk-concentration.mapper';
import { RiskEvaluationService } from './risk-evaluation.service';
import { toRiskScoreResponse } from './risk-score.mapper';
import { ThresholdEngineService } from './threshold-engine.service';
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

@Controller('risk')
export class RiskController {
  public constructor(
    private readonly accountService: AccountService,
    private readonly configurationService: ConfigurationService,
    private readonly exposureService: ExposureService,
    private readonly healthScoreCalculatorService: HealthScoreCalculatorService,
    private readonly portfolioService: PortfolioService,
    @Inject(REQUEST) private readonly request: RequestWithUser,
    private readonly riskEvaluationService: RiskEvaluationService,
    private readonly thresholdEngineService: ThresholdEngineService,
    private readonly volatilityCacheService: VolatilityCacheService,
    private readonly whatIfService: WhatIfService
  ) {}

  // Mirrors PortfolioController#getReport's X-Ray rule-hiding (Section 4 of
  // docs/sesha-notes/10-risk-api-contract.md: "today's X-Ray report hides
  // the individual rules for these users, I'm proposing the risk API does
  // the same"), reusing the same three gates rather than inventing new ones.
  private shouldHideRules(impersonationScopes: string[]): boolean {
    return (
      !hasScope(impersonationScopes, scopes.portfolioReadValues) ||
      isRestrictedView(this.request.user) ||
      (this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION') &&
        this.request.user.subscription?.type === SubscriptionType.Basic)
    );
  }

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

  @Get('score')
  @RequiresScope(scopes.portfolioRead)
  public async getScore(
    @Impersonation()
    { scopes: impersonationScopes, userId, userSettings }: ImpersonationContext
  ): Promise<ApiResponse<RiskScoreResponse>> {
    const [holdings, cashDetails] = await Promise.all([
      this.portfolioService.getHoldings({ userId, dateRange: 'max' }),
      this.accountService.getCashDetails({
        userId,
        currency: userSettings.baseCurrency
      })
    ]);
    const volatility = await this.volatilityCacheService.getPortfolioVolatility(
      { baseCurrency: userSettings.baseCurrency, holdings }
    );

    const evaluation = this.riskEvaluationService.evaluate({
      holdings,
      baseCurrency: userSettings.baseCurrency,
      cashBalance: cashDetails.balanceInBaseCurrency,
      targetAllocation: userSettings.targetAllocation,
      volatility
    });
    const healthScore = this.healthScoreCalculatorService.calculateHealthScore(
      evaluation.ruleResults
    );

    const response = toRiskScoreResponse({
      evaluation,
      healthScore,
      thresholdEngineService: this.thresholdEngineService
    });

    if (this.shouldHideRules(impersonationScopes)) {
      for (const category of response.categories) {
        category.rules = null;
      }
    }

    return createSuccessResponse(response);
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
    const volatility = await this.volatilityCacheService.getPortfolioVolatility(
      { baseCurrency: userSettings.baseCurrency, holdings }
    );

    try {
      const result = this.whatIfService.calculateWhatIf({
        holdings,
        volatility,
        baseCurrency: userSettings.baseCurrency,
        cashBalance: cashDetails.balanceInBaseCurrency,
        scenario: { dataSource, dropPercentage, symbol },
        targetAllocation: userSettings.targetAllocation
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
