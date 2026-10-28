import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';

import { Module } from '@nestjs/common';

import { ChartsModule } from '../charts/charts.module';
import { RiskModule } from '../risk/risk.module';
import { TaxModule } from '../tax/tax.module';
import { DashboardOverview } from './dashboard-overview';

// The endpoint (controller) and AppModule registration come in the Oct 22 issue.
@Module({
  exports: [DashboardOverview],
  imports: [ChartsModule, PortfolioModule, RiskModule, TaxModule],
  providers: [DashboardOverview]
})
export class DashboardModule {}
