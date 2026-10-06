import type { ReactNode } from 'react';

import { designTokens, px } from '../tokens/design-tokens';

export interface LayoutShellProps {
  children?: ReactNode;
  title: string;
}

export function LayoutShell({ children, title }: LayoutShellProps) {
  return (
    <div
      style={{
        backgroundColor: designTokens.color.background,
        color: designTokens.color.text,
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
