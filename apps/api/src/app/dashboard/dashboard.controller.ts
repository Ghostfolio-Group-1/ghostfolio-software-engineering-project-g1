import { Impersonation } from '@ghostfolio/api/decorators/impersonation.decorator';
import { RequiresScope } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  createErrorResponse,
  createSuccessResponse
} from '@ghostfolio/common/api-conventions';
import type { ApiResponse } from '@ghostfolio/common/api-conventions';
import { scopes } from '@ghostfolio/common/scopes';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';

import { DashboardOverview } from './dashboard-overview';
import type { DashboardOverviewResponse } from './interfaces/dashboard-overview-response.interface';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  public constructor(private readonly dashboardOverview: DashboardOverview) {}

  // A failing section comes back as "unavailable" inside a 200; this catch
  // is only for unexpected failures outside the sections.
  @Get('overview')
  @RequiresScope(scopes.portfolioRead)
  public async getOverview(
    @Impersonation() { userId, userSettings }: ImpersonationContext
  ): Promise<ApiResponse<DashboardOverviewResponse>> {
    try {
      return createSuccessResponse(
        await this.dashboardOverview.getOverview({
          baseCurrency: userSettings.baseCurrency,
          userId
        })
      );
    } catch (error) {
      this.logger.error(
        'Dashboard overview failed',
        error instanceof Error ? error.stack : String(error)
      );

      throw new HttpException(
        createErrorResponse(
          'DASHBOARD_OVERVIEW_FAILED',
          'Unable to load the dashboard overview'
        ),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
