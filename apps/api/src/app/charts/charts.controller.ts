import {
  ChartSeriesKind,
  ChartSeriesResponse
} from '@ghostfolio/common/interfaces/chart-series-response.interface';

import { Controller, Get, Query } from '@nestjs/common';

import { ChartsApi } from './charts-api';

@Controller('charts')
export class ChartsController {
  public constructor(private readonly chartsApi: ChartsApi) {}

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
