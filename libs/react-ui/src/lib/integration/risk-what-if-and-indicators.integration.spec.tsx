/** @jest-environment jsdom */
import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { ExposureCalculatorService } from '@ghostfolio/api/app/risk/exposure-calculator.service';
import { ExposureService } from '@ghostfolio/api/app/risk/exposure.service';
import { HealthScoreCalculatorService } from '@ghostfolio/api/app/risk/health-score-calculator.service';
import { RiskEvaluationService } from '@ghostfolio/api/app/risk/risk-evaluation.service';
import { RiskController } from '@ghostfolio/api/app/risk/risk.controller';
import { ThresholdEngineService } from '@ghostfolio/api/app/risk/threshold-engine.service';
import { VolatilityCacheService } from '@ghostfolio/api/app/risk/volatility-cache.service';
import { WhatIfService } from '@ghostfolio/api/app/risk/what-if.service';
import { UserService } from '@ghostfolio/api/app/user/user.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { createE2eApp, withE2eUser } from '@ghostfolio/api/testing/e2e/e2e-app';
import {
  FIXTURE_BASE_CURRENCY,
  FIXTURE_USER_ID,
  holdingsFixture
} from '@ghostfolio/api/testing/fixtures/portfolio.fixtures';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import request from 'supertest';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskWarningsPage } from '../risk-warnings/risk-warnings-page';
import { WhatIfSimulatorPage } from '../what-if-simulator/what-if-simulator-page';
import {
  createWhatIfPostJson,
  runWhatIf
} from '../what-if-simulator/what-if-simulator.client';
import { FakeHoldingsController } from './fake-holdings.controller';

// jsdom's test environment doesn't provide TextEncoder/TextDecoder, which
// supertest's own dependency chain (superagent -> formidable -> cuid2 ->
// @noble/hashes) reads at module-import time - Node's own implementation is
// a correct stand-in, nothing here needs jsdom's browser-fidelity choice to
// omit it. The repo's import-sort Prettier plugin unconditionally hoists
// every import to the top of the file on format, so there is no source
// position for a plain polyfill statement that survives formatting; a
// jest.mock() factory is the only hook Jest itself (not Prettier) is
// guaranteed to run synchronously before the module it names loads - so
// this intercepts supertest's own require(), sets the globals, then hands
// back the real module.
jest.mock('supertest', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeUtil: typeof import('node:util') = require('node:util');

  (globalThis as unknown as { TextDecoder: unknown }).TextDecoder ??=
    nodeUtil.TextDecoder;
  (globalThis as unknown as { TextEncoder: unknown }).TextEncoder ??=
    nodeUtil.TextEncoder;

  return jest.requireActual('supertest');
});

// AccountService and UserService are only imported here for their class
// reference, to use as the exact DI token RiskController's own constructor
// metadata points to (the same classes it already imports) - every real
// method on them is overridden with a mock below. But both modules
// transitively import PrismaService (-> the real `pg` driver, which reads
// TextEncoder at module-import time) and I18nService (-> cheerio, whose own
// undici dependency expects a full browser fetch global surface) - neither
// of which jsdom's test environment provides, and this test needs none of
// it. Mocking these two project-owned leaf modules stops both chains before
// they reach those packages at all. Jest hoists jest.mock() calls above
// every import regardless of where they sit in the file, so this runs
// before the real chain loads - unlike a plain polyfill statement, which
// the repo's import-sort Prettier plugin is free to reorder below the
// imports it would need to run ahead of.
jest.mock('@ghostfolio/api/services/prisma/prisma.service', () => ({
  PrismaService: class {}
}));
jest.mock('@ghostfolio/api/services/i18n/i18n.service', () => ({
  I18nService: class {}
}));

// Turns the in-process Nest app (no real listening socket) into something
// that satisfies AuthenticatedFetch (= typeof fetch), by routing every call
// through supertest against app.getHttpServer() instead of a real socket.
// This lets the already-tested React page components (requestApi,
// useApiData, WhatIfSimulatorPage, RiskWarningsPage) run completely
// unmodified against the real RiskController -> real services -> the only
// data-access mocks (PortfolioService/AccountService/VolatilityCacheService)
// - the same boundary risk.e2e.spec.ts mocks at, just driven from the UI
// instead of supertest assertions directly on the HTTP response.
function createUiToApiFetch(app: INestApplication): AuthenticatedFetch {
  return (async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toLowerCase() as
      'delete' | 'get' | 'post' | 'put';

    let req = request(app.getHttpServer())[method](url);

    if (init?.body) {
      req = req
        .set('Content-Type', 'application/json')
        .send(JSON.parse(init.body as string));
    }

    const response = await req;

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body
    } as unknown as Response;
  }) as AuthenticatedFetch;
}

