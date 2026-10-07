import { designTokens, px } from './design-tokens';

describe('designTokens', () => {
  it('should expose the brand colors', () => {
    expect(designTokens.color.primary).toBe('#36cfcc');
    expect(designTokens.color.secondary).toBe('#3686cf');
  });

  it('should use a 4px-based spacing scale', () => {
    expect(designTokens.spacing.xs).toBe(4);
    expect(designTokens.spacing.sm).toBe(8);
    expect(designTokens.spacing.md).toBe(16);
    expect(designTokens.spacing.lg).toBe(24);
    expect(designTokens.spacing.xl).toBe(32);
  });

  it('should convert numbers to pixel strings', () => {
    expect(px(16)).toBe('16px');
  });
});
