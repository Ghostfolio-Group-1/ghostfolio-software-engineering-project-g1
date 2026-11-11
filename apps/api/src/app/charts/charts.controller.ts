import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { SymbolProfileService } from '@ghostfolio/api/services/symbol-profile/symbol-profile.service';
import {
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import type { ApiResponse } from '@ghostfolio/common/api-conventions';
import { DEFAULT_CURRENCY } from '@ghostfolio/common/config';
import { DATE_FORMAT } from '@ghostfolio/common/helper';
import type { BenchmarkComparisonResponse } from '@ghostfolio/common/interfaces/benchmark-comparison-response.interface';
import type {
  ChartSeriesKind,
  ChartSeriesResponse
} from '@ghostfolio/common/interfaces/chart-series-response.interface';
import type { DrawdownResponse } from '@ghostfolio/common/interfaces/drawdown-response.interface';
import type { ReturnComparisonResponse } from '@ghostfolio/common/interfaces/return-comparison-response.interface';
import type { ReturnActivityInput } from '@ghostfolio/common/return-comparison';
import { activitiesToObservations } from '@ghostfolio/common/return-comparison';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Query
} from '@nestjs/common';
import { DataSource, Type as ActivityType } from '@prisma/client';
import { format, isValid } from 'date-fns';

import { ChartsApi } from './charts-api';

@Controller('charts')
export class ChartsController {
  private readonly logger = new Logger(ChartsController.name);

