import { useMemo, useState } from 'react';

import type { AuthenticatedFetch } from '../data/api-request';
import { DividendWithholdingScreen } from '../dividend-withholding/dividend-withholding-screen';
import { RealizedGainsScreen } from '../realized-gains/realized-gains-screen';
import { TaxLotsScreen } from '../tax-lots/tax-lots-table';
import { YearlyTaxSummaryScreen } from '../yearly-tax-summary/yearly-tax-summary-screen';
import { createYearlyTaxSummaryLoader } from '../yearly-tax-summary/yearly-tax-summary.client';

export type TaxWorkspaceView = 'lots' | 'gains' | 'dividends' | 'yearly';

export interface TaxWorkspaceProps {
  request: AuthenticatedFetch;
  authRevision?: number;
}

const views: ReadonlyArray<{ id: TaxWorkspaceView; label: string }> = [
  { id: 'lots', label: 'Tax lots' },
  { id: 'gains', label: 'Realized gains' },
  { id: 'dividends', label: 'Dividend withholding' },
  { id: 'yearly', label: 'Yearly summary' }
];

/**
 * Composes the existing Tax React screens using the authenticated
 * request adapter provided by the host.
 *
 * Only the selected screen is mounted, preventing unnecessary
 * API requests from inactive views.
 *
 * Tax calculations remain authoritative in the backend.
 */
export function TaxWorkspace({ authRevision = 0, request }: TaxWorkspaceProps) {
  const [activeView, setActiveView] = useState<TaxWorkspaceView>('lots');

  const loadYearlySummary = useMemo(
    () => createYearlyTaxSummaryLoader(request),
    [request]
  );

  const activeLabel =
    views.find(({ id }) => id === activeView)?.label ?? 'Tax analytics';

  return (
    <section aria-label="Tax analytics workspace">
      <h2>Tax analytics</h2>

      <div aria-label="Tax analytics views" role="group">
        {views.map(({ id, label }) => (
          <button
            aria-pressed={activeView === id}
            key={id}
            onClick={() => setActiveView(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-label={`${activeLabel} view`}>
        {activeView === 'lots' ? (
          <TaxLotsScreen key={`lots-${authRevision}`} request={request} />
        ) : null}

        {activeView === 'gains' ? (
          <RealizedGainsScreen
            authRevision={authRevision}
            key={`gains-${authRevision}`}
            request={request}
          />
        ) : null}

        {activeView === 'dividends' ? (
          <DividendWithholdingScreen
            authRevision={authRevision}
            key={`dividends-${authRevision}`}
            request={request}
          />
        ) : null}

        {activeView === 'yearly' ? (
          <YearlyTaxSummaryScreen
            authRevision={authRevision}
            key={`yearly-${authRevision}`}
            load={loadYearlySummary}
          />
        ) : null}
      </section>
    </section>
  );
}