// Fixture holdings in USD (apps/api/src/testing/fixtures/portfolio.fixtures.ts):
// AAPL 3 x 180 = 540, MSFT 5 x 320 = 1600, SAP 4 x 130 EUR x 1.1 = 572.
// Total 2712 - same conversion risk.e2e.spec.ts uses, so these numbers line
// up with that file's already-verified worked examples.
const EUR_TO_USD = 1.1;
const exchangeRateDataServiceMock = {
  toCurrency: (value: number, from: string, to: string) =>
    from === 'EUR' && to === 'USD' ? value * EUR_TO_USD : value
};

describe('Risk UI <-> API <-> service <-> data integration (Wed Nov 18)', () => {
  let app: INestApplication;
  let uiFetch: AuthenticatedFetch;
  let container: HTMLDivElement;
  let root: Root;

  async function render(node: Parameters<Root['render']>[0]) {
    await act(async () => {
      root.render(node);
    });
  }

  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  describe('indicators: RiskWarningsPage against the real score/warnings pipeline', () => {
    beforeAll(async () => {
      app = await createE2eApp(
        withE2eUser(
          Test.createTestingModule({
            controllers: [RiskController, FakeHoldingsController],
            providers: [
              ExposureCalculatorService,
              ExposureService,
              {
                provide: ExchangeRateDataService,
                useValue: exchangeRateDataServiceMock
              },
              {
                provide: AccountService,
                useValue: {
                  getCashDetails: jest
                    .fn()
                    .mockResolvedValue({ balanceInBaseCurrency: 0 })
                }
              },
              {
                provide: ConfigurationService,
                useValue: { get: jest.fn().mockReturnValue(false) }
              },
              {
                provide: PortfolioService,
                useValue: {
                  getHoldings: jest.fn().mockResolvedValue(holdingsFixture)
                }
              },
              {
                provide: VolatilityCacheService,
                useValue: {
                  getPortfolioVolatility: jest.fn().mockResolvedValue({
                    annualizedVolatility: null,
                    historyDays: 0
                  })
                }
              },
              HealthScoreCalculatorService,
              RiskEvaluationService,
              ThresholdEngineService,
              {
                provide: UserService,
                useValue: { updateUserSetting: jest.fn() }
              },
              WhatIfService
            ]
          }),
          { baseCurrency: FIXTURE_BASE_CURRENCY, userId: FIXTURE_USER_ID }
        )
      );

      uiFetch = createUiToApiFetch(app);
    });

    afterAll(async () => {
      await app.close();
    });

    it('renders a real RED severity indicator for MSFT, computed by the real backend from the fixture portfolio', async () => {
      await render(<RiskWarningsPage request={uiFetch} />);
      // supertest's request() against app.getHttpServer() is a real (if
      // in-process) HTTP round trip - it needs real event-loop ticks to
      // settle, not just queued microtasks.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // MSFT is 1600 of the 2712 fixture total = 59.0%, against the default
      // SingleStockConcentration ceiling (warn 10%, red 25%) - computed by
      // the real ThresholdEngineService/RiskEvaluationService, not stubbed.
      // Scoped to MSFT's own row specifically (not "some red exists
      // somewhere on the page") - the fixture also breaches CashAllocation
      // RED independently, which would mask a broken MSFT severity if the
      // assertion weren't scoped to its row.
      const msftRow = Array.from(container.querySelectorAll('li')).find((li) =>
        li.textContent?.includes('Stock: MSFT')
      );

      expect(msftRow?.textContent).toContain('59.0%');
      expect(msftRow?.querySelector('[aria-label="Red"]')).not.toBeNull();
    });
  });

  describe('what-if flow: WhatIfSimulatorPage against the real what-if pipeline', () => {
    const getCashDetails = jest
      .fn()
      .mockResolvedValue({ balanceInBaseCurrency: 1000 });
    const getHoldings = jest.fn().mockResolvedValue(holdingsFixture);

    beforeAll(async () => {
      app = await createE2eApp(
        withE2eUser(
          Test.createTestingModule({
            controllers: [RiskController, FakeHoldingsController],
            providers: [
              ExposureCalculatorService,
              ExposureService,
              {
                provide: ExchangeRateDataService,
                useValue: exchangeRateDataServiceMock
              },
              { provide: AccountService, useValue: { getCashDetails } },
              {
                provide: ConfigurationService,
                useValue: { get: jest.fn().mockReturnValue(false) }
              },
              { provide: PortfolioService, useValue: { getHoldings } },
              {
                provide: VolatilityCacheService,
                useValue: {
                  getPortfolioVolatility: jest.fn().mockResolvedValue({
                    annualizedVolatility: null,
                    historyDays: 0
                  })
                }
              },
              HealthScoreCalculatorService,
              RiskEvaluationService,
              ThresholdEngineService,
              {
                provide: UserService,
                useValue: { updateUserSetting: jest.fn() }
              },
              WhatIfService
            ]
          }),
          { baseCurrency: FIXTURE_BASE_CURRENCY, userId: FIXTURE_USER_ID }
        )
      );

      uiFetch = createUiToApiFetch(app);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      getHoldings.mockClear();
      getCashDetails.mockClear();
    });

    // supertest's request() against app.getHttpServer() is a real (if
    // in-process) HTTP round trip - it needs real event-loop ticks to
    // settle, not just queued microtasks.
    function flush() {
      return act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    it('loads real holdings, shocks AAPL by 40% through the real pipeline, and renders the real before/after numbers', async () => {
      await render(<WhatIfSimulatorPage request={uiFetch} />);
      await flush();

      const select = container.querySelector('select') as HTMLSelectElement;
      const nativeSelectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;
      const dropInput = container.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;
      const nativeInputSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;

      await act(async () => {
        nativeSelectSetter?.call(select, 'YAHOO:AAPL');
        select.dispatchEvent(new Event('change', { bubbles: true }));
        nativeInputSetter?.call(dropInput, '40');
        dropInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const submit = Array.from(container.querySelectorAll('button')).find(
        (button) => /simulate|run/i.test(button.textContent ?? '')
      );

      await act(async () => {
        submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flush();

      // Same fixture math as risk.e2e.spec.ts: holdings total 2712, cash
      // 1000 -> portfolio 3712 before, 3496 after (AAPL 540 x 0.4 = 216
      // drop) - computed end to end by the real WhatIfService through a
      // real HTTP round trip, read back out of the rendered DOM, not
      // asserted on the HTTP response body.
      expect(getHoldings).toHaveBeenCalled();
      expect(container.textContent).toContain('3,712 USD');
      expect(container.textContent).toContain('3,496 USD');
    });

    // Client-side validation (what-if-form.model.ts) mirrors the server's
    // (0, 1] range exactly, so there's no drop value a user can actually
    // type into the form that passes local validation but still reaches
    // RISK_WHATIF_INVALID_DROP server-side - that envelope path is only
    // reachable by calling the real HTTP round trip directly, the same way
    // a malformed or hand-crafted request would. Still the real client
    // code (createWhatIfPostJson/runWhatIf, not mocked), the real
    // RiskController + ValidationPipe, and the real error envelope - only
    // the DOM interaction step is skipped.
    it('maps a real RISK_WHATIF_HOLDING_NOT_FOUND envelope onto the server message, through the real client code and HTTP round trip', async () => {
      await expect(
        runWhatIf(createWhatIfPostJson(uiFetch), {
          dataSource: 'YAHOO',
          dropPercentage: 0.4,
          symbol: 'TSLA'
        })
      ).rejects.toThrow(/TSLA/);
    });

    it('turns an unexpected backend failure into the generic what-if error, never raw server text, through the real RiskExceptionFilter', async () => {
      getHoldings.mockRejectedValueOnce(
        new Error('Unexpected failure reading holdings')
      );

      await render(<WhatIfSimulatorPage request={uiFetch} />);
      await flush();

      const select = container.querySelector('select') as HTMLSelectElement;
      const nativeSelectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      )?.set;

      const dropInput = container.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;
      const nativeInputSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;

      await act(async () => {
        nativeSelectSetter?.call(select, 'YAHOO:AAPL');
        select.dispatchEvent(new Event('change', { bubbles: true }));
        nativeInputSetter?.call(dropInput, '40');
        dropInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const submit = Array.from(container.querySelectorAll('button')).find(
        (button) => /simulate|run/i.test(button.textContent ?? '')
      );

      await act(async () => {
        submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flush();

      expect(container.textContent).toContain(
        'Could not run the simulation. Please try again.'
      );
      expect(container.textContent).not.toContain('Unexpected failure');
    });
  });
});
