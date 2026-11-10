import { Button } from '../button/button';
import { Card } from '../card/card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';
import type {
  DashboardSectionKey,
  DashboardSectionViews
} from './dashboard-page';
import { DASHBOARD_SECTIONS } from './dashboard-page';

export interface DashboardPartialFailureProps {
  failed: DashboardSectionKey[];
  onRetry?: () => void;
}

/** Sections whose card is in the error state, in page order. */
export function failedSections(
  sections: Partial<DashboardSectionViews>
): DashboardSectionKey[] {
  return DASHBOARD_SECTIONS.filter(
    ({ key }) => sections[key]?.status === 'error'
  ).map(({ key }) => key);
}

/** True when some, but not all, sections failed: the page is still useful. */
export function isPartialFailure(failed: DashboardSectionKey[]) {
  return failed.length > 0 && failed.length < DASHBOARD_SECTIONS.length;
}

// Shown above the cards when one source is down and the others still render,
// so the user knows the page is incomplete and can retry the missing parts.
// Names the sections only; never shows server error text.
export function DashboardPartialFailure({
  failed,
  onRetry
}: DashboardPartialFailureProps) {
  const theme = useTheme();

  if (!isPartialFailure(failed)) {
    return null;
  }

  const names = DASHBOARD_SECTIONS.filter(({ key }) => failed.includes(key))
    .map(({ title }) => title)
    .join(', ');

  return (
    <Card title="Some sections are unavailable">
      <div data-testid="dashboard-partial-failure" role="status">
        <p
          style={{
            color: theme.color.text,
            margin: `0 0 ${px(designTokens.spacing.sm)} 0`
          }}
        >
          {names} could not be loaded. The other sections are shown below.
        </p>
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary">
            Retry
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
