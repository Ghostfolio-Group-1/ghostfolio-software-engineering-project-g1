import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { permissions } from '@ghostfolio/common/permissions';
import type { ImpersonationContext } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import Ajv from 'ajv';

import {
  riskThresholdItemResponseSchema,
  riskThresholdsListResponseSchema
} from './contracts/risk-thresholds.schema';
import { riskWarningsResponseSchema } from './contracts/risk-warnings.schema';
import { targetAllocationResponseSchema } from './contracts/target-allocation.schema';
import { ExposureCalculatorService } from './exposure-calculator.service';
import { ExposureService } from './exposure.service';
import { HealthScoreCalculatorService } from './health-score-calculator.service';
import { RiskEvaluationService } from './risk-evaluation.service';
import { RiskController } from './risk.controller';
import { ThresholdEngineService } from './threshold-engine.service';
import { VolatilityCacheService } from './volatility-cache.service';
import { WhatIfService } from './what-if.service';

const ajv = new Ajv({ allErrors: true });

async function createController({
  getCashDetails = jest.fn().mockResolvedValue({ balanceInBaseCurrency: 0 }),
  getHoldings = jest.fn().mockResolvedValue([]),
  updateUserSetting = jest.fn().mockResolvedValue({}),
  userPermissions = [permissions.updateUserSettings]
}: {
  getCashDetails?: jest.Mock;
  getHoldings?: jest.Mock;
  updateUserSetting?: jest.Mock;
  userPermissions?: string[];
} = {}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [RiskController],
    providers: [
      ExposureCalculatorService,
      ExposureService,
      HealthScoreCalculatorService,
      RiskEvaluationService,
      ThresholdEngineService,
      {
        provide: AccountService,
        useValue: { getCashDetails }
      },
      {
        provide: ConfigurationService,
        useValue: { get: jest.fn().mockReturnValue(false) }
      },
      {
        provide: ExchangeRateDataService,
        useValue: { toCurrency: (value: number) => value }
      },
      { provide: ImpersonationService, useValue: {} },
      { provide: PortfolioService, useValue: { getHoldings } },
      {
        provide: REQUEST,
        useValue: {
          user: {
            permissions: userPermissions,
            settings: { settings: { isRestrictedView: false } },
            subscription: { type: 'Premium' }
          }
        }
      },
      { provide: UserService, useValue: { updateUserSetting } },
      {
        provide: VolatilityCacheService,
        useValue: {
          getPortfolioVolatility: jest
            .fn()
            .mockResolvedValue({ annualizedVolatility: null, historyDays: 0 })
        }
      },
      { provide: WhatIfService, useValue: { calculateWhatIf: jest.fn() } }
    ]
  }).compile();

  return moduleRef.get(RiskController);
}

function context(
  overrides: Partial<ImpersonationContext> = {}
): ImpersonationContext {
  return {
    isActive: false,
    userId: 'user-1',
    userSettings: { baseCurrency: 'USD' },
    scopes: [],
    ...overrides
  } as unknown as ImpersonationContext;
}

describe('GET /risk/warnings', () => {
  it('is routed at /risk/warnings', () => {
    expect(
      Reflect.getMetadata('path', RiskController.prototype.getWarnings)
    ).toBe('warnings');
  });

  it('matches the contract schema and defaults to page 1 / pageSize 25', async () => {
    const controller = await createController();
    const validate = ajv.compile(riskWarningsResponseSchema);

    const response = await controller.getWarnings(context());

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
    // An empty portfolio (0 holdings, 0 cash) has no portfolio value to
    // divide by, so every rule that depends on holdings/cash data - not
    // just CashAllocation - reports NO_DATA rather than a free pass or a
    // fake breach (risk-evaluation.service.spec.ts's "reports every rule
    // as NO_DATA for a fully empty portfolio" covers this directly). No
    // warnings means total: 0, not a breach.
    expect(response.meta).toEqual({ page: 1, pageSize: 25, total: 0 });
  });

  it('rejects an invalid severity with RISK_INVALID_QUERY', async () => {
    const controller = await createController();

    const exception = await controller.getWarnings(context(), 'ORANGE').then(
      () => {
        throw new Error('expected rejection');
      },
      (error: HttpException) => error
    );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_INVALID_QUERY' }
    });
  });

  it('filters by severity and paginates', async () => {
    // CashAllocation is a band rule (min 0.02, max 0.15); a 0 balance with a
    // 0 portfolio value computes actual = 0, which is below redThresholdMin
    // (0.005) -> RED.
    const controller = await createController();

    const response = await controller.getWarnings(context(), 'RED');

    expect(response.data.every((warning) => warning.severity === 'RED')).toBe(
      true
    );
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', 'abc'],
    ['pageSize', '0'],
    ['pageSize', '101'] // MAX_WARNINGS_PAGE_SIZE is 100
  ])(
    'rejects an invalid %s value (%s) with RISK_INVALID_QUERY',
    async (field, value) => {
      const controller = await createController();
      const args: [string | undefined, string | undefined] =
        field === 'page' ? [value, undefined] : [undefined, value];

      const exception = await controller
        .getWarnings(context(), undefined, ...args)
        .then(
          () => {
            throw new Error('expected rejection');
          },
          (error: HttpException) => error
        );

      expect(exception.getStatus()).toBe(400);
      expect(exception.getResponse()).toMatchObject({
        error: { code: 'RISK_INVALID_QUERY' }
      });
    }
  );
});

