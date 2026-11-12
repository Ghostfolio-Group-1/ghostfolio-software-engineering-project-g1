import { useMemo, useState } from 'react';

import { DashboardCard } from '../dashboard-card/dashboard-card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import { useWaterfall, waterfallErrorMessage } from './use-waterfall';
import { WATERFALL_BREAKDOWNS, toWaterfallBars } from './waterfall.client';
import type {
  WaterfallBar,
  WaterfallBreakdown,
  WaterfallCategory,
  WaterfallFetch,
  WaterfallRangeQuery
} from './waterfall.client';

const CHART_HEIGHT = 180;
const CHART_WIDTH = 480;
const CHART_PADDING_TOP = 12;
const CHART_PADDING_BOTTOM = 28;
const BAR_GAP = 12;

export const WATERFALL_BREAKDOWN_LABELS: Record<WaterfallBreakdown, string> = {
  holding: 'By holding',
  portfolio: 'Portfolio'
};

export const WATERFALL_CATEGORY_LABELS: Record<WaterfallCategory, string> = {
  dividends: 'Dividends',
  marketGainLoss: 'Market gain/loss',
  netCashFlow: 'Net cash flow'
};

export type WaterfallRangeSelection =
  { range: string } | { endDate: string; startDate: string };

export interface WaterfallCardProps {
  /** Shared time-range only — this card does not invent a second range control. */
  range: WaterfallRangeSelection;
  /** Host authenticated fetch — required (no native-fetch default). */
  request: WaterfallFetch;
  initialBreakdown?: WaterfallBreakdown;
  title?: string;
}

const valueFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});

function categoryColor(
  category: WaterfallCategory | undefined,
  kind: WaterfallBar['kind'],
  primary: string,
  textMuted: string
): string {
  if (kind === 'start' || kind === 'end') {
    return textMuted;
  }

  switch (category) {
    case 'netCashFlow':
      return designTokens.color.secondary;
    case 'dividends':
      return designTokens.color.success;
    case 'marketGainLoss':
      return primary;
    default:
      return primary;
  }
}

function barGeometry(bars: WaterfallBar[]) {
  const values = bars.flatMap((bar) => [bar.y0, bar.y1]);
  const min = values.length > 0 ? Math.min(...values, 0) : 0;
  const max = values.length > 0 ? Math.max(...values, 0) : 0;
  const span = max === min ? 1 : max - min;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const slot =
    bars.length > 0 ? (CHART_WIDTH - BAR_GAP) / bars.length : CHART_WIDTH;
  const barWidth = Math.max(slot - BAR_GAP, 8);

  function toY(value: number): number {
    return CHART_PADDING_TOP + ((max - value) / span) * plotHeight;
  }

  return { barWidth, min, plotHeight, slot, toY };
}

