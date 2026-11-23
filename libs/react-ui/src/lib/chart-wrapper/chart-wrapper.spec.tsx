import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { ChartWrapper, toPath } from './chart-wrapper';

const points = [
  { date: '2026-01-01', value: 10 },
  { date: '2026-01-02', value: 20 },
  { date: '2026-01-03', value: 15 }
];

describe('toPath', () => {
  it('scales points between the series min and max', () => {
    expect(toPath(points, 300, 100)).toBe('M0,100 L150,0 L300,50');
  });

  it('draws a flat series at mid-height', () => {
    expect(
      toPath(
        [
          { date: '2026-01-01', value: 5 },
          { date: '2026-01-02', value: 5 }
        ],
        300,
        100
      )
    ).toBe('M0,50 L300,50');
  });

  it('centers a single point', () => {
    expect(toPath([{ date: '2026-01-01', value: 5 }], 300, 100)).toBe(
      'M150,50'
    );
  });

  it('returns an empty path for no points', () => {
    expect(toPath([], 300, 100)).toBe('');
  });
});

describe('ChartWrapper', () => {
  it('renders the title and an accessible line chart', () => {
    const html = renderToStaticMarkup(
      <ChartWrapper
        height={100}
        points={points}
        title="Portfolio value"
        width={300}
      />
    );

    expect(html).toContain('Portfolio value');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Portfolio value"');
    expect(html).toContain('d="M0,100 L150,0 L300,50"');
    // #36cfcc on white is 1.92:1. The light-theme mark is #0d7377 (5.62:1).
    expect(html).toContain('stroke="#0d7377"');
    expect(html).not.toContain('stroke="#36cfcc"');
  });

  it('keeps the primary teal on a dark background, where it already clears 3:1', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <ChartWrapper points={points} title="Portfolio value" />
      </ThemeProvider>
    );

    expect(html).toContain('stroke="#36cfcc"');
  });

  it('shows an empty state instead of a chart when there are no points', () => {
    const html = renderToStaticMarkup(
      <ChartWrapper points={[]} title="Cash" />
    );

    expect(html).toContain('No data for this range');
    expect(html).not.toContain('<svg');
  });
});
