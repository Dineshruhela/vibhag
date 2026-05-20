/**
 * FAB - Floating Action Button
 */
import React from 'react';
import { StyleSheet, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BorderRadius, Spacing } from '@/constants/Spacing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  color?: string;
  bottom?: number;
};

export function FAB({ onPress, icon = 'add', label, color = '#1CC29F', bottom = 24 }: Props) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <AnimatedPressable
      style={[
        styles.container,
        { backgroundColor: color, bottom },
        label ? styles.extended : styles.circular,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.9, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 400 }); }}
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      {label && <Text style={styles.label}>{label}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  circular: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  extended: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius['2xl'],
    gap: Spacing.sm,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
