import { Module } from '@nestjs/common';

import { ChartsController } from './charts.controller';

@Module({
  controllers: [ChartsController]
})
export class ChartsModule {}
