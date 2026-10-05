import { Module } from '@nestjs/common';

import { RiskController } from './risk.controller';

@Module({
  controllers: [RiskController]
})
export class RiskModule {}
