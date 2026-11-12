import { renderToStaticMarkup } from 'react-dom/server';

import { RiskThresholdsList } from './risk-thresholds-list';
import type { RiskThresholdItem } from './risk-thresholds.client';

const items: RiskThresholdItem[] = [
  {
    defaults: { max: 0.1, redMax: 0.25 },
    isActive: true,
    isCustomized: false,
    name: 'Single stock concentration',
    ruleKey: 'SingleStockConcentration',
    shape: 'ceiling',
    thresholds: { max: 0.1, redMax: 0.25 }
  },
  {
    defaults: { max: 0.3, min: 0.02, redMax: 0.3, redMin: 0.005 },
    isActive: true,
    isCustomized: false,
    name: 'Cash allocation',
    ruleKey: 'CashAllocation',
    shape: 'band',
    thresholds: { max: 0.3, min: 0.02, redMax: 0.3, redMin: 0.005 }
  }
];

describe('RiskThresholdsList', () => {
  it('renders one row per rule when ready', () => {
    const html = renderToStaticMarkup(
      <RiskThresholdsList
        items={items}
        onReset={() => {}}
        onRetry={() => {}}
        onSave={() => {}}
        rowErrors={{}}
        status="ready"
      />
    );

    expect(html).toContain('Single stock concentration');
    expect(html).toContain('Cash allocation');
  });

  it('shows the loading state', () => {
    const html = renderToStaticMarkup(
      <RiskThresholdsList
        onReset={() => {}}
        onRetry={() => {}}
        onSave={() => {}}
        rowErrors={{}}
        status="loading"
      />
    );

    expect(html).toContain('Loading…');
  });

  it('shows the error state with a retry button', () => {
    const html = renderToStaticMarkup(
      <RiskThresholdsList
        errorMessage="Risk thresholds are unavailable right now"
        onReset={() => {}}
        onRetry={() => {}}
        onSave={() => {}}
        rowErrors={{}}
        status="error"
      />
    );

    expect(html).toContain('Risk thresholds are unavailable right now');
    expect(html).toContain('Try again');
  });
});
