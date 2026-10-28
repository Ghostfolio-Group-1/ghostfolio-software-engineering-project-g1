import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException, Logger } from '@nestjs/common';
import Ajv from 'ajv';

import { dashboardErrorResponseSchema } from './contracts/dashboard-overview.schema';
import { DashboardOverview } from './dashboard-overview';
import { DashboardController } from './dashboard.controller';

describe('DashboardController (unit, mocked DashboardOverview)', () => {
  const ajv = new Ajv({ allErrors: true });
  const validateError = ajv.compile(dashboardErrorResponseSchema);
  const context = {
    userId: 'user-1',
    userSettings: { baseCurrency: 'EUR' }
  } as unknown as ImpersonationContext;
  const overview = {
    charts: { data: { kind: 'portfolioValue' }, status: 'available' },
    risk: {
      error: {
        code: 'DASHBOARD_RISK_UNAVAILABLE',
        message: 'The risk section could not be loaded'
      },
      status: 'unavailable'
    },
    tax: { data: { method: 'FIFO', sales: [] }, status: 'available' }
  };

  let controller: DashboardController;
  let getOverview: jest.Mock;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();

    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    getOverview = jest.fn().mockResolvedValue(overview);
    controller = new DashboardController({
      getOverview
    } as unknown as DashboardOverview);
  });

  const expectFailure = async () => {
    const exception = await controller.getOverview(context).then(
      () => {
        throw new Error('Expected the request to be rejected');
      },
      (error: HttpException) => error
    );

    expect(exception).toBeInstanceOf(HttpException);
    expect(exception.getStatus()).toBe(500);
    expect(validateError(exception.getResponse())).toBe(true);
    expect(exception.getResponse()).toMatchObject({
      error: {
        code: 'DASHBOARD_OVERVIEW_FAILED',
        message: 'Unable to load the dashboard overview'
      }
    });
  };

  it('is routed at /dashboard/overview', () => {
    expect(Reflect.getMetadata('path', DashboardController)).toBe('dashboard');
    expect(
      Reflect.getMetadata('path', DashboardController.prototype.getOverview)
    ).toBe('overview');
  });

  it('loads the overview for the token user in their base currency', async () => {
    await controller.getOverview(context);

    expect(getOverview).toHaveBeenCalledWith({
      baseCurrency: 'EUR',
      userId: 'user-1'
    });
  });

  it('returns the sections unchanged in the success envelope', async () => {
    const response = await controller.getOverview(context);

    expect(response).toMatchObject({ data: overview, error: null });
  });

  it('turns an Error into a 500 DASHBOARD_OVERVIEW_FAILED envelope and logs it', async () => {
    getOverview.mockRejectedValue(new Error('internal detail'));

    await expectFailure();

    expect(loggerError).toHaveBeenCalledWith(
      'Dashboard overview failed',
      expect.stringContaining('internal detail')
    );
  });

  it('turns a non-Error rejection into the same envelope', async () => {
    getOverview.mockRejectedValue('plain string failure');

    await expectFailure();

    expect(loggerError).toHaveBeenCalledWith(
      'Dashboard overview failed',
      'plain string failure'
    );
  });
});
