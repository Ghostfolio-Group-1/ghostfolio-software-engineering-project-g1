import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { DATE_FORMAT } from '@ghostfolio/common/helper';

import { Injectable, Logger } from '@nestjs/common';
import { format, isValid } from 'date-fns';

import { ChartsApi } from '../charts/charts-api';
import { ExposureService } from '../risk/exposure.service';
import {
  parseConcentrationLimit,
  toRiskConcentrationResponse
} from '../risk/risk-concentration.mapper';
import { TaxService } from '../tax/tax.service';
import type {
  DashboardOverviewResponse,
  DashboardSection,
  DashboardSectionName
} from './interfaces/dashboard-overview-response.interface';

export const DASHBOARD_CHART_RANGE = '1y';

export const DASHBOARD_SECTION_ERROR_CODES: Record<
  DashboardSectionName,
  string
> = {
  charts: 'DASHBOARD_CHARTS_UNAVAILABLE',
  risk: 'DASHBOARD_RISK_UNAVAILABLE',
  tax: 'DASHBOARD_TAX_UNAVAILABLE'
};

// Loads the risk, tax and charts sections in parallel with the same calls
// their controllers make. A failing section is marked unavailable (the real
// error is logged, not returned) so the other sections still render.
@Injectable()
export class DashboardOverview {
  private readonly logger = new Logger(DashboardOverview.name);

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
      this.loadSection('risk', () => {
        return this.getRisk({ baseCurrency, userId });
      }),
      this.loadSection('tax', () => {
        return this.taxService.getFifoRealizedGains(userId);
      }),
      this.loadSection('charts', () => {
        return this.getCharts(userId);
      })
    ]);

    return { charts, risk, tax };
  }

  private async loadSection<T>(
    name: DashboardSectionName,
    load: () => Promise<T>
  ): Promise<DashboardSection<T>> {
    try {
      return { data: await load(), status: 'available' };
    } catch (error) {
      this.logger.error(
        `Dashboard ${name} section failed`,
        error instanceof Error ? error.stack : String(error)
      );

      return {
        error: {
          code: DASHBOARD_SECTION_ERROR_CODES[name],
          message: `The ${name} section could not be loaded`
        },
        status: 'unavailable'
      };
    }
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

    const summary = this.exposureService.getRiskSummary(holdings, baseCurrency);

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
