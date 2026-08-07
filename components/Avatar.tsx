/**
 * Avatar Component — v2
 * Initials or image, with optional ring/border
 */
import { FontFamily } from '@/constants/Typography';
import { getInitials } from '@/lib/format';
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

type Props = {
  name: string;
  color: string;
  size?: number;
  fontSize?: number;
  avatarUrl?: string | null;
  /** Show a ring border around the avatar */
  ring?: boolean;
  ringColor?: string;
  style?: any;
};

export function Avatar({
  name,
  color,
  size = 44,
  fontSize,
  avatarUrl,
  ring = false,
  ringColor,
  style,
}: Props) {
  const resolvedFontSize = fontSize ?? Math.round(size * 0.36);

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color,
    ...(ring && {
      borderWidth: 2,
      borderColor: ringColor ?? '#FFFFFF',
    }),
  };

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            ...(ring && { borderWidth: 2, borderColor: ringColor ?? '#FFFFFF' }),
          },
          style,
        ]}
      />
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <Text
        style={[
          styles.text,
          {
            fontSize: resolvedFontSize,
            fontFamily: FontFamily.bold,
          },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
