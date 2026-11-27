import { ChartWrapper } from '../chart-wrapper/chart-wrapper';
import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { formatDrawdownPercent } from './drawdown.client';
import type {
  DrawdownData,
  DrawdownFetch,
  DrawdownRangeQuery
} from './drawdown.client';
import { drawdownErrorMessage, useDrawdown } from './use-drawdown';

export type DrawdownRangeSelection = DrawdownRangeQuery;

export interface DrawdownCardProps {
  /** Skip ChartWrapper Card chrome when embedding in an existing page shell. */
  embedded?: boolean;
  /** Shared time-range only — this card does not invent a second range control. */
  range: DrawdownRangeSelection;
  /** Host authenticated fetch — required (no native-fetch default). */
  request: DrawdownFetch;
  title?: string;
}

function toChartPoints(data: DrawdownData) {
  return data.points.map((point) => ({
    date: point.date,
    value: point.drawdown
  }));
}

/**
 * Drawdown panel for the live GET /api/v1/charts/drawdown route. Shares the
 * parent time-range; peak tracking stays server-side. Empty ranges use the
 * DashboardCard empty state; a single history point still renders (short
 * history) with max drawdown at 0%.
 */
export function DrawdownCard({
  embedded = false,
  range,
  request,
  title = 'Drawdown'
}: DrawdownCardProps) {
  const { data, error, reload, status } = useDrawdown(range, request);
  const theme = useTheme();
  const shortHistory = data !== null && data.points.length === 1;

  return (
    <div data-testid="drawdown-card">
      {status === 'ready' && data ? (
        <div>
          <p
            data-testid="drawdown-max"
            style={{
              margin: `0 0 ${px(designTokens.spacing.xs)} 0`,
              textAlign: embedded ? 'center' : 'start'
            }}
          >
            <span style={{ color: theme.color.textMuted }}>Max drawdown </span>
            <span style={{ fontWeight: 600 }}>
              {formatDrawdownPercent(data.maxDrawdown)}
            </span>
            <span style={{ color: theme.color.textMuted }}>
              {' '}
              on {data.maxDrawdownDate}
            </span>
          </p>
          {shortHistory ? (
            <p
              data-testid="drawdown-short-history"
              style={{
                color: theme.color.textMuted,
                margin: `0 0 ${px(designTokens.spacing.sm)} 0`,
                textAlign: embedded ? 'center' : 'start'
              }}
            >
              Not enough history for a meaningful drawdown yet.
            </p>
          ) : null}
          <ChartWrapper
            embedded={embedded}
            points={toChartPoints(data)}
            title={title}
          />
        </div>
      ) : (
        <DashboardCard
          emptyMessage="No drawdown data for this range"
          errorMessage={drawdownErrorMessage(error)}
          onRetry={reload}
          status={status}
          title={title}
        />
      )}
    </div>
  );
}
