/**
 * BalanceIndicator Component
 * Shows amount with color coding (green for owed, red for owe)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/lib/format';

type Props = {
  amount: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  currency?: string;
};

export function BalanceIndicator({ amount, showLabel = true, size = 'md', currency = 'INR' }: Props) {
  const colors = useThemeColors();
  
  const isPositive = amount > 0;
  const isZero = Math.abs(amount) < 0.01;
  
  const color = isZero ? colors.textTertiary : isPositive ? colors.primary : colors.negative;
  const label = isZero ? 'settled up' : isPositive ? 'you are owed' : 'you owe';
  
  const fontSizes = { sm: 14, md: 18, lg: 28 };
  const labelSizes = { sm: 10, md: 12, lg: 14 };
  
  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={[styles.label, { color, fontSize: labelSizes[size] }]}>
          {label}
        </Text>
      )}
      <Text style={[styles.amount, { color, fontSize: fontSizes[size] }]}>
        {isZero ? '—' : formatCurrency(amount, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  label: {
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    fontWeight: '700',
  },
});
