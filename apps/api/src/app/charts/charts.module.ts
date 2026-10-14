import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';

import { Module } from '@nestjs/common';

import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';

@Module({
  controllers: [ChartsController],
  imports: [ImpersonationModule, PortfolioModule],
  providers: [ChartsApi]
})
export class ChartsModule {}
