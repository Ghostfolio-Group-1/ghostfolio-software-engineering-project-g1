import { Module } from '@nestjs/common';

import { ChartsApi } from './charts-api';
import { ChartsController } from './charts.controller';

@Module({
  controllers: [ChartsController],
  providers: [ChartsApi]
})
export class ChartsModule {}
