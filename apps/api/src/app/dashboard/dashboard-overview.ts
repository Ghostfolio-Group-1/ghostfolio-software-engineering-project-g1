import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { DATE_FORMAT } from '@ghostfolio/common/helper';

import { Injectable } from '@nestjs/common';
import { format, isValid } from 'date-fns';

import { ChartsApi } from '../charts/charts-api';
import { ExposureService } from '../risk/exposure.service';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from '../risk/risk-concentration.mapper';
import { TaxService } from '../tax/tax.service';
import type { DashboardOverviewResponse } from './interfaces/dashboard-overview-response.interface';

export const DASHBOARD_CHART_RANGE = '1y';

// Skeleton: loads the risk, tax and charts sections in parallel with the same
// calls their controllers make. Per-section failure handling ("unavailable")
// comes in the Oct 21 aggregation issue.
@Injectable()
export class DashboardOverview {
  public constructor(
    private readonly chartsApi: ChartsApi,
    private readonly exposureService: ExposureService,
    private readonly portfolioService: PortfolioService,
    private readonly taxService: TaxService
  ) {}

  public async getOverview({
    baseCurrency,
    userId
  }: {
    baseCurrency: string;
    userId: string;
  }): Promise<DashboardOverviewResponse> {
    const [risk, tax, charts] = await Promise.all([
      this.getRisk({ baseCurrency, userId }),
      this.taxService.getFifoRealizedGains(userId),
      this.getCharts(userId)
    ]);

    return { charts, risk, tax };
  }

  private async getRisk({
    baseCurrency,
    userId
  }: {
    baseCurrency: string;
    userId: string;
  }) {
    const limit = parseConcentrationLimit(undefined);

    if (limit === null) {
      throw new Error('Default concentration limit is invalid');
    }

    const holdings = await this.portfolioService.getHoldings({
      dateRange: 'max',
      userId
    });

    const summary = this.exposureService.buildRiskSummary(
      holdings,
      baseCurrency
    );

    return toRiskConcentrationResponse({ holdings, limit, summary });
  }

  private async getCharts(userId: string) {
    const { chart, dateOfFirstActivity } =
      await this.portfolioService.getPerformance({ dateRange: 'max', userId });

    return this.chartsApi.getSeries({
      earliestActivityDate:
        dateOfFirstActivity && isValid(dateOfFirstActivity)
          ? format(dateOfFirstActivity, DATE_FORMAT)
          : undefined,
      history: chart ?? [],
      range: DASHBOARD_CHART_RANGE
    });
  }
}
