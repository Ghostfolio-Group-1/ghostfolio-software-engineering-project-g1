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

// Skeleton line chart: points evenly spaced on x, scaled between the series
// min and max on y. A flat series is drawn at mid-height.
export function toPath(
  points: ChartPoint[],
  width: number,
  height: number
): string {
  if (points.length === 0) {
    return '';
  }

  const values = points.map(({ value }) => value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  return points
    .map(({ value }, index) => {
      const x = points.length > 1 ? index * step : width / 2;
      const y =
        max === min
          ? height / 2
          : height - ((value - min) / (max - min)) * height;

      return `${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`;
    })
    .join(' ');
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

  return (
    <Card title={title}>
      {points.length === 0 ? (
        <p style={{ color: theme.color.textMuted, margin: 0 }}>
          No data for this range
        </p>
      ) : (
        <svg
          aria-label={title}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
        >
          <path
            d={toPath(points, width, height)}
            fill="none"
            stroke={theme.color.primary}
            strokeWidth={2}
          />
        </svg>
      )}
    </Card>
  );
}
