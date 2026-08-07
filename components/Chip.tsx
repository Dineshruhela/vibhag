/**
 * Chip Component
 * For filters, categories, tags, status indicators
 */
import { pressIn, pressOut } from '@/constants/Motion';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'filled' | 'outline' | 'ghost';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  color?: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  color,
  variant = 'outline',
  size = 'md',
  style,
}: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const activeColor = color ?? colors.primary;
  const isSmall = size === 'sm';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmall ? 4 : Spacing.xs,
    paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
    paddingVertical: isSmall ? 4 : Spacing.xs,
    borderRadius: BorderRadius.full,
    ...(variant === 'filled' || selected
      ? { backgroundColor: selected ? activeColor : colors.surface2 }
      : variant === 'outline'
      ? {
          backgroundColor: selected ? activeColor + '18' : 'transparent',
          borderWidth: 1.5,
          borderColor: selected ? activeColor : colors.border,
        }
      : { backgroundColor: selected ? activeColor + '18' : 'transparent' }),
  };

  const textColor = selected
    ? variant === 'filled'
      ? '#FFFFFF'
      : activeColor
    : colors.textSecondary;

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={() => { scale.value = pressIn(0.95); }}
        onPressOut={() => { scale.value = pressOut(); }}
        style={[containerStyle, animatedStyle, style]}
      >
        {icon && <View>{icon}</View>}
        <Text
          style={[
            styles.label,
            {
              fontSize: isSmall ? Typography.size.xs : Typography.size.sm,
              color: textColor,
              fontFamily: selected ? FontFamily.semibold : FontFamily.medium,
              fontWeight: selected ? '600' : '500',
            },
          ]}
        >
          {label}
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {icon && <View>{icon}</View>}
      <Text
        style={[
          styles.label,
          {
            fontSize: isSmall ? Typography.size.xs : Typography.size.sm,
            color: textColor,
            fontFamily: FontFamily.medium,
            fontWeight: '500',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: -0.1,
  },
});
