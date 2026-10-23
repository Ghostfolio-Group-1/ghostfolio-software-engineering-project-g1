import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../button/button';
import { darkTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { DashboardCard } from './dashboard-card';

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

describe('DashboardCard', () => {
  it('shows an accessible loading state and hides the content', () => {
    const html = renderToStaticMarkup(
      <DashboardCard status="loading" title="Risk">
        <p>Score 72</p>
      </DashboardCard>
    );

    expect(html).toContain('Risk');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading');
    expect(html).not.toContain('Score 72');
  });

  it('shows the error message in the danger color', () => {
    const html = renderToStaticMarkup(
      <DashboardCard
        errorMessage="Tax data is unavailable"
        status="error"
        title="Tax"
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Tax data is unavailable');
    expect(html).toContain('color:#dc3545');
  });

  it('uses a default error message', () => {
    expect(
      renderToStaticMarkup(<DashboardCard status="error" title="Tax" />)
    ).toContain('Something went wrong');
  });

  it('shows a retry button only when onRetry is provided', () => {
    expect(
      renderToStaticMarkup(
        <DashboardCard onRetry={jest.fn()} status="error" title="Tax" />
      )
    ).toContain('Try again');
    expect(
      renderToStaticMarkup(<DashboardCard status="error" title="Tax" />)
    ).not.toContain('Try again');
  });

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = jest.fn();
    const button = findByType(
      DashboardCard({ onRetry, status: 'error', title: 'Tax' }),
      Button
    );

    (button?.props as { onClick: () => void }).onClick();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty message and hides the content', () => {
    const html = renderToStaticMarkup(
      <DashboardCard
        emptyMessage="No holdings yet"
        status="empty"
        title="Charts"
      >
        <p>Chart</p>
      </DashboardCard>
    );

    expect(html).toContain('No holdings yet');
    expect(html).not.toContain('<p>Chart</p>');
    expect(
      renderToStaticMarkup(<DashboardCard status="empty" title="Charts" />)
    ).toContain('No data yet');
  });

  it('renders the content when ready, with no status or alert', () => {
    const html = renderToStaticMarkup(
      <DashboardCard status="ready" title="Risk">
        <p>Score 72</p>
      </DashboardCard>
    );

    expect(html).toContain('<p>Score 72</p>');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  it('uses the muted color of the active theme', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <DashboardCard status="empty" title="Charts" />
      </ThemeProvider>
    );

    expect(html).toContain('color:#bdbdbd');
  });
});
