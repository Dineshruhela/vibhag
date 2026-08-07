/**
 * SegmentedControl Component
 * Replaces duplicated tab UIs across Activity and Group detail screens
 */
import { Spring } from '@/constants/Motion';
import { BorderRadius } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

type Segment<T extends string> = {
  key: T;
  label: string;
  icon?: string;
};

type Props<T extends string> = {
  segments: Segment<T>[];
  selected: T;
  onChange: (key: T) => void;
  style?: ViewStyle;
};

export function SegmentedControl<T extends string>({
  segments,
  selected,
  onChange,
  style,
}: Props<T>) {
  const colors = useThemeColors();
  const selectedIndex = segments.findIndex((s) => s.key === selected);
  const segmentCount = segments.length;

  const activeIndex = useSharedValue(selectedIndex);

  const handleSelect = (key: T, index: number) => {
    Haptics.selectionAsync();
    activeIndex.value = withSpring(index, Spring.snappy);
    onChange(key);
  };

  // When selected changes externally
  React.useEffect(() => {
    activeIndex.value = withSpring(selectedIndex, Spring.snappy);
  }, [selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: activeIndex.value * (100 / segmentCount) + '%' as any,
      },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface2, borderColor: colors.border },
        style,
      ]}
    >
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            width: `${100 / segmentCount}%`,
            backgroundColor: colors.surface,
            shadowColor: colors.shadowColor,
          },
          indicatorStyle,
        ]}
      />

      {segments.map((seg, index) => {
        const isSelected = seg.key === selected;
        return (
          <Pressable
            key={seg.key}
            style={styles.segment}
            onPress={() => handleSelect(seg.key, index)}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isSelected ? colors.text : colors.textTertiary,
                  fontFamily: isSelected ? FontFamily.semibold : FontFamily.medium,
                  fontWeight: isSelected ? '600' : '500',
                },
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: BorderRadius.sm,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: Typography.size.sm,
    letterSpacing: -0.1,
  },
});