describe('GET/PUT/DELETE /risk/target-allocation', () => {
  it('returns isSet: false when no target is configured', async () => {
    const controller = await createController();
    const validate = ajv.compile(targetAllocationResponseSchema);

    const response = await controller.getTargetAllocation(context());

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
    expect(response.data).toEqual({
      buckets: [],
      groupBy: null,
      isSet: false,
      targets: [],
      thresholds: null
    });
  });

  it('rejects a PUT with duplicate keys', async () => {
    const controller = await createController();

    const exception = await controller
      .putTargetAllocation(context(), {
        groupBy: 'assetClass',
        targets: [
          { key: 'EQUITY', percentage: 0.5 },
          { key: 'EQUITY', percentage: 0.5 }
        ]
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_TARGET_DUPLICATE_KEY' }
    });
  });

  it('rejects a PUT whose percentages do not sum to 1', async () => {
    const controller = await createController();

    const exception = await controller
      .putTargetAllocation(context(), {
        groupBy: 'assetClass',
        targets: [{ key: 'EQUITY', percentage: 0.5 }]
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_TARGET_INVALID_SUM' }
    });
  });

  it('rejects a PUT with an invalid key for groupBy assetClass', async () => {
    const controller = await createController();

    const exception = await controller
      .putTargetAllocation(context(), {
        groupBy: 'assetClass',
        targets: [{ key: 'NOT_A_REAL_CLASS', percentage: 1 }]
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_TARGET_INVALID_KEY' }
    });
  });

  it('saves a valid target and returns the computed buckets', async () => {
    const updateUserSetting = jest.fn().mockResolvedValue({});
    const controller = await createController({ updateUserSetting });

    const response = await controller.putTargetAllocation(context(), {
      groupBy: 'assetClass',
      targets: [{ key: 'CASH', percentage: 1 }]
    });

    expect(updateUserSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        userSettings: expect.objectContaining({
          targetAllocation: {
            groupBy: 'assetClass',
            isActive: true,
            targets: [{ key: 'CASH', percentage: 1 }]
          }
        })
      })
    );
    expect(response.data.isSet).toBe(true);
    expect(response.data.groupBy).toBe('assetClass');
  });

  it('rejects writes while impersonating another user', async () => {
    const controller = await createController();

    const exception = await controller
      .putTargetAllocation(context({ isActive: true }), {
        groupBy: 'assetClass',
        targets: [{ key: 'CASH', percentage: 1 }]
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
  });

  it('rejects a PUT from a user without updateUserSettings permission', async () => {
    const controller = await createController({ userPermissions: [] });

    const exception = await controller
      .putTargetAllocation(context(), {
        groupBy: 'assetClass',
        targets: [{ key: 'CASH', percentage: 1 }]
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_FORBIDDEN' }
    });
  });

  it('rejects a DELETE from a user without updateUserSettings permission', async () => {
    const controller = await createController({ userPermissions: [] });

    const exception = await controller.deleteTargetAllocation(context()).then(
      () => {
        throw new Error('expected rejection');
      },
      (error: HttpException) => error
    );

    expect(exception.getStatus()).toBe(403);
  });

  it('rejects DELETE while impersonating another user', async () => {
    const controller = await createController();

    const exception = await controller
      .deleteTargetAllocation(context({ isActive: true }))
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
  });

  // The CASH key represents uninvested cash (docs/sesha-notes/10-risk-api-
  // contract.md Section 11), not a holding - its actual % must come from
  // the account's real cash balance, not default to 0 regardless of it.
  it('computes the CASH bucket from the real cash balance', async () => {
    const controller = await createController({
      getCashDetails: jest
        .fn()
        .mockResolvedValue({ balanceInBaseCurrency: 500 }),
      getHoldings: jest.fn().mockResolvedValue([
        {
          assetProfile: { assetClass: 'EQUITY', currency: 'USD' },
          quantity: 5,
          marketPrice: 100
        }
      ])
    });

    const response = await controller.getTargetAllocation(
      context({
        userSettings: {
          baseCurrency: 'USD',
          targetAllocation: {
            groupBy: 'assetClass',
            isActive: true,
            targets: [
              { key: 'EQUITY', percentage: 0.5 },
              { key: 'CASH', percentage: 0.5 }
            ]
          }
        }
      })
    );

    // 500 holdings + 500 cash = 1000 total, so each bucket is exactly 50%.
    const cashBucket = response.data.buckets.find(
      (bucket) => bucket.key === 'CASH'
    );
    expect(cashBucket?.actual).toBeCloseTo(0.5, 10);
    expect(cashBucket?.deviation).toBeCloseTo(0, 10);
  });

  it('deletes the target and persists the cleared setting', async () => {
    const updateUserSetting = jest.fn().mockResolvedValue({});
    const controller = await createController({ updateUserSetting });

    const response = await controller.deleteTargetAllocation(
      context({
        userSettings: {
          baseCurrency: 'USD',
          targetAllocation: {
            groupBy: 'assetClass',
            isActive: true,
            targets: [{ key: 'CASH', percentage: 1 }]
          }
        }
      })
    );

    expect(updateUserSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        userSettings: { baseCurrency: 'USD' }
      })
    );
    expect(response.data).toEqual({
      buckets: [],
      groupBy: null,
      isSet: false,
      targets: [],
      thresholds: null
    });
  });
});

