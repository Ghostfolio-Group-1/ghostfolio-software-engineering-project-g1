import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import type { ApiResponse } from '@ghostfolio/common/api-conventions';
import { DATE_FORMAT } from '@ghostfolio/common/helper';
import type {
  ChartSeriesKind,
  ChartSeriesResponse
} from '@ghostfolio/common/interfaces/chart-series-response.interface';
import type { DrawdownResponse } from '@ghostfolio/common/interfaces/drawdown-response.interface';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Query
} from '@nestjs/common';
import { format, isValid } from 'date-fns';

import { ChartsApi } from './charts-api';

@Controller('charts')
export class ChartsController {
  private readonly logger = new Logger(ChartsController.name);

  public constructor(
    private readonly chartsApi: ChartsApi,
    private readonly portfolioService: PortfolioService
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
}
