import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';

import { RiskExceptionFilter } from './risk-exception.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status })
    })
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe('RiskExceptionFilter', () => {
  let filter: RiskExceptionFilter;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    filter = new RiskExceptionFilter();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes an HttpException through unchanged and logs nothing', () => {
    const { host, json, status } = createHost();
    const exception = new HttpException(
      {
        data: null,
        error: { code: 'RISK_INVALID_QUERY', message: 'bad' },
        meta: {}
      },
      HttpStatus.BAD_REQUEST
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      data: null,
      error: { code: 'RISK_INVALID_QUERY', message: 'bad' },
      meta: {}
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it('passes a guard-thrown 403 through unchanged', () => {
    const { host, json, status } = createHost();

    filter.catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(new ForbiddenException().getResponse());
    expect(logError).not.toHaveBeenCalled();
  });

  it('wraps an unexpected error in the RISK_CALC_FAILED envelope and logs it', () => {
    const { host, json, status } = createHost();
    const exception = new Error('Unique constraint failed on the fields');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      data: null,
      error: {
        code: 'RISK_CALC_FAILED',
        message:
          'Something went wrong while calculating your risk data. Please try again later.'
      },
      meta: {}
    });
    expect(logError).toHaveBeenCalledWith(
      'Unexpected error in the risk module',
      exception.stack
    );
  });

  it('wraps a non-Error throw (e.g. a rejected string) too', () => {
    const { host, json, status } = createHost();

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: { code: 'RISK_CALC_FAILED', message: expect.any(String) }
      })
    );
    expect(logError).toHaveBeenCalledWith(
      'Unexpected error in the risk module',
      'boom'
    );
  });
});
