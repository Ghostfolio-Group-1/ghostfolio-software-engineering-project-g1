import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';

import { Module } from '@nestjs/common';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { RiskController } from './risk.controller';

@Module({
  controllers: [RiskController],
  imports: [ExchangeRateDataModule, ImpersonationModule, PortfolioModule],
  providers: [ExposureCalculatorService, ExposureService]
})
export class RiskModule {}
