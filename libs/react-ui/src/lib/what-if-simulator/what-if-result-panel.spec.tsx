import { renderToStaticMarkup } from 'react-dom/server';

import { WhatIfResultPanel } from './what-if-result-panel';
import type { WhatIfResultSummary } from './what-if-result-panel';

// Numbers taken from the worked example in
// docs/sesha-notes/10-risk-api-contract.md, Section 6.11.
const result: WhatIfResultSummary = {
  changedWarnings: [
    {
      actual: 0.2308,
      message: 'AAPL is 23.1% of your portfolio, above the 10% yellow limit.',
      ruleKey: 'SingleStockConcentration',
      severity: 'YELLOW',
      subject: { type: 'stock', value: 'AAPL' },
      threshold: 0.1
    },
    {
      actual: 0.2564,
      message: 'MSFT is 25.6% of your portfolio, above the 25% red limit.',
      ruleKey: 'SingleStockConcentration',
      severity: 'RED',
      subject: { type: 'stock', value: 'MSFT' },
      threshold: 0.25
    }
  ],
  holding: {
    allocationAfter: 0.2308,
    allocationBefore: 0.3333,
    valueAfter: { amount: 18000, currency: 'USD' },
    valueBefore: { amount: 30000, currency: 'USD' }
  },
  newWarnings: [],
  portfolio: {
    change: { amount: -12000, currency: 'USD' },
    changePercentage: -0.12,
    valueAfter: { amount: 88000, currency: 'USD' },
    valueBefore: { amount: 100000, currency: 'USD' }
  },
  resolvedWarnings: [],
  scenario: {
    dataSource: 'YAHOO',
    dropPercentage: 0.4,
    name: 'Apple Inc.',
    symbol: 'AAPL'
  },
  score: { after: 70, before: 72, change: -2 }
};

describe('WhatIfResultPanel', () => {
  it('renders the scenario name and drop percentage in the title', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    expect(html).toContain('Scenario: Apple Inc. (-40%)');
  });

  it('renders the before/after score with its change', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    expect(html).toContain('Before:');
    expect(html).toContain('<strong>72</strong>');
    expect(html).toContain('After:');
    expect(html).toContain('<strong>70</strong>');
    expect(html).toContain('-2');
    expect(html).toContain('color:#dc3545'); // negative change in red
  });

  it('colours the before/after score indicators by severity band', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    // 72 and 70 both fall in the 60-79.9 YELLOW band.
    expect(html).toContain('aria-label="Yellow"');
  });

  it('renders the holding allocation and portfolio value change', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    expect(html).toContain('Holding allocation: 33.3%');
    expect(html).toContain('23.1%');
    expect(html).toContain('Portfolio value:');
    expect(html).toContain('100,000 USD');
    expect(html).toContain('88,000 USD');
    expect(html).toContain('-12%');
  });

  it('lists changed warnings with their severity indicator', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    expect(html).toContain('Changed warnings');
    expect(html).toContain(
      'AAPL is 23.1% of your portfolio, above the 10% yellow limit.'
    );
    expect(html).toContain(
      'MSFT is 25.6% of your portfolio, above the 25% red limit.'
    );
  });

  it('shows "None" for warning sections with no entries', () => {
    const html = renderToStaticMarkup(<WhatIfResultPanel result={result} />);

    expect(html).toContain('New warnings');
    expect(html).toContain('Resolved warnings');
    expect(html.match(/None/g)?.length).toBe(2);
  });

  it('renders a null score as an em dash with a NO_DATA indicator', () => {
    const html = renderToStaticMarkup(
      <WhatIfResultPanel
        result={{
          ...result,
          score: { after: null, before: null, change: null }
        }}
      />
    );

    expect(html).toContain('<strong>—</strong>');
    expect(html).toContain('aria-label="No data"');
  });
});
