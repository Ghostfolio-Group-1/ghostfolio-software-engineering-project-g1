import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import {
  ApiResponse,
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import { SubscriptionType } from '@ghostfolio/common/enums';
import { RuleSettings } from '@ghostfolio/common/interfaces/x-ray-rules-settings.interface';
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
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { RunWhatIfDto } from './dtos/run-what-if.dto';
import { UpdateRiskThresholdDto } from './dtos/update-risk-threshold.dto';
import { UpdateTargetAllocationDto } from './dtos/update-target-allocation.dto';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskConcentrationResponse } from './interfaces/risk-concentration-response.interface';
import { RiskScoreResponse } from './interfaces/risk-score-response.interface';
import { RiskThresholdItem } from './interfaces/risk-threshold-response.interface';
import { RiskWarning } from './interfaces/risk-warning.interface';
import { TargetAllocationResponse } from './interfaces/target-allocation-response.interface';
import { WhatIfResult } from './interfaces/what-if.interface';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from './risk-concentration.mapper';
import { RiskEvaluationService } from './risk-evaluation.service';
import { toRiskScoreResponse } from './risk-score.mapper';
import {
  buildUpdatedRuleSettings,
  isKnownRiskRuleKey,
  toRiskThresholdItem,
  toRiskThresholdsList,
  validateThresholdUpdateInput
} from './risk-threshold.mapper';
import { parseWarningsQuery, paginateWarnings } from './risk-warnings.mapper';
import {
  toEmptyTargetAllocationResponse,
  toTargetAllocationResponse,
  validateTargetAllocationInput
} from './target-allocation.mapper';
import { ThresholdEngineService } from './threshold-engine.service';
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

@Controller('risk')
export class RiskController {
  public constructor(
    private readonly accountService: AccountService,
    private readonly configurationService: ConfigurationService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly exposureService: ExposureService,
    private readonly healthScoreCalculatorService: HealthScoreCalculatorService,
    private readonly portfolioService: PortfolioService,
    @Inject(REQUEST) private readonly request: RequestWithUser,
    private readonly riskEvaluationService: RiskEvaluationService,
    private readonly thresholdEngineService: ThresholdEngineService,
    private readonly userService: UserService,
    private readonly volatilityCacheService: VolatilityCacheService,
    private readonly whatIfService: WhatIfService
  ) {}

  // Writes are rejected while impersonating another user (docs/sesha-notes/
  // 10-risk-api-contract.md Section 2) - unlike the /user/setting route,
  // risk settings have no subset that's safe to change on the authenticated
  // user's behalf while impersonating, so this is an unconditional guard.
  private rejectIfImpersonating(isActive: boolean): void {
    if (isActive) {
      throw new HttpException(
        createErrorResponse(
          'RISK_FORBIDDEN',
          'Cannot change risk settings while impersonating another user.'
        ),
        HttpStatus.FORBIDDEN
      );
    }
  }

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

  @Get('warnings')
  @RequiresScope(scopes.portfolioRead)
  public async getWarnings(
    @Impersonation() { userId, userSettings }: ImpersonationContext,
    @Query('severity') severityParam?: string,
    @Query('page') pageParam?: string,
    @Query('pageSize') pageSizeParam?: string
  ): Promise<ApiResponse<RiskWarning[]>> {
    const query = parseWarningsQuery({
      page: pageParam,
      pageSize: pageSizeParam,
      severity: severityParam
    });

    if (query === null) {
      throw new HttpException(
        createErrorResponse(
          'RISK_INVALID_QUERY',
          'page, pageSize or severity is invalid'
        ),
        HttpStatus.BAD_REQUEST
      );
    }

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
    const warnings = this.riskEvaluationService.calculateWarnings(evaluation);
    const { items, total } = paginateWarnings(warnings, query);

    return createSuccessResponse(items, {
      page: query.page,
      pageSize: query.pageSize,
      total
    });
  }

  @Get('target-allocation')
  @RequiresScope(scopes.portfolioRead)
  public async getTargetAllocation(
    @Impersonation() { userId, userSettings }: ImpersonationContext
  ): Promise<ApiResponse<TargetAllocationResponse>> {
    const holdings = await this.portfolioService.getHoldings({
      userId,
      dateRange: 'max'
    });

    return createSuccessResponse(
      toTargetAllocationResponse({
        holdings,
        baseCurrency: userSettings.baseCurrency,
        exchangeRateDataService: this.exchangeRateDataService,
        targetAllocation: userSettings.targetAllocation,
        thresholdEngineService: this.thresholdEngineService
      })
    );
  }

