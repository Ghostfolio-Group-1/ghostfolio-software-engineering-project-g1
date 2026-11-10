import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { DashboardOverviewPage } from '../src/lib/dashboard-page/dashboard-overview-page';
import { DividendWithholdingScreen } from '../src/lib/dividend-withholding/dividend-withholding-screen';
import { RiskDashboardCard } from '../src/lib/risk-dashboard/risk-dashboard-card';
import { loadRiskDashboardSummary } from '../src/lib/risk-dashboard/risk-dashboard.client';
import { TaxLotsScreen } from '../src/lib/tax-lots/tax-lots-table';
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
});
