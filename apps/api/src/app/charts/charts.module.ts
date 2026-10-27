import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';
import { MarketDataModule } from '@ghostfolio/api/services/market-data/market-data.module';
import { SymbolProfileModule } from '@ghostfolio/api/services/symbol-profile/symbol-profile.module';

import { Module } from '@nestjs/common';

import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';

@Module({
  controllers: [ChartsController],
  exports: [ChartsApi],
  imports: [
    ImpersonationModule,
    MarketDataModule,
    PortfolioModule,
    SymbolProfileModule
  ],
  providers: [ChartsApi]
})
export class ChartsModule {}