  @Put('target-allocation')
  @RequiresScope(scopes.portfolioRead)
  public async putTargetAllocation(
    @Impersonation() { isActive, userId, userSettings }: ImpersonationContext,
    @Body() dto: UpdateTargetAllocationDto
  ): Promise<ApiResponse<TargetAllocationResponse>> {
    this.rejectIfImpersonating(isActive);

    const validationError = validateTargetAllocationInput(dto);

    if (validationError) {
      throw new HttpException(
        createErrorResponse(validationError.code, validationError.message),
        HttpStatus.BAD_REQUEST
      );
    }

    const targetAllocation = {
      groupBy: dto.groupBy,
      isActive: true,
      targets: dto.targets
    };

    await this.userService.updateUserSetting({
      emitPortfolioChangedEvent: false,
      userId,
      userSettings: { ...userSettings, targetAllocation }
    });

    const holdings = await this.portfolioService.getHoldings({
      userId,
      dateRange: 'max'
    });

    return createSuccessResponse(
      toTargetAllocationResponse({
        holdings,
        baseCurrency: userSettings.baseCurrency,
        exchangeRateDataService: this.exchangeRateDataService,
        targetAllocation,
        thresholdEngineService: this.thresholdEngineService
      })
    );
  }

  @Delete('target-allocation')
  @RequiresScope(scopes.portfolioRead)
  public async deleteTargetAllocation(
    @Impersonation() { isActive, userId, userSettings }: ImpersonationContext
  ): Promise<ApiResponse<TargetAllocationResponse>> {
    this.rejectIfImpersonating(isActive);

    const userSettingsWithoutTarget = { ...userSettings };
    delete userSettingsWithoutTarget.targetAllocation;

    await this.userService.updateUserSetting({
      emitPortfolioChangedEvent: false,
      userId,
      userSettings: userSettingsWithoutTarget
    });

    return createSuccessResponse(toEmptyTargetAllocationResponse());
  }

  @Get('thresholds')
  @RequiresScope(scopes.portfolioRead)
  public getThresholds(
    @Impersonation() { userSettings }: ImpersonationContext
  ): ApiResponse<RiskThresholdItem[]> {
    return createSuccessResponse(
      toRiskThresholdsList(
        userSettings.xRayRules as Record<string, RuleSettings> | undefined
      )
    );
  }

  @Put('thresholds/:ruleKey')
  @RequiresScope(scopes.portfolioRead)
  public async putThreshold(
    @Impersonation() { isActive, userId, userSettings }: ImpersonationContext,
    @Param('ruleKey') ruleKey: string,
    @Body() dto: UpdateRiskThresholdDto
  ): Promise<ApiResponse<RiskThresholdItem>> {
    this.rejectIfImpersonating(isActive);

    const validationError = validateThresholdUpdateInput(ruleKey, dto);

    if (validationError) {
      throw new HttpException(
        createErrorResponse(validationError.code, validationError.message),
        validationError.code === 'RISK_RULE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST
      );
    }

    const xRayRules: Record<string, RuleSettings> = {
      ...userSettings.xRayRules
    };
    xRayRules[ruleKey] = buildUpdatedRuleSettings(xRayRules[ruleKey], dto);

    await this.userService.updateUserSetting({
      emitPortfolioChangedEvent: false,
      userId,
      userSettings: { ...userSettings, xRayRules }
    });

    return createSuccessResponse(
      toRiskThresholdItem(ruleKey, xRayRules[ruleKey])
    );
  }

  @Delete('thresholds/:ruleKey')
  @RequiresScope(scopes.portfolioRead)
  public async deleteThreshold(
    @Impersonation() { isActive, userId, userSettings }: ImpersonationContext,
    @Param('ruleKey') ruleKey: string
  ): Promise<ApiResponse<RiskThresholdItem>> {
    this.rejectIfImpersonating(isActive);

    if (!isKnownRiskRuleKey(ruleKey)) {
      throw new HttpException(
        createErrorResponse(
          'RISK_RULE_NOT_FOUND',
          `"${ruleKey}" is not one of the risk module's rules.`
        ),
        HttpStatus.NOT_FOUND
      );
    }

    const xRayRules: Record<string, RuleSettings> = {
      ...userSettings.xRayRules
    };
    delete xRayRules[ruleKey];

    await this.userService.updateUserSetting({
      emitPortfolioChangedEvent: false,
      userId,
      userSettings: { ...userSettings, xRayRules }
    });

    return createSuccessResponse(toRiskThresholdItem(ruleKey));
  }
}
