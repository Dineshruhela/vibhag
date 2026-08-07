/**
 * Card Component — v2
 * Elevation-aware, animated, supports gradient accent bar
 */
import { pressIn, pressOut } from '@/constants/Motion';
import { BorderRadius, Elevation, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
  padding?: number;
  /** Colored gradient accent strip at the top of the card */
  accentColor?: string;
};

export function Card({ children, onPress, style, variant = 'default', padding = Spacing.base, accentColor }: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const baseStyle: ViewStyle = {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...(variant === 'elevated' && {
      ...Elevation.md,
      shadowColor: colors.shadowColor,
    }),
    ...(variant === 'outlined' && {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    }),
    ...(variant === 'default' && {
      ...Elevation.sm,
      shadowColor: colors.shadowColor,
    }),
  };

  const inner = (
    <BlurView
      intensity={variant === 'ghost' ? 0 : 35}
      tint="dark"
      style={[
        {
          flex: 1,
          padding,
          backgroundColor: variant === 'ghost' ? 'transparent' : colors.glass,
          borderColor: colors.borderLight,
          borderWidth: variant === 'ghost' ? 0 : 1,
        },
      ]}
    >
      {accentColor && (
        <LinearGradient
          colors={[accentColor, accentColor + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accent}
        />
      )}
      {children}
    </BlurView>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = pressIn(); }}
        onPressOut={() => { scale.value = pressOut(); }}
        style={[baseStyle, animatedStyle, style]}
      >
        {inner}
      </AnimatedPressable>
    );
  }

  return <View style={[baseStyle, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  accent: {
    height: 3,
    marginHorizontal: -Spacing.base,
    marginTop: -Spacing.base,
    marginBottom: Spacing.md,
  },
});
