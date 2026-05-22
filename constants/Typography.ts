/**
 * Splitmaro Typography System
 */

export const Typography = {
  // Font families (using system fonts + Inter via expo-font)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },

  // Font sizes
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 40,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font weights
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
};

// Pre-defined text styles
export const TextStyles = {
  largeTitle: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headline: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  body: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.regular,
  },
  bodyMedium: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
  },
  caption: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.regular,
  },
  captionMedium: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  small: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.regular,
  },
  amount: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  amountLarge: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.extrabold,
    letterSpacing: Typography.letterSpacing.tight,
  },
};
