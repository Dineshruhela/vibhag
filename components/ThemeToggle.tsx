/**
 * ThemeToggle Component - A quick icon button to toggle Light / Dark theme
 */
import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';
import { useThemeColors } from '../hooks/useThemeColor';

interface Props {
  size?: number;
  style?: ViewStyle;
}

export function ThemeToggle({ size = 22, style }: Props) {
  const { colorScheme, toggleTheme } = useThemeContext();
  const colors = useThemeColors();

  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
      hitSlop={8}
      accessibilityLabel="Toggle Theme"
      accessibilityRole="button"
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={size}
        color={isDark ? '#F59E0B' : colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