function WaterfallChart({
  bars,
  currency,
  endDate,
  startDate
}: {
  bars: WaterfallBar[];
  currency: string;
  endDate: string;
  startDate: string;
}) {
  const theme = useTheme();
  const { barWidth, slot, toY } = barGeometry(bars);
  const zeroY = toY(0);

  return (
    <svg
      aria-label={`Contribution waterfall from ${startDate} to ${endDate} in ${currency}`}
      data-testid="waterfall-chart"
      role="img"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
    >
      <line
        stroke={theme.color.border}
        strokeWidth={1}
        x1={0}
        x2={CHART_WIDTH}
        y1={zeroY}
        y2={zeroY}
      />
      {bars.map((bar, index) => {
        const x = index * slot + BAR_GAP / 2;
        const yTop = toY(bar.y1);
        const yBottom = toY(bar.y0);
        const height = Math.max(yBottom - yTop, 1);
        const fill = categoryColor(
          bar.category,
          bar.kind,
          theme.color.primary,
          theme.color.textMuted
        );
        const label = bar.holdingSymbol
          ? `${bar.label} (${bar.holdingSymbol})`
          : bar.label;

        return (
          <g key={`${bar.kind}-${bar.label}-${index}`}>
            <title>{`${label}: ${valueFormat.format(bar.value)} ${currency}`}</title>
            <rect
              data-testid={`waterfall-bar-${bar.kind}`}
              fill={fill}
              height={height}
              width={barWidth}
              x={x}
              y={yTop}
            />
            <text
              fill={theme.color.textMuted}
              fontSize={10}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={CHART_HEIGHT - 8}
            >
              {bar.holdingSymbol ?? bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Contribution / waterfall panel for portfolio charts. Shares the parent
 * time-range; the only local control is portfolio vs holding breakdown.
 * Loading, empty, and error states come from useWaterfall.
 */
export function WaterfallCard({
  initialBreakdown = 'portfolio',
  range,
  request,
  title = 'Contribution'
}: WaterfallCardProps) {
  const [breakdown, setBreakdown] =
    useState<WaterfallBreakdown>(initialBreakdown);
  const query = useMemo(
    (): WaterfallRangeQuery => ({ ...range, breakdown }),
    [breakdown, range]
  );
  const { data, error, reload, status } = useWaterfall(query, request);
  const theme = useTheme();
  const bars = data ? toWaterfallBars(data.segments) : [];

  return (
    <div data-testid="waterfall-card">
      <BreakdownToggle breakdown={breakdown} onChange={setBreakdown} />
      <div style={{ marginTop: px(designTokens.spacing.sm) }}>
        {status === 'ready' && data ? (
          <div>
            <p
              data-testid="waterfall-breakdown-label"
              style={{
                color: theme.color.textMuted,
                margin: `0 0 ${px(designTokens.spacing.sm)} 0`
              }}
            >
              Showing {WATERFALL_BREAKDOWN_LABELS[breakdown]} · {data.currency}
            </p>
            <ul
              aria-label="Contribution categories"
              style={{
                color: theme.color.textMuted,
                display: 'flex',
                flexWrap: 'wrap',
                gap: px(designTokens.spacing.md),
                listStyle: 'none',
                margin: `0 0 ${px(designTokens.spacing.sm)} 0`,
                padding: 0
              }}
            >
              <li style={{ color: designTokens.color.secondary }}>
                {WATERFALL_CATEGORY_LABELS.netCashFlow}
              </li>
              <li style={{ color: theme.color.primary }}>
                {WATERFALL_CATEGORY_LABELS.marketGainLoss}
              </li>
              <li style={{ color: designTokens.color.success }}>
                {WATERFALL_CATEGORY_LABELS.dividends}
              </li>
            </ul>
            <WaterfallChart
              bars={bars}
              currency={data.currency}
              endDate={data.endDate}
              startDate={data.startDate}
            />
          </div>
        ) : (
          <DashboardCard
            emptyMessage="No contribution data for this range"
            errorMessage={waterfallErrorMessage(error)}
            onRetry={reload}
            status={status}
            title={title}
          />
        )}
      </div>
    </div>
  );
}

function BreakdownToggle({
  breakdown,
  onChange
}: {
  breakdown: WaterfallBreakdown;
  onChange: (breakdown: WaterfallBreakdown) => void;
}) {
  const theme = useTheme();

  return (
    <div
      data-testid="waterfall-breakdown-toggle"
      role="group"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: px(designTokens.spacing.xs)
      }}
    >
      {WATERFALL_BREAKDOWNS.map((option) => {
        const selected = option === breakdown;

        return (
          <button
            aria-pressed={selected}
            key={option}
            onClick={() => onChange(option)}
            style={{
              background: selected ? theme.color.primary : theme.color.surface,
              border: `1px solid ${
                selected ? theme.color.primary : theme.color.border
              }`,
              borderRadius: px(designTokens.borderRadius.sm),
              color: selected ? theme.color.primaryText : theme.color.text,
              cursor: 'pointer',
              fontFamily: designTokens.fontFamily,
              fontSize: px(designTokens.fontSize.sm),
              padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`
            }}
            type="button"
          >
            {WATERFALL_BREAKDOWN_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
