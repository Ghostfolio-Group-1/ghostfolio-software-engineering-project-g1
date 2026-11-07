import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { SubscriptionService } from '@ghostfolio/api/app/subscription/subscription.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { I18nService } from '@ghostfolio/api/services/i18n/i18n.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { TagService } from '@ghostfolio/api/services/tag/tag.service';
import { UserSettings } from '@ghostfolio/common/interfaces';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';

import { UserService } from './user.service';

function userFromDatabase(settings: UserSettings) {
  return {
    _count: { activities: 0 },
    accessToken: null,
    accounts: [],
    analytics: null,
    authChallenge: null,
    createdAt: new Date('2026-01-01'),
    id: 'user-1',
    provider: 'INTERNET_IDENTITY',
    role: 'USER',
    settings: { settings, updatedAt: new Date(), userId: 'user-1' },
    subscriptions: [],
    thirdPartyId: null,
    updatedAt: new Date('2026-01-01')
  };
}

describe('UserService', () => {
  let findUnique: jest.Mock;
  let service: UserService;

  beforeEach(async () => {
    findUnique = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: ActivitiesService, useValue: {} },
        {
          provide: ConfigurationService,
          useValue: { get: jest.fn().mockReturnValue(false) }
        },
        { provide: EventEmitter2, useValue: {} },
        { provide: I18nService, useValue: {} },
        { provide: PrismaService, useValue: { user: { findUnique } } },
        {
          provide: PropertyService,
          useValue: { getByKey: jest.fn().mockResolvedValue(undefined) }
        },
        { provide: SubscriptionService, useValue: {} },
        { provide: TagService, useValue: {} },
        { provide: ThrottlerStorage, useValue: {} }
      ]
    }).compile();

    service = moduleRef.get(UserService);
  });

  // Regression: user() rebuilds
  // userSettings.xRayRules from only the 17 legacy X-Ray rule classes, each
  // of which only knows isActive/thresholdMax/thresholdMin. Without
  // preserving the stored copy first, this silently dropped the Risk
  // module's own rule keys (e.g. CashAllocation has no X-Ray rule class at
  // all) and every rule's redThresholdMax/redThresholdMin on every request
  // - a saved threshold override would appear to work in its own PUT
  // response, then vanish on the very next GET/PUT once user() ran again.
  it('preserves Risk-module-only xRayRules keys and red* fields through the X-Ray rebuild', async () => {
    findUnique.mockResolvedValue(
      userFromDatabase({
        baseCurrency: 'USD',
        xRayRules: {
          // Has no corresponding X-Ray rule class - must pass through
          // untouched, not get dropped by the rebuild.
          CashAllocation: { isActive: true, redThresholdMax: 0.3 },
          // Is a shared key (also a legacy X-Ray rule), so isActive/
          // thresholdMax get recomputed by the rebuild, but redThresholdMax
          // has no equivalent in the legacy rule's getSettings() and must
          // survive from the stored copy.
          CurrencyClusterRiskCurrentInvestment: {
            isActive: true,
            redThresholdMax: 0.6,
            thresholdMax: 0.5
          }
        }
      })
    );

    const user = await service.user({ id: 'user-1' });
    const xRayRules = (user.settings.settings as UserSettings).xRayRules;

    expect(xRayRules.CashAllocation).toEqual({
      isActive: true,
      redThresholdMax: 0.3
    });
    expect(xRayRules.CurrencyClusterRiskCurrentInvestment.redThresholdMax).toBe(
      0.6
    );
    expect(xRayRules.CurrencyClusterRiskCurrentInvestment.thresholdMax).toBe(
      0.5
    );
  });

  it('returns null for a user that does not exist', async () => {
    findUnique.mockResolvedValue(null);

    const user = await service.user({ id: 'does-not-exist' });

    expect(user).toBeNull();
  });
});
