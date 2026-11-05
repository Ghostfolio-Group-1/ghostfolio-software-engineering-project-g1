import { useMemo, useState } from 'react';

import { toPath } from '../chart-wrapper/chart-wrapper';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { CHART_SERIES_KINDS, useChartSeries } from './use-chart-series';
import type {
  ChartSeriesFetch,
  ChartSeriesKind,
  ChartSeriesRangeQuery
} from './use-chart-series';

export const CHART_SERIES_KIND_LABELS: Record<ChartSeriesKind, string> = {
  cash: 'Cash',
  investedCapital: 'Invested capital',
  portfolioValue: 'Portfolio value'
};

export type ChartSeriesRangeSelection =
  { range: string } | { endDate: string; startDate: string };

export interface ChartSeriesCardProps {
  /** Shared time-range only — this card does not invent a second range control. */
  range: ChartSeriesRangeSelection;
  initialKind?: ChartSeriesKind;
  request?: ChartSeriesFetch;
  title?: string;
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

/**
 * Visible portfolio chart with a kind toggle for value / invested / cash.
 * Loading, empty, and error states come from useChartSeries for the selected
 * kind; the toggle stays on screen so the series can be switched in any state.
 */
export function ChartSeriesCard({
  initialKind = 'portfolioValue',
  range,
  request,
  title = 'Portfolio chart'
}: ChartSeriesCardProps) {
  const [kind, setKind] = useState<ChartSeriesKind>(initialKind);
  const query = useMemo(
    (): ChartSeriesRangeQuery => ({ ...range, kind }),
    [kind, range]
  );
  const { data, error, reload, status } = useChartSeries(query, request);
  const theme = useTheme();
  const seriesLabel = CHART_SERIES_KIND_LABELS[kind];

  return (
    <div data-testid="chart-series-card">
      <SeriesKindToggle kind={kind} onChange={setKind} />
      <div style={{ marginTop: px(designTokens.spacing.sm) }}>
        <DashboardCard
          emptyMessage={`No ${seriesLabel.toLowerCase()} data for this range`}
          errorMessage={error?.message ?? 'Chart data is unavailable'}
          onRetry={reload}
          status={status}
          title={title}
        >
          {data ? (
            <div>
              <p
                data-testid="chart-series-kind-label"
                style={{
                  color: theme.color.textMuted,
                  margin: `0 0 ${px(designTokens.spacing.sm)} 0`
                }}
              >
                Showing {seriesLabel}
              </p>
              <svg
                aria-label={`${title}: ${seriesLabel}`}
                data-testid="chart-series-svg"
                role="img"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                width="100%"
              >
                <path
                  d={toPath(data.points, CHART_WIDTH, CHART_HEIGHT)}
                  fill="none"
                  stroke={theme.color.primary}
                  strokeWidth={2}
                />
              </svg>
            </div>
          ) : null}
        </DashboardCard>
      </div>
    </div>
  );
}

function SeriesKindToggle({
  kind,
  onChange
}: {
  kind: ChartSeriesKind;
  onChange: (kind: ChartSeriesKind) => void;
}) {
  const theme = useTheme();

  return (
    <div
      aria-label="Chart series"
      data-testid="chart-series-toggle"
      role="radiogroup"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: px(designTokens.spacing.xs)
      }}
    >
      {CHART_SERIES_KINDS.map((option) => {
        const selected = option === kind;
        const label = CHART_SERIES_KIND_LABELS[option];

        return (
          <button
            aria-checked={selected}
            data-kind={option}
            data-selected={selected ? 'true' : 'false'}
            key={option}
            onClick={() => onChange(option)}
            role="radio"
            style={{
              backgroundColor: selected ? theme.color.primary : 'transparent',
              border: `1px solid ${theme.color.primary}`,
              borderRadius: px(designTokens.borderRadius.sm),
              color: selected ? theme.color.primaryText : theme.color.text,
              cursor: 'pointer',
              fontSize: px(designTokens.fontSize.sm),
              fontWeight: selected ? 600 : 400,
              padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`
            }}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
