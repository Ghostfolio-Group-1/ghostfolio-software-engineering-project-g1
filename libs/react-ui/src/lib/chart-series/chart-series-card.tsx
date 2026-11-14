import { useMemo, useState } from 'react';

import { ChartWrapper } from '../chart-wrapper/chart-wrapper';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import {
  CHART_SERIES_KINDS,
  chartSeriesErrorMessage,
  useChartSeries
} from './use-chart-series';
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
  /** Skip ChartWrapper Card chrome when embedding in an existing page shell. */
  embedded?: boolean;
  /** Shared time-range only — this card does not invent a second range control. */
  range: ChartSeriesRangeSelection;
  /** Host authenticated fetch — required (no native-fetch default). */
  request: ChartSeriesFetch;
  initialKind?: ChartSeriesKind;
  title?: string;
}

/**
 * Visible portfolio chart with a kind toggle for value / invested / cash.
 * Loading, empty, and error states come from useChartSeries for the selected
 * kind; the toggle stays on screen so the series can be switched in any state.
 * Ready series render through the shared ChartWrapper.
 */
export function ChartSeriesCard({
  embedded = false,
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
      <SeriesKindToggle centered={embedded} kind={kind} onChange={setKind} />
      <div style={{ marginTop: px(designTokens.spacing.sm) }}>
        {status === 'ready' && data ? (
          <div>
            {!embedded ? (
              <p
                data-testid="chart-series-kind-label"
                style={{
                  color: theme.color.textMuted,
                  margin: `0 0 ${px(designTokens.spacing.sm)} 0`
                }}
              >
                Showing {seriesLabel}
              </p>
            ) : null}
            <ChartWrapper
              embedded={embedded}
              points={data.points}
              title={`${title} — ${seriesLabel}`}
            />
          </div>
        ) : (
          <DashboardCard
            emptyMessage={`No ${seriesLabel.toLowerCase()} data for this range`}
            errorMessage={chartSeriesErrorMessage(error)}
            onRetry={reload}
            status={status}
            title={title}
          />
        )}
      </div>
    </div>
  );
}

function SeriesKindToggle({
  centered = false,
  kind,
  onChange
}: {
  centered?: boolean;
  kind: ChartSeriesKind;
  onChange: (kind: ChartSeriesKind) => void;
}) {
  const theme = useTheme();

  return (
    <div
      aria-label="Chart series"
      data-testid="chart-series-toggle"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: px(designTokens.spacing.xs),
        justifyContent: centered ? 'center' : 'flex-start'
      }}
    >
      {CHART_SERIES_KINDS.map((option) => {
        const selected = option === kind;
        const label = CHART_SERIES_KIND_LABELS[option];

        return (
          <button
            aria-label={label}
            aria-pressed={selected}
            data-kind={option}
            data-selected={selected ? 'true' : 'false'}
            key={option}
            onClick={() => onChange(option)}
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
