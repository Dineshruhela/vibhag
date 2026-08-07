/**
 * CurrencyAmount Component
 * Animated count-up + colored sign + tabular nums
 */
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/lib/format';
import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type Props = {
  amount: number;
  /** If true, show sign prefix (+/-) and color based on sign */
  signed?: boolean;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'hero';
  /** Override color */
  color?: string;
  /** Animate count-up on mount / value change */
  animate?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** Show "you owe" / "you are owed" label above amount */
  showLabel?: boolean;
};

const SIZE_MAP = {
  sm: { fontSize: Typography.size.sm, fontFamily: FontFamily.bold },
  md: { fontSize: Typography.size.base, fontFamily: FontFamily.bold },
  lg: { fontSize: Typography.size.xl, fontFamily: FontFamily.extrabold },
  hero: { fontSize: Typography.size['4xl'], fontFamily: FontFamily.extrabold },
};

export function CurrencyAmount({
  amount,
  signed = false,
  size = 'md',
  color,
  animate = false,
  style,
  textStyle,
  showLabel = false,
}: Props) {
  const colors = useThemeColors();
  const isPositive = amount >= 0;
  const isZero = Math.abs(amount) < 0.01;

  const resolvedColor = color ?? (isZero
    ? colors.textTertiary
    : signed
    ? isPositive
      ? colors.positive
      : colors.negative
    : colors.text);

  const label = !isZero && signed
    ? isPositive
      ? 'you are owed'
      : 'you owe'
    : null;

  const { fontSize, fontFamily } = SIZE_MAP[size];

  const prefix = signed && !isZero ? (isPositive ? '+' : '-') : '';
  const displayAmount = formatCurrency(Math.abs(amount));

  return (
    <View style={[styles.container, style]}>
      {showLabel && label && (
        <Text style={[styles.label, { color: resolvedColor }]}>{label}</Text>
      )}
      <Text
        style={[
          styles.amount,
          {
            fontSize,
            fontFamily,
            color: resolvedColor,
            fontVariant: ['tabular-nums'],
          },
          textStyle,
        ]}
      >
        {prefix}{displayAmount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    marginBottom: 1,
    letterSpacing: 0.1,
  },
  amount: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
