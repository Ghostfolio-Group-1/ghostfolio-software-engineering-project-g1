import { renderToStaticMarkup } from 'react-dom/server';

import { createEmptyWhatIfFormValues } from './what-if-form.model';
import type { WhatIfResultSummary } from './what-if-result-panel';
import { WhatIfSimulator } from './what-if-simulator';

const result: WhatIfResultSummary = {
  changedWarnings: [],
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

describe('WhatIfSimulator', () => {
  it('always renders the form', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="idle"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('Run simulation');
  });

  it('shows inline field errors for invalid input without an API error banner', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        errors={{ symbol: 'Choose a holding to shock.' }}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="idle"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('Choose a holding to shock.');
    expect(html).not.toContain('Could not run the simulation');
  });

  it('shows the default API error message and a retry button on status "error"', () => {
    const onRetry = jest.fn();
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onRetry={onRetry}
        onSubmit={jest.fn()}
        status="error"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not run the simulation. Please try again.');
    expect(html).toContain('Try again');
  });

  it('shows a specific API error message (e.g. RISK_WHATIF_HOLDING_NOT_FOUND) when given', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        apiErrorMessage="No open holding found for YAHOO:TSLA"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="error"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('No open holding found for YAHOO:TSLA');
  });

  it('omits the retry button when none is given', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="error"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).not.toContain('Try again');
  });

  it('disables the submit button while submitting and shows no error or result', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="submitting"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
  });

  it('renders the result panel once status is "ready"', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        result={result}
        status="ready"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('Scenario: Apple Inc.');
  });

  it('does not render the result panel if ready but no result was given', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="ready"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).not.toContain('Scenario:');
  });

  it('passes the given holdings through to the holding selector', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        holdings={[{ dataSource: 'YAHOO', name: 'Apple Inc.', symbol: 'AAPL' }]}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="idle"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('Apple Inc. (AAPL · YAHOO)');
  });

  it('defaults to no holdings, showing the empty-portfolio placeholder', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulator
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        status="idle"
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('No holdings available');
  });
});
