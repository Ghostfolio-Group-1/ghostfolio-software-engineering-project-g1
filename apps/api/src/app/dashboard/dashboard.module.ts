import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';

import { Module } from '@nestjs/common';

import { ChartsModule } from '../charts/charts.module';
import { RiskModule } from '../risk/risk.module';
import { TaxModule } from '../tax/tax.module';
import { DashboardOverview } from './dashboard-overview';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [DashboardController],
  exports: [DashboardOverview],
  imports: [
    ChartsModule,
    ImpersonationModule,
    PortfolioModule,
    RiskModule,
    TaxModule
  ],
  providers: [DashboardOverview]
})
export class DashboardModule {}
