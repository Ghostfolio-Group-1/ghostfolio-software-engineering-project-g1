import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../button/button';
import { createEmptyWhatIfFormValues } from './what-if-form.model';
import type { WhatIfHoldingOption } from './what-if-form.model';
import { WhatIfSimulatorForm } from './what-if-simulator-form';

const holdings: WhatIfHoldingOption[] = [
  { dataSource: 'YAHOO', name: 'Apple Inc.', symbol: 'AAPL' },
  { dataSource: 'COINGECKO', name: 'Bitcoin', symbol: 'BTC' }
];

function findByType(node: ReactNode, type: unknown): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (!isValidElement(node)) {
    return undefined;
  }

  if (node.type === type) {
    return node;
  }

  return findByType((node.props as { children?: ReactNode }).children, type);
}

describe('WhatIfSimulatorForm', () => {
  it('renders the current values', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        holdings={holdings}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={{
          dataSource: 'YAHOO',
          dropPercentage: '40',
          scenarioName: 'Tech sell-off',
          symbol: 'AAPL'
        }}
      />
    );

    expect(html).toContain('value="Tech sell-off"');
    expect(html).toContain('value="YAHOO:AAPL"');
    expect(html).toContain('Apple Inc. (AAPL · YAHOO)');
    expect(html).toContain('value="40"');
    expect(html).toContain('Run simulation');
  });

  it('shows field errors with role="alert" and marks the select invalid', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        errors={{
          dropPercentage: 'Enter a drop percentage.',
          symbol: 'Choose a holding to shock.'
        }}
        holdings={holdings}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Choose a holding to shock.');
    expect(html).toContain('Enter a drop percentage.');
    expect(html).toContain('aria-invalid="true"');
  });

  it('shows no errors when there are none', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        holdings={holdings}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).not.toContain('role="alert"');
  });

  it('disables the submit button and shows a busy label while submitting', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        holdings={holdings}
        isSubmitting
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Simulating…');
  });

  it('disables the holding select and shows a placeholder on an empty portfolio', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        holdings={[]}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('No holdings available');

    const select = findByType(
      WhatIfSimulatorForm({
        holdings: [],
        onChange: jest.fn(),
        onSubmit: jest.fn(),
        values: createEmptyWhatIfFormValues()
      }),
      'select'
    );

    expect((select?.props as { disabled: boolean }).disabled).toBe(true);
  });

  it('calls onSubmit when the submit button is activated', () => {
    const onSubmit = jest.fn();
    const button = findByType(
      WhatIfSimulatorForm({
        holdings,
        onChange: jest.fn(),
        onSubmit,
        values: createEmptyWhatIfFormValues()
      }),
      Button
    );

    (button?.props as { onClick: () => void }).onClick();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with the selected holding symbol and its data source', () => {
    const onChange = jest.fn();
    const values = createEmptyWhatIfFormValues();
    const select = findByType(
      WhatIfSimulatorForm({
        holdings,
        onChange,
        onSubmit: jest.fn(),
        values
      }),
      'select'
    );

    (select?.props as { onChange: (event: unknown) => void }).onChange({
      target: { value: 'COINGECKO:BTC' }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...values,
      dataSource: 'COINGECKO',
      symbol: 'BTC'
    });
  });

  it('clears the symbol when the placeholder option is reselected', () => {
    const onChange = jest.fn();
    const values = { ...createEmptyWhatIfFormValues(), symbol: 'AAPL' };
    const select = findByType(
      WhatIfSimulatorForm({
        holdings,
        onChange,
        onSubmit: jest.fn(),
        values
      }),
      'select'
    );

    (select?.props as { onChange: (event: unknown) => void }).onChange({
      target: { value: '' }
    });

    expect(onChange).toHaveBeenCalledWith({ ...values, symbol: '' });
  });
});