  public constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly chartsApi: ChartsApi,
    private readonly marketDataService: MarketDataService,
    private readonly portfolioService: PortfolioService,
    private readonly symbolProfileService: SymbolProfileService
  ) {}

  // History and the first activity date are loaded on the server for the
  // token user; the client only chooses the range and the series kind.
  @Get('series')
  @RequiresScope(scopes.portfolioRead)
  public async getSeries(
    @Impersonation() { userId }: ImpersonationContext,
    @Query('endDate') endDate?: string,
    @Query('kind') kind?: ChartSeriesKind,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string
  ): Promise<ApiResponse<ChartSeriesResponse>> {
    try {
      const { chart, dateOfFirstActivity } =
        await this.portfolioService.getPerformance({
          dateRange: 'max',
          userId
        });

      return createSuccessResponse(
        this.chartsApi.getSeries({
          endDate,
          kind,
          range,
          startDate,
          earliestActivityDate:
            dateOfFirstActivity && isValid(dateOfFirstActivity)
              ? format(dateOfFirstActivity, DATE_FORMAT)
              : undefined,
          history: chart ?? []
        })
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          createErrorResponse('CHARTS_INVALID_QUERY', error.message),
          HttpStatus.BAD_REQUEST
        );
      }

      // Loading or building the series failed: log the real error, return
      // the shared envelope without internal details.
      this.logger.error(
        'Charts series failed',
        error instanceof Error ? error.stack : String(error)
      );

      throw new HttpException(
        createErrorResponse(
          'CHARTS_SERIES_FAILED',
          'Unable to load the chart series'
        ),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Portfolio value indexed against a market-data symbol. The client picks
  // the range and the benchmark ticker; clearing the ticker drops the overlay.
  @Get('benchmark-comparison')
  @RequiresScope(scopes.portfolioRead)
  public async getBenchmarkComparison(
    @Impersonation() { userId }: ImpersonationContext,
    @Query('benchmark') benchmark?: string,
    @Query('dataSource') dataSourceQuery?: string,
    @Query('endDate') endDate?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string
  ): Promise<ApiResponse<BenchmarkComparisonResponse>> {
    try {
      const benchmarkSymbol = benchmark?.trim();

      if (!benchmarkSymbol) {
        throw new BadRequestException('benchmark is required');
      }

      const dataSource = this.readDataSource(dataSourceQuery);
      const [symbolProfile] = await this.symbolProfileService.getSymbolProfiles(
        [{ dataSource, symbol: benchmarkSymbol }]
      );

      if (!symbolProfile) {
        throw new NotFoundException(
          `Benchmark symbol ${benchmarkSymbol} was not found`
        );
      }

      const { chart, dateOfFirstActivity } =
        await this.portfolioService.getPerformance({
          dateRange: 'max',
          userId
        });

      const marketData = await this.marketDataService.getRange({
        assetProfileIdentifiers: [{ dataSource, symbol: benchmarkSymbol }],
        dateQuery: { gte: new Date(0) }
      });

      return createSuccessResponse(
        this.chartsApi.getBenchmarkComparison({
          endDate,
          range,
          startDate,
          benchmarkSymbol,
          earliestActivityDate:
            dateOfFirstActivity && isValid(dateOfFirstActivity)
              ? format(dateOfFirstActivity, DATE_FORMAT)
              : undefined,
          portfolioHistory: chart ?? [],
          benchmarkHistory: marketData.map(({ date, marketPrice }) => {
            return {
              date: format(date, DATE_FORMAT),
              marketPrice
            };
          })
        })
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          createErrorResponse('CHARTS_INVALID_QUERY', error.message),
          HttpStatus.BAD_REQUEST
        );
      }

      if (error instanceof NotFoundException) {
        throw new HttpException(
          createErrorResponse('CHARTS_BENCHMARK_NOT_FOUND', error.message),
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.error(
        'Charts benchmark comparison failed',
        error instanceof Error ? error.stack : String(error)
      );

      throw new HttpException(
        createErrorResponse(
          'CHARTS_BENCHMARK_FAILED',
          'Unable to load the benchmark comparison'
        ),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Price return and total return on the same dates, both indexed to 100.
  // Omitting symbol combines the portfolio. An unknown symbol is 404.
  @Get('return-comparison')
  @RequiresScope(scopes.portfolioRead)
  public async getReturnComparison(
    @Impersonation() context: ImpersonationContext,
    @Query('endDate') endDate?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('symbol') symbol?: string
  ): Promise<ApiResponse<ReturnComparisonResponse>> {
    try {
      const userCurrency =
        context.userSettings?.baseCurrency ?? DEFAULT_CURRENCY;
      const { chart, dateOfFirstActivity } =
        await this.portfolioService.getPerformance({
          dateRange: 'max',
          userId: context.userId
        });
      const { activities } = await this.activitiesService.getActivities({
        sortColumn: 'date',
        sortDirection: 'asc',
        types: [ActivityType.BUY, ActivityType.DIVIDEND, ActivityType.SELL],
        userCurrency,
        userId: context.userId
      });
      const namedSymbol = symbol?.trim() || undefined;
      const holding = namedSymbol
        ? activities.find((activity) => {
            return activity.assetProfile?.symbol === namedSymbol;
          })
        : undefined;
      const profile = holding?.assetProfile;
      const marketData =
        profile?.currency === userCurrency
          ? await this.marketDataService.getRange({
              assetProfileIdentifiers: [
                {
                  dataSource: profile.dataSource,
                  symbol: profile.symbol
                }
              ],
              dateQuery: { gte: new Date(0) }
            })
          : [];

      return createSuccessResponse(
        this.chartsApi.getReturnComparison({
          endDate,
          range,
          startDate,
          earliestActivityDate:
            dateOfFirstActivity && isValid(dateOfFirstActivity)
              ? format(dateOfFirstActivity, DATE_FORMAT)
              : undefined,
          observations: activitiesToObservations({
            activities: activities.flatMap((activity) => {
              return this.readReturnActivity(activity);
            }),
            history: chart ?? [],
            prices: marketData.map(({ date, marketPrice }) => {
              return {
                date: format(date, DATE_FORMAT),
                marketPrice
              };
            }),
            symbol: namedSymbol
          }),
          symbol: namedSymbol
        })
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          createErrorResponse('CHARTS_INVALID_QUERY', error.message),
          HttpStatus.BAD_REQUEST
        );
      }

      if (error instanceof NotFoundException) {
        throw new HttpException(
          createErrorResponse('CHARTS_SYMBOL_NOT_FOUND', error.message),
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.error(
        'Charts return comparison failed',
        error instanceof Error ? error.stack : String(error)
      );

      throw new HttpException(
        createErrorResponse(
          'CHARTS_RETURN_FAILED',
          'Unable to load the return comparison'
        ),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Percentage decline from the portfolio's running all-time peak. Peak
  // tracking uses full account history even when the requested range starts
  // later; only the visible window is returned in points.
  @Get('drawdown')
  @RequiresScope(scopes.portfolioRead)
  public async getDrawdown(
    @Impersonation() { userId }: ImpersonationContext,
    @Query('endDate') endDate?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string
  ): Promise<ApiResponse<DrawdownResponse>> {
    try {
      const { chart, dateOfFirstActivity } =
        await this.portfolioService.getPerformance({
          dateRange: 'max',
          userId
        });

      return createSuccessResponse(
        this.chartsApi.getDrawdown({
          endDate,
          range,
          startDate,
          earliestActivityDate:
            dateOfFirstActivity && isValid(dateOfFirstActivity)
              ? format(dateOfFirstActivity, DATE_FORMAT)
              : undefined,
          history: chart ?? []
        })
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException(
          createErrorResponse('CHARTS_INVALID_QUERY', error.message),
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.error(
        'Charts drawdown failed',
        error instanceof Error ? error.stack : String(error)
      );

      throw new HttpException(
        createErrorResponse(
          'CHARTS_DRAWDOWN_FAILED',
          'Unable to load the drawdown chart'
        ),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private readDataSource(value: string | undefined): DataSource {
    if (!value) {
      return DataSource.YAHOO;
    }

    if (!Object.values(DataSource).includes(value as DataSource)) {
      throw new BadRequestException(
        `dataSource must be one of: ${Object.values(DataSource).join(', ')}`
      );
    }

    return value as DataSource;
  }

  private readReturnActivity(activity: {
    assetProfile?: { symbol?: string };
    date: Date;
    quantity: number;
    type: ActivityType;
    valueInBaseCurrency: number;
  }): ReturnActivityInput[] {
    if (
      !activity.assetProfile?.symbol ||
      (activity.type !== ActivityType.BUY &&
        activity.type !== ActivityType.DIVIDEND &&
        activity.type !== ActivityType.SELL)
    ) {
      return [];
    }

    return [
      {
        date: format(activity.date, DATE_FORMAT),
        quantity: activity.quantity,
        symbol: activity.assetProfile.symbol,
        type: activity.type,
        valueInBaseCurrency: activity.valueInBaseCurrency
      }
    ];
  }
}
