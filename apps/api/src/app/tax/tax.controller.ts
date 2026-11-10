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
  Logger,
  Query
} from '@nestjs/common';

import { GetRealizedGainsDto } from './get-realized-gains.dto';
import type { TaxDividendsResponse } from './interfaces/tax-dividends-response.interface';
import type { TaxLotsResponse } from './interfaces/tax-lots-response.interface';
import type { TaxRealizedGainsResponse } from './interfaces/tax-realized-gains-response.interface';
import type { TaxYearlySummaryResponse } from './interfaces/tax-yearly-summary-response.interface';
import { serializeYearlyTaxSummary } from './tax-yearly-summary.serializer';
import {
  MAX_TAX_DIVIDEND_YEAR,
  MIN_TAX_DIVIDEND_YEAR,
  TaxService
} from './tax.service';

@Controller('tax')
export class TaxController {
  private readonly logger = new Logger(TaxController.name);

  public constructor(private readonly taxService: TaxService) {}

  /** Authenticated, explicit-year yearly summary; reuse domain calculations. */
  @Get('yearly-summary')
  @RequiresScope(scopes.portfolioRead)
  public async getYearlySummary(
    @Impersonation() { userId }: ImpersonationContext,
    @Query('year') year: unknown,
    @Query('method') method: unknown
  ): Promise<ApiResponse<TaxYearlySummaryResponse>> {
    if (
      typeof year !== 'string' ||
      !/^\d{4}$/.test(year) ||
      Number(year) < MIN_TAX_DIVIDEND_YEAR ||
      Number(year) > MAX_TAX_DIVIDEND_YEAR ||
      (method !== undefined && method !== 'FIFO' && method !== 'AVERAGE_COST')
    ) {
      throw new HttpException(
        createErrorResponse(
          'TAX_INVALID_QUERY',
          'Specify a UTC calendar year between 1970 and 2100 and a supported method.'
        ),
        HttpStatus.BAD_REQUEST
      );
    }

    const calculationMethod =
      method === 'AVERAGE_COST' ? 'AVERAGE_COST' : 'FIFO';

    try {
      const summary = await this.taxService.getYearlySummary(
        userId,
        Number(year),
        calculationMethod
      );

      return createSuccessResponse(serializeYearlyTaxSummary(summary));
    } catch (error) {
      this.logger.error(
        'Yearly Tax summary query failed',
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        createErrorResponse(
          'TAX_YEARLY_SUMMARY_FAILED',
          'Unable to calculate yearly Tax summary.'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }

  @Get('realized-gains')
  @RequiresScope(scopes.portfolioRead)
  public async getRealizedGains(
    @Impersonation() { userId }: ImpersonationContext,
    @Query() query: GetRealizedGainsDto
  ): Promise<ApiResponse<TaxRealizedGainsResponse>> {
    try {
      const result = await this.taxService.getRealizedGains(
        userId,
        query.method ?? 'FIFO'
      );

      return createSuccessResponse(result);
    } catch (error) {
      throw new HttpException(
        createErrorResponse(
          'TAX_REALIZED_GAINS_FAILED',
          error instanceof Error
            ? error.message
            : 'Unable to calculate realized gains'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }

  /** The requested UTC calendar year is explicit; no implicit current-year default. */
  @Get('dividends')
  @RequiresScope(scopes.portfolioRead)
  public async getDividends(
    @Impersonation() { userId }: ImpersonationContext,
    @Query('year') year: unknown
  ): Promise<ApiResponse<TaxDividendsResponse>> {
    if (
      typeof year !== 'string' ||
      !/^\d{4}$/.test(year) ||
      Number(year) < MIN_TAX_DIVIDEND_YEAR ||
      Number(year) > MAX_TAX_DIVIDEND_YEAR
    ) {
      throw new HttpException(
        createErrorResponse(
          'TAX_INVALID_QUERY',
          'Specify an integer UTC calendar year between 1970 and 2100.'
        ),
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result = await this.taxService.getDividendRecords(
        userId,
        Number(year)
      );

      return createSuccessResponse(result);
    } catch (error) {
      // Keep the public response generic; record the underlying failure in server logs.
      this.logger.error(
        'Dividend records query failed',
        error instanceof Error ? error.stack : String(error)
      );
      throw new HttpException(
        createErrorResponse(
          'TAX_DIVIDENDS_FAILED',
          'Unable to derive dividend records.'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }

  @Get('lots')
  @RequiresScope(scopes.portfolioRead)
  public async getTaxLots(
    @Impersonation() { userId }: ImpersonationContext
  ): Promise<ApiResponse<TaxLotsResponse>> {
    try {
      const result = await this.taxService.getTaxLots(userId);

      return createSuccessResponse(result);
    } catch (error) {
      throw new HttpException(
        createErrorResponse(
          'TAX_LOTS_FAILED',
          error instanceof Error ? error.message : 'Unable to derive tax lots'
        ),
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
  }
}
