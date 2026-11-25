/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';

import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingSkeletonGroup,
  MetricTile,
  PercentField,
  ProgressBar,
  RangeBar,
  RiskButton,
  RiskCard,
  StatusPill,
  TextField,
  Toggle,
  VisuallyHidden
} from './risk-ui';

// These primitives call useRiskPalette() -> useTheme(), so (unlike the
// hook-free form components elsewhere in this library) they need a real
// render to exercise interactions - renderToStaticMarkup never calls event
// handlers, and calling the component as a plain function the way
// WhatIfSimulatorForm's spec does would invoke that hook outside of
// React's dispatcher.
describe('risk-ui primitives', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('RiskCard renders its children inside a themed card shell', () => {
    const html = renderToStaticMarkup(<RiskCard>Hello</RiskCard>);

    expect(html).toContain('Hello');
    expect(html).toContain('border-radius:16px');
  });

  it('RiskButton renders the primary variant by default and calls onClick', async () => {
    const onClick = jest.fn();

    await act(async () => {
      root.render(<RiskButton onClick={onClick}>Save</RiskButton>);
    });

    expect(container.textContent).toBe('Save');
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.style.height).toBe('40px');

    await act(async () => {
      button.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('RiskButton disables and dims a disabled button', () => {
    const html = renderToStaticMarkup(
      <RiskButton disabled onClick={() => {}}>
        Save
      </RiskButton>
    );

    expect(html).toContain('disabled=""');
  });

  it('Toggle renders a real checkbox labelled with the given text and reports changes', async () => {
    const onChange = jest.fn();

    await act(async () => {
      root.render(<Toggle checked={true} label="Active" onChange={onChange} />);
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.closest('label')?.textContent).toContain('Active');

    await act(async () => {
      checkbox.click();
    });

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('PercentField shows a % suffix and a label above the input, not glued to it', () => {
    const html = renderToStaticMarkup(
      <PercentField label="Warning max" onChange={() => {}} value="10" />
    );

    expect(html).toContain('Warning max');
    expect(html).toContain('value="10"');
    expect(html).toContain('>%<');
  });

  it('PercentField renders an inline error associated with the field', () => {
    const html = renderToStaticMarkup(
      <PercentField
        error="Must be less than the red limit."
        errorId="max-error"
        onChange={() => {}}
        value="90"
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Must be less than the red limit.');
    expect(html).toContain('aria-describedby="max-error"');
  });

  it('TextField renders the given value', () => {
    const html = renderToStaticMarkup(
      <TextField onChange={() => {}} value="EQUITY" />
    );

    expect(html).toContain('value="EQUITY"');
  });

  it('StatusPill renders its text content, not just a colour', () => {
    const html = renderToStaticMarkup(
      <StatusPill severity="RED">4 warnings</StatusPill>
    );

    expect(html).toContain('4 warnings');
  });

  it('Chip reflects selected state via aria-pressed and calls onClick', async () => {
    const onClick = jest.fn();

    await act(async () => {
      root.render(
        <Chip onClick={onClick} selected>
          Red
        </Chip>
      );
    });

    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      button.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ProgressBar clamps its value into 0-100', () => {
    const html = renderToStaticMarkup(
      <ProgressBar severity="RED" value={150} />
    );

    expect(html).toContain('width:100%');
  });

  it('RangeBar renders without an actual marker when none is given', () => {
    const html = renderToStaticMarkup(
      <RangeBar redMax={0.25} redMin={0} warnMax={0.1} />
    );

    expect(html).toContain('aria-hidden="true"');
  });

  it('RangeBar renders an actual-value marker when given', () => {
    const html = renderToStaticMarkup(
      <RangeBar actual={0.15} redMax={0.25} redMin={0} warnMax={0.1} />
    );

    expect(html.match(/position:absolute/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('MetricTile renders its label and value', () => {
    const html = renderToStaticMarkup(
      <MetricTile label="Top concentration" value="33.3%" />
    );

    expect(html).toContain('Top concentration');
    expect(html).toContain('33.3%');
  });

  it('EmptyState renders a title, helper message and optional action', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        actionLabel="Add holdings"
        message="Add accounts or holdings to see your risk score."
        onAction={() => {}}
        title="No portfolio data yet"
      />
    );

    expect(html).toContain('No portfolio data yet');
    expect(html).toContain('Add accounts or holdings to see your risk score.');
    expect(html).toContain('Add holdings');
  });

  it('EmptyState omits the action button when none is given', () => {
    const html = renderToStaticMarkup(
      <EmptyState message="No active warnings." />
    );

    expect(html).not.toContain('<button');
  });

  it('ErrorState renders the message and a retry button that calls onRetry', () => {
    const html = renderToStaticMarkup(
      <ErrorState message="Could not load data" onRetry={() => {}} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not load data');
    expect(html).toContain('Try again');
  });

  it('ErrorState omits the retry button when none is given', () => {
    const html = renderToStaticMarkup(<ErrorState message="Failed" />);

    expect(html).not.toContain('<button');
  });

  it('LoadingSkeletonGroup renders the requested number of skeleton rows plus an sr-only announcement', () => {
    const html = renderToStaticMarkup(<LoadingSkeletonGroup rows={4} />);

    expect(html.match(/class="riskSkeleton"/g)?.length).toBe(4);
    expect(html).toContain('Loading…');
  });

  it('VisuallyHidden keeps its text in the DOM for assistive tech while hiding it visually', () => {
    const html = renderToStaticMarkup(
      <VisuallyHidden>Loading…</VisuallyHidden>
    );

    expect(html).toContain('Loading…');
    expect(html).toContain('clip:rect(0, 0, 0, 0)');
  });
});
