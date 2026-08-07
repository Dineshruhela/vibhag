/**
 * Button Component — v2
 * Variants: filled | tonal | outline | ghost
 * Sizes: sm | md | lg
 * States: default | loading | disabled
 */
import { pressIn, pressOut } from '@/constants/Motion';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'filled' | 'tonal' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  gradient?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
};

const SIZE_CONFIG = {
  sm: { height: 36, px: Spacing.md, fontSize: Typography.size.sm, radius: BorderRadius.sm },
  md: { height: 48, px: Spacing.lg, fontSize: Typography.size.base, radius: BorderRadius.md },
  lg: { height: 56, px: Spacing.xl, fontSize: Typography.size.md, radius: BorderRadius.lg },
};

export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'md',
  loading = false,
  disabled = false,
  gradient = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  haptic = true,
}: Props) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const cfg = SIZE_CONFIG[size];

  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isDisabled ? 0.5 : 1,
  }));

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      height: cfg.height,
      borderRadius: cfg.radius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: cfg.px,
      overflow: 'hidden',
    };

    switch (variant) {
      case 'filled':
        return { ...base, backgroundColor: gradient ? 'transparent' : colors.primary };
      case 'tonal':
        return { ...base, backgroundColor: colors.primaryLight };
      case 'outline':
        return { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary };
      case 'ghost':
        return { ...base, backgroundColor: 'transparent' };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'filled':
        return '#FFFFFF';
      case 'tonal':
        return colors.primary;
      case 'outline':
        return colors.primary;
      case 'ghost':
        return colors.primary;
    }
  };

  const labelStyle: TextStyle = {
    fontSize: cfg.fontSize,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: getTextColor(),
    letterSpacing: -0.2,
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[labelStyle, textStyle]}>{label}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  if (variant === 'filled' && gradient) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={() => { scale.value = pressIn(); }}
        onPressOut={() => { scale.value = pressOut(); }}
        style={[animatedStyle, style]}
        disabled={isDisabled}
      >
        <LinearGradient
          colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[getContainerStyle(), { opacity: 1 }]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => { scale.value = pressIn(); }}
      onPressOut={() => { scale.value = pressOut(); }}
      style={[getContainerStyle(), animatedStyle, style]}
      disabled={isDisabled}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({});
