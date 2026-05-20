/**
 * Card Component
 * Reusable card with consistent styling
 */
import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColor';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: number;
};

export function Card({ children, onPress, style, variant = 'default', padding = Spacing.base }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding,
    ...(variant === 'elevated' && {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 4,
    }),
    ...(variant === 'outlined' && {
      borderWidth: 1,
      borderColor: colors.border,
    }),
  };
  
  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        style={[cardStyle, animatedStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }
  
  return <View style={[cardStyle, style]}>{children}</View>;
}
