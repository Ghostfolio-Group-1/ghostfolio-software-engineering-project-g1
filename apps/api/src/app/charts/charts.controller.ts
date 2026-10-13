import {
  ChartSeriesKind,
  ChartSeriesResponse
} from '@ghostfolio/common/interfaces/chart-series-response.interface';
import { ReturnComparisonResponse } from '@ghostfolio/common/interfaces/return-comparison-response.interface';

import { Controller, Get, Query } from '@nestjs/common';

import { ChartsApi } from './charts-api';

@Controller('charts')
export class ChartsController {
  public constructor(private readonly chartsApi: ChartsApi) {}

  @Get('return-comparison')
  public getReturnComparison(
    @Query('earliestActivityDate') earliestActivityDate?: string,
    @Query('endDate') endDate?: string,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string,
    @Query('symbol') symbol?: string
  ): ReturnComparisonResponse {
    return this.chartsApi.getReturnComparison({
      earliestActivityDate,
      endDate,
      range,
      startDate,
      symbol
    });
  }

  @Get('series')
  public getSeries(
    @Query('earliestActivityDate') earliestActivityDate?: string,
    @Query('endDate') endDate?: string,
    @Query('kind') kind?: ChartSeriesKind,
    @Query('range') range?: string,
    @Query('startDate') startDate?: string
  ): ChartSeriesResponse {
    return this.chartsApi.getSeries({
      earliestActivityDate,
      endDate,
      kind,
      range,
      startDate
    });
  }
}
