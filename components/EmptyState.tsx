/**
 * EmptyState Component
 * Shown when lists are empty
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Spacing, BorderRadius } from '@/constants/Spacing';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  const colors = useThemeColors();
  
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={48} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onAction}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['4xl'],
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
