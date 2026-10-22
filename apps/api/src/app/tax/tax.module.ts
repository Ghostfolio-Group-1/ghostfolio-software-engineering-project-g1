import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { TaxDataService } from './tax-data.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Module({
  controllers: [TaxController],
  exports: [TaxDataService, TaxService],
  imports: [ImpersonationModule, PrismaModule],
  providers: [TaxDataService, TaxService]
})
export class TaxModule {}
