/**
 * Splitmaro Typography System — v2
 * Inter (body) + Cabinet Grotesk (display) loaded via expo-font
 */

// Font family keys — matched to expo-font loaded names in app/_layout.tsx
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  // Display / headings
  displayMedium: 'CabinetGrotesk_500Medium',
  displayBold: 'CabinetGrotesk_700Bold',
  displayExtrabold: 'CabinetGrotesk_800ExtraBold',
};

export const Typography = {
  fontFamily: FontFamily,

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
    '5xl': 48,
  },

  // Line heights (multipliers — apply to fontSize)
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
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
    tightest: -1,
    tight: -0.5,
    normal: 0,
    wide: 0.3,
    wider: 0.6,
    widest: 1.2,
  },
};

// Pre-defined text styles
export const TextStyles = {
  largeTitle: {
    fontFamily: FontFamily.displayExtrabold,
    fontSize: Typography.size['4xl'],
    fontWeight: Typography.weight.extrabold,
    letterSpacing: Typography.letterSpacing.tightest,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headline: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.regular,
  },
  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.regular,
  },
  captionMedium: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  small: {
    fontFamily: FontFamily.regular,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.regular,
  },
  // Tabular numeric variant — for currency/amounts
  amount: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.tight,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  amountLarge: {
    fontFamily: FontFamily.extrabold,
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.extrabold,
    letterSpacing: Typography.letterSpacing.tightest,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  amountHero: {
    fontFamily: FontFamily.displayExtrabold,
    fontSize: Typography.size['5xl'],
    fontWeight: Typography.weight.extrabold,
    letterSpacing: Typography.letterSpacing.tightest,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: Typography.letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
};
