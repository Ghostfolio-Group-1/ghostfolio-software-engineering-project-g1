import { useState } from 'react';

import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { ChartSeriesCard } from './chart-series-card';
import type { ChartSeriesFetch } from './use-chart-series';

export const INTERACTIVE_CHART_RANGES = [
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1Y' },
  { id: '5y', label: '5Y' },
  { id: 'max', label: 'Max' }
] as const;

export type InteractiveChartRange =
  (typeof INTERACTIVE_CHART_RANGES)[number]['id'];

export interface InteractiveChartProps {
  initialRange?: InteractiveChartRange;
  request: ChartSeriesFetch;
}

/**
 * Portfolio value series on the shared ChartWrapper, with the YTD, 1Y, 5Y,
 * and Max presets. Custom start/end dates and a zoom viewport stay on #196.
 * Kind can still be switched from the card; the chart opens on value.
 */
export function InteractiveChart({
  initialRange = 'max',
  request
}: InteractiveChartProps) {
  const [range, setRange] = useState<InteractiveChartRange>(initialRange);
  const theme = useTheme();

  return (
    <div data-testid="interactive-chart">
      <div
        aria-label="Time range"
        role="group"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: px(designTokens.spacing.xs),
          marginBottom: px(designTokens.spacing.sm)
        }}
      >
        {INTERACTIVE_CHART_RANGES.map((option) => {
          const selected = option.id === range;

          return (
            <button
              aria-pressed={selected}
              data-range={option.id}
              key={option.id}
              onClick={() => setRange(option.id)}
              style={{
                backgroundColor: selected ? theme.color.primary : 'transparent',
                border: `1px solid ${theme.color.primary}`,
                borderRadius: px(designTokens.borderRadius.sm),
                color: selected ? theme.color.primaryText : theme.color.text,
                cursor: 'pointer',
                fontSize: px(designTokens.fontSize.sm),
                fontWeight: selected ? 600 : 400,
                padding: `${px(designTokens.spacing.xs)} ${px(
                  designTokens.spacing.sm
                )}`
              }}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <ChartSeriesCard
        initialKind="portfolioValue"
        range={{ range }}
        request={request}
        title="Portfolio value"
      />
    </div>
  );
}
