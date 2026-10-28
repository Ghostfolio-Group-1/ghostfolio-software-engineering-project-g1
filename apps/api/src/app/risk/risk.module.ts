import { AccountModule } from '@ghostfolio/api/app/account/account.module';
import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { RedisCacheModule } from '@ghostfolio/api/app/redis-cache/redis-cache.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';
import { MarketDataModule } from '@ghostfolio/api/services/market-data/market-data.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskEvaluationService } from './risk-evaluation.service';
import { RiskController } from './risk.controller';
import { ThresholdEngineService } from './threshold-engine.service';
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

@Module({
  controllers: [RiskController],
  exports: [ExposureService],
  imports: [
    AccountModule,
    ExchangeRateDataModule,
    ImpersonationModule,
    MarketDataModule,
    PortfolioModule,
    PrismaModule,
    RedisCacheModule
  ],
  providers: [
    ExposureCalculatorService,
    ExposureService,
    HealthScoreCalculatorService,
    RiskEvaluationService,
    ThresholdEngineService,
    VolatilityCacheService,
    WhatIfService
  ]
})
export class RiskModule {}
