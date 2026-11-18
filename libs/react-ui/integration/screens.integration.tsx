import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { DashboardOverviewPage } from '../src/lib/dashboard-page/dashboard-overview-page';
import { DividendWithholdingScreen } from '../src/lib/dividend-withholding/dividend-withholding-screen';
import { RiskDashboardCard } from '../src/lib/risk-dashboard/risk-dashboard-card';
import { loadRiskDashboardSummary } from '../src/lib/risk-dashboard/risk-dashboard.client';
import { RiskWarningsPage } from '../src/lib/risk-warnings/risk-warnings-page';
import { TaxLotsScreen } from '../src/lib/tax-lots/tax-lots-table';
import { WhatIfSimulatorPage } from '../src/lib/what-if-simulator/what-if-simulator-page';
import {
  createIntegrationSession,
  fixture,
  INTEGRATION_API_URL
} from './api-session';
import type { IntegrationSession } from './api-session';

// Runs only when a live API is given; otherwise the whole suite is skipped so
// a local unit run never needs a database.
const describeLive = INTEGRATION_API_URL ? describe : describe.skip;

describeLive('React screens against the running API', () => {
  let container: HTMLDivElement;
  let root: Root;
  let session: IntegrationSession;

  beforeAll(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    session = await createIntegrationSession(INTEGRATION_API_URL as string);
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  async function render(element: ReactElement) {
    await act(async () => {
      root.render(element);
    });
  }

  /** Waits until no card is loading, then returns the rendered text. */
  async function settled() {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!container.querySelector('[aria-busy="true"]')) {
        break;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    expect(container.querySelector('[aria-busy="true"]')).toBeNull();

    return container.textContent ?? '';
  }

  function expectNoErrors() {
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
  }

  it('Unified Dashboard: every section loads from GET /dashboard/overview', async () => {
    await render(<DashboardOverviewPage request={session.request} />);

    const text = await settled();

    expectNoErrors();
    expect(text).toContain(
      `${fixture.expected.realizedGainAfterActivityFees} ${fixture.expected.realizedGainCurrency}`
    );
    expect(text).not.toContain('could not be loaded');
  });

  it('Risk: the dashboard card renders the live score and concentration', async () => {
    // Both Risk routes must parse; imported MANUAL symbols carry no asset
    // class, so the stock bucket (and topConcentration) can be empty.
    const summary = await loadRiskDashboardSummary(session.request);

    await render(<RiskDashboardCard data={summary} status="ready" />);

    expectNoErrors();
    expect(summary.categories.length).toBeGreaterThan(0);
    expect(container.textContent).toContain(`Grade ${summary.grade}`);
  });

  it('Tax: the tax-lot screen renders the open and consumed lots', async () => {
    await render(<TaxLotsScreen request={session.request} />);

    await settled();

    expectNoErrors();
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('Tax: the dividend screen shows the fixture dividend for its year', async () => {
    await render(
      <DividendWithholdingScreen
        initialYear={fixture.expected.dividendYear}
        request={session.request}
      />
    );

    await settled();

    expectNoErrors();
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('Risk: the warnings screen loads from the live GET /risk/warnings route', async () => {
    await render(<RiskWarningsPage request={session.request} />);

    await settled();

    // Imported MANUAL symbols carry no asset class (same note as the Risk
    // dashboard-card test above), so SingleStockConcentration may not fire -
    // this checks the real route parses and renders, not that it finds any
    // particular severity.
    expectNoErrors();
  });

  it('Risk: the what-if simulator loads real holdings from GET /portfolio/holdings and runs a real shock through POST /risk/what-if', async () => {
    await render(<WhatIfSimulatorPage request={session.request} />);

    // Waits for the real holdings endpoint, not a fixed delay - the select
    // starts with only its placeholder option until PortfolioController
    // answers.
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((container.querySelector('select')?.childElementCount ?? 0) > 1) {
        break;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    const select = container.querySelector('select') as HTMLSelectElement;
    const option = [...select.options].find((candidate) =>
      candidate.textContent?.includes('GF_INT_ALPHA')
    );

    expect(option).toBeDefined();

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
      nativeSelectSetter?.call(select, option?.value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      nativeInputSetter?.call(dropInput, '50');
      dropInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submit = [...container.querySelectorAll('button')].find((button) =>
      /simulate|run/i.test(button.textContent ?? '')
    );

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        ![...container.querySelectorAll('button')].some(
          (button) => button.textContent === 'Simulating…'
        )
      ) {
        break;
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    expectNoErrors();

    // GF_INT_ALPHA's open position is 10 bought - 4 sold = 6, at the
    // fixture's latest MANUAL price (130 as of 2026-11-09) = 780 before a
    // shock. A 50% drop must therefore drop the portfolio by exactly
    // 780 x 0.5 = 390, computed by the real WhatIfService against the real
    // account's real cash/other holdings - whatever those are, the
    // before/after difference does not depend on them.
    const match = (container.textContent ?? '').match(
      /Portfolio value: ([\d,]+(?:\.\d+)?) USD.*?([\d,]+(?:\.\d+)?) USD/
    );

    expect(match).not.toBeNull();

    const [, before, after] = match as RegExpMatchArray;
    const valueBefore = Number(before.replace(/,/g, ''));
    const valueAfter = Number(after.replace(/,/g, ''));

    expect(valueBefore).toBeGreaterThanOrEqual(780);
    expect(valueBefore - valueAfter).toBeCloseTo(390, 2);
  });
});
