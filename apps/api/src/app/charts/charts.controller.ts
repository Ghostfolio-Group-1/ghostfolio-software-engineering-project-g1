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
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query
} from '@nestjs/common';
import { format, isValid } from 'date-fns';

import { ChartsApi } from './charts-api';

@Controller('charts')
export class ChartsController {
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
    const { chart, dateOfFirstActivity } =
      await this.portfolioService.getPerformance({ dateRange: 'max', userId });

    try {
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

      throw error;
    }
  }
}
