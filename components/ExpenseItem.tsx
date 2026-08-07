/**
 * ExpenseItem Component — v2
 * Single expense row with new typography, press animation, tabular nums
 */
import { CategoryColors } from '@/constants/Colors';
import { pressIn, pressOut } from '@/constants/Motion';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { Expense } from '../lib/database';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  expense: Expense;
  currentUserId: string;
  myShare?: number;
  iPaid?: number;
  onPress?: () => void;
};

export function ExpenseItem({ expense, currentUserId, myShare = 0, iPaid = 0, onPress }: Props) {
  const colors = useThemeColors();
  const category = CategoryColors[expense.category] || CategoryColors.general;
  const scale = useSharedValue(1);

  const netAmount = iPaid - myShare;
  const isPositive = netAmount > 0;
  const isZero = Math.abs(netAmount) < 0.01;

  const amountColor = isZero
    ? colors.textTertiary
    : isPositive
    ? colors.positive
    : colors.negative;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = pressIn(0.987); }}
      onPressOut={() => { scale.value = pressOut(); }}
      style={[styles.container, animatedStyle]}
    >
      {/* Category icon */}
      <View style={[styles.iconWrapper, { backgroundColor: category.color + '1A' }]}>
        <Ionicons name={category.icon as any} size={20} color={category.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.description, { color: colors.text, fontFamily: FontFamily.semibold }]}
          numberOfLines={1}
        >
          {expense.description}
        </Text>
        <Text style={[styles.meta, { color: colors.textTertiary, fontFamily: FontFamily.regular }]}>
          {expense.creator_name || 'You'} paid {formatCurrency(expense.amount)}
          {' · '}
          {formatRelativeTime(expense.created_at)}
        </Text>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        {!isZero && (
          <>
            <Text style={[styles.amountLabel, { color: amountColor, fontFamily: FontFamily.medium }]}>
              {isPositive ? 'you lent' : 'you owe'}
            </Text>
            <Text
              style={[
                styles.amount,
                { color: amountColor, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
              ]}
            >
              {formatCurrency(Math.abs(netAmount))}
            </Text>
          </>
        )}
        {isZero && (
          <Text style={[styles.amountLabel, { color: colors.textTertiary, fontFamily: FontFamily.regular }]}>
            settled
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: Typography.size.base,
    fontWeight: '600',
  },
  meta: {
    fontSize: Typography.size.xs,
    fontWeight: '400',
    lineHeight: 16,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amountLabel: {
    fontSize: Typography.size.xs,
    fontWeight: '500',
  },
  amount: {
    fontSize: Typography.size.base,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

