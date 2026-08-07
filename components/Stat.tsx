/**
 * Stat Component
 * KPI card with optional trend indicator
 */
import { Enter } from '@/constants/Motion';
import { BorderRadius, Elevation, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

type Trend = 'up' | 'down' | 'neutral';

type Props = {
  label: string;
  value: string;
  /** Trend indicator */
  trend?: Trend;
  trendLabel?: string;
  /** Colored accent strip on left edge */
  accentColor?: string;
  icon?: string;
  style?: ViewStyle;
  index?: number;
};

export function Stat({
  label,
  value,
  trend,
  trendLabel,
  accentColor,
  icon,
  style,
  index = 0,
}: Props) {
  const colors = useThemeColors();

  const trendColor =
    trend === 'up'
      ? colors.positive
      : trend === 'down'
      ? colors.negative
      : colors.textTertiary;

  const trendIcon =
    trend === 'up'
      ? 'trending-up'
      : trend === 'down'
      ? 'trending-down'
      : 'remove';

  return (
    <Animated.View
      entering={Enter.stagger(index)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadowColor,
        },
        accentColor && { borderLeftWidth: 3, borderLeftColor: accentColor },
        style,
      ]}
    >
      {icon && (
        <View style={[styles.iconWrapper, { backgroundColor: colors.surface2 }]}>
          <Ionicons name={icon as any} size={18} color={accentColor ?? colors.primary} />
        </View>
      )}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {trend && trendLabel && (
        <View style={styles.trend}>
          <Ionicons name={trendIcon as any} size={12} color={trendColor} />
          <Text style={[styles.trendLabel, { color: trendColor }]}>{trendLabel}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
    ...Elevation.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: Typography.size.xl,
    fontFamily: FontFamily.extrabold,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trendLabel: {
    fontSize: Typography.size.xs,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
  },
});
