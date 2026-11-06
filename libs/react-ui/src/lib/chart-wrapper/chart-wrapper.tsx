import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { Card } from '../card/card';
import { useTheme } from '../theme/theme-provider';

// Same shape as ChartSeriesPoint in @ghostfolio/common, kept local so the
// React library has no dependency on the API types.
export interface ChartPoint {
  date: string;
  value: number;
}

export interface ChartWrapperProps {
  height?: number;
  points: ChartPoint[];
  title: string;
  width?: number;
}

export function formatChartValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

// Points are evenly spaced on x and scaled between the series min and max on y.
// A flat series sits at mid-height.
export function pointPosition(
  points: ChartPoint[],
  index: number,
  width: number,
  height: number
): { x: number; y: number } {
  const values = points.map(({ value }) => value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const value = points[index]?.value ?? min;
  const x = points.length > 1 ? index * step : width / 2;
  const y =
    max === min ? height / 2 : height - ((value - min) / (max - min)) * height;

  return { x: round(x), y: round(y) };
}

export function toPath(
  points: ChartPoint[],
  width: number,
  height: number
): string {
  if (points.length === 0) {
    return '';
  }

  return points
    .map((_, index) => {
      const { x, y } = pointPosition(points, index, width, height);

      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function indexFromPointer(
  event: PointerEvent<SVGSVGElement>,
  count: number
): number {
  if (count <= 1) {
    return 0;
  }

  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio =
    bounds.width === 0 ? 0 : (event.clientX - bounds.left) / bounds.width;

  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ChartWrapper({
  height = 160,
  points,
  title,
  width = 480
}: ChartWrapperProps) {
  const theme = useTheme();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const index =
    activeIndex === null || activeIndex >= points.length
      ? Math.max(points.length - 1, 0)
      : activeIndex;
  const active = points[index];
  const marker = active
    ? pointPosition(points, index, width, height)
    : undefined;

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;

    setActiveIndex(Math.min(points.length - 1, Math.max(0, index + delta)));
  }

  return (
    <Card title={title}>
      {points.length === 0 || !active ? (
        <p style={{ color: theme.color.textMuted, margin: 0 }}>
          No data for this range
        </p>
      ) : (
        <div>
          <p
            data-testid="chart-value-readout"
            style={{
              color: theme.color.text,
              fontSize: '1rem',
              fontWeight: 600,
              margin: '8px 0'
            }}
          >
            {active.date}: {formatChartValue(active.value)}
          </p>
          <svg
            aria-label={`${title}, ${active.date}, ${formatChartValue(active.value)}`}
            onKeyDown={onKeyDown}
            onPointerLeave={() => setActiveIndex(null)}
            onPointerMove={(event) =>
              setActiveIndex(indexFromPointer(event, points.length))
            }
            role="img"
            tabIndex={0}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
          >
            <path
              d={toPath(points, width, height)}
              fill="none"
              stroke={theme.color.primary}
              strokeWidth={2}
            />
            {marker ? (
              <circle
                cx={marker.x}
                cy={marker.y}
                data-testid="chart-value-marker"
                fill={theme.color.primary}
                r={4}
              />
            ) : null}
          </svg>
        </div>
      )}
    </Card>
  );
}
