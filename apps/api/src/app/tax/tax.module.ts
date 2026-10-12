import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { TaxDataService } from './tax-data.service';
import { TaxController } from './tax.controller';

@Module({
  controllers: [TaxController],
  exports: [TaxDataService],
  imports: [PrismaModule],
  providers: [TaxDataService]
})
export class TaxModule {}
