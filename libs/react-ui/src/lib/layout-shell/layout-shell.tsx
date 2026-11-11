import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface LayoutShellProps {
  children?: ReactNode;
  title: string;
}

export function LayoutShell({ children, title }: LayoutShellProps) {
  const theme = useTheme();

  // The shell sits inside the Ghostfolio page, so it lets the host background
  // show through and takes its text colour from the active theme.
  return (
    <div
      style={{
        backgroundColor: 'transparent',
        color: theme.color.text,
        fontFamily: designTokens.fontFamily,
        minHeight: '100vh'
      }}
    >
      <header
        style={{
          borderBottom: `2px solid ${designTokens.color.primary}`,
          padding: `${px(designTokens.spacing.md)} ${px(designTokens.spacing.lg)}`
        }}
      >
        <h1 style={{ fontSize: px(designTokens.fontSize.xl), margin: 0 }}>
          {title}
        </h1>
      </header>
      <main style={{ padding: px(designTokens.spacing.lg) }}>{children}</main>
    </div>
  );
}
