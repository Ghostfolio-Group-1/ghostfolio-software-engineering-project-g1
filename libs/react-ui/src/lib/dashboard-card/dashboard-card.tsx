import type { ReactNode } from 'react';

import { Button } from '../button/button';
import { Card } from '../card/card';
import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export type DashboardCardStatus = 'empty' | 'error' | 'loading' | 'ready';

export interface DashboardCardProps {
  children?: ReactNode;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  status: DashboardCardStatus;
  title: string;
}

// One card per dashboard section. Each section loads independently, so a
// failing API shows an error in its own card instead of breaking the page.
export function DashboardCard({
  children,
  emptyMessage = 'No data yet',
  errorMessage = 'Something went wrong',
  onRetry,
  status,
  title
}: DashboardCardProps) {
  return <Card title={title}>{renderState()}</Card>;

  function renderState() {
    switch (status) {
      case 'loading':
        return (
          <div aria-busy="true" role="status">
            <Message tone="muted">Loading…</Message>
          </div>
        );
      case 'error':
        return (
          <div role="alert">
            <Message tone="danger">{errorMessage}</Message>
            {onRetry ? (
              <Button onClick={onRetry} variant="secondary">
                Try again
              </Button>
            ) : null}
          </div>
        );
      case 'empty':
        return <Message tone="muted">{emptyMessage}</Message>;
      default:
        return children;
    }
  }
}

function Message({
  children,
  tone
}: {
  children: ReactNode;
  tone: 'danger' | 'muted';
}) {
  const theme = useTheme();

  return (
    <p
      style={{
        color:
          tone === 'danger' ? designTokens.color.danger : theme.color.textMuted,
        margin: `0 0 ${px(designTokens.spacing.sm)} 0`
      }}
    >
      {children}
    </p>
  );
}
