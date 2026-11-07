import { createErrorResponse } from '@ghostfolio/common/api-conventions';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Response } from 'express';

// Scoped to RiskController via @UseFilters (Nov 12, part of #24). Catches
// anything the controller itself didn't already turn into a
// createErrorResponse()-shaped HttpException - a thrown Prisma error, a
// bug in a calculator, a timeout - so a client always gets back the
// { data, error, meta } envelope the contract promises (Section 9: "no
// side effects on reads" also implies reads never 500 with a bare stack
// trace). The 500 message is deliberately generic; the real error goes to
// the server log only.
//
// An HttpException the controller (or an upstream guard, e.g. 401/403)
// already built is passed through untouched - this filter never
// re-wraps an error that is already a deliberate, correctly-shaped
// response.
@Catch()
export class RiskExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RiskExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());

      return;
    }

    this.logger.error(
      'Unexpected error in the risk module',
      exception instanceof Error ? exception.stack : exception
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        createErrorResponse(
          'RISK_CALC_FAILED',
          'Something went wrong while calculating your risk data. Please try again later.'
        )
      );
  }
}
