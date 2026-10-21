import { AccountModule } from '@ghostfolio/api/app/account/account.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';

import { Module } from '@nestjs/common';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskEvaluationService } from './risk-evaluation.service';
import { RiskController } from './risk.controller';
import { ThresholdEngineService } from './threshold-engine.service';
import { WhatIfService } from './what-if.service';

@Module({
  controllers: [RiskController],
  imports: [
    AccountModule,
    ExchangeRateDataModule,
    ImpersonationModule,
    PortfolioModule
  ],
  providers: [
    ExposureCalculatorService,
    ExposureService,
    HealthScoreCalculatorService,
    RiskEvaluationService,
    ThresholdEngineService,
    WhatIfService
  ]
})
export class RiskModule {}
