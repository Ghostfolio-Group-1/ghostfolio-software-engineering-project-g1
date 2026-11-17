/** @jest-environment jsdom */
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { Button } from '../button/button';
import { darkTheme, lightTheme } from '../theme/theme';
import type { Theme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { designTokens } from '../tokens/design-tokens';
import { DashboardChartsSummary } from './dashboard-charts-summary';
import { toDashboardSections } from './dashboard-overview';
import type { DashboardOverviewData } from './dashboard-overview';
import { DashboardPage } from './dashboard-page';
import type { DashboardSectionViews } from './dashboard-page';
import { DashboardPartialFailure } from './dashboard-partial-failure';
import { DashboardRiskSummary } from './dashboard-risk-summary';

// Tue Nov 17 component gaps from docs/testing/dashboard/test-plan.md:
// every card in the dark theme, the Charts card with negative and very large
// values, the partial-failure Retry by keyboard, and Risk severity colours.

const overview: DashboardOverviewData = {
  charts: {
    data: {
      kind: 'portfolioValue',
      points: [
        { date: '2026-01-05', value: 3000 },
        { date: '2026-04-01', value: 4100 }
      ]
    },
    status: 'available'
  },
  risk: {
    data: {
      stock: {
        buckets: [
          { name: 'AAPL', percentage: 0.4, severity: 'RED' },
          { name: 'MSFT', percentage: 0.35, severity: 'YELLOW' },
          { name: 'SAP', percentage: 0.25, severity: 'GREEN' }
        ]
      }
    },
    status: 'available'
  },
  tax: {
    data: {
      method: 'FIFO',
      sales: [
        {
          currency: 'USD',
          realizedGainAfterActivityFees: '217.6',
          sellActivityId: 'fixture-order-04',
          sellDate: '2026-03-02T00:00:00.000Z'
        }
      ]
    },
    status: 'available'
  }
};

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(node: ReactNode, theme: Theme = lightTheme) {
  act(() => {
    root.render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
  });
}

// jsdom normalises inline colours to rgb(), so compare in that form.
function rgb(hex: string) {
  const probe = document.createElement('span');
  probe.style.color = hex;

  return probe.style.color;
}

function closest(
  element: Element | null,
  property: 'backgroundColor' | 'color'
) {
  for (let node = element; node; node = node.parentElement) {
    const value = (node as HTMLElement).style?.[property];

    if (value && value !== 'transparent') {
      return value;
    }
  }

  return undefined;
}

// Every element that renders text, with the colour it is drawn in and the
// surface it is drawn on (nearest inline values up the tree).
function textElements() {
  return [...container.querySelectorAll('*')]
    .filter((element) => {
      return [...element.childNodes].some((node) => {
        return node.nodeType === Node.TEXT_NODE && node.textContent?.trim();
      });
    })
    .map((element) => ({
      background: closest(element, 'backgroundColor'),
      color: closest(element, 'color'),
      text: element.textContent?.trim()
    }));
}

function dashboard(
  sections: Partial<DashboardSectionViews>,
  notice?: ReactNode
) {
  return <DashboardPage notice={notice} sections={sections} />;
}

describe('Dashboard cards in the dark theme', () => {
  const ready = toDashboardSections(overview);
  const states: {
    name: string;
    notice?: ReactNode;
    sections: Partial<DashboardSectionViews>;
  }[] = [
    { name: 'ready', sections: ready },
    {
      name: 'loading',
      sections: {
        charts: { status: 'loading' },
        risk: { status: 'loading' },
        tax: { status: 'loading' }
      }
    },
    {
      name: 'empty',
      sections: {
        charts: { status: 'empty' },
        risk: { status: 'empty' },
        tax: { status: 'empty' }
      }
    },
    {
      name: 'partial failure',
      notice: (
        <DashboardPartialFailure failed={['tax']} onRetry={() => undefined} />
      ),
      sections: { ...ready, tax: { status: 'error' } }
    }
  ];

  it.each(states)(
    'draws no text in its own background colour ($name)',
    ({ notice, sections }) => {
      render(dashboard(sections, notice), darkTheme);

      const elements = textElements();

      expect(elements.length).toBeGreaterThan(0);

      for (const { background, color, text } of elements) {
        expect({
          text,
          same: color !== undefined && color === background
        }).toEqual({
          text,
          same: false
        });
      }
    }
  );

  it.each(states)(
    'uses no light-theme text or surface colour ($name)',
    ({ notice, sections }) => {
      render(dashboard(sections, notice), darkTheme);

      const lightText = rgb(lightTheme.color.text);
      const lightSurfaces = [
        rgb(lightTheme.color.surface),
        rgb(lightTheme.color.background)
      ];
      const styled = [...container.querySelectorAll<HTMLElement>('[style]')];

      for (const element of styled) {
        expect(element.style.color).not.toBe(lightText);
        expect(lightSurfaces).not.toContain(element.style.backgroundColor);
      }

      const surfaces = styled
        .map((element) => element.style.backgroundColor)
        .filter(Boolean);

      expect(surfaces).toContain(rgb(darkTheme.color.surface));
    }
  );
});

describe('DashboardChartsSummary with extreme values', () => {
  it('formats a negative latest value with its sign and two decimals', () => {
    render(
      <DashboardChartsSummary
        kind="portfolioValue"
        points={[
          { date: '2026-01-05', value: 1500 },
          { date: '2026-02-05', value: -1234.5 }
        ]}
      />
    );

    expect(container.textContent).toContain('-1,234.50');
    expect(container.querySelector('path')?.getAttribute('d')).not.toMatch(
      /NaN|Infinity/
    );
  });

  it('formats a very large value with grouping and draws a finite path', () => {
    render(
      <DashboardChartsSummary
        kind="portfolioValue"
        points={[
          { date: '2026-01-05', value: 0.01 },
          { date: '2026-02-05', value: 12_345_678_901.239 }
        ]}
      />
    );

    expect(container.textContent).toContain('12,345,678,901.24');
    expect(container.querySelector('path')?.getAttribute('d')).not.toMatch(
      /NaN|Infinity/
    );
  });
});

describe('DashboardPartialFailure accessibility', () => {
  it('announces the failed section in a status region', () => {
    render(
      <DashboardPartialFailure failed={['tax']} onRetry={() => undefined} />
    );

    const status = container.querySelector('[role="status"]');

    expect(status?.textContent).toContain('Tax could not be loaded');
  });

  it('has a Retry control that takes keyboard focus and retries', () => {
    const onRetry = jest.fn();

    render(<DashboardPartialFailure failed={['tax']} onRetry={onRetry} />);

    const retry = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Retry'
    );

    expect(retry).toBeDefined();
    expect(retry?.disabled).toBe(false);
    expect(retry?.getAttribute('tabindex')).not.toBe('-1');
    expect(retry?.getAttribute('type')).toBe('button');

    act(() => retry?.focus());
    expect(document.activeElement).toBe(retry);

    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardRiskSummary severity colours', () => {
  it('colours each severity from the design tokens, with the label as text', () => {
    render(
      <DashboardRiskSummary
        buckets={[
          { name: 'AAPL', percentage: 0.4, severity: 'RED' },
          { name: 'MSFT', percentage: 0.35, severity: 'YELLOW' },
          { name: 'SAP', percentage: 0.2, severity: 'GREEN' },
          { name: 'VTI', percentage: 0.05, severity: 'NO_DATA' }
        ]}
      />,
      darkTheme
    );

    const colourOf = (label: string) => {
      const element = [
        ...container.querySelectorAll<HTMLElement>('span, td, strong')
      ].find((node) => node.textContent === label && node.style.color);

      return element?.style.color;
    };

    expect(colourOf('High')).toBe(rgb(designTokens.color.danger));
    expect(colourOf('Watch')).toBe(rgb(designTokens.color.warning));
    expect(colourOf('OK')).toBe(rgb(designTokens.color.success));
    expect(colourOf('No data')).toBe(rgb(darkTheme.color.textMuted));
  });
});

describe('Button used for Retry', () => {
  it('does not call onClick while disabled', () => {
    const onClick = jest.fn();

    render(
      <Button disabled onClick={onClick}>
        Retry
      </Button>
    );

    act(() => container.querySelector('button')?.click());

    expect(onClick).not.toHaveBeenCalled();
  });
});
