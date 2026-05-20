/**
 * ExpenseItem Component
 * Single expense row in a list
 */
import { CategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Expense } from '../lib/database';

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
  
  const netAmount = iPaid - myShare;
  const isPositive = netAmount > 0;
  const isZero = Math.abs(netAmount) < 0.01;
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrapper, { backgroundColor: category.color + '20' }]}>
        <Ionicons name={category.icon as any} size={22} color={category.color} />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={[styles.meta, { color: colors.textTertiary }]}>
          {expense.creator_name || 'You'} paid {formatCurrency(expense.amount)} · {formatRelativeTime(expense.created_at)}
        </Text>
      </View>
      
      <View style={styles.amountContainer}>
        {!isZero && (
          <>
            <Text style={[styles.amountLabel, { color: isPositive ? colors.primary : colors.negative }]}>
              {isPositive ? 'you lent' : 'you borrowed'}
            </Text>
            <Text style={[styles.amount, { color: isPositive ? colors.primary : colors.negative }]}>
              {formatCurrency(Math.abs(netAmount))}
            </Text>
          </>
        )}
        {isZero && (
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            not involved
          </Text>
        )}
      </View>
    </Pressable>
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
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
