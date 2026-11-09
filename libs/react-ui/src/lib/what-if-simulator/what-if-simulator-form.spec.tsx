import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../button/button';
import { createEmptyWhatIfFormValues } from './what-if-form.model';
import { WhatIfSimulatorForm } from './what-if-simulator-form';

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
    expect(html).toContain('value="AAPL"');
    expect(html).toContain('value="40"');
    expect(html).toContain('Run simulation');
  });

  it('shows field errors with role="alert" and marks the input invalid', () => {
    const html = renderToStaticMarkup(
      <WhatIfSimulatorForm
        errors={{
          dropPercentage: 'Enter a drop percentage.',
          symbol: 'Choose a holding to shock.'
        }}
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
        isSubmitting
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        values={createEmptyWhatIfFormValues()}
      />
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Simulating…');
  });

  it('calls onSubmit when the submit button is activated', () => {
    const onSubmit = jest.fn();
    const button = findByType(
      WhatIfSimulatorForm({
        onChange: jest.fn(),
        onSubmit,
        values: createEmptyWhatIfFormValues()
      }),
      Button
    );

    (button?.props as { onClick: () => void }).onClick();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with the updated symbol field', () => {
    const onChange = jest.fn();
    const values = createEmptyWhatIfFormValues();
    const rendered = WhatIfSimulatorForm({
      onChange,
      onSubmit: jest.fn(),
      values
    });
    const inputs = collectInputs(rendered);
    const symbolInput = inputs.find(
      (input) =>
        (input.props as { placeholder?: string }).placeholder === 'e.g. AAPL'
    );

    (symbolInput?.props as { onChange: (event: unknown) => void }).onChange({
      target: { value: 'MSFT' }
    });

    expect(onChange).toHaveBeenCalledWith({ ...values, symbol: 'MSFT' });
  });
});

function collectInputs(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectInputs(child));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const found = node.type === 'input' ? [node] : [];
  const children = (node.props as { children?: ReactNode }).children;

  return [...found, ...collectInputs(children)];
}