describe('GET/PUT/DELETE /risk/thresholds', () => {
  it('lists all 7 risk rules with their defaults', async () => {
    const controller = await createController();
    const validate = ajv.compile(riskThresholdsListResponseSchema);

    const response = controller.getThresholds(context());

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
    expect(response.data).toHaveLength(7);
    expect(response.data.every((item) => item.isCustomized === false)).toBe(
      true
    );
  });

  it('reflects a customized override from userSettings.xRayRules', async () => {
    const controller = await createController();

    const response = controller.getThresholds(
      context({
        userSettings: {
          baseCurrency: 'USD',
          xRayRules: {
            SingleStockConcentration: { isActive: true, thresholdMax: 0.15 }
          }
        }
      })
    );

    const item = response.data.find(
      (entry) => entry.ruleKey === 'SingleStockConcentration'
    );

    expect(item?.isCustomized).toBe(true);
    expect(item?.thresholds.max).toBe(0.15);
    expect(item?.thresholds.redMax).toBe(0.25); // falls back to default
  });

  it('rejects PUT for an unknown rule key with RISK_RULE_NOT_FOUND', async () => {
    const controller = await createController();

    const exception = await controller
      .putThreshold(context(), 'NotARule', { isActive: true })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_RULE_NOT_FOUND' }
    });
  });

  it('rejects an out-of-order ceiling override', async () => {
    const controller = await createController();

    const exception = await controller
      .putThreshold(context(), 'SingleStockConcentration', {
        thresholds: { max: 0.3, redMax: 0.2 }
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_THRESHOLD_INVALID_ORDER' }
    });
  });

  it('rejects a PUT from a user without updateUserSettings permission', async () => {
    const controller = await createController({ userPermissions: [] });

    const exception = await controller
      .putThreshold(context(), 'SingleStockConcentration', {
        isActive: false
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_FORBIDDEN' }
    });
  });

  it('rejects a DELETE from a user without updateUserSettings permission', async () => {
    const controller = await createController({ userPermissions: [] });

    const exception = await controller
      .deleteThreshold(context(), 'SingleStockConcentration')
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
  });

  it('rejects PUT while impersonating another user', async () => {
    const controller = await createController();

    const exception = await controller
      .putThreshold(context({ isActive: true }), 'SingleStockConcentration', {
        isActive: true
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
  });

  it('rejects DELETE while impersonating another user', async () => {
    const controller = await createController();

    const exception = await controller
      .deleteThreshold(context({ isActive: true }), 'SingleStockConcentration')
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(403);
  });

  // Regression: an update must be validated against the rule's *current*
  // override, not its defaults - otherwise a partial update that only
  // changes one field can silently produce an invalid merged result.
  // Existing override: max 0.20 / redMax 0.40. An update that only lowers
  // redMax to 0.15 would merge to max 0.20 / redMax 0.15 (invalid: max must
  // be less than redMax) even though 0.15 alone is a valid redMax in
  // isolation against the *default* max of 0.1.
  it('rejects a partial update that is only invalid once merged with the current override', async () => {
    const controller = await createController();

    const exception = await controller
      .putThreshold(
        context({
          userSettings: {
            baseCurrency: 'USD',
            xRayRules: {
              SingleStockConcentration: {
                isActive: true,
                thresholdMax: 0.2,
                redThresholdMax: 0.4
              }
            }
          }
        }),
        'SingleStockConcentration',
        { thresholds: { redMax: 0.15 } }
      )
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_THRESHOLD_INVALID_ORDER' }
    });
  });

  // Regression (#233): with no previous
  // override at all, an update that only raises thresholdMax to 0.9 must
  // still be checked against the rule's *default* redThresholdMax (0.25),
  // not an `undefined` one a blind `{ ...defaults, ...overrides }` spread
  // would otherwise produce (which compares as false and lets anything
  // through).
  it('rejects a partial update that is invalid against the default when no override exists yet', async () => {
    const controller = await createController();

    const exception = await controller
      .putThreshold(context(), 'SingleStockConcentration', {
        thresholds: { max: 0.9 }
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_THRESHOLD_INVALID_ORDER' }
    });
  });

  it('rejects an out-of-order band override', async () => {
    const controller = await createController();

    // PortfolioVolatility is a band rule (defaults: redMin 0.05, min 0.1,
    // max 0.25, redMax 0.35) - redMin must be < min, which this override
    // breaks (redMin 0.2 > min 0.1).
    const exception = await controller
      .putThreshold(context(), 'PortfolioVolatility', {
        thresholds: { min: 0.1, redMin: 0.2 }
      })
      .then(
        () => {
          throw new Error('expected rejection');
        },
        (error: HttpException) => error
      );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      error: { code: 'RISK_THRESHOLD_INVALID_ORDER' }
    });
  });

  it('saves a valid override and returns the updated item', async () => {
    const updateUserSetting = jest.fn().mockResolvedValue({});
    const controller = await createController({ updateUserSetting });
    const validate = ajv.compile(riskThresholdItemResponseSchema);

    const response = await controller.putThreshold(
      context(),
      'SingleStockConcentration',
      { thresholds: { max: 0.15, redMax: 0.3 } }
    );

    validate(response);

    expect(validate.errors ?? []).toEqual([]);
    expect(response.data.isCustomized).toBe(true);
    expect(response.data.thresholds).toEqual({ max: 0.15, redMax: 0.3 });
    expect(updateUserSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        userSettings: expect.objectContaining({
          xRayRules: expect.objectContaining({
            SingleStockConcentration: expect.objectContaining({
              thresholdMax: 0.15,
              redThresholdMax: 0.3
            })
          })
        })
      })
    );
  });

  it('resets a rule to its defaults on DELETE', async () => {
    const updateUserSetting = jest.fn().mockResolvedValue({});
    const controller = await createController({ updateUserSetting });

    const response = await controller.deleteThreshold(
      context({
        userSettings: {
          baseCurrency: 'USD',
          xRayRules: {
            SingleStockConcentration: { isActive: true, thresholdMax: 0.15 }
          }
        }
      }),
      'SingleStockConcentration'
    );

    expect(response.data.isCustomized).toBe(false);
    expect(response.data.thresholds).toEqual({ max: 0.1, redMax: 0.25 });
    expect(updateUserSetting).toHaveBeenCalled();
  });
});
